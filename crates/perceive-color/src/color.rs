/// A color stored as linear RGB (f64 components in [0, 1]).
///
/// All internal arithmetic operates in linear space.
/// Convert to/from sRGB at the boundaries using [`Color::from_srgb`] / [`Color::to_srgb`].
#[derive(Debug, Clone, Copy, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Color {
    /// Red channel in linear space [0, 1]
    pub r: f64,
    /// Green channel in linear space [0, 1]
    pub g: f64,
    /// Blue channel in linear space [0, 1]
    pub b: f64,
}

impl Color {
    /// Create a new color from linear RGB components.
    ///
    /// Values are clamped to [0, 1].
    #[must_use]
    pub fn new(r: f64, g: f64, b: f64) -> Self {
        Self {
            r: r.clamp(0.0, 1.0),
            g: g.clamp(0.0, 1.0),
            b: b.clamp(0.0, 1.0),
        }
    }

    /// Create a color from sRGB components in [0, 1].
    #[must_use]
    pub fn from_srgb(r: f64, g: f64, b: f64) -> Self {
        Self::new(srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b))
    }

    /// Create a color from 8-bit sRGB components (0–255).
    #[must_use]
    pub fn from_srgb8(r: u8, g: u8, b: u8) -> Self {
        Self::from_srgb(
            f64::from(r) / 255.0,
            f64::from(g) / 255.0,
            f64::from(b) / 255.0,
        )
    }

    /// Convert to sRGB components in [0, 1].
    #[must_use]
    pub fn to_srgb(self) -> (f64, f64, f64) {
        (
            linear_to_srgb(self.r),
            linear_to_srgb(self.g),
            linear_to_srgb(self.b),
        )
    }

    /// Convert to 8-bit sRGB components (0–255).
    #[must_use]
    pub fn to_srgb8(self) -> (u8, u8, u8) {
        let (r, g, b) = self.to_srgb();
        (
            (r * 255.0 + 0.5) as u8,
            (g * 255.0 + 0.5) as u8,
            (b * 255.0 + 0.5) as u8,
        )
    }

    /// Create a color from a hex string (e.g., `#ff0000`, `ff0000`, `#f00`).
    ///
    /// Returns `None` if the string is not a valid hex color.
    #[must_use]
    pub fn from_hex(hex: &str) -> Option<Self> {
        let hex = hex.strip_prefix('#').unwrap_or(hex);
        match hex.len() {
            3 => {
                let r = u8::from_str_radix(&hex[0..1], 16).ok()?;
                let g = u8::from_str_radix(&hex[1..2], 16).ok()?;
                let b = u8::from_str_radix(&hex[2..3], 16).ok()?;
                Some(Self::from_srgb8(r * 17, g * 17, b * 17))
            }
            6 => {
                let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
                let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
                let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
                Some(Self::from_srgb8(r, g, b))
            }
            _ => None,
        }
    }

    /// Convert to a hex string (e.g., `#ff0000`).
    #[must_use]
    #[cfg(feature = "std")]
    pub fn to_hex(self) -> String {
        let (r, g, b) = self.to_srgb8();
        format!("#{r:02x}{g:02x}{b:02x}")
    }

    /// Black in linear RGB.
    pub const BLACK: Self = Self {
        r: 0.0,
        g: 0.0,
        b: 0.0,
    };

    /// White in linear RGB.
    pub const WHITE: Self = Self {
        r: 1.0,
        g: 1.0,
        b: 1.0,
    };
}

/// Convert a single sRGB component to linear.
///
/// IEC 61966-2-1 transfer function.
#[must_use]
pub fn srgb_to_linear(c: f64) -> f64 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

/// Convert a single linear component to sRGB.
///
/// Inverse of IEC 61966-2-1 transfer function.
#[must_use]
pub fn linear_to_srgb(c: f64) -> f64 {
    if c <= 0.0031308 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn srgb_roundtrip() {
        for i in 0..=255 {
            let srgb = f64::from(i) / 255.0;
            let linear = srgb_to_linear(srgb);
            let back = linear_to_srgb(linear);
            assert!((srgb - back).abs() < 1e-12, "roundtrip failed for {i}");
        }
    }

    #[test]
    fn from_hex_full() {
        let c = Color::from_hex("#ff8000").unwrap();
        let (r, g, b) = c.to_srgb8();
        assert_eq!((r, g, b), (255, 128, 0));
    }

    #[test]
    fn from_hex_short() {
        let c = Color::from_hex("#f00").unwrap();
        let (r, g, b) = c.to_srgb8();
        assert_eq!((r, g, b), (255, 0, 0));
    }

    #[test]
    fn from_hex_no_hash() {
        let c = Color::from_hex("00ff00").unwrap();
        let (r, g, b) = c.to_srgb8();
        assert_eq!((r, g, b), (0, 255, 0));
    }

    #[test]
    fn black_white_constants() {
        assert_eq!(Color::BLACK.to_srgb8(), (0, 0, 0));
        assert_eq!(Color::WHITE.to_srgb8(), (255, 255, 255));
    }

    #[test]
    #[allow(clippy::float_cmp)]
    fn clamping() {
        let c = Color::new(-0.5, 1.5, 0.5);
        assert_eq!(c.r, 0.0);
        assert_eq!(c.g, 1.0);
        assert_eq!(c.b, 0.5);
    }
}
