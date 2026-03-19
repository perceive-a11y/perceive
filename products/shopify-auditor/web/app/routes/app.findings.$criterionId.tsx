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
} from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { SEVERITY_RANK, SEVERITY_TONE } from "~/lib/severity";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;
  const criterionId = params.criterionId;

  if (!criterionId) {
    throw new Response("Missing criterion ID", { status: 400 });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain },
    include: {
      scans: {
        where: { status: "completed" },
        orderBy: { completedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!merchant || merchant.scans.length === 0) {
    throw new Response("No completed scans found", { status: 404 });
  }

  const latestScan = merchant.scans[0];

  const findings = await prisma.finding.findMany({
    where: {
      scanId: latestScan.id,
      criterionId,
    },
  });

  // Sort by severity in JS (SQLite can't sort custom enums)
  findings.sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4),
  );

  return json({
    criterionId,
    isDeep: latestScan.scanType === "deep",
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
  const { criterionId, findings, isDeep } = useLoaderData<typeof loader>();

  return (
    <Page
      title={`WCAG ${criterionId}`}
      subtitle={`${findings.length} ${findings.length === 1 ? "finding" : "findings"}`}
      backAction={{ url: "/app" }}
    >
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
          findings.map((f: Finding) => (
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
