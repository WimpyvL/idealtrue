import assert from 'node:assert/strict';
import test from 'node:test';

import { generateTripPlannerReply, generateListingSocialCreative } from '../src/lib/ai-client.ts';
import { summarizeReviews } from '../src/services/content.ts';

type FetchCall = {
  url: string;
  init?: RequestInit;
};

let fetchCalls: FetchCall[] = [];

function installFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  fetchCalls = [];
  Object.defineProperty(globalThis, 'fetch', {
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({ url, init });
      return handler(url, init);
    },
    configurable: true,
    writable: true,
  });
}

function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

test.beforeEach(() => {
  installFetch(() => {
    throw new Error('Fetch was called without a test handler.');
  });
});

test('generateTripPlannerReply posts chat history to the local AI endpoint', async () => {
  installFetch((url) => {
    assert.equal(url, '/api/ai/trip-planner');
    return createJsonResponse({ reply: '# Trip brief\nCape Town works.' });
  });

  const reply = await generateTripPlannerReply([
    { role: 'user', content: 'Plan a 4-day Cape Town trip.' },
  ]);

  assert.match(reply, /Trip brief/);
  assert.equal(fetchCalls[0]?.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(fetchCalls[0]?.init?.body)), {
    messages: [{ role: 'user', content: 'Plan a 4-day Cape Town trip.' }],
  });
});

test('summarizeReviews routes through the Gemini-backed review summary endpoint', async () => {
  installFetch((url) => {
    assert.equal(url, '/api/ai/review-summary');
    return createJsonResponse({
      summary: '**Guest snapshot:** 2 reviews with strong sentiment.',
    });
  });

  const summary = await summarizeReviews([
    {
      id: 'review-1',
      listingId: 'listing-1',
      guestId: 'guest-1',
      hostId: 'host-1',
      cleanliness: 5,
      accuracy: 4,
      communication: 5,
      location: 4,
      value: 4,
      comment: 'Beautiful stay and very clean.',
      createdAt: '2026-04-01T10:00:00.000Z',
    },
  ]);

  assert.match(summary, /Guest snapshot/);
  assert.equal(fetchCalls[0]?.init?.method, 'POST');
});

test('generateListingSocialCreative returns a browser-ready data URL', async () => {
  installFetch((url) => {
    assert.equal(url, '/api/ai/social-image');
    return createJsonResponse({
      mimeType: 'image/png',
      dataBase64: 'YWJj',
    });
  });

  const creative = await generateListingSocialCreative({
    listingId: 'listing-1',
    sourceImageUrl: 'https://cdn.example.com/listing.jpg',
    platform: 'instagram',
    tone: 'luxurious',
    brief: 'Launch campaign',
  });

  assert.equal(creative.mimeType, 'image/png');
  assert.equal(creative.dataBase64, 'YWJj');
  assert.equal(creative.dataUrl, 'data:image/png;base64,YWJj');
  assert.deepEqual(JSON.parse(String(fetchCalls[0]?.init?.body)), {
    listingId: 'listing-1',
    sourceImageUrl: 'https://cdn.example.com/listing.jpg',
    platform: 'instagram',
    tone: 'luxurious',
    brief: 'Launch campaign',
  });
});
