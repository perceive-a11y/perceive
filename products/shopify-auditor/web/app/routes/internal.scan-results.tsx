import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import prisma from "~/lib/db.server";
import { computeScore } from "~/lib/deep-scan.server";

/**
 * Internal callback endpoint for the deep scan worker service.
 *
 * Receives findings from the worker over Fly's internal network and writes
 * them to SQLite. Protected by a shared secret (not Shopify session auth).
 *
 * POST /internal/scan-results
 * Authorization: Bearer <WORKER_SECRET>
 */
export const action = async ({ request }: ActionFunctionArgs) => {
    // Validate shared secret
    const secret = process.env.WORKER_SECRET;
    if (!secret) {
        console.error("[scan-results] WORKER_SECRET not configured");
        return json({ error: "Server misconfigured" }, { status: 500 });
    }

    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${secret}`) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { scanId, status, findings, error } = body as {
        scanId: number;
        status: "completed" | "failed";
        findings?: Array<{
            criterionId: string;
            severity: string;
            element: string;
            filePath: string;
            line: number;
            message: string;
            suggestion: string;
            source: string;
            pageUrl: string;
        }>;
        error?: string;
    };

    if (!scanId || !status) {
        return json({ error: "Missing scanId or status" }, { status: 400 });
    }

    // Idempotent: only update if scan is still in a pending/running state.
    // This prevents late or duplicate callbacks from overwriting a final state.
    const activeStatuses = ["deep-scan-pending", "deep-scan-running"];

    if (status === "completed" && findings) {
        // Bulk insert findings
        if (findings.length > 0) {
            await prisma.finding.createMany({
                data: findings.map((f) => ({
                    scanId,
                    criterionId: f.criterionId,
                    severity: f.severity,
                    element: f.element,
                    filePath: f.filePath,
                    line: f.line,
                    message: f.message,
                    suggestion: f.suggestion,
                    source: f.source,
                    pageUrl: f.pageUrl,
                })),
            });
        }

        // Compute score from all findings (static + axe) for this scan
        const allFindings = await prisma.finding.findMany({
            where: { scanId },
            select: { severity: true, criterionId: true, element: true },
        });
        const score = computeScore(allFindings);

        // Finalize scan
        await prisma.scan.updateMany({
            where: { id: scanId, status: { in: activeStatuses } },
            data: {
                status: "completed",
                score,
                completedAt: new Date(),
            },
        });
    } else if (status === "failed") {
        console.error(`[scan-results] Scan ${scanId} failed: ${error}`);
        await prisma.scan.updateMany({
            where: { id: scanId, status: { in: activeStatuses } },
            data: { status: "failed" },
        });
    }

    return json({ ok: true });
};
