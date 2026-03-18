//! SC 2.5.8 Target Size (Minimum) and SC 2.5.5 Target Size (Enhanced).

use crate::css::SelectorProperties;
use crate::findings::Finding;
use a11y_rules::Severity;

/// WCAG 2.2 AA minimum target size in CSS pixels.
const MIN_TARGET_PX: f32 = 24.0;
/// WCAG 2.2 AAA enhanced target size in CSS pixels.
const ENHANCED_TARGET_PX: f32 = 44.0;

/// Check CSS for interactive elements with explicitly small dimensions.
///
/// Only flags elements where *explicit* CSS width/height is set below
/// the 24x24px minimum. Elements without explicit sizing are assumed
/// to meet the requirement through default browser styling and padding.
///
/// # Arguments
///
/// * `css_props` - Extracted CSS selector properties
/// * `file_path` - CSS file path for source location
#[must_use]
pub fn check(css_props: &[SelectorProperties], file_path: &str) -> Vec<Finding> {
    css_props
        .iter()
        .filter(|p| selector_targets_interactive(&p.selector))
        .filter(|p| {
            // Check if explicit dimensions are below minimum
            let effective_width = p.min_width_px.unwrap_or(0.0).max(p.width_px.unwrap_or(0.0));
            let effective_height = p
                .min_height_px
                .unwrap_or(0.0)
                .max(p.height_px.unwrap_or(0.0));

            // Only flag if at least one dimension is explicitly set below minimum
            let width_too_small =
                p.width_px.is_some() && effective_width > 0.0 && effective_width < MIN_TARGET_PX;
            let height_too_small =
                p.height_px.is_some() && effective_height > 0.0 && effective_height < MIN_TARGET_PX;

            width_too_small || height_too_small
        })
        .flat_map(|p| {
            let w = p.width_px.unwrap_or(0.0);
            let h = p.height_px.unwrap_or(0.0);
            let effective_w = p.min_width_px.unwrap_or(0.0).max(w);
            let effective_h = p.min_height_px.unwrap_or(0.0).max(h);
            let mut findings = Vec::with_capacity(2);

            // SC 2.5.8 — AA minimum (24px)
            if effective_w < MIN_TARGET_PX || effective_h < MIN_TARGET_PX {
                findings.push(Finding {
                    criterion_id: "2.5.8".to_owned(),
                    severity: Severity::Moderate,
                    element: p.selector.clone(),
                    file_path: file_path.to_owned(),
                    line: 0,
                    message: format!(
                        "Interactive element `{sel}` has target size {w:.0}x{h:.0}px, \
                         below the 24x24px minimum.",
                        sel = p.selector
                    ),
                    suggestion: format!(
                        "Increase the element's clickable area to at least \
                         {MIN_TARGET_PX}x{MIN_TARGET_PX}px using width, height, \
                         padding, or min-width/min-height."
                    ),
                });
            } else if effective_w < ENHANCED_TARGET_PX || effective_h < ENHANCED_TARGET_PX {
                // SC 2.5.5 — AAA enhanced (44px)
                findings.push(Finding {
                    criterion_id: "2.5.5".to_owned(),
                    severity: Severity::Minor,
                    element: p.selector.clone(),
                    file_path: file_path.to_owned(),
                    line: 0,
                    message: format!(
                        "Interactive element `{sel}` has target size {w:.0}x{h:.0}px. \
                         Meets AA minimum (24px) but not AAA enhanced (44px).",
                        sel = p.selector
                    ),
                    suggestion: format!(
                        "For enhanced touch accessibility (AAA), increase the \
                         element to at least {ENHANCED_TARGET_PX}x{ENHANCED_TARGET_PX}px."
                    ),
                });
            }

            findings
        })
        .collect()
}

/// Check if a CSS selector likely targets interactive elements.
///
/// Uses word-boundary-aware matching to avoid false positives like
/// `.card-image` matching the `a` keyword.
fn selector_targets_interactive(selector: &str) -> bool {
    let sel = selector.to_lowercase();

    // Direct tag selectors
    for tag in &["button", "input", "select"] {
        if sel_contains_word(&sel, tag) {
            return true;
        }
    }

    // `a` needs special handling — only match the tag, not substrings
    // Match: "a", "a.class", "a:hover", "a[href]", "a > span"
    // Skip: ".card", ".navbar", ".banner"
    if sel_contains_word(&sel, "a") {
        return true;
    }

    // Class/ID patterns commonly used for interactive elements
    for pattern in &["btn", "link"] {
        if sel.contains(pattern) {
            return true;
        }
    }

    false
}

/// Check if a selector contains a word (delimited by non-alphanumeric chars).
fn sel_contains_word(selector: &str, word: &str) -> bool {
    // Find all occurrences of the word and check boundaries
    let mut start = 0;
    while let Some(pos) = selector[start..].find(word) {
        let abs_pos = start + pos;
        let end_pos = abs_pos + word.len();

        // Check left boundary: start of string or non-alphanumeric/hyphen/underscore
        let left_ok = abs_pos == 0
            || !selector.as_bytes()[abs_pos - 1].is_ascii_alphanumeric()
                && selector.as_bytes()[abs_pos - 1] != b'-'
                && selector.as_bytes()[abs_pos - 1] != b'_';

        // Check right boundary: end of string or non-alphanumeric/hyphen/underscore
        let right_ok = end_pos >= selector.len()
            || !selector.as_bytes()[end_pos].is_ascii_alphanumeric()
                && selector.as_bytes()[end_pos] != b'-'
                && selector.as_bytes()[end_pos] != b'_';

        if left_ok && right_ok {
            return true;
        }

        start = abs_pos + 1;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::css::SelectorProperties;

    #[test]
    fn flags_small_button() {
        let props = vec![SelectorProperties {
            selector: ".btn-small".to_owned(),
            width_px: Some(16.0),
            height_px: Some(16.0),
            ..Default::default()
        }];
        let findings = check(&props, "style.css");
        assert_eq!(findings.len(), 1);
        assert_eq!(findings[0].criterion_id, "2.5.8");
    }

    #[test]
    fn allows_large_button() {
        let props = vec![SelectorProperties {
            selector: ".btn".to_owned(),
            width_px: Some(48.0),
            height_px: Some(48.0),
            ..Default::default()
        }];
        let findings = check(&props, "style.css");
        assert!(findings.is_empty());
    }

    #[test]
    fn ignores_non_interactive() {
        let props = vec![SelectorProperties {
            selector: ".card-image".to_owned(),
            width_px: Some(10.0),
            height_px: Some(10.0),
            ..Default::default()
        }];
        let findings = check(&props, "style.css");
        assert!(findings.is_empty());
    }

    #[test]
    fn min_size_overrides() {
        let props = vec![SelectorProperties {
            selector: "button".to_owned(),
            width_px: Some(16.0),
            height_px: Some(16.0),
            min_width_px: Some(24.0),
            min_height_px: Some(24.0),
            ..Default::default()
        }];
        let findings = check(&props, "style.css");
        assert!(findings.is_empty());
    }
}
