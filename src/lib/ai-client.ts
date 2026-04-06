import type { Review } from '@/types';

export type AiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type GeneratedSocialCreative = {
  mimeType: string;
  dataBase64: string;
  dataUrl: string;
};

async function requestAi<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    if (!body) {
      throw new Error(`AI request failed with status ${response.status}`);
    }

    let parsedError = '';
    try {
      const parsed = JSON.parse(body) as { error?: string };
      parsedError = parsed.error || '';
    } catch {}

    throw new Error(parsedError || body);
  }

  return body ? JSON.parse(body) as T : ({} as T);
}

export async function generateTripPlannerReply(messages: AiChatMessage[]) {
  const response = await requestAi<{ reply: string }>('/api/ai/trip-planner', { messages });
  return response.reply;
}

export async function summarizeReviews(reviews: Review[]) {
  const response = await requestAi<{ summary: string }>('/api/ai/review-summary', { reviews });
  return response.summary;
}

export async function generateListingSocialCreative(params: {
  listingId: string;
  sourceImageUrl: string;
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin';
  tone: 'professional' | 'friendly' | 'adventurous' | 'luxurious' | 'urgent';
  brief?: string;
}): Promise<GeneratedSocialCreative> {
  const response = await requestAi<{ mimeType: string; dataBase64: string }>('/api/ai/social-image', params);
  return {
    ...response,
    dataUrl: `data:${response.mimeType};base64,${response.dataBase64}`,
  };
}
