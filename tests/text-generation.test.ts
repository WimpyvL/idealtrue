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

test("generateTextWithFallback falls back to DeepSeek when Gemini auth is invalid", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  Object.defineProperty(globalThis, "fetch", {
    value: async (url, init) => {
      calls.push({ url: String(url), init });

      if (String(url).includes("generativelanguage.googleapis.com")) {
        return new Response(
          JSON.stringify({
            error: {
              message:
                "Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      if (String(url).includes("api.deepseek.com/chat/completions")) {
        return createJsonResponse({
          choices: [{ message: { content: "DeepSeek auth-fallback answer" } }],
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

    assert.equal(result, "DeepSeek auth-fallback answer");
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
    assert.match(calls[1].url, /api\.deepseek\.com\/chat\/completions/);
    const deepSeekPayload = JSON.parse(`${calls[1].init?.body || "{}"}`);
    assert.equal(deepSeekPayload.model, "deepseek-v4-flash");
  } finally {
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
      writable: true,
    });
  }
});

test("generateTextWithFallback returns deterministic local output when both providers fail", async () => {
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "fetch", {
    value: async () => new Response(JSON.stringify({ error: { message: "Provider unavailable" } }), { status: 503 }),
    configurable: true,
    writable: true,
  });

  try {
    const result = await generateTextWithFallback({
      prompt: "Plan a trip",
      env: { GEMINI_API_KEY: "gemini-key", DEEPSEEK_API_KEY: "deepseek-key" },
      localFallback: () => "Local safe answer",
    });
    assert.equal(result, "Local safe answer");
  } finally {
    Object.defineProperty(globalThis, "fetch", { value: originalFetch, configurable: true, writable: true });
  }
});
