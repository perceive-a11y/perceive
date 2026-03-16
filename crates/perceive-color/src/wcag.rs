use crate::Color;

/// Compute the relative luminance of a color per WCAG 2.2 §1.4.3.
///
/// The color is assumed to be in linear RGB space already.
/// Formula: L = 0.2126 R + 0.7152 G + 0.0722 B
#[must_use]
pub fn relative_luminance(color: Color) -> f64 {
    0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
}

/// Compute the WCAG 2.x contrast ratio between two colors.
///
/// Returns a value in [1, 21]. The ratio is always `lighter / darker`,
/// so argument order doesn't matter.
#[must_use]
pub fn contrast_ratio(a: Color, b: Color) -> f64 {
    let l1 = relative_luminance(a);
    let l2 = relative_luminance(b);
    let (lighter, darker) = if l1 > l2 { (l1, l2) } else { (l2, l1) };
    (lighter + 0.05) / (darker + 0.05)
}

/// WCAG conformance level for contrast.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum Level {
    /// Does not meet minimum contrast requirements.
    Fail,
    /// WCAG 2.2 Level AA (§1.4.3).
    AA,
    /// WCAG 2.2 Level AAA (§1.4.6).
    AAA,
}

/// Check the WCAG 2.2 conformance level for a foreground/background pair.
///
/// `large_text` uses the relaxed thresholds (3:1 for AA, 4.5:1 for AAA).
/// Normal text requires 4.5:1 for AA and 7:1 for AAA.
#[must_use]
pub fn conformance_level(fg: Color, bg: Color, large_text: bool) -> Level {
    let ratio = contrast_ratio(fg, bg);
    let (aa_threshold, aaa_threshold) = if large_text { (3.0, 4.5) } else { (4.5, 7.0) };
    if ratio >= aaa_threshold {
        Level::AAA
    } else if ratio >= aa_threshold {
        Level::AA
    } else {
        Level::Fail
    }
}

/// Check whether the contrast ratio meets WCAG 2.2 Level AA.
#[must_use]
pub fn meets_aa(fg: Color, bg: Color, large_text: bool) -> bool {
    matches!(
        conformance_level(fg, bg, large_text),
        Level::AA | Level::AAA
    )
}

/// Check whether the contrast ratio meets WCAG 2.2 Level AAA.
#[must_use]
pub fn meets_aaa(fg: Color, bg: Color, large_text: bool) -> bool {
    conformance_level(fg, bg, large_text) == Level::AAA
}

#[cfg(test)]
mod tests {
    use super::*;

    /// W3C reference: black on white should be 21:1.
    #[test]
    fn black_on_white() {
        let ratio = contrast_ratio(Color::BLACK, Color::WHITE);
        assert!((ratio - 21.0).abs() < 0.01);
    }

    /// Same color should produce 1:1 ratio.
    #[test]
    fn same_color() {
        let c = Color::from_hex("#808080").unwrap();
        let ratio = contrast_ratio(c, c);
        assert!((ratio - 1.0).abs() < 0.01);
    }

    /// W3C reference: #777777 on white should be ~4.48:1.
    #[test]
    fn gray_on_white() {
        let gray = Color::from_hex("#777777").unwrap();
        let ratio = contrast_ratio(gray, Color::WHITE);
        assert!((ratio - 4.48).abs() < 0.1, "expected ~4.48, got {ratio}");
    }

    /// Order independence: `contrast_ratio(a,b)` == `contrast_ratio(b,a)`.
    #[test]
    fn order_independent() {
        let a = Color::from_hex("#ff0000").unwrap();
        let b = Color::from_hex("#0000ff").unwrap();
        let r1 = contrast_ratio(a, b);
        let r2 = contrast_ratio(b, a);
        assert!((r1 - r2).abs() < 1e-12);
    }

    #[test]
    fn meets_aa_normal_text() {
        // 21:1 — clearly passes
        assert!(meets_aa(Color::BLACK, Color::WHITE, false));
        // Same color — 1:1, fails
        assert!(!meets_aa(Color::WHITE, Color::WHITE, false));
    }

    #[test]
    fn meets_aaa_large_text() {
        // 21:1 — passes AAA for large text
        assert!(meets_aaa(Color::BLACK, Color::WHITE, true));
    }

    #[test]
    fn luminance_black() {
        assert!((relative_luminance(Color::BLACK) - 0.0).abs() < 1e-12);
    }

    #[test]
    fn luminance_white() {
        assert!((relative_luminance(Color::WHITE) - 1.0).abs() < 1e-12);
    }
}
