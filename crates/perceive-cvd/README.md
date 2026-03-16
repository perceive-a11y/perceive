# perceive-cvd

[![Crates.io](https://img.shields.io/crates/v/perceive-cvd)](https://crates.io/crates/perceive-cvd)
[![docs.rs](https://docs.rs/perceive-cvd/badge.svg)](https://docs.rs/perceive-cvd)
[![CI](https://github.com/perceive-a11y/perceive/actions/workflows/ci.yml/badge.svg)](https://github.com/perceive-a11y/perceive/actions)
[![License: MIT OR Apache-2.0](https://img.shields.io/crates/l/perceive-cvd)](LICENSE-MIT)

Colorblind (color vision deficiency) simulation using Brettel and Viénot models — in Rust.

Part of the [Perceive](https://github.com/perceive-a11y/perceive) accessibility platform.

## Features

- **Brettel et al. (1997)** — accurate two-half-plane simulation with configurable severity
- **Viénot et al. (1999)** — fast single-matrix simulation for real-time use
- **All CVD types** — protanopia, deuteranopia, tritanopia, achromatopsia
- **Severity control** — simulate partial color vision deficiency (0.0–1.0)
- **`#![no_std]`** compatible
- **WASM ready** — powers CVD preview in `@perceive/color`

## Quick Start

```rust
use perceive_color::Color;
use perceive_cvd::{simulate, simulate_fast, CvdType, Severity};

let red = Color::from_hex("#ff0000").unwrap();

// Accurate simulation with severity
let protan_50 = simulate(red, CvdType::Protan, Severity::new(0.5));

// Full dichromacy (fast path)
let deutan_full = simulate_fast(red, CvdType::Deutan);

// Simulate all types for a color palette review
for cvd in [CvdType::Protan, CvdType::Deutan, CvdType::Tritan] {
    let sim = simulate(red, cvd, Severity::FULL);
    println!("{cvd:?}: {}", sim.to_hex());
}
```

## Models

| Model | Function | Accuracy | Speed | Severity |
|-------|----------|----------|-------|----------|
| Brettel 1997 | `simulate()` | High (two half-planes) | Normal | 0.0–1.0 |
| Viénot 1999 | `simulate_fast()` | Good (single matrix) | Fast | Full only |

## CVD Types

| Type | Affected Cones | Prevalence |
|------|---------------|------------|
| Protan | L-cones (red) | ~1.3% of males |
| Deutan | M-cones (green) | ~5.0% of males |
| Tritan | S-cones (blue) | ~0.01% |
| Achromat | All | ~0.003% |

## License

Licensed under either of [Apache License, Version 2.0](../LICENSE-APACHE) or [MIT License](../LICENSE-MIT) at your option.
