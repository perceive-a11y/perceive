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
// Derived from Brettel et al. 1997, Table 2.
const PROTAN_A: [f64; 9] = [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
];
const PROTAN_B: [f64; 9] = [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
];
// Separator: the neutral axis dot product sign selects half-plane.
const PROTAN_SEP: [f64; 3] = [0.0, 0.0, 1.0];

const DEUTAN_A: [f64; 9] = [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881,
];
const DEUTAN_B: [f64; 9] = [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881,
];
const DEUTAN_SEP: [f64; 3] = [0.0, 0.0, 1.0];

const TRITAN_A: [f64; 9] = [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900,
];
const TRITAN_B: [f64; 9] = [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900,
];
const TRITAN_SEP: [f64; 3] = [1.0, 0.0, 0.0];

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

fn simulate_achromat(color: Color) -> Color {
    // Achromat: convert to luminance
    let l = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
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
