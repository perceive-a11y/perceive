import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/lib/shopify.server";
import prisma from "~/lib/db.server";

/**
 * Handle Shopify webhooks: app/uninstalled and mandatory compliance webhooks.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED":
      // Clean up merchant data on uninstall
      await prisma.merchant.deleteMany({
        where: { shopDomain: shop },
      });
      break;

    case "CUSTOMERS_DATA_REQUEST":
      // We don't store customer data — respond with empty
      break;

    case "CUSTOMERS_REDACT":
      // We don't store customer data — nothing to redact
      break;

    case "SHOP_REDACT":
      // Delete all merchant data
      await prisma.merchant.deleteMany({
        where: { shopDomain: shop },
      });
      break;

    case "APP_SUBSCRIPTIONS_UPDATE": {
      // Downgrade merchant to free when subscription is cancelled or expired
      const body = payload as Record<string, unknown>;
      const subscription = body?.app_subscription as Record<string, unknown> | undefined;
      const status = subscription?.status;
      if (status === "cancelled" || status === "expired") {
        await prisma.merchant.updateMany({
          where: { shopDomain: shop },
          data: { plan: "free" },
        });
      }
      break;
    }

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response();
};
