/**
 * Deep scan orchestration -- dispatches scans to the worker service in
 * production, or forks a local child process in development.
 *
 * The static Rust scan runs synchronously first (1-3s), then this module
 * hands off runtime scanning. The dashboard polls for completion.
 */

import prisma from "./db.server";
import { decrypt } from "./crypto.server";

/** How long to wait for the worker service to accept the request (ms). */
const DISPATCH_TIMEOUT_MS = 30_000;

/** Guardian timeout: mark scan failed if no callback arrives (ms). */
const GUARDIAN_TIMEOUT_MS = 6 * 60 * 1000;

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
 * Dispatch a deep scan to the worker service, or fork locally if WORKER_URL
 * is not set (local development fallback).
 *
 * # Arguments
 *
 * * `scanId` - The Scan record ID (must already exist with static findings)
 * * `shopDomain` - The merchant's .myshopify.com domain
 * * `encryptedPassword` - AES-256-GCM encrypted store password, or null
 *
 * # Errors
 *
 * Throws if the encrypted password cannot be decrypted.
 */
export async function dispatchDeepScan(
    scanId: number,
    shopDomain: string,
    encryptedPassword: string | null,
): Promise<void> {
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

    // Update scan status before dispatching
    await prisma.scan.update({
        where: { id: scanId },
        data: { status: "deep-scan-pending" },
    });

    const workerUrl = process.env.WORKER_URL;
    if (workerUrl) {
        await dispatchToWorkerService(scanId, shopDomain, password, workerUrl);
    } else {
        await forkLocalWorker(scanId, shopDomain, password);
    }
}

/**
 * Wake a suspended Fly worker machine via the Machines API.
 *
 * Uses the internal API endpoint (`_api.internal:4280`) available to all
 * machines within the same Fly organization over WireGuard -- no auth token
 * needed. Lists machines for the worker app, finds one that is suspended or
 * stopped, and sends a start request. Waits briefly for the machine to
 * become reachable before returning.
 *
 * # Arguments
 *
 * * `workerApp` - The Fly app name for the worker (e.g. "perceive-a11y-worker")
 */
async function ensureWorkerRunning(workerApp: string): Promise<void> {
    const apiBase = "http://_api.internal:4280";

    // List all machines for the worker app
    const listResp = await fetch(`${apiBase}/v1/apps/${workerApp}/machines`, {
        signal: AbortSignal.timeout(5_000),
    });
    if (!listResp.ok) {
        throw new Error(
            `Fly Machines API list failed: ${listResp.status} ${await listResp.text().catch(() => "")}`,
        );
    }

    const machines = await listResp.json() as Array<{ id: string; state: string }>;
    const dormant = machines.find(
        (m) => m.state === "suspended" || m.state === "stopped",
    );

    if (!dormant) {
        // All machines are already running (or starting) -- nothing to do
        return;
    }

    console.log(`[deep-scan] Waking worker machine ${dormant.id} (was ${dormant.state})`);
    const startResp = await fetch(
        `${apiBase}/v1/apps/${workerApp}/machines/${dormant.id}/start`,
        { method: "POST", signal: AbortSignal.timeout(10_000) },
    );
    if (!startResp.ok) {
        throw new Error(
            `Fly Machines API start failed: ${startResp.status} ${await startResp.text().catch(() => "")}`,
        );
    }

    // Brief pause for the machine to become reachable on .internal DNS.
    // Suspended machines resume in ~200-500ms; stopped machines take ~2-3s.
    const waitMs = dormant.state === "suspended" ? 1_000 : 4_000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
}

/**
 * Send the scan job to the remote worker service via HTTP.
 *
 * The worker returns 202 immediately and runs the scan in the background,
 * POSTing results back to /internal/scan-results when done.
 */
async function dispatchToWorkerService(
    scanId: number,
    shopDomain: string,
    password: string,
    workerUrl: string,
): Promise<void> {
    // Build the callback URL from the main app's internal hostname.
    // In production on Fly, this uses .internal DNS over WireGuard.
    const callbackBase = process.env.CALLBACK_URL
        || "http://perceive-a11y-auditor.internal:3000";
    const callbackUrl = `${callbackBase}/internal/scan-results`;

    try {
        // Ensure at least one worker machine is running before dispatching.
        // Machines with min=0 suspend when idle and .internal DNS won't wake them.
        const workerApp = process.env.WORKER_APP_NAME || "perceive-a11y-worker";
        await ensureWorkerRunning(workerApp);

        const resp = await fetch(`${workerUrl}/scan`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.WORKER_SECRET}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ scanId, shopDomain, password, callbackUrl }),
            signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
        });

        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            throw new Error(`Worker responded ${resp.status}: ${text}`);
        }
    } catch (err) {
        console.error(`[deep-scan] Failed to dispatch scan ${scanId}:`, err);
        await prisma.scan.updateMany({
            where: { id: scanId, status: { not: "completed" } },
            data: { status: "failed" },
        });
        return;
    }

    // Guardian timeout: if the worker never calls back, mark the scan failed.
    // Uses setTimeout which survives beyond the request lifecycle in Node.
    // The unref() call ensures this timer does not prevent process exit.
    const timer = setTimeout(async () => {
        try {
            await prisma.scan.updateMany({
                where: {
                    id: scanId,
                    status: { in: ["deep-scan-pending", "deep-scan-running"] },
                },
                data: { status: "failed" },
            });
            console.error(`[deep-scan] Guardian timeout: scan ${scanId} marked failed`);
        } catch (e) {
            console.error("[deep-scan] Guardian timeout DB update failed:", e);
        }
    }, GUARDIAN_TIMEOUT_MS);
    timer.unref();
}

/**
 * Local development fallback: fork the deep-scan-worker.mjs child process
 * so developers do not need to run a separate worker service.
 */
async function forkLocalWorker(
    scanId: number,
    shopDomain: string,
    password: string,
): Promise<void> {
    // Dynamic imports so production builds do not bundle child_process or
    // resolve the worker path when using the remote worker service.
    const { fork } = await import("node:child_process");
    const { resolve } = await import("node:path");

    const workerPath = resolve(process.cwd(), "app/lib/deep-scan-worker.mjs");
    const dbPath = resolve(process.cwd(), "dev.db");

    const child = fork(workerPath, [
        scanId.toString(),
        shopDomain,
        password,
        dbPath,
    ], {
        detached: false,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
    });

    child.stdout?.on("data", (data: Buffer) => {
        process.stdout.write(data);
    });
    child.stderr?.on("data", (data: Buffer) => {
        process.stderr.write(data);
    });

    child.on("exit", async (code) => {
        if (code !== 0) {
            console.error(`[deep-scan] Worker exited with code ${code} for scan ${scanId}`);
            try {
                await prisma.scan.updateMany({
                    where: { id: scanId, status: { not: "completed" } },
                    data: { status: "failed" },
                });
            } catch (e) {
                console.error("[deep-scan] Failed to update scan status after crash:", e);
            }
        }
    });
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
 * Extracts tag:id:src:href from the HTML -- loose enough to catch real overlaps
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
