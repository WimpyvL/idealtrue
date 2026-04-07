import { generateTextWithFallback } from "./text-generation.js";
import { validateReviewSummaryInput } from "./ai-rails.js";

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
  });
}
