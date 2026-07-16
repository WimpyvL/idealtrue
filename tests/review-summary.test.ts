import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLocalReviewSummary } from '../lib/server/review-summary.js';

test('buildLocalReviewSummary uses a neutral message when every category is tied', () => {
  const summary = buildLocalReviewSummary([
    { cleanliness: 4, accuracy: 4, communication: 4, location: 4, value: 4, comment: 'Balanced stay.' },
    { cleanliness: 4, accuracy: 4, communication: 4, location: 4, value: 4, comment: 'Very consistent.' },
  ]);

  assert.match(summary, /all categories consistently at 4\.0\/5/);
  assert.match(summary, /Watch for all categories consistently at 4\.0\/5/);
});

test('buildLocalReviewSummary lists every category tied for the highest and lowest averages', () => {
  const summary = buildLocalReviewSummary([
    { cleanliness: 5, accuracy: 5, communication: 3, location: 3, value: 3, comment: 'Strong start.' },
    { cleanliness: 5, accuracy: 5, communication: 3, location: 3, value: 3, comment: 'Solid stay.' },
  ]);

  assert.match(summary, /Guests rate cleanliness and accuracy most highly at 5\.0\/5/);
  assert.match(summary, /Watch for communication, location, and value, the lowest relative categories at 3\.0\/5/);
});
