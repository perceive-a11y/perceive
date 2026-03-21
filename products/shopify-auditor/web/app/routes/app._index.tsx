import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useRevalidator } from "@remix-run/react";
import { useEffect, useRef } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Banner,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Spinner,
  CalloutCard,
} from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { SEVERITY_TONE } from "~/lib/severity";
import { buildScanSummary } from "~/lib/scan-summary.server";
import { WCAG_CRITERIA } from "~/lib/wcag-criteria";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const billingStatus = url.searchParams.get("billing");

  // Get merchant and latest scan with findings
  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain },
    include: {
      scans: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: { findings: true },
      },
    },
  });

  if (!merchant || merchant.scans.length === 0) {
    return json({
      hasScan: false,
      scan: null,
      summary: null,
      criterionGroups: null,
      reportToken: null,
      billingStatus,
      isDeepScanning: false,
      score: null,
      plan: merchant?.plan ?? "free",
      historyScans: [],
      trend: null,
    });
  }

  const scan = merchant.scans[0];

  const isDeepScanning =
    scan.status === "deep-scan-pending" || scan.status === "deep-scan-running";

  const { summary, criterionGroups } = buildScanSummary(scan.findings);

  // Fetch recent scans for history (lightweight, no findings)
  const recentScans = await prisma.scan.findMany({
    where: { merchantId: merchant.id, status: "completed" },
    orderBy: { startedAt: "desc" },
    take: 11,
    select: {
      id: true,
      scanType: true,
      themeName: true,
      score: true,
      startedAt: true,
      completedAt: true,
      templateCount: true,
      _count: { select: { findings: true } },
    },
  });

  // Build per-scan severity counts for history + trend
  const scanIds = recentScans.map((s) => s.id);
  const severityCounts = scanIds.length > 0
    ? await prisma.finding.groupBy({
        by: ["scanId", "severity"],
        where: { scanId: { in: scanIds } },
        _count: { id: true },
      })
    : [];

  // Index severity counts by scanId
  const severityByScan = new Map<
    number,
    { critical: number; serious: number; moderate: number; minor: number; total: number }
  >();
  for (const row of severityCounts) {
    let entry = severityByScan.get(row.scanId);
    if (!entry) {
      entry = { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 };
      severityByScan.set(row.scanId, entry);
    }
    const count = row._count.id;
    entry.total += count;
    if (row.severity === "critical") entry.critical += count;
    else if (row.severity === "serious") entry.serious += count;
    else if (row.severity === "moderate") entry.moderate += count;
    else entry.minor += count;
  }

  const historyScans = recentScans.map((s) => {
    const counts = severityByScan.get(s.id) ?? {
      critical: 0, serious: 0, moderate: 0, minor: 0, total: 0,
    };
    return {
      id: s.id,
      scanType: s.scanType,
      themeName: s.themeName || "Active theme",
      score: s.score,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      templateCount: s.templateCount,
      findingCount: s._count.findings,
      critical: counts.critical,
      serious: counts.serious,
      total: counts.total,
    };
  });

  // Compute trend: compare latest vs previous completed scan of the same type.
  // Comparing across scan types (e.g. Deep vs Static) is misleading because
  // they run different checks and produce different finding counts.
  let trend: {
    totalDelta: number;
    criticalDelta: number;
  } | null = null;
  if (historyScans.length >= 2) {
    const latest = historyScans[0];
    const previous = historyScans.slice(1).find(
      (s) => s.scanType === latest.scanType,
    );
    if (previous) {
      trend = {
        totalDelta: latest.total - previous.total,
        criticalDelta: latest.critical - previous.critical,
      };
    }
  }

  return json({
    hasScan: true,
    scan: {
      id: scan.id,
      status: scan.status,
      scanType: scan.scanType,
      themeName: scan.themeName || "Active theme",
      completedAt: scan.completedAt?.toISOString() ?? null,
    },
    summary: {
      ...summary,
      filesScanned: scan.templateCount,
      completedAt: scan.completedAt?.toISOString() ?? null,
      status: scan.status,
    },
    criterionGroups,
    reportToken: scan.reportToken ?? null,
    billingStatus,
    isDeepScanning,
    score: scan.score,
    plan: merchant.plan,
    historyScans,
    trend,
  });
};

/** Source badge - describes how an issue was detected, in plain language. */
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

export default function DashboardPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll every 3s while a deep scan is in progress
  useEffect(() => {
    if (data.isDeepScanning) {
      intervalRef.current = setInterval(() => {
        if (revalidator.state === "idle") {
          revalidator.revalidate();
        }
      }, 3000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [data.isDeepScanning, revalidator]);

  const billingBanner = () => {
    if (data.billingStatus === "success") {
      return (
        <Layout.Section>
          <Banner title="Plan activated" tone="success" onDismiss={() => {}}>
            <p>Your subscription is now active.</p>
          </Banner>
        </Layout.Section>
      );
    }
    if (data.billingStatus === "declined") {
      return (
        <Layout.Section>
          <Banner title="Subscription not activated" tone="warning" onDismiss={() => {}}>
            <p>
              The subscription was not approved. You can try again from the
              billing page.
            </p>
          </Banner>
        </Layout.Section>
      );
    }
    return null;
  };

  if (!data.hasScan) {
    return (
      <Page title="Accessibility Auditor">
        <Layout>
          {billingBanner()}
          <Layout.Section>
            <EmptyState
              heading="No scans yet"
              action={{
                content: "Run your first scan",
                onAction: () => navigate("/app/scan"),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Scan your theme for WCAG 2.2 accessibility issues. We analyze
                your source code directly - no overlay widgets, no JavaScript
                injection.
              </p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const { summary, criterionGroups, reportToken, score, plan, trend, historyScans } = data;
  const isDeep = data.scan?.scanType === "deep";

  const rows = ((criterionGroups ?? []) as Array<{
    criterionId: string; count: number; severity: string; sources: string[];
  }>).map((g) => {
      const meta = WCAG_CRITERIA[g.criterionId];
      const base = [
        <div
          key={`crit-${g.criterionId}`}
          role="button"
          tabIndex={0}
          style={{ cursor: "pointer" }}
          onClick={() => navigate(`/app/findings/${g.criterionId}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate(`/app/findings/${g.criterionId}`);
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

      // Add source column for deep scans
      if (isDeep) {
        base.push(sourceBadge(g.sources));
      }

      return base;
    },
  );

  const reportUrl = reportToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/public/report/${reportToken}`
    : null;

  const tableHeadings = isDeep
    ? ["Criterion", "Count", "Severity", "Detected by"]
    : ["Criterion", "Count", "Severity"];

  const tableTypes = isDeep
    ? (["text", "numeric", "text", "text"] as const)
    : (["text", "numeric", "text"] as const);

  // History table rows
  const historyRows = ((historyScans ?? []) as Array<{
    id: number; scanType: string; themeName: string; score: number | null;
    completedAt: string | null; critical: number; serious: number; total: number;
  }>).map((s) => [
      <Button
        key={`hist-${s.id}`}
        variant="plain"
        onClick={() => navigate(`/app/history/${s.id}`)}
      >
        {s.completedAt ? new Date(s.completedAt).toLocaleDateString() : "In progress"}
      </Button>,
      s.themeName,
      <Badge
        key={`type-${s.id}`}
        tone={s.scanType === "deep" ? "success" : "info"}
      >
        {s.scanType === "deep" ? "Deep" : "Static"}
      </Badge>,
      s.score !== null && s.score !== undefined ? `${s.score}/100` : "--",
      s.critical.toString(),
      s.serious.toString(),
      s.total.toString(),
    ],
  );

  return (
    <Page
      title="Accessibility Auditor"
      primaryAction={{
        content: "Run New Scan",
        onAction: () => navigate("/app/scan"),
      }}
    >
      <Layout>
        {billingBanner()}

        {data.isDeepScanning && (
          <Layout.Section>
            <Banner title="Deep scan in progress" tone="info">
              <InlineStack gap="200" blockAlign="center">
                <Spinner size="small" />
                <p>Analyzing rendered pages with a real browser... This may take a minute.</p>
              </InlineStack>
            </Banner>
          </Layout.Section>
        )}

        {data.scan?.status === "failed" && (
          <Layout.Section>
            <Banner title="Scan failed" tone="critical">
              <p>
                The runtime scan encountered an error. Static findings are
                still available below. Try running a new deep scan.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {summary && summary.critical > 0 && (
          <Layout.Section>
            <Banner title="Critical issues found" tone="critical">
              <p>
                {summary.critical} critical accessibility{" "}
                {summary.critical === 1 ? "issue" : "issues"} detected that may
                make content inaccessible to some users.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {/* Trend banner */}
        {trend && (
          <Layout.Section>
            {trend.totalDelta < 0 ? (
              <Banner title="Improving" tone="success">
                <p>
                  {Math.abs(trend.totalDelta)} fewer{" "}
                  {Math.abs(trend.totalDelta) === 1 ? "issue" : "issues"} than
                  your previous scan.
                  {trend.criticalDelta < 0 &&
                    ` ${Math.abs(trend.criticalDelta)} fewer critical ${Math.abs(trend.criticalDelta) === 1 ? "issue" : "issues"}.`}
                </p>
              </Banner>
            ) : trend.totalDelta > 0 ? (
              <Banner title="More issues detected" tone="warning">
                <p>
                  {trend.totalDelta} more{" "}
                  {trend.totalDelta === 1 ? "issue" : "issues"} than your
                  previous scan.
                  {trend.criticalDelta > 0 &&
                    ` ${trend.criticalDelta} more critical ${trend.criticalDelta === 1 ? "issue" : "issues"}.`}
                </p>
              </Banner>
            ) : (
              <Banner title="No change" tone="info">
                <p>Issue count is the same as your previous scan.</p>
              </Banner>
            )}
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineStack gap="400" align="start" wrap={false}>
            {score !== null && score !== undefined && (
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Score
                  </Text>
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {score}/100
                  </Text>
                </BlockStack>
              </Card>
            )}
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Critical
                </Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {summary?.critical ?? 0}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Serious
                </Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {summary?.serious ?? 0}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Moderate
                </Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {summary?.moderate ?? 0}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Minor
                </Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {summary?.minor ?? 0}
                </Text>
              </BlockStack>
            </Card>
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

        {/* Free tier upgrade CTA */}
        {plan === "free" && summary && summary.total > 0 && (
          <Layout.Section>
            <CalloutCard
              title="See exactly where each issue is"
              illustration="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              primaryAction={{
                content: "Upgrade to Starter",
                url: "/app/billing",
              }}
            >
              <p>
                You have {summary.total} accessibility{" "}
                {summary.total === 1 ? "issue" : "issues"} across{" "}
                {summary.filesScanned} files. Upgrade to Starter to see exactly
                where each issue is and how to fix it.
              </p>
            </CalloutCard>
          </Layout.Section>
        )}

        {reportUrl && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Share Report
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Share a public HTML report of this scan. Anyone with the link
                  can view it, but the URL contains a 128-bit random token that
                  is not guessable.
                </Text>
                <InlineStack gap="300">
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(reportUrl);
                    }}
                  >
                    Copy Report Link
                  </Button>
                  <Button
                    url={reportUrl}
                    target="_blank"
                    variant="plain"
                  >
                    Open Report
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Scan History */}
        {historyScans && historyScans.length >= 2 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Scan History
                </Text>
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "text",
                    "text",
                    "numeric",
                    "numeric",
                    "numeric",
                  ]}
                  headings={[
                    "Date",
                    "Theme",
                    "Type",
                    "Score",
                    "Critical",
                    "Serious",
                    "Total",
                  ]}
                  rows={historyRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Theme: {data.scan?.themeName ?? "Unknown"}{" "}
                | Scan type: {isDeep ? "Deep (static + runtime)" : "Static"}{" "}
                | Last scan: {summary?.completedAt
                  ? new Date(summary.completedAt).toLocaleString()
                  : "In progress"}{" "}
                | Files scanned: {summary?.filesScanned ?? 0}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
