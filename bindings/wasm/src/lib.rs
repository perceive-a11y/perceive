use wasm_bindgen::prelude::*;

use perceive_color::{Color, linear_to_srgb, srgb_to_linear};
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
    let cvd = parse_cvd_type(cvd_type)?;
    let simulated = perceive_cvd::simulate(color, cvd, Severity::new(severity));
    Ok(simulated.to_hex())
}

/// Parse a CVD type string into the enum, returning an error on invalid input.
fn parse_cvd_type(cvd_type: &str) -> Result<CvdType, JsError> {
    match cvd_type {
        "protan" => Ok(CvdType::Protan),
        "deutan" => Ok(CvdType::Deutan),
        "tritan" => Ok(CvdType::Tritan),
        "achromat" => Ok(CvdType::Achromat),
        _ => Err(JsError::new(
            "invalid cvd_type: use protan, deutan, tritan, or achromat",
        )),
    }
}

/// Simulate CVD on raw RGBA pixel data from a canvas.
///
/// Processes pixels in bulk for performance. Uses a 256-entry lookup table
/// to avoid redundant sRGB-to-linear `powf` calls per channel.
/// Alpha channel is passed through unchanged.
///
/// # Arguments
///
/// * `data` - RGBA pixel bytes (length must be a multiple of 4)
/// * `cvd_type` - "protan", "deutan", "tritan", or "achromat"
/// * `severity` - 0.0 to 1.0
///
/// # Returns
///
/// New `Vec<u8>` with simulated RGBA pixel data.
#[wasm_bindgen]
pub fn simulate_image(data: &[u8], cvd_type: &str, severity: f64) -> Result<Vec<u8>, JsError> {
    let cvd = parse_cvd_type(cvd_type)?;
    let sev = Severity::new(severity);

    // Pre-compute sRGB -> linear lookup table (256 entries)
    let srgb_lut: Vec<f64> = (0..256)
        .map(|i| srgb_to_linear(f64::from(i as u8) / 255.0))
        .collect();

    // Pre-compute linear -> sRGB lookup is not practical (continuous),
    // but we can avoid allocation by writing into a pre-sized output buffer.
    let mut out = Vec::with_capacity(data.len());

    // Process 4 bytes at a time (RGBA)
    for chunk in data.chunks_exact(4) {
        let r_lin = srgb_lut[chunk[0] as usize];
        let g_lin = srgb_lut[chunk[1] as usize];
        let b_lin = srgb_lut[chunk[2] as usize];
        let alpha = chunk[3];

        let color = Color::new(r_lin, g_lin, b_lin);
        let sim = perceive_cvd::simulate(color, cvd, sev);

        out.push((linear_to_srgb(sim.r) * 255.0 + 0.5) as u8);
        out.push((linear_to_srgb(sim.g) * 255.0 + 0.5) as u8);
        out.push((linear_to_srgb(sim.b) * 255.0 + 0.5) as u8);
        out.push(alpha);
    }

    Ok(out)
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
