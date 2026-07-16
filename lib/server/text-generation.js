import { generateDeepSeekText } from "./deepseek-api.js";
import { hasDeepSeekConfig } from "./deepseek-config.js";
import { generateGeminiText } from "./gemini-api.js";
import { isProviderAuthError } from "./ai-provider-error.js";

const CIRCUIT_STORE_KEY = "__idealStayAiCircuitStore";
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000;

function getCircuitStore() {
  if (!globalThis[CIRCUIT_STORE_KEY]) {
    globalThis[CIRCUIT_STORE_KEY] = new Map();
  }
  return globalThis[CIRCUIT_STORE_KEY];
}

// Author: ( |╲ ) Klaasvaakie
async function callWithCircuit(provider, operation, now = Date.now()) {
  const store = getCircuitStore();
  const state = store.get(provider) ?? { failures: 0, openedAt: 0 };
  if (state.failures >= CIRCUIT_FAILURE_THRESHOLD && now - state.openedAt < CIRCUIT_RESET_MS) {
    const error = new Error(`${provider} circuit is temporarily open.`);
    error.retryable = true;
    throw error;
  }

  try {
    const result = await operation();
    store.delete(provider);
    return result;
  } catch (error) {
    const latestState = store.get(provider) ?? { failures: 0, openedAt: 0 };
    const failures = latestState.failures + 1;
    store.set(provider, {
      failures,
      openedAt: failures >= CIRCUIT_FAILURE_THRESHOLD ? now : latestState.openedAt,
    });
    throw error;
  }
}

function shouldFallbackToDeepSeek(error) {
  if (!error) {
    return false;
  }

  if (isProviderAuthError(error)) {
    return true;
  }

  if (typeof error === "object" && "retryable" in error) {
    return Boolean(error.retryable);
  }

  return true;
}

function buildDeepSeekFallbackOptions(options = {}) {
  const model = `${options?.model || ""}`.trim();
  if (!model) {
    return options;
  }

  if (/^gemini/i.test(model)) {
    const { model: _ignoredModel, ...rest } = options;
    return rest;
  }

  return options;
}

export async function generateTextWithFallback(options) {
  const { localFallback, ...providerOptions } = options;
  try {
    return await callWithCircuit("gemini", () => generateGeminiText(providerOptions));
  } catch (geminiError) {
    if (hasDeepSeekConfig(providerOptions?.env) && shouldFallbackToDeepSeek(geminiError)) {
      try {
        console.warn("Gemini text generation failed, falling back to DeepSeek.", geminiError);
        return await callWithCircuit(
          "deepseek",
          () => generateDeepSeekText(buildDeepSeekFallbackOptions(providerOptions)),
        );
      } catch (deepSeekError) {
        console.warn("DeepSeek text generation failed, falling back locally.", deepSeekError);
      }
    }

    if (typeof localFallback === "function") {
      return localFallback();
    }

    throw geminiError;
  }
}
