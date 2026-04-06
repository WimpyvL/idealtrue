import { AiRequestError, enforceAiRateLimit, resolveAiActor } from "../../lib/server/ai-rails.js";
import { generateReviewSummary } from "../../lib/server/review-summary.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const actor = await resolveAiActor({
      headers: req.headers,
      cookieHeader: req.headers.cookie,
      env: process.env,
    });
    enforceAiRateLimit("reviewSummary", actor);
    const summary = await generateReviewSummary(req.body?.reviews, process.env);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ summary }));
  } catch (error) {
    res.statusCode = error instanceof AiRequestError ? error.statusCode : 400;
    if (error instanceof AiRequestError && error.retryAfterSec) {
      res.setHeader("Retry-After", String(error.retryAfterSec));
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Review summary request failed." }));
  }
}
