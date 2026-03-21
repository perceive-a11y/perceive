/**
 * Shared scan summary logic — deduplication and criterion grouping used by
 * both the dashboard and historical scan detail views.
 */

import { SEVERITY_RANK } from "~/lib/severity";
import { normalizeDedupeKey } from "~/lib/deep-scan.server";

interface RawFinding {
  criterionId: string;
  severity: string;
  element: string;
  source: string;
}

interface SeveritySummary {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  total: number;
}

interface CriterionGroup {
  criterionId: string;
  count: number;
  severity: string;
  sources: string[];
}

/**
 * Build a deduplicated severity summary and criterion groups from raw findings.
 *
 * # Arguments
 *
 * * `findings` - Raw findings array (must include criterionId, severity, element, source)
 *
 * # Returns
 *
 * `{ summary, criterionGroups }` — summary has severity counts; criterionGroups
 * is sorted by severity (most severe first), with sources serialized as arrays.
 */
export function buildScanSummary(findings: RawFinding[]): {
  summary: SeveritySummary;
  criterionGroups: CriterionGroup[];
} {
  // Deduplicate findings for display counts
  const deduped = new Map<string, { severity: string; sources: Set<string> }>();
  for (const f of findings) {
    const key = normalizeDedupeKey(f.criterionId, f.element);
    const existing = deduped.get(key);
    if (existing) {
      existing.sources.add(f.source);
      if (
        (SEVERITY_RANK[f.severity] ?? 4) <
        (SEVERITY_RANK[existing.severity] ?? 4)
      ) {
        existing.severity = f.severity;
      }
    } else {
      deduped.set(key, { severity: f.severity, sources: new Set([f.source]) });
    }
  }

  // Compute severity counts
  let critical = 0;
  let serious = 0;
  let moderate = 0;
  let minor = 0;
  for (const f of deduped.values()) {
    switch (f.severity) {
      case "critical": critical++; break;
      case "serious": serious++; break;
      case "moderate": moderate++; break;
      default: minor++; break;
    }
  }

  // Group by criterion
  const byCriterion = new Map<
    string,
    { criterionId: string; count: number; severity: string; sources: Set<string> }
  >();
  for (const f of findings) {
    const existing = byCriterion.get(f.criterionId);
    if (existing) {
      existing.count++;
      existing.sources.add(f.source);
      if (
        (SEVERITY_RANK[f.severity] ?? 4) <
        (SEVERITY_RANK[existing.severity] ?? 4)
      ) {
        existing.severity = f.severity;
      }
    } else {
      byCriterion.set(f.criterionId, {
        criterionId: f.criterionId,
        count: 1,
        severity: f.severity,
        sources: new Set([f.source]),
      });
    }
  }

  const criterionGroups = Array.from(byCriterion.values())
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4),
    )
    .map((g) => ({
      criterionId: g.criterionId,
      count: g.count,
      severity: g.severity,
      sources: Array.from(g.sources),
    }));

  return {
    summary: { critical, serious, moderate, minor, total: deduped.size },
    criterionGroups,
  };
}
