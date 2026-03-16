use crate::Color;

/// OKLCH color representation.
#[derive(Debug, Clone, Copy, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Oklch {
    /// Lightness [0, 1]
    pub l: f64,
    /// Chroma [0, ~0.37]
    pub c: f64,
    /// Hue in degrees [0, 360)
    pub h: f64,
}

/// Oklab intermediate representation.
#[derive(Debug, Clone, Copy)]
struct Oklab {
    l: f64,
    a: f64,
    b: f64,
}

/// Convert linear sRGB → Oklab.
fn linear_srgb_to_oklab(c: Color) -> Oklab {
    let l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
    let m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
    let s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;

    let l_ = l.cbrt();
    let m_ = m.cbrt();
    let s_ = s.cbrt();

    Oklab {
        l: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    }
}

/// Convert Oklab → linear sRGB.
fn oklab_to_linear_srgb(lab: Oklab) -> Color {
    let l_ = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    let m_ = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    let s_ = lab.l - 0.0894841775 * lab.a - 1.2914855480 * lab.b;

    let l = l_ * l_ * l_;
    let m = m_ * m_ * m_;
    let s = s_ * s_ * s_;

    Color::new(
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    )
}

impl Color {
    /// Convert to OKLCH color space.
    #[must_use]
    pub fn to_oklch(self) -> Oklch {
        let lab = linear_srgb_to_oklab(self);
        let c = (lab.a * lab.a + lab.b * lab.b).sqrt();
        let h = lab.b.atan2(lab.a).to_degrees().rem_euclid(360.0);
        Oklch { l: lab.l, c, h }
    }

    /// Create a color from OKLCH values.
    ///
    /// The result is gamut-mapped to sRGB (components clamped to [0, 1]).
    #[must_use]
    pub fn from_oklch(oklch: Oklch) -> Self {
        let h_rad = oklch.h.to_radians();
        let lab = Oklab {
            l: oklch.l,
            a: oklch.c * h_rad.cos(),
            b: oklch.c * h_rad.sin(),
        };
        oklab_to_linear_srgb(lab)
    }
}

/// Linearly interpolate between two OKLCH colors.
///
/// `t` is in [0, 1]. Hue interpolation takes the shortest arc.
#[must_use]
pub fn oklch_lerp(a: Oklch, b: Oklch, t: f64) -> Oklch {
    let l = a.l + (b.l - a.l) * t;
    let c = a.c + (b.c - a.c) * t;

    // Shortest-arc hue interpolation
    let mut dh = b.h - a.h;
    if dh > 180.0 {
        dh -= 360.0;
    } else if dh < -180.0 {
        dh += 360.0;
    }
    let h = (a.h + dh * t).rem_euclid(360.0);

    Oklch { l, c, h }
}

/// Simple gamut mapping: reduce chroma until the color fits in sRGB.
///
/// Binary search on chroma, keeping L and H constant.
#[must_use]
pub fn gamut_map(oklch: Oklch) -> Oklch {
    let mut low = 0.0_f64;
    let mut high = oklch.c;

    for _ in 0..32 {
        let mid = f64::midpoint(low, high);
        let candidate = Oklch {
            l: oklch.l,
            c: mid,
            h: oklch.h,
        };
        let rgb = Color::from_oklch(candidate);
        // Check if in gamut (before clamping would change values)
        let lab = linear_srgb_to_oklab(rgb);
        let c_back = (lab.a * lab.a + lab.b * lab.b).sqrt();
        if (c_back - mid).abs() < 0.001 {
            low = mid;
        } else {
            high = mid;
        }
    }

    Oklch {
        l: oklch.l,
        c: low,
        h: oklch.h,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_white() {
        let oklch = Color::WHITE.to_oklch();
        let back = Color::from_oklch(oklch);
        assert!((back.r - 1.0).abs() < 1e-6);
        assert!((back.g - 1.0).abs() < 1e-6);
        assert!((back.b - 1.0).abs() < 1e-6);
    }

    #[test]
    fn roundtrip_black() {
        let oklch = Color::BLACK.to_oklch();
        assert!(oklch.l.abs() < 1e-6);
        let back = Color::from_oklch(oklch);
        assert!(back.r.abs() < 1e-6);
        assert!(back.g.abs() < 1e-6);
        assert!(back.b.abs() < 1e-6);
    }

    #[test]
    fn roundtrip_red() {
        let red = Color::from_hex("#ff0000").unwrap();
        let oklch = red.to_oklch();
        let back = Color::from_oklch(oklch);
        let (r, g, b) = back.to_srgb8();
        assert_eq!(r, 255);
        assert!(g <= 1);
        assert!(b <= 1);
    }

    #[test]
    fn lerp_endpoints() {
        let a = Color::from_hex("#ff0000").unwrap().to_oklch();
        let b = Color::from_hex("#0000ff").unwrap().to_oklch();

        let start = oklch_lerp(a, b, 0.0);
        assert!((start.l - a.l).abs() < 1e-10);
        assert!((start.c - a.c).abs() < 1e-10);

        let end = oklch_lerp(a, b, 1.0);
        assert!((end.l - b.l).abs() < 1e-10);
        assert!((end.c - b.c).abs() < 1e-10);
    }

    #[test]
    fn gamut_map_already_in_gamut() {
        let oklch = Color::from_hex("#808080").unwrap().to_oklch();
        let mapped = gamut_map(oklch);
        // Chroma should be mostly unchanged for an in-gamut color
        assert!((mapped.c - oklch.c).abs() < 0.01);
    }
}
