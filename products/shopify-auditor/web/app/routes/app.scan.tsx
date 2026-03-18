import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Button,
  Banner,
  ProgressBar,
  Select,
} from "@shopify/polaris";
import { useState } from "react";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { getThemes, fetchThemeFiles } from "~/lib/theme-fetcher.server";
import { scanTheme } from "~/lib/scanner.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await shopify.authenticate.admin(request);
  const themes = await getThemes(admin);

  return json({
    themes: themes.map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role,
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const themeId = formData.get("themeId") as string | null;

  // Ensure merchant record exists
  const merchant = await prisma.merchant.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });

  // Resolve theme: use selected or fall back to active
  let theme;
  const themes = await getThemes(admin);
  if (themeId) {
    theme = themes.find((t) => t.id === themeId) ?? null;
  } else {
    theme = themes.find((t) => t.role === "MAIN") ?? null;
  }

  if (!theme) {
    return json(
      { error: "Theme not found. Please select a theme or publish one first." },
      { status: 400 }
    );
  }

  // Fetch theme files
  const files = await fetchThemeFiles(admin, theme.id);
  if (files.length === 0) {
    return json(
      { error: `No scannable files found in "${theme.name}".` },
      { status: 400 }
    );
  }

  console.log(`[scan] Scanning "${theme.name}" — ${files.length} files:`, files.map(f => f.filename));

  // Apply free plan file limit
  const filesToScan = merchant.plan === "free" ? files.slice(0, 5) : files;

  // Create scan record
  const scan = await prisma.scan.create({
    data: {
      merchantId: merchant.id,
      status: "running",
      templateCount: filesToScan.length,
      themeName: theme.name,
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

const ROLE_LABELS: Record<string, string> = {
  MAIN: "Published",
  UNPUBLISHED: "Unpublished",
  DEVELOPMENT: "Development",
  DEMO: "Demo",
};

export default function ScanPage() {
  const { themes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isScanning = navigation.state === "submitting";

  const activeTheme = themes.find((t) => t.role === "MAIN");
  const [selectedTheme, setSelectedTheme] = useState(activeTheme?.id ?? themes[0]?.id ?? "");

  const themeOptions = themes.map((t) => ({
    label: `${t.name} (${ROLE_LABELS[t.role] ?? t.role})`,
    value: t.id,
  }));

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
                We will fetch your theme files and analyze them for WCAG
                2.2 accessibility issues. This performs source-code analysis --
                no JavaScript is injected into your storefront.
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
                <BlockStack gap="400">
                  <Select
                    label="Theme"
                    options={themeOptions}
                    value={selectedTheme}
                    onChange={setSelectedTheme}
                  />
                  <input type="hidden" name="themeId" value={selectedTheme} />
                  <Button
                    variant="primary"
                    submit
                    loading={isScanning}
                    disabled={isScanning}
                  >
                    {isScanning ? "Scanning..." : "Start Scan"}
                  </Button>
                </BlockStack>
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
