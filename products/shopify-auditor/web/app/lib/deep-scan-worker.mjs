/**
 * Deep scan worker — child process that runs Playwright + axe-core against
 * rendered storefront pages, then writes findings directly to SQLite.
 *
 * Launched by deep-scan.server.ts via child_process.fork().
 *
 * Arguments:
 *   process.argv[2] — scanId (integer)
 *   process.argv[3] — shop domain (e.g. "store.myshopify.com")
 *   process.argv[4] — store password (plaintext, decrypted by parent)
 *   process.argv[5] — absolute path to SQLite database file
 *
 * Writes findings with source="axe" and computes a composite score.
 * Exits with code 0 on success, 1 on failure.
 */

import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import Database from "better-sqlite3";

// ---- axe-core rule ID -> WCAG criterion mapping ----
// Duplicated from axe-wcag-map.ts to avoid TS compilation in the worker.
const AXE_TO_WCAG = {
    "image-alt": "1.1.1",
    "input-image-alt": "1.1.1",
    "role-img-alt": "1.1.1",
    "svg-img-alt": "1.1.1",
    "area-alt": "1.1.1",
    "heading-order": "1.3.1",
    "label": "1.3.1",
    "select-name": "1.3.1",
    "autocomplete-valid": "1.3.5",
    "link-in-text-block": "1.4.1",
    "color-contrast": "1.4.3",
    "color-contrast-enhanced": "1.4.6",
    "bypass": "2.4.1",
    "document-title": "2.4.2",
    "focus-order-semantics": "2.4.3",
    "tabindex": "2.4.3",
    "link-name": "2.4.4",
    "empty-heading": "2.4.6",
    "target-size": "2.5.8",
    "html-has-lang": "3.1.1",
    "html-lang-valid": "3.1.1",
    "html-xml-lang-mismatch": "3.1.1",
    "valid-lang": "3.1.2",
    "label-title-only": "3.3.2",
    "aria-allowed-attr": "4.1.2",
    "aria-allowed-role": "4.1.2",
    "aria-hidden-body": "4.1.2",
    "aria-required-attr": "4.1.2",
    "aria-required-children": "4.1.2",
    "aria-required-parent": "4.1.2",
    "aria-roles": "4.1.2",
    "aria-valid-attr-value": "4.1.2",
    "aria-valid-attr": "4.1.2",
    "button-name": "4.1.2",
    "input-button-name": "4.1.2",
};

/** Pages to scan on the storefront. */
const PAGES = [
    "/",
    "/collections/all",
    "/products",
    "/pages/contact",
    "/cart",
    "/pages/about",
    "/search",
    "/account/login",
];

/** Per-page navigation timeout in ms. */
const PAGE_TIMEOUT = 15000;

/**
 * Extract a deduplication key from an element HTML string.
 *
 * Normalizes to "tag:id:src:href" so we can detect when static and runtime
 * scanners flag the same element without requiring exact string matches.
 */
function dedupeKey(criterionId, elementHtml) {
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

async function main() {
    const scanId = parseInt(process.argv[2], 10);
    const shopDomain = process.argv[3];
    const password = process.argv[4];
    const dbPath = process.argv[5];

    if (!scanId || !shopDomain || !dbPath) {
        console.error("Usage: node deep-scan-worker.mjs <scanId> <shop> <password> <dbPath>");
        process.exit(1);
    }

    const storeUrl = `https://${shopDomain}`;
    const db = new Database(dbPath);

    // Enable WAL mode to prevent write contention with Prisma
    db.pragma("journal_mode = WAL");

    const log = (msg) => console.log(`[deep-scan-worker ${scanId}] ${msg}`);

    try {
        // Update scan status
        db.prepare("UPDATE Scan SET status = ? WHERE id = ?")
            .run("deep-scan-running", scanId);

        log(`Starting runtime scan of ${storeUrl}`);

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        // Handle store password protection
        if (password) {
            log("Bypassing store password...");
            try {
                await page.goto(`${storeUrl}/password`, {
                    waitUntil: "domcontentloaded",
                    timeout: PAGE_TIMEOUT,
                });
                await page.fill('input[type="password"]', password);
                await page.click('button[type="submit"]');
                await page.waitForURL((url) => !url.pathname.includes("/password"), {
                    timeout: 10000,
                });
                log("Password accepted.");
            } catch {
                log("No password form found or already authenticated.");
            }
        }

        // Prepare insert statement
        const insertFinding = db.prepare(`
            INSERT INTO Finding (scanId, criterionId, severity, element, filePath, line, message, suggestion, source, pageUrl)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'axe', ?)
        `);

        let totalFindings = 0;

        // Scan each page
        for (const path of PAGES) {
            const url = `${storeUrl}${path}`;
            log(`Scanning ${url}...`);

            try {
                await page.goto(url, {
                    waitUntil: "domcontentloaded",
                    timeout: PAGE_TIMEOUT,
                });
                // Wait for network to settle instead of a fixed delay
                await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

                const results = await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "best-practice"])
                    .analyze();

                for (const violation of results.violations) {
                    const criterionId = AXE_TO_WCAG[violation.id];
                    if (!criterionId) continue; // Skip unmapped rules

                    const severity = violation.impact || "minor";

                    for (const node of violation.nodes) {
                        // Truncate element HTML to prevent huge DB entries
                        const element = node.html.slice(0, 500);

                        insertFinding.run(
                            scanId,
                            criterionId,
                            severity,
                            element,
                            "", // filePath — not applicable for runtime findings
                            violation.description,
                            node.failureSummary || "",
                            path,
                        );
                        totalFindings++;
                    }
                }

                log(`  ${results.violations.length} violations found`);
            } catch (err) {
                log(`  SKIP ${path} (${err.message.slice(0, 80)})`);
            }
        }

        await browser.close();
        log(`Runtime scan complete: ${totalFindings} findings`);

        // Compute composite score after deduplication
        const allFindings = db.prepare(`
            SELECT criterionId, severity, element, source FROM Finding WHERE scanId = ?
        `).all(scanId);

        // Deduplicate by dedupeKey — count each unique issue once at its worst severity
        const deduped = new Map();
        for (const f of allFindings) {
            const key = dedupeKey(f.criterionId, f.element);
            const existing = deduped.get(key);
            const rank = { critical: 0, serious: 1, moderate: 2, minor: 3 };
            if (!existing || (rank[f.severity] ?? 3) < (rank[existing.severity] ?? 3)) {
                deduped.set(key, f);
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

        const score = Math.max(
            0,
            100 - criticalCount * 15 - seriousCount * 8 - moderateCount * 3 - minorCount * 1,
        );

        // Finalize scan
        db.prepare(`
            UPDATE Scan SET status = ?, score = ?, completedAt = datetime('now') WHERE id = ?
        `).run("completed", score, scanId);

        log(`Score: ${score}/100 (${deduped.size} unique issues)`);
    } catch (err) {
        console.error(`[deep-scan-worker ${scanId}] Fatal:`, err);
        db.prepare("UPDATE Scan SET status = ? WHERE id = ?")
            .run("failed", scanId);
        process.exit(1);
    } finally {
        db.close();
    }
}

main().catch((err) => {
    console.error("[deep-scan-worker] Unhandled:", err);
    process.exit(1);
});
