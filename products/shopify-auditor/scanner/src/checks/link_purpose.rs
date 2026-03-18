//! SC 2.4.4 Link Purpose (In Context) — generic link text detection.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Generic link text patterns that fail SC 2.4.4.
///
/// These don't convey the purpose of the link out of context.
const GENERIC_TEXTS: &[&str] = &[
    "click here",
    "here",
    "read more",
    "more",
    "learn more",
    "link",
    "this",
    "go",
    "details",
    "continue",
];

/// Check links for generic, non-descriptive text.
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
    elements
        .iter()
        .filter(|e| e.tag == "a")
        .filter(|e| {
            // Skip links with aria-label (provides accessible name)
            if e.has_attr("aria-label") || e.has_attr("aria-labelledby") {
                return false;
            }

            let text = e.inner_text.trim().to_lowercase();
            if text.is_empty() {
                // Empty link text is also a problem, but we handle that
                // in aria.rs (name/role/value)
                return false;
            }

            GENERIC_TEXTS.contains(&text.as_str())
        })
        .map(|e| {
            let href = e.attr("href").unwrap_or("#");
            Finding {
                criterion_id: "2.4.4".to_owned(),
                severity: Severity::Moderate,
                element: format!("a[href=\"{href}\"]"),
                file_path: file_path.to_owned(),
                line: line_fn(e.byte_offset),
                message: format!(
                    "Link text \"{}\" is generic and does not describe the \
                     link destination.",
                    e.inner_text.trim()
                ),
                suggestion: "Replace generic link text with a description of \
                             where the link goes, e.g. 'View product details' \
                             instead of 'Click here'."
                    .to_owned(),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::html::HtmlElement;

    fn link(text: &str, attrs: &[(&str, &str)]) -> HtmlElement {
        HtmlElement {
            tag: "a".to_owned(),
            attrs: attrs
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            inner_text: text.to_owned(),
            byte_offset: 0,
        }
    }

    #[test]
    fn flags_click_here() {
        let elements = vec![link("Click here", &[("href", "/page")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn flags_read_more() {
        let elements = vec![link("Read more", &[("href", "/blog")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn allows_descriptive_text() {
        let elements = vec![link("View our product catalog", &[("href", "/products")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_aria_label_override() {
        let elements = vec![link(
            "Read more",
            &[
                ("href", "/blog"),
                ("aria-label", "Read more about our story"),
            ],
        )];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn case_insensitive() {
        let elements = vec![link("HERE", &[("href", "#")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }
}
