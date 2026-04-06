import { Review } from "@/types";
import { summarizeReviews as summarizeReviewsWithGemini } from "@/lib/ai-client";

export async function summarizeReviews(reviews: Review[]) {
  if (reviews.length === 0) {
    return "No reviews yet.";
  }

  return summarizeReviewsWithGemini(reviews);
}
