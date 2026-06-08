import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const billingApiPath = new URL('../encore/billing/api.ts', import.meta.url);

test('admin financial checkout feed includes current payment intents as purchases', () => {
  const source = readFileSync(billingApiPath, 'utf8');
  const endpointStart = source.indexOf('export const listAdminCheckouts');
  assert.notEqual(endpointStart, -1, 'listAdminCheckouts endpoint should exist');

  const endpointSource = source.slice(endpointStart, source.indexOf('export const getMyHostBillingAccount', endpointStart));
  assert.match(endpointSource, /FROM billing_checkout_sessions/);
  assert.match(endpointSource, /UNION ALL/);
  assert.match(endpointSource, /purpose AS checkout_type/);
  assert.match(endpointSource, /FROM billing_payment_intents/);
  assert.match(endpointSource, /ORDER BY created_at DESC/);
});

test('managed hosting fulfilment upgrades identity host plan used by listing quota', () => {
  const source = readFileSync(billingApiPath, 'utf8');
  const functionStart = source.indexOf('async function activateManagedHostingFromPaymentIntent');
  assert.notEqual(functionStart, -1, 'managed hosting fulfilment should exist');

  const functionSource = source.slice(functionStart, source.indexOf('async function markCheckoutPaid', functionStart));
  assert.match(functionSource, /UPDATE users/);
  assert.match(functionSource, /SET host_plan = \$\{"premium"\}/);
  assert.match(functionSource, /management_mode = \$\{"managed"\}/);
  assert.match(functionSource, /WHERE id = \$\{intent\.user_id\}/);
});

test('admin manual host referrals are created as subscription conversion rewards', () => {
  const adminDashboardPath = new URL('../src/pages/AdminDashboard.tsx', import.meta.url);
  const source = readFileSync(adminDashboardPath, 'utf8');
  const handlerStart = source.indexOf('const handleCreateManualReferral');
  assert.notEqual(handlerStart, -1, 'AdminDashboard should own manual referral creation');

  const handlerSource = source.slice(handlerStart, source.indexOf('const menuItems', handlerStart));
  assert.match(handlerSource, /createAdminReferralReward/);
  assert.match(handlerSource, /trigger: program === 'guest' \? 'signup' : 'subscription'/);
  assert.match(handlerSource, /program,/);
});
