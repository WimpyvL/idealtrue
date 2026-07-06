import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostSubscriptionsDialog from '@/components/HostSubscriptionsDialog';

const mockListMySubscriptions = vi.fn();
const mockGetMyHostBillingAccount = vi.fn();
const mockRefreshProfile = vi.fn();

vi.mock('@/lib/billing-client', () => ({
  listMySubscriptions: () => mockListMySubscriptions(),
  getMyHostBillingAccount: () => mockGetMyHostBillingAccount(),
  cancelMySubscription: vi.fn(),
  changeMySubscription: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      id: 'host-1',
      displayName: 'Host Example',
      email: 'host@example.com',
      role: 'host',
      hostPlan: 'premium',
      managementMode: 'self_service',
    },
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
});
