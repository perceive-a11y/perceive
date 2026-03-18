/**
 * Scanner integration — bridges the Rust native module with the Node.js app.
 *
 * The native module is built by napi-rs from products/shopify-auditor/native/
 * and exposes `scanTheme()` and `checkContrast()` functions.
 */

import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let nativeModule: {
  scanTheme: (files: Array<{ filename: string; content: string }>) => ScanResult;
  checkContrast: (fgHex: string, bgHex: string) => number;
};

let usingRustEngine = false;

try {
  // Resolve the absolute path to the native module
  const nativePath = resolve(__dirname, "../../../native/shopify-auditor.node");
  const require = createRequire(import.meta.url);
  nativeModule = require(nativePath);
  usingRustEngine = true;
  console.log("[scanner] Rust native engine loaded successfully");
} catch (e) {
  console.warn(
    `[scanner] Native module not found, using stub. Error: ${e instanceof Error ? e.message : e}`
  );
  nativeModule = {
    scanTheme: () => ({
      findings: [],
      filesScanned: 0,
      criticalCount: 0,
      seriousCount: 0,
      moderateCount: 0,
      minorCount: 0,
    }),
    checkContrast: () => 0,
  };
}

export interface Finding {
  criterionId: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  element: string;
  filePath: string;
  line: number;
  message: string;
  suggestion: string;
  criterionName: string;
  howToFix: string;
}

export interface ScanResult {
  findings: Finding[];
  filesScanned: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
}

export interface ThemeFile {
  filename: string;
  content: string;
}

/**
 * Scan theme files for WCAG accessibility issues using the Rust engine.
 */
export function scanTheme(files: ThemeFile[]): ScanResult {
  console.log(`[scanner] Scanning ${files.length} files (engine: ${usingRustEngine ? "rust" : "stub"})`);
  const result = nativeModule.scanTheme(files);
  console.log(`[scanner] Found ${result.findings.length} findings`);
  return result;
}

/**
 * Check contrast ratio between two hex colors.
 */
export function checkContrast(fgHex: string, bgHex: string): number {
  return nativeModule.checkContrast(fgHex, bgHex);
}
