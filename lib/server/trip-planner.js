import { generateGeminiText } from "./gemini-api.js";

function buildPlannerPrompt(messages) {
  return [
    "You are Ideal Stay's trip planner.",
    "Respond in concise markdown.",
    "Focus on South African travel planning unless the user clearly asks otherwise.",
    "Be useful, commercially sane, and avoid fake certainty.",
    "When enough context exists, return sections in this shape:",
    "# Trip brief",
    "## Best fit",
    "## Draft itinerary",
    "## Stay filters to use on Ideal Stay",
    "## Reality check",
    "If key inputs are missing, ask up to three sharp follow-up questions instead of inventing details.",
    "Do not mention that you are an AI model.",
    "",
    "Conversation:",
    ...messages.map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`),
  ].join("\n");
}

export async function generateTripPlannerReply(messages, env = process.env) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("At least one message is required.");
  }

  const normalizedMessages = messages
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: `${message.content || ""}`.trim(),
    }))
    .filter((message) => message.content);

  if (normalizedMessages.length === 0) {
    throw new Error("At least one non-empty message is required.");
  }

  return generateGeminiText({
    prompt: buildPlannerPrompt(normalizedMessages),
    thinkingLevel: "low",
    env,
  });
}
