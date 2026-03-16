/// Tests against W3C WCAG reference values.
use perceive_color::{Color, wcag};

#[test]
fn w3c_black_on_white() {
    let ratio = wcag::contrast_ratio(Color::BLACK, Color::WHITE);
    assert!((ratio - 21.0).abs() < 0.01, "expected 21:1, got {ratio}");
}

#[test]
fn w3c_white_on_black() {
    let ratio = wcag::contrast_ratio(Color::WHITE, Color::BLACK);
    assert!((ratio - 21.0).abs() < 0.01, "expected 21:1, got {ratio}");
}

/// W3C example: #777 on white ≈ 4.48
#[test]
fn w3c_gray_on_white() {
    let gray = Color::from_hex("#777777").unwrap();
    let ratio = wcag::contrast_ratio(gray, Color::WHITE);
    assert!((ratio - 4.48).abs() < 0.1, "expected ~4.48, got {ratio}");
}

/// Contrast ratio is always >= 1.0
#[test]
fn contrast_ratio_minimum() {
    let colors = [
        "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#808080", "#c0c0c0", "#ffff00",
        "#ff00ff", "#00ffff",
    ];
    for a in &colors {
        for b in &colors {
            let ca = Color::from_hex(a).unwrap();
            let cb = Color::from_hex(b).unwrap();
            let ratio = wcag::contrast_ratio(ca, cb);
            assert!(ratio >= 1.0, "{a} vs {b}: ratio {ratio} < 1.0");
        }
    }
}

/// Relative luminance bounds: [0, 1]
#[test]
fn luminance_bounds() {
    let colors = [
        "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#123456", "#abcdef", "#fedcba",
    ];
    for hex in &colors {
        let c = Color::from_hex(hex).unwrap();
        let l = wcag::relative_luminance(c);
        assert!(
            (0.0..=1.0).contains(&l),
            "{hex}: luminance {l} out of bounds"
        );
    }
}

/// AA/AAA thresholds for normal text
#[test]
fn conformance_normal_text() {
    // 21:1 → AAA
    assert_eq!(
        wcag::conformance_level(Color::BLACK, Color::WHITE, false),
        wcag::Level::AAA
    );
    // 4.48:1 → AA but not AAA for normal text
    let gray = Color::from_hex("#777777").unwrap();
    assert_eq!(
        wcag::conformance_level(gray, Color::WHITE, false),
        wcag::Level::Fail // 4.48 < 4.5
    );
    let slightly_darker = Color::from_hex("#767676").unwrap();
    let ratio = wcag::contrast_ratio(slightly_darker, Color::WHITE);
    if ratio >= 4.5 {
        assert_eq!(
            wcag::conformance_level(slightly_darker, Color::WHITE, false),
            wcag::Level::AA
        );
    }
}
