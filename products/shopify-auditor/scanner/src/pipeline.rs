//! Scan pipeline — orchestrates all WCAG checks over a theme.
//!
//! The pipeline takes a set of theme files, preprocesses them (strip Liquid,
//! parse HTML/CSS), runs all check modules, and aggregates findings.

use crate::checks;
use crate::css;
use crate::findings::{Finding, ScanResult};
use crate::html;
use crate::liquid;

/// A theme file with its path and contents.
#[derive(Debug, Clone)]
pub struct ThemeFile {
    /// Relative path within the theme, e.g. `"templates/index.liquid"`.
    pub path: String,
    /// Raw file contents.
    pub content: String,
}

/// Scan an entire Shopify theme for accessibility issues.
///
/// Processes each file according to its type:
/// - `.liquid` / `.html` files: strip Liquid, parse HTML, run element checks
/// - `.css` files: parse CSS, run style-based checks
/// - `.json` files: skipped (settings, not rendered HTML)
///
/// # Arguments
///
/// * `files` - Theme files to scan
///
/// # Returns
///
/// Aggregated scan results with all findings.
#[must_use]
pub fn scan_theme(files: &[ThemeFile]) -> ScanResult {
    let mut all_findings: Vec<Finding> = Vec::new();
    let mut files_scanned = 0;

    // First pass: extract CSS properties from all stylesheets
    let mut all_css_props = Vec::new();
    for file in files {
        if is_css_file(&file.path) {
            let props = css::extract_properties(&file.content);
            // Run CSS-based checks per file
            all_findings.extend(checks::contrast::check(&props, &file.path));
            all_findings.extend(checks::focus_visible::check(&props, &file.path));
            all_findings.extend(checks::target_size::check(&props, &file.path));
            all_css_props.extend(props);
            files_scanned += 1;
        }
    }

    // Second pass: process HTML/Liquid templates
    for file in files {
        if !is_template_file(&file.path) {
            continue;
        }

        files_scanned += 1;

        // Strip Liquid tags, preserving byte offsets for line mapping
        let cleaned = liquid::strip_liquid(&file.content);
        let source_for_lines = file.content.clone();
        let line_fn = |offset: usize| liquid::line_from_offset(&source_for_lines, offset);

        // Parse HTML elements
        let elements = match html::extract_elements(&cleaned) {
            Ok(els) => els,
            Err(e) => {
                log::warn!("Failed to parse HTML in {}: {e}", file.path);
                continue;
            }
        };

        // Run all HTML-based checks
        all_findings.extend(checks::alt_text::check(&elements, &file.path, &line_fn));
        all_findings.extend(checks::headings::check(&elements, &file.path, &line_fn));
        all_findings.extend(checks::form_labels::check(&elements, &file.path, &line_fn));
        all_findings.extend(checks::link_purpose::check(&elements, &file.path, &line_fn));
        all_findings.extend(checks::language::check(&elements, &file.path, &line_fn));
        all_findings.extend(checks::aria::check(&elements, &file.path, &line_fn));
    }

    // Sort findings by severity (most critical first), then by file path
    all_findings.sort_by(|a, b| {
        b.severity
            .cmp(&a.severity)
            .then_with(|| a.file_path.cmp(&b.file_path))
            .then_with(|| a.line.cmp(&b.line))
    });

    ScanResult {
        findings: all_findings,
        files_scanned,
    }
}

/// Check if a file path is a CSS stylesheet.
fn is_css_file(path: &str) -> bool {
    std::path::Path::new(path)
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("css"))
}

/// Check if a file path is an HTML or Liquid template.
fn is_template_file(path: &str) -> bool {
    let ext = std::path::Path::new(path).extension();
    ext.is_some_and(|e| e.eq_ignore_ascii_case("liquid") || e.eq_ignore_ascii_case("html"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scan_empty_theme() {
        let result = scan_theme(&[]);
        assert!(result.findings.is_empty());
        assert_eq!(result.files_scanned, 0);
    }

    #[test]
    fn scan_template_with_issues() {
        let files = vec![ThemeFile {
            path: "layout/theme.liquid".to_owned(),
            content: r#"
                <html>
                <head><title>Test</title></head>
                <body>
                    <img src="hero.jpg">
                    <h1>Welcome</h1>
                    <h3>Skipped h2</h3>
                    <a href="/page">Click here</a>
                </body>
                </html>
            "#
            .to_owned(),
        }];

        let result = scan_theme(&files);
        assert!(!result.findings.is_empty());
        assert_eq!(result.files_scanned, 1);

        // Should find: missing alt, missing lang, heading skip, generic link
        let criteria: Vec<&str> = result
            .findings
            .iter()
            .map(|f| f.criterion_id.as_str())
            .collect();
        assert!(criteria.contains(&"1.1.1"), "should flag missing alt");
        assert!(criteria.contains(&"3.1.1"), "should flag missing lang");
        assert!(criteria.contains(&"1.3.1"), "should flag heading skip");
        assert!(criteria.contains(&"2.4.4"), "should flag generic link text");
    }

    #[test]
    fn scan_css_with_contrast_issue() {
        let files = vec![ThemeFile {
            path: "assets/style.css".to_owned(),
            content: "body { color: #999999; background-color: #aaaaaa; }".to_owned(),
        }];

        let result = scan_theme(&files);
        assert!(
            result.findings.iter().any(|f| f.criterion_id == "1.4.3"),
            "should flag low contrast"
        );
    }

    #[test]
    fn scan_clean_template() {
        let files = vec![ThemeFile {
            path: "layout/theme.liquid".to_owned(),
            content: r#"
                <html lang="en">
                <head><title>Test</title></head>
                <body>
                    <img src="hero.jpg" alt="Hero banner">
                    <h1>Welcome</h1>
                    <h2>Products</h2>
                    <a href="/products">View our products</a>
                </body>
                </html>
            "#
            .to_owned(),
        }];

        let result = scan_theme(&files);
        // Should have no critical or serious findings
        let serious_count = result.count_at_severity(a11y_rules::Severity::Serious);
        assert_eq!(
            serious_count, 0,
            "clean template should have no serious findings, got: {:?}",
            result.findings
        );
    }

    #[test]
    fn skips_json_files() {
        let files = vec![ThemeFile {
            path: "config/settings_data.json".to_owned(),
            content: r#"{"current": "Default"}"#.to_owned(),
        }];

        let result = scan_theme(&files);
        assert_eq!(result.files_scanned, 0);
    }

    #[test]
    fn handles_liquid_in_html() {
        let files = vec![ThemeFile {
            path: "templates/product.liquid".to_owned(),
            content: r#"
                <html lang="{{ shop.locale }}">
                <body>
                    <h1>{{ product.title }}</h1>
                    <img src="{{ product.featured_image | img_url }}" alt="{{ product.title }}">
                </body>
                </html>
            "#
            .to_owned(),
        }];

        let result = scan_theme(&files);
        // After stripping Liquid, the img should have an alt attribute (with spaces)
        // and the html should have a lang attribute (with spaces)
        // The structural HTML should still be parseable
        assert_eq!(result.files_scanned, 1);
    }

    #[test]
    fn findings_sorted_by_severity() {
        let files = vec![ThemeFile {
            path: "layout/theme.liquid".to_owned(),
            content: r#"<html><body><img src="a.jpg"><a href="/">Click here</a></body></html>"#
                .to_owned(),
        }];

        let result = scan_theme(&files);
        // Critical findings should come before Moderate
        if result.findings.len() >= 2 {
            assert!(result.findings[0].severity >= result.findings[1].severity);
        }
    }
}
