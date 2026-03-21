//! SC 2.4.6 Headings and Labels — headings and labels must be descriptive.
//!
//! Flags headings that are empty, whitespace-only, or contain only generic
//! text that doesn't help users understand the content.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Generic heading text that provides no meaningful description.
const GENERIC_HEADINGS: &[&str] = &[
    "heading",
    "title",
    "untitled",
    "section",
    "content",
    "text",
    "placeholder",
    "header",
    "new section",
];

/// Check headings for empty or generic text content.
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
        let is_heading = elem.tag.len() == 2
            && elem.tag.starts_with('h')
            && elem.tag.as_bytes()[1].is_ascii_digit();

        if !is_heading {
            continue;
        }

        let text = elem.inner_text.trim();

        if text.is_empty() && elem.inner_text.is_empty() {
            // Truly empty (not Liquid-stripped whitespace)
            findings.push(Finding {
                criterion_id: "2.4.6".to_owned(),
                severity: Severity::Serious,
                element: format!("<{}>", elem.tag),
                file_path: file_path.to_owned(),
                line: line_fn(elem.byte_offset),
                message: format!(
                    "Heading <{}> has no text content. Empty headings confuse \
                     screen reader users navigating by heading.",
                    elem.tag
                ),
                suggestion: "Add descriptive text to the heading, or remove \
                             the empty heading element."
                    .to_owned(),
            });
        } else if text.is_empty() {
            // Whitespace-only after trim = Liquid-stripped dynamic content
            findings.push(Finding {
                criterion_id: "2.4.6".to_owned(),
                severity: Severity::Minor,
                element: format!("<{}>", elem.tag),
                file_path: file_path.to_owned(),
                line: line_fn(elem.byte_offset),
                message: format!(
                    "Heading <{tag}> text depends on a dynamic value. Ensure \
                     it always resolves to descriptive text.",
                    tag = elem.tag,
                ),
                suggestion: "Add a fallback value to ensure the heading \
                             is never empty at runtime."
                    .to_owned(),
            });
        } else if GENERIC_HEADINGS.contains(&text.to_lowercase().as_str()) {
            findings.push(Finding {
                criterion_id: "2.4.6".to_owned(),
                severity: Severity::Moderate,
                element: format!("<{}>", elem.tag),
                file_path: file_path.to_owned(),
                line: line_fn(elem.byte_offset),
                message: format!(
                    "Heading <{tag}> has generic text \"{text}\". Headings should \
                     describe the topic or purpose of the content section.",
                    tag = elem.tag,
                ),
                suggestion: "Replace with descriptive text that summarizes \
                             the content of the section."
                    .to_owned(),
            });
        }
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::html::HtmlElement;

    fn heading(tag: &str, text: &str) -> HtmlElement {
        HtmlElement {
            tag: tag.to_owned(),
            attrs: vec![],
            inner_text: text.to_owned(),
            byte_offset: 0,
        }
    }

    #[test]
    fn flags_empty_heading() {
        let elements = vec![heading("h2", "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].severity, Severity::Serious);
    }

    #[test]
    fn flags_whitespace_heading_as_minor() {
        // Whitespace = Liquid-stripped content, downgrade severity
        let elements = vec![heading("h2", "   ")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].severity, Severity::Minor);
    }

    #[test]
    fn flags_generic_heading() {
        let elements = vec![heading("h2", "Title")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].severity, Severity::Moderate);
    }

    #[test]
    fn allows_descriptive_heading() {
        let elements = vec![heading("h2", "Featured Products")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn case_insensitive_generic() {
        let elements = vec![heading("h1", "SECTION")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn skips_non_headings() {
        let elements = vec![HtmlElement {
            tag: "p".to_owned(),
            attrs: vec![],
            inner_text: String::new(),
            byte_offset: 0,
        }];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }
}
