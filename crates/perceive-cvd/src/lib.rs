//! # perceive-cvd
//!
//! Colorblind (color vision deficiency) simulation using the Brettel et al.
//! (1997) and Viénot et al. (1999) models. Part of the
//! [Perceive](https://github.com/perceive-a11y) accessibility platform.
//!
//! Uses [`perceive_color::Color`] for linear RGB representation.

#![cfg_attr(not(feature = "std"), no_std)]

pub mod brettel;
pub mod types;
pub mod vienot;

pub use brettel::simulate;
pub use types::{CvdType, Severity};
pub use vienot::simulate_fast;
