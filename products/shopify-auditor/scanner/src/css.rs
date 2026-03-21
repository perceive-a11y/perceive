//! CSS property extraction using `lightningcss`.
//!
//! Parses CSS stylesheets to extract properties relevant to accessibility
//! checks: colors, outlines, dimensions on interactive elements.

use lightningcss::properties::Property;
use lightningcss::properties::PropertyId;
use lightningcss::properties::border::LineStyle;
use lightningcss::properties::custom::UnparsedProperty;
use lightningcss::properties::outline::OutlineStyle;
use lightningcss::properties::size::Size;
use lightningcss::rules::CssRule;
use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use lightningcss::values::color::CssColor;
use lightningcss::values::percentage::DimensionPercentage;

/// Color values extracted from CSS, in sRGB hex format.
#[derive(Debug, Clone, Default)]
pub struct CssColorPair {
    /// Foreground text color, e.g. `"#333333"`.
    pub color: Option<String>,
    /// Background color, e.g. `"#ffffff"`.
    pub background: Option<String>,
}

/// Properties extracted from a CSS selector relevant to a11y checks.
#[derive(Debug, Clone, Default)]
#[allow(clippy::struct_excessive_bools)]
pub struct SelectorProperties {
    /// The CSS selector string.
    pub selector: String,
    /// Text and background colors.
    pub colors: CssColorPair,
    /// Whether `color` uses a CSS variable (e.g. `var(--color-fg)`).
    pub color_uses_variable: bool,
    /// Whether `background-color` uses a CSS variable.
    pub bg_uses_variable: bool,
    /// Whether `outline: none` or `outline: 0` is set.
    pub outline_removed: bool,
    /// Whether this rule targets `:focus` pseudo-class.
    pub is_focus_rule: bool,
    /// Explicit width value in px (if set).
    pub width_px: Option<f32>,
    /// Explicit height value in px (if set).
    pub height_px: Option<f32>,
    /// Explicit min-width value in px (if set).
    pub min_width_px: Option<f32>,
    /// Explicit min-height value in px (if set).
    pub min_height_px: Option<f32>,
}

/// Extract accessibility-relevant properties from a CSS stylesheet.
///
/// Parses the stylesheet and walks all rules, building a list of
/// selector -> properties for downstream checks.
///
/// # Arguments
///
/// * `css` - Raw CSS source code
///
/// # Returns
///
/// A vector of selector-property pairs. One entry per rule with relevant props.
#[must_use]
pub fn extract_properties(css: &str) -> Vec<SelectorProperties> {
    let mut results = Vec::new();

    let Ok(stylesheet) = StyleSheet::parse(css, ParserOptions::default()) else {
        log::warn!("Failed to parse CSS stylesheet; skipping");
        return results;
    };

    for rule in &stylesheet.rules.0 {
        extract_from_rule(rule, &mut results);
    }

    results
}

/// Recursively extract properties from a CSS rule (handles nested @-rules).
fn extract_from_rule(rule: &CssRule, results: &mut Vec<SelectorProperties>) {
    match rule {
        CssRule::Style(style_rule) => {
            let selector_text = style_rule.selectors.to_string();
            let is_focus = selector_text.contains(":focus");
            let mut props = SelectorProperties {
                selector: selector_text,
                is_focus_rule: is_focus,
                ..Default::default()
            };

            // Walk both normal and important declarations
            for decl in &style_rule.declarations.declarations {
                extract_property(decl, &mut props);
            }
            for decl in &style_rule.declarations.important_declarations {
                extract_property(decl, &mut props);
            }

            // Only include rules with a11y-relevant properties
            if props.colors.color.is_some()
                || props.colors.background.is_some()
                || props.color_uses_variable
                || props.bg_uses_variable
                || props.outline_removed
                || props.width_px.is_some()
                || props.height_px.is_some()
                || props.min_width_px.is_some()
                || props.min_height_px.is_some()
            {
                results.push(props);
            }
        }
        CssRule::Media(media_rule) => {
            for r in &media_rule.rules.0 {
                extract_from_rule(r, results);
            }
        }
        CssRule::Supports(supports_rule) => {
            for r in &supports_rule.rules.0 {
                extract_from_rule(r, results);
            }
        }
        _ => {}
    }
}

/// Extract a single a11y-relevant property from a declaration.
fn extract_property(property: &Property, props: &mut SelectorProperties) {
    match property {
        Property::Color(color, ..) => {
            if let Some(hex) = css_color_to_hex(color) {
                props.colors.color = Some(hex);
            }
        }
        Property::BackgroundColor(color, ..) => {
            if let Some(hex) = css_color_to_hex(color) {
                props.colors.background = Some(hex);
            }
        }
        // Detect CSS variable usage (e.g. `color: var(--color-fg)`)
        // which lightningcss stores as Unparsed because it can't resolve
        // the variable at parse time.
        Property::Unparsed(unparsed) => {
            extract_unparsed_property(unparsed, props);
        }
        Property::OutlineStyle(style, ..) => {
            // outline-style: none means outline is removed
            if matches!(style, OutlineStyle::LineStyle(LineStyle::None)) {
                props.outline_removed = true;
            }
        }
        Property::Width(size, ..) => {
            props.width_px = size_to_px(size);
        }
        Property::Height(size, ..) => {
            props.height_px = size_to_px(size);
        }
        Property::MinWidth(size, ..) => {
            props.min_width_px = size_to_px(size);
        }
        Property::MinHeight(size, ..) => {
            props.min_height_px = size_to_px(size);
        }
        _ => {}
    }
}

/// Handle CSS properties that use `var()` or other unresolvable values.
fn extract_unparsed_property(unparsed: &UnparsedProperty, props: &mut SelectorProperties) {
    match &unparsed.property_id {
        PropertyId::Color => {
            props.color_uses_variable = true;
        }
        PropertyId::BackgroundColor => {
            props.bg_uses_variable = true;
        }
        _ => {}
    }
}

/// Attempt to convert a `CssColor` to a hex string.
fn css_color_to_hex(color: &CssColor) -> Option<String> {
    match color {
        CssColor::RGBA(rgba) => Some(format!(
            "#{:02x}{:02x}{:02x}",
            rgba.red, rgba.green, rgba.blue
        )),
        // currentColor, system colors, lab/lch, etc. can't be resolved
        // statically — skip for MVP.
        _ => None,
    }
}

/// Extract a pixel value from a `Size` enum.
fn size_to_px(size: &Size) -> Option<f32> {
    if let Size::LengthPercentage(DimensionPercentage::Dimension(len)) = size {
        len.to_px()
    } else {
        None
    }
}

/// Parse inline `style="..."` attribute and extract color properties.
///
/// Returns a `CssColorPair` with any `color` and `background-color` found.
#[must_use]
pub fn parse_inline_style(style: &str) -> CssColorPair {
    let mut pair = CssColorPair::default();
    let css = format!("dummy {{ {style} }}");
    let props = extract_properties(&css);
    if let Some(p) = props.first() {
        pair = p.colors.clone();
    }
    pair
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_color_properties() {
        let css = "body { color: #333333; background-color: #ffffff; }";
        let props = extract_properties(css);
        assert_eq!(props.len(), 1);
        assert_eq!(props[0].colors.color.as_deref(), Some("#333333"));
        assert_eq!(props[0].colors.background.as_deref(), Some("#ffffff"));
    }

    #[test]
    fn detect_outline_none() {
        let css = "a:focus { outline-style: none; }";
        let props = extract_properties(css);
        assert_eq!(props.len(), 1);
        assert!(props[0].outline_removed);
        assert!(props[0].is_focus_rule);
    }

    #[test]
    fn extract_dimensions() {
        let css = "button { width: 20px; height: 20px; }";
        let props = extract_properties(css);
        assert_eq!(props.len(), 1);
        assert_eq!(props[0].width_px, Some(20.0));
        assert_eq!(props[0].height_px, Some(20.0));
    }

    #[test]
    fn invalid_css_returns_empty() {
        let css = "this is not valid css {{{";
        let props = extract_properties(css);
        assert!(props.is_empty());
    }

    #[test]
    fn inline_style_parsing() {
        let pair = parse_inline_style("color: red; background-color: #000");
        assert!(pair.color.is_some());
        assert!(pair.background.is_some());
    }
}
