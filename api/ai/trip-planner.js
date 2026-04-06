import { generateTripPlannerReply } from "../../lib/server/trip-planner.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const { messages } = req.body || {};
    const reply = await generateTripPlannerReply(messages, process.env);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ reply }));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Trip planner request failed." }));
  }
}
