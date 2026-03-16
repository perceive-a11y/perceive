//! # perceive-color
//!
//! WCAG contrast ratios, APCA scoring, OKLCH color space, and accessible
//! palette generation. Part of the [Perceive](https://github.com/perceive-a11y)
//! accessibility platform.
//!
//! ## Features
//!
//! - **`std`** (default) — enables `String`-based parsing (`FromStr`) and `to_hex()`
//! - **`serde`** — derives `Serialize`/`Deserialize` on [`Color`] and [`Oklch`]

#![cfg_attr(not(feature = "std"), no_std)]

pub mod apca;
mod color;
pub mod oklch;
pub mod palette;
#[cfg(feature = "std")]
pub mod parse;
pub mod wcag;

pub use color::{Color, linear_to_srgb, srgb_to_linear};
pub use oklch::Oklch;
#[cfg(feature = "std")]
pub use parse::ParseColorError;
