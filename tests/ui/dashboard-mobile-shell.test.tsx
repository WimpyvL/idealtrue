import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import HostLayout from '@/components/HostLayout';
import AdminDashboard from '@/pages/AdminDashboard';

const logoutMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: logoutMock,
    profile: {
      id: 'user-1',
      email: 'admin@example.com',
      role: 'host',
      isAdmin: true,
    },
  }),
}));

vi.mock('@/components/NotificationBell', () => ({
  default: () => <div data-testid="notification-bell">bell</div>,
}));

vi.mock('@/components/BrandLogo', () => ({
  default: () => <div>Ideal Stay</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/admin/dashboard-sections', () => ({
  OverviewSection: () => <div>Overview section</div>,
  EnquiriesSection: () => <div>Enquiries section</div>,
  ListingsSection: () => <div>Listings section</div>,
  ManagedHostingSection: () => <div>Managed hosting section</div>,
  PendingListingsSection: () => <div>Pending listings section</div>,
  UsersSection: () => <div>Users section</div>,
  KycSection: () => <div>KYC section</div>,
  ReviewsSection: () => <div>Reviews section</div>,
  ReferralsSection: () => <div>Referrals section</div>,
  RewardsSection: () => <div>Rewards section</div>,
  FinancialsSection: () => <div>Financials section</div>,
  NotificationsSection: () => <div>Notifications section</div>,
  SettingsSection: () => <div>Settings section</div>,
}));

vi.mock('@/features/admin/use-admin-dashboard-data', () => ({
  useAdminDashboardData: () => ({
    stats: {
      totalUsers: 0,
      activeListings: 0,
    },
    setStats: vi.fn(),
    recentEnquiries: [],
    allBookings: [],
    topListings: [],
    setTopListings: vi.fn(),
    allListings: [],
    setAllListings: vi.fn(),
    allHostBillingAccounts: [],
    allUsers: [],
    setAllUsers: vi.fn(),
    allReferrals: [],
    setAllReferrals: vi.fn(),
    allReviews: [],
    setAllReviews: vi.fn(),
    allSubscriptions: [],
    allCheckouts: [],
    allNotifications: [],
    setAllNotifications: vi.fn(),
    platformSettings: null,
    observability: null,
    kycSubmissions: [],
    setKycSubmissions: vi.fn(),
    handleApproveKyc: vi.fn(),
    handleSetHostGreylist: vi.fn(),
    handleUpdateListingStatus: vi.fn(),
    handleUpdateSettings: vi.fn(),
    handleUpdateUserRole: vi.fn(),
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('dashboard mobile shells', () => {
  it('opens and closes the host mobile menu and keeps route-specific labels', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/host/social?tool=ideas']}>
        <Routes>
          <Route path="/host" element={<HostLayout />}>
            <Route path="social" element={<div>Host content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('New Post Ideas')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Open dashboard navigation'));

    const menuTitle = screen.getByText('Dashboard Menu');
    const mobileMenu = menuTitle.closest('aside');
    expect(mobileMenu).not.toBeNull();

    await user.click(within(mobileMenu as HTMLElement).getByLabelText('Close dashboard navigation'));
    expect(screen.queryByText('Dashboard Menu')).not.toBeInTheDocument();
  });

  it('opens the admin mobile menu and lets the user switch sections from it', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText('Open admin navigation'));

    const menuTitle = screen.getByText('Admin Menu');
    const mobileMenu = menuTitle.closest('aside');
    expect(mobileMenu).not.toBeNull();

    await user.click(within(mobileMenu as HTMLElement).getByRole('button', { name: 'Settings' }));

    expect(screen.queryByText('Admin Menu')).not.toBeInTheDocument();
    expect(screen.getAllByText('Settings section').length).toBeGreaterThan(0);
  });

  it('opens the admin mobile menu and switches into the managed hosting section', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText('Open admin navigation'));

    const menuTitle = screen.getByText('Admin Menu');
    const mobileMenu = menuTitle.closest('aside');
    expect(mobileMenu).not.toBeNull();

    await user.click(within(mobileMenu as HTMLElement).getByRole('button', { name: 'Managed Hosting' }));

    expect(screen.queryByText('Admin Menu')).not.toBeInTheDocument();
    expect(screen.getAllByText('Managed hosting section').length).toBeGreaterThan(0);
  });
});
