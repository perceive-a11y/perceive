import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Button,
  InlineStack,
  Badge,
  Divider,
  List,
  Banner,
} from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";

const PLANS = [
  {
    name: "free",
    label: "Free",
    price: 0,
    features: [
      "Full theme scan (all files)",
      "Issue counts and severity overview",
      "WCAG 2.2 AA + AAA checks",
    ],
  },
  {
    name: "starter",
    label: "Starter",
    price: 19,
    features: [
      "Everything in Free",
      "Detailed findings with source code file and line references",
      "Fix suggestions for every issue",
      "Shareable HTML report",
      "Accessibility Statement generator",
    ],
  },
  {
    name: "pro",
    label: "Pro",
    price: 39,
    features: [
      "Everything in Starter",
      "Deep Scan (static + runtime analysis)",
      "Accessibility score (0-100)",
      "Priority support",
    ],
  },
] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;

  const merchant = await prisma.merchant.findUnique({
    where: { shopDomain },
  });

  return json({ currentPlan: merchant?.plan ?? "free" });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const selectedPlan = formData.get("plan") as string;

  const plan = PLANS.find((p) => p.name === selectedPlan);
  if (!plan || plan.name === "free") {
    // Downgrade to free — cancel any active subscription first
    const subsResponse = await admin.graphql(
      `#graphql
      query activeSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            id
            status
          }
        }
      }`,
    );

    const subsData = await subsResponse.json();
    const activeSubs =
      subsData.data?.currentAppInstallation?.activeSubscriptions ?? [];

    for (const sub of activeSubs) {
      if (sub.status === "ACTIVE") {
        await admin.graphql(
          `#graphql
          mutation cancelSubscription($id: ID!) {
            appSubscriptionCancel(id: $id) {
              userErrors {
                field
                message
              }
            }
          }`,
          { variables: { id: sub.id } },
        );
      }
    }

    await prisma.merchant.upsert({
      where: { shopDomain },
      create: { shopDomain, plan: "free" },
      update: { plan: "free" },
    });
    return redirect("/app");
  }

  // Create a Shopify app subscription via GraphQL and return the
  // confirmationUrl to the client. The client performs a top-level redirect
  // because Remix strips custom headers from thrown Responses, preventing
  // the App Bridge 401-header mechanism from working.
  const response = await admin.graphql(
    `#graphql
    mutation createSubscription($name: String!, $amount: Decimal!, $returnUrl: URL!, $test: Boolean) {
      appSubscriptionCreate(
        name: $name
        test: $test
        lineItems: [{
          plan: {
            appRecurringPricingDetails: {
              price: { amount: $amount, currencyCode: USD }
            }
          }
        }]
        returnUrl: $returnUrl
      ) {
        appSubscription {
          id
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        name: `Perceive A11y ${plan.label}`,
        amount: plan.price.toString(),
        // Dev/partner stores cannot accept real charges. Set
        // SHOPIFY_BILLING_TEST=1 in the environment to create test charges.
        test: process.env.SHOPIFY_BILLING_TEST === "1" || undefined,
        // Return URL must go through the Shopify admin so the app loads
        // embedded with a valid session token. A direct tunnel URL would
        // hit the app outside the iframe, causing an auth failure.
        returnUrl: `https://admin.shopify.com/store/${shopDomain.replace(".myshopify.com", "")}/apps/${process.env.SHOPIFY_API_KEY}/app/billing/confirm?plan=${plan.name}`,
      },
    }
  );

  const data = await response.json();
  const errors = data.data?.appSubscriptionCreate?.userErrors;
  if (errors?.length) {
    return json({ error: errors[0].message, confirmationUrl: null }, { status: 422 });
  }

  const confirmationUrl = data.data?.appSubscriptionCreate?.confirmationUrl;
  if (!confirmationUrl) {
    return json({ error: "Failed to create subscription", confirmationUrl: null }, { status: 500 });
  }

  return json({ confirmationUrl, error: null });
};

export default function BillingPage() {
  const { currentPlan } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // When the action returns a confirmationUrl, redirect the top-level window
  // to Shopify's billing approval page (can't use iframe navigation).
  useEffect(() => {
    if (actionData?.confirmationUrl) {
      window.open(actionData.confirmationUrl, "_top");
    }
  }, [actionData?.confirmationUrl]);

  return (
    <Page title="Plans & Billing" backAction={{ url: "/app" }}>
      <Layout>
        {actionData?.error && (
          <Layout.Section>
            <Banner title="Billing error" tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        {PLANS.map((plan) => (
          <Layout.Section key={plan.name} variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingLg">
                    {plan.label}
                  </Text>
                  {currentPlan === plan.name && (
                    <Badge tone="success">Current</Badge>
                  )}
                </InlineStack>

                <Text as="p" variant="headingXl">
                  {plan.price === 0
                    ? "Free"
                    : `$${plan.price}/mo`}
                </Text>

                <Divider />

                <List>
                  {plan.features.map((feature) => (
                    <List.Item key={feature}>{feature}</List.Item>
                  ))}
                </List>

                {currentPlan !== plan.name && (
                  <Form method="post">
                    <input type="hidden" name="plan" value={plan.name} />
                    {(() => {
                      const currentPrice = PLANS.find((p) => p.name === currentPlan)?.price ?? 0;
                      const isDowngrade = plan.price < currentPrice;
                      return (
                        <Button
                          variant={isDowngrade ? "secondary" : "primary"}
                          submit
                          fullWidth
                          loading={isSubmitting}
                        >
                          {isDowngrade
                            ? `Downgrade to ${plan.label}`
                            : `Upgrade to ${plan.label}`}
                        </Button>
                      );
                    })()}
                  </Form>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        ))}
      </Layout>
    </Page>
  );
}
