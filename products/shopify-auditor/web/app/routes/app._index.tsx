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
} from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { SEVERITY_RANK, SEVERITY_TONE } from "~/lib/severity";
import { normalizeDedupeKey } from "~/lib/deep-scan.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const billingStatus = url.searchParams.get("billing");

  // Get merchant and latest scan
  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain },
    include: {
      scans: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: {
          findings: true,
        },
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
    });
  }

  const scan = merchant.scans[0];
  const findings = scan.findings;

  const isDeepScanning = scan.status === "deep-scan-pending"
    || scan.status === "deep-scan-running";

  // Deduplicate findings for display counts
  const deduped = new Map<string, { severity: string; sources: Set<string> }>();
  for (const f of findings) {
    const key = normalizeDedupeKey(f.criterionId, f.element);
    const existing = deduped.get(key);
    if (existing) {
      existing.sources.add(f.source);
      if ((SEVERITY_RANK[f.severity] ?? 4) < (SEVERITY_RANK[existing.severity] ?? 4)) {
        existing.severity = f.severity;
      }
    } else {
      deduped.set(key, { severity: f.severity, sources: new Set([f.source]) });
    }
  }

  // Compute summary from deduplicated findings
  let criticalCount = 0;
  let seriousCount = 0;
  let moderateCount = 0;
  let minorCount = 0;
  for (const f of deduped.values()) {
    switch (f.severity) {
      case "critical": criticalCount++; break;
      case "serious": seriousCount++; break;
      case "moderate": moderateCount++; break;
      default: minorCount++; break;
    }
  }

  const summary = {
    critical: criticalCount,
    serious: seriousCount,
    moderate: moderateCount,
    minor: minorCount,
    total: deduped.size,
    filesScanned: scan.templateCount,
    completedAt: scan.completedAt?.toISOString() ?? null,
    status: scan.status,
  };

  // Group findings by criterion for the table
  // Track sources per criterion group for the "Source" column
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

  // Serialize sources (Sets aren't JSON-serializable), sort by severity
  const criterionGroups = Array.from(byCriterion.values())
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4))
    .map((g) => ({
      criterionId: g.criterionId,
      count: g.count,
      severity: g.severity,
      sources: Array.from(g.sources),
    }));

  return json({
    hasScan: true,
    scan: {
      id: scan.id,
      status: scan.status,
      scanType: scan.scanType,
      themeName: scan.themeName || "Active theme",
      completedAt: scan.completedAt?.toISOString() ?? null,
    },
    summary,
    criterionGroups,
    reportToken: scan.reportToken ?? null,
    billingStatus,
    isDeepScanning,
    score: scan.score,
  });
};

/** Source badge — describes how an issue was detected, in plain language. */
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
                your source code directly -- no overlay widgets, no JavaScript
                injection.
              </p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const { summary, criterionGroups, reportToken, score } = data;
  const isDeep = data.scan?.scanType === "deep";

  const rows = (criterionGroups ?? []).map(
    (g: { criterionId: string; count: number; severity: string; sources: string[] }) => {
      const base = [
        <Button
          key={`crit-${g.criterionId}`}
          variant="plain"
          onClick={() => navigate(`/app/findings/${g.criterionId}`)}
        >
          {g.criterionId}
        </Button>,
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
