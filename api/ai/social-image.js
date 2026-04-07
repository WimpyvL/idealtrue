import { AiRequestError, enforceAiRateLimit, resolveAiActor } from "../../lib/server/ai-rails.js";
import { generateListingSocialCreative } from "../../lib/server/social-image.js";

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
      requireAuth: true,
    });
    enforceAiRateLimit("socialImage", actor);
    const {
      listingId,
      sourceImageUrl,
      platform,
      tone,
      templateId,
      includePrice,
      includeSpecialOffer,
      customHeadline,
      brief,
    } = req.body || {};
    const creative = await generateListingSocialCreative({
      listingId,
      sourceImageUrl,
      platform,
      tone,
      templateId,
      includePrice,
      includeSpecialOffer,
      customHeadline,
      brief,
      cookieHeader: req.headers.cookie,
      env: process.env,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(creative));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Social image request failed.";
    res.statusCode = error instanceof AiRequestError ? error.statusCode : /signed in|own listings|belong to this listing/i.test(message) ? 403 : 400;
    if (error instanceof AiRequestError && error.retryAfterSec) {
      res.setHeader("Retry-After", String(error.retryAfterSec));
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
}
