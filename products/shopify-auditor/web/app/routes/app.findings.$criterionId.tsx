import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Box,
  CalloutCard,
} from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { SEVERITY_RANK, SEVERITY_TONE } from "~/lib/severity";
import { WCAG_CRITERIA } from "~/lib/wcag-criteria";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;
  const criterionId = params.criterionId;

  if (!criterionId) {
    throw new Response("Missing criterion ID", { status: 400 });
  }

  const url = new URL(request.url);
  const scanIdParam = url.searchParams.get("scanId");

  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain },
  });

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }

  // Resolve the target scan: explicit scanId or latest completed
  let targetScanId: number;
  if (scanIdParam) {
    const scanId = Number(scanIdParam);
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { id: true, merchantId: true, scanType: true },
    });
    if (!scan || scan.merchantId !== merchant.id) {
      throw new Response("Scan not found", { status: 404 });
    }
    targetScanId = scan.id;
  } else {
    const latestScan = await prisma.scan.findFirst({
      where: { merchantId: merchant.id, status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { id: true, scanType: true },
    });
    if (!latestScan) {
      throw new Response("No completed scans found", { status: 404 });
    }
    targetScanId = latestScan.id;
  }

  const scan = await prisma.scan.findUnique({
    where: { id: targetScanId },
    select: { id: true, scanType: true },
  });

  // Free plan: show summary only, gate detailed findings
  if (merchant.plan === "free") {
    const countResult = await prisma.finding.groupBy({
      by: ["severity"],
      where: { scanId: targetScanId, criterionId },
      _count: { id: true },
    });

    const severityBreakdown: Record<string, number> = {};
    let totalCount = 0;
    for (const row of countResult) {
      severityBreakdown[row.severity] = row._count.id;
      totalCount += row._count.id;
    }

    return json({
      criterionId,
      gated: true,
      count: totalCount,
      severityBreakdown,
      isDeep: scan?.scanType === "deep",
      findings: [],
      scanId: scanIdParam ? Number(scanIdParam) : null,
    });
  }

  const findings = await prisma.finding.findMany({
    where: { scanId: targetScanId, criterionId },
  });

  // Sort by severity in JS (SQLite can't sort custom enums)
  findings.sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4),
  );

  return json({
    criterionId,
    gated: false,
    count: findings.length,
    severityBreakdown: null,
    isDeep: scan?.scanType === "deep",
    findings: findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      element: f.element,
      filePath: f.filePath,
      line: f.line,
      message: f.message,
      suggestion: f.suggestion,
      source: f.source,
      pageUrl: f.pageUrl,
    })),
    scanId: scanIdParam ? Number(scanIdParam) : null,
  });
};

interface Finding {
  id: number;
  severity: string;
  element: string;
  filePath: string;
  line: number;
  message: string;
  suggestion: string;
  source: string;
  pageUrl: string;
}

/** Display the appropriate source badge in plain language. */
function SourceBadge({ source }: { source: string }) {
  switch (source) {
    case "axe":
      return <Badge tone="info">Browser</Badge>;
    case "lighthouse":
      return <Badge tone="attention">Lighthouse</Badge>;
    default:
      return <Badge>Source code</Badge>;
  }
}

export default function FindingsDetailPage() {
  const {
    criterionId,
    findings,
    isDeep,
    gated,
    count,
    severityBreakdown,
    scanId,
  } = useLoaderData<typeof loader>();

  const meta = WCAG_CRITERIA[criterionId];
  const backUrl = scanId ? `/app/history/${scanId}` : "/app";

  const title = meta
    ? `SC ${criterionId} - ${meta.name}`
    : `WCAG ${criterionId}`;
  const subtitle = meta?.description
    ? `${count} ${count === 1 ? "finding" : "findings"} - ${meta.description}`
    : `${count} ${count === 1 ? "finding" : "findings"}`;

  // Gated view for free plan
  if (gated) {
    return (
      <Page title={title} subtitle={subtitle} backAction={{ url: backUrl }}>
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  {count} {count === 1 ? "finding" : "findings"} for this
                  criterion
                </Text>
                {severityBreakdown && (
                  <InlineStack gap="200">
                    {Object.entries(severityBreakdown)
                      .sort(
                        ([a], [b]) =>
                          (SEVERITY_RANK[a] ?? 4) - (SEVERITY_RANK[b] ?? 4),
                      )
                      .map(([sev, n]) => (
                        <Badge
                          key={sev}
                          tone={SEVERITY_TONE[sev] ?? "info"}
                        >
                          {`${n} ${sev}`}
                        </Badge>
                      ))}
                  </InlineStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <CalloutCard
              title="See detailed findings"
              illustration="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              primaryAction={{
                content: "Upgrade to Starter",
                url: "/app/billing",
              }}
            >
              <p>
                Upgrade to Starter to see exactly where each issue is - file
                paths, line numbers, and fix suggestions for every finding.
              </p>
            </CalloutCard>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title={title} subtitle={subtitle} backAction={{ url: backUrl }}>
      <Layout>
        {findings.length === 0 ? (
          <Layout.Section>
            <Card>
              <Text as="p" variant="bodyMd">
                No findings for this criterion.
              </Text>
            </Card>
          </Layout.Section>
        ) : (
          (findings as Finding[]).map((f) => (
            <Layout.Section key={f.id}>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {f.source === "axe" && f.pageUrl ? (
                        <code>{f.pageUrl}</code>
                      ) : (
                        <code>{f.filePath}:{f.line}</code>
                      )}
                    </Text>
                    <InlineStack gap="200">
                      {isDeep && <SourceBadge source={f.source} />}
                      <Badge tone={SEVERITY_TONE[f.severity] ?? "info"}>
                        {f.severity}
                      </Badge>
                    </InlineStack>
                  </InlineStack>

                  <Text as="p" variant="bodySm" tone="subdued">
                    Element: <code>{f.element}</code>
                  </Text>

                  <Text as="p" variant="bodyMd">
                    {f.message}
                  </Text>

                  {f.suggestion && (
                    <Box
                      background="bg-surface-secondary"
                      padding="300"
                      borderRadius="200"
                    >
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" fontWeight="semibold">
                          Suggestion
                        </Text>
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            fontFamily: "monospace",
                            fontSize: "0.85em",
                          }}
                        >
                          {f.suggestion}
                        </pre>
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          ))
        )}
      </Layout>
    </Page>
  );
}
