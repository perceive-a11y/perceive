//! SC 1.3.1 Info and Relationships — heading hierarchy checks.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Parse a heading level from a tag name like `"h1"` -> `1`.
fn heading_level(tag: &str) -> Option<u8> {
    if tag.len() == 2 && tag.starts_with('h') {
        tag.as_bytes()[1]
            .checked_sub(b'0')
            .filter(|&n| (1..=6).contains(&n))
    } else {
        None
    }
}

/// Check heading hierarchy for skipped levels (e.g. `<h1>` then `<h3>`).
///
/// WCAG 1.3.1 requires that heading structure conveys document outline.
/// Skipping levels (h1 -> h3) confuses screen reader navigation.
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
    let headings: Vec<(&HtmlElement, u8)> = elements
        .iter()
        .filter_map(|e| heading_level(&e.tag).map(|lvl| (e, lvl)))
        .collect();

    let mut findings = Vec::new();

    // Check for skipped heading levels
    for window in headings.windows(2) {
        let (_, prev_level) = window[0];
        let (elem, curr_level) = window[1];

        // Going deeper by more than 1 level is a skip
        // (going shallower is fine — closing sections)
        if curr_level > prev_level + 1 {
            findings.push(Finding {
                criterion_id: "1.3.1".to_owned(),
                severity: Severity::Serious,
                element: format!("<{}>", elem.tag),
                file_path: file_path.to_owned(),
                line: line_fn(elem.byte_offset),
                message: format!(
                    "Heading level skipped: <h{prev_level}> to <h{curr_level}>. \
                     Expected <h{}>.",
                    prev_level + 1
                ),
                suggestion: format!(
                    "Change this heading to <h{}> or add the missing intermediate \
                     heading levels.",
                    prev_level + 1
                ),
            });
        }
    }

    // Check if page starts with h1 — only for full-page templates,
    // not sections/snippets/blocks which are fragments included in a page
    let is_partial = file_path.starts_with("sections/")
        || file_path.starts_with("snippets/")
        || file_path.starts_with("blocks/");
    if !is_partial
        && let Some(&(elem, level)) = headings.first()
        && level != 1
    {
        findings.push(Finding {
            criterion_id: "1.3.1".to_owned(),
            severity: Severity::Moderate,
            element: format!("<{}>", elem.tag),
            file_path: file_path.to_owned(),
            line: line_fn(elem.byte_offset),
            message: format!(
                "First heading is <h{level}> instead of <h1>. \
                         The page should begin with an <h1> element."
            ),
            suggestion: "Make the first heading on the page an <h1>.".to_owned(),
        });
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::html::HtmlElement;

    fn heading(tag: &str) -> HtmlElement {
        HtmlElement {
            tag: tag.to_owned(),
            attrs: vec![],
            inner_text: "Heading".to_owned(),
            byte_offset: 0,
        }
    }

    #[test]
    fn correct_hierarchy() {
        let elements = vec![heading("h1"), heading("h2"), heading("h3")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skipped_level() {
        let elements = vec![heading("h1"), heading("h3")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert!(findings[0].message.contains("skipped"));
    }

    #[test]
    fn going_shallower_is_ok() {
        let elements = vec![heading("h1"), heading("h2"), heading("h3"), heading("h2")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn first_heading_not_h1() {
        let elements = vec![heading("h2")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert!(findings[0].message.contains("<h1>"));
    }

    #[test]
    fn no_headings() {
        let elements: Vec<HtmlElement> = vec![];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }
}
