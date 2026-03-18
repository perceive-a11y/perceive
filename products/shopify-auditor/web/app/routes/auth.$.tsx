import type { LoaderFunctionArgs } from "@remix-run/node";
import shopify from "~/lib/shopify.server";

/**
 * Catch-all route for Shopify OAuth callbacks.
 * Handles /auth/login, /auth/callback, etc.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await shopify.authenticate.admin(request);
  return null;
};
