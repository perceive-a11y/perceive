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
  Divider,
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

  // Apply free plan file limit
  const filesToScan = merchant.plan === "free" ? files.slice(0, 5) : files;

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

  // Generate a secure report token
  const { randomBytes } = await import("node:crypto");
  const reportToken = randomBytes(16).toString("hex");

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

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Deep Scan
                </Text>
                <Badge tone="info">Pro</Badge>
              </InlineStack>

              <Text as="p" variant="bodyMd">
                Combines static source analysis with runtime testing using a
                real browser. Catches contrast issues, computed accessible names,
                and dynamic content that source-only analysis misses.
              </Text>

              {isPro ? (
                <Form method="post">
                  <BlockStack gap="400">
                    <Select
                      label="Theme"
                      options={themeOptions}
                      value={selectedTheme}
                      onChange={setSelectedTheme}
                    />
                    <input type="hidden" name="themeId" value={selectedTheme} />
                    <input type="hidden" name="intent" value="deep-scan" />

                    <TextField
                      label="Store password"
                      type="password"
                      value={storePassword}
                      onChange={setStorePassword}
                      helpText={
                        hasStoredPassword
                          ? "Leave blank to use your saved password."
                          : "Required if your store is password-protected."
                      }
                      autoComplete="off"
                    />
                    <input type="hidden" name="storePassword" value={storePassword} />

                    <Button
                      variant="primary"
                      tone="success"
                      submit
                      loading={isScanning}
                      disabled={isScanning}
                    >
                      {isScanning ? "Scanning..." : "Start Deep Scan"}
                    </Button>
                  </BlockStack>
                </Form>
              ) : (
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Deep Scan is available on the Pro plan.
                  </Text>
                  <Button url="/app/billing">Upgrade to Pro</Button>
                </BlockStack>
              )}
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
              <Divider />
              <Text as="h3" variant="headingMd">
                Deep Scan adds
              </Text>
              <ul style={{ paddingLeft: "1.5em", margin: 0 }}>
                <li>Rendered contrast validation</li>
                <li>Computed accessible names</li>
                <li>Dynamic content checks</li>
                <li>Composite accessibility score</li>
              </ul>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
