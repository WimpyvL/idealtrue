import { generateTextWithFallback } from "./text-generation.js";
import { validateReviewSummaryInput } from "./ai-rails.js";

export function buildLocalReviewSummary(reviews) {
  const scoreKeys = ["cleanliness", "accuracy", "communication", "location", "value"];
  const averages = scoreKeys.map((key) => ({
    key,
    value: reviews.reduce((sum, review) => sum + review[key], 0) / reviews.length,
  }));
  const overall = averages.reduce((sum, item) => sum + item.value, 0) / averages.length;
  const highestValue = Math.max(...averages.map((item) => item.value));
  const lowestValue = Math.min(...averages.map((item) => item.value));
  const strongest = averages.filter((item) => item.value === highestValue);
  const weakest = averages.filter((item) => item.value === lowestValue);

  const strongestLabel = strongest.length === averages.length
    ? `all categories consistently at ${highestValue.toFixed(1)}/5`
    : strongest.map((item) => item.key).join(", ");
  const weakestLabel = weakest.length === averages.length
    ? `all categories consistently at ${lowestValue.toFixed(1)}/5`
    : weakest.map((item) => item.key).join(", ");

  const strongestText = strongest.length === averages.length
    ? `Guests rate ${strongestLabel} most highly at ${highestValue.toFixed(1)}/5.`
    : `Guests rate ${formatCategoryList(strongest)} most highly at ${highestValue.toFixed(1)}/5.`;
  const weakestText = weakest.length === averages.length
    ? `Watch for ${weakestLabel}, the lowest relative categories at ${lowestValue.toFixed(1)}/5. Read the individual comments for context.`
    : `Watch for ${formatCategoryList(weakest)}, the lowest relative categories at ${lowestValue.toFixed(1)}/5. Read the individual comments for context.`;

  return [
    `**Guest snapshot:** ${reviews.length} review${reviews.length === 1 ? "" : "s"}, averaging ${overall.toFixed(1)}/5 across the recorded categories.`,
    "",
    strongestText,
    weakestText,
  ].join("\n");
}

function formatCategoryList(items) {
  if (items.length === 1) {
    return items[0].key;
  }

  if (items.length === 2) {
    return `${items[0].key} and ${items[1].key}`;
  }

  return `${items.slice(0, -1).map((item) => item.key).join(", ")}, and ${items[items.length - 1].key}`;
}

export async function generateReviewSummary(reviews, env = process.env) {
  const normalizedReviews = validateReviewSummaryInput(reviews);

  const formattedReviews = normalizedReviews
    .map((review, index) => {
      const ratings = [
        `cleanliness ${review.cleanliness}/5`,
        `accuracy ${review.accuracy}/5`,
        `communication ${review.communication}/5`,
        `location ${review.location}/5`,
        `value ${review.value}/5`,
      ].join(", ");

      return [
        `Review ${index + 1}`,
        `Ratings: ${ratings}`,
        `Comment: ${review.comment || "No written comment."}`,
      ].join("\n");
    })
    .join("\n\n");

  return generateTextWithFallback({
    systemInstruction: [
      "You summarize guest reviews for an accommodation listing detail panel.",
      "Stay strictly grounded in the supplied reviews.",
      "Do not invent amenities, complaints, praise, or recommendations.",
      "Keep the output tight, useful, and product-facing.",
    ].join("\n"),
    prompt: [
      "Summarize the guest reviews below for a listing detail modal.",
      "Return concise markdown only.",
      "Use this shape:",
      "**Guest snapshot:** ...",
      "",
      "Guests consistently mention ...",
      "Watch for ...",
      "",
      "Do not invent complaints or amenities.",
      "",
      formattedReviews,
    ].join("\n"),
    thinkingLevel: "low",
    temperature: 0.2,
    maxOutputTokens: 240,
    env,
    localFallback: () => buildLocalReviewSummary(normalizedReviews),
  });
}
