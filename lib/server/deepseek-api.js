import { getDeepSeekConfig } from "./deepseek-config.js";
import { AiProviderError, isRetryableStatusCode } from "./ai-provider-error.js";

function parseDeepSeekError(body, fallbackStatusText) {
  if (!body) {
    return fallbackStatusText || "DeepSeek request failed.";
  }

  try {
    const payload = JSON.parse(body);
    return payload?.error?.message || fallbackStatusText || "DeepSeek request failed.";
  } catch {
    return body || fallbackStatusText || "DeepSeek request failed.";
  }
}

function collectDeepSeekText(response) {
  return `${response?.choices?.[0]?.message?.content || ""}`.trim();
}

export async function generateDeepSeekText({
  prompt,
  history = [],
  systemInstruction,
  temperature = 0.4,
  topP = 0.9,
  maxOutputTokens = 900,
  model,
  env = process.env,
}) {
  const config = getDeepSeekConfig(env);
  const resolvedModel = model || config.textModel;
  const messages = [];

  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  for (const message of history) {
    messages.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: `${message.content || ""}`.trim(),
    });
  }

  if (prompt) {
    messages.push({ role: "user", content: prompt });
  }

  let response;
  try {
    response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        stream: false,
        temperature,
        top_p: topP,
        max_tokens: maxOutputTokens,
      }),
    });
  } catch (error) {
    throw new AiProviderError("deepseek", "DeepSeek request failed before a response was received.", {
      retryable: true,
      cause: error,
    });
  }

  const body = await response.text();
  if (!response.ok) {
    throw new AiProviderError("deepseek", parseDeepSeekError(body, response.statusText), {
      statusCode: response.status,
      retryable: isRetryableStatusCode(response.status),
    });
  }

  const text = collectDeepSeekText(body ? JSON.parse(body) : {});
  if (!text) {
    throw new AiProviderError("deepseek", "DeepSeek returned an empty text response.", {
      retryable: true,
    });
  }

  return text;
}
