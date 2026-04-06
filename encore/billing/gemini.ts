import { APIError } from "encore.dev/api";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_TEXT_MODEL = "gemini-2.5-flash";

type SocialPlatform = "instagram" | "facebook" | "twitter" | "linkedin";
type SocialTone = "professional" | "friendly" | "adventurous" | "luxurious" | "urgent";

export interface ListingSnapshot {
  id: string;
  title: string;
  description: string;
  location: string;
  pricePerNight: number;
  amenities: string[];
  facilities: string[];
  type: string;
}

function getGeminiApiKey(env = process.env) {
  const apiKey = `${env.GEMINI_API_KEY || ""}`.trim();
  if (!apiKey) {
    throw APIError.unavailable("GEMINI_API_KEY is not configured.");
  }
  return apiKey;
}

function getGeminiTextModel(env = process.env) {
  return `${env.GEMINI_TEXT_MODEL || ""}`.trim() || DEFAULT_GEMINI_TEXT_MODEL;
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

function buildDraftPrompt(listing: ListingSnapshot, platform: SocialPlatform, tone: SocialTone) {
  const highlights = [...listing.amenities.slice(0, 4), ...listing.facilities.slice(0, 2)].filter(Boolean);

  return [
    "You write social media content for hospitality listings on Ideal Stay.",
    "Return markdown only.",
    "Do not invent amenities, location details, or price changes.",
    "Make the output immediately usable in a host content editor.",
    "Use this structure:",
    `### ${platform === "twitter" ? "X" : platform.charAt(0).toUpperCase() + platform.slice(1)} draft`,
    "",
    "One strong opener paragraph.",
    "",
    "A polished core body.",
    "",
    "A direct CTA line.",
    "",
    "A final hashtag line with 4 to 6 hashtags.",
    "",
    `Tone: ${tone}`,
    `Listing title: ${listing.title}`,
    `Location: ${listing.location}`,
    `Nightly rate: R${listing.pricePerNight}`,
    `Property type: ${listing.type}`,
    `Amenities/facilities: ${highlights.join(", ") || "Use only the description and location."}`,
    `Description: ${listing.description}`,
  ].join("\n");
}

export async function generateListingDraftWithGemini(
  listing: ListingSnapshot,
  platform: SocialPlatform,
  tone: SocialTone,
  env = process.env,
) {
  const apiKey = getGeminiApiKey(env);
  const model = getGeminiTextModel(env);

  const response = await fetch(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildDraftPrompt(listing, platform, tone) }],
        },
      ],
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: "low",
        },
      },
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw APIError.internal(parseGeminiError(body, response.statusText));
  }

  const text = collectTextFromResponse(body ? JSON.parse(body) : {});
  if (!text) {
    throw APIError.internal("Gemini returned an empty content draft.");
  }

  return text;
}
