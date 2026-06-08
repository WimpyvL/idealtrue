import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { ReferralsSection } from '@/features/admin/dashboard-sections';
import type { Referral, UserProfile } from '@/types';

const referrer: UserProfile = {
  id: 'user-referrer',
  displayName: 'Referrer Host',
  email: 'referrer@example.com',
  photoUrl: '',
  role: 'host',
  referralCode: 'REFHOST',
  accountStatus: 'active',
  balance: 0,
  referralCount: 1,
  tier: 'bronze',
  hostPlan: 'professional',
  kycStatus: 'verified',
  createdAt: '2026-06-01T10:00:00.000Z',
};

const referredHost: UserProfile = {
  id: 'user-referred',
  displayName: 'Referred Host',
  email: 'referred@example.com',
  photoUrl: '',
  role: 'host',
  referralCode: 'REFERRED',
  accountStatus: 'active',
  balance: 0,
  referralCount: 0,
  tier: 'bronze',
  hostPlan: 'premium',
  kycStatus: 'verified',
  createdAt: '2026-06-02T10:00:00.000Z',
};

const hostSubscriptionReferral: Referral = {
  id: 'referral-subscription-1',
  referrerId: referrer.id,
  referredUserId: referredHost.id,
  trigger: 'subscription',
  program: 'host',
  amount: 50,
  status: 'confirmed',
  createdAt: '2026-06-03T10:00:00.000Z',
};

describe('ReferralsSection', () => {
  it('shows host subscription referrals in the Host Referrals tab and creates manual host referrals as host program records', async () => {
    const handleCreateManualReferral = vi.fn();

    render(
      <ReferralsSection
        allReferrals={[hostSubscriptionReferral]}
        allUsers={[referrer, referredHost]}
        handleCreateManualReferral={handleCreateManualReferral}
        setConfirmDelete={vi.fn()}
      />,
    );

    expect(screen.queryByText('Referrer Host')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Host Referrals' }));

    expect(screen.getByText('Referrer Host')).toBeInTheDocument();
    expect(screen.getByText('Referred Host')).toBeInTheDocument();
    expect(screen.getAllByText('confirmed')).toHaveLength(2);

    await userEvent.type(screen.getByPlaceholderText('referrer@example.com'), referrer.email);
    await userEvent.type(screen.getByPlaceholderText('referee@example.com'), referredHost.email);
    await userEvent.click(screen.getByRole('button', { name: /Create Referral/i }));

    await waitFor(() =>
      expect(handleCreateManualReferral).toHaveBeenCalledWith({
        referrerEmail: referrer.email,
        refereeEmail: referredHost.email,
        program: 'host',
      }),
    );
  });
});
