export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "instagram_story"
  | "whatsapp"
  | "twitter"
  | "linkedin";

export type SocialTone = "professional" | "friendly" | "adventurous" | "luxurious" | "urgent";

export type SocialTemplateId =
  | "featured_stay"
  | "special_offer"
  | "lifestyle_escape"
  | "stay_carousel"
  | "story_pack"
  | "quick_facts"
  | "weekend_escape";

export interface ListingSnapshot {
  id: string;
  title: string;
  description: string;
  location: string;
  area: string;
  province: string;
  pricePerNight: number;
  discountPercent: number;
  adults: number;
  children: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  facilities: string[];
  type: string;
  bookingUrl: string;
}

export interface ContentDraftOptions {
  includePrice: boolean;
  includeSpecialOffer: boolean;
  customHeadline: string;
}

type SocialTemplateDefinition = {
  id: SocialTemplateId;
  name: string;
  purpose: string;
};

const SOCIAL_TEMPLATE_DEFINITIONS: Record<SocialTemplateId, SocialTemplateDefinition> = {
  featured_stay: {
    id: "featured_stay",
    name: "Featured Stay",
    purpose: "General listing promotion with hero facts and direct booking intent.",
  },
  special_offer: {
    id: "special_offer",
    name: "Special Offer",
    purpose: "Deal-led conversion post for urgency and occupancy recovery.",
  },
  lifestyle_escape: {
    id: "lifestyle_escape",
    name: "Luxury Escape",
    purpose: "Experience-led post that sells mood, taste, and emotional pull.",
  },
  stay_carousel: {
    id: "stay_carousel",
    name: "Stay Carousel",
    purpose: "Swipe-first multi-image showcase that introduces the stay in stages.",
  },
  story_pack: {
    id: "story_pack",
    name: "Story Pack",
    purpose: "Short, vertical, high-clarity story sequence with booking intent.",
  },
  quick_facts: {
    id: "quick_facts",
    name: "Quick Facts",
    purpose: "Practical comparison-style promotion for guests scanning options fast.",
  },
  weekend_escape: {
    id: "weekend_escape",
    name: "Weekend Escape",
    purpose: "Short-break positioning for quick getaway demand.",
  },
};

function formatRand(amount: number) {
  return `R${Math.max(0, amount).toLocaleString("en-ZA")}`;
}

function sanitizeText(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return sanitizeText(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildFeatureList(listing: ListingSnapshot) {
  const candidates = [
    ...listing.amenities,
    ...listing.facilities,
    listing.bedrooms > 0 ? `${listing.bedrooms} bedroom${listing.bedrooms === 1 ? "" : "s"}` : "",
    listing.bathrooms > 0 ? `${listing.bathrooms} bathroom${listing.bathrooms === 1 ? "" : "s"}` : "",
    listing.adults + listing.children > 0 ? `Sleeps ${listing.adults + listing.children}` : "",
  ]
    .map((value) => titleCase(value))
    .filter(Boolean);

  return [...new Set(candidates)].slice(0, 6);
}

function buildPromoPrice(listing: ListingSnapshot) {
  if (listing.discountPercent < 1) {
    return listing.pricePerNight;
  }

  return Math.max(1, Math.round(listing.pricePerNight * (1 - listing.discountPercent / 100)));
}

function buildLocationLabel(listing: ListingSnapshot) {
  return [listing.area, listing.location, listing.province]
    .map((value) => sanitizeText(value))
    .filter(Boolean)
    .join(", ");
}

function buildAudienceHook(listing: ListingSnapshot) {
  const guestCount = listing.adults + listing.children;
  if (guestCount >= 6) return "Ideal for groups";
  if (guestCount >= 4) return "Ideal for families";
  if (guestCount >= 2) return "Ideal for couples";
  return "Ideal for a quick escape";
}

function buildTemplateStructure(templateId: SocialTemplateId) {
  switch (templateId) {
    case "featured_stay":
      return [
        "## Headline",
        "A clean headline based on the property name.",
        "",
        "## Caption",
        "One polished caption that follows the Featured Listing formula and ends with the booking URL.",
        "",
        "## CTA",
        "Short CTA only.",
      ].join("\n");
    case "special_offer":
      return [
        "## Headline",
        "Offer-led headline with urgency.",
        "",
        "## Caption",
        "One polished promo caption with urgency and booking URL.",
        "",
        "## CTA",
        "Short CTA only.",
      ].join("\n");
    case "lifestyle_escape":
      return [
        "## Headline",
        "Short emotional headline.",
        "",
        "## Caption",
        "One polished lifestyle caption with booking URL.",
        "",
        "## CTA",
        "Soft CTA only.",
      ].join("\n");
    case "stay_carousel":
      return [
        "## Slide 1",
        "Cover headline.",
        "",
        "## Slide 2",
        "Bedroom or comfort framing line.",
        "",
        "## Slide 3",
        "Feature line.",
        "",
        "## Slide 4",
        "Price or stay-value line.",
        "",
        "## Slide 5",
        "CTA line.",
        "",
        "## Caption",
        "One swipe-ready caption ending with the booking URL.",
      ].join("\n");
    case "story_pack":
      return [
        "## Story 1",
        "Hero story text.",
        "",
        "## Story 2",
        "Feature story text.",
        "",
        "## Story 3",
        "Offer or CTA story text.",
        "",
        "## Caption",
        "Optional short cross-post caption ending with the booking URL.",
      ].join("\n");
    case "quick_facts":
      return [
        "## Headline",
        "Property name only.",
        "",
        "## Facts",
        "8 concise fact bullets.",
        "",
        "## Caption",
        "Practical caption ending with the booking URL.",
      ].join("\n");
    case "weekend_escape":
      return [
        "## Headline",
        "Weekend escape angle.",
        "",
        "## Caption",
        "One short-break caption ending with the booking URL.",
        "",
        "## CTA",
        "Reserve CTA only.",
      ].join("\n");
  }
}

export function getSocialTemplateDefinition(templateId: SocialTemplateId) {
  return SOCIAL_TEMPLATE_DEFINITIONS[templateId];
}

export function normalizeDraftOptions(options?: Partial<ContentDraftOptions>): ContentDraftOptions {
  return {
    includePrice: options?.includePrice ?? true,
    includeSpecialOffer: options?.includeSpecialOffer ?? false,
    customHeadline: sanitizeText(options?.customHeadline || ""),
  };
}

export function buildDraftPrompt(
  listing: ListingSnapshot,
  platform: SocialPlatform,
  tone: SocialTone,
  templateId: SocialTemplateId,
  options?: Partial<ContentDraftOptions>,
) {
  const normalized = normalizeDraftOptions(options);
  const definition = getSocialTemplateDefinition(templateId);
  const locationLabel = buildLocationLabel(listing);
  const features = buildFeatureList(listing);
  const guests = listing.adults + listing.children;
  const promoPrice = buildPromoPrice(listing);
  const promoEnabled = normalized.includeSpecialOffer && listing.discountPercent > 0;

  return [
    "Write one property-marketing draft for Ideal Stay.",
    "Return markdown only.",
    "Do not invent amenities, views, discounts, dates, or booking details.",
    "Stay grounded in the listing data below.",
    "Follow the template structure exactly.",
    `Template: ${definition.name}`,
    `Purpose: ${definition.purpose}`,
    `Platform: ${platform}`,
    `Tone: ${tone}`,
    normalized.customHeadline ? `Pinned headline to respect: ${normalized.customHeadline}` : "",
    "",
    "Listing facts:",
    `Property name: ${listing.title}`,
    `Location: ${locationLabel}`,
    `Property type: ${listing.type}`,
    `Sleeps: ${guests}`,
    `Bedrooms: ${listing.bedrooms}`,
    `Bathrooms: ${listing.bathrooms}`,
    `Nightly price: ${formatRand(listing.pricePerNight)}${normalized.includePrice ? "" : " (do not mention on-image or in copy)"}`,
    `Discount: ${listing.discountPercent > 0 ? `${listing.discountPercent}% off` : "No active discount"}`,
    `Promo price: ${promoEnabled ? formatRand(promoPrice) : "Not applicable"}`,
    `Audience hook: ${buildAudienceHook(listing)}`,
    `Top features: ${features.slice(0, 5).join(" · ")}`,
    `Description: ${sanitizeText(listing.description)}`,
    `Booking URL: ${listing.bookingUrl}`,
    "",
    "Template notes:",
    templateId === "featured_stay"
      ? "Use property name, location, 3 key features, price if allowed, and a clear booking CTA."
      : "",
    templateId === "special_offer"
      ? "Lead with the offer. If there is no real discount, use 'Now from [price] per night' instead of inventing one."
      : "",
    templateId === "lifestyle_escape"
      ? "Sell the feeling with restrained details. Keep it premium, not cheesy."
      : "",
    templateId === "stay_carousel"
      ? "Each slide line must be short enough for an overlay. Avoid paragraphs in slide sections."
      : "",
    templateId === "story_pack"
      ? "Each story line must be concise, bold, and vertical-friendly."
      : "",
    templateId === "quick_facts"
      ? "Facts should be practical and scannable. No fluff."
      : "",
    templateId === "weekend_escape"
      ? "Position the listing as a short-break destination using real features only."
      : "",
    "",
    "Output structure:",
    buildTemplateStructure(templateId),
  ]
    .filter(Boolean)
    .join("\n");
}
