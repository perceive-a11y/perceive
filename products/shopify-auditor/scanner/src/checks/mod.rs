//! WCAG check modules — one per accessibility criterion.
//!
//! Each check function takes a [`ScanContext`] and returns a `Vec<Finding>`.
//! The [`pipeline`](crate::pipeline) module orchestrates running all checks.

pub mod accessible_name;
pub mod alt_text;
pub mod aria;
pub mod bypass_blocks;
pub mod contrast;
pub mod focus_visible;
pub mod form_labels;
pub mod heading_labels;
pub mod headings;
pub mod input_purpose;
pub mod label_in_name;
pub mod language;
pub mod link_purpose;
pub mod page_title;
pub mod target_size;
