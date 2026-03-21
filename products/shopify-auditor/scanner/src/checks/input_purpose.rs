//! SC 1.3.5 Identify Input Purpose — personal data inputs must have
//! `autocomplete` attributes from the WHATWG autofill spec.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Input types that collect personal information and should have autocomplete.
const PERSONAL_INPUT_TYPES: &[&str] = &["text", "email", "tel", "url", "password", "search"];

/// Valid autocomplete tokens per the WHATWG autofill spec (section + field).
/// See: <https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill>
const VALID_AUTOCOMPLETE: &[&str] = &[
    // Contact fields
    "name",
    "honorific-prefix",
    "given-name",
    "additional-name",
    "family-name",
    "honorific-suffix",
    "nickname",
    "username",
    "new-password",
    "current-password",
    "one-time-code",
    "organization-title",
    "organization",
    "street-address",
    "address-line1",
    "address-line2",
    "address-line3",
    "address-level4",
    "address-level3",
    "address-level2",
    "address-level1",
    "country",
    "country-name",
    "postal-code",
    "cc-name",
    "cc-given-name",
    "cc-additional-name",
    "cc-family-name",
    "cc-number",
    "cc-exp",
    "cc-exp-month",
    "cc-exp-year",
    "cc-csc",
    "cc-type",
    "transaction-currency",
    "transaction-amount",
    "language",
    "bday",
    "bday-day",
    "bday-month",
    "bday-year",
    "sex",
    "url",
    "photo",
    // Communication
    "tel",
    "tel-country-code",
    "tel-national",
    "tel-area-code",
    "tel-local",
    "tel-local-prefix",
    "tel-local-suffix",
    "tel-extension",
    "email",
    "impp",
    // Special values
    "on",
    "off",
];

/// Heuristic: input names/IDs that suggest personal data collection.
/// If an input's name or id matches these patterns AND it lacks
/// `autocomplete`, it likely needs one.
const PERSONAL_NAME_PATTERNS: &[&str] = &[
    "name",
    "first_name",
    "first-name",
    "firstname",
    "last_name",
    "last-name",
    "lastname",
    "email",
    "e-mail",
    "phone",
    "tel",
    "telephone",
    "address",
    "street",
    "city",
    "state",
    "zip",
    "postal",
    "country",
    "password",
    "username",
    "login",
    "credit-card",
    "cc-number",
];

/// Check form inputs for missing `autocomplete` attributes on personal data fields.
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

    for elem in elements.iter().filter(|e| e.tag == "input") {
        let input_type = elem.attr("type").unwrap_or("text");

        // Only check input types that might collect personal data
        if !PERSONAL_INPUT_TYPES.contains(&input_type) {
            continue;
        }

        // Skip hidden inputs
        if input_type == "hidden" {
            continue;
        }

        let autocomplete = elem.attr("autocomplete").map(str::trim);

        match autocomplete {
            Some(val) if !val.is_empty() => {
                // Has autocomplete — validate the token(s)
                // Autocomplete can have section + hint + field, e.g.
                // "section-blue shipping street-address"
                // We validate only the last token (the field name).
                let last_token = val.split_whitespace().last().unwrap_or("");
                if !VALID_AUTOCOMPLETE.contains(&last_token) && last_token != "off" {
                    findings.push(Finding {
                        criterion_id: "1.3.5".to_owned(),
                        severity: Severity::Moderate,
                        element: format_input_element(elem, input_type),
                        file_path: file_path.to_owned(),
                        line: line_fn(elem.byte_offset),
                        message: format!(
                            "Input has autocomplete=\"{val}\" which contains \
                             an unrecognized token \"{last_token}\"."
                        ),
                        suggestion: "Use a valid autocomplete value from the \
                                     WHATWG autofill spec, e.g. \"name\", \
                                     \"email\", \"tel\", \"street-address\"."
                            .to_owned(),
                    });
                }
            }
            _ => {
                // Missing or empty autocomplete — check if the input name
                // suggests personal data
                if looks_like_personal_input(elem) {
                    findings.push(Finding {
                        criterion_id: "1.3.5".to_owned(),
                        severity: Severity::Moderate,
                        element: format_input_element(elem, input_type),
                        file_path: file_path.to_owned(),
                        line: line_fn(elem.byte_offset),
                        message: format!(
                            "Input appears to collect personal data (type=\"{input_type}\") \
                             but has no `autocomplete` attribute."
                        ),
                        suggestion: "Add an `autocomplete` attribute to help browsers \
                                     and assistive technologies identify the input \
                                     purpose, e.g. autocomplete=\"email\"."
                            .to_owned(),
                    });
                }
            }
        }
    }

    findings
}

/// Check if an input element's name/id suggests it collects personal data.
fn looks_like_personal_input(elem: &HtmlElement) -> bool {
    // email and password types are inherently personal
    let input_type = elem.attr("type").unwrap_or("text");
    if input_type == "email" || input_type == "password" || input_type == "tel" {
        return true;
    }

    // Check name and id attributes against personal data patterns
    let name = elem.attr("name").unwrap_or("").to_lowercase();
    let id = elem.attr("id").unwrap_or("").to_lowercase();

    PERSONAL_NAME_PATTERNS
        .iter()
        .any(|pattern| name.contains(pattern) || id.contains(pattern))
}

/// Format a human-readable selector for the input element.
fn format_input_element(elem: &HtmlElement, input_type: &str) -> String {
    if let Some(name) = elem.attr("name") {
        format!("input[type=\"{input_type}\"][name=\"{name}\"]")
    } else if let Some(id) = elem.attr("id") {
        format!("input[type=\"{input_type}\"]#{id}")
    } else {
        format!("input[type=\"{input_type}\"]")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::html::HtmlElement;

    fn input(attrs: &[(&str, &str)]) -> HtmlElement {
        HtmlElement {
            tag: "input".to_owned(),
            attrs: attrs
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            inner_text: String::new(),
            byte_offset: 0,
        }
    }

    #[test]
    fn flags_email_without_autocomplete() {
        let elements = vec![input(&[("type", "email"), ("name", "email")])];
        let findings = check(&elements, "sections/contact.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].criterion_id, "1.3.5");
    }

    #[test]
    fn flags_password_without_autocomplete() {
        let elements = vec![input(&[("type", "password"), ("name", "pwd")])];
        let findings = check(&elements, "templates/login.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn flags_name_input_without_autocomplete() {
        let elements = vec![input(&[("type", "text"), ("name", "first_name")])];
        let findings = check(&elements, "sections/form.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn allows_email_with_autocomplete() {
        let elements = vec![input(&[
            ("type", "email"),
            ("name", "email"),
            ("autocomplete", "email"),
        ])];
        let findings = check(&elements, "sections/contact.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_autocomplete_off() {
        let elements = vec![input(&[
            ("type", "text"),
            ("name", "search"),
            ("autocomplete", "off"),
        ])];
        let findings = check(&elements, "sections/search.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn flags_invalid_autocomplete_token() {
        let elements = vec![input(&[
            ("type", "text"),
            ("name", "name"),
            ("autocomplete", "fullname"),
        ])];
        let findings = check(&elements, "sections/form.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert!(findings[0].message.contains("unrecognized"));
    }

    #[test]
    fn allows_compound_autocomplete() {
        let elements = vec![input(&[
            ("type", "text"),
            ("name", "addr"),
            ("autocomplete", "shipping street-address"),
        ])];
        let findings = check(&elements, "sections/form.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_non_personal_text_input() {
        // A text input with name "quantity" — not personal data
        let elements = vec![input(&[("type", "text"), ("name", "quantity")])];
        let findings = check(&elements, "sections/product.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_checkbox() {
        let elements = vec![input(&[("type", "checkbox"), ("name", "agree")])];
        let findings = check(&elements, "sections/form.liquid", &|_| 1);
        assert!(findings.is_empty());
    }
}
