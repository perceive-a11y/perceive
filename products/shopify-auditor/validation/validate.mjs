/**
 * Cross-validate our scanner findings against axe-core on rendered pages.
 *
 * Runs Playwright + axe-core against the live dev store, then compares
 * the axe findings with our scanner's findings from the database.
 *
 * Usage: node validate.mjs [store-password]
 */

import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../web/dev.db");
const STORE_URL = "https://perceive-a11y-2.myshopify.com";
const PASSWORD = process.argv[2] || "gewflu";

// Map axe-core rule IDs to WCAG criterion IDs for comparison
const AXE_TO_WCAG = {
  "image-alt": "1.1.1",
  "input-image-alt": "1.1.1",
  "role-img-alt": "1.1.1",
  "svg-img-alt": "1.1.1",
  "area-alt": "1.1.1",
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
  "link-name": "4.1.2",
  "input-button-name": "4.1.2",
  "color-contrast": "1.4.3",
  "color-contrast-enhanced": "1.4.6",
  "document-title": "2.4.2",
  "html-has-lang": "3.1.1",
  "html-lang-valid": "3.1.1",
  "html-xml-lang-mismatch": "3.1.1",
  "valid-lang": "3.1.2",
  "bypass": "2.4.1",
  "heading-order": "1.3.1",
  "empty-heading": "2.4.6",
  "label": "1.3.1",
  "label-title-only": "3.3.2",
  "select-name": "1.3.1",
  "link-in-text-block": "1.4.1",
  "focus-order-semantics": "2.4.3",
  "tabindex": "2.4.3",
  "autocomplete-valid": "1.3.5",
  "target-size": "2.5.8",
  "link-name": "2.4.4",
};

// Pages to test on the store
const PAGES = [
  "/",
  "/collections/all",
  "/products",
  "/pages/contact",
  "/cart",
];

async function main() {
  console.log("=== Accessibility Validation: Scanner vs axe-core ===\n");

  // Load our scanner findings from the latest scan
  const db = new Database(DB_PATH, { readonly: true });
  const latestScan = db.prepare(`
    SELECT s.id, s.themeName, COUNT(f.id) as findingCount
    FROM Scan s LEFT JOIN Finding f ON f.scanId = s.id
    WHERE s.themeName = (SELECT name FROM (
      SELECT t.name FROM json_each('[' ||
        '"test-data"' ||
      ']') AS j, (SELECT 'test-data' as name) AS t
    ))
    GROUP BY s.id ORDER BY s.id DESC LIMIT 1
  `).get();

  // Get the active theme scan (most recent)
  const activeScan = db.prepare(`
    SELECT s.id, s.themeName, COUNT(f.id) as findingCount
    FROM Scan s LEFT JOIN Finding f ON f.scanId = s.id
    GROUP BY s.id ORDER BY s.id DESC LIMIT 1
  `).get();

  console.log(`Scanner: latest scan "${activeScan.themeName}" (${activeScan.findingCount} findings)\n`);

  const scannerFindings = db.prepare(`
    SELECT criterionId, severity, element, filePath, message
    FROM Finding WHERE scanId = ?
  `).all(activeScan.id);

  // Group scanner findings by criterion
  const scannerByCriterion = {};
  for (const f of scannerFindings) {
    if (!scannerByCriterion[f.criterionId]) {
      scannerByCriterion[f.criterionId] = [];
    }
    scannerByCriterion[f.criterionId].push(f);
  }

  // Launch browser and run axe-core
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Handle password protection
  console.log("Bypassing store password...");
  await page.goto(`${STORE_URL}/password`, { waitUntil: "domcontentloaded" });
  try {
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/password"), {
      timeout: 10000,
    });
    console.log("Password accepted.\n");
  } catch {
    console.log("No password form found or already authenticated.\n");
  }

  // Run axe-core on each page
  const allAxeResults = [];
  for (const path of PAGES) {
    const url = `${STORE_URL}${path}`;
    console.log(`Scanning ${url}...`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1000); // Let JS render

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag2aaa", "best-practice"])
        .analyze();

      console.log(
        `  axe: ${results.violations.length} violations, ` +
        `${results.passes.length} passes, ` +
        `${results.incomplete.length} incomplete`
      );

      for (const v of results.violations) {
        allAxeResults.push({
          page: path,
          ruleId: v.id,
          wcagId: AXE_TO_WCAG[v.id] || null,
          impact: v.impact,
          description: v.description,
          nodeCount: v.nodes.length,
          nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 120)),
        });
      }
    } catch (err) {
      console.log(`  SKIP (${err.message.slice(0, 80)})`);
    }
  }

  await browser.close();
  db.close();

  // Compare results
  console.log("\n" + "=".repeat(70));
  console.log("COMPARISON REPORT");
  console.log("=".repeat(70));

  // Group axe results by WCAG criterion
  const axeByCriterion = {};
  const axeUnmapped = [];
  for (const r of allAxeResults) {
    if (r.wcagId) {
      if (!axeByCriterion[r.wcagId]) {
        axeByCriterion[r.wcagId] = [];
      }
      axeByCriterion[r.wcagId].push(r);
    } else {
      axeUnmapped.push(r);
    }
  }

  // All criteria found by either tool
  const allCriteria = new Set([
    ...Object.keys(scannerByCriterion),
    ...Object.keys(axeByCriterion),
  ]);

  const agreement = [];
  const scannerOnly = [];
  const axeOnly = [];

  for (const id of [...allCriteria].sort()) {
    const inScanner = !!scannerByCriterion[id];
    const inAxe = !!axeByCriterion[id];

    if (inScanner && inAxe) {
      agreement.push(id);
    } else if (inScanner) {
      scannerOnly.push(id);
    } else {
      axeOnly.push(id);
    }
  }

  console.log(`\nAGREEMENT (both tools found issues): ${agreement.length}`);
  for (const id of agreement) {
    const sc = scannerByCriterion[id].length;
    const ax = axeByCriterion[id]
      .reduce((sum, r) => sum + r.nodeCount, 0);
    console.log(`  SC ${id}: scanner=${sc} findings, axe=${ax} nodes`);
  }

  console.log(`\nSCANNER ONLY (we flag, axe does not): ${scannerOnly.length}`);
  for (const id of scannerOnly) {
    const findings = scannerByCriterion[id];
    const sample = findings[0];
    console.log(
      `  SC ${id}: ${findings.length} findings ` +
      `(e.g. ${sample.severity} — ${sample.message.slice(0, 80)})`
    );
  }

  console.log(`\nAXE ONLY (axe flags, we do not): ${axeOnly.length}`);
  for (const id of axeOnly) {
    const results = axeByCriterion[id];
    for (const r of results) {
      console.log(
        `  SC ${id} [${r.ruleId}]: ${r.nodeCount} nodes on ${r.page} ` +
        `(${r.impact}) — ${r.description.slice(0, 80)}`
      );
    }
  }

  if (axeUnmapped.length > 0) {
    console.log(`\nAXE UNMAPPED RULES (no WCAG criterion mapping): ${axeUnmapped.length}`);
    for (const r of axeUnmapped) {
      console.log(
        `  [${r.ruleId}]: ${r.nodeCount} nodes on ${r.page} ` +
        `(${r.impact}) — ${r.description.slice(0, 80)}`
      );
    }
  }

  // Detailed axe violations for review
  console.log("\n" + "=".repeat(70));
  console.log("AXE-CORE DETAILED VIOLATIONS");
  console.log("=".repeat(70));
  for (const r of allAxeResults) {
    console.log(
      `\n[${r.ruleId}] SC ${r.wcagId || "?"} (${r.impact}) — ${r.page}`
    );
    console.log(`  ${r.description}`);
    for (const html of r.nodes) {
      console.log(`  > ${html}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log(`Scanner findings: ${scannerFindings.length} total across ${Object.keys(scannerByCriterion).length} criteria`);
  console.log(`Axe violations: ${allAxeResults.reduce((s, r) => s + r.nodeCount, 0)} nodes across ${Object.keys(axeByCriterion).length} criteria`);
  console.log(`Agreement: ${agreement.length} criteria`);
  console.log(`Scanner-only: ${scannerOnly.length} criteria (potential false positives to review)`);
  console.log(`Axe-only: ${axeOnly.length} criteria (gaps in our scanner)`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
