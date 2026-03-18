//! SC 4.1.2 Name, Role, Value — ARIA attribute validation.

use crate::findings::Finding;
use crate::html::HtmlElement;
use a11y_rules::Severity;

/// Valid ARIA roles per WAI-ARIA 1.2 spec.
const VALID_ROLES: &[&str] = &[
    "alert",
    "alertdialog",
    "application",
    "article",
    "banner",
    "button",
    "cell",
    "checkbox",
    "columnheader",
    "combobox",
    "complementary",
    "contentinfo",
    "definition",
    "dialog",
    "directory",
    "document",
    "feed",
    "figure",
    "form",
    "grid",
    "gridcell",
    "group",
    "heading",
    "img",
    "link",
    "list",
    "listbox",
    "listitem",
    "log",
    "main",
    "marquee",
    "math",
    "menu",
    "menubar",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "meter",
    "navigation",
    "none",
    "note",
    "option",
    "presentation",
    "progressbar",
    "radio",
    "radiogroup",
    "region",
    "row",
    "rowgroup",
    "rowheader",
    "scrollbar",
    "search",
    "searchbox",
    "separator",
    "slider",
    "spinbutton",
    "status",
    "switch",
    "tab",
    "table",
    "tablist",
    "tabpanel",
    "term",
    "textbox",
    "timer",
    "toolbar",
    "tooltip",
    "tree",
    "treegrid",
    "treeitem",
];

/// Valid global ARIA attributes (allowed on any element).
const VALID_ARIA_ATTRS: &[&str] = &[
    "aria-atomic",
    "aria-busy",
    "aria-controls",
    "aria-current",
    "aria-describedby",
    "aria-description",
    "aria-details",
    "aria-disabled",
    "aria-dropeffect",
    "aria-errormessage",
    "aria-flowto",
    "aria-grabbed",
    "aria-haspopup",
    "aria-hidden",
    "aria-invalid",
    "aria-keyshortcuts",
    "aria-label",
    "aria-labelledby",
    "aria-live",
    "aria-owns",
    "aria-relevant",
    "aria-roledescription",
    // Widget attributes
    "aria-autocomplete",
    "aria-checked",
    "aria-expanded",
    "aria-level",
    "aria-modal",
    "aria-multiline",
    "aria-multiselectable",
    "aria-orientation",
    "aria-placeholder",
    "aria-pressed",
    "aria-readonly",
    "aria-required",
    "aria-selected",
    "aria-sort",
    "aria-valuemax",
    "aria-valuemin",
    "aria-valuenow",
    "aria-valuetext",
    // Relationship attributes
    "aria-activedescendant",
    "aria-colcount",
    "aria-colindex",
    "aria-colspan",
    "aria-posinset",
    "aria-rowcount",
    "aria-rowindex",
    "aria-rowspan",
    "aria-setsize",
];

/// Check elements for invalid ARIA roles and attributes.
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
        // Check for invalid role values
        if let Some(role) = elem.attr("role") {
            // role can contain multiple space-separated values
            for r in role.split_whitespace() {
                if !VALID_ROLES.contains(&r) {
                    findings.push(Finding {
                        criterion_id: "4.1.2".to_owned(),
                        severity: Severity::Critical,
                        element: format!("<{} role=\"{r}\">", elem.tag),
                        file_path: file_path.to_owned(),
                        line: line_fn(elem.byte_offset),
                        message: format!(
                            "Invalid ARIA role \"{r}\" on <{tag}>. \
                             Assistive technologies will not recognize this role.",
                            tag = elem.tag
                        ),
                        suggestion: format!(
                            "Use a valid WAI-ARIA 1.2 role. \
                             Remove \"{r}\" or replace it with the correct role."
                        ),
                    });
                }
            }
        }

        // Check for invalid aria-* attributes
        for (attr_name, _) in elem.aria_attrs() {
            if !VALID_ARIA_ATTRS.contains(&attr_name) {
                findings.push(Finding {
                    criterion_id: "4.1.2".to_owned(),
                    severity: Severity::Serious,
                    element: format!("<{} {attr_name}>", elem.tag),
                    file_path: file_path.to_owned(),
                    line: line_fn(elem.byte_offset),
                    message: format!(
                        "Invalid ARIA attribute `{attr_name}` on <{tag}>.",
                        tag = elem.tag
                    ),
                    suggestion: format!(
                        "Remove `{attr_name}` or replace it with a valid \
                         WAI-ARIA 1.2 attribute."
                    ),
                });
            }
        }
    }

    findings
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
    fn valid_role() {
        let elements = vec![elem("div", &[("role", "navigation")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn invalid_role() {
        let elements = vec![elem("div", &[("role", "foobar")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert!(findings[0].message.contains("foobar"));
    }

    #[test]
    fn valid_aria_attr() {
        let elements = vec![elem("button", &[("aria-label", "Close")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn invalid_aria_attr() {
        let elements = vec![elem("div", &[("aria-bogus", "true")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert!(findings[0].message.contains("aria-bogus"));
    }

    #[test]
    fn multiple_roles_one_invalid() {
        let elements = vec![elem("div", &[("role", "button invalid")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }
}
