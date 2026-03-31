import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
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
  Plus,
  ChevronDown,
  ChevronRight,
  Share2,
  Sparkles,
  CalendarDays,
  UserCircle2
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';

export default function HostLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, profile } = useAuth();
  const [openGroups, setOpenGroups] = useState<string[]>(['Hospitality Management', 'Social Media', 'Referral System']);

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
        { name: 'Inbox', path: '/host/inbox', icon: MessageSquare },
        { name: 'Enquiries', path: '/host/enquiries', icon: ClipboardList },
        { name: 'Listings', path: '/host/listings', icon: Building2 },
        { name: 'Availability', path: '/host/availability', icon: CalendarDays },
        { name: 'Reports', path: '/host/reports', icon: BarChart3 },
      ]
    },
    {
      title: 'Social Media',
      icon: Share2,
      items: [
        { name: 'Content Studio', path: '/host/social', icon: Sparkles },
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
      ]
    }
  ];

  let currentPageName = 'Dashboard';
  for (const group of navGroups) {
    const item = group.items.find(i => i.path === location.pathname);
    if (item) {
      currentPageName = item.name;
      break;
    }
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden font-sans text-on-surface w-full">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-outline-variant flex flex-col h-full shrink-0 hidden md:flex">
        <div className="p-6 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 bg-gradient-to-br from-slate-900 to-blue-600 rounded-lg flex items-center justify-center overflow-hidden shadow-lg shadow-blue-900/20">
            <span className="text-xl font-black text-white">IS</span>
          </div>
          <span className="text-xl font-black tracking-tight text-on-surface">IDEAL STAY</span>
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
            const hasActiveChild = group.items.some(item => location.pathname === item.path || (item.path !== '/host' && location.pathname.startsWith(item.path)));
            
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
                      const isActive = location.pathname === item.path;
                      return (
                        <Link 
                          key={item.name}
                          to={item.path} 
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                            isActive 
                              ? "text-on-surface bg-surface-container-low" 
                              : "text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
                          )}
                        >
                          <Icon className="w-4 h-4" /> {item.name}
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
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-surface border-b border-outline-variant flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button className="p-2 -ml-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg md:hidden">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-on-surface">
              {currentPageName}
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            {profile?.isAdmin && profile.role !== 'admin' && (
              <Button variant="secondary" className="rounded-full px-6 font-medium" onClick={() => navigate('/account')}>
                Return to Admin
              </Button>
            )}
            <Button variant="outline" className="rounded-full px-6 font-medium" onClick={() => navigate('/')}>
              Switch to Marketplace
            </Button>
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
