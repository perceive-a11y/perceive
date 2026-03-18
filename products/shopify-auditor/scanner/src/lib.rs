//! # shopify-auditor-scanner
//!
//! WCAG 2.2 static analysis engine for Shopify Liquid themes.
//!
//! This crate performs source-code-level accessibility checks on Shopify theme
//! files (Liquid templates, HTML, CSS) without requiring a headless browser.
//! It integrates with the `perceive-color` crate for contrast ratio calculations
//! and the `a11y-rules` crate for WCAG criterion metadata.
//!
//! ## Usage
//!
//! ```rust
//! use shopify_auditor_scanner::pipeline::{ThemeFile, scan_theme};
//!
//! let files = vec![
//!     ThemeFile {
//!         path: "layout/theme.liquid".to_owned(),
//!         content: "<html lang=\"en\"><body><h1>Hello</h1></body></html>".to_owned(),
//!     },
//! ];
//!
//! let result = scan_theme(&files);
//! println!("Found {} issues", result.findings.len());
//! ```
//!
//! ## Architecture
//!
//! 1. **Liquid preprocessor** (`liquid.rs`) — strips `{% %}` and `{{ }}` tags
//! 2. **HTML parser** (`html.rs`) — extracts elements via `lol_html`
//! 3. **CSS parser** (`css.rs`) — extracts color/layout properties via `lightningcss`
//! 4. **Check modules** (`checks/`) — one module per WCAG criterion
//! 5. **Pipeline** (`pipeline.rs`) — orchestrates all checks over a theme

pub mod checks;
pub mod css;
pub mod findings;
pub mod html;
pub mod liquid;
pub mod pipeline;
