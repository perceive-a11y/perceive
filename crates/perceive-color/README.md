# perceive-color

[![Crates.io](https://img.shields.io/crates/v/perceive-color)](https://crates.io/crates/perceive-color)
[![docs.rs](https://docs.rs/perceive-color/badge.svg)](https://docs.rs/perceive-color)
[![CI](https://github.com/perceive-a11y/perceive/actions/workflows/ci.yml/badge.svg)](https://github.com/perceive-a11y/perceive/actions)
[![License: MIT OR Apache-2.0](https://img.shields.io/crates/l/perceive-color)](LICENSE-MIT)

WCAG contrast ratios, APCA scoring, OKLCH color space, and accessible palette generation — in Rust.

Part of the [Perceive](https://github.com/perceive-a11y/perceive) accessibility platform.

## Features

- **WCAG 2.2** — relative luminance, contrast ratio, AA/AAA conformance checks
- **APCA-W3** — perceptual lightness contrast (WCAG 3.0 draft), font size recommendations
- **OKLCH** — perceptually uniform color space with hue-preserving interpolation and gamut mapping
- **Palette generation** — accessible tonal scales from a brand color with contrast matrix analysis
- **Color parsing** — hex, `rgb()`, `hsl()`, CSS named colors
- **`#![no_std]`** compatible core (enable `std` feature for string parsing)
- **WASM ready** — powers `@perceive/color` on npm via wasm-bindgen

## Quick Start

```rust
use perceive_color::{Color, wcag, apca};

// Parse colors
let fg = Color::from_hex("#1a1a2e").unwrap();
let bg = Color::from_hex("#eaeaea").unwrap();

// WCAG 2.2 contrast
let ratio = wcag::contrast_ratio(fg, bg);
assert!(wcag::meets_aa(fg, bg, false)); // normal text

// APCA (WCAG 3.0 draft)
let lc = apca::apca_contrast(fg, bg);
let font = apca::apca_font_lookup(lc).unwrap();
println!("Min font: {}px @ weight {}", font.min_size_px, font.min_weight);
```

### Accessible Palette Generation

```rust
use perceive_color::{Color, palette};

let brand = Color::from_hex("#3366cc").unwrap();
let scale = palette::generate_palette(brand, 10); // 10-step tonal scale

// Find pairs that meet AA contrast (4.5:1)
if let Some((i, j)) = palette::find_accessible_pair(&scale, 4.5) {
    println!("Use colors {} and {} together", i, j);
}

// Suggest an accessible foreground for a given background
let bg = Color::from_hex("#ffffff").unwrap();
let fg = Color::from_hex("#aaaaaa").unwrap(); // too light
if let Some(adjusted) = palette::suggest_foreground(fg, bg, 4.5) {
    println!("Adjusted: {}", adjusted.to_hex());
}
```

### OKLCH Color Space

```rust
use perceive_color::{Color, oklch};

let red = Color::from_hex("#ff0000").unwrap();
let blue = Color::from_hex("#0000ff").unwrap();

// Perceptually uniform interpolation
let mid = oklch::oklch_lerp(red.to_oklch(), blue.to_oklch(), 0.5);
let mid_color = Color::from_oklch(oklch::gamut_map(mid));
```

## Features Flags

| Feature | Default | Description |
|---------|---------|-------------|
| `std` | Yes | Enables `FromStr`, `to_hex()`, string-based parsing |
| `serde` | No | `Serialize`/`Deserialize` on `Color` and `Oklch` |

## Spec References

| Module | Specification |
|--------|--------------|
| `wcag` | [WCAG 2.2 §1.4.3, §1.4.6](https://www.w3.org/TR/WCAG22/) |
| `apca` | [APCA-W3 0.0.98G-4g](https://github.com/Myndex/SAPC-APCA) |
| `oklch` | [Björn Ottosson — Oklab](https://bottosson.github.io/posts/oklab/) |
| `color` | [IEC 61966-2-1 (sRGB)](https://www.color.org/chardata/rgb/sRGB.pdf) |
| `parse` | [CSS Color Level 4](https://www.w3.org/TR/css-color-4/) |

## License

Licensed under either of [Apache License, Version 2.0](../LICENSE-APACHE) or [MIT License](../LICENSE-MIT) at your option.
