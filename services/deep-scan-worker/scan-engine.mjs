/**
 * Deep scan engine -- runs Playwright + axe-core against rendered storefront
 * pages and returns findings as an in-memory array.
 *
 * Adapted from web/app/lib/deep-scan-worker.mjs with all SQLite code removed.
 * This module is consumed by server.mjs in the worker service.
 */

import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

// ---- axe-core rule ID -> WCAG criterion mapping ----
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
 * Run a deep accessibility scan against a Shopify storefront.
 *
 * @param {object} opts
 * @param {string} opts.shopDomain - e.g. "store.myshopify.com"
 * @param {string} opts.password  - plaintext store password, or empty string
 * @param {AbortSignal} [opts.signal] - abort signal for timeout cancellation
 * @returns {Promise<Array<{criterionId: string, severity: string, element: string, filePath: string, line: number, message: string, suggestion: string, source: string, pageUrl: string}>>}
 */
export async function runScan({ shopDomain, password, signal }) {
    const storeUrl = `https://${shopDomain}`;
    const log = (msg) => console.log(`[scan-engine ${shopDomain}] ${msg}`);

    log(`Starting runtime scan of ${storeUrl}`);

    const browser = await chromium.launch({ headless: true });

    // If aborted, kill the browser immediately
    const onAbort = () => {
        log("Abort signal received, closing browser");
        browser.close().catch(() => {});
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
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

        const findings = [];

        for (const path of PAGES) {
            if (signal?.aborted) break;

            const url = `${storeUrl}${path}`;
            log(`Scanning ${url}...`);

            try {
                await page.goto(url, {
                    waitUntil: "domcontentloaded",
                    timeout: PAGE_TIMEOUT,
                });
                await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

                const results = await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "best-practice"])
                    .analyze();

                for (const violation of results.violations) {
                    const criterionId = AXE_TO_WCAG[violation.id];
                    if (!criterionId) continue;

                    const severity = violation.impact || "minor";

                    for (const node of violation.nodes) {
                        findings.push({
                            criterionId,
                            severity,
                            element: node.html.slice(0, 500),
                            filePath: "",
                            line: 0,
                            message: violation.description,
                            suggestion: node.failureSummary || "",
                            source: "axe",
                            pageUrl: path,
                        });
                    }
                }

                log(`  ${results.violations.length} violations found`);
            } catch (err) {
                log(`  SKIP ${path} (${err.message.slice(0, 80)})`);
            }
        }

        log(`Runtime scan complete: ${findings.length} findings`);
        return findings;
    } finally {
        signal?.removeEventListener("abort", onAbort);
        await browser.close().catch(() => {});
    }
}
