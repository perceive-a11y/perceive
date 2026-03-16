/**
 * Node.js integration test for perceive WASM bindings.
 *
 * Run after `wasm-pack build bindings/wasm --target nodejs`:
 *   node tests/wasm_node_test.mjs
 */

import { createRequire } from "module";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const wasm = require(resolve(__dirname, "../bindings/wasm/pkg-node/perceive_wasm.js"));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function assertApprox(actual, expected, tolerance, message) {
  assert(
    Math.abs(actual - expected) < tolerance,
    `${message}: expected ~${expected}, got ${actual}`,
  );
}

// WCAG contrast ratio
const bwRatio = wasm.wcag_contrast("#000000", "#ffffff");
assertApprox(bwRatio, 21.0, 0.01, "black/white contrast ratio");

const sameRatio = wasm.wcag_contrast("#808080", "#808080");
assertApprox(sameRatio, 1.0, 0.01, "same color contrast ratio");

// WCAG AA check
assert(
  wasm.check_aa("#000000", "#ffffff", false) === true,
  "black on white meets AA",
);
assert(
  wasm.check_aa("#ffffff", "#ffffff", false) === false,
  "white on white fails AA",
);

// APCA contrast
const apcaLc = wasm.apca_contrast("#000000", "#ffffff");
assert(apcaLc > 100, `APCA black on white Lc > 100, got ${apcaLc}`);

const apcaReverse = wasm.apca_contrast("#ffffff", "#000000");
assert(
  apcaReverse < -100,
  `APCA white on black Lc < -100, got ${apcaReverse}`,
);

// CVD simulation
const simulated = wasm.simulate_cvd("#ff0000", "protan", 1.0);
assert(typeof simulated === "string", "simulate_cvd returns string");
assert(simulated.startsWith("#"), `simulated color is hex: ${simulated}`);
assert(simulated !== "#ff0000", "protan simulation changes red");

// Achromat should produce grayscale
const achromat = wasm.simulate_cvd("#ff0000", "achromat", 1.0);
// Grayscale hex has equal R, G, B pairs
const r = achromat.slice(1, 3);
const g = achromat.slice(3, 5);
const b = achromat.slice(5, 7);
assert(r === g && g === b, `achromat is grayscale: ${achromat}`);

// Palette generation
const palette = wasm.generate_palette("#3366cc", 10);
assert(palette.length === 10, `palette has 10 colors, got ${palette.length}`);
assert(
  palette.every((c) => c.startsWith("#") && c.length === 7),
  "all palette entries are valid hex",
);

// Error handling
try {
  wasm.wcag_contrast("notacolor", "#ffffff");
  assert(false, "invalid color should throw");
} catch {
  passed++;
}

try {
  wasm.simulate_cvd("#ff0000", "invalid", 1.0);
  assert(false, "invalid CVD type should throw");
} catch {
  passed++;
}

// Summary
console.log(`\nWASM integration tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
