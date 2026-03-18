import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Button,
  Banner,
  ProgressBar,
} from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { getActiveTheme, fetchThemeFiles } from "~/lib/theme-fetcher.server";
import { scanTheme } from "~/lib/scanner.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await shopify.authenticate.admin(request);
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;

  // Ensure merchant record exists
  const merchant = await prisma.merchant.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });

  // Get active theme
  const theme = await getActiveTheme(admin);
  if (!theme) {
    return json(
      { error: "No active theme found. Please publish a theme first." },
      { status: 400 }
    );
  }

  // Fetch theme files
  const files = await fetchThemeFiles(admin, theme.id);
  if (files.length === 0) {
    return json(
      { error: "No scannable files found in the active theme." },
      { status: 400 }
    );
  }

  console.log(`[scan] Fetched ${files.length} theme files:`, files.map(f => f.filename));

  // Apply free plan file limit
  const filesToScan = merchant.plan === "free" ? files.slice(0, 5) : files;

  // Create scan record
  const scan = await prisma.scan.create({
    data: {
      merchantId: merchant.id,
      status: "running",
      templateCount: filesToScan.length,
    },
  });

  // Run the Rust scanner
  const result = scanTheme(filesToScan);

  // Store findings
  if (result.findings.length > 0) {
    await prisma.finding.createMany({
      data: result.findings.map((f) => ({
        scanId: scan.id,
        criterionId: f.criterionId,
        severity: f.severity,
        element: f.element,
        filePath: f.filePath,
        line: f.line,
        message: f.message,
        suggestion: f.suggestion,
      })),
    });
  }

  // Generate a secure report token and mark scan as complete
  const { randomBytes } = await import("node:crypto");
  const reportToken = randomBytes(16).toString("hex");

  await prisma.scan.update({
    where: { id: scan.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      reportToken,
    },
  });

  return redirect("/app");
};

export default function ScanPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isScanning = navigation.state === "submitting";

  return (
    <Page title="Run Accessibility Scan" backAction={{ url: "/app" }}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Scan Your Theme
              </Text>
              <Text as="p" variant="bodyMd">
                We will fetch your active theme files and analyze them for WCAG
                2.2 accessibility issues. This performs source-code analysis --
                no JavaScript is injected into your storefront.
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Checks include: missing alt text, heading hierarchy, color
                contrast, form labels, link purpose, focus indicators, target
                size, page language, and ARIA validation.
              </Text>

              {actionData && "error" in actionData && (
                <Banner tone="critical">{actionData.error}</Banner>
              )}

              {isScanning && (
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    Scanning theme files...
                  </Text>
                  <ProgressBar progress={75} size="small" />
                </BlockStack>
              )}

              <Form method="post">
                <Button
                  variant="primary"
                  submit
                  loading={isScanning}
                  disabled={isScanning}
                >
                  {isScanning ? "Scanning..." : "Start Scan"}
                </Button>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                What we check
              </Text>
              <ul style={{ paddingLeft: "1.5em", margin: 0 }}>
                <li>Missing image alt text (SC 1.1.1)</li>
                <li>Heading hierarchy (SC 1.3.1)</li>
                <li>Form input labels (SC 1.3.1)</li>
                <li>Color contrast (SC 1.4.3, 1.4.6)</li>
                <li>Generic link text (SC 2.4.4)</li>
                <li>Focus visibility (SC 2.4.7)</li>
                <li>Target size (SC 2.5.8)</li>
                <li>Page language (SC 3.1.1)</li>
                <li>ARIA validation (SC 4.1.2)</li>
              </ul>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
