//! SC 2.5.3 Label in Name — the accessible name must contain the visible text.
//!
//! When a UI component has both visible text (inner text) and an `aria-label`,
//! the `aria-label` must contain the visible text so that speech-input users
//! can activate the component by speaking what they see.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Check that `aria-label` contains the visible text for interactive elements.
///
/// # Arguments
///
/// * `elements` - Extracted HTML elements from a single file
/// * `file_path` - Theme file path for source location
/// * `line_fn` - Closure to convert byte offset to line number
pub fn check(
    elements: &[HtmlElement],
    file_path: &str,
    line_fn: &dyn Fn(usize) -> usize,
) -> Vec<Finding> {
    let mut findings = Vec::new();

    for elem in elements {
        // Only check interactive elements that have both visible text and aria-label
        let is_interactive = matches!(elem.tag.as_str(), "a" | "button")
            || elem.attr("role").is_some_and(|r| {
                matches!(
                    r.split_whitespace().next().unwrap_or(""),
                    "button" | "link" | "tab" | "menuitem" | "option"
                )
            });

        if !is_interactive {
            continue;
        }

        let visible_text = elem.inner_text.trim();
        if visible_text.is_empty() {
            continue;
        }

        let Some(aria_label) = elem.attr("aria-label") else {
            continue;
        };

        let label_lower = aria_label.to_lowercase();
        let text_lower = visible_text.to_lowercase();

        if !label_lower.contains(&text_lower) {
            findings.push(Finding {
                criterion_id: "2.5.3".to_owned(),
                severity: Severity::Serious,
                element: format!("<{}>", elem.tag),
                file_path: file_path.to_owned(),
                line: line_fn(elem.byte_offset),
                message: format!(
                    "Accessible name \"{aria_label}\" does not contain the \
                     visible text \"{visible_text}\". Speech-input users cannot \
                     activate this element by speaking what they see."
                ),
                suggestion: format!(
                    "Change `aria-label` to include the visible text. \
                     For example: aria-label=\"{visible_text} - additional context\"."
                ),
            });
        }
    }

    findings
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

    #[test]
    fn flags_mismatched_label() {
        let elements = vec![el("button", &[("aria-label", "Find products")], "Search")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].criterion_id, "2.5.3");
    }

    #[test]
    fn allows_label_containing_text() {
        let elements = vec![el(
            "button",
            &[("aria-label", "Search products")],
            "Search",
        )];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn case_insensitive() {
        let elements = vec![el("button", &[("aria-label", "SEARCH")], "Search")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_without_aria_label() {
        let elements = vec![el("button", &[], "Submit")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_empty_visible_text() {
        let elements = vec![el("button", &[("aria-label", "Close")], "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn flags_link_with_mismatched_label() {
        let elements = vec![el(
            "a",
            &[("href", "/"), ("aria-label", "Navigate away")],
            "Home",
        )];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn link_label_contains_text() {
        let elements = vec![el(
            "a",
            &[("href", "/"), ("aria-label", "Home page")],
            "Home",
        )];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }
}
