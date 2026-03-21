//! SC 2.4.2 Page Titled — every page must have a descriptive `<title>`.
//!
//! Only checked in layout files (files whose path starts with `layout/`)
//! since those are the full-page templates that contain `<head>`.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Check that a layout template contains a non-empty `<title>` element.
///
/// Skips files that contain Shopify's `content_for_header` system tag,
/// which always injects a `<title>` at runtime.
///
/// # Arguments
///
/// * `elements` - Extracted HTML elements from a single file
/// * `file_path` - Theme file path for source location
/// * `line_fn` - Closure to convert byte offset to line number
/// * `raw_source` - Original file source (before Liquid stripping)
pub fn check(
    elements: &[HtmlElement],
    file_path: &str,
    line_fn: &dyn Fn(usize) -> usize,
    raw_source: &str,
) -> Vec<Finding> {
    // Only check layout files
    if !file_path.starts_with("layout/") {
        return Vec::new();
    }

    // Shopify's {{ content_for_header }} always injects a <title> at runtime.
    // Skip the check if this system tag is present.
    if raw_source.contains("content_for_header") {
        return Vec::new();
    }

    let titles: Vec<&HtmlElement> = elements.iter().filter(|e| e.tag == "title").collect();

    if titles.is_empty() {
        // No <title> found at all — check if there's a <head> to confirm
        // this is a full page template
        let has_html = elements.iter().any(|e| e.tag == "html");
        if !has_html {
            return Vec::new(); // Not a full page template
        }

        return vec![Finding {
            criterion_id: "2.4.2".to_owned(),
            severity: Severity::Serious,
            element: "<head>".to_owned(),
            file_path: file_path.to_owned(),
            line: 0,
            message: "Page is missing a <title> element. Screen readers and \
                     search engines use the title to identify the page."
                .to_owned(),
            suggestion: "Add a <title> element inside <head>, e.g. \
                        <title>{{ page_title }} - {{ shop.name }}</title>."
                .to_owned(),
        }];
    }

    let mut findings = Vec::new();

    for title in &titles {
        let text = title.inner_text.trim();
        if text.is_empty() && title.inner_text.is_empty() {
            // Truly empty title
            findings.push(Finding {
                criterion_id: "2.4.2".to_owned(),
                severity: Severity::Serious,
                element: "<title>".to_owned(),
                file_path: file_path.to_owned(),
                line: line_fn(title.byte_offset),
                message: "Page <title> is empty. Screen readers announce the \
                         title when a page loads — an empty title provides no \
                         context."
                    .to_owned(),
                suggestion: "Add descriptive text to the <title> element, e.g. \
                            <title>{{ page_title }} - {{ shop.name }}</title>."
                    .to_owned(),
            });
        } else if text.is_empty() {
            // Whitespace-only = Liquid-stripped dynamic title (common pattern)
            // This is expected — {{ page_title }} provides text at runtime.
            // Don't flag it.
        }
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::html::HtmlElement;

    fn title_el(inner_text: &str) -> HtmlElement {
        HtmlElement {
            tag: "title".to_owned(),
            attrs: vec![],
            inner_text: inner_text.to_owned(),
            byte_offset: 0,
        }
    }

    fn html_el() -> HtmlElement {
        HtmlElement {
            tag: "html".to_owned(),
            attrs: vec![("lang".to_owned(), "en".to_owned())],
            inner_text: String::new(),
            byte_offset: 0,
        }
    }

    #[test]
    fn flags_missing_title_in_layout() {
        let elements = vec![html_el()];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1, "<html></html>");
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].criterion_id, "2.4.2");
    }

    #[test]
    fn flags_empty_title() {
        let elements = vec![html_el(), title_el("")];
        let findings = check(
            &elements,
            "layout/theme.liquid",
            &|_| 1,
            "<html><title></title></html>",
        );
        assert_eq!(findings.len(), 1);
        assert!(findings[0].message.contains("empty"));
    }

    #[test]
    fn allows_liquid_stripped_title() {
        let elements = vec![html_el(), title_el("                    ")];
        let findings = check(
            &elements,
            "layout/theme.liquid",
            &|_| 1,
            "<title>{{ page_title }}</title>",
        );
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_valid_title() {
        let elements = vec![html_el(), title_el("My Store - Products")];
        let findings = check(
            &elements,
            "layout/theme.liquid",
            &|_| 1,
            "<title>My Store</title>",
        );
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_content_for_header() {
        // Shopify's {{ content_for_header }} always injects a <title>
        let elements = vec![html_el()]; // No title element found
        let source = "<html><head>{{ content_for_header }}</head></html>";
        let findings = check(&elements, "layout/theme.liquid", &|_| 1, source);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_non_layout_files() {
        let elements = vec![html_el()];
        let findings = check(&elements, "sections/header.liquid", &|_| 1, "");
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_partial_without_html() {
        let elements: Vec<HtmlElement> = vec![];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1, "");
        assert!(findings.is_empty());
    }
}
