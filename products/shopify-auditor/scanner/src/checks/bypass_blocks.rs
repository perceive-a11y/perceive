//! SC 2.4.1 Bypass Blocks — a mechanism to skip repeated navigation content.
//!
//! Checks layout templates for a "skip to content" link or a `<main>` landmark.
//! Only checked in layout files since those contain the repeated header/nav.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Check that a layout template has a skip-to-content mechanism.
///
/// Looks for any of:
/// 1. An `<a>` element whose href starts with `#` and whose text or
///    aria-label suggests a skip link
/// 2. A `<main>` element (HTML5 landmark)
/// 3. An element with `role="main"`
///
/// # Arguments
///
/// * `elements` - Extracted HTML elements from a single file
/// * `file_path` - Theme file path for source location
/// * `_line_fn` - Closure to convert byte offset to line number
pub fn check(
    elements: &[HtmlElement],
    file_path: &str,
    _line_fn: &dyn Fn(usize) -> usize,
) -> Vec<Finding> {
    // Only check layout files — they contain the repeated header/navigation
    if !file_path.starts_with("layout/") {
        return Vec::new();
    }

    // Must be a full page template
    let has_html = elements.iter().any(|e| e.tag == "html");
    if !has_html {
        return Vec::new();
    }

    // Check for skip link: <a href="#..."> with skip-related text
    let has_skip_link = elements.iter().any(|e| {
        if e.tag != "a" {
            return false;
        }
        let href = e.attr("href").unwrap_or("");
        if !href.starts_with('#') || href.len() < 2 {
            return false;
        }
        // Check visible text or aria-label for skip-related wording
        let text = e.inner_text.to_lowercase();
        let label = e
            .attr("aria-label")
            .unwrap_or("")
            .to_lowercase();
        let combined = format!("{text} {label}");
        combined.contains("skip")
            || combined.contains("main content")
            || combined.contains("main-content")
            || combined.contains("jump to")
    });

    // Check for <main> landmark
    let has_main_landmark = elements
        .iter()
        .any(|e| e.tag == "main" || e.attr("role") == Some("main"));

    if has_skip_link || has_main_landmark {
        return Vec::new();
    }

    vec![Finding {
        criterion_id: "2.4.1".to_owned(),
        severity: Severity::Moderate,
        element: "<body>".to_owned(),
        file_path: file_path.to_owned(),
        line: 0,
        message: "No skip navigation mechanism found. Keyboard users must tab \
                 through all navigation links to reach the main content."
            .to_owned(),
        suggestion: "Add a 'Skip to main content' link as the first element \
                     in <body>: <a href=\"#main\" class=\"skip-link\">Skip to \
                     content</a>. Also wrap the primary content area in a \
                     <main> element."
            .to_owned(),
    }]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::html::HtmlElement;

    fn el(tag: &str, attrs: &[(&str, &str)], inner_text: &str) -> HtmlElement {
        HtmlElement {
            tag: tag.to_owned(),
            attrs: attrs
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            inner_text: inner_text.to_owned(),
            byte_offset: 0,
        }
    }

    fn html_el() -> HtmlElement {
        el("html", &[("lang", "en")], "")
    }

    #[test]
    fn flags_missing_skip_link() {
        let elements = vec![html_el(), el("a", &[("href", "/")], "Home")];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].criterion_id, "2.4.1");
    }

    #[test]
    fn allows_skip_link() {
        let elements = vec![
            html_el(),
            el("a", &[("href", "#main")], "Skip to main content"),
        ];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_skip_link_with_aria_label() {
        let elements = vec![
            html_el(),
            el(
                "a",
                &[("href", "#content"), ("aria-label", "Skip to main content")],
                "",
            ),
        ];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_main_landmark() {
        let elements = vec![html_el(), el("main", &[], "")];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_role_main() {
        let elements = vec![html_el(), el("div", &[("role", "main")], "")];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_non_layout() {
        let elements = vec![html_el()];
        let findings = check(&elements, "sections/header.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skip_link_needs_hash_href() {
        // Link without # href is not a skip link
        let elements = vec![
            html_el(),
            el("a", &[("href", "/main")], "Skip to main content"),
        ];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }
}
