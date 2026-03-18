import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect } from "react";
import { Page, Spinner, BlockStack, Text } from "@shopify/polaris";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";

/**
 * Subscription confirmation callback.
 *
 * Shopify redirects here (via the admin embed) after the merchant approves
 * or declines a charge. We check the subscription status, update the DB,
 * and return the result. The client then navigates to the dashboard using
 * React Router (not a server redirect, which would break the embedded
 * iframe by hitting admin.shopify.com with X-Frame-Options: DENY).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await shopify.authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const plan = url.searchParams.get("plan");
  const chargeId = url.searchParams.get("charge_id");

  if (!chargeId || !plan) {
    return json({ billingStatus: "declined" as const });
  }

  const gid = `gid://shopify/AppSubscription/${chargeId}`;

  const response = await admin.graphql(
    `#graphql
    query subscriptionStatus($id: ID!) {
      node(id: $id) {
        ... on AppSubscription {
          status
        }
      }
    }`,
    { variables: { id: gid } },
  );

  const data = await response.json();
  const status = data.data?.node?.status;

  if (status === "ACTIVE") {
    await prisma.merchant.upsert({
      where: { shopDomain },
      create: { shopDomain, plan },
      update: { plan },
    });
    return json({ billingStatus: "success" as const });
  }

  return json({ billingStatus: "declined" as const });
};

export default function BillingConfirm() {
  const { billingStatus } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  useEffect(() => {
    // Add a cache-busting timestamp so React Router treats this as a fresh
    // navigation and re-runs the dashboard loader with current DB state.
    navigate(`/app?billing=${billingStatus}&t=${Date.now()}`, { replace: true });
  }, [billingStatus, navigate]);

  return (
    <Page>
      <BlockStack align="center" inlineAlign="center">
        <Spinner size="large" />
        <Text as="p" variant="bodyMd">Confirming subscription...</Text>
      </BlockStack>
    </Page>
  );
}
