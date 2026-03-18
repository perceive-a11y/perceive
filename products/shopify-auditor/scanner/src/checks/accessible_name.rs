//! SC 4.1.2 Name, Role, Value — interactive elements must have accessible names.
//!
//! Buttons, links, and elements with interactive ARIA roles need a text label
//! that assistive technologies can announce. This check catches empty
//! interactive elements that have no visible text or ARIA label.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// ARIA roles that require an accessible name.
const ROLES_NEEDING_NAME: &[&str] = &[
    "button",
    "link",
    "tab",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "treeitem",
    "option",
    "switch",
    "checkbox",
    "radio",
    "searchbox",
    "textbox",
    "combobox",
];

/// Check interactive elements for missing accessible names.
///
/// Flags:
/// - `<a>` with no text content, aria-label, or aria-labelledby
/// - `<button>` with no text content, aria-label, or aria-labelledby
/// - Elements with interactive `role` and no accessible name
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
        let needs_name = match elem.tag.as_str() {
            "a" => elem.has_attr("href"),    // Only links, not anchors
            "button" => true,
            _ => {
                // Check if the element has an interactive ARIA role
                elem.attr("role")
                    .is_some_and(|r| {
                        r.split_whitespace()
                            .any(|role| ROLES_NEEDING_NAME.contains(&role))
                    })
            }
        };

        if !needs_name {
            continue;
        }

        // Skip elements explicitly hidden from assistive technology
        if elem.attr("aria-hidden") == Some("true") {
            continue;
        }

        if has_accessible_name(elem) {
            continue;
        }

        let role_desc = if elem.tag == "a" {
            "Link"
        } else if elem.tag == "button" {
            "Button"
        } else {
            "Interactive element"
        };

        let role_info = elem
            .attr("role")
            .map(|r| format!(" (role=\"{r}\")"))
            .unwrap_or_default();

        findings.push(Finding {
            criterion_id: "4.1.2".to_owned(),
            severity: Severity::Critical,
            element: format!("<{}{role_info}>", elem.tag),
            file_path: file_path.to_owned(),
            line: line_fn(elem.byte_offset),
            message: format!(
                "{role_desc} has no accessible name. Screen readers cannot \
                 announce its purpose to users."
            ),
            suggestion: "Add visible text content, an `aria-label` attribute, \
                         or an `aria-labelledby` reference to provide an \
                         accessible name."
                .to_owned(),
        });
    }

    findings
}

/// Determine if an element has an accessible name through any mechanism.
fn has_accessible_name(elem: &HtmlElement) -> bool {
    // 1. aria-label (non-empty)
    if let Some(label) = elem.attr("aria-label") {
        if !label.trim().is_empty() {
            return true;
        }
    }

    // 2. aria-labelledby (references another element — we can't resolve
    //    the reference statically, but its presence indicates intent)
    if elem.has_attr("aria-labelledby") {
        return true;
    }

    // 3. title attribute (serves as fallback accessible name)
    if let Some(title) = elem.attr("title") {
        if !title.trim().is_empty() {
            return true;
        }
    }

    // 4. Inner text content (for buttons and links)
    if !elem.inner_text.trim().is_empty() {
        return true;
    }

    // 5. For <a>/<button>, check for nested img with alt text
    //    (we can't see nested elements in our flat extraction model,
    //    so check if aria-label/title covers it)

    // 6. Input elements with value attribute
    if elem.tag == "input" {
        if let Some(val) = elem.attr("value") {
            if !val.trim().is_empty() {
                return true;
            }
        }
    }

    false
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
    fn flags_empty_button() {
        let elements = vec![el("button", &[], "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].severity, Severity::Critical);
    }

    #[test]
    fn flags_empty_link() {
        let elements = vec![el("a", &[("href", "/page")], "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert!(findings[0].message.contains("Link"));
    }

    #[test]
    fn allows_button_with_text() {
        let elements = vec![el("button", &[], "Submit")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_button_with_aria_label() {
        let elements = vec![el("button", &[("aria-label", "Close dialog")], "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn allows_link_with_title() {
        let elements = vec![el("a", &[("href", "/"), ("title", "Home page")], "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn flags_empty_aria_role_button() {
        let elements = vec![el("div", &[("role", "button")], "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn allows_aria_role_with_label() {
        let elements = vec![el("div", &[("role", "button"), ("aria-label", "Menu")], "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_aria_hidden() {
        let elements = vec![el("button", &[("aria-hidden", "true")], "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn skips_anchor_without_href() {
        let elements = vec![el("a", &[("id", "top")], "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn flags_whitespace_only_text() {
        // After Liquid stripping, text might be all whitespace
        let elements = vec![el("button", &[], "         ")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    #[test]
    fn allows_aria_labelledby() {
        let elements = vec![el("button", &[("aria-labelledby", "label-id")], "")];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }
}
