use wasm_bindgen::prelude::*;

use perceive_color::Color;
use perceive_cvd::{CvdType, Severity};

/// Compute WCAG 2.x contrast ratio between two hex colors.
#[wasm_bindgen]
pub fn wcag_contrast(fg_hex: &str, bg_hex: &str) -> Result<f64, JsError> {
    let fg = Color::from_hex(fg_hex).ok_or_else(|| JsError::new("invalid fg hex color"))?;
    let bg = Color::from_hex(bg_hex).ok_or_else(|| JsError::new("invalid bg hex color"))?;
    Ok(perceive_color::wcag::contrast_ratio(fg, bg))
}

/// Check if two colors meet WCAG 2.2 AA contrast requirements.
#[wasm_bindgen]
pub fn check_aa(fg_hex: &str, bg_hex: &str, large_text: bool) -> Result<bool, JsError> {
    let fg = Color::from_hex(fg_hex).ok_or_else(|| JsError::new("invalid fg hex color"))?;
    let bg = Color::from_hex(bg_hex).ok_or_else(|| JsError::new("invalid bg hex color"))?;
    Ok(perceive_color::wcag::meets_aa(fg, bg, large_text))
}

/// Compute APCA lightness contrast between text and background.
#[wasm_bindgen]
pub fn apca_contrast(text_hex: &str, bg_hex: &str) -> Result<f64, JsError> {
    let text = Color::from_hex(text_hex).ok_or_else(|| JsError::new("invalid text hex color"))?;
    let bg = Color::from_hex(bg_hex).ok_or_else(|| JsError::new("invalid bg hex color"))?;
    Ok(perceive_color::apca::apca_contrast(text, bg))
}

/// Simulate color vision deficiency on a hex color.
///
/// `cvd_type`: "protan", "deutan", "tritan", or "achromat"
/// `severity`: 0.0–1.0
#[wasm_bindgen]
pub fn simulate_cvd(hex: &str, cvd_type: &str, severity: f64) -> Result<String, JsError> {
    let color = Color::from_hex(hex).ok_or_else(|| JsError::new("invalid hex color"))?;
    let cvd = match cvd_type {
        "protan" => CvdType::Protan,
        "deutan" => CvdType::Deutan,
        "tritan" => CvdType::Tritan,
        "achromat" => CvdType::Achromat,
        _ => {
            return Err(JsError::new(
                "invalid cvd_type: use protan, deutan, tritan, or achromat",
            ));
        }
    };
    let simulated = perceive_cvd::simulate(color, cvd, Severity::new(severity));
    Ok(simulated.to_hex())
}

/// Generate an accessible palette from a base hex color.
///
/// Returns an array of hex color strings.
#[wasm_bindgen]
pub fn generate_palette(base_hex: &str, steps: usize) -> Result<Vec<String>, JsError> {
    let base = Color::from_hex(base_hex).ok_or_else(|| JsError::new("invalid hex color"))?;
    let palette = perceive_color::palette::generate_palette(base, steps);
    Ok(palette
        .into_iter()
        .map(perceive_color::Color::to_hex)
        .collect())
}
