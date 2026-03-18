//! napi-rs bindings for the Shopify accessibility scanner.
//!
//! Exposes the Rust scanning engine to Node.js as a native addon.
//! The Shopify Remix app calls these functions to perform WCAG analysis
//! on theme files fetched via the Admin API.

use napi_derive::napi;
use shopify_auditor_scanner::findings::ScanResult;
use shopify_auditor_scanner::pipeline;

/// A theme file passed from Node.js to the scanner.
#[napi(object)]
pub struct ThemeFile {
    /// Relative path within the theme, e.g. `"templates/index.liquid"`.
    pub filename: String,
    /// Raw file contents.
    pub content: String,
}

/// A single accessibility finding returned to Node.js.
#[napi(object)]
pub struct JsFinding {
    /// WCAG criterion ID, e.g. `"1.4.3"`.
    pub criterion_id: String,
    /// Severity: `"critical"`, `"serious"`, `"moderate"`, or `"minor"`.
    pub severity: String,
    /// CSS-like selector or element description.
    pub element: String,
    /// Theme file path where the issue was found.
    pub file_path: String,
    /// 1-based line number.
    pub line: u32,
    /// Human-readable description of the problem.
    pub message: String,
    /// Suggested fix.
    pub suggestion: String,
    /// WCAG criterion name (looked up from a11y-rules).
    pub criterion_name: String,
    /// Fix guidance from the criterion catalog.
    pub how_to_fix: String,
}

/// Aggregated scan result returned to Node.js.
#[napi(object)]
pub struct JsScanResult {
    /// All findings across all files.
    pub findings: Vec<JsFinding>,
    /// Number of files scanned.
    pub files_scanned: u32,
    /// Count of critical-severity findings.
    pub critical_count: u32,
    /// Count of serious-severity findings.
    pub serious_count: u32,
    /// Count of moderate-severity findings.
    pub moderate_count: u32,
    /// Count of minor-severity findings.
    pub minor_count: u32,
}

/// Scan a Shopify theme for WCAG 2.2 accessibility issues.
///
/// Takes an array of theme files (filename + content) and returns
/// all findings with severity, WCAG criterion metadata, and fix suggestions.
#[napi]
#[allow(clippy::must_use_candidate, clippy::needless_pass_by_value)]
pub fn scan_theme(files: Vec<ThemeFile>) -> JsScanResult {
    let theme_files: Vec<pipeline::ThemeFile> = files
        .into_iter()
        .map(|f| pipeline::ThemeFile {
            path: f.filename,
            content: f.content,
        })
        .collect();

    let result = pipeline::scan_theme(&theme_files);
    convert_result(&result)
}

/// Check the contrast ratio between two hex colors.
///
/// Returns the WCAG 2.x contrast ratio (1.0 to 21.0).
/// Useful for the dashboard to show live contrast previews.
#[napi]
#[allow(clippy::must_use_candidate, clippy::needless_pass_by_value)]
pub fn check_contrast(fg_hex: String, bg_hex: String) -> f64 {
    let fg = perceive_color::Color::from_hex(&fg_hex).unwrap_or(perceive_color::Color::BLACK);
    let bg = perceive_color::Color::from_hex(&bg_hex).unwrap_or(perceive_color::Color::WHITE);
    perceive_color::wcag::contrast_ratio(fg, bg)
}

/// Convert internal scan result to the napi-compatible JS types.
fn convert_result(result: &ScanResult) -> JsScanResult {
    let findings: Vec<JsFinding> = result
        .findings
        .iter()
        .map(|f| {
            let criterion = a11y_rules::criterion_by_id(&f.criterion_id);
            JsFinding {
                criterion_id: f.criterion_id.clone(),
                severity: severity_str(f.severity),
                element: f.element.clone(),
                file_path: f.file_path.clone(),
                line: u32::try_from(f.line).unwrap_or(0),
                message: f.message.clone(),
                suggestion: f.suggestion.clone(),
                criterion_name: criterion.map_or_else(String::new, |c| c.name.to_owned()),
                how_to_fix: criterion.map_or_else(String::new, |c| c.how_to_fix.to_owned()),
            }
        })
        .collect();

    JsScanResult {
        findings,
        files_scanned: u32::try_from(result.files_scanned).unwrap_or(0),
        critical_count: count_severity(result, a11y_rules::Severity::Critical),
        serious_count: count_severity(result, a11y_rules::Severity::Serious),
        moderate_count: count_severity(result, a11y_rules::Severity::Moderate),
        minor_count: count_severity(result, a11y_rules::Severity::Minor),
    }
}

/// Count findings at an exact severity level.
fn count_severity(result: &ScanResult, severity: a11y_rules::Severity) -> u32 {
    u32::try_from(
        result
            .findings
            .iter()
            .filter(|f| f.severity == severity)
            .count(),
    )
    .unwrap_or(0)
}

/// Convert severity enum to a lowercase string for JS.
fn severity_str(severity: a11y_rules::Severity) -> String {
    match severity {
        a11y_rules::Severity::Critical => "critical",
        a11y_rules::Severity::Serious => "serious",
        a11y_rules::Severity::Moderate => "moderate",
        a11y_rules::Severity::Minor => "minor",
    }
    .to_owned()
}
