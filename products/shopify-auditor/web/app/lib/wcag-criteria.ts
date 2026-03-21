/** Merchant-friendly WCAG 2.2 criterion metadata for display in the UI. */
export const WCAG_CRITERIA: Record<string, { name: string; description: string }> = {
  "1.1.1": {
    name: "Non-text Content",
    description:
      "Screen reader users cannot understand images without descriptive text",
  },
  "1.3.1": {
    name: "Info and Relationships",
    description:
      "Content structure must be programmatically determinable for assistive technology",
  },
  "1.3.5": {
    name: "Identify Input Purpose",
    description:
      "Form fields need autocomplete so browsers and assistive tech can auto-fill them",
  },
  "1.4.3": {
    name: "Contrast (Minimum)",
    description:
      "Text must have enough contrast against its background to be readable",
  },
  "1.4.6": {
    name: "Contrast (Enhanced)",
    description:
      "Higher contrast makes text easier to read for users with low vision",
  },
  "2.4.1": {
    name: "Bypass Blocks",
    description:
      "Keyboard users need a way to skip repeated navigation and jump to main content",
  },
  "2.4.2": {
    name: "Page Titled",
    description:
      "Pages need descriptive titles so users know where they are",
  },
  "2.4.4": {
    name: "Link Purpose",
    description:
      "Link text like 'click here' tells screen reader users nothing about where the link goes",
  },
  "2.4.6": {
    name: "Headings and Labels",
    description:
      "Headings and labels must describe the content they introduce",
  },
  "2.4.7": {
    name: "Focus Visible",
    description:
      "Keyboard users must be able to see which element is currently focused",
  },
  "2.5.3": {
    name: "Label in Name",
    description:
      "Voice control users need visible text to match the accessible name to activate controls",
  },
  "2.5.5": {
    name: "Target Size (Enhanced)",
    description:
      "Touch targets should be large enough to tap accurately",
  },
  "2.5.8": {
    name: "Target Size (Minimum)",
    description:
      "Interactive elements must be at least 24x24 CSS pixels to be usable",
  },
  "3.1.1": {
    name: "Language of Page",
    description:
      "Screen readers need the page language declared to use correct pronunciation",
  },
  "3.3.2": {
    name: "Labels or Instructions",
    description:
      "Form inputs need visible labels so all users know what to enter",
  },
  "4.1.2": {
    name: "Name, Role, Value",
    description:
      "Interactive elements need proper ARIA attributes so assistive technology can operate them",
  },
};
