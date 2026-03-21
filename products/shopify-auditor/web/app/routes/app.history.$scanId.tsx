import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  DataTable,
  Tooltip,
  Icon,
} from "@shopify/polaris";
import { InfoIcon } from "@shopify/polaris-icons";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { SEVERITY_TONE, SEVERITY_RANK, SEVERITY_COLOR } from "~/lib/severity";
import { WCAG_CRITERIA } from "~/lib/wcag-criteria";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;
  const scanId = Number(params.scanId);

  if (!scanId) {
    throw new Response("Invalid scan ID", { status: 400 });
  }

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: {
      id: true,
      scanType: true,
      themeName: true,
      completedAt: true,
      templateCount: true,
      score: true,
      reportToken: true,
      merchant: { select: { shopDomain: true } },
    },
  });

  if (!scan || scan.merchant.shopDomain !== shopDomain) {
    throw new Response("Scan not found", { status: 404 });
  }

  // Use groupBy to compute summary + criterion groups without loading all rows
  const [severityGroups, criterionSeverityGroups] = await Promise.all([
    prisma.finding.groupBy({
      by: ["severity"],
      where: { scanId },
      _count: { id: true },
    }),
    prisma.finding.groupBy({
      by: ["criterionId", "severity", "source"],
      where: { scanId },
      _count: { id: true },
    }),
  ]);

  const summary = { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 };
  for (const row of severityGroups) {
    const count = row._count.id;
    summary.total += count;
    if (row.severity === "critical") summary.critical += count;
    else if (row.severity === "serious") summary.serious += count;
    else if (row.severity === "moderate") summary.moderate += count;
    else summary.minor += count;
  }

  const criterionMap = new Map<
    string,
    { criterionId: string; count: number; severity: string; sources: Set<string> }
  >();
  for (const row of criterionSeverityGroups) {
    const existing = criterionMap.get(row.criterionId);
    if (existing) {
      existing.count += row._count.id;
      existing.sources.add(row.source);
      if (
        (SEVERITY_RANK[row.severity] ?? 4) <
        (SEVERITY_RANK[existing.severity] ?? 4)
      ) {
        existing.severity = row.severity;
      }
    } else {
      criterionMap.set(row.criterionId, {
        criterionId: row.criterionId,
        count: row._count.id,
        severity: row.severity,
        sources: new Set([row.source]),
      });
    }
  }
  const criterionGroups = Array.from(criterionMap.values())
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

  return json({
    scan: {
      id: scan.id,
      scanType: scan.scanType,
      themeName: scan.themeName || "Active theme",
      completedAt: scan.completedAt?.toISOString() ?? null,
      templateCount: scan.templateCount,
      score: scan.score,
      reportToken: scan.reportToken ?? null,
    },
    summary: {
      ...summary,
      filesScanned: scan.templateCount,
      completedAt: scan.completedAt?.toISOString() ?? null,
    },
    criterionGroups,
  });
};

/** Source badge - describes how an issue was detected. */
function sourceBadge(sources: string[]) {
  const hasStatic = sources.includes("static");
  const hasAxe = sources.includes("axe");

  if (hasStatic && hasAxe) {
    return <Badge tone="success">Source + Browser</Badge>;
  }
  if (hasAxe) {
    return <Badge tone="info">Browser only</Badge>;
  }
  return <Badge>Source code only</Badge>;
}

export default function HistoryScanPage() {
  const { scan, summary, criterionGroups } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const isDeep = scan.scanType === "deep";

  const rows = (criterionGroups as Array<{
    criterionId: string; count: number; severity: string; sources: string[];
  }>).map((g) => {
      const meta = WCAG_CRITERIA[g.criterionId];
      const base = [
        <div
          key={`crit-${g.criterionId}`}
          role="button"
          tabIndex={0}
          style={{ cursor: "pointer" }}
          onClick={() =>
            navigate(`/app/findings/${g.criterionId}?scanId=${scan.id}`)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ")
              navigate(`/app/findings/${g.criterionId}?scanId=${scan.id}`);
          }}
        >
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              SC {g.criterionId} - {meta?.name ?? ""}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {meta?.description}
            </Text>
          </BlockStack>
        </div>,
        g.count.toString(),
        <Badge key={g.criterionId} tone={SEVERITY_TONE[g.severity] ?? "info"}>
          {g.severity}
        </Badge>,
      ];

      if (isDeep) {
        base.push(sourceBadge(g.sources));
      }

      return base;
    },
  );

  const tableHeadings = isDeep
    ? ["Criterion", "Count", "Severity", "Detected by"]
    : ["Criterion", "Count", "Severity"];

  const tableTypes = isDeep
    ? (["text", "numeric", "text", "text"] as const)
    : (["text", "numeric", "text"] as const);

  const dateStr = scan.completedAt
    ? new Date(scan.completedAt).toLocaleString()
    : "In progress";

  const reportUrl = scan.reportToken
    ? `/public/report/${scan.reportToken}`
    : null;

  return (
    <Page
      title={`Scan: ${scan.themeName}`}
      subtitle={`Scanned on ${dateStr}`}
      backAction={{ url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <InlineStack gap="400" align="start" wrap={false}>
            {scan.score !== null && scan.score !== undefined && (
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200">
                    <InlineStack gap="100" align="start" blockAlign="center">
                      <Text as="h3" variant="headingMd">Score</Text>
                      <Tooltip content="Starts at 100, minus 15 per critical, 8 per serious, 3 per moderate, and 1 per minor issue.">
                        <Icon source={InfoIcon} tone="subdued" />
                      </Tooltip>
                    </InlineStack>
                    <Text as="p" variant="headingLg" fontWeight="bold">
                      {scan.score}/100
                    </Text>
                  </BlockStack>
                </Card>
              </div>
            )}
            {(["critical", "serious", "moderate", "minor"] as const).map(
              (severity) => (
                <div
                  key={severity}
                  style={{
                    flex: 1,
                    borderTop: `3px solid ${SEVERITY_COLOR[severity]}`,
                    borderRadius: "var(--p-border-radius-300)",
                  }}
                >
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </Text>
                      <Text as="p" variant="headingLg" fontWeight="bold">
                        {summary[severity]}
                      </Text>
                    </BlockStack>
                  </Card>
                </div>
              ),
            )}
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Findings by WCAG Criterion
              </Text>
              <DataTable
                columnContentTypes={[...tableTypes]}
                headings={tableHeadings}
                rows={rows}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {reportUrl && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Share Report</Text>
                <InlineStack gap="300">
                  <Button
                    onClick={() => {
                      const fullUrl = `${window.location.origin}${reportUrl}`;
                      navigator.clipboard.writeText(fullUrl);
                    }}
                  >
                    Copy Report Link
                  </Button>
                  <Button url={reportUrl} target="_blank" variant="plain">
                    Open Report
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Theme: {scan.themeName}{" "}
                | Scan type: {isDeep ? "Deep (static + runtime)" : "Static"}{" "}
                | Scanned: {dateStr}{" "}
                | Files scanned: {summary.filesScanned}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
