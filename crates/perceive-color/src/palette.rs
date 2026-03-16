use crate::color::Color;
use crate::oklch::{Oklch, gamut_map};
use crate::wcag::contrast_ratio;

/// Generate an accessible palette of `steps` colors from a base color.
///
/// Produces a lightness ramp in OKLCH space, keeping the hue and chroma
/// of the base color (chroma is gamut-mapped as needed). Useful for
/// generating tonal scales (50, 100, 200, …, 900) from a brand color.
#[must_use]
pub fn generate_palette(base: Color, steps: usize) -> Vec<Color> {
    if steps == 0 {
        return Vec::new();
    }
    if steps == 1 {
        return vec![base];
    }

    let oklch = base.to_oklch();
    let mut colors = Vec::with_capacity(steps);

    for i in 0..steps {
        let t = f64::from(i as u32) / f64::from((steps - 1) as u32);
        // Lightness ramp from 0.97 (lightest) to 0.25 (darkest)
        let l = 0.97 - t * 0.72;
        let candidate = Oklch {
            l,
            c: oklch.c,
            h: oklch.h,
        };
        let mapped = gamut_map(candidate);
        colors.push(Color::from_oklch(mapped));
    }

    colors
}

/// Compute the contrast ratio matrix for a set of colors.
///
/// Returns a flat `Vec` of length `colors.len()²` in row-major order.
/// `matrix[i * n + j]` is the contrast ratio between color `i` and color `j`.
#[must_use]
pub fn contrast_matrix(colors: &[Color]) -> Vec<f64> {
    let n = colors.len();
    let mut matrix = vec![0.0; n * n];
    for i in 0..n {
        for j in 0..n {
            matrix[i * n + j] = contrast_ratio(colors[i], colors[j]);
        }
    }
    matrix
}

/// Find a pair of colors from the set that meets the target contrast ratio.
///
/// Returns the first pair `(i, j)` where `i < j` and the contrast ratio
/// is at least `min_ratio`, or `None` if no such pair exists.
#[must_use]
pub fn find_accessible_pair(colors: &[Color], min_ratio: f64) -> Option<(usize, usize)> {
    let n = colors.len();
    for i in 0..n {
        for j in (i + 1)..n {
            if contrast_ratio(colors[i], colors[j]) >= min_ratio {
                return Some((i, j));
            }
        }
    }
    None
}

/// Suggest an accessible foreground color for a given background.
///
/// Adjusts the lightness of `fg` in OKLCH space until the pair meets
/// the `target_ratio` (default: 4.5 for AA normal text). Returns the
/// adjusted foreground, or `None` if no adjustment works.
#[must_use]
pub fn suggest_foreground(fg: Color, bg: Color, target_ratio: f64) -> Option<Color> {
    if contrast_ratio(fg, bg) >= target_ratio {
        return Some(fg);
    }

    let fg_oklch = fg.to_oklch();
    let bg_lum = crate::wcag::relative_luminance(bg);

    // Determine direction: if bg is light, go darker; if dark, go lighter
    let go_lighter = bg_lum < 0.5;

    let mut best: Option<Color> = None;
    for step in 0..=100 {
        let t = f64::from(step) / 100.0;
        let l = if go_lighter {
            fg_oklch.l + (1.0 - fg_oklch.l) * t
        } else {
            fg_oklch.l * (1.0 - t)
        };
        let candidate_oklch = gamut_map(Oklch {
            l,
            c: fg_oklch.c,
            h: fg_oklch.h,
        });
        let candidate = Color::from_oklch(candidate_oklch);
        if contrast_ratio(candidate, bg) >= target_ratio {
            best = Some(candidate);
            break;
        }
    }

    best
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn palette_step_count() {
        let base = Color::from_hex("#3366cc").unwrap();
        let palette = generate_palette(base, 10);
        assert_eq!(palette.len(), 10);
    }

    #[test]
    fn palette_single() {
        let base = Color::from_hex("#ff0000").unwrap();
        let palette = generate_palette(base, 1);
        assert_eq!(palette.len(), 1);
    }

    #[test]
    fn palette_empty() {
        let palette = generate_palette(Color::BLACK, 0);
        assert!(palette.is_empty());
    }

    #[test]
    fn palette_lightness_decreasing() {
        let base = Color::from_hex("#3366cc").unwrap();
        let palette = generate_palette(base, 10);
        // First color should be lighter than last
        let first_oklch = palette[0].to_oklch();
        let last_oklch = palette[9].to_oklch();
        assert!(first_oklch.l > last_oklch.l);
    }

    #[test]
    fn contrast_matrix_diagonal_is_one() {
        let colors = vec![
            Color::from_hex("#000000").unwrap(),
            Color::from_hex("#ffffff").unwrap(),
            Color::from_hex("#ff0000").unwrap(),
        ];
        let matrix = contrast_matrix(&colors);
        let n = colors.len();
        for i in 0..n {
            assert!((matrix[i * n + i] - 1.0).abs() < 0.01);
        }
    }

    #[test]
    fn contrast_matrix_symmetry() {
        let colors = vec![
            Color::from_hex("#000000").unwrap(),
            Color::from_hex("#ffffff").unwrap(),
        ];
        let matrix = contrast_matrix(&colors);
        assert!((matrix[1] - matrix[2]).abs() < 1e-12);
    }

    #[test]
    fn find_accessible_pair_black_white() {
        let colors = vec![Color::BLACK, Color::WHITE];
        let pair = find_accessible_pair(&colors, 4.5);
        assert_eq!(pair, Some((0, 1)));
    }

    #[test]
    fn find_accessible_pair_none() {
        let c1 = Color::from_hex("#777777").unwrap();
        let c2 = Color::from_hex("#888888").unwrap();
        let pair = find_accessible_pair(&[c1, c2], 4.5);
        assert!(pair.is_none());
    }

    #[test]
    fn suggest_foreground_already_passing() {
        let fg = Color::BLACK;
        let bg = Color::WHITE;
        let result = suggest_foreground(fg, bg, 4.5).unwrap();
        // Should return the original since it already passes
        assert!((result.r - fg.r).abs() < 1e-6);
    }

    #[test]
    fn suggest_foreground_adjustment() {
        let fg = Color::from_hex("#cccccc").unwrap();
        let bg = Color::WHITE;
        // This pair doesn't meet 4.5:1, so it should adjust
        let result = suggest_foreground(fg, bg, 4.5);
        if let Some(adjusted) = result {
            assert!(contrast_ratio(adjusted, bg) >= 4.5);
        }
    }
}
