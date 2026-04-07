import assert from "node:assert/strict";
import test from "node:test";

import { generateTextWithFallback } from "../lib/server/text-generation.js";

function createJsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

test("generateTextWithFallback returns Gemini output when Gemini works", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  Object.defineProperty(globalThis, "fetch", {
    value: async (url, init) => {
      calls.push({ url: String(url), init });
      return createJsonResponse({
        candidates: [
          {
            content: {
              parts: [{ text: "Gemini answer" }],
            },
          },
        ],
      });
    },
    configurable: true,
    writable: true,
  });

  try {
    const result = await generateTextWithFallback({
      prompt: "Plan a trip",
      env: {
        GEMINI_API_KEY: "gemini-key",
        DEEPSEEK_API_KEY: "deepseek-key",
      },
    });

    assert.equal(result, "Gemini answer");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
  } finally {
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
  }
});

test("generateTextWithFallback falls back to DeepSeek when Gemini is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  Object.defineProperty(globalThis, "fetch", {
    value: async (url, init) => {
      calls.push({ url: String(url), init });

      if (String(url).includes("generativelanguage.googleapis.com")) {
        return new Response(
          JSON.stringify({ error: { message: "Gemini is overloaded." } }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }

      if (String(url).includes("api.deepseek.com/chat/completions")) {
        return createJsonResponse({
          choices: [{ message: { content: "DeepSeek backup answer" } }],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
    configurable: true,
    writable: true,
  });

  try {
    const result = await generateTextWithFallback({
      prompt: "Plan a trip",
      env: {
        GEMINI_API_KEY: "gemini-key",
        DEEPSEEK_API_KEY: "deepseek-key",
      },
    });

    assert.equal(result, "DeepSeek backup answer");
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
    assert.match(calls[1].url, /api\.deepseek\.com\/chat\/completions/);
  } finally {
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
  }
});
