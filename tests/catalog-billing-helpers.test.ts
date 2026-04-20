import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyYocoWebhookOutcome } from '../encore/billing/webhook-classification.ts';
import { getMaxImagesForPlan, supportsListingVideo } from '../encore/catalog/host-plan.ts';
import { computeHostListingQuota, countsTowardHostListingQuota } from '../encore/catalog/quota.ts';

test('countsTowardHostListingQuota only excludes archived and draft listings', () => {
  assert.equal(countsTowardHostListingQuota('active'), true);
  assert.equal(countsTowardHostListingQuota('inactive'), true);
  assert.equal(countsTowardHostListingQuota('pending'), true);
  assert.equal(countsTowardHostListingQuota('rejected'), true);
  assert.equal(countsTowardHostListingQuota('archived'), false);
  assert.equal(countsTowardHostListingQuota('draft'), false);
});

test('computeHostListingQuota blocks standard hosts after one counted listing', () => {
  assert.deepEqual(computeHostListingQuota('standard', 0), {
    plan: 'standard',
    maxListings: 1,
    usedListings: 0,
    canCreate: true,
  });

  assert.deepEqual(computeHostListingQuota('standard', 1), {
    plan: 'standard',
    maxListings: 1,
    usedListings: 1,
    canCreate: false,
  });
});

test('computeHostListingQuota leaves paid tiers unrestricted', () => {
  assert.deepEqual(computeHostListingQuota('professional', 4), {
    plan: 'professional',
    maxListings: null,
    usedListings: 4,
    canCreate: true,
  });

  assert.deepEqual(computeHostListingQuota('premium', 12), {
    plan: 'premium',
    maxListings: null,
    usedListings: 12,
    canCreate: true,
  });
});

test('listing media entitlements keep Standard at 10 photos and no video while paid tiers keep richer media', () => {
  assert.equal(getMaxImagesForPlan('standard'), 10);
  assert.equal(getMaxImagesForPlan('professional'), 20);
  assert.equal(getMaxImagesForPlan('premium'), 20);

  assert.equal(supportsListingVideo('standard'), false);
  assert.equal(supportsListingVideo('professional'), true);
  assert.equal(supportsListingVideo('premium'), true);
});

test('classifyYocoWebhookOutcome treats succeeded events as paid', () => {
  assert.equal(classifyYocoWebhookOutcome('payment.succeeded', 'succeeded'), 'paid');
  assert.equal(classifyYocoWebhookOutcome('checkout.success', 'pending'), 'paid');
  assert.equal(classifyYocoWebhookOutcome('payment.updated', 'successful'), 'paid');
  assert.equal(classifyYocoWebhookOutcome('payment.updated', 'paid'), 'paid');
});

test('classifyYocoWebhookOutcome keeps failed and cancelled paths explicit', () => {
  assert.equal(classifyYocoWebhookOutcome('payment.failed', 'failed'), 'failed');
  assert.equal(classifyYocoWebhookOutcome('payment.cancelled', 'cancelled'), 'cancelled');
  assert.equal(classifyYocoWebhookOutcome('payment.updated', 'pending'), 'ignored');
});
