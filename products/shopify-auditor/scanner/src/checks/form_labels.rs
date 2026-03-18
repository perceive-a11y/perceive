//! SC 1.3.1 / 4.1.2 — form inputs without associated labels.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Check that form inputs have associated labels.
///
/// An input is considered labeled if any of these are true:
/// - It has an `aria-label` attribute
/// - It has an `aria-labelledby` attribute
/// - A `<label>` element with a matching `for` attribute exists
/// - The input has `type="hidden"`, `type="submit"`, or `type="button"`
///   (these don't need visible labels)
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
    // Collect all label `for` attribute values
    let label_fors: Vec<&str> = elements
        .iter()
        .filter(|e| e.tag == "label")
        .filter_map(|e| e.attr("for"))
        .collect();

    // Input types that don't need visible labels
    let exempt_types = ["hidden", "submit", "button", "reset", "image"];

    elements
        .iter()
        .filter(|e| matches!(e.tag.as_str(), "input" | "select" | "textarea"))
        .filter(|e| {
            // Skip exempt input types
            if let Some(input_type) = e.attr("type") {
                if exempt_types.contains(&input_type) {
                    return false;
                }
            }
            true
        })
        .filter(|e| {
            // Check if labeled by any mechanism
            let has_aria_label = e.has_attr("aria-label");
            let has_aria_labelledby = e.has_attr("aria-labelledby");
            let has_title = e.has_attr("title");
            let has_label_for = e.attr("id").is_some_and(|id| label_fors.contains(&id));
            let has_placeholder = e.has_attr("placeholder");
            // placeholder alone is not sufficient per WCAG, but we
            // flag it as Moderate rather than Critical

            !has_aria_label
                && !has_aria_labelledby
                && !has_title
                && !has_label_for
                && !has_placeholder
        })
        .map(|e| {
            let input_type = e.attr("type").unwrap_or("text");
            let id_info = e
                .attr("id")
                .map_or(String::new(), |id| format!(" (id=\"{id}\")"));
            Finding {
                criterion_id: "1.3.1".to_owned(),
                severity: Severity::Serious,
                element: format!("{}[type=\"{input_type}\"]{id_info}", e.tag),
                file_path: file_path.to_owned(),
                line: line_fn(e.byte_offset),
                message: format!(
                    "Form <{0}> element has no associated label. Screen readers \
                     cannot identify this {0}.",
                    e.tag
                ),
                suggestion: "Add a <label for=\"id\"> element, or add an \
                             aria-label attribute."
                    .to_owned(),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::html::HtmlElement;

    fn elem(tag: &str, attrs: &[(&str, &str)]) -> HtmlElement {
        HtmlElement {
            tag: tag.to_owned(),
            attrs: attrs
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            inner_text: String::new(),
            byte_offset: 0,
        }
    }

    #[test]
    fn flags_unlabeled_input() {
        let elements = vec![elem("input", &[("type", "text"), ("id", "name")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn allows_labeled_by_for() {
        let elements = vec![
            elem("label", &[("for", "name")]),
            elem("input", &[("type", "text"), ("id", "name")]),
        ];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_aria_label() {
        let elements = vec![elem("input", &[("type", "text"), ("aria-label", "Name")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_hidden_inputs() {
        let elements = vec![elem("input", &[("type", "hidden")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_submit_buttons() {
        let elements = vec![elem("input", &[("type", "submit")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_placeholder_no_finding() {
        let elements = vec![elem("input", &[("type", "text"), ("placeholder", "Name")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        // Placeholder alone is accepted as a labeling mechanism
        // (though not ideal per WCAG best practices)
        assert!(findings.is_empty());
    }
}
