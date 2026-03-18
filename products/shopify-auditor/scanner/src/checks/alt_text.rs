//! SC 1.1.1 Non-text Content — images missing `alt` attribute.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Check all `<img>` elements for missing or empty `alt` attributes.
///
/// # Arguments
///
/// * `elements` - Extracted HTML elements from a single file
/// * `file_path` - Theme file path for source location
/// * `line_fn` - Closure to convert byte offset to line number
///
/// # Returns
///
/// Findings for images that lack an `alt` attribute. Images with `alt=""`
/// are allowed (decorative), but images with no `alt` at all are flagged.
pub fn check(
    elements: &[HtmlElement],
    file_path: &str,
    line_fn: &dyn Fn(usize) -> usize,
) -> Vec<Finding> {
    elements
        .iter()
        .filter(|e| e.tag == "img")
        .filter(|e| !e.has_attr("alt"))
        // Skip images with role="presentation" or aria-hidden="true"
        // as these are explicitly decorative
        .filter(|e| e.attr("role") != Some("presentation") && e.attr("aria-hidden") != Some("true"))
        .map(|e| {
            let src = e.attr("src").unwrap_or("unknown");
            Finding {
                criterion_id: "1.1.1".to_owned(),
                severity: Severity::Critical,
                element: format!("img[src=\"{src}\"]"),
                file_path: file_path.to_owned(),
                line: line_fn(e.byte_offset),
                message: format!("Image is missing an `alt` attribute. Source: {src}"),
                suggestion: "Add alt=\"description\" to describe the image, \
                             or alt=\"\" if it is purely decorative."
                    .to_owned(),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::html::HtmlElement;

    fn img(attrs: &[(&str, &str)]) -> HtmlElement {
        HtmlElement {
            tag: "img".to_owned(),
            attrs: attrs
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            inner_text: String::new(),
            byte_offset: 0,
        }
    }

    #[test]
    fn flags_missing_alt() {
        let elements = vec![img(&[("src", "hero.jpg")])];
        let findings = check(&elements, "index.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].criterion_id, "1.1.1");
    }

    #[test]
    fn allows_empty_alt() {
        let elements = vec![img(&[("src", "decorative.png"), ("alt", "")])];
        let findings = check(&elements, "index.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_descriptive_alt() {
        let elements = vec![img(&[("src", "photo.jpg"), ("alt", "A sunset")])];
        let findings = check(&elements, "index.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_decorative_role() {
        let elements = vec![img(&[("src", "bg.jpg"), ("role", "presentation")])];
        let findings = check(&elements, "index.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_aria_hidden() {
        let elements = vec![img(&[("src", "bg.jpg"), ("aria-hidden", "true")])];
        let findings = check(&elements, "index.liquid", &|_| 1);
        assert!(findings.is_empty());
    }
}
