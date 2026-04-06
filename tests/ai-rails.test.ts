import assert from "node:assert/strict";
import test from "node:test";

import {
  AiRequestError,
  enforceAiRateLimit,
  getClientIp,
  validateReviewSummaryInput,
  validateSocialCreativeInput,
  validateTripPlannerMessages,
} from "../lib/server/ai-rails.js";

test("validateTripPlannerMessages trims and caps the visible chat history", () => {
  const messages = validateTripPlannerMessages(
    Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: ` message ${index} `,
    })),
  );

  assert.equal(messages.length, 12);
  assert.equal(messages[0]?.content, "message 2");
  assert.equal(messages.at(-1)?.content, "message 13");
});

test("validateReviewSummaryInput rejects invalid score ranges", () => {
  assert.throws(
    () =>
      validateReviewSummaryInput([
        {
          cleanliness: 9,
          accuracy: 5,
          communication: 5,
          location: 5,
          value: 5,
          comment: "Too good to be true",
        },
      ]),
    (error: unknown) =>
      error instanceof AiRequestError &&
      error.statusCode === 400 &&
      /cleanliness/i.test(error.message),
  );
});

test("validateSocialCreativeInput accepts supported payloads and trims the brief", () => {
  const payload = validateSocialCreativeInput({
    listingId: "listing-123",
    sourceImageUrl: "https://cdn.example.com/image.jpg",
    platform: "instagram",
    tone: "luxurious",
    brief: "  Premium launch creative  ",
  });

  assert.equal(payload.listingId, "listing-123");
  assert.equal(payload.brief, "Premium launch creative");
});

test("getClientIp prefers forwarded addresses", () => {
  assert.equal(
    getClientIp({
      "x-forwarded-for": "198.51.100.10, 10.0.0.2",
      "x-real-ip": "203.0.113.7",
    }),
    "198.51.100.10",
  );
});

test("enforceAiRateLimit blocks callers that exceed the endpoint window", () => {
  const actor = { rateKey: "user:test-user", rateTier: "user" as const };
  const now = Date.now();

  for (let index = 0; index < 10; index += 1) {
    enforceAiRateLimit("tripPlanner", actor, now + index);
  }

  assert.throws(
    () => enforceAiRateLimit("tripPlanner", actor, now + 11),
    (error: unknown) =>
      error instanceof AiRequestError &&
      error.statusCode === 429 &&
      /Too many tripPlanner AI requests/i.test(error.message),
  );
});
