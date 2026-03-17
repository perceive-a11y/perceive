use proptest::prelude::*;

use perceive_color::Color;
use perceive_cvd::types::{CvdType, Severity};
use perceive_cvd::{simulate, simulate_fast};

/// All CVD types excluding Achromat (which has separate behavior).
const CVD_TYPES: [CvdType; 3] = [CvdType::Protan, CvdType::Deutan, CvdType::Tritan];

/// All CVD types including Achromat.
const ALL_CVD_TYPES: [CvdType; 4] = [
    CvdType::Protan,
    CvdType::Deutan,
    CvdType::Tritan,
    CvdType::Achromat,
];

proptest! {
    /// Brettel output channels stay within [0, 1] for valid sRGB inputs.
    #[test]
    fn brettel_output_bounded(
        r in 0u8..=255, g in 0u8..=255, b in 0u8..=255,
        cvd_idx in 0usize..4,
        sev in 0.0f64..=1.0,
    ) {
        let c = Color::from_srgb8(r, g, b);
        let sim = simulate(c, ALL_CVD_TYPES[cvd_idx], Severity::new(sev));
        // Allow tiny floating-point overshoot
        prop_assert!(sim.r >= -1e-6 && sim.r <= 1.0 + 1e-6,
            "r out of bounds: {}", sim.r);
        prop_assert!(sim.g >= -1e-6 && sim.g <= 1.0 + 1e-6,
            "g out of bounds: {}", sim.g);
        prop_assert!(sim.b >= -1e-6 && sim.b <= 1.0 + 1e-6,
            "b out of bounds: {}", sim.b);
    }

    /// Vienot output channels stay within [0, 1] for valid sRGB inputs.
    #[test]
    fn vienot_output_bounded(
        r in 0u8..=255, g in 0u8..=255, b in 0u8..=255,
        cvd_idx in 0usize..4,
    ) {
        let c = Color::from_srgb8(r, g, b);
        let sim = simulate_fast(c, ALL_CVD_TYPES[cvd_idx]);
        prop_assert!(sim.r >= -1e-6 && sim.r <= 1.0 + 1e-6,
            "r out of bounds: {}", sim.r);
        prop_assert!(sim.g >= -1e-6 && sim.g <= 1.0 + 1e-6,
            "g out of bounds: {}", sim.g);
        prop_assert!(sim.b >= -1e-6 && sim.b <= 1.0 + 1e-6,
            "b out of bounds: {}", sim.b);
    }

    /// Severity zero is identity: simulate(c, type, NONE) == c.
    #[test]
    fn severity_zero_is_identity(
        r in 0u8..=255, g in 0u8..=255, b in 0u8..=255,
        cvd_idx in 0usize..4,
    ) {
        let c = Color::from_srgb8(r, g, b);
        let sim = simulate(c, ALL_CVD_TYPES[cvd_idx], Severity::NONE);
        prop_assert!((sim.r - c.r).abs() < 1e-12, "r differs");
        prop_assert!((sim.g - c.g).abs() < 1e-12, "g differs");
        prop_assert!((sim.b - c.b).abs() < 1e-12, "b differs");
    }

    /// Black stays black for all CVD types and severities.
    #[test]
    fn black_stays_black(
        cvd_idx in 0usize..4,
        sev in 0.0f64..=1.0,
    ) {
        let sim = simulate(Color::BLACK, ALL_CVD_TYPES[cvd_idx], Severity::new(sev));
        prop_assert!(sim.r.abs() < 1e-10, "r nonzero: {}", sim.r);
        prop_assert!(sim.g.abs() < 1e-10, "g nonzero: {}", sim.g);
        prop_assert!(sim.b.abs() < 1e-10, "b nonzero: {}", sim.b);
    }

    /// White stays approximately white for all CVD types and severities.
    #[test]
    fn white_stays_white(
        cvd_idx in 0usize..4,
        sev in 0.0f64..=1.0,
    ) {
        let sim = simulate(Color::WHITE, ALL_CVD_TYPES[cvd_idx], Severity::new(sev));
        prop_assert!((sim.r - 1.0).abs() < 0.02,
            "white r shifted: {}", sim.r);
        prop_assert!((sim.g - 1.0).abs() < 0.02,
            "white g shifted: {}", sim.g);
        prop_assert!((sim.b - 1.0).abs() < 0.02,
            "white b shifted: {}", sim.b);
    }

    /// Achromat simulation produces grayscale (r == g == b) at full severity.
    #[test]
    fn achromat_is_grayscale(
        r in 0u8..=255, g in 0u8..=255, b in 0u8..=255,
    ) {
        let c = Color::from_srgb8(r, g, b);
        let full = simulate(c, CvdType::Achromat, Severity::FULL);
        prop_assert!((full.r - full.g).abs() < 1e-10, "not grayscale: r={} g={}", full.r, full.g);
        prop_assert!((full.g - full.b).abs() < 1e-10, "not grayscale: g={} b={}", full.g, full.b);
    }

    /// Higher severity produces greater distance from original color (monotonicity).
    #[test]
    fn severity_monotonic(
        r in 0u8..=255, g in 0u8..=255, b in 0u8..=255,
        cvd_idx in 0usize..4,
        sev_lo in 0.0f64..=0.5,
        sev_hi in 0.5f64..=1.0,
    ) {
        let c = Color::from_srgb8(r, g, b);
        let cvd = ALL_CVD_TYPES[cvd_idx];
        let sim_lo = simulate(c, cvd, Severity::new(sev_lo));
        let sim_hi = simulate(c, cvd, Severity::new(sev_hi));

        // Distance from original
        let dist_lo = (sim_lo.r - c.r).powi(2)
            + (sim_lo.g - c.g).powi(2)
            + (sim_lo.b - c.b).powi(2);
        let dist_hi = (sim_hi.r - c.r).powi(2)
            + (sim_hi.g - c.g).powi(2)
            + (sim_hi.b - c.b).powi(2);

        // Higher severity should be at least as far from original (with tolerance)
        prop_assert!(dist_hi >= dist_lo - 1e-10,
            "monotonicity violated: dist_lo={dist_lo} dist_hi={dist_hi}");
    }

    /// Achromat simulation is perfectly idempotent (luminance projection).
    #[test]
    fn achromat_idempotent(
        r in 0u8..=255, g in 0u8..=255, b in 0u8..=255,
    ) {
        let c = Color::from_srgb8(r, g, b);
        let once = simulate(c, CvdType::Achromat, Severity::FULL);
        let twice = simulate(once, CvdType::Achromat, Severity::FULL);
        prop_assert!((once.r - twice.r).abs() < 1e-12);
        prop_assert!((once.g - twice.g).abs() < 1e-12);
        prop_assert!((once.b - twice.b).abs() < 1e-12);
    }

    /// Vienot achromat produces grayscale.
    #[test]
    fn vienot_achromat_is_grayscale(
        r in 0u8..=255, g in 0u8..=255, b in 0u8..=255,
    ) {
        let c = Color::from_srgb8(r, g, b);
        let sim = simulate_fast(c, CvdType::Achromat);
        prop_assert!((sim.r - sim.g).abs() < 1e-10);
        prop_assert!((sim.g - sim.b).abs() < 1e-10);
    }

    /// Vienot black stays black.
    #[test]
    fn vienot_black_stays_black(cvd_idx in 0usize..4) {
        let sim = simulate_fast(Color::BLACK, ALL_CVD_TYPES[cvd_idx]);
        prop_assert!(sim.r.abs() < 1e-10);
        prop_assert!(sim.g.abs() < 1e-10);
        prop_assert!(sim.b.abs() < 1e-10);
    }

    /// Vienot idempotent: simulate_fast(simulate_fast(c)) ~= simulate_fast(c).
    #[test]
    fn vienot_idempotent(
        r in 0u8..=255, g in 0u8..=255, b in 0u8..=255,
        cvd_idx in 0usize..3,
    ) {
        let c = Color::from_srgb8(r, g, b);
        let cvd = CVD_TYPES[cvd_idx];
        let once = simulate_fast(c, cvd);
        let twice = simulate_fast(once, cvd);
        prop_assert!((once.r - twice.r).abs() < 1e-4,
            "r not idempotent: {} vs {}", once.r, twice.r);
        prop_assert!((once.g - twice.g).abs() < 1e-4,
            "g not idempotent: {} vs {}", once.g, twice.g);
        prop_assert!((once.b - twice.b).abs() < 1e-4,
            "b not idempotent: {} vs {}", once.b, twice.b);
    }
}
