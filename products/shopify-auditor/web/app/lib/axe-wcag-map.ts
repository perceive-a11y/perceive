/**
 * Maps axe-core rule IDs to WCAG success criterion IDs.
 *
 * Used by both the deep scan worker and the dashboard to attribute
 * runtime findings to the correct WCAG criteria.
 */
export const AXE_TO_WCAG: Record<string, string> = {
    // 1.1.1 Non-text Content
    "image-alt": "1.1.1",
    "input-image-alt": "1.1.1",
    "role-img-alt": "1.1.1",
    "svg-img-alt": "1.1.1",
    "area-alt": "1.1.1",

    // 1.3.1 Info and Relationships
    "heading-order": "1.3.1",
    "label": "1.3.1",
    "select-name": "1.3.1",

    // 1.3.5 Identify Input Purpose
    "autocomplete-valid": "1.3.5",

    // 1.4.1 Use of Color
    "link-in-text-block": "1.4.1",

    // 1.4.3 Contrast (Minimum)
    "color-contrast": "1.4.3",

    // 1.4.6 Contrast (Enhanced)
    "color-contrast-enhanced": "1.4.6",

    // 2.4.1 Bypass Blocks
    "bypass": "2.4.1",

    // 2.4.2 Page Titled
    "document-title": "2.4.2",

    // 2.4.3 Focus Order
    "focus-order-semantics": "2.4.3",
    "tabindex": "2.4.3",

    // 2.4.4 Link Purpose (In Context)
    "link-name": "2.4.4",

    // 2.4.6 Headings and Labels
    "empty-heading": "2.4.6",

    // 2.5.8 Target Size
    "target-size": "2.5.8",

    // 3.1.1 Language of Page
    "html-has-lang": "3.1.1",
    "html-lang-valid": "3.1.1",
    "html-xml-lang-mismatch": "3.1.1",

    // 3.1.2 Language of Parts
    "valid-lang": "3.1.2",

    // 3.3.2 Labels or Instructions
    "label-title-only": "3.3.2",

    // 4.1.2 Name, Role, Value
    "aria-allowed-attr": "4.1.2",
    "aria-allowed-role": "4.1.2",
    "aria-hidden-body": "4.1.2",
    "aria-required-attr": "4.1.2",
    "aria-required-children": "4.1.2",
    "aria-required-parent": "4.1.2",
    "aria-roles": "4.1.2",
    "aria-valid-attr-value": "4.1.2",
    "aria-valid-attr": "4.1.2",
    "button-name": "4.1.2",
    "input-button-name": "4.1.2",
};

/**
 * Map axe-core impact levels to our severity levels.
 *
 * axe uses: critical, serious, moderate, minor
 * Our scanner uses the same four levels, so this is a direct pass-through.
 */
export function axeImpactToSeverity(
    impact: string | null | undefined,
): "critical" | "serious" | "moderate" | "minor" {
    switch (impact) {
        case "critical": return "critical";
        case "serious": return "serious";
        case "moderate": return "moderate";
        default: return "minor";
    }
}
