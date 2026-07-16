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
  assert.doesNotMatch(adminDashboard, /<button[^>]*><Bell className=/);
  assert.doesNotMatch(adminDashboard, /<button[^>]*><Share2 className=/);
});

test('platform commission is removed from settings UI and runtime contracts', () => {
  for (const source of [adminSections, platformTypes, platformApi]) {
    assert.doesNotMatch(source, /commissionRate|Platform Commission|commission_rate/);
  }
});
