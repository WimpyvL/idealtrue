import { getGeminiConfig } from "./gemini-config.js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
];

function buildModelUrl(model, action) {
  return `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:${action}`;
}

function parseGeminiError(body, fallbackStatusText) {
  if (!body) {
    return fallbackStatusText || "Gemini request failed.";
  }

  try {
    const payload = JSON.parse(body);
    return payload?.error?.message || fallbackStatusText || "Gemini request failed.";
  } catch {
    return body || fallbackStatusText || "Gemini request failed.";
  }
}

async function postJson(url, apiKey, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(parseGeminiError(body, response.statusText));
  }

  return body ? JSON.parse(body) : {};
}

export function collectGeminiText(response) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function collectGeminiInlineImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  return parts.find((part) => part?.inlineData?.data)?.inlineData || null;
}

export async function generateGeminiText({
  prompt,
  history = [],
  systemInstruction,
  thinkingLevel = "low",
  temperature = 0.4,
  topP = 0.9,
  maxOutputTokens = 900,
  model,
  env = process.env,
}) {
  const config = getGeminiConfig(env);
  const resolvedModel = model || config.textModel;
  const contents = [];

  for (const message of history) {
    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: `${message.content || ""}`.trim() }],
    });
  }

  if (prompt) {
    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });
  }

  const response = await postJson(
    buildModelUrl(resolvedModel, "generateContent"),
    config.apiKey,
    {
      ...(systemInstruction
        ? {
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
          }
        : {}),
      contents,
      safetySettings: DEFAULT_SAFETY_SETTINGS,
      generationConfig: {
        responseMimeType: "text/plain",
        temperature,
        topP,
        maxOutputTokens,
        thinkingConfig: {
          thinkingLevel,
        },
      },
    },
  );

  const text = collectGeminiText(response);
  if (!text) {
    throw new Error("Gemini returned an empty text response.");
  }

  return text;
}

export async function generateGeminiImage({
  prompt,
  imageBase64,
  mimeType,
  aspectRatio = "1:1",
  systemInstruction,
  model,
  env = process.env,
}) {
  const config = getGeminiConfig(env);
  const resolvedModel = model || config.imageModel;
  const response = await postJson(
    buildModelUrl(resolvedModel, "generateContent"),
    config.apiKey,
    {
      ...(systemInstruction
        ? {
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
          }
        : {}),
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      safetySettings: DEFAULT_SAFETY_SETTINGS,
      generationConfig: {
        imageConfig: {
          aspectRatio,
        },
      },
    },
  );

  const inlineImage = collectGeminiInlineImage(response);
  if (!inlineImage?.data || !inlineImage?.mimeType) {
    throw new Error("Gemini did not return an image.");
  }

  return inlineImage;
}
