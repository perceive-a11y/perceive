//! SC 4.1.2 Name, Role, Value — ARIA attribute validation.
//!
//! Validates:
//! 1. ARIA roles against WAI-ARIA 1.2 spec
//! 2. ARIA attribute names (reject unknown aria-* attributes)
//! 3. ARIA attribute values (enum-like attributes have specific allowed values)
//! 4. Role-attribute coupling (some attributes are only valid on certain roles)

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

/// ARIA attributes that have a fixed set of allowed values (enumerations).
/// Each entry: (`attribute_name`, &[`allowed_values`]).
const ENUM_ATTRS: &[(&str, &[&str])] = &[
    ("aria-autocomplete", &["inline", "list", "both", "none"]),
    ("aria-checked", &["true", "false", "mixed", "undefined"]),
    ("aria-current", &["page", "step", "location", "date", "time", "true", "false"]),
    ("aria-disabled", &["true", "false"]),
    ("aria-expanded", &["true", "false", "undefined"]),
    ("aria-haspopup", &["true", "false", "menu", "listbox", "tree", "grid", "dialog"]),
    ("aria-hidden", &["true", "false"]),
    ("aria-invalid", &["true", "false", "grammar", "spelling"]),
    ("aria-live", &["off", "polite", "assertive"]),
    ("aria-modal", &["true", "false"]),
    ("aria-multiline", &["true", "false"]),
    ("aria-multiselectable", &["true", "false"]),
    ("aria-orientation", &["horizontal", "vertical", "undefined"]),
    ("aria-pressed", &["true", "false", "mixed", "undefined"]),
    ("aria-readonly", &["true", "false"]),
    ("aria-required", &["true", "false"]),
    ("aria-selected", &["true", "false", "undefined"]),
    ("aria-sort", &["ascending", "descending", "none", "other"]),
];

/// Widget attributes and the roles they're allowed on.
/// Attributes NOT in this map are global (allowed everywhere).
const ROLE_ATTR_COUPLING: &[(&str, &[&str])] = &[
    ("aria-checked", &[
        "checkbox", "menuitemcheckbox", "menuitemradio", "option", "radio", "switch",
    ]),
    ("aria-selected", &[
        "gridcell", "option", "row", "tab", "columnheader", "rowheader", "treeitem",
    ]),
    ("aria-pressed", &["button"]),
    ("aria-expanded", &[
        "button", "combobox", "link", "menuitem", "row", "tab", "treeitem",
        "application", "gridcell",
    ]),
    ("aria-level", &["heading", "listitem", "row", "tablist", "treeitem"]),
    ("aria-multiselectable", &["grid", "listbox", "tablist", "tree", "treegrid"]),
    ("aria-orientation", &[
        "scrollbar", "separator", "slider", "tablist", "toolbar",
        "listbox", "menu", "menubar", "radiogroup", "tree", "treegrid",
    ]),
    ("aria-sort", &["columnheader", "rowheader"]),
    ("aria-autocomplete", &["combobox", "searchbox", "textbox"]),
    ("aria-multiline", &["searchbox", "textbox"]),
    ("aria-placeholder", &["searchbox", "textbox"]),
    ("aria-readonly", &[
        "checkbox", "combobox", "grid", "gridcell", "listbox",
        "radiogroup", "searchbox", "slider", "spinbutton", "textbox",
        "treegrid",
    ]),
    ("aria-required", &[
        "checkbox", "combobox", "gridcell", "listbox", "radiogroup",
        "searchbox", "spinbutton", "textbox", "tree", "treegrid",
    ]),
    ("aria-activedescendant", &[
        "application", "combobox", "grid", "group", "listbox",
        "menu", "menubar", "radiogroup", "textbox", "tree", "treegrid",
    ]),
    ("aria-modal", &["dialog", "alertdialog"]),
    ("aria-valuemin", &["meter", "progressbar", "scrollbar", "separator", "slider", "spinbutton"]),
    ("aria-valuemax", &["meter", "progressbar", "scrollbar", "separator", "slider", "spinbutton"]),
    ("aria-valuenow", &["meter", "progressbar", "scrollbar", "separator", "slider", "spinbutton"]),
    ("aria-valuetext", &["meter", "progressbar", "scrollbar", "separator", "slider", "spinbutton"]),
];

/// Check elements for invalid ARIA roles, attributes, values, and coupling.
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
        let role = elem
            .attr("role")
            .and_then(|r| r.split_whitespace().next())
            .unwrap_or("");

        check_roles(elem, file_path, line_fn, &mut findings);
        check_aria_attrs(elem, role, file_path, line_fn, &mut findings);
    }

    findings
}

/// Validate ARIA role values on an element.
fn check_roles(
    elem: &HtmlElement,
    file_path: &str,
    line_fn: &dyn Fn(usize) -> usize,
    findings: &mut Vec<Finding>,
) {
    let Some(role_attr) = elem.attr("role") else {
        return;
    };

    for r in role_attr.split_whitespace() {
        if !r.is_empty() && !VALID_ROLES.contains(&r) {
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

/// Validate aria-* attribute names, values, and role coupling.
fn check_aria_attrs(
    elem: &HtmlElement,
    role: &str,
    file_path: &str,
    line_fn: &dyn Fn(usize) -> usize,
    findings: &mut Vec<Finding>,
) {
    for (attr_name, attr_value) in elem.aria_attrs() {
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
            continue;
        }

        // Enum value validation
        if let Some((_, allowed)) = ENUM_ATTRS.iter().find(|(name, _)| *name == attr_name) {
            let val = attr_value.trim();
            if !val.is_empty() && !allowed.contains(&val) {
                findings.push(Finding {
                    criterion_id: "4.1.2".to_owned(),
                    severity: Severity::Moderate,
                    element: format!("<{} {attr_name}=\"{val}\">", elem.tag),
                    file_path: file_path.to_owned(),
                    line: line_fn(elem.byte_offset),
                    message: format!(
                        "Invalid value \"{val}\" for `{attr_name}` on <{tag}>. \
                         Allowed values: {}.",
                        allowed.join(", "),
                        tag = elem.tag,
                    ),
                    suggestion: format!(
                        "Change `{attr_name}` to one of: {}.",
                        allowed.join(", "),
                    ),
                });
            }
        }

        // Role-attribute coupling
        if !role.is_empty() && VALID_ROLES.contains(&role) {
            if let Some((_, allowed_roles)) =
                ROLE_ATTR_COUPLING.iter().find(|(name, _)| *name == attr_name)
            {
                if !allowed_roles.contains(&role) {
                    findings.push(Finding {
                        criterion_id: "4.1.2".to_owned(),
                        severity: Severity::Serious,
                        element: format!("<{} role=\"{role}\" {attr_name}>", elem.tag),
                        file_path: file_path.to_owned(),
                        line: line_fn(elem.byte_offset),
                        message: format!(
                            "Attribute `{attr_name}` is not valid for \
                             role=\"{role}\" on <{tag}>. This attribute is \
                             only allowed on: {}.",
                            allowed_roles.join(", "),
                            tag = elem.tag,
                        ),
                        suggestion: format!(
                            "Remove `{attr_name}` or change the role to one \
                             that supports it: {}.",
                            allowed_roles.join(", "),
                        ),
                    });
                }
            }
        }
    }
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

    // --- Role validation ---

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
        assert_eq!(findings[0].severity, Severity::Critical);
        assert!(findings[0].message.contains("foobar"));
    }

    #[test]
    fn multiple_roles_one_invalid() {
        let elements = vec![elem("div", &[("role", "button invalid")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
    }

    // --- Attribute name validation ---

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

    // --- Enum value validation ---

    #[test]
    fn valid_aria_live_value() {
        let elements = vec![elem("div", &[("aria-live", "polite")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn invalid_aria_live_value() {
        let elements = vec![elem("div", &[("aria-live", "maybe")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].severity, Severity::Moderate);
        assert!(findings[0].message.contains("maybe"));
        assert!(findings[0].message.contains("off, polite, assertive"));
    }

    #[test]
    fn valid_aria_current_value() {
        let elements = vec![elem("a", &[("aria-current", "page")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn invalid_aria_current_value() {
        let elements = vec![elem("a", &[("aria-current", "yes")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert!(findings[0].message.contains("yes"));
    }

    #[test]
    fn valid_aria_sort_value() {
        let elements = vec![elem("th", &[("aria-sort", "ascending")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    // --- Role-attribute coupling ---

    #[test]
    fn valid_checked_on_checkbox() {
        let elements = vec![elem("div", &[("role", "checkbox"), ("aria-checked", "true")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn invalid_checked_on_paragraph() {
        let elements = vec![elem("div", &[("role", "heading"), ("aria-checked", "true")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].severity, Severity::Serious);
        assert!(findings[0].message.contains("not valid for role=\"heading\""));
    }

    #[test]
    fn valid_expanded_on_button() {
        let elements = vec![elem("button", &[("role", "button"), ("aria-expanded", "false")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn invalid_sort_on_button() {
        let elements = vec![elem("div", &[("role", "button"), ("aria-sort", "ascending")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        let coupling_findings: Vec<_> = findings
            .iter()
            .filter(|f| f.message.contains("not valid for role"))
            .collect();
        assert_eq!(coupling_findings.len(), 1);
    }

    #[test]
    fn coupling_only_checked_when_role_present() {
        // Without a role, coupling checks don't apply
        let elements = vec![elem("div", &[("aria-checked", "true")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn valid_modal_on_dialog() {
        let elements = vec![elem("div", &[("role", "dialog"), ("aria-modal", "true")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        assert!(findings.is_empty());
    }

    #[test]
    fn invalid_modal_on_button() {
        let elements = vec![elem("div", &[("role", "button"), ("aria-modal", "true")])];
        let findings = check(&elements, "test.liquid", &|_| 1);
        let coupling_findings: Vec<_> = findings
            .iter()
            .filter(|f| f.message.contains("not valid for role"))
            .collect();
        assert_eq!(coupling_findings.len(), 1);
    }
}
