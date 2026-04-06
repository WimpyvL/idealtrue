import { generateReviewSummary } from "../../lib/server/review-summary.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const { reviews } = req.body || {};
    const summary = await generateReviewSummary(reviews, process.env);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ summary }));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Review summary request failed." }));
  }
}
