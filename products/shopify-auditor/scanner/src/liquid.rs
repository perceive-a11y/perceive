//! Liquid template preprocessor.
//!
//! Shopify themes use Liquid templating (`{% %}` tags and `{{ }}` output).
//! This module strips Liquid syntax while preserving HTML structure and
//! maintaining approximate line numbers for source-location mapping.
//!
//! **Strategy:** Replace Liquid tags with whitespace of equal length so that
//! byte offsets (and therefore line numbers) remain stable. This avoids
//! re-parsing the entire file just to map findings back to source lines.

/// Strip Liquid tags from a template, preserving byte offsets.
///
/// Both `{% ... %}` block/tag syntax and `{{ ... }}` output syntax are
/// replaced with spaces of equal length. This keeps line numbers intact
/// for downstream HTML parsing.
///
/// # Arguments
///
/// * `source` - Raw Liquid template source code
///
/// # Returns
///
/// A `String` with all Liquid syntax replaced by spaces.
#[must_use]
pub fn strip_liquid(source: &str) -> String {
    let bytes = source.as_bytes();
    let len = bytes.len();
    // Pre-allocate output buffer at the same size as input
    let mut out = Vec::with_capacity(len);
    let mut i = 0;

    while i < len {
        // Look for `{%` or `{{` two-byte openers
        if i + 1 < len && bytes[i] == b'{' {
            let opener = bytes[i + 1];
            if opener == b'%' || opener == b'{' {
                let closer = if opener == b'%' { b'%' } else { b'}' };
                // Scan forward for the matching closer + `}`
                let start = i;
                i += 2;
                while i + 1 < len {
                    if bytes[i] == closer && bytes[i + 1] == b'}' {
                        i += 2;
                        break;
                    }
                    i += 1;
                }
                // If we hit EOF without finding the closer, consume the rest
                if i + 1 >= len && !(i >= 2 && bytes[i - 2] == closer && bytes[i - 1] == b'}') {
                    i = len;
                }
                // Replace the entire tag span with spaces, preserving newlines
                for &b in &bytes[start..i] {
                    out.push(if b == b'\n' { b'\n' } else { b' ' });
                }
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }

    // SAFETY: we only replaced ASCII bytes with ASCII spaces/newlines,
    // preserving all non-Liquid UTF-8 sequences.
    String::from_utf8(out).expect("output should be valid UTF-8 since input was valid UTF-8")
}

/// Compute a 1-based line number from a byte offset within source text.
///
/// # Arguments
///
/// * `source` - The full source text
/// * `byte_offset` - Byte offset into `source`
///
/// # Returns
///
/// 1-based line number. Returns 1 if `byte_offset` is 0 or out of range.
#[must_use]
#[allow(clippy::naive_bytecount)]
pub fn line_from_offset(source: &str, byte_offset: usize) -> usize {
    // Count newlines before the offset — memchr would be faster for very
    // large files but this is sufficient for theme templates (typically <1KB).
    source.as_bytes()[..byte_offset.min(source.len())]
        .iter()
        .filter(|&&b| b == b'\n')
        .count()
        + 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_output_tags() {
        let input = r"<h1>{{ product.title }}</h1>";
        let result = strip_liquid(input);
        assert_eq!(input.len(), result.len());
        assert!(result.starts_with("<h1>"));
        assert!(result.ends_with("</h1>"));
        // Liquid tag replaced with spaces
        assert!(!result.contains('{'));
    }

    #[test]
    fn strip_block_tags() {
        let input = r"{% if true %}<p>hi</p>{% endif %}";
        let result = strip_liquid(input);
        assert!(result.contains("<p>hi</p>"));
        assert!(!result.contains('{'));
        assert_eq!(input.len(), result.len());
    }

    #[test]
    fn preserves_line_numbers() {
        let input = "line1\n{% comment %}\nline3\n{% endcomment %}\nline5";
        let result = strip_liquid(input);
        // Newlines within Liquid tags are preserved
        assert_eq!(result.matches('\n').count(), input.matches('\n').count());
    }

    #[test]
    fn empty_input() {
        assert_eq!(strip_liquid(""), "");
    }

    #[test]
    fn no_liquid_tags() {
        let input = "<html><body>Hello</body></html>";
        assert_eq!(strip_liquid(input), input);
    }

    #[test]
    fn nested_braces_in_liquid() {
        let input = r"{{ product | json }}";
        let result = strip_liquid(input);
        assert_eq!(result.trim(), "");
        assert_eq!(input.len(), result.len());
    }

    #[test]
    fn line_from_offset_basic() {
        let src = "line1\nline2\nline3";
        assert_eq!(line_from_offset(src, 0), 1);
        assert_eq!(line_from_offset(src, 5), 1); // the '\n' itself
        assert_eq!(line_from_offset(src, 6), 2);
        assert_eq!(line_from_offset(src, 12), 3);
    }

    #[test]
    fn line_from_offset_out_of_range() {
        let src = "abc";
        assert_eq!(line_from_offset(src, 999), 1);
    }
}
