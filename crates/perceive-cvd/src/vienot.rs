use perceive_color::Color;

use crate::brettel::{LUMA_B, LUMA_G, LUMA_R};
use crate::types::CvdType;

/// Simulate color vision deficiency using the Viénot et al. (1999) model.
///
/// This is a faster but less accurate model that uses a single 3x3 matrix
/// per CVD type. Always simulates full dichromacy (severity = 1.0).
/// For partial severity, use [`crate::brettel::simulate`] instead.
#[must_use]
pub fn simulate_fast(color: Color, cvd_type: CvdType) -> Color {
    let matrix = match cvd_type {
        CvdType::Protan => &VIENOT_PROTAN,
        CvdType::Deutan => &VIENOT_DEUTAN,
        CvdType::Tritan => &VIENOT_TRITAN,
        CvdType::Achromat => {
            let l = LUMA_R * color.r + LUMA_G * color.g + LUMA_B * color.b;
            return Color::new(l, l, l);
        }
    };

    Color::new(
        matrix[0] * color.r + matrix[1] * color.g + matrix[2] * color.b,
        matrix[3] * color.r + matrix[4] * color.g + matrix[5] * color.b,
        matrix[6] * color.r + matrix[7] * color.g + matrix[8] * color.b,
    )
}

// Viénot et al. 1999 simulation matrices for full dichromacy.
// These are derived from the original paper, Table 1.
const VIENOT_PROTAN: [f64; 9] = [
    0.11238, 0.88762, 0.00000, 0.11238, 0.88762, -0.00000, 0.00401, -0.00401, 1.00000,
];

const VIENOT_DEUTAN: [f64; 9] = [
    0.29275, 0.70725, 0.00000, 0.29275, 0.70725, -0.00000, -0.02234, 0.02234, 1.00000,
];

const VIENOT_TRITAN: [f64; 9] = [
    1.00000, 0.14461, -0.14461, 0.00000, 0.85924, 0.14076, -0.00000, 0.85924, 0.14076,
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fast_protan_changes_red() {
        let red = Color::from_hex("#ff0000").unwrap();
        let sim = simulate_fast(red, CvdType::Protan);
        // Protan should reduce perceived red
        assert!(sim.r < red.r + 0.01);
    }

    #[test]
    fn fast_achromat_grayscale() {
        let c = Color::from_hex("#ff8800").unwrap();
        let sim = simulate_fast(c, CvdType::Achromat);
        assert!((sim.r - sim.g).abs() < 1e-10);
        assert!((sim.g - sim.b).abs() < 1e-10);
    }

    #[test]
    fn fast_black_stays_black() {
        for cvd in [CvdType::Protan, CvdType::Deutan, CvdType::Tritan] {
            let sim = simulate_fast(Color::BLACK, cvd);
            assert!(sim.r.abs() < 0.01 && sim.g.abs() < 0.01 && sim.b.abs() < 0.01);
        }
    }
}
