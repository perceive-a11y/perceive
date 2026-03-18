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
/// Findings for images that:
/// - Lack an `alt` attribute entirely (Critical)
/// - Have an `alt` attribute that is all whitespace after Liquid stripping,
///   indicating a dynamic value that may be empty at runtime (Moderate)
pub fn check(
    elements: &[HtmlElement],
    file_path: &str,
    line_fn: &dyn Fn(usize) -> usize,
) -> Vec<Finding> {
    let mut findings = Vec::new();

    for e in elements.iter().filter(|e| e.tag == "img") {
        // Skip images explicitly marked as decorative
        if e.attr("role") == Some("presentation") || e.attr("aria-hidden") == Some("true") {
            continue;
        }

        let src = e.attr("src").unwrap_or("unknown");

        match e.attr("alt") {
            None => {
                // No alt attribute at all — critical
                findings.push(Finding {
                    criterion_id: "1.1.1".to_owned(),
                    severity: Severity::Critical,
                    element: format!("img[src=\"{src}\"]"),
                    file_path: file_path.to_owned(),
                    line: line_fn(e.byte_offset),
                    message: format!("Image is missing an `alt` attribute. Source: {src}"),
                    suggestion: "Add alt=\"description\" to describe the image, \
                                 or alt=\"\" if it is purely decorative."
                        .to_owned(),
                });
            }
            Some(alt) if !alt.is_empty() && alt.trim().is_empty() => {
                // Alt attribute is all whitespace — this typically means a
                // Liquid expression like `{{ image.alt }}` was stripped,
                // leaving only spaces. The actual runtime value may be empty
                // if the merchant didn't fill in alt text.
                findings.push(Finding {
                    criterion_id: "1.1.1".to_owned(),
                    severity: Severity::Moderate,
                    element: format!("img[src=\"{src}\"]"),
                    file_path: file_path.to_owned(),
                    line: line_fn(e.byte_offset),
                    message: format!(
                        "Image alt text depends on a dynamic value that may be \
                         empty at runtime. Source: {src}"
                    ),
                    suggestion: "Ensure alt text is always populated. Consider \
                                 adding a fallback: alt=\"{{ image.alt | default: \
                                 'Product image' }}\"."
                        .to_owned(),
                });
            }
            _ => {
                // alt="" (decorative) or alt="some text" — OK
            }
        }
    }

    findings
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
        assert_eq!(findings[0].severity, Severity::Critical);
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

    #[test]
    fn flags_liquid_stripped_alt() {
        // After Liquid stripping, {{ image.alt }} becomes spaces
        let elements = vec![img(&[("src", "product.jpg"), ("alt", "              ")])];
        let findings = check(&elements, "templates/product.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].severity, Severity::Moderate);
        assert!(findings[0].message.contains("dynamic value"));
    }
}
