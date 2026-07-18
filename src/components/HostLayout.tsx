import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, 
  MessageSquare, 
  ClipboardList, 
  Building2, 
  BarChart3, 
  Trophy, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  Megaphone,
  Sparkles,
  CalendarDays,
  UserCircle2,
  MessageSquareText,
  CreditCard,
  BadgeCheck,
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import BrandLogo from './BrandLogo';
import HostSubscriptionsDialog from './HostSubscriptionsDialog';
import { getBillingPaymentStatus, parseBillingReturnParams } from '@/lib/billing-client';

export default function HostLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, profile, user, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openGroups, setOpenGroups] = useState<string[]>(['Hospitality Management', 'Marketing', 'Referral System']);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const billingReturn = useMemo(() => parseBillingReturnParams(searchParams), [searchParams]);
  const subscriptionsModalOpen = searchParams.get('modal') === 'subscriptions';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  // Author: (|╲) Klaasvaakie
  useEffect(() => {
    if (!user || !billingReturn?.paymentId) {
      return;
    }

    let cancelled = false;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function resolveBillingReturn() {
      try {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const result = await getBillingPaymentStatus(billingReturn.paymentId!, billingReturn.billingStatus);
          if (cancelled) {
            return;
          }

          if (result.status === 'paid') {
            await refreshProfile();
            return;
          }

          if (result.status === 'failed' || result.status === 'cancelled') {
            return;
          }

          if (attempt < 7) {
            await wait(2000);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to resolve host billing return:', error);
        }
      }
    }

    void resolveBillingReturn();

    return () => {
      cancelled = true;
    };
  }, [billingReturn, refreshProfile, user]);

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

  const navGroups = [
    {
      title: 'Hospitality Management',
      icon: Building2,
      items: [
        { name: 'Dashboard', path: '/host', icon: LayoutDashboard },
        { name: 'Onboarding', path: '/host/onboarding', icon: BadgeCheck },
        { name: 'Inbox', path: '/host/inbox', icon: MessageSquare },
        { name: 'Quick Replies', path: '/host/quick-replies', icon: MessageSquareText },
        { name: 'Enquiries', path: '/host/enquiries', icon: ClipboardList },
        { name: 'Listings', path: '/host/listings', icon: Building2 },
        { name: 'Availability', path: '/host/availability', icon: CalendarDays },
        { name: 'Reports', path: '/host/reports', icon: BarChart3 },
      ]
    },
    {
      title: 'Marketing',
      icon: Megaphone,
      items: [
        { name: 'Create Post', path: '/host/social', icon: Sparkles },
        { name: 'Drafts', path: '/host/social?tool=drafts', icon: MessageSquareText },
        { name: 'Calendar', path: '/host/social?tool=calendar', icon: CalendarDays },
      ]
    },
    {
      title: 'Referral System',
      icon: Trophy,
      items: [
        { name: 'Rewards Dashboard', path: '/host/referrals', icon: Trophy },
      ]
    },
    {
      title: 'Administration',
      icon: Settings,
      items: [
        { name: 'Account', path: '/account', icon: UserCircle2 },
        { name: 'Subscriptions', path: '/host?modal=subscriptions', icon: CreditCard },
      ]
    }
  ];

  const currentRoute = `${location.pathname}${location.search}`;
  let currentPageName = 'Dashboard';
  for (const group of navGroups) {
    const item = group.items.find(i => i.path === currentRoute || i.path === location.pathname);
    if (item) {
      currentPageName = item.name;
      break;
    }
  }

  const renderSidebarContent = () => (
    <>
      <div className="p-6 flex items-center justify-center cursor-pointer" onClick={() => navigate('/')} aria-label="Go to Ideal Stay marketplace">
        <BrandLogo variant="inline" size="lg" priority className="h-20" />
      </div>

      <div className="px-4 mb-2">
        <Button
          className="w-full rounded-lg h-12 flex items-center justify-center gap-2 font-semibold"
          onClick={() => navigate('/host/create-listing')}
        >
          <Plus className="w-5 h-5" /> Create Listing
        </Button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroups.includes(group.title);
          const hasActiveChild = group.items.some(item => currentRoute === item.path || location.pathname === item.path || (item.path !== '/host' && location.pathname.startsWith(item.path)));
          
          return (
            <div key={group.title} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.title)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm font-bold rounded-lg transition-colors",
                  hasActiveChild ? "text-primary" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest"
                )}
              >
                <div className="flex items-center gap-3">
                  <GroupIcon className="w-4 h-4" />
                  {group.title}
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {isOpen && (
                <div className="pl-9 pr-2 space-y-1 mt-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentRoute === item.path || (item.path === '/host/social' && location.pathname === '/host/social' && !location.search);
                    return (
                      <Link 
                        key={item.name}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          isActive 
                            ? "text-on-surface bg-surface-container-low" 
                            : "text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="min-w-0 flex-1">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-outline-variant">
        <button 
          onClick={logout}
          className="flex items-center gap-3 px-3 py-3 w-full text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface rounded-lg font-medium transition-colors"
        >
          <LogOut className="w-5 h-5" /> Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden font-sans text-on-surface w-full">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-outline-variant flex-col h-full shrink-0 hidden md:flex">
        {renderSidebarContent()}
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            aria-label="Close dashboard menu"
            className="flex-1 bg-slate-950/40 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="flex h-full w-[min(20rem,88vw)] flex-col border-l border-outline-variant bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Dashboard Menu</span>
              <button
                type="button"
                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close dashboard navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderSidebarContent()}
          </aside>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-surface border-b border-outline-variant flex items-center justify-between px-4 sm:px-6 shrink-0 gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              className="p-2 -ml-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg md:hidden"
              aria-label="Open dashboard navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="truncate text-base font-semibold text-on-surface sm:text-lg">
              {currentPageName}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {profile?.isAdmin && profile.role !== 'admin' && (
              <Button variant="secondary" className="hidden rounded-full px-4 font-medium lg:inline-flex" onClick={() => navigate('/account')}>
                Return to Admin
              </Button>
            )}
            <Button variant="outline" className="hidden rounded-full px-4 font-medium sm:inline-flex" onClick={() => navigate('/')}>
              Switch to Marketplace
            </Button>
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <HostSubscriptionsDialog
        open={subscriptionsModalOpen}
        onOpenChange={(open) => {
          const next = new URLSearchParams(searchParams);
          if (open) {
            next.set('modal', 'subscriptions');
          } else {
            next.delete('modal');
            next.delete('billing_status');
            next.delete('payment_id');
            next.delete('checkout_id');
          }
          setSearchParams(next, { replace: true });
        }}
        onOpenPricing={() => navigate('/pricing')}
      />
    </div>
  );
}
