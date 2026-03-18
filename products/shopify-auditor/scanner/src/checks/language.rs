//! SC 3.1.1 Language of Page — missing `lang` attribute on `<html>`.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Check that the `<html>` element has a `lang` attribute.
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
    let html_elements: Vec<&HtmlElement> = elements.iter().filter(|e| e.tag == "html").collect();

    if html_elements.is_empty() {
        // No <html> tag found — likely a partial template (snippet),
        // which is expected in Shopify themes. Skip.
        return Vec::new();
    }

    html_elements
        .iter()
        .filter(|e| {
            match e.attr("lang") {
                // No lang attribute, or lang="" (explicitly empty)
                None | Some("") => true,
                // Whitespace-only = Liquid-stripped (e.g. {{ request.locale.iso_code }})
                // Expected to have a value at runtime — skip.
                Some(lang) if lang.trim().is_empty() => false,
                Some(_) => false, // Has a real value
            }
        })
        .map(|e| Finding {
            criterion_id: "3.1.1".to_owned(),
            severity: Severity::Serious,
            element: "<html>".to_owned(),
            file_path: file_path.to_owned(),
            line: line_fn(e.byte_offset),
            message: "The <html> element is missing a `lang` attribute. \
                     Screen readers cannot determine the page language."
                .to_owned(),
            suggestion: "Add a `lang` attribute to the <html> element, \
                        e.g. <html lang=\"en\">."
                .to_owned(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::html::HtmlElement;

    fn html_el(attrs: &[(&str, &str)]) -> HtmlElement {
        HtmlElement {
            tag: "html".to_owned(),
            attrs: attrs
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            inner_text: String::new(),
            byte_offset: 0,
        }
    }

    #[test]
    fn flags_missing_lang() {
        let elements = vec![html_el(&[])];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].criterion_id, "3.1.1");
    }

    #[test]
    fn flags_empty_lang() {
        let elements = vec![html_el(&[("lang", "")])];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn allows_liquid_stripped_lang() {
        // {{ request.locale.iso_code }} becomes whitespace after stripping —
        // expected to have a value at runtime.
        let elements = vec![html_el(&[("lang", "                         ")])];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_valid_lang() {
        let elements = vec![html_el(&[("lang", "en")])];
        let findings = check(&elements, "layout/theme.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_partial_templates() {
        let elements: Vec<HtmlElement> = vec![];
        let findings = check(&elements, "snippets/header.liquid", &|_| 1);
        assert!(findings.is_empty());
    }
}
