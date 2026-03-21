//! HTML element extraction using `lol_html`.
//!
//! Extracts structural information from (Liquid-stripped) HTML that the
//! WCAG check modules need: images, headings, form inputs, links,
//! interactive elements, the `<html>` tag, and ARIA attributes.

use lol_html::{ElementContentHandlers, HtmlRewriter, Selector, Settings, element, text};
use std::borrow::Cow;
use std::sync::{Arc, Mutex};

/// An extracted HTML element with the attributes and text content
/// relevant to accessibility checks.
#[derive(Debug, Clone)]
pub struct HtmlElement {
    /// Lowercase tag name, e.g. `"img"`, `"h1"`, `"input"`.
    pub tag: String,
    /// All attributes as `(name, value)` pairs, lowercased keys.
    pub attrs: Vec<(String, String)>,
    /// Inner text content (only captured for elements that need it:
    /// headings, links, buttons). Empty for void elements.
    pub inner_text: String,
    /// Byte offset of the element's start tag in the source.
    pub byte_offset: usize,
}

impl HtmlElement {
    /// Get an attribute value by name (case-insensitive lookup).
    #[must_use]
    pub fn attr(&self, name: &str) -> Option<&str> {
        let lower = name.to_lowercase();
        self.attrs
            .iter()
            .find(|(k, _)| k == &lower)
            .map(|(_, v)| v.as_str())
    }

    /// Check whether the element has a given attribute (regardless of value).
    #[must_use]
    pub fn has_attr(&self, name: &str) -> bool {
        self.attr(name).is_some()
    }

    /// Return all `aria-*` attributes.
    pub fn aria_attrs(&self) -> impl Iterator<Item = (&str, &str)> {
        self.attrs
            .iter()
            .filter(|(k, _)| k.starts_with("aria-"))
            .map(|(k, v)| (k.as_str(), v.as_str()))
    }
}

/// Internal: element awaiting text content before finalization.
struct PendingElement {
    tag: String,
    attrs: Vec<(String, String)>,
    byte_offset: usize,
}

/// Flush any pending text-bearing element into the results list.
fn flush_pending(
    pending: &Mutex<Option<PendingElement>>,
    text_buf: &Mutex<String>,
    elements: &Mutex<Vec<HtmlElement>>,
) {
    let mut pend = pending.lock().expect("lock poisoned");
    if let Some(p) = pend.take() {
        let mut buf = text_buf.lock().expect("lock poisoned");
        elements.lock().expect("lock poisoned").push(HtmlElement {
            tag: p.tag,
            attrs: p.attrs,
            // Preserve raw text (don't trim) so checks can distinguish
            // truly empty elements from Liquid-stripped whitespace.
            inner_text: std::mem::take(&mut *buf),
            byte_offset: p.byte_offset,
        });
    }
}

/// Search for the next occurrence of `<tag_name` in `source` starting at
/// `cursor`, where the character after the tag name is not alphanumeric or
/// a hyphen (to avoid `<a` matching `<article>` or `<aside>`).
///
/// Returns the byte offset of `<` and advances the cursor past the match.
/// Falls back to 0 if the tag is not found (should not happen in practice).
fn find_tag_offset(source: &[u8], cursor: &Mutex<usize>, tag: &str) -> usize {
    let needle = format!("<{tag}");
    let needle_bytes = needle.as_bytes();
    let mut pos = *cursor.lock().expect("lock poisoned");

    while pos + needle_bytes.len() <= source.len() {
        if source[pos..].starts_with(needle_bytes) {
            let after = pos + needle_bytes.len();
            // Verify next char is not alphanumeric or hyphen to avoid
            // partial tag name matches (e.g. <a vs <article, <s vs <span).
            if after >= source.len()
                || (!source[after].is_ascii_alphanumeric() && source[after] != b'-')
            {
                *cursor.lock().expect("lock poisoned") = after;
                return pos;
            }
        }
        pos += 1;
    }

    0
}

/// Build the `lol_html` element/text content handlers for HTML extraction.
///
/// Returns a vector of handlers that populate `elements` via shared state.
fn build_handlers<'h>(
    elements: &Arc<Mutex<Vec<HtmlElement>>>,
    pending: &Arc<Mutex<Option<PendingElement>>>,
    text_buf: &Arc<Mutex<String>>,
    source: &Arc<Vec<u8>>,
    cursor: &Arc<Mutex<usize>>,
) -> Vec<(Cow<'h, Selector>, ElementContentHandlers<'h>)> {
    let mut handlers = Vec::new();

    // -- Void/simple tags: html, img, input, select, textarea, main --
    let el_void = elements.clone();
    let p_void = pending.clone();
    let tb_void = text_buf.clone();
    let src_void = source.clone();
    let cur_void = cursor.clone();
    handlers.push(element!("html, img, input, select, textarea, main", move |e| {
        flush_pending(&p_void, &tb_void, &el_void);
        let tag = e.tag_name().to_lowercase();
        let offset = find_tag_offset(&src_void, &cur_void, &tag);
        let attrs: Vec<(String, String)> = e
            .attributes()
            .iter()
            .map(|a| (a.name().to_lowercase(), a.value().to_string()))
            .collect();
        el_void.lock().expect("lock poisoned").push(HtmlElement {
            tag,
            attrs,
            inner_text: String::new(),
            byte_offset: offset,
        });
        Ok(())
    }));

    // -- Text-bearing tags: a, button, h1-h6, label, title --
    let el_text = elements.clone();
    let p_text = pending.clone();
    let tb_text = text_buf.clone();
    let src_text = source.clone();
    let cur_text = cursor.clone();
    handlers.push(element!(
        "a, button, h1, h2, h3, h4, h5, h6, label, title",
        move |e| {
            flush_pending(&p_text, &tb_text, &el_text);
            let tag = e.tag_name().to_lowercase();
            let offset = find_tag_offset(&src_text, &cur_text, &tag);
            let attrs: Vec<(String, String)> = e
                .attributes()
                .iter()
                .map(|a| (a.name().to_lowercase(), a.value().to_string()))
                .collect();
            let mut pend = p_text.lock().expect("lock poisoned");
            *pend = Some(PendingElement {
                tag,
                attrs,
                byte_offset: offset,
            });
            Ok(())
        }
    ));

    // Capture inner text for text-bearing elements
    let tb_handler = text_buf.clone();
    handlers.push(text!(
        "a, button, h1, h2, h3, h4, h5, h6, label, title",
        move |t| {
            tb_handler
                .lock()
                .expect("lock poisoned")
                .push_str(t.as_str());
            Ok(())
        }
    ));

    // -- ARIA-attributed elements not in our standard tag lists --
    let el_aria = elements.clone();
    let p_aria = pending.clone();
    let tb_aria = text_buf.clone();
    let src_aria = source.clone();
    let cur_aria = cursor.clone();
    handlers.push(element!(
        "*[role], *[aria-label], *[aria-labelledby], *[aria-describedby], *[aria-hidden]",
        move |e| {
            let tag = e.tag_name().to_lowercase();
            let known = [
                "html", "img", "input", "select", "textarea", "main",
                "a", "button", "h1", "h2", "h3", "h4", "h5", "h6", "label", "title",
            ];
            if known.contains(&tag.as_str()) {
                return Ok(());
            }
            flush_pending(&p_aria, &tb_aria, &el_aria);
            let offset = find_tag_offset(&src_aria, &cur_aria, &tag);
            let attrs: Vec<(String, String)> = e
                .attributes()
                .iter()
                .map(|a| (a.name().to_lowercase(), a.value().to_string()))
                .collect();
            el_aria.lock().expect("lock poisoned").push(HtmlElement {
                tag,
                attrs,
                inner_text: String::new(),
                byte_offset: offset,
            });
            Ok(())
        }
    ));

    handlers
}

/// Parse HTML and extract elements relevant to accessibility checks.
///
/// Uses `lol_html` for streaming, zero-copy parsing that handles
/// malformed HTML gracefully (important for real-world Shopify themes).
///
/// # Arguments
///
/// * `html` - HTML source (should already have Liquid tags stripped)
///
/// # Returns
///
/// A vector of extracted elements, or an error if parsing fails.
///
/// # Errors
///
/// Returns `lol_html::errors::RewritingError` if the HTML is too malformed
/// to parse at all (extremely rare — `lol_html` is very lenient).
pub fn extract_elements(html: &str) -> Result<Vec<HtmlElement>, lol_html::errors::RewritingError> {
    let elements: Arc<Mutex<Vec<HtmlElement>>> = Arc::new(Mutex::new(Vec::new()));
    let pending: Arc<Mutex<Option<PendingElement>>> = Arc::new(Mutex::new(None));
    let text_buf: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let source: Arc<Vec<u8>> = Arc::new(html.as_bytes().to_vec());
    let cursor: Arc<Mutex<usize>> = Arc::new(Mutex::new(0));

    let handlers = build_handlers(&elements, &pending, &text_buf, &source, &cursor);

    let mut rewriter = HtmlRewriter::new(
        Settings {
            element_content_handlers: handlers,
            ..Settings::new()
        },
        |_: &[u8]| {},
    );

    rewriter.write(html.as_bytes())?;
    rewriter.end()?;

    // Flush the last pending element
    flush_pending(&pending, &text_buf, &elements);

    let result = Arc::try_unwrap(elements)
        .expect("all references should be dropped after rewriter ends")
        .into_inner()
        .expect("lock poisoned");

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_img_without_alt() {
        let html = r#"<html><body><img src="hero.jpg"></body></html>"#;
        let elements = extract_elements(html).unwrap();
        let imgs: Vec<_> = elements.iter().filter(|e| e.tag == "img").collect();
        assert_eq!(imgs.len(), 1);
        assert!(imgs[0].attr("alt").is_none());
        assert_eq!(imgs[0].attr("src").unwrap(), "hero.jpg");
    }

    #[test]
    fn extract_img_with_alt() {
        let html = r#"<img src="logo.png" alt="Company Logo">"#;
        let elements = extract_elements(html).unwrap();
        let img = elements.iter().find(|e| e.tag == "img").unwrap();
        assert_eq!(img.attr("alt").unwrap(), "Company Logo");
    }

    #[test]
    fn extract_headings() {
        let html = "<h1>Title</h1><h3>Skipped</h3>";
        let elements = extract_elements(html).unwrap();
        let headings: Vec<_> = elements
            .iter()
            .filter(|e| e.tag.starts_with('h') && e.tag.len() == 2)
            .collect();
        assert_eq!(headings.len(), 2);
        assert_eq!(headings[0].tag, "h1");
        assert_eq!(headings[0].inner_text, "Title");
        assert_eq!(headings[1].tag, "h3");
    }

    #[test]
    fn extract_link_text() {
        let html = r#"<a href="/page">Click here</a>"#;
        let elements = extract_elements(html).unwrap();
        let link = elements.iter().find(|e| e.tag == "a").unwrap();
        assert_eq!(link.inner_text, "Click here");
        assert_eq!(link.attr("href").unwrap(), "/page");
    }

    #[test]
    fn extract_form_input() {
        let html = r#"<input type="text" id="name" aria-label="Your name">"#;
        let elements = extract_elements(html).unwrap();
        let input = elements.iter().find(|e| e.tag == "input").unwrap();
        assert_eq!(input.attr("type").unwrap(), "text");
        assert_eq!(input.attr("aria-label").unwrap(), "Your name");
    }

    #[test]
    fn extract_html_lang() {
        let html = r#"<html lang="en"><head></head><body></body></html>"#;
        let elements = extract_elements(html).unwrap();
        let html_el = elements.iter().find(|e| e.tag == "html").unwrap();
        assert_eq!(html_el.attr("lang").unwrap(), "en");
    }

    #[test]
    fn extract_aria_attributes() {
        let html = r#"<div role="navigation" aria-label="Main menu">Nav</div>"#;
        let elements = extract_elements(html).unwrap();
        let div = elements.iter().find(|e| e.tag == "div").unwrap();
        assert_eq!(div.attr("role").unwrap(), "navigation");
        let aria: Vec<_> = div.aria_attrs().collect();
        assert_eq!(aria.len(), 1);
        assert_eq!(aria[0], ("aria-label", "Main menu"));
    }

    #[test]
    fn handles_malformed_html() {
        let html = "<h1>Unclosed heading<p>Paragraph<img src='x'>";
        let result = extract_elements(html);
        assert!(result.is_ok());
    }

    #[test]
    fn byte_offsets_multiline() {
        let html = "<html lang=\"en\">\n<body>\n<h1>Title</h1>\n<img src=\"a.png\">\n</body>\n</html>";
        let elements = extract_elements(html).unwrap();

        let html_el = elements.iter().find(|e| e.tag == "html").unwrap();
        assert_eq!(html_el.byte_offset, 0);

        let h1 = elements.iter().find(|e| e.tag == "h1").unwrap();
        assert_eq!(h1.byte_offset, html.find("<h1>").unwrap());

        let img = elements.iter().find(|e| e.tag == "img").unwrap();
        assert_eq!(img.byte_offset, html.find("<img").unwrap());
    }

    #[test]
    fn byte_offset_avoids_partial_tag_match() {
        // Ensure <a> doesn't match <article>
        let html = "<article><a href=\"/\">Link</a></article>";
        let elements = extract_elements(html).unwrap();

        let link = elements.iter().find(|e| e.tag == "a").unwrap();
        assert_eq!(link.byte_offset, html.find("<a ").unwrap());
    }
}
