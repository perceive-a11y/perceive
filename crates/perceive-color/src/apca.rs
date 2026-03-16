use crate::Color;
use crate::color::linear_to_srgb;

/// APCA-W3 constants (version 0.0.98G-4g).
const S_TRC: f64 = 2.4;
const B_THRSH: f64 = 0.022;
const B_CLIP: f64 = 1.414;

// Luminance coefficients for sRGB→Y
const R_CO: f64 = 0.2126729;
const G_CO: f64 = 0.7151522;
const B_CO: f64 = 0.0721750;

// SAPC power curve
const NTX: f64 = 0.57;
const NBG: f64 = 0.56;
const RTX: f64 = 0.62;
const RBG: f64 = 0.65;

// Scale and offset
const SCALE: f64 = 1.14;
const OFFSET: f64 = 0.027;
const LOW_CLIP: f64 = 0.1;

/// Compute APCA perceptual luminance (Y) from a color.
///
/// APCA applies its own linearization (simple gamma 2.4) to sRGB values,
/// so we convert from our internal linear RGB back to sRGB first.
fn apca_luminance(c: Color) -> f64 {
    let sr = linear_to_srgb(c.r);
    let sg = linear_to_srgb(c.g);
    let sb = linear_to_srgb(c.b);
    let y = R_CO * sr.powf(S_TRC) + G_CO * sg.powf(S_TRC) + B_CO * sb.powf(S_TRC);
    if y < B_THRSH {
        y + (B_THRSH - y).powf(B_CLIP)
    } else {
        y
    }
}

/// Compute the APCA lightness contrast (Lc) between text and background.
///
/// Returns a signed value: positive means dark text on light background,
/// negative means light text on dark background. The absolute value is
/// the contrast magnitude (typically 0–106).
///
/// `text` is the foreground (text) color, `bg` is the background color.
/// Both should be in linear RGB space.
#[must_use]
pub fn apca_contrast(text: Color, bg: Color) -> f64 {
    let y_txt = apca_luminance(text);
    let y_bg = apca_luminance(bg);

    // Normal polarity: light background, dark text → positive Lc
    // Reverse polarity: dark background, light text → negative Lc
    let (sapc, polarity) = if y_bg > y_txt {
        // Normal polarity
        let sapc = (y_bg.powf(NBG) - y_txt.powf(NTX)) * SCALE;
        (sapc, 1.0)
    } else {
        // Reverse polarity
        let sapc = (y_bg.powf(RBG) - y_txt.powf(RTX)) * SCALE;
        (sapc, -1.0)
    };

    let lc = if sapc.abs() < LOW_CLIP {
        0.0
    } else if polarity > 0.0 {
        sapc - OFFSET
    } else {
        sapc + OFFSET
    };

    // APCA outputs Lc on a ~0–106 scale
    lc * 100.0
}

/// Font size lookup for APCA Lc values.
///
/// Returns the minimum recommended font weight (100–900) and size (px)
/// for a given Lc value, or `None` if the contrast is insufficient for
/// any text.
#[must_use]
pub fn apca_font_lookup(lc: f64) -> Option<ApcaFontRecommendation> {
    let lc = lc.abs();
    if lc >= 90.0 {
        Some(ApcaFontRecommendation {
            min_weight: 100,
            min_size_px: 12.0,
        })
    } else if lc >= 75.0 {
        Some(ApcaFontRecommendation {
            min_weight: 400,
            min_size_px: 14.0,
        })
    } else if lc >= 60.0 {
        Some(ApcaFontRecommendation {
            min_weight: 400,
            min_size_px: 18.0,
        })
    } else if lc >= 45.0 {
        Some(ApcaFontRecommendation {
            min_weight: 400,
            min_size_px: 24.0,
        })
    } else if lc >= 30.0 {
        Some(ApcaFontRecommendation {
            min_weight: 400,
            min_size_px: 36.0,
        })
    } else {
        None
    }
}

/// Font recommendation from APCA lookup.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ApcaFontRecommendation {
    /// Minimum font weight (100–900).
    pub min_weight: u16,
    /// Minimum font size in CSS px.
    pub min_size_px: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn black_on_white_high_contrast() {
        let lc = apca_contrast(Color::BLACK, Color::WHITE);
        // APCA reference: black on white ≈ 106 Lc (positive = normal polarity)
        assert!(lc > 100.0, "expected Lc > 100, got {lc}");
        assert!(lc < 110.0, "expected Lc < 110, got {lc}");
    }

    #[test]
    fn white_on_black_reverse_polarity() {
        let lc = apca_contrast(Color::WHITE, Color::BLACK);
        // Reverse polarity → negative value
        assert!(lc < -100.0, "expected Lc < -100, got {lc}");
    }

    #[test]
    fn same_color_zero() {
        let c = Color::from_hex("#888888").unwrap();
        let lc = apca_contrast(c, c);
        assert!(lc.abs() < 1.0, "same color should be ~0 Lc, got {lc}");
    }

    #[test]
    fn polarity_sign() {
        // Dark text on light bg → positive
        let lc_normal = apca_contrast(
            Color::from_hex("#333333").unwrap(),
            Color::from_hex("#ffffff").unwrap(),
        );
        assert!(lc_normal > 0.0);

        // Light text on dark bg → negative
        let lc_reverse = apca_contrast(
            Color::from_hex("#ffffff").unwrap(),
            Color::from_hex("#333333").unwrap(),
        );
        assert!(lc_reverse < 0.0);
    }

    #[test]
    #[allow(clippy::float_cmp)]
    fn font_lookup_high_contrast() {
        let rec = apca_font_lookup(95.0).unwrap();
        assert_eq!(rec.min_weight, 100);
        assert_eq!(rec.min_size_px, 12.0);
    }

    #[test]
    fn font_lookup_insufficient() {
        assert!(apca_font_lookup(20.0).is_none());
    }
}
