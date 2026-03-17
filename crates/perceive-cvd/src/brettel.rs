use perceive_color::Color;

use crate::types::{CvdType, Severity};

/// Simulate color vision deficiency using the Brettel et al. (1997) model.
///
/// This is the more accurate of the two models, using two half-plane
/// projection matrices per CVD type. The input color should be in linear RGB.
#[must_use]
pub fn simulate(color: Color, cvd_type: CvdType, severity: Severity) -> Color {
    if severity.value() == 0.0 {
        return color;
    }

    let simulated = match cvd_type {
        CvdType::Protan => simulate_protan(color),
        CvdType::Deutan => simulate_deutan(color),
        CvdType::Tritan => simulate_tritan(color),
        CvdType::Achromat => simulate_achromat(color),
    };

    // Interpolate between original and simulated based on severity
    let s = severity.value();
    Color::new(
        color.r + (simulated.r - color.r) * s,
        color.g + (simulated.g - color.g) * s,
        color.b + (simulated.b - color.b) * s,
    )
}

/// Apply a 3x3 matrix (row-major) to an RGB color.
fn apply_matrix(m: &[f64; 9], c: Color) -> Color {
    Color::new(
        m[0] * c.r + m[1] * c.g + m[2] * c.b,
        m[3] * c.r + m[4] * c.g + m[5] * c.b,
        m[6] * c.r + m[7] * c.g + m[8] * c.b,
    )
}

// Brettel protan simulation matrices (two half-planes).
// Derived from Brettel et al. 1997 using Smith & Pokorny cone fundamentals.
// Values sourced from the DaltonLens reference implementation.
const PROTAN_A: [f64; 9] = [
    0.14980, 1.19548, -0.34528, 0.10764, 0.84864, 0.04372, 0.00384, -0.00540, 1.00156,
];
const PROTAN_B: [f64; 9] = [
    0.14570, 1.16172, -0.30742, 0.10816, 0.85291, 0.03892, 0.00386, -0.00524, 1.00139,
];
// Separator normal in linear RGB: dot product sign selects half-plane.
const PROTAN_SEP: [f64; 3] = [0.00048, 0.00393, -0.00441];

const DEUTAN_A: [f64; 9] = [
    0.36477, 0.86381, -0.22858, 0.26294, 0.64245, 0.09462, -0.02006, 0.02728, 0.99278,
];
const DEUTAN_B: [f64; 9] = [
    0.37298, 0.88166, -0.25464, 0.25954, 0.63506, 0.10540, -0.01980, 0.02784, 0.99196,
];
const DEUTAN_SEP: [f64; 3] = [-0.00281, -0.00611, 0.00892];

const TRITAN_A: [f64; 9] = [
    1.01277, 0.13548, -0.14826, -0.01243, 0.86812, 0.14431, 0.07589, 0.80500, 0.11911,
];
const TRITAN_B: [f64; 9] = [
    0.93678, 0.18979, -0.12657, 0.06154, 0.81526, 0.12320, -0.37562, 1.12767, 0.24796,
];
const TRITAN_SEP: [f64; 3] = [0.03901, -0.02788, -0.01113];

fn select_half_plane(color: Color, sep: &[f64; 3]) -> bool {
    let dot = sep[0] * color.r + sep[1] * color.g + sep[2] * color.b;
    dot >= 0.0
}

fn simulate_protan(color: Color) -> Color {
    if select_half_plane(color, &PROTAN_SEP) {
        apply_matrix(&PROTAN_A, color)
    } else {
        apply_matrix(&PROTAN_B, color)
    }
}

fn simulate_deutan(color: Color) -> Color {
    if select_half_plane(color, &DEUTAN_SEP) {
        apply_matrix(&DEUTAN_A, color)
    } else {
        apply_matrix(&DEUTAN_B, color)
    }
}

fn simulate_tritan(color: Color) -> Color {
    if select_half_plane(color, &TRITAN_SEP) {
        apply_matrix(&TRITAN_A, color)
    } else {
        apply_matrix(&TRITAN_B, color)
    }
}

/// BT.709 / sRGB luminance coefficients for the R, G, B channels.
pub(crate) const LUMA_R: f64 = 0.2126;
pub(crate) const LUMA_G: f64 = 0.7152;
pub(crate) const LUMA_B: f64 = 0.0722;

fn simulate_achromat(color: Color) -> Color {
    let l = LUMA_R * color.r + LUMA_G * color.g + LUMA_B * color.b;
    Color::new(l, l, l)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_severity_unchanged() {
        let c = Color::from_hex("#ff6600").unwrap();
        let sim = simulate(c, CvdType::Protan, Severity::NONE);
        assert!((sim.r - c.r).abs() < 1e-12);
        assert!((sim.g - c.g).abs() < 1e-12);
        assert!((sim.b - c.b).abs() < 1e-12);
    }

    #[test]
    fn achromat_is_grayscale() {
        let c = Color::from_hex("#ff0000").unwrap();
        let sim = simulate(c, CvdType::Achromat, Severity::FULL);
        assert!((sim.r - sim.g).abs() < 1e-10);
        assert!((sim.g - sim.b).abs() < 1e-10);
    }

    #[test]
    fn protan_changes_red() {
        let red = Color::from_hex("#ff0000").unwrap();
        let sim = simulate(red, CvdType::Protan, Severity::FULL);
        // Red should shift — simulated red channel should differ
        assert!((sim.r - red.r).abs() > 0.01 || (sim.g - red.g).abs() > 0.01);
    }

    #[test]
    fn white_stays_white() {
        // White should be roughly unchanged for any CVD type
        for cvd_type in [CvdType::Protan, CvdType::Deutan, CvdType::Tritan] {
            let sim = simulate(Color::WHITE, cvd_type, Severity::FULL);
            assert!(
                (sim.r - 1.0).abs() < 0.05
                    && (sim.g - 1.0).abs() < 0.05
                    && (sim.b - 1.0).abs() < 0.05,
                "white shifted for {cvd_type:?}: {sim:?}"
            );
        }
    }

    #[test]
    fn black_stays_black() {
        for cvd_type in [
            CvdType::Protan,
            CvdType::Deutan,
            CvdType::Tritan,
            CvdType::Achromat,
        ] {
            let sim = simulate(Color::BLACK, cvd_type, Severity::FULL);
            assert!(
                sim.r.abs() < 0.01 && sim.g.abs() < 0.01 && sim.b.abs() < 0.01,
                "black shifted for {cvd_type:?}: {sim:?}"
            );
        }
    }

    #[test]
    fn partial_severity_interpolates() {
        let c = Color::from_hex("#ff0000").unwrap();
        let full = simulate(c, CvdType::Protan, Severity::FULL);
        let half = simulate(c, CvdType::Protan, Severity::new(0.5));
        // Half severity should be between original and full
        let mid_r = c.r + (full.r - c.r) * 0.5;
        assert!((half.r - mid_r).abs() < 1e-10);
    }
}
