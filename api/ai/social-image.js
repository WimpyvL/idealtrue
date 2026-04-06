import { generateListingSocialCreative } from "../../lib/server/social-image.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const { listingId, sourceImageUrl, platform, tone, brief } = req.body || {};
    const creative = await generateListingSocialCreative({
      listingId,
      sourceImageUrl,
      platform,
      tone,
      brief,
      cookieHeader: req.headers.cookie,
      env: process.env,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(creative));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Social image request failed.";
    res.statusCode = /signed in|own listings|belong to this listing/i.test(message) ? 403 : 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
}
