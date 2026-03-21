import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";

/**
 * Lightweight resource route for polling scan status during deep scans.
 *
 * Returns only `{ status, score }` via a single indexed query, avoiding the
 * full dashboard loader (multiple groupBy queries + aggregation).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await shopify.authenticate.admin(request);

  const url = new URL(request.url);
  const scanId = Number(url.searchParams.get("scanId"));

  if (!scanId) {
    return json({ status: "unknown", score: null }, { status: 400 });
  }

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { status: true, score: true },
  });

  if (!scan) {
    return json({ status: "unknown", score: null }, { status: 404 });
  }

  return json({ status: scan.status, score: scan.score });
};
