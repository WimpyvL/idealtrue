import { getListingForCurrentUser } from "./encore-api.js";
import { validateSocialCreativeInput } from "./ai-rails.js";
import { generateSocialTemplatePack } from "./social-template-engine.js";

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

export async function generateListingSocialCreative({
  listingId,
  sourceImageUrl,
  platform,
  tone,
  templateId,
  includePrice,
  includeSpecialOffer,
  customHeadline,
  brief,
  cookieHeader,
  env = process.env,
}) {
  const validated = validateSocialCreativeInput({
    listingId,
    sourceImageUrl,
    platform,
    tone,
    templateId,
    includePrice,
    includeSpecialOffer,
    customHeadline,
    brief,
  });
  const { listing } = await getListingForCurrentUser({ listingId: validated.listingId, cookieHeader, env });
  if (!Array.isArray(listing.images) || !listing.images.includes(validated.sourceImageUrl)) {
    throw new Error("The selected image does not belong to this listing.");
  }
  assertSafeSourceImageUrl(validated.sourceImageUrl);
  for (const imageUrl of Array.isArray(listing.images) ? listing.images : []) {
    assertSafeSourceImageUrl(imageUrl);
  }

  return generateSocialTemplatePack({
    listing,
    sourceImageUrl: validated.sourceImageUrl,
    platform: validated.platform,
    tone: validated.tone,
    templateId: validated.templateId,
    includePrice: validated.includePrice,
    includeSpecialOffer: validated.includeSpecialOffer,
    customHeadline: validated.customHeadline,
    env,
  });
}
