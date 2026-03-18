import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
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
} from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";

const PLANS = [
  {
    name: "free",
    label: "Free",
    price: 0,
    features: [
      "5 template files per scan",
      "Basic findings report",
      "WCAG 2.2 AA checks",
    ],
  },
  {
    name: "starter",
    label: "Starter",
    price: 19,
    features: [
      "All theme files",
      "Fix suggestions",
      "HTML report export",
      "WCAG 2.2 AA + AAA checks",
    ],
  },
  {
    name: "pro",
    label: "Pro",
    price: 39,
    features: [
      "Everything in Starter",
      "Continuous monitoring (coming soon)",
      "EAA statement generator (coming soon)",
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
    // Downgrade to free — cancel any existing subscription
    await prisma.merchant.upsert({
      where: { shopDomain },
      create: { shopDomain, plan: "free" },
      update: { plan: "free" },
    });
    return redirect("/app");
  }

  // Create a Shopify app subscription via GraphQL
  const response = await admin.graphql(
    `#graphql
    mutation createSubscription($name: String!, $amount: Decimal!, $returnUrl: URL!) {
      appSubscriptionCreate(
        name: $name
        lineItems: [{
          plan: {
            appRecurringPricingDetails: {
              price: { amount: $amount, currencyCode: USD }
            }
          }
        }]
        returnUrl: $returnUrl
        test: true
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
        returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing/confirm?plan=${plan.name}`,
      },
    }
  );

  const data = await response.json();
  const confirmationUrl =
    data.data?.appSubscriptionCreate?.confirmationUrl;

  if (confirmationUrl) {
    return redirect(confirmationUrl);
  }

  return json({ error: "Failed to create subscription" }, { status: 500 });
};

export default function BillingPage() {
  const { currentPlan } = useLoaderData<typeof loader>();

  return (
    <Page title="Plans & Billing" backAction={{ url: "/app" }}>
      <Layout>
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
                    <Button
                      variant={plan.name === "starter" ? "primary" : "secondary"}
                      submit
                      fullWidth
                    >
                      {plan.price === 0
                        ? "Downgrade"
                        : `Upgrade to ${plan.label}`}
                    </Button>
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
