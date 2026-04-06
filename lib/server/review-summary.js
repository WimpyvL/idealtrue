import { generateGeminiText } from "./gemini-api.js";

export async function generateReviewSummary(reviews, env = process.env) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    throw new Error("At least one review is required.");
  }

  const formattedReviews = reviews
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

  return generateGeminiText({
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
    env,
  });
}
