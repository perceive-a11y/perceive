import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import shopify from "~/lib/shopify.server";
import prisma from "~/lib/db.server";

/** Scans stuck in a deep-scan state longer than this are auto-failed. */
const STALE_SCAN_MS = 6 * 60 * 1000;

/**
 * Lightweight resource route for polling scan status during deep scans.
 *
 * Returns only `{ status, score }` via a single indexed query, avoiding the
 * full dashboard loader (multiple groupBy queries + aggregation).
 *
 * Also detects stale deep-scans whose guardian timeout was lost (e.g. after a
 * process restart) and marks them failed so the frontend stops polling.
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
    select: { status: true, score: true, startedAt: true },
  });

  if (!scan) {
    return json({ status: "unknown", score: null }, { status: 404 });
  }

  // Auto-fail scans stuck in a deep-scan state past the guardian timeout.
  // The in-memory setTimeout guardian doesn't survive process restarts.
  if (
    (scan.status === "deep-scan-pending" ||
      scan.status === "deep-scan-running") &&
    Date.now() - new Date(scan.startedAt).getTime() > STALE_SCAN_MS
  ) {
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "failed" },
    });
    return json({ status: "failed", score: scan.score });
  }

  return json({ status: scan.status, score: scan.score });
};
