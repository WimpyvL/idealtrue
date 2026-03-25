import { GoogleGenAI } from "@google/genai";

export async function generateSocialMediaPost(listing: { title: string, description: string, location: string }, platform: string, tone: string = 'professional') {
  const prompt = `Create a catchy and engaging ${platform} post for the following holiday accommodation listing:
  Title: ${listing.title}
  Location: ${listing.location}
  Description: ${listing.description}
  
  Tone: ${tone}
  
  Adapt the language and style to match the ${tone} tone. 
  - If professional: emphasize quality, reliability, and upscale features.
  - If friendly: use warm, welcoming language and focus on comfort and hospitality.
  - If adventurous: use high-energy, exciting language and focus on unique experiences and exploration.
  
  Include relevant hashtags and a call to action.`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error: any) {
    console.error("Error generating social media post:", error);
    if (error?.message?.includes('API key not valid')) {
      return "Error: Invalid Gemini API key. Please configure it in the Secrets panel.";
    }
    return "Failed to generate post content. Please try again.";
  }
}

export async function generatePropertyDescription(listing: { title: string, location: string, amenities: string[] }, tone: string = 'professional') {
  const prompt = `Create a compelling and detailed property description for a holiday accommodation listing:
  Title: ${listing.title}
  Location: ${listing.location}
  Amenities: ${listing.amenities.join(', ')}
  
  Tone: ${tone}
  
  The description should be approximately 150-200 words and highlight the unique selling points of the property. 
  - If professional: emphasize quality, reliability, and upscale features.
  - If friendly: use warm, welcoming language and focus on comfort and hospitality.
  - If adventurous: use high-energy, exciting language and focus on unique experiences and exploration.
  
  Format the output in Markdown.`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error: any) {
    console.error("Error generating property description:", error);
    if (error?.message?.includes('API key not valid')) {
      return "Error: Invalid Gemini API key. Please configure it in the Secrets panel.";
    }
    return "Failed to generate description. Please try again.";
  }
}

export async function summarizeReviews(reviews: { comment: string, cleanliness: number, accuracy: number, communication: number, location: number, value: number }[]) {
  if (reviews.length === 0) return "No reviews yet.";
  
  const reviewsText = reviews.map(r => `- ${r.comment} (Rating: ${(r.cleanliness + r.accuracy + r.communication + r.location + r.value) / 5}/5)`).join('\n');
  
  const prompt = `Summarize the following guest reviews for a holiday accommodation listing:
  ${reviewsText}
  
  Provide a concise summary (2-3 sentences) that highlights the overall sentiment and key points mentioned by guests. 
  Focus on what guests loved and any recurring minor issues if any.
  
  Format the output in Markdown.`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error: any) {
    console.error("Error summarizing reviews:", error);
    if (error?.message?.includes('API key not valid')) {
      return "Error: Invalid Gemini API key. Please configure it in the Secrets panel.";
    }
    return "Failed to summarize reviews. Please try again.";
  }
}
