import { APIError } from "encore.dev/api";
import {
  buildDraftPrompt,
  ContentDraftOptions,
  ListingSnapshot,
  SocialPlatform,
  SocialTemplateId,
  SocialTone,
} from "./social-templates";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_TEXT_MODEL = "gemini-2.5-flash";
const DEFAULT_DEEPSEEK_TEXT_MODEL = "deepseek-chat";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
] as const;

function getGeminiApiKey(env = process.env) {
  const apiKey = `${env.GEMINI_API_KEY || ""}`.trim();
  if (!apiKey) {
    throw APIError.unavailable("GEMINI_API_KEY is not configured.");
  }
  return apiKey;
}

function getDeepSeekApiKey(env = process.env) {
  const apiKey = `${env.DEEPSEEK_API_KEY || ""}`.trim();
  if (!apiKey) {
    throw APIError.unavailable("DEEPSEEK_API_KEY is not configured.");
  }
  return apiKey;
}

function getGeminiTextModel(env = process.env) {
  return `${env.GEMINI_TEXT_MODEL || ""}`.trim() || DEFAULT_GEMINI_TEXT_MODEL;
}

function hasDeepSeekConfig(env = process.env) {
  return Boolean(`${env.DEEPSEEK_API_KEY || ""}`.trim());
}

function getDeepSeekTextModel(env = process.env) {
  return `${env.DEEPSEEK_TEXT_MODEL || ""}`.trim() || DEFAULT_DEEPSEEK_TEXT_MODEL;
}

function getDeepSeekBaseUrl(env = process.env) {
  return `${env.DEEPSEEK_BASE_URL || ""}`.trim() || DEFAULT_DEEPSEEK_BASE_URL;
}

function parseGeminiError(body: string, fallbackStatusText: string) {
  if (!body) {
    return fallbackStatusText || "Gemini request failed.";
  }

  try {
    const payload = JSON.parse(body) as { error?: { message?: string } };
    return payload.error?.message || fallbackStatusText || "Gemini request failed.";
  } catch {
    return body || fallbackStatusText || "Gemini request failed.";
  }
}

function parseDeepSeekError(body: string, fallbackStatusText: string) {
  if (!body) {
    return fallbackStatusText || "DeepSeek request failed.";
  }

  try {
    const payload = JSON.parse(body) as { error?: { message?: string } };
    return payload.error?.message || fallbackStatusText || "DeepSeek request failed.";
  } catch {
    return body || fallbackStatusText || "DeepSeek request failed.";
  }
}

function collectTextFromResponse(response: unknown) {
  const parts = (response as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  })?.candidates?.[0]?.content?.parts ?? [];

  return parts
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function collectTextFromDeepSeekResponse(response: unknown) {
  return `${(response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content || ""}`.trim();
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function buildDraftSystemInstruction() {
  return [
    "You are Ideal Stay's content engine for property marketing.",
    "Your job is to produce relevant, commercially strong copy for real accommodation listings.",
    "Never invent amenities, views, distances, policies, prices, or awards.",
    "Keep the copy credible, polished, and platform-specific.",
    "Follow the requested template rigorously instead of free-styling.",
  ].join("\n");
}

async function generateListingDraftWithGemini(
  listing: ListingSnapshot,
  platform: SocialPlatform,
  tone: SocialTone,
  templateId: SocialTemplateId,
  options: ContentDraftOptions,
  env = process.env,
) {
  const apiKey = getGeminiApiKey(env);
  const model = getGeminiTextModel(env);

  let response;
  try {
    response = await fetch(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildDraftSystemInstruction() }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: buildDraftPrompt(listing, platform, tone, templateId, options) }],
          },
        ],
        safetySettings: DEFAULT_SAFETY_SETTINGS,
        generationConfig: {
          responseMimeType: "text/plain",
          temperature: 0.45,
          topP: 0.9,
          maxOutputTokens: 700,
          thinkingConfig: {
            thinkingLevel: "low",
          },
        },
      }),
    });
  } catch {
    throw APIError.unavailable("Gemini request failed before a response was received.");
  }

  const body = await response.text();
  if (!response.ok) {
    const message = parseGeminiError(body, response.statusText);
    if (isRetryableStatus(response.status)) {
      throw APIError.unavailable(message);
    }
    throw APIError.internal(message);
  }

  const text = collectTextFromResponse(body ? JSON.parse(body) : {});
  if (!text) {
    throw APIError.internal("Gemini returned an empty content draft.");
  }

  return text;
}

async function generateListingDraftWithDeepSeek(
  listing: ListingSnapshot,
  platform: SocialPlatform,
  tone: SocialTone,
  templateId: SocialTemplateId,
  options: ContentDraftOptions,
  env = process.env,
) {
  const apiKey = getDeepSeekApiKey(env);
  const model = getDeepSeekTextModel(env);
  const baseUrl = getDeepSeekBaseUrl(env).replace(/\/+$/, "");

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.45,
        top_p: 0.9,
        max_tokens: 700,
        messages: [
          { role: "system", content: buildDraftSystemInstruction() },
          { role: "user", content: buildDraftPrompt(listing, platform, tone, templateId, options) },
        ],
      }),
    });
  } catch {
    throw APIError.unavailable("DeepSeek request failed before a response was received.");
  }

  const body = await response.text();
  if (!response.ok) {
    const message = parseDeepSeekError(body, response.statusText);
    if (isRetryableStatus(response.status)) {
      throw APIError.unavailable(message);
    }
    throw APIError.internal(message);
  }

  const text = collectTextFromDeepSeekResponse(body ? JSON.parse(body) : {});
  if (!text) {
    throw APIError.unavailable("DeepSeek returned an empty content draft.");
  }

  return text;
}

export async function generateListingDraftWithFallback(
  listing: ListingSnapshot,
  platform: SocialPlatform,
  tone: SocialTone,
  templateId: SocialTemplateId,
  options: ContentDraftOptions,
  env = process.env,
) {
  try {
    return await generateListingDraftWithGemini(listing, platform, tone, templateId, options, env);
  } catch (error) {
    if (
      !hasDeepSeekConfig(env) ||
      (error instanceof APIError ? error.code !== "unavailable" : false)
    ) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown Gemini failure.";
    console.warn("Gemini content draft generation failed, falling back to DeepSeek.", message);
    return generateListingDraftWithDeepSeek(listing, platform, tone, templateId, options, env);
  }
}
