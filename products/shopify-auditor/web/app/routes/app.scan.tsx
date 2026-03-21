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
  TextField,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { useState } from "react";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { getThemes, fetchThemeFiles } from "~/lib/theme-fetcher.server";
import { scanTheme } from "~/lib/scanner.server";
import { encrypt } from "~/lib/crypto.server";
import { isDeepScanRunning, forkDeepScanWorker } from "~/lib/deep-scan.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;
  const themes = await getThemes(admin);

  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain },
  });

  return json({
    themes: themes.map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role,
    })),
    plan: merchant?.plan ?? "free",
    hasStoredPassword: !!merchant?.storePassword,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const themeId = formData.get("themeId") as string | null;
  const intent = formData.get("intent") as string | null;
  const storePassword = formData.get("storePassword") as string | null;

  // Ensure merchant record exists
  const merchant = await prisma.merchant.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });

  // Gate deep scan to pro plan
  if (intent === "deep-scan" && merchant.plan !== "pro") {
    return json({ error: "Deep Scan requires the Pro plan." }, { status: 403 });
  }

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

  // All plans scan all files
  const filesToScan = files;

  const isDeep = intent === "deep-scan";
  const scanType = isDeep ? "deep" : "static";

  // For deep scans, check no scan is already running
  if (isDeep) {
    const running = await isDeepScanRunning(merchant.id);
    if (running) {
      return json(
        { error: "A deep scan is already in progress. Please wait for it to complete." },
        { status: 409 }
      );
    }
  }

  // Create scan record
  const scan = await prisma.scan.create({
    data: {
      merchantId: merchant.id,
      status: "running",
      scanType,
      templateCount: filesToScan.length,
      themeName: theme.name,
    },
  });

  // Run the Rust static scanner
  const result = scanTheme(filesToScan);

  // Store static findings
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
        source: "static",
      })),
    });
  }

  // Generate a secure report token (paid plans only)
  const { randomBytes } = await import("node:crypto");
  const reportToken = merchant.plan !== "free"
    ? randomBytes(16).toString("hex")
    : null;

  if (isDeep) {
    // Encrypt and store password if provided
    let encryptedPassword = merchant.storePassword;
    if (storePassword) {
      encryptedPassword = encrypt(storePassword);
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { storePassword: encryptedPassword },
      });
    }

    // Set report token but keep scan open for the worker to finalize
    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "deep-scan-pending",
        reportToken,
      },
    });

    // Fork the deep scan worker
    const pid = await forkDeepScanWorker(
      scan.id,
      shopDomain,
      encryptedPassword,
    );
    console.log(`[scan] Deep scan worker forked (PID: ${pid}) for scan ${scan.id}`);
  } else {
    // Static-only scan: mark complete immediately
    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        reportToken,
      },
    });
  }

  return redirect("/app");
};

const ROLE_LABELS: Record<string, string> = {
  MAIN: "Published",
  UNPUBLISHED: "Unpublished",
  DEVELOPMENT: "Development",
  DEMO: "Demo",
};

export default function ScanPage() {
  const { themes, plan, hasStoredPassword } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isScanning = navigation.state === "submitting";

  const activeTheme = themes.find((t) => t.role === "MAIN");
  const [selectedTheme, setSelectedTheme] = useState(activeTheme?.id ?? themes[0]?.id ?? "");
  const [storePassword, setStorePassword] = useState("");

  const themeOptions = themes.map((t) => ({
    label: `${t.name} (${ROLE_LABELS[t.role] ?? t.role})`,
    value: t.id,
  }));

  const isPro = plan === "pro";

  return (
    <Page title="Run Accessibility Scan" backAction={{ url: "/app" }}>
      <Layout>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="p" variant="bodyMd">
                Analyzes your theme for WCAG 2.2 accessibility issues across
                14 success criteria. Nothing is injected into your storefront.
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

              <Select
                label="Theme"
                options={themeOptions}
                value={selectedTheme}
                onChange={setSelectedTheme}
              />

              {isPro && (
                <TextField
                  label="Store password"
                  type="password"
                  value={storePassword}
                  onChange={setStorePassword}
                  helpText={
                    hasStoredPassword
                      ? "Leave blank to use your saved password."
                      : "Only needed if your store is password-protected."
                  }
                  autoComplete="off"
                />
              )}

              <Form method="post">
                <input type="hidden" name="themeId" value={selectedTheme} />
                {isPro && (
                  <>
                    <input type="hidden" name="intent" value="deep-scan" />
                    <input type="hidden" name="storePassword" value={storePassword} />
                  </>
                )}
                <Button
                  variant="primary"
                  submit
                  loading={isScanning}
                  disabled={isScanning}
                >
                  {isScanning ? "Scanning..." : "Start Scan"}
                </Button>
              </Form>

              {isPro && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Your scan includes Deep Scan - source analysis plus
                  real-browser testing.
                </Text>
              )}

              {!isPro && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Pro plan adds Deep Scan: real-browser testing for rendered
                  contrast, computed accessible names, and a composite score.{" "}
                  <Button variant="plain" url="/app/billing">
                    Upgrade to Pro
                  </Button>
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                What we check
              </Text>
              <ul style={{ paddingLeft: "1.5em", margin: 0 }}>
                <li>Image alt text (SC 1.1.1)</li>
                <li>Heading hierarchy and form structure (SC 1.3.1)</li>
                <li>Input autocomplete attributes (SC 1.3.5)</li>
                <li>Color contrast - AA and AAA (SC 1.4.3, 1.4.6)</li>
                <li>Skip navigation links (SC 2.4.1)</li>
                <li>Page titles (SC 2.4.2)</li>
                <li>Link purpose and generic link text (SC 2.4.4)</li>
                <li>Heading and label quality (SC 2.4.6)</li>
                <li>Focus visibility (SC 2.4.7)</li>
                <li>Label in name (SC 2.5.3)</li>
                <li>Touch target size - AA and AAA (SC 2.5.5, 2.5.8)</li>
                <li>Page language (SC 3.1.1)</li>
                <li>Form labels and instructions (SC 3.3.2)</li>
                <li>ARIA roles and attributes (SC 4.1.2)</li>
              </ul>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="headingMd">
                  Deep Scan adds
                </Text>
                <Badge tone="info">Pro</Badge>
              </InlineStack>
              <InlineStack gap="800" align="start">
                <ul style={{ paddingLeft: "1.5em", margin: 0 }}>
                  <li>Rendered contrast validation in a real browser</li>
                  <li>Computed accessible names for interactive elements</li>
                  <li>Composite accessibility score (0-100)</li>
                </ul>
                <ul style={{ paddingLeft: "1.5em", margin: 0 }}>
                  <li>Color-only link distinction (SC 1.4.1)</li>
                  <li>Focus order and tabindex issues (SC 2.4.3)</li>
                  <li>Language of parts (SC 3.1.2)</li>
                </ul>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
