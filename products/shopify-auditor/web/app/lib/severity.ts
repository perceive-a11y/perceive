/** Severity rank for sorting (lower = more severe). */
export const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

/** Maps severity to Polaris Badge tone. */
export const SEVERITY_TONE: Record<
  string,
  "critical" | "warning" | "attention" | "info"
> = {
  critical: "critical",
  serious: "warning",
  moderate: "attention",
  minor: "info",
};

/** Border colors matching each severity's Polaris Badge tone. */
export const SEVERITY_COLOR: Record<string, string> = {
  critical: "#d72c0d",
  serious: "#b98900",
  moderate: "#5c6ac4",
  minor: "#637381",
};
