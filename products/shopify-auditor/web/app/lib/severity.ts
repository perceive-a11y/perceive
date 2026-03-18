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
