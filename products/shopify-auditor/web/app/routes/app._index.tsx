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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;

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
    return json({ hasScan: false, scan: null, summary: null });
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
      completedAt: scan.completedAt?.toISOString() ?? null,
    },
    summary,
    criterionGroups: Array.from(byCriterion.values()),
  });
};

export default function DashboardPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  if (!data.hasScan) {
    return (
      <Page title="Accessibility Auditor">
        <Layout>
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
                your source code directly — no overlay widgets, no JavaScript
                injection.
              </p>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const { summary, criterionGroups } = data;

  const severityBadge = (severity: string) => {
    const toneMap: Record<string, "critical" | "warning" | "attention" | "info"> = {
      critical: "critical",
      serious: "warning",
      moderate: "attention",
      minor: "info",
    };
    return <Badge tone={toneMap[severity] ?? "info"}>{severity}</Badge>;
  };

  const rows = (criterionGroups ?? []).map(
    (g: { criterionId: string; count: number; severity: string }) => [
      g.criterionId,
      g.count.toString(),
      g.severity,
    ]
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
                columnContentTypes={["text", "numeric", "text"]}
                headings={["Criterion", "Count", "Severity"]}
                rows={rows}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Last scan: {summary?.completedAt
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
