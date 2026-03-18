//! # a11y-rules
//!
//! WCAG 2.2 criteria catalog as Rust types. Provides criterion metadata,
//! conformance levels, severity classifications, and fix hints for use by
//! accessibility scanners and report generators.
//!
//! This crate is intentionally data-only: no I/O, no parsing, no side effects.
//! It serves as the shared vocabulary for the perceive-a11y platform.

use serde::{Deserialize, Serialize};

/// WCAG 2.2 conformance level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ConformanceLevel {
    /// Level A — minimum accessibility.
    A,
    /// Level AA — standard target for most regulations (ADA, EAA).
    AA,
    /// Level AAA — enhanced accessibility.
    AAA,
}

/// Impact severity of an accessibility finding.
///
/// Aligned with common audit tooling (axe-core, Lighthouse) so reports
/// are familiar to developers and auditors.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Severity {
    /// Informational or best-practice suggestion.
    Minor,
    /// Potential barrier for some users.
    Moderate,
    /// Likely barrier; fails a WCAG criterion.
    Serious,
    /// Definite barrier; content is inaccessible.
    Critical,
}

/// WCAG 2.2 organizing principle (POUR).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Principle {
    /// Content must be presentable in ways users can perceive.
    Perceivable,
    /// UI components and navigation must be operable.
    Operable,
    /// Information and UI operation must be understandable.
    Understandable,
    /// Content must be robust enough for assistive technologies.
    Robust,
}

/// A single WCAG 2.2 success criterion with metadata for scanners and reports.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Criterion {
    /// WCAG criterion identifier, e.g. `"1.4.3"`.
    pub id: &'static str,
    /// Human-readable name, e.g. `"Contrast (Minimum)"`.
    pub name: &'static str,
    /// Conformance level (A, AA, or AAA).
    pub level: ConformanceLevel,
    /// POUR principle this criterion belongs to.
    pub principle: Principle,
    /// Brief description of what the criterion requires.
    pub description: &'static str,
    /// Generic fix guidance shown in reports.
    pub how_to_fix: &'static str,
    /// Whether this criterion can be checked via static analysis
    /// (without a headless browser).
    pub static_checkable: bool,
}

/// Return all WCAG 2.2 criteria that are amenable to static analysis.
///
/// The returned slice is sorted by criterion ID. Each entry carries enough
/// metadata for a scanner to map findings to criteria and for a report
/// generator to produce actionable output.
#[must_use]
pub fn static_criteria() -> &'static [Criterion] {
    STATIC_CRITERIA
}

/// Look up a criterion by its WCAG ID (e.g. `"1.4.3"`).
///
/// Returns `None` if the ID is not in the static catalog.
#[must_use]
pub fn criterion_by_id(id: &str) -> Option<&'static Criterion> {
    STATIC_CRITERIA.iter().find(|c| c.id == id)
}

/// Map a criterion to a default severity for static-analysis findings.
///
/// This provides a sensible baseline; scanners may override per-finding.
#[must_use]
pub fn default_severity(criterion: &Criterion) -> Severity {
    match criterion.id {
        // Definite barriers: missing alt text, invalid ARIA
        "1.1.1" | "4.1.2" => Severity::Critical,
        // Likely barriers: heading structure, contrast, focus, lang, page title
        "1.3.1" | "1.4.3" | "2.4.7" | "3.1.1" | "2.4.2" => Severity::Serious,
        // Enhanced contrast is AAA — advisory
        "1.4.6" => Severity::Minor,
        // Everything else defaults to Moderate
        _ => Severity::Moderate,
    }
}

// ---------------------------------------------------------------------------
// Criterion catalog
// ---------------------------------------------------------------------------

// Sorted by lexicographic ID order (the test `criteria_ids_are_sorted` enforces this).
// Note: "2.4.10" sorts before "2.4.2" because '1' < '2'.
static STATIC_CRITERIA: &[Criterion] = &[
    Criterion {
        id: "1.1.1",
        name: "Non-text Content",
        level: ConformanceLevel::A,
        principle: Principle::Perceivable,
        description: "All non-text content has a text alternative that serves \
                      the equivalent purpose.",
        how_to_fix: "Add a descriptive `alt` attribute to every `<img>` element. \
                     Use `alt=\"\"` only for purely decorative images.",
        static_checkable: true,
    },
    Criterion {
        id: "1.3.1",
        name: "Info and Relationships",
        level: ConformanceLevel::A,
        principle: Principle::Perceivable,
        description: "Information, structure, and relationships conveyed through \
                      presentation can be programmatically determined.",
        how_to_fix: "Use semantic HTML: proper heading hierarchy (`<h1>`-`<h6>`), \
                     `<label>` elements for form inputs, and landmark regions.",
        static_checkable: true,
    },
    Criterion {
        id: "1.3.5",
        name: "Identify Input Purpose",
        level: ConformanceLevel::AA,
        principle: Principle::Perceivable,
        description: "The purpose of each input field collecting user information \
                      can be programmatically determined via `autocomplete` attributes.",
        how_to_fix: "Add appropriate `autocomplete` attribute values to form inputs \
                     collecting personal information (name, email, address, etc.).",
        static_checkable: true,
    },
    Criterion {
        id: "1.4.3",
        name: "Contrast (Minimum)",
        level: ConformanceLevel::AA,
        principle: Principle::Perceivable,
        description: "Text and images of text have a contrast ratio of at least \
                      4.5:1 (3:1 for large text).",
        how_to_fix: "Increase the contrast between text color and background color \
                     to meet the 4.5:1 ratio (3:1 for large text >= 18pt or 14pt bold).",
        static_checkable: true,
    },
    Criterion {
        id: "1.4.6",
        name: "Contrast (Enhanced)",
        level: ConformanceLevel::AAA,
        principle: Principle::Perceivable,
        description: "Text and images of text have a contrast ratio of at least \
                      7:1 (4.5:1 for large text).",
        how_to_fix: "Increase the contrast between text color and background color \
                     to meet the 7:1 ratio (4.5:1 for large text).",
        static_checkable: true,
    },
    Criterion {
        id: "2.4.1",
        name: "Bypass Blocks",
        level: ConformanceLevel::A,
        principle: Principle::Operable,
        description: "A mechanism is available to bypass blocks of content that \
                      are repeated on multiple web pages.",
        how_to_fix: "Add a 'skip to main content' link as the first focusable \
                     element on the page, linking to the main content area.",
        static_checkable: true,
    },
    Criterion {
        id: "2.4.10",
        name: "Section Headings",
        level: ConformanceLevel::AAA,
        principle: Principle::Operable,
        description: "Section headings are used to organize content.",
        how_to_fix: "Add headings (`<h2>`-`<h6>`) to organize page sections. \
                     Each major content area should have a descriptive heading.",
        static_checkable: true,
    },
    Criterion {
        id: "2.4.2",
        name: "Page Titled",
        level: ConformanceLevel::A,
        principle: Principle::Operable,
        description: "Web pages have titles that describe topic or purpose.",
        how_to_fix: "Add a descriptive `<title>` element inside `<head>` that \
                     clearly identifies the page content.",
        static_checkable: true,
    },
    Criterion {
        id: "2.4.4",
        name: "Link Purpose (In Context)",
        level: ConformanceLevel::A,
        principle: Principle::Operable,
        description: "The purpose of each link can be determined from the link text \
                      alone or from the link text together with its context.",
        how_to_fix: "Replace generic link text like 'click here' or 'read more' with \
                     descriptive text that explains the link destination.",
        static_checkable: true,
    },
    Criterion {
        id: "2.4.6",
        name: "Headings and Labels",
        level: ConformanceLevel::AA,
        principle: Principle::Operable,
        description: "Headings and labels describe topic or purpose.",
        how_to_fix: "Use descriptive, non-generic text for headings and labels \
                     that clearly conveys the content or function.",
        static_checkable: true,
    },
    Criterion {
        id: "2.4.7",
        name: "Focus Visible",
        level: ConformanceLevel::AA,
        principle: Principle::Operable,
        description: "Any keyboard-operable user interface has a mode of operation \
                      where the keyboard focus indicator is visible.",
        how_to_fix: "Do not remove the default focus outline (`outline: none`) without \
                     providing an alternative visible focus style.",
        static_checkable: true,
    },
    Criterion {
        id: "2.5.3",
        name: "Label in Name",
        level: ConformanceLevel::A,
        principle: Principle::Operable,
        description: "For UI components with visible text labels, the accessible \
                      name contains the visible label text.",
        how_to_fix: "Ensure `aria-label` includes the visible text of the element. \
                     If a button shows 'Search', its `aria-label` must contain 'Search'.",
        static_checkable: true,
    },
    Criterion {
        id: "2.5.5",
        name: "Target Size (Enhanced)",
        level: ConformanceLevel::AAA,
        principle: Principle::Operable,
        description: "Pointer input targets are at least 44x44 CSS pixels, with \
                      exceptions for inline links and user-agent defaults.",
        how_to_fix: "Increase interactive element size to at least 44x44 CSS pixels \
                     via width/height or padding for enhanced touch accessibility.",
        static_checkable: true,
    },
    Criterion {
        id: "2.5.8",
        name: "Target Size (Minimum)",
        level: ConformanceLevel::AA,
        principle: Principle::Operable,
        description: "Pointer input targets are at least 24x24 CSS pixels, with \
                      exceptions for inline links and user-agent defaults.",
        how_to_fix: "Ensure interactive elements (buttons, links used as buttons) have \
                     a minimum size of 24x24 CSS pixels via width/height or padding.",
        static_checkable: true,
    },
    Criterion {
        id: "3.1.1",
        name: "Language of Page",
        level: ConformanceLevel::A,
        principle: Principle::Understandable,
        description: "The default human language of each web page can be \
                      programmatically determined.",
        how_to_fix: "Add a `lang` attribute to the `<html>` element (e.g. `<html lang=\"en\">`).",
        static_checkable: true,
    },
    Criterion {
        id: "3.3.2",
        name: "Labels or Instructions",
        level: ConformanceLevel::A,
        principle: Principle::Understandable,
        description: "Labels or instructions are provided when content requires \
                      user input.",
        how_to_fix: "Provide visible labels for all form inputs. Use `<label>` \
                     elements associated via `for`/`id` attributes.",
        static_checkable: true,
    },
    // SC 4.1.1 Parsing was removed from WCAG 2.2 as obsolete.
    Criterion {
        id: "4.1.2",
        name: "Name, Role, Value",
        level: ConformanceLevel::A,
        principle: Principle::Robust,
        description: "For all user interface components, the name and role can be \
                      programmatically determined; states, properties, and values \
                      can be programmatically set.",
        how_to_fix: "Use valid ARIA roles and attributes. Ensure interactive elements \
                     have accessible names via `aria-label`, `aria-labelledby`, or \
                     associated `<label>` elements.",
        static_checkable: true,
    },
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn static_criteria_not_empty() {
        assert!(!static_criteria().is_empty());
    }

    #[test]
    fn all_criteria_are_static_checkable() {
        for c in static_criteria() {
            assert!(
                c.static_checkable,
                "criterion {} should be static_checkable",
                c.id
            );
        }
    }

    #[test]
    fn lookup_by_id() {
        let c = criterion_by_id("1.4.3").expect("1.4.3 should exist");
        assert_eq!(c.name, "Contrast (Minimum)");
        assert_eq!(c.level, ConformanceLevel::AA);
        assert_eq!(c.principle, Principle::Perceivable);
    }

    #[test]
    fn lookup_missing_returns_none() {
        assert!(criterion_by_id("99.99.99").is_none());
    }

    #[test]
    fn default_severities_are_assigned() {
        let c = criterion_by_id("1.1.1").unwrap();
        assert_eq!(default_severity(c), Severity::Critical);

        let c = criterion_by_id("1.4.6").unwrap();
        assert_eq!(default_severity(c), Severity::Minor);
    }

    #[test]
    fn severity_ordering() {
        assert!(Severity::Minor < Severity::Moderate);
        assert!(Severity::Moderate < Severity::Serious);
        assert!(Severity::Serious < Severity::Critical);
    }

    #[test]
    fn criteria_ids_are_sorted() {
        let ids: Vec<&str> = static_criteria().iter().map(|c| c.id).collect();
        let mut sorted = ids.clone();
        sorted.sort();
        assert_eq!(ids, sorted, "criteria should be sorted by ID");
    }

    #[test]
    fn no_duplicate_ids() {
        let ids: Vec<&str> = static_criteria().iter().map(|c| c.id).collect();
        let mut deduped = ids.clone();
        deduped.dedup();
        assert_eq!(ids, deduped, "criteria IDs must be unique");
    }

    #[test]
    fn serialization() {
        let c = criterion_by_id("1.4.3").unwrap();
        let json = serde_json::to_string(c).expect("should serialize");
        // Verify the JSON contains expected fields
        assert!(json.contains("\"id\":\"1.4.3\""));
        assert!(json.contains("\"name\":\"Contrast (Minimum)\""));
        assert!(json.contains("\"level\":\"AA\""));
    }
}
