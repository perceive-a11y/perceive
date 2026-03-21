/**
 * Scanner integration — bridges the Rust native module with the Node.js app.
 *
 * The native module is built by napi-rs from products/shopify-auditor/native/
 * and exposes `scanTheme()` and `checkContrast()` functions.
 *
 * `scanTheme` is offloaded to a worker thread so the synchronous napi-rs call
 * does not block the Node.js event loop during concurrent requests.
 */

import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Worker } from "node:worker_threads";

const __dirname = dirname(fileURLToPath(import.meta.url));
const nativePath = resolve(__dirname, "../../../native/shopify-auditor.node");

let nativeModule: {
  scanTheme: (files: Array<{ filename: string; content: string }>) => ScanResult;
  checkContrast: (fgHex: string, bgHex: string) => number;
};

let usingRustEngine = false;

try {
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
 *
 * Offloads to a worker thread when the native Rust engine is available so the
 * synchronous napi-rs call does not block the Node.js event loop. Falls back
 * to main-thread execution for the stub.
 */
export async function scanTheme(files: ThemeFile[]): Promise<ScanResult> {
  console.log(
    `[scanner] Scanning ${files.length} files (engine: ${usingRustEngine ? "rust" : "stub"})`,
  );

  let result: ScanResult;

  if (usingRustEngine) {
    // Run the CPU-bound Rust scan in a worker thread to avoid blocking
    // the event loop during concurrent requests.
    result = await new Promise<ScanResult>((resolve, reject) => {
      const workerCode = `
        const { parentPort, workerData } = require("node:worker_threads");
        const native = require(workerData.nativePath);
        const result = native.scanTheme(workerData.files);
        parentPort.postMessage(result);
      `;
      const worker = new Worker(workerCode, {
        eval: true,
        workerData: { nativePath, files },
      });
      worker.on("message", resolve);
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) reject(new Error(`Scanner worker exited with code ${code}`));
      });
    });
  } else {
    result = nativeModule.scanTheme(files);
  }

  console.log(`[scanner] Found ${result.findings.length} findings`);
  return result;
}

/**
 * Check contrast ratio between two hex colors.
 */
export function checkContrast(fgHex: string, bgHex: string): number {
  return nativeModule.checkContrast(fgHex, bgHex);
}
