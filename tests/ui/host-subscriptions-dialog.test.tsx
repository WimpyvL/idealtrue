import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostSubscriptionsDialog from '@/components/HostSubscriptionsDialog';

const mockListMySubscriptions = vi.fn();
const mockGetMyHostBillingAccount = vi.fn();
const mockRefreshProfile = vi.fn();
let mockProfile = {
  id: 'host-1',
  displayName: 'Host Example',
  email: 'host@example.com',
  role: 'host',
  hostPlan: 'premium',
  managementMode: 'self_service',
};

vi.mock('@/lib/billing-client', () => ({
  listMySubscriptions: () => mockListMySubscriptions(),
  getMyHostBillingAccount: () => mockGetMyHostBillingAccount(),
  cancelMySubscription: vi.fn(),
  changeMySubscription: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: mockProfile,
    refreshProfile: mockRefreshProfile,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

describe('HostSubscriptionsDialog', () => {
  beforeEach(() => {
    mockProfile = {
      id: 'host-1',
      displayName: 'Host Example',
      email: 'host@example.com',
      role: 'host',
      hostPlan: 'premium',
      managementMode: 'self_service',
    };
    mockListMySubscriptions.mockResolvedValue([
      {
        id: 'subscription-1',
        userId: 'host-1',
        plan: 'premium',
        amount: 499,
        status: 'active',
        billingInterval: 'monthly',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-08-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
    mockGetMyHostBillingAccount.mockResolvedValue({
      userId: 'host-1',
      plan: 'premium',
      billingSource: 'paid',
      billingStatus: 'active',
      reminderCount: 0,
      cardOnFile: true,
      inReminderWindow: false,
      greylistEligible: false,
      nextAction: 'none',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    mockRefreshProfile.mockResolvedValue(null);
  });

  it('shows downgrade and cancellation controls for an active self-service subscription', async () => {
    render(
      <HostSubscriptionsDialog
        open
        onOpenChange={vi.fn()}
        onOpenPricing={vi.fn()}
      />,
    );

    expect(await screen.findByText('Subscription Management')).toBeInTheDocument();
    expect(await screen.findByText(/Current cycle:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel at period end/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Current plan selected/i })).toBeInTheDocument();
    expect(screen.getByText(/Change plan/i)).toBeInTheDocument();
  });

  // ( |╲ ) Klaasvaakie - stale managed flags must not mask the active self-service subscription.
  it('uses the active self-service subscription when managed account state is stale', async () => {
    mockProfile = {
      id: 'host-1',
      displayName: 'Host Example',
      email: 'host@example.com',
      role: 'host',
      hostPlan: 'professional',
      managementMode: 'managed',
    };
    mockRefreshProfile.mockResolvedValue(mockProfile);
    mockListMySubscriptions.mockResolvedValue([
      {
        id: 'subscription-professional',
        userId: 'host-1',
        plan: 'professional',
        amount: 350,
        status: 'active',
        billingInterval: 'monthly',
        startDate: '2026-07-09T00:00:00.000Z',
        endDate: '2026-08-09T00:00:00.000Z',
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: '2026-07-09T00:00:00.000Z',
      },
    ]);
    mockGetMyHostBillingAccount.mockResolvedValue({
      userId: 'host-1',
      plan: 'professional',
      billingSource: 'paid',
      billingStatus: 'active',
      reminderCount: 0,
      cardOnFile: true,
      inReminderWindow: false,
      greylistEligible: false,
      nextAction: 'none',
      createdAt: '2026-07-09T00:00:00.000Z',
      updatedAt: '2026-07-09T00:00:00.000Z',
    });

    render(
      <HostSubscriptionsDialog
        open
        onOpenChange={vi.fn()}
        onOpenPricing={vi.fn()}
      />,
    );

    expect(await screen.findByText('Subscription Management')).toBeInTheDocument();
    expect(screen.getAllByText('Professional').length).toBeGreaterThan(0);
    expect(screen.queryByText('Managed Hosting')).not.toBeInTheDocument();
    expect(screen.getByText(/Stored managed-hosting state is stale/i)).toBeInTheDocument();
    expect(screen.getByText(/Current cycle:/)).toBeInTheDocument();
  });
});
