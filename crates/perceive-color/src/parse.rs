#[cfg(feature = "std")]
use crate::Color;

#[cfg(feature = "std")]
impl core::str::FromStr for Color {
    type Err = ParseColorError;

    /// Parse a color from a string.
    ///
    /// Supported formats:
    /// - Hex: `#rgb`, `#rrggbb`, `rgb`, `rrggbb`
    /// - `rgb(r, g, b)` with values 0–255 or percentages
    /// - `hsl(h, s%, l%)` with h in degrees, s/l as percentages
    /// - CSS named colors (Level 4): `red`, `cornflowerblue`, etc.
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.trim().to_lowercase();

        // Try hex
        if s.starts_with('#')
            || s.chars().all(|c| c.is_ascii_hexdigit()) && (s.len() == 3 || s.len() == 6)
        {
            return Color::from_hex(&s).ok_or(ParseColorError::InvalidHex);
        }

        // Try rgb()
        if let Some(inner) = s.strip_prefix("rgb(").and_then(|s| s.strip_suffix(')')) {
            return parse_rgb(inner);
        }

        // Try hsl()
        if let Some(inner) = s.strip_prefix("hsl(").and_then(|s| s.strip_suffix(')')) {
            return parse_hsl(inner);
        }

        // Try named colors
        if let Some(color) = named_color(&s) {
            return Ok(color);
        }

        Err(ParseColorError::Unknown)
    }
}

/// Error type for color parsing.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum ParseColorError {
    InvalidHex,
    InvalidRgb,
    InvalidHsl,
    Unknown,
}

#[cfg(feature = "std")]
impl core::fmt::Display for ParseColorError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::InvalidHex => write!(f, "invalid hex color"),
            Self::InvalidRgb => write!(f, "invalid rgb() color"),
            Self::InvalidHsl => write!(f, "invalid hsl() color"),
            Self::Unknown => write!(f, "unrecognized color format"),
        }
    }
}

#[cfg(feature = "std")]
fn parse_rgb(inner: &str) -> Result<Color, ParseColorError> {
    let parts: Vec<&str> = inner.split(',').map(str::trim).collect();
    if parts.len() != 3 {
        return Err(ParseColorError::InvalidRgb);
    }

    let parse_component = |s: &str| -> Result<f64, ParseColorError> {
        if let Some(pct) = s.strip_suffix('%') {
            let v: f64 = pct
                .trim()
                .parse()
                .map_err(|_| ParseColorError::InvalidRgb)?;
            Ok(v / 100.0)
        } else {
            let v: f64 = s.parse().map_err(|_| ParseColorError::InvalidRgb)?;
            Ok(v / 255.0)
        }
    };

    let r = parse_component(parts[0])?;
    let g = parse_component(parts[1])?;
    let b = parse_component(parts[2])?;

    Ok(Color::from_srgb(r, g, b))
}

#[cfg(feature = "std")]
fn parse_hsl(inner: &str) -> Result<Color, ParseColorError> {
    let parts: Vec<&str> = inner.split(',').map(str::trim).collect();
    if parts.len() != 3 {
        return Err(ParseColorError::InvalidHsl);
    }

    let h: f64 = parts[0].parse().map_err(|_| ParseColorError::InvalidHsl)?;
    let s: f64 = parts[1]
        .strip_suffix('%')
        .unwrap_or(parts[1])
        .trim()
        .parse::<f64>()
        .map_err(|_| ParseColorError::InvalidHsl)?
        / 100.0;
    let l: f64 = parts[2]
        .strip_suffix('%')
        .unwrap_or(parts[2])
        .trim()
        .parse::<f64>()
        .map_err(|_| ParseColorError::InvalidHsl)?
        / 100.0;

    // HSL to sRGB conversion
    let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
    let h_prime = (h / 60.0) % 6.0;
    let x = c * (1.0 - (h_prime % 2.0 - 1.0).abs());
    let m = l - c / 2.0;

    let (r1, g1, b1) = if h_prime < 1.0 {
        (c, x, 0.0)
    } else if h_prime < 2.0 {
        (x, c, 0.0)
    } else if h_prime < 3.0 {
        (0.0, c, x)
    } else if h_prime < 4.0 {
        (0.0, x, c)
    } else if h_prime < 5.0 {
        (x, 0.0, c)
    } else {
        (c, 0.0, x)
    };

    Ok(Color::from_srgb(r1 + m, g1 + m, b1 + m))
}

#[cfg(feature = "std")]
fn named_color(name: &str) -> Option<Color> {
    let hex = match name {
        "black" => "000000",
        "white" => "ffffff",
        "red" => "ff0000",
        "green" => "008000",
        "blue" => "0000ff",
        "yellow" => "ffff00",
        "cyan" | "aqua" => "00ffff",
        "magenta" | "fuchsia" => "ff00ff",
        "silver" => "c0c0c0",
        "gray" | "grey" => "808080",
        "maroon" => "800000",
        "olive" => "808000",
        "lime" => "00ff00",
        "teal" => "008080",
        "navy" => "000080",
        "purple" => "800080",
        "orange" => "ffa500",
        "pink" => "ffc0cb",
        "coral" => "ff7f50",
        "tomato" => "ff6347",
        "gold" => "ffd700",
        "indigo" => "4b0082",
        "violet" => "ee82ee",
        "turquoise" => "40e0d0",
        "salmon" => "fa8072",
        "khaki" => "f0e68c",
        "plum" => "dda0dd",
        "orchid" => "da70d6",
        "tan" => "d2b48c",
        "chocolate" => "d2691e",
        "sienna" => "a0522d",
        "peru" => "cd853f",
        "crimson" => "dc143c",
        "cornflowerblue" => "6495ed",
        "dodgerblue" => "1e90ff",
        "steelblue" => "4682b4",
        "slategray" | "slategrey" => "708090",
        "darkslategray" | "darkslategrey" => "2f4f4f",
        "midnightblue" => "191970",
        "rebeccapurple" => "663399",
        _ => return None,
    };
    Color::from_hex(hex)
}

#[cfg(all(test, feature = "std"))]
mod tests {
    use crate::Color;

    #[test]
    fn parse_hex_hash() {
        let c: Color = "#ff0000".parse().unwrap();
        assert_eq!(c.to_srgb8(), (255, 0, 0));
    }

    #[test]
    fn parse_hex_short() {
        let c: Color = "#f00".parse().unwrap();
        assert_eq!(c.to_srgb8(), (255, 0, 0));
    }

    #[test]
    fn parse_rgb_integers() {
        let c: Color = "rgb(255, 128, 0)".parse().unwrap();
        let (r, g, b) = c.to_srgb8();
        assert_eq!(r, 255);
        assert_eq!(g, 128);
        assert_eq!(b, 0);
    }

    #[test]
    fn parse_rgb_percentages() {
        let c: Color = "rgb(100%, 50%, 0%)".parse().unwrap();
        let (r, g, b) = c.to_srgb8();
        assert_eq!(r, 255);
        assert!((i16::from(g) - 128).abs() <= 1);
        assert_eq!(b, 0);
    }

    #[test]
    fn parse_hsl() {
        let c: Color = "hsl(0, 100%, 50%)".parse().unwrap();
        let (r, g, b) = c.to_srgb8();
        assert_eq!(r, 255);
        assert!(g <= 1);
        assert!(b <= 1);
    }

    #[test]
    fn parse_named() {
        let c: Color = "cornflowerblue".parse().unwrap();
        assert_eq!(c.to_srgb8(), (100, 149, 237));
    }

    #[test]
    fn parse_case_insensitive() {
        let c: Color = "RED".parse().unwrap();
        assert_eq!(c.to_srgb8(), (255, 0, 0));
    }

    #[test]
    fn parse_unknown_fails() {
        let result: Result<Color, _> = "notacolor".parse();
        assert!(result.is_err());
    }
}
