import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
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
} from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { SEVERITY_RANK, SEVERITY_TONE } from "~/lib/severity";

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
    });
  }

  const scan = merchant.scans[0];
  const findings = scan.findings;

  // Compute summary counts
  const summary = {
    critical: findings.filter((f) => f.severity === "critical").length,
    serious: findings.filter((f) => f.severity === "serious").length,
    moderate: findings.filter((f) => f.severity === "moderate").length,
    minor: findings.filter((f) => f.severity === "minor").length,
    total: findings.length,
    filesScanned: scan.templateCount,
    completedAt: scan.completedAt?.toISOString() ?? null,
    status: scan.status,
  };

  // Group findings by criterion for the table
  const byCriterion = new Map<
    string,
    { criterionId: string; count: number; severity: string }
  >();
  for (const f of findings) {
    const existing = byCriterion.get(f.criterionId);
    if (existing) {
      existing.count++;
      // Keep the most severe level for the group
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
      });
    }
  }

  return json({
    hasScan: true,
    scan: {
      id: scan.id,
      status: scan.status,
      themeName: scan.themeName || "Active theme",
      completedAt: scan.completedAt?.toISOString() ?? null,
    },
    summary,
    criterionGroups: Array.from(byCriterion.values()),
    reportToken: scan.reportToken ?? null,
    billingStatus,
  });
};

export default function DashboardPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

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

  const { summary, criterionGroups, reportToken } = data;

  const rows = (criterionGroups ?? []).map(
    (g: { criterionId: string; count: number; severity: string }) => [
      g.criterionId,
      g.count.toString(),
      <Badge key={g.criterionId} tone={SEVERITY_TONE[g.severity] ?? "info"}>
        {g.severity}
      </Badge>,
      <Button
        key={`btn-${g.criterionId}`}
        variant="plain"
        onClick={() => navigate(`/app/findings/${g.criterionId}`)}
      >
        View
      </Button>,
    ],
  );

  const reportUrl = reportToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/public/report/${reportToken}`
    : null;

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
          <BlockStack gap="400">
            <InlineStack gap="400" align="start">
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
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Findings by WCAG Criterion
              </Text>
              <DataTable
                columnContentTypes={["text", "numeric", "text", "text"]}
                headings={["Criterion", "Count", "Severity", ""]}
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
