import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "~/lib/db.server";
import { WCAG_CRITERIA } from "~/lib/wcag-criteria";

/**
 * Public report — resource route (no default export).
 *
 * Returns a self-contained HTML page with Pico CSS, vanilla JS filtering,
 * and a light/dark theme toggle. Accessible without Shopify login.
 *
 * Severity indicators use both color AND shape icons so they remain
 * distinguishable for colorblind users.
 *
 * For deep scans: includes score display, source badges, and source filter.
 */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const token = params.token;
  if (!token) {
    throw new Response("Report not found", { status: 404 });
  }

  const scan = await prisma.scan.findUnique({
    where: { reportToken: token },
    include: {
      findings: true,
      merchant: { select: { shopDomain: true } },
    },
  });

  if (!scan) {
    throw new Response("Report not found", { status: 404 });
  }

  const findings = scan.findings.map((f) => ({
    criterionId: f.criterionId,
    severity: f.severity,
    element: f.element,
    filePath: f.filePath,
    line: f.line,
    message: f.message,
    suggestion: f.suggestion,
    source: f.source,
    pageUrl: f.pageUrl,
  }));

  const counts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    serious: findings.filter((f) => f.severity === "serious").length,
    moderate: findings.filter((f) => f.severity === "moderate").length,
    minor: findings.filter((f) => f.severity === "minor").length,
  };

  // Group by criterion
  const grouped = new Map<string, typeof findings>();
  for (const f of findings) {
    const arr = grouped.get(f.criterionId);
    if (arr) {
      arr.push(f);
    } else {
      grouped.set(f.criterionId, [f]);
    }
  }

  const shopDomain = scan.merchant.shopDomain;
  const completedAt = scan.completedAt?.toISOString() ?? "N/A";
  const filesScanned = scan.templateCount;
  const isDeep = scan.scanType === "deep";
  const score = scan.score;

  // Shape-coded severity icons (distinguishable without color)
  const severityIcon: Record<string, string> = {
    critical: "&#9679;",  // filled circle
    serious: "&#9650;",   // filled triangle
    moderate: "&#9670;",  // filled diamond
    minor: "&#9644;",     // horizontal rectangle
  };

  // Source badge HTML helper — plain language for non-technical readers
  const sourceLabel = (source: string): string => {
    switch (source) {
      case "axe": return "Browser";
      case "lighthouse": return "Lighthouse";
      default: return "Source code";
    }
  };

  const sourceBadgeClass = (source: string): string => {
    switch (source) {
      case "axe": return "source-badge runtime";
      case "lighthouse": return "source-badge lighthouse";
      default: return "source-badge static";
    }
  };

  // Build grouped findings HTML
  let findingsHtml = "";
  for (const [criterion, items] of grouped) {
    const criterionMeta = WCAG_CRITERIA[criterion];
    const criterionName = criterionMeta?.name ?? "";
    const criterionDesc = criterionMeta?.description ?? "";
    findingsHtml += `<section class="criterion-group" data-criterion="${esc(criterion)}">`;
    findingsHtml += `<h3>SC ${esc(criterion)} - ${esc(criterionName)} <small>(${items.length} ${items.length === 1 ? "finding" : "findings"})</small></h3>`;
    if (criterionDesc) {
      findingsHtml += `<p class="criterion-desc">${esc(criterionDesc)}</p>`;
    }
    for (const f of items) {
      const locationHtml = f.source === "axe" && f.pageUrl
        ? `<code>${esc(f.pageUrl)}</code>`
        : `<code>${esc(f.filePath)}:${f.line}</code>`;

      findingsHtml += `
        <div class="finding-card ${esc(f.severity)}" data-severity="${esc(f.severity)}" data-source="${esc(f.source)}">
          <div class="finding-header">
            ${locationHtml}
            <span class="finding-badges">
              ${isDeep ? `<span class="${sourceBadgeClass(f.source)}">${sourceLabel(f.source)}</span>` : ""}
              <span class="severity-badge ${esc(f.severity)}">${severityIcon[f.severity] ?? ""} ${esc(f.severity)}</span>
            </span>
          </div>
          <p class="finding-element">Element: <code>${esc(f.element)}</code></p>
          <p>${esc(f.message)}</p>
          ${f.suggestion ? `<div class="suggestion"><strong>Suggestion</strong><pre>${esc(f.suggestion)}</pre></div>` : ""}
        </div>`;
    }
    findingsHtml += `</section>`;
  }

  // Score card HTML (deep scans only)
  const scoreHtml = isDeep && score !== null ? `
    <div class="score-card">
      <div class="score-value">${score}</div>
      <div class="score-label">/ 100 Accessibility Score</div>
    </div>
  ` : "";

  // Source filter (deep scans only)
  const sourceFilterHtml = isDeep ? `
    <label>
      Detected by
      <select id="source-filter" onchange="filterFindings()">
        <option value="all">All</option>
        <option value="static">Source code analysis</option>
        <option value="axe">Browser testing</option>
      </select>
    </label>
  ` : "";

  // Scan type description
  const scanTypeDesc = isDeep
    ? "Combines source-code analysis and runtime browser testing"
    : "WCAG 2.2 static analysis";

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Accessibility Report - ${esc(shopDomain)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-family: 'Inter', sans-serif;
      --pico-font-size: 16px;
      --color-critical: #d72c0d;
      --color-serious: #b98900;
      --color-moderate: #5c6ac4;
      --color-minor: #637381;
    }
    body { font-family: 'Inter', sans-serif; }
    code, pre { font-family: 'JetBrains Mono', monospace; }
    header { text-align: center; margin-bottom: 2rem; }
    header h1 { margin-bottom: 0.25rem; }
    .score-card {
      text-align: center;
      padding: 2rem;
      margin-bottom: 2rem;
      background: var(--pico-card-background-color);
      border-radius: 0.75rem;
    }
    .score-value {
      font-size: 4rem;
      font-weight: 700;
      line-height: 1;
    }
    .score-label {
      font-size: 1rem;
      color: var(--pico-muted-color);
      margin-top: 0.5rem;
    }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      padding: 1rem;
      border-radius: 0.5rem;
      background: var(--pico-card-background-color);
      text-align: center;
    }
    .stat-card.critical { border-top: 4px solid var(--color-critical); }
    .stat-card.serious { border-top: 4px solid var(--color-serious); }
    .stat-card.moderate { border-top: 4px solid var(--color-moderate); }
    .stat-card.minor { border-top: 4px solid var(--color-minor); }
    .stat-card .count { font-size: 2rem; font-weight: 700; }
    .stat-card .label { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .finding-card {
      border-left: 4px solid var(--pico-muted-border-color);
      padding: 1rem;
      margin-bottom: 1rem;
      background: var(--pico-card-background-color);
      border-radius: 0.25rem;
    }
    .finding-card.critical { border-left-color: var(--color-critical); }
    .finding-card.serious { border-left-color: var(--color-serious); }
    .finding-card.moderate { border-left-color: var(--color-moderate); }
    .finding-card.minor { border-left-color: var(--color-minor); }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .finding-badges {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .severity-badge {
      font-weight: 600;
      font-size: 0.85rem;
      padding: 0.15em 0.5em;
      border-radius: 0.25rem;
    }
    .severity-badge.critical { color: var(--color-critical); }
    .severity-badge.serious { color: var(--color-serious); }
    .severity-badge.moderate { color: var(--color-moderate); }
    .severity-badge.minor { color: var(--color-minor); }
    .source-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15em 0.5em;
      border-radius: 0.25rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .source-badge.static {
      background: var(--pico-muted-border-color);
      color: var(--pico-color);
    }
    .source-badge.runtime {
      background: #dbeafe;
      color: #1e40af;
    }
    [data-theme="dark"] .source-badge.runtime {
      background: #1e3a5f;
      color: #93c5fd;
    }
    .source-badge.lighthouse {
      background: #fef3c7;
      color: #92400e;
    }
    [data-theme="dark"] .source-badge.lighthouse {
      background: #451a03;
      color: #fbbf24;
    }
    .criterion-desc {
      font-size: 0.9rem;
      color: var(--pico-muted-color);
      margin-top: -0.5rem;
      margin-bottom: 1rem;
    }
    .finding-element { font-size: 0.9rem; color: var(--pico-muted-color); }
    .suggestion {
      background: var(--pico-card-sectionning-background-color, var(--pico-card-background-color));
      padding: 0.75rem;
      border-radius: 0.25rem;
      margin-top: 0.5rem;
    }
    .suggestion pre {
      margin: 0.5rem 0 0;
      white-space: pre-wrap;
      font-size: 0.85em;
    }
    .filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      align-items: end;
      flex-wrap: wrap;
    }
    .filters label { margin-bottom: 0; }
    .filters select, .filters input { margin-bottom: 0; }
    .theme-toggle {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 10;
    }
    footer { text-align: center; margin-top: 3rem; padding: 2rem 0; }
    @media print {
      .filters, .theme-toggle { display: none; }
      .finding-card { break-inside: avoid; }
      .stat-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <button class="theme-toggle outline" onclick="toggleTheme()" aria-label="Toggle light/dark theme">Light / Dark</button>
  <main class="container">
    <header>
      <h1>Accessibility Audit Report</h1>
      <p><strong>${esc(shopDomain)}</strong> - scanned ${filesScanned} files on ${completedAt !== "N/A" ? new Date(completedAt).toLocaleDateString() : "N/A"}</p>
      <p>Generated by <strong>Perceive A11y Auditor</strong> - ${scanTypeDesc}</p>
    </header>

    ${scoreHtml}

    <div class="stats-row">
      <div class="stat-card critical">
        <div class="count">${counts.critical}</div>
        <div class="label">&#9679; Critical</div>
      </div>
      <div class="stat-card serious">
        <div class="count">${counts.serious}</div>
        <div class="label">&#9650; Serious</div>
      </div>
      <div class="stat-card moderate">
        <div class="count">${counts.moderate}</div>
        <div class="label">&#9670; Moderate</div>
      </div>
      <div class="stat-card minor">
        <div class="count">${counts.minor}</div>
        <div class="label">&#9644; Minor</div>
      </div>
    </div>

    <div class="filters">
      <label>
        Severity
        <select id="severity-filter" onchange="filterFindings()">
          <option value="all">All</option>
          <option value="critical">Critical</option>
          <option value="serious">Serious</option>
          <option value="moderate">Moderate</option>
          <option value="minor">Minor</option>
        </select>
      </label>
      <label>
        Criterion
        <input type="text" id="criterion-filter" placeholder="e.g. 1.1.1" oninput="filterFindings()">
      </label>
      ${sourceFilterHtml}
    </div>

    <div id="findings">
      ${findingsHtml}
    </div>

    <footer>
      <small>
        ${isDeep
          ? "This report combines source-code analysis with runtime browser testing for comprehensive WCAG coverage."
          : "This report was generated by source-code analysis of Shopify theme files. It covers static checks only and does not replace a full manual accessibility audit."
        }
      </small>
    </footer>
  </main>

  <script>
    function toggleTheme() {
      var html = document.documentElement;
      html.setAttribute('data-theme',
        html.getAttribute('data-theme') === 'light' ? 'dark' : 'light'
      );
    }

    function filterFindings() {
      var severity = document.getElementById('severity-filter').value;
      var criterion = document.getElementById('criterion-filter').value.trim().toLowerCase();
      var sourceEl = document.getElementById('source-filter');
      var source = sourceEl ? sourceEl.value : 'all';

      var groups = document.querySelectorAll('.criterion-group');
      for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        var groupCriterion = (group.getAttribute('data-criterion') || '').toLowerCase();
        var criterionMatch = !criterion || groupCriterion.indexOf(criterion) !== -1;

        var cards = group.querySelectorAll('.finding-card');
        var visibleCount = 0;
        for (var j = 0; j < cards.length; j++) {
          var card = cards[j];
          var cardSeverity = card.getAttribute('data-severity');
          var cardSource = card.getAttribute('data-source');
          var show = (severity === 'all' || cardSeverity === severity)
            && criterionMatch
            && (source === 'all' || cardSource === source);
          card.style.display = show ? '' : 'none';
          if (show) visibleCount++;
        }
        group.style.display = visibleCount > 0 ? '' : 'none';
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
};

/** Escape HTML special characters to prevent XSS. */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
