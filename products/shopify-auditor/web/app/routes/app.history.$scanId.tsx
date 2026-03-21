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
} from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { SEVERITY_TONE } from "~/lib/severity";
import { buildScanSummary } from "~/lib/scan-summary.server";
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
    include: {
      findings: true,
      merchant: { select: { shopDomain: true } },
    },
  });

  if (!scan || scan.merchant.shopDomain !== shopDomain) {
    throw new Response("Scan not found", { status: 404 });
  }

  const { summary, criterionGroups } = buildScanSummary(scan.findings);

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
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/public/report/${scan.reportToken}`
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
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Score</Text>
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {scan.score}/100
                  </Text>
                </BlockStack>
              </Card>
            )}
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">Critical</Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {summary.critical}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">Serious</Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {summary.serious}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">Moderate</Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {summary.moderate}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">Minor</Text>
                <Text as="p" variant="headingLg" fontWeight="bold">
                  {summary.minor}
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
                <Text as="h2" variant="headingMd">Share Report</Text>
                <InlineStack gap="300">
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(reportUrl);
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
