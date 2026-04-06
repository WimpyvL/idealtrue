import { generateGeminiImage } from "./gemini-api.js";
import { getListingForCurrentUser } from "./encore-api.js";
import { validateSocialCreativeInput } from "./ai-rails.js";

function isPrivateIpv4(hostname) {
  return (
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function assertSafeSourceImageUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("The selected image URL is invalid.");
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS listing images can be used for social creatives.");
  }

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error("The selected image host is not allowed.");
  }
}

function inferAspectRatio(platform) {
  if (platform === "instagram") return "1:1";
  if (platform === "facebook" || platform === "linkedin") return "4:3";
  return "16:9";
}

function inferCreativeDirection(tone) {
  switch (tone) {
    case "friendly":
      return "warm, welcoming, lifestyle-led, and approachable";
    case "adventurous":
      return "dynamic, vivid, outdoorsy, and story-driven";
    case "luxurious":
      return "premium, editorial, refined, and polished";
    case "urgent":
      return "clear, conversion-oriented, and promo-ready without looking cheap";
    default:
      return "clean, premium, commercial, and conversion-friendly";
  }
}

function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

function buildSocialImagePrompt({ listing, platform, tone, brief }) {
  const creativeDirection = inferCreativeDirection(tone);
  const optionalBrief = `${brief || ""}`.trim();

  return [
    `Transform this listing photo into a ${platform} social media creative.`,
    "Preserve the property's real architecture, decor, and recognisable details.",
    `Art direction: ${creativeDirection}.`,
    "The result should look like a professionally designed hospitality campaign asset, not a generic AI poster.",
    "Use tasteful layout treatment, strong typography, and a premium travel-brand aesthetic.",
    `Feature the property name "${listing.title}" and the location "${listing.location}" in a clean, legible way.`,
    "Avoid visual clutter, fake people, fake amenities, or text walls.",
    optionalBrief ? `Extra brief: ${optionalBrief}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateListingSocialCreative({
  listingId,
  sourceImageUrl,
  platform,
  tone,
  brief,
  cookieHeader,
  env = process.env,
}) {
  const validated = validateSocialCreativeInput({ listingId, sourceImageUrl, platform, tone, brief });
  const { listing } = await getListingForCurrentUser({ listingId: validated.listingId, cookieHeader, env });
  if (!Array.isArray(listing.images) || !listing.images.includes(validated.sourceImageUrl)) {
    throw new Error("The selected image does not belong to this listing.");
  }
  assertSafeSourceImageUrl(validated.sourceImageUrl);

  const imageResponse = await fetch(validated.sourceImageUrl);
  if (!imageResponse.ok) {
    throw new Error("Could not load the listing image for creative generation.");
  }

  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
  const imageBase64 = arrayBufferToBase64(await imageResponse.arrayBuffer());

  const generated = await generateGeminiImage({
    systemInstruction: [
      "You create premium hospitality social-media creatives from real listing photography.",
      "Stay faithful to the property's architecture, decor, lighting mood, and layout.",
      "Do not add fake people, fake amenities, fake skyline views, or misleading text claims.",
      "The output should feel designed, brand-safe, and commercially usable.",
    ].join("\n"),
    prompt: buildSocialImagePrompt({ listing, platform: validated.platform, tone: validated.tone, brief: validated.brief }),
    imageBase64,
    mimeType,
    aspectRatio: inferAspectRatio(validated.platform),
    env,
  });

  return {
    mimeType: generated.mimeType,
    dataBase64: generated.data,
  };
}
