import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PricingPage from '@/pages/PricingPage';
import { createIdealStayQueryClient } from '@/lib/query-client';

const refreshProfileMock = vi.fn();
const authState = {
  user: null as unknown,
  profile: null as unknown,
  refreshProfile: refreshProfileMock,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/billing-client', () => ({
  startBillingPayment: vi.fn(async (params: { purpose: string }) => ({
    paymentId: `payment-${params.purpose}`,
    provider: 'yoco',
    providerMode: 'test',
    status: 'pending',
    redirectUrl: `https://pay.yoco.com/r/generated-${params.purpose}`,
    providerReference: `checkout-${params.purpose}`,
  })),
  createManagedHostingCheckout: vi.fn(async () => ({
    paymentId: 'payment-managed-1',
    provider: 'yoco',
    providerMode: 'test',
    status: 'pending',
    redirectUrl: 'https://pay.yoco.com/r/generated-managed',
    providerReference: 'checkout-managed-1',
  })),
  getBillingPaymentStatus: vi.fn(),
  getCheckoutStatus: vi.fn(),
  getMyHostBillingAccount: vi.fn(),
  parseBillingReturnParams: (searchParams: URLSearchParams) => {
    const billingStatus = searchParams.get('billing_status');
    const paymentId = searchParams.get('payment_id');
    const checkoutId = searchParams.get('checkout_id');
    if (!['success', 'cancelled', 'failed'].includes(`${billingStatus}`) || (!paymentId && !checkoutId)) {
      return null;
    }
    return { billingStatus, paymentId: paymentId || null, checkoutId: checkoutId || null };
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPricing(initialEntry = '/pricing') {
  const queryClient = createIdealStayQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/signup" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PricingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.profile = null;
    vi.stubEnv('VITE_YOCO_PAYMENT_MODE', '');
  });

  it('opens the Yoco subscription checkout for a selected plan when the user is signed in', async () => {
    const user = userEvent.setup();
    const assignMock = vi.fn();
    authState.user = { id: 'host-1' };

    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign: assignMock },
      writable: true,
    });

    renderPricing();

    await user.click(await screen.findByRole('button', { name: /get more visibility/i }));

    expect(assignMock).toHaveBeenCalledWith('https://pay.yoco.com/r/generated-subscription');
  });

  it('starts the managed hosting checkout for a signed-in host', async () => {
    const user = userEvent.setup();
    const assignMock = vi.fn();
    authState.user = { id: 'host-1' };

    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign: assignMock },
      writable: true,
    });

    renderPricing();

    expect(await screen.findByRole('button', { name: /apply for managed hosting/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /apply for managed hosting/i }));

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('https://pay.yoco.com/r/generated-managed');
    });
  });

  it('routes unauthenticated managed hosting into managed host signup', async () => {
    const user = userEvent.setup();

    renderPricing();

    await user.click(await screen.findByRole('button', { name: /apply for managed hosting/i }));

    await waitFor(() => {
      const location = screen.getByTestId('location').textContent ?? '';
      expect(location).toContain('/signup?');
      expect(location).toContain('role=host');
      expect(location).toContain('management=managed');
      expect(location).toContain('returnTo=%2Fpricing');
    });
  });

  it('shows a test mode banner when Yoco test mode is enabled on the frontend', async () => {
    vi.stubEnv('VITE_YOCO_PAYMENT_MODE', 'test');

    renderPricing();

    expect(await screen.findByText(/yoco test mode is active/i)).toBeInTheDocument();
  });

  it('does not claim plan activation after a verified test payment', async () => {
    const { getBillingPaymentStatus } = await import('@/lib/billing-client');
    const { toast } = await import('sonner');
    authState.user = { id: 'host-1' };
    vi.mocked(getBillingPaymentStatus).mockResolvedValue({ status: 'paid', purpose: 'subscription', providerMode: 'test' });
    renderPricing('/pricing?billing_status=success&payment_id=test-payment');
    await waitFor(() => expect(toast.message).toHaveBeenCalledWith(
      'Test payment confirmed. No plan access or account benefits were activated.',
    ));
    expect(refreshProfileMock).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
