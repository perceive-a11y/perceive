//! SC 2.4.7 Focus Visible — detecting suppressed focus indicators.

use crate::css::SelectorProperties;
use crate::findings::Finding;
use a11y_rules::Severity;

/// Check CSS rules for suppressed focus indicators.
///
/// Flags `:focus` rules that set `outline: none` or `outline: 0` without
/// providing a replacement focus style (e.g. `box-shadow`, `border`).
///
/// # Arguments
///
/// * `css_props` - Extracted CSS selector properties
/// * `file_path` - CSS file path for source location
#[must_use]
pub fn check(css_props: &[SelectorProperties], file_path: &str) -> Vec<Finding> {
    css_props
        .iter()
        .filter(|p| p.is_focus_rule && p.outline_removed)
        .map(|p| Finding {
            criterion_id: "2.4.7".to_owned(),
            severity: Severity::Serious,
            element: p.selector.clone(),
            file_path: file_path.to_owned(),
            line: 0,
            message: format!(
                "Focus indicator removed via `outline: none` on `{}` \
                 without a visible replacement.",
                p.selector
            ),
            suggestion: "If removing the default outline, provide an alternative \
                         focus indicator using `box-shadow`, `border`, or \
                         `background-color` changes."
                .to_owned(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::css::SelectorProperties;

    #[test]
    fn flags_outline_none_on_focus() {
        let props = vec![SelectorProperties {
            selector: "a:focus".to_owned(),
            outline_removed: true,
            is_focus_rule: true,
            ..Default::default()
        }];
        let findings = check(&props, "style.css");
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].criterion_id, "2.4.7");
    }

    #[test]
    fn ignores_non_focus_outline_removal() {
        let props = vec![SelectorProperties {
            selector: "a".to_owned(),
            outline_removed: true,
            is_focus_rule: false,
            ..Default::default()
        }];
        let findings = check(&props, "style.css");
        assert!(findings.is_empty());
    }

    #[test]
    fn ignores_focus_without_outline_removal() {
        let props = vec![SelectorProperties {
            selector: "a:focus".to_owned(),
            outline_removed: false,
            is_focus_rule: true,
            ..Default::default()
        }];
        let findings = check(&props, "style.css");
        assert!(findings.is_empty());
    }
}
