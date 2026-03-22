import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useRevalidator, useNavigation } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  Tooltip,
  Icon,
} from "@shopify/polaris";
import { InfoIcon } from "@shopify/polaris-icons";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { SEVERITY_TONE, SEVERITY_RANK, SEVERITY_COLOR } from "~/lib/severity";
import { WCAG_CRITERIA } from "~/lib/wcag-criteria";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const billingStatus = url.searchParams.get("billing");

  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain },
  });

  if (!merchant) {
    return json({
      hasScan: false,
      scan: null,
      summary: null,
      criterionGroups: null,
      reportToken: null,
      billingStatus,
      isDeepScanning: false,
      staleScanFailed: false,
      score: null,
      plan: "free",
      historyScans: [],
      trend: null,
    });
  }

  // Fetch latest scan (lightweight — no findings)
  const latestScan = await prisma.scan.findFirst({
    where: { merchantId: merchant.id },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      scanType: true,
      themeName: true,
      score: true,
      templateCount: true,
      reportToken: true,
      startedAt: true,
      completedAt: true,
    },
  });

  if (!latestScan) {
    return json({
      hasScan: false,
      scan: null,
      summary: null,
      criterionGroups: null,
      reportToken: null,
      billingStatus,
      isDeepScanning: false,
      staleScanFailed: false,
      score: null,
      plan: merchant.plan,
      historyScans: [],
      trend: null,
    });
  }

  // Auto-fail scans stuck in a deep-scan state past the guardian timeout.
  // The in-memory setTimeout guardian doesn't survive process restarts.
  const STALE_SCAN_MS = 6 * 60 * 1000;
  let staleScanFailed = false;
  if (
    (latestScan.status === "deep-scan-pending" ||
      latestScan.status === "deep-scan-running") &&
    Date.now() - new Date(latestScan.startedAt).getTime() > STALE_SCAN_MS
  ) {
    await prisma.scan.update({
      where: { id: latestScan.id },
      data: { status: "failed" },
    });
    latestScan.status = "failed";
    staleScanFailed = true;
  }

  const isDeepScanning =
    latestScan.status === "deep-scan-pending" ||
    latestScan.status === "deep-scan-running";

  // Use groupBy to compute summary + criterion groups without loading all rows
  const [severityGroups, criterionSeverityGroups, recentScans] =
    await Promise.all([
      prisma.finding.groupBy({
        by: ["severity"],
        where: { scanId: latestScan.id },
        _count: { id: true },
      }),
      prisma.finding.groupBy({
        by: ["criterionId", "severity", "source"],
        where: { scanId: latestScan.id },
        _count: { id: true },
      }),
      prisma.scan.findMany({
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
      }),
    ]);

  // Build severity summary from groupBy
  const summary = { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 };
  for (const row of severityGroups) {
    const count = row._count.id;
    summary.total += count;
    if (row.severity === "critical") summary.critical += count;
    else if (row.severity === "serious") summary.serious += count;
    else if (row.severity === "moderate") summary.moderate += count;
    else summary.minor += count;
  }

  // Build criterion groups from groupBy results
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

  // Build per-scan severity counts for history + trend
  const scanIds = recentScans.map((s) => s.id);
  const severityCounts =
    scanIds.length > 0
      ? await prisma.finding.groupBy({
          by: ["scanId", "severity"],
          where: { scanId: { in: scanIds } },
          _count: { id: true },
        })
      : [];

  const severityByScan = new Map<
    number,
    {
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
      total: number;
    }
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
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      total: 0,
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

  // Compute trend: compare latest vs previous completed scan of the same type
  let trend: { totalDelta: number; criticalDelta: number } | null = null;
  if (historyScans.length >= 2) {
    const latest = historyScans[0];
    const previous = historyScans
      .slice(1)
      .find((s) => s.scanType === latest.scanType);
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
      id: latestScan.id,
      status: latestScan.status,
      scanType: latestScan.scanType,
      themeName: latestScan.themeName || "Active theme",
      completedAt: latestScan.completedAt?.toISOString() ?? null,
    },
    summary: {
      ...summary,
      filesScanned: latestScan.templateCount,
      completedAt: latestScan.completedAt?.toISOString() ?? null,
      status: latestScan.status,
    },
    criterionGroups,
    reportToken: latestScan.reportToken ?? null,
    billingStatus,
    isDeepScanning,
    score: latestScan.score,
    staleScanFailed,
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

/** Skeleton fallback shown during route transitions. */
function DashboardSkeleton() {
  return (
    <SkeletonPage title="Accessibility Auditor" primaryAction>
      <Layout>
        <Layout.Section>
          <InlineStack gap="400" align="start" wrap={false}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <BlockStack gap="200">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={1} />
                </BlockStack>
              </Card>
            ))}
          </InlineStack>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={5} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}

export default function DashboardPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const navigation = useNavigation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const [pollStatus, setPollStatus] = useState<string | null>(null);
  const [dismissedFailBanner, setDismissedFailBanner] = useState(false);

  // Max polls before giving up (~2 min at 5s interval).
  // The backend auto-fails stale scans at query time, so this is just a safety net.
  const MAX_POLLS = 24;

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Lightweight poll: hit the scan-status resource route instead of
  // revalidating the entire dashboard. Only revalidate on completion.
  const pollScanStatus = useCallback(async () => {
    if (!data.scan?.id) return;

    pollCountRef.current++;
    if (pollCountRef.current >= MAX_POLLS) {
      stopPolling();
      if (revalidator.state === "idle") {
        revalidator.revalidate();
      }
      return;
    }

    try {
      const res = await fetch(`/app/scan-status?scanId=${data.scan.id}`);
      if (!res.ok) return;
      const { status } = await res.json();
      setPollStatus(status);
      if (status === "completed" || status === "failed") {
        stopPolling();
        if (revalidator.state === "idle") {
          revalidator.revalidate();
        }
      }
    } catch {
      // Silently ignore network errors during polling
    }
  }, [data.scan?.id, revalidator, stopPolling]);

  useEffect(() => {
    if (data.isDeepScanning) {
      pollCountRef.current = 0;
      intervalRef.current = setInterval(pollScanStatus, 5000);
    }

    return () => {
      stopPolling();
    };
  }, [data.isDeepScanning, pollScanStatus, stopPolling]);

  // Show skeleton during route transitions
  if (navigation.state === "loading") {
    return <DashboardSkeleton />;
  }

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

  const reportUrl = reportToken ? `/public/report/${reportToken}` : null;

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

        {data.scan?.status === "failed" && !data.staleScanFailed && !dismissedFailBanner && (
          <Layout.Section>
            <Banner
              title="Deep scan incomplete"
              tone="warning"
              onDismiss={() => setDismissedFailBanner(true)}
            >
              <p>
                The runtime scan could not be completed. Static findings are
                still available below. Try running a new scan.
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
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200">
                    <InlineStack gap="100" align="start" blockAlign="center">
                      <Text as="h3" variant="headingMd">
                        Score
                      </Text>
                      <Tooltip content="Starts at 100, minus 15 per critical, 8 per serious, 3 per moderate, and 1 per minor issue.">
                        <Icon source={InfoIcon} tone="subdued" />
                      </Tooltip>
                    </InlineStack>
                    <Text as="p" variant="headingLg" fontWeight="bold">
                      {score}/100
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
                        {summary?.[severity] ?? 0}
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
                      const fullUrl = `${window.location.origin}${reportUrl}`;
                      navigator.clipboard.writeText(fullUrl);
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
