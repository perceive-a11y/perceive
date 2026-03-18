//! Finding types produced by WCAG checks.
//!
//! A [`Finding`] ties a specific accessibility issue to a source location
//! and WCAG criterion, with enough context for dashboards and reports.

use a11y_rules::Severity;
use serde::{Deserialize, Serialize};

/// A single accessibility issue found during a scan.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Finding {
    /// WCAG criterion ID, e.g. `"1.4.3"`.
    pub criterion_id: String,
    /// Impact severity.
    pub severity: Severity,
    /// CSS-like selector or element description, e.g. `"img.hero-banner"`.
    pub element: String,
    /// Theme file path where the issue was found.
    pub file_path: String,
    /// 1-based line number in the source file (approximate for Liquid files).
    pub line: usize,
    /// Human-readable description of the problem.
    pub message: String,
    /// Suggested fix (template-based, not AI-generated).
    pub suggestion: String,
}

/// Aggregated scan results for an entire theme.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ScanResult {
    /// All findings across all files.
    pub findings: Vec<Finding>,
    /// Number of files scanned.
    pub files_scanned: usize,
}

impl ScanResult {
    /// Count findings at or above the given severity threshold.
    #[must_use]
    pub fn count_at_severity(&self, min: Severity) -> usize {
        self.findings.iter().filter(|f| f.severity >= min).count()
    }

    /// Count findings for a specific WCAG criterion.
    #[must_use]
    pub fn count_for_criterion(&self, criterion_id: &str) -> usize {
        self.findings
            .iter()
            .filter(|f| f.criterion_id == criterion_id)
            .count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_finding(criterion_id: &str, severity: Severity) -> Finding {
        Finding {
            criterion_id: criterion_id.to_owned(),
            severity,
            element: "img".to_owned(),
            file_path: "templates/index.liquid".to_owned(),
            line: 10,
            message: "test".to_owned(),
            suggestion: "fix it".to_owned(),
        }
    }

    #[test]
    fn count_at_severity() {
        let result = ScanResult {
            findings: vec![
                sample_finding("1.1.1", Severity::Critical),
                sample_finding("2.4.4", Severity::Moderate),
                sample_finding("1.4.3", Severity::Serious),
            ],
            files_scanned: 1,
        };
        assert_eq!(result.count_at_severity(Severity::Serious), 2);
        assert_eq!(result.count_at_severity(Severity::Critical), 1);
        assert_eq!(result.count_at_severity(Severity::Minor), 3);
    }

    #[test]
    fn count_for_criterion() {
        let result = ScanResult {
            findings: vec![
                sample_finding("1.1.1", Severity::Critical),
                sample_finding("1.1.1", Severity::Critical),
                sample_finding("1.4.3", Severity::Serious),
            ],
            files_scanned: 1,
        };
        assert_eq!(result.count_for_criterion("1.1.1"), 2);
        assert_eq!(result.count_for_criterion("1.4.3"), 1);
        assert_eq!(result.count_for_criterion("9.9.9"), 0);
    }
}
