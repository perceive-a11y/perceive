/**
 * Deep scan orchestration — forks a child process to run Playwright + axe-core
 * against rendered storefront pages.
 *
 * The static Rust scan runs synchronously first (1-3s), then this module forks
 * the worker for runtime scanning. The dashboard polls for completion.
 */

import { fork } from "node:child_process";
import { resolve } from "node:path";

import prisma from "./db.server";
import { decrypt } from "./crypto.server";

// Worker and DB paths use process.cwd() (web/) for reliability across
// dev (Vite) and production (compiled) environments.
const WORKER_PATH = resolve(process.cwd(), "app/lib/deep-scan-worker.mjs");
const DB_PATH = resolve(process.cwd(), "dev.db");

/**
 * Check whether a deep scan is already running for this merchant.
 *
 * # Arguments
 *
 * * `merchantId` - The merchant's database ID
 *
 * # Returns
 *
 * True if a scan with status "deep-scan-pending" or "deep-scan-running" exists.
 */
export async function isDeepScanRunning(merchantId: number): Promise<boolean> {
    const running = await prisma.scan.findFirst({
        where: {
            merchantId,
            status: { in: ["deep-scan-pending", "deep-scan-running"] },
        },
    });
    return running !== null;
}

/**
 * Fork the deep scan worker as a child process.
 *
 * The worker runs Playwright + axe-core against the storefront, writes
 * findings directly to SQLite, computes a composite score, and updates
 * the scan status to "completed" or "failed".
 *
 * # Arguments
 *
 * * `scanId` - The Scan record ID (must already exist with static findings)
 * * `shopDomain` - The merchant's .myshopify.com domain
 * * `encryptedPassword` - AES-256-GCM encrypted store password, or null
 *
 * # Returns
 *
 * The child process PID (for logging).
 *
 * # Errors
 *
 * Throws if the encrypted password cannot be decrypted.
 */
export async function forkDeepScanWorker(
    scanId: number,
    shopDomain: string,
    encryptedPassword: string | null,
): Promise<number> {
    let password = "";
    if (encryptedPassword) {
        try {
            password = decrypt(encryptedPassword);
        } catch {
            // Clear invalid stored password so user is prompted again
            await prisma.merchant.updateMany({
                where: { shopDomain },
                data: { storePassword: null },
            });
            throw new Error("Stored password could not be decrypted. Please re-enter it.");
        }
    }

    // Update scan status before forking
    await prisma.scan.update({
        where: { id: scanId },
        data: { status: "deep-scan-pending" },
    });

    const child = fork(WORKER_PATH, [
        scanId.toString(),
        shopDomain,
        password,
        DB_PATH,
    ], {
        // Detach so the worker survives if this request handler ends
        detached: false,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
    });

    // Log worker output
    child.stdout?.on("data", (data: Buffer) => {
        process.stdout.write(data);
    });
    child.stderr?.on("data", (data: Buffer) => {
        process.stderr.write(data);
    });

    // Handle unexpected worker death
    child.on("exit", async (code) => {
        if (code !== 0) {
            console.error(`[deep-scan] Worker exited with code ${code} for scan ${scanId}`);
            try {
                // Mark scan as failed if worker crashed
                // Use better-sqlite3 directly to avoid Prisma connection issues
                // in the event handler context
                await prisma.scan.updateMany({
                    where: { id: scanId, status: { not: "completed" } },
                    data: { status: "failed" },
                });
            } catch (e) {
                console.error("[deep-scan] Failed to update scan status after crash:", e);
            }
        }
    });

    return child.pid ?? 0;
}

/**
 * Compute a composite accessibility score from findings.
 *
 * # Arguments
 *
 * * `findings` - Array of findings with severity and element fields
 *
 * # Returns
 *
 * Integer score 0-100. Higher is better.
 */
export function computeScore(
    findings: Array<{ severity: string; criterionId: string; element: string }>,
): number {
    // Deduplicate by normalized key
    const deduped = new Map<string, { severity: string }>();
    for (const f of findings) {
        const key = normalizeDedupeKey(f.criterionId, f.element);
        const existing = deduped.get(key);
        const rank: Record<string, number> = {
            critical: 0, serious: 1, moderate: 2, minor: 3,
        };
        if (!existing || (rank[f.severity] ?? 3) < (rank[existing.severity] ?? 3)) {
            deduped.set(key, { severity: f.severity });
        }
    }

    let criticalCount = 0;
    let seriousCount = 0;
    let moderateCount = 0;
    let minorCount = 0;
    for (const f of deduped.values()) {
        switch (f.severity) {
            case "critical": criticalCount++; break;
            case "serious": seriousCount++; break;
            case "moderate": moderateCount++; break;
            default: minorCount++; break;
        }
    }

    return Math.max(
        0,
        100 - criticalCount * 15 - seriousCount * 8 - moderateCount * 3 - minorCount * 1,
    );
}

/**
 * Normalize an element HTML string into a deduplication key.
 *
 * Extracts tag:id:src:href from the HTML — loose enough to catch real overlaps
 * (same img missing alt, same link with bad text) without over-matching.
 */
export function normalizeDedupeKey(criterionId: string, elementHtml: string): string {
    const tagMatch = elementHtml.match(/^<(\w+)/);
    const tag = tagMatch ? tagMatch[1].toLowerCase() : "?";
    const idMatch = elementHtml.match(/\bid=["']([^"']+)/);
    const id = idMatch ? idMatch[1] : "";
    const srcMatch = elementHtml.match(/\bsrc=["']([^"']+)/);
    const src = srcMatch ? srcMatch[1] : "";
    const hrefMatch = elementHtml.match(/\bhref=["']([^"']+)/);
    const href = hrefMatch ? hrefMatch[1] : "";
    return `${criterionId}:${tag}:${id}:${src}:${href}`;
}
