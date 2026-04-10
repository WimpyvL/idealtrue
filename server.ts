import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import express from "express";
import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { AiRequestError, enforceAiRateLimit, resolveAiActor } from "./lib/server/ai-rails.js";
import { generateTripPlannerReply } from "./lib/server/trip-planner.js";
import { generateReviewSummary } from "./lib/server/review-summary.js";
import { generateListingSocialCreative } from "./lib/server/social-image.js";
import {
  copyRequestHeaders,
  getRequestId,
  getSessionTokenFromCookieHeader,
  isJsonResponse,
  isSecureRequest,
  logEncoreProxyError,
  logEncoreProxyEvent,
  readRawRequestBody,
  resolveEncoreApiUrl,
  sanitizeSessionPayload,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  shouldPersistSessionToken,
} from "./lib/server/session-cookie.js";

function getEncoreProxyPath(req: express.Request) {
  const originalUrl = req.originalUrl || req.url;
  const [pathname, search = ""] = originalUrl.split("?");
  const proxyPrefix = "/api/encore";
  const encorePath = pathname.startsWith(proxyPrefix) ? pathname.slice(proxyPrefix.length) || "/" : "/";
  return `${encorePath}${search ? `?${search}` : ""}`;
}

async function proxyEncoreRequest(req: express.Request, res: express.Response) {
  const startedAt = Date.now();
  const requestId = getRequestId(req.headers);
  const proxyPath = getEncoreProxyPath(req);
  let targetUrl: URL | null = null;

  try {
    const encoreApiUrl = resolveEncoreApiUrl(process.env, { allowLocalDefault: true });
    targetUrl = new URL(proxyPath, `${encoreApiUrl}/`);
    const headers = copyRequestHeaders(req.headers);
    const sessionToken = getSessionTokenFromCookieHeader(req.headers.cookie);

    if (sessionToken && !headers.has("authorization")) {
      headers.set("authorization", `Bearer ${sessionToken}`);
    }
    headers.set("x-request-id", requestId);

    let body: Buffer | undefined;
    if (!["GET", "HEAD"].includes(req.method)) {
      body = await readRawRequestBody(req);
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });
    logEncoreProxyEvent({
      durationMs: Date.now() - startedAt,
      method: req.method,
      proxyPath,
      requestId,
      status: upstream.status,
      targetUrl,
    });

    const contentType = upstream.headers.get("content-type");
    res.status(upstream.status);
    res.setHeader("X-Request-Id", requestId);
    const secure = isSecureRequest(req.headers) || process.env.NODE_ENV === "production";

    const pathname = targetUrl.pathname;
    if (isJsonResponse(contentType)) {
      const payload = await upstream.json();
      if (shouldPersistSessionToken(pathname, payload)) {
        res.setHeader("Set-Cookie", serializeSessionCookie(payload.token, secure));
      }
      res.type("application/json");
      res.send(JSON.stringify(sanitizeSessionPayload(pathname, payload)));
      return;
    }

    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    const location = upstream.headers.get("location");
    if (location) {
      res.setHeader("Location", location);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    logEncoreProxyError({
      durationMs: Date.now() - startedAt,
      error,
      method: req.method,
      proxyPath,
      requestId,
      targetUrl,
    });
    res.status(500).json({
      error: error instanceof Error ? error.message : "Encore proxy request failed.",
    });
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const port = 3000;
  const aiJsonParser = express.json({ limit: "2mb" });

  app.post("/api/auth/logout", (req, res) => {
    const secure = isSecureRequest(req.headers) || process.env.NODE_ENV === "production";
    res.status(204);
    res.setHeader("Set-Cookie", serializeClearedSessionCookie(secure));
    res.end();
  });

  app.use("/api/encore", (req, res) => {
    void proxyEncoreRequest(req, res);
  });

  app.post("/api/ai/trip-planner", aiJsonParser, async (req, res) => {
    try {
      const actor = await resolveAiActor({
        headers: req.headers,
        cookieHeader: req.headers.cookie,
        env: process.env,
      });
      enforceAiRateLimit("tripPlanner", actor);
      const reply = await generateTripPlannerReply(req.body?.messages, process.env);
      res.json({ reply });
    } catch (error) {
      if (error instanceof AiRequestError && error.retryAfterSec) {
        res.setHeader("Retry-After", String(error.retryAfterSec));
      }
      res.status(error instanceof AiRequestError ? error.statusCode : 400).json({
        error: error instanceof Error ? error.message : "Trip planner request failed.",
      });
    }
  });

  app.post("/api/ai/review-summary", aiJsonParser, async (req, res) => {
    try {
      const actor = await resolveAiActor({
        headers: req.headers,
        cookieHeader: req.headers.cookie,
        env: process.env,
      });
      enforceAiRateLimit("reviewSummary", actor);
      const summary = await generateReviewSummary(req.body?.reviews, process.env);
      res.json({ summary });
    } catch (error) {
      if (error instanceof AiRequestError && error.retryAfterSec) {
        res.setHeader("Retry-After", String(error.retryAfterSec));
      }
      res.status(error instanceof AiRequestError ? error.statusCode : 400).json({
        error: error instanceof Error ? error.message : "Review summary request failed.",
      });
    }
  });

  app.post("/api/ai/social-image", aiJsonParser, async (req, res) => {
    try {
      const actor = await resolveAiActor({
        headers: req.headers,
        cookieHeader: req.headers.cookie,
        env: process.env,
        requireAuth: true,
      });
      enforceAiRateLimit("socialImage", actor);
      const creative = await generateListingSocialCreative({
        listingId: req.body?.listingId,
        sourceImageUrl: req.body?.sourceImageUrl,
        platform: req.body?.platform,
        tone: req.body?.tone,
        templateId: req.body?.templateId,
        includePrice: req.body?.includePrice,
        includeSpecialOffer: req.body?.includeSpecialOffer,
        customHeadline: req.body?.customHeadline,
        brief: req.body?.brief,
        cookieHeader: req.headers.cookie,
        env: process.env,
      });
      res.json(creative);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Social image request failed.";
      if (error instanceof AiRequestError && error.retryAfterSec) {
        res.setHeader("Retry-After", String(error.retryAfterSec));
      }
      res.status(error instanceof AiRequestError ? error.statusCode : /signed in|own listings|belong to this listing/i.test(message) ? 403 : 400).json({
        error: message,
      });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

void startServer();
