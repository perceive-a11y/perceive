/**
 * Deep scan worker HTTP server.
 *
 * Single endpoint: POST /scan
 * Accepts a scan job, runs Playwright + axe-core, and POSTs results back to
 * the main app via the provided callback URL.
 *
 * Designed to run on Fly.io with auto_stop_machines: suspend so it scales
 * to zero when idle and wakes on demand.
 */

import { createServer } from "node:http";
import { runScan } from "./scan-engine.mjs";

const PORT = parseInt(process.env.PORT || "8080", 10);
const WORKER_SECRET = process.env.WORKER_SECRET;
const SCAN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

if (!WORKER_SECRET) {
    console.error("WORKER_SECRET env var is required");
    process.exit(1);
}

/** Track in-flight scans to reject duplicates. */
const inFlight = new Set();

/**
 * Read the full request body as a string.
 *
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
        req.on("error", reject);
    });
}

/**
 * Send a JSON response.
 *
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {object} body
 */
function jsonResponse(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
}

/**
 * POST findings (or failure) back to the main app.
 *
 * @param {string} callbackUrl
 * @param {object} payload
 */
async function postCallback(callbackUrl, payload) {
    const body = JSON.stringify(payload);
    try {
        const resp = await fetch(callbackUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WORKER_SECRET}`,
                "Content-Type": "application/json",
                "Content-Length": String(Buffer.byteLength(body)),
            },
            body,
            signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) {
            console.error(`[callback] ${callbackUrl} responded ${resp.status}`);
        }
    } catch (err) {
        console.error(`[callback] Failed to reach ${callbackUrl}:`, err.message);
    }
}

/**
 * Handle a scan request: run the scan with a timeout, then POST results back.
 *
 * @param {number} scanId
 * @param {string} shopDomain
 * @param {string} password
 * @param {string} callbackUrl
 */
async function handleScan(scanId, shopDomain, password, callbackUrl) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), SCAN_TIMEOUT_MS);

    try {
        const findings = await runScan({
            shopDomain,
            password,
            signal: ac.signal,
        });

        await postCallback(callbackUrl, {
            scanId,
            status: "completed",
            findings,
        });
    } catch (err) {
        const message = ac.signal.aborted
            ? "Timeout: scan exceeded 5 minutes"
            : err.message;
        console.error(`[scan ${scanId}] Failed:`, message);

        await postCallback(callbackUrl, {
            scanId,
            status: "failed",
            error: message,
        });
    } finally {
        clearTimeout(timer);
        inFlight.delete(scanId);
    }
}

const server = createServer(async (req, res) => {
    // Health check
    if (req.method === "GET" && req.url === "/health") {
        return jsonResponse(res, 200, { ok: true });
    }

    // Only accept POST /scan
    if (req.method !== "POST" || req.url !== "/scan") {
        return jsonResponse(res, 404, { error: "Not found" });
    }

    // Validate auth
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${WORKER_SECRET}`) {
        return jsonResponse(res, 401, { error: "Unauthorized" });
    }

    // Parse body
    let body;
    try {
        body = JSON.parse(await readBody(req));
    } catch {
        return jsonResponse(res, 400, { error: "Invalid JSON" });
    }

    const { scanId, shopDomain, password, callbackUrl } = body;
    if (!scanId || !shopDomain || !callbackUrl) {
        return jsonResponse(res, 400, { error: "Missing required fields: scanId, shopDomain, callbackUrl" });
    }

    // Reject duplicate
    if (inFlight.has(scanId)) {
        return jsonResponse(res, 409, { error: `Scan ${scanId} already in progress` });
    }

    inFlight.add(scanId);

    // Fire and forget -- respond immediately, run scan in background
    handleScan(scanId, shopDomain, password || "", callbackUrl);

    jsonResponse(res, 202, { ok: true });
});

server.listen(PORT, () => {
    console.log(`[worker] Listening on port ${PORT}`);
});
