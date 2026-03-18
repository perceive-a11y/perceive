//! SC 1.4.3 Contrast (Minimum) and SC 1.4.6 Contrast (Enhanced).

use crate::css::SelectorProperties;
use crate::findings::Finding;
use a11y_rules::Severity;
use perceive_color::Color;

/// WCAG AA minimum contrast ratio for normal text.
const AA_NORMAL: f64 = 4.5;
/// WCAG AAA enhanced contrast ratio for normal text.
const AAA_NORMAL: f64 = 7.0;

/// Check CSS color pairs for WCAG contrast compliance.
///
/// Evaluates every selector that declares both `color` and `background-color`.
/// Reports findings for:
/// - SC 1.4.3 (AA) — ratio < 4.5:1
/// - SC 1.4.6 (AAA) — ratio < 7:1 (reported as Minor)
///
/// # Arguments
///
/// * `css_props` - Extracted CSS selector properties
/// * `file_path` - CSS file path for source location
#[must_use]
pub fn check(css_props: &[SelectorProperties], file_path: &str) -> Vec<Finding> {
    let mut findings = Vec::new();

    for props in css_props {
        // We need both foreground and background to check contrast
        let (Some(fg_hex), Some(bg_hex)) = (&props.colors.color, &props.colors.background) else {
            continue;
        };

        // Parse colors using perceive-color
        let (Some(fg), Some(bg)) = (Color::from_hex(fg_hex), Color::from_hex(bg_hex)) else {
            continue;
        };

        let ratio = perceive_color::wcag::contrast_ratio(fg, bg);

        // SC 1.4.3 — AA minimum (normal text assumed)
        if ratio < AA_NORMAL {
            findings.push(Finding {
                criterion_id: "1.4.3".to_owned(),
                severity: Severity::Serious,
                element: props.selector.clone(),
                file_path: file_path.to_owned(),
                line: 0, // CSS rules don't have easy line mapping
                message: format!(
                    "Insufficient contrast ratio {ratio:.2}:1 between {fg_hex} \
                     and {bg_hex} (minimum 4.5:1 for normal text)."
                ),
                suggestion: format!(
                    "Change the text color or background color to achieve at \
                     least a 4.5:1 contrast ratio. Current: {ratio:.2}:1."
                ),
            });
        } else if ratio < AAA_NORMAL {
            // SC 1.4.6 — AAA enhanced (informational)
            findings.push(Finding {
                criterion_id: "1.4.6".to_owned(),
                severity: Severity::Minor,
                element: props.selector.clone(),
                file_path: file_path.to_owned(),
                line: 0,
                message: format!(
                    "Contrast ratio {ratio:.2}:1 between {fg_hex} and {bg_hex} \
                     meets AA but not AAA (7:1 for normal text)."
                ),
                suggestion: format!(
                    "For enhanced accessibility (AAA), increase the contrast \
                     ratio to at least 7:1. Current: {ratio:.2}:1."
                ),
            });
        }
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::css::{CssColorPair, SelectorProperties};

    fn props(fg: &str, bg: &str) -> SelectorProperties {
        SelectorProperties {
            selector: "body".to_owned(),
            colors: CssColorPair {
                color: Some(fg.to_owned()),
                background: Some(bg.to_owned()),
            },
            ..Default::default()
        }
    }

    #[test]
    fn good_contrast() {
        let findings = check(&[props("#000000", "#ffffff")], "style.css");
        // 21:1 — passes both AA and AAA
        assert!(findings.is_empty());
    }

    #[test]
    fn fails_aa() {
        let findings = check(&[props("#777777", "#888888")], "style.css");
        assert!(!findings.is_empty());
        assert!(findings.iter().any(|f| f.criterion_id == "1.4.3"));
    }

    #[test]
    fn passes_aa_fails_aaa() {
        // #767676 on white is ~4.54:1 — passes AA, fails AAA
        let findings = check(&[props("#767676", "#ffffff")], "style.css");
        assert!(findings.iter().any(|f| f.criterion_id == "1.4.6"));
        assert!(!findings.iter().any(|f| f.criterion_id == "1.4.3"));
    }

    #[test]
    fn missing_color_skipped() {
        let p = SelectorProperties {
            selector: "body".to_owned(),
            colors: CssColorPair {
                color: Some("#000".to_owned()),
                background: None,
            },
            ..Default::default()
        };
        let findings = check(&[p], "style.css");
        assert!(findings.is_empty());
    }
}
