import { Listing, Review } from "@/types";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X",
  linkedin: "LinkedIn",
};

const TONE_GUIDANCE: Record<string, { opener: string; voice: string; cta: string }> = {
  professional: {
    opener: "Well-positioned stays convert when the offer is clear.",
    voice: "Keep the copy polished, confident, and commercially useful.",
    cta: "Send an enquiry to confirm your preferred dates.",
  },
  friendly: {
    opener: "This stay feels easy to say yes to.",
    voice: "Keep the copy warm, inviting, and conversational.",
    cta: "Message the host and lock in your dates.",
  },
  adventurous: {
    opener: "This is the kind of stay that turns a trip into a story.",
    voice: "Keep the copy energetic, vivid, and experience-led.",
    cta: "Plan the getaway and enquire while dates are still open.",
  },
  luxurious: {
    opener: "Some properties should be framed as a premium escape, not just a booking.",
    voice: "Keep the copy elevated, refined, and detail-rich.",
    cta: "Enquire now to secure a premium stay window.",
  },
  urgent: {
    opener: "Strong availability signals should create momentum.",
    voice: "Keep the copy direct, time-sensitive, and conversion-focused.",
    cta: "Reach out today before the best dates disappear.",
  },
};

const POSITIVE_KEYWORDS = [
  "clean", "beautiful", "great", "amazing", "friendly", "comfortable", "quiet",
  "spacious", "helpful", "perfect", "lovely", "safe", "stunning", "peaceful",
];

const CONCERN_KEYWORDS = [
  "small", "late", "noisy", "slow", "issue", "problem", "difficult", "cold",
  "broken", "dirty", "confusing", "far", "busy",
];

function pickHighlights(listing: Listing) {
  const amenityHighlights = listing.amenities.slice(0, 3);
  const facilityHighlights = listing.facilities.slice(0, 2);

  return [...amenityHighlights, ...facilityHighlights].filter(Boolean);
}

function buildHashtags(listing: Listing, platform: string) {
  const tags = [
    "#IdealStay",
    "#SouthAfricaTravel",
    `#${listing.location.replace(/\s+/g, "")}`,
    listing.type ? `#${listing.type.replace(/\s+/g, "")}` : "",
    platform === "linkedin" ? "#HospitalityMarketing" : "#TravelInspo",
  ];

  return Array.from(new Set(tags.filter(Boolean))).slice(0, 5).join(" ");
}

export async function generateSocialMediaPost(
  listing: Pick<Listing, "title" | "description" | "location" | "pricePerNight" | "amenities" | "facilities" | "type">,
  platform: string,
  tone = "professional",
) {
  const toneConfig = TONE_GUIDANCE[tone] ?? TONE_GUIDANCE.professional;
  const platformLabel = PLATFORM_LABELS[platform] ?? "Social";
  const highlights = pickHighlights(listing as Listing);
  const highlightLine = highlights.length > 0
    ? `Highlights: ${highlights.join(", ")}.`
    : "Highlights: Comfortable positioning, clear location value, and a host-ready setup.";
  const priceLine = Number.isFinite(listing.pricePerNight)
    ? `Rate from R${listing.pricePerNight} per night.`
    : "";

  return [
    `### ${platformLabel} draft`,
    "",
    `${toneConfig.opener}`,
    "",
    `**${listing.title}** in **${listing.location}**`,
    "",
    `${listing.description}`,
    "",
    `${highlightLine} ${priceLine}`.trim(),
    `${toneConfig.voice}`,
    "",
    `${toneConfig.cta}`,
    "",
    buildHashtags(listing as Listing, platform),
  ].join("\n");
}

export async function summarizeReviews(reviews: Review[]) {
  if (reviews.length === 0) {
    return "No reviews yet.";
  }

  const average = (
    reviews.reduce((total, review) => {
      return total + (
        review.cleanliness +
        review.accuracy +
        review.communication +
        review.location +
        review.value
      ) / 5;
    }, 0) / reviews.length
  ).toFixed(1);

  const combinedComments = reviews.map((review) => review.comment.toLowerCase()).join(" ");
  const positiveMatches = POSITIVE_KEYWORDS.filter((word) => combinedComments.includes(word));
  const concernMatches = CONCERN_KEYWORDS.filter((word) => combinedComments.includes(word));

  const strengths = positiveMatches.length > 0
    ? positiveMatches.slice(0, 3).join(", ")
    : "cleanliness, comfort, and overall guest experience";
  const concerns = concernMatches.length > 0
    ? concernMatches.slice(0, 2).join(", ")
    : "no major recurring complaints";

  return [
    `**Guest snapshot:** ${reviews.length} review${reviews.length === 1 ? "" : "s"} with an average sentiment of **${average}/5**.`,
    "",
    `Guests consistently mention **${strengths}**.`,
    `Watch for **${concerns}** when tightening the stay experience and host communication.`,
  ].join("\n");
}
