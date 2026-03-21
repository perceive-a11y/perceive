import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Button,
  TextField,
  Banner,
  InlineStack,
  CalloutCard,
  Badge,
} from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";
import { WCAG_CRITERIA } from "~/lib/wcag-criteria";

/** Map criterion IDs to merchant-friendly limitation descriptions. */
const LIMITATION_DESCRIPTIONS: Record<string, string> = {
  "1.1.1": "Some images may lack descriptive alternative text",
  "1.3.1": "Some content structure may not be fully conveyed to assistive technology",
  "1.3.5": "Some form fields may not identify their input purpose for auto-fill",
  "1.4.1": "Some information may be conveyed by color alone",
  "1.4.3": "Some text may not meet minimum contrast requirements",
  "1.4.6": "Some text may not meet enhanced contrast requirements",
  "2.4.1": "Some pages may lack a mechanism to bypass repeated navigation",
  "2.4.2": "Some pages may not have descriptive titles",
  "2.4.3": "Focus order may not follow a logical sequence on some pages",
  "2.4.4": "Some link text may not clearly describe the link destination",
  "2.4.6": "Some headings or labels may not adequately describe their content",
  "2.4.7": "Keyboard focus may not be visible on some interactive elements",
  "2.4.10": "Some content sections may not be organized with headings",
  "2.5.3": "Some controls may have accessible names that differ from their visible label",
  "2.5.5": "Some touch targets may not meet enhanced size requirements",
  "2.5.8": "Some touch targets may not meet minimum size requirements",
  "3.1.1": "Page language may not be programmatically identified",
  "3.1.2": "Language changes within content may not be identified",
  "3.3.2": "Some form inputs may lack visible labels or instructions",
  "4.1.2": "Some interactive elements may lack proper ARIA attributes",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;

  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain },
  });

  if (!merchant) {
    return json({
      plan: "free",
      hasScan: false,
      accessibilityEmail: "",
      organizationName: "",
      statementHtml: null,
      conformanceLevel: null,
      limitations: [] as string[],
      auditDate: null,
    });
  }

  // Find latest completed scan
  const latestScan = await prisma.scan.findFirst({
    where: { merchantId: merchant.id, status: "completed" },
    orderBy: { completedAt: "desc" },
    select: { id: true, completedAt: true },
  });

  if (!latestScan) {
    return json({
      plan: merchant.plan,
      hasScan: false,
      accessibilityEmail: merchant.accessibilityEmail ?? "",
      organizationName: merchant.organizationName ?? "",
      statementHtml: null,
      conformanceLevel: null,
      limitations: [] as string[],
      auditDate: null,
    });
  }

  // Get severity counts from latest scan
  const severityGroups = await prisma.finding.groupBy({
    by: ["severity"],
    where: { scanId: latestScan.id },
    _count: { id: true },
  });

  let critical = 0;
  let serious = 0;
  for (const row of severityGroups) {
    if (row.severity === "critical") critical = row._count.id;
    else if (row.severity === "serious") serious = row._count.id;
  }

  const isConformant = critical === 0 && serious === 0;
  const conformanceLevel = isConformant
    ? "Conformant with WCAG 2.2 Level AA"
    : "Partially conformant with WCAG 2.2 Level AA";

  // Get distinct criteria with critical/serious findings for limitations
  const criteriaWithIssues = await prisma.finding.groupBy({
    by: ["criterionId"],
    where: {
      scanId: latestScan.id,
      severity: { in: ["critical", "serious"] },
    },
  });

  const limitations = criteriaWithIssues
    .map((row) => LIMITATION_DESCRIPTIONS[row.criterionId])
    .filter((desc): desc is string => !!desc);

  return json({
    plan: merchant.plan,
    hasScan: true,
    accessibilityEmail: merchant.accessibilityEmail ?? "",
    organizationName: merchant.organizationName ?? "",
    statementHtml: null,
    conformanceLevel,
    limitations,
    auditDate: latestScan.completedAt?.toISOString() ?? null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const accessibilityEmail = (formData.get("accessibilityEmail") as string) ?? "";
  const organizationName = (formData.get("organizationName") as string) ?? "";

  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain },
  });

  if (!merchant) {
    return json({ error: "No merchant record found.", statementHtml: null });
  }

  // Gate behind Starter+ tier
  if (merchant.plan === "free") {
    return json({ error: "Upgrade to Starter to generate statements.", statementHtml: null });
  }

  // Save contact info
  await prisma.merchant.update({
    where: { id: merchant.id },
    data: {
      accessibilityEmail: accessibilityEmail || null,
      organizationName: organizationName || null,
      statementGeneratedAt: new Date(),
    },
  });

  // Find latest completed scan
  const latestScan = await prisma.scan.findFirst({
    where: { merchantId: merchant.id, status: "completed" },
    orderBy: { completedAt: "desc" },
    select: { id: true, completedAt: true },
  });

  if (!latestScan) {
    return json({ error: "No completed scan found. Run a scan first.", statementHtml: null });
  }

  // Compute conformance
  const severityGroups = await prisma.finding.groupBy({
    by: ["severity"],
    where: { scanId: latestScan.id },
    _count: { id: true },
  });

  let critical = 0;
  let serious = 0;
  for (const row of severityGroups) {
    if (row.severity === "critical") critical = row._count.id;
    else if (row.severity === "serious") serious = row._count.id;
  }

  const isConformant = critical === 0 && serious === 0;
  const conformanceLevel = isConformant
    ? "Conformant with WCAG 2.2 Level AA"
    : "Partially conformant with WCAG 2.2 Level AA";

  // Limitations from critical/serious findings
  const criteriaWithIssues = await prisma.finding.groupBy({
    by: ["criterionId"],
    where: {
      scanId: latestScan.id,
      severity: { in: ["critical", "serious"] },
    },
  });

  const limitations = criteriaWithIssues
    .map((row) => LIMITATION_DESCRIPTIONS[row.criterionId])
    .filter((desc): desc is string => !!desc);

  const auditDate = latestScan.completedAt?.toISOString() ?? new Date().toISOString();
  const formattedDate = new Date(auditDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const orgDisplay = organizationName || shopDomain;
  const emailHtml = accessibilityEmail
    ? `<a href="mailto:${esc(accessibilityEmail)}">${esc(accessibilityEmail)}</a>`
    : "[accessibility contact email]";

  const limitationsHtml = limitations.length > 0
    ? `
<h2>Known Limitations</h2>

<p>Despite our efforts to ensure accessibility, some areas may have limitations:</p>

<ul>
${limitations.map((l) => `  <li>${esc(l)}</li>`).join("\n")}
</ul>

<p>We are actively working to resolve these issues.</p>`
    : "";

  const statementHtml = `<h1>Accessibility Statement</h1>

<p><strong>${esc(orgDisplay)}</strong> is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply the relevant accessibility standards.</p>

<br>

<h2>Conformance Status</h2>

<p>The <a href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noopener noreferrer">Web Content Accessibility Guidelines (WCAG)</a> defines requirements for designers and developers to improve accessibility for people with disabilities. It defines three levels of conformance: Level A, Level AA, and Level AAA.</p>

<p>This website is <strong>${esc(conformanceLevel)}</strong>. ${isConformant ? "All audited criteria were found to be in compliance." : "Some aspects of the content do not yet fully conform to the standard."}</p>

<p><time datetime="${esc(auditDate)}">Last audited: ${esc(formattedDate)}</time></p>

<br>
${limitationsHtml}

<br>

<h2>Feedback</h2>

<p>We welcome your feedback on the accessibility of this website. If you encounter accessibility barriers, please contact us:</p>

<ul>
  <li>Email: ${emailHtml}</li>
</ul>

<p>We aim to respond to accessibility feedback within 5 business days.</p>

<br>

<h2>Assessment Approach</h2>

<p>This website was assessed using automated accessibility testing against WCAG 2.2 Level AA criteria.</p>

<p><small>Statement generated by <strong>Perceive A11y Auditor</strong></small></p>`;

  return json({ statementHtml, error: null });
};

/** Escape HTML special characters to prevent XSS in generated statement. */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function StatementPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [email, setEmail] = useState(data.accessibilityEmail);
  const [orgName, setOrgName] = useState(data.organizationName);
  const [copied, setCopied] = useState(false);

  const isFree = data.plan === "free";
  const statementHtml = actionData?.statementHtml ?? null;

  const handleCopy = useCallback(() => {
    if (statementHtml) {
      navigator.clipboard.writeText(statementHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [statementHtml]);

  if (!data.hasScan) {
    return (
      <Page title="Accessibility Statement" backAction={{ url: "/app" }}>
        <Layout>
          <Layout.Section>
            <Banner tone="info">
              <p>Run a scan first to generate your accessibility statement.</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Accessibility Statement" backAction={{ url: "/app" }}>
      <Layout>
        {actionData && "error" in actionData && actionData.error && (
          <Layout.Section>
            <Banner tone="critical">{actionData.error}</Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Statement Details
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Generate an accessibility statement based on your latest scan
                results. Paste the HTML into your Shopify Online Store &gt; Pages
                editor.
              </Text>

              <InlineStack gap="200" blockAlign="center">
                <Badge tone={data.conformanceLevel?.startsWith("Conformant") ? "success" : "attention"}>
                  {data.conformanceLevel ?? "No scan data"}
                </Badge>
                {data.auditDate && (
                  <Text as="span" variant="bodySm" tone="subdued">
                    Last scan: {new Date(data.auditDate).toLocaleDateString()}
                  </Text>
                )}
              </InlineStack>

              {data.limitations.length > 0 && (
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="semibold">
                    Known limitations ({data.limitations.length}):
                  </Text>
                  <ul style={{ paddingLeft: "1.5em", margin: 0 }}>
                    {data.limitations.map((l, i) => (
                      <li key={i}>
                        <Text as="span" variant="bodySm">{l}</Text>
                      </li>
                    ))}
                  </ul>
                </BlockStack>
              )}

              <Form method="post">
                <BlockStack gap="300">
                  <TextField
                    label="Organization name"
                    name="organizationName"
                    value={orgName}
                    onChange={setOrgName}
                    helpText="Displayed in the statement header. Defaults to your shop domain."
                    autoComplete="organization"
                    disabled={isFree}
                  />
                  <TextField
                    label="Accessibility contact email"
                    name="accessibilityEmail"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    helpText="Where users can report accessibility issues."
                    autoComplete="email"
                    disabled={isFree}
                  />
                  {isFree ? (
                    <Button url="/app/billing" variant="primary">
                      Upgrade to Starter to Generate
                    </Button>
                  ) : (
                    <Button submit variant="primary">
                      Generate Statement
                    </Button>
                  )}
                </BlockStack>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        {statementHtml && (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Generated HTML
                    </Text>
                    <Button onClick={handleCopy}>
                      {copied ? "Copied" : "Copy HTML"}
                    </Button>
                  </InlineStack>
                  <div
                    style={{
                      background: "var(--p-color-bg-surface-secondary)",
                      padding: "1rem",
                      borderRadius: "var(--p-border-radius-200)",
                      maxHeight: "300px",
                      overflow: "auto",
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {statementHtml}
                  </div>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Preview
                  </Text>
                  <div
                    dangerouslySetInnerHTML={{ __html: statementHtml }}
                    style={{ lineHeight: 1.6 }}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}

        {isFree && (
          <Layout.Section>
            <CalloutCard
              title="EAA compliance requires an Accessibility Statement"
              illustration="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              primaryAction={{
                content: "Upgrade to Starter",
                url: "/app/billing",
              }}
            >
              <p>
                Since June 2025, the European Accessibility Act requires every
                EU-facing e-commerce site to publish an accessibility statement.
                Upgrade to generate one from your scan data in seconds.
              </p>
            </CalloutCard>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
