use proptest::prelude::*;

use perceive_color::{Color, linear_to_srgb, srgb_to_linear, wcag};

proptest! {
    #[test]
    fn srgb_roundtrip(v in 0u8..=255) {
        let srgb = f64::from(v) / 255.0;
        let linear = srgb_to_linear(srgb);
        let back = linear_to_srgb(linear);
        prop_assert!((srgb - back).abs() < 1e-10);
    }

    #[test]
    fn contrast_ratio_gte_one(
        r1 in 0u8..=255, g1 in 0u8..=255, b1 in 0u8..=255,
        r2 in 0u8..=255, g2 in 0u8..=255, b2 in 0u8..=255,
    ) {
        let c1 = Color::from_srgb8(r1, g1, b1);
        let c2 = Color::from_srgb8(r2, g2, b2);
        let ratio = wcag::contrast_ratio(c1, c2);
        prop_assert!(ratio >= 1.0, "ratio was {ratio}");
    }

    #[test]
    fn contrast_ratio_lte_21(
        r1 in 0u8..=255, g1 in 0u8..=255, b1 in 0u8..=255,
        r2 in 0u8..=255, g2 in 0u8..=255, b2 in 0u8..=255,
    ) {
        let c1 = Color::from_srgb8(r1, g1, b1);
        let c2 = Color::from_srgb8(r2, g2, b2);
        let ratio = wcag::contrast_ratio(c1, c2);
        prop_assert!(ratio <= 21.01, "ratio was {ratio}");
    }

    #[test]
    fn contrast_ratio_symmetric(
        r1 in 0u8..=255, g1 in 0u8..=255, b1 in 0u8..=255,
        r2 in 0u8..=255, g2 in 0u8..=255, b2 in 0u8..=255,
    ) {
        let c1 = Color::from_srgb8(r1, g1, b1);
        let c2 = Color::from_srgb8(r2, g2, b2);
        let r1 = wcag::contrast_ratio(c1, c2);
        let r2 = wcag::contrast_ratio(c2, c1);
        prop_assert!((r1 - r2).abs() < 1e-12);
    }

    #[test]
    fn color_srgb8_roundtrip(r in 0u8..=255, g in 0u8..=255, b in 0u8..=255) {
        let c = Color::from_srgb8(r, g, b);
        let (r2, g2, b2) = c.to_srgb8();
        prop_assert_eq!(r, r2, "red channel mismatch");
        prop_assert_eq!(g, g2, "green channel mismatch");
        prop_assert_eq!(b, b2, "blue channel mismatch");
    }

    #[test]
    fn oklch_roundtrip(r in 0u8..=255, g in 0u8..=255, b in 0u8..=255) {
        let c = Color::from_srgb8(r, g, b);
        let oklch = c.to_oklch();
        let back = Color::from_oklch(oklch);
        let (r2, g2, b2) = back.to_srgb8();
        // Allow ±1 for rounding
        prop_assert!((i16::from(r) - i16::from(r2)).abs() <= 1, "red: {r} vs {r2}");
        prop_assert!((i16::from(g) - i16::from(g2)).abs() <= 1, "green: {g} vs {g2}");
        prop_assert!((i16::from(b) - i16::from(b2)).abs() <= 1, "blue: {b} vs {b2}");
    }

    #[test]
    fn luminance_bounded(r in 0u8..=255, g in 0u8..=255, b in 0u8..=255) {
        let c = Color::from_srgb8(r, g, b);
        let l = wcag::relative_luminance(c);
        prop_assert!((0.0..=1.0).contains(&l), "luminance {l} out of bounds");
    }
}
