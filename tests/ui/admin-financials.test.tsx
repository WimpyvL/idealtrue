import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';

import { FinancialsSection } from '@/features/admin/dashboard-sections';
import type { AdminCheckout } from '@/lib/admin-client';
import type { Subscription, UserProfile } from '@/types';

const host: UserProfile = {
  id: 'host-1',
  displayName: 'Host One',
  email: 'host@example.com',
  photoUrl: '',
  role: 'host',
  referralCode: 'HOST1',
  accountStatus: 'active',
  balance: 0,
  referralCount: 0,
  tier: 'bronze',
  hostPlan: 'professional',
  kycStatus: 'verified',
  createdAt: '2026-04-01T10:00:00.000Z',
};

const subscription: Subscription = {
  id: 'subscription-1',
  userId: host.id,
  plan: 'professional',
  status: 'active',
  amount: 350,
  billingInterval: 'monthly',
  startDate: '2026-06-01T10:00:00.000Z',
  endDate: '2026-07-01T10:00:00.000Z',
  createdAt: '2026-06-01T10:00:00.000Z',
};

const paidManagedPurchase: AdminCheckout = {
  id: 'payment-managed-1',
  userId: host.id,
  checkoutType: 'managed_hosting',
  provider: 'yoco',
  status: 'paid',
  currency: 'ZAR',
  amount: 650,
  hostPlan: null,
  billingInterval: null,
  creditQuantity: null,
  providerCheckoutId: 'checkout-managed-1',
  providerPaymentId: 'payment-managed-provider-1',
  createdAt: '2026-06-02T10:00:00.000Z',
  updatedAt: '2026-06-02T10:05:00.000Z',
};

const pendingCreditsPurchase: AdminCheckout = {
  id: 'payment-credits-1',
  userId: host.id,
  checkoutType: 'content_credits',
  provider: 'yoco',
  status: 'pending',
  currency: 'ZAR',
  amount: 120,
  hostPlan: null,
  billingInterval: null,
  creditQuantity: 10,
  providerCheckoutId: 'checkout-credits-1',
  providerPaymentId: null,
  createdAt: '2026-06-03T10:00:00.000Z',
  updatedAt: '2026-06-03T10:00:00.000Z',
};

describe('FinancialsSection', () => {
  it('reflects paid purchases from checkout activity in financial totals and labels', () => {
    render(
      <FinancialsSection
        allCheckouts={[paidManagedPurchase, pendingCreditsPurchase]}
        allSubscriptions={[subscription]}
        allUsers={[host]}
      />,
    );

    expect(screen.getAllByText('R650')).toHaveLength(2);
    expect(screen.getByText('R350.00')).toBeInTheDocument();
    expect(screen.getByText('Paid: 1')).toBeInTheDocument();
    expect(screen.getByText('Managed hosting')).toBeInTheDocument();
    expect(screen.getByText('Managed hosting package')).toBeInTheDocument();
    expect(screen.getByText('10 credits')).toBeInTheDocument();
  });
});
