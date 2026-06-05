import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import AppRoutes from '@/components/AppRoutes';

const noop = vi.fn();

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes
        hostBookings={[]}
        isAdmin={false}
        listings={[]}
        myBookings={[]}
        myListings={[]}
        onBookingForPaymentProof={noop}
        onBookingToReview={noop}
        onListingRemoved={noop}
        onListingSelected={noop}
        onListingUpdated={noop}
        onSelectedBookingForChat={noop}
        onSyncUpdatedBooking={noop}
        profile={null}
        referrals={[]}
      />
    </MemoryRouter>,
  );
}

describe('AppRoutes public legal pages', () => {
  it.each([
    ['/privacy', /privacy policy/i],
    ['/terms-of-service', /terms of service/i],
    ['/host-agreement', /host agreement/i],
    ['/guest-agreement', /guest agreement/i],
    ['/liability-waiver', /liability waiver/i],
    ['/cancellation-policy', /cancellation.*refund policy/i],
  ])('renders %s without requiring authentication', async (path, heading) => {
    renderRoute(path);

    await expect(screen.findByRole('heading', { name: heading })).resolves.toBeInTheDocument();
  });
});
