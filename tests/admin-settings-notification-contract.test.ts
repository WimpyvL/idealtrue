// ( |╲ ) Author: Klaasvaakie
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adminDashboard = readFileSync(new URL('../src/pages/AdminDashboard.tsx', import.meta.url), 'utf8');
const adminSections = readFileSync(new URL('../src/features/admin/dashboard-sections.tsx', import.meta.url), 'utf8');
const platformTypes = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');
const platformApi = readFileSync(new URL('../encore/ops/api.ts', import.meta.url), 'utf8');

test('admin header uses the working notification bell and has no decorative share action', () => {
  assert.match(adminDashboard, /import NotificationBell from '@\/components\/NotificationBell';/);
  assert.match(adminDashboard, /<NotificationBell\s*\/>/);

  const bellActionPattern = /<NotificationBell\s*\/?>|<(?:button|Button)\b[^>]*>\s*[^<]*<\s*(?:Bell|Share2)\b/;
  const shareActionPattern = /<(?:button|Button)\b[^>]*>\s*[^<]*<\s*Share2\b/;
  const bellActionMatches = adminDashboard.match(bellActionPattern);
  const shareActionMatches = adminDashboard.match(shareActionPattern);

  assert.ok(bellActionMatches, 'expected a header action to render a Bell icon');
  assert.ok(!shareActionMatches, 'did not expect a header action to render Share2');
});

test('platform commission is removed from settings UI and runtime contracts', () => {
  for (const source of [adminSections, platformTypes, platformApi]) {
    assert.doesNotMatch(source, /commissionRate|Platform Commission|commission_rate/);
  }
});
