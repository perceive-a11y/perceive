/// Type of color vision deficiency.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[non_exhaustive]
pub enum CvdType {
    /// Red-blind (L-cone deficiency).
    Protan,
    /// Green-blind (M-cone deficiency).
    Deutan,
    /// Blue-blind (S-cone deficiency).
    Tritan,
    /// Total color blindness (achromatopsia).
    Achromat,
}

/// Severity of color vision deficiency [0, 1].
///
/// 0.0 = normal vision, 1.0 = complete dichromacy.
#[derive(Debug, Clone, Copy, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Severity(f64);

impl Severity {
    /// Create a new severity value, clamped to [0, 1].
    #[must_use]
    pub fn new(value: f64) -> Self {
        Self(value.clamp(0.0, 1.0))
    }

    /// Get the severity value.
    #[must_use]
    pub fn value(self) -> f64 {
        self.0
    }

    /// Full severity (complete dichromacy).
    pub const FULL: Self = Self(1.0);

    /// No deficiency (normal vision).
    pub const NONE: Self = Self(0.0);
}

impl Default for Severity {
    fn default() -> Self {
        Self::FULL
    }
}
