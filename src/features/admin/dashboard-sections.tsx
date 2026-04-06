import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Home,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Send,
  Star,
  Trash2,
  TrendingUp,
  Users,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format, subMonths } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatRand } from '@/lib/currency';
import type {
  Booking,
  Listing,
  Notification,
  PlatformSettings,
  Referral,
  Review,
  Subscription,
  UserProfile,
} from '@/types';
import type { AdminCheckout, AdminObservabilitySnapshot } from '@/lib/admin-client';
import type { KycSubmission } from '@/lib/ops-client';
import { formatUptime, StatCard, sortByDate } from './dashboard-support';

type ConfirmDelete = {
  type: 'user' | 'listing' | 'review' | 'referral' | 'notification';
  id: string;
};

type DateSortDirection = 'asc' | 'desc';
type ReferralFilter = 'all' | 'pending' | 'confirmed' | 'rewarded';
type ReferralTab = 'guest' | 'host';
type KycFilter = 'all' | 'pending' | 'verified' | 'rejected';

function SortHeader({
  label,
  direction,
  onToggle,
}: {
  label: string;
  direction: DateSortDirection;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
      onClick={onToggle}
    >
      <span>{label}</span>
      <ArrowUpDown className="h-3 w-3" />
      <span className="text-[9px]">{direction === 'desc' ? 'Newest' : 'Oldest'}</span>
    </button>
  );
}

export function OverviewSection({
  allBookings,
  allListings,
  observability,
  recentEnquiries,
  setActiveMenu,
  stats,
  topListings,
}: {
  allBookings: Booking[];
  allListings: Listing[];
  observability: AdminObservabilitySnapshot | null;
  recentEnquiries: Booking[];
  setActiveMenu: (value: string) => void;
  stats: { totalUsers: number; activeListings: number; totalEnquiries: number; pendingReviews: number };
  topListings: Listing[];
}) {
  const platformGrowthData = Array.from({ length: 6 }).map((_, index) => {
    const month = subMonths(new Date(), 5 - index);
    const monthKey = format(month, 'yyyy-MM');
    return {
      name: format(month, 'MM'),
      value: allBookings.filter((booking) => format(new Date(booking.createdAt), 'yyyy-MM') === monthKey).length,
    };
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Dashboard Overview</h1>
        <p className="text-[#5e6064]">Welcome back, Admin. Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard title="Active Listings" value={stats.activeListings} icon={Home} iconBg="bg-green-50" iconColor="text-green-600" />
        <StatCard title="Total Enquiries" value={stats.totalEnquiries} icon={MessageSquare} iconBg="bg-purple-50" iconColor="text-purple-600" />
        <StatCard title="Pending Reviews" value={stats.pendingReviews} icon={Star} iconBg="bg-yellow-50" iconColor="text-yellow-600" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="space-y-6 p-8 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Platform Growth</h2>
            <select className="rounded-md border-none bg-slate-100 px-2 py-1 text-xs font-bold">
              <option>Last 6 Months</option>
              <option>Last Year</option>
            </select>
          </div>
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={platformGrowthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {platformGrowthData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === platformGrowthData.length - 1 ? '#0f172a' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="space-y-8 bg-[#0f172a] p-8 text-white">
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Operational Coverage</h2>
            <p className="text-xs text-slate-400">What the admin surface can actually trust right now.</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2 rounded-2xl border border-slate-800 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Backend uptime</p>
              <p className="text-2xl font-bold">{observability ? formatUptime(observability.uptimeSeconds) : '...'}</p>
              <p className="text-sm text-slate-300">{observability ? `Checked ${format(new Date(observability.checkedAt), 'MMM d, HH:mm')}` : 'Waiting for health snapshot'}</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-slate-800 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Database health</p>
              <p className="text-2xl font-bold">{observability ? `${observability.healthyDatabases}/${observability.totalDatabases}` : '...'}</p>
              <p className="text-sm text-slate-300">{observability ? `${observability.averageDbPingMs}ms average ping across Encore databases` : 'Waiting for database checks'}</p>
            </div>
            <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Observability coverage</p>
              <p className="text-sm text-emerald-100">
                Vercel Web Analytics is live for frontend traffic, and Encore Cloud already gives us tracing, metrics, and logs for the backend outside this admin panel.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-slate-300">
                The admin panel now shows a real backend health snapshot. Deep traces and runtime metrics still live in Encore Cloud.
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card className="space-y-6 p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Recent Enquiries</h2>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveMenu('enquiries')}>View All</Button>
          </div>
          <div className="space-y-4">
            {recentEnquiries.map((enquiry) => {
              const listing = allListings.find((candidate) => candidate.id === enquiry.listingId);
              return (
                <div key={enquiry.id} className="group flex items-center justify-between rounded-2xl bg-slate-50 p-4 transition-colors hover:bg-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                      <MessageSquare className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{listing?.title || 'Property Enquiry'}</p>
                      <p className="text-xs text-slate-500">{new Date(enquiry.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge variant={enquiry.status === 'confirmed' ? 'success' : 'warning'} className="text-[10px] uppercase">
                    {enquiry.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-6 p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Top Performing</h2>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveMenu('listings')}>View All</Button>
          </div>
          <div className="space-y-4">
            {topListings.map((listing) => (
              <div key={listing.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 transition-colors hover:bg-slate-100">
                <div className="flex items-center gap-4">
                  <img src={listing.images[0]} className="h-12 w-12 rounded-xl object-cover" alt="" referrerPolicy="no-referrer" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{listing.title}</p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-bold text-slate-600">{listing.rating}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatRand(listing.pricePerNight)}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Per Night</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function PendingListingsSection({
  allListings,
  allUsers,
  openRejectListingDialog,
  handleUpdateListingStatus,
}: {
  allListings: Listing[];
  allUsers: UserProfile[];
  openRejectListingDialog: (listing: Listing) => void;
  handleUpdateListingStatus: (listingId: string, newStatus: Listing['status']) => Promise<void> | void;
}) {
  const pendingListings = allListings.filter((listing) => listing.status === 'pending');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Pending Listings</h1>
        <p className="text-[#5e6064]">Review and approve new property listings.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pendingListings.map((listing) => {
          const host = allUsers.find((user) => user.id === listing.hostId);
          return (
            <Card key={listing.id} className="group flex flex-col overflow-hidden">
              <div className="relative aspect-video overflow-hidden">
                <img src={listing.images[0]} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" referrerPolicy="no-referrer" />
                <div className="absolute left-3 top-3">
                  <Badge variant="warning" className="text-[10px] uppercase">Inactive</Badge>
                </div>
              </div>
              <div className="flex-1 space-y-4 p-5">
                <div>
                  <h3 className="mb-1 text-lg font-bold leading-tight">{listing.title}</h3>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" /> {listing.location}
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <img src={host?.photoUrl} className="h-8 w-8 rounded-full border border-white" alt="" referrerPolicy="no-referrer" />
                  <div>
                    <p className="text-xs font-bold">{host?.displayName}</p>
                    <p className="text-[10px] text-slate-400">Host</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button className="h-9 flex-1 text-xs" onClick={() => handleUpdateListingStatus(listing.id, 'active')}>
                    Approve
                  </Button>
                  <Button variant="outline" className="h-9 flex-1 text-xs" onClick={() => openRejectListingDialog(listing)}>
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {pendingListings.length === 0 ? (
          <div className="col-span-full space-y-4 py-20 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 opacity-20" />
            <p className="italic text-slate-400">No pending listings to review.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function UsersSection({
  allUsers,
  handleReviewKYC,
  handleUpdateUserRole,
  kycSubmissions,
  navigate,
  openAccountStatusDialog,
  setConfirmDelete,
  setEditingUser,
}: {
  allUsers: UserProfile[];
  handleReviewKYC: (submission: KycSubmission) => void;
  handleUpdateUserRole: (userId: string, role: UserProfile['role']) => Promise<void> | void;
  kycSubmissions: KycSubmission[];
  navigate: (value: string) => void;
  openAccountStatusDialog: (user: UserProfile, nextStatus: UserProfile['accountStatus']) => void;
  setConfirmDelete: (value: ConfirmDelete | null) => void;
  setEditingUser: (user: UserProfile | null) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<DateSortDirection>('desc');
  const filteredUsers = sortByDate(
    allUsers.filter((user) =>
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
    (user) => user.createdAt,
    sortDirection,
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">User Management</h1>
          <p className="text-[#5e6064]">Manage platform users and their roles.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search users..." className="h-10 rounded-xl pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#f8fafc]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">User</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Account</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">KYC Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Stats</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <SortHeader label="Created" direction={sortDirection} onToggle={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')} />
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={user.photoUrl} className="h-10 w-10 rounded-full border border-slate-100" alt="" referrerPolicy="no-referrer" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{user.displayName}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select className="rounded-md border-none bg-slate-100 px-2 py-1 text-xs font-bold focus:ring-2 focus:ring-primary" value={user.role} onChange={(event) => handleUpdateUserRole(user.id, event.target.value as UserProfile['role'])}>
                      <option value="guest">Guest</option>
                      <option value="host">Host</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <Badge
                        variant={
                          user.accountStatus === 'active'
                            ? 'success'
                            : user.accountStatus === 'suspended'
                              ? 'warning'
                              : 'danger'
                        }
                        className="text-[10px] uppercase"
                      >
                        {user.accountStatus}
                      </Badge>
                      {user.accountStatusReason ? (
                        <p className="max-w-[220px] text-[11px] leading-4 text-slate-500">{user.accountStatusReason}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={user.kycStatus === 'verified' ? 'success' : user.kycStatus === 'pending' ? 'warning' : user.kycStatus === 'rejected' ? 'danger' : 'neutral'} className="text-[10px] uppercase">
                      {user.kycStatus}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1 text-xs">
                      <p><span className="text-slate-400">Referrals:</span> {user.referralCount}</p>
                      <p><span className="text-slate-400">Balance:</span> {formatRand(user.balance)}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {user.kycStatus === 'pending' ? (
                        <Button variant="outline" size="sm" className="h-8 text-xs text-green-600 hover:bg-green-50" onClick={() => {
                          const submission = kycSubmissions.find((item) => item.userId === user.id);
                          if (submission) handleReviewKYC(submission);
                        }}>
                          Review KYC
                        </Button>
                      ) : null}
                      {user.accountStatus === 'active' ? (
                        <>
                          <Button variant="outline" size="sm" className="h-8 text-xs text-amber-700 hover:bg-amber-50" onClick={() => openAccountStatusDialog(user, 'suspended')}>
                            Suspend
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 hover:bg-red-50" onClick={() => openAccountStatusDialog(user, 'deactivated')}>
                            Deactivate
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" className="h-8 text-xs text-green-700 hover:bg-green-50" onClick={() => openAccountStatusDialog(user, 'active')}>
                          Reactivate
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-xs text-blue-500" onClick={() => setEditingUser(user)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-xs text-red-500" onClick={() => setConfirmDelete({ type: 'user', id: user.id })}>Delete</Button>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(`/account?id=${user.id}`)}>View Profile</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function ListingsSection({
  allListings,
  allUsers,
  handleUpdateListingStatus,
  setConfirmDelete,
  setEditingListing,
}: {
  allListings: Listing[];
  allUsers: UserProfile[];
  handleUpdateListingStatus: (listingId: string, newStatus: Listing['status']) => Promise<void> | void;
  setConfirmDelete: (value: ConfirmDelete | null) => void;
  setEditingListing: (listing: Listing | null) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<DateSortDirection>('desc');
  const filteredListings = sortByDate(
    allListings.filter((listing) =>
      listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.location.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
    (listing) => listing.createdAt,
    sortDirection,
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Listing Management</h1>
          <p className="text-[#5e6064]">Monitor and moderate all property listings.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search listings..." className="h-10 rounded-xl pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#f8fafc]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Property</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Host</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Price</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <SortHeader label="Created" direction={sortDirection} onToggle={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')} />
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredListings.map((listing) => {
                const host = allUsers.find((user) => user.id === listing.hostId);
                return (
                  <tr key={listing.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={listing.images[0]} className="h-12 w-12 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{listing.title}</p>
                          <p className="text-xs text-slate-500">{listing.location}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{host?.displayName || 'Unknown Host'}</p>
                      <p className="text-[10px] text-slate-400">{listing.hostId.slice(0, 8)}...</p>
                    </td>
                    <td className="px-6 py-4"><p className="text-sm font-bold">{formatRand(listing.pricePerNight)}</p></td>
                    <td className="px-6 py-4">
                      <Badge variant={listing.status === 'active' ? 'success' : 'neutral'} className="text-[10px] uppercase">
                        {listing.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4"><p className="text-xs text-slate-500">{new Date(listing.createdAt).toLocaleDateString()}</p></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-500" onClick={() => setEditingListing(listing)}>Edit</Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleUpdateListingStatus(listing.id, listing.status === 'active' ? 'inactive' : 'active')}>
                          {listing.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDelete({ type: 'listing', id: listing.id })}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function EnquiriesSection({
  allBookings,
  allListings,
  allUsers,
}: {
  allBookings: Booking[];
  allListings: Listing[];
  allUsers: UserProfile[];
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<DateSortDirection>('desc');
  const filteredBookings = sortByDate(
    allBookings.filter((booking) => {
      const listing = allListings.find((candidate) => candidate.id === booking.listingId);
      const guest = allUsers.find((candidate) => candidate.id === booking.guestId);
      return Boolean(
        listing?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guest?.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }),
    (booking) => booking.createdAt,
    sortDirection,
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Enquiry Management</h1>
          <p className="text-[#5e6064]">Monitor all booking requests and transactions.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search enquiries..." className="h-10 rounded-xl pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#f8fafc]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Booking ID</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Property</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Guest</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Dates</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <SortHeader label="Created" direction={sortDirection} onToggle={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')} />
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.map((booking) => {
                const listing = allListings.find((candidate) => candidate.id === booking.listingId);
                const guest = allUsers.find((candidate) => candidate.id === booking.guestId);
                return (
                  <tr key={booking.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4"><p className="font-mono text-xs text-slate-400">#{booking.id.slice(0, 8)}</p></td>
                    <td className="px-6 py-4"><p className="text-sm font-bold text-slate-900">{listing?.title || 'Deleted Property'}</p></td>
                    <td className="px-6 py-4"><p className="text-sm font-medium">{guest?.displayName || 'Unknown Guest'}</p></td>
                    <td className="px-6 py-4"><p className="text-xs text-slate-500">{new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}</p></td>
                    <td className="px-6 py-4"><p className="text-xs text-slate-500">{new Date(booking.createdAt).toLocaleString()}</p></td>
                    <td className="px-6 py-4"><p className="text-sm font-bold">{formatRand(booking.totalPrice)}</p></td>
                    <td className="px-6 py-4 text-right">
                      <Badge variant={booking.status === 'confirmed' ? 'success' : booking.status === 'pending' ? 'warning' : 'neutral'} className="text-[10px] uppercase">
                        {booking.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function ReferralsSection({
  allReferrals,
  allUsers,
  handleCreateManualReferral,
  setConfirmDelete,
}: {
  allReferrals: Referral[];
  allUsers: UserProfile[];
  handleCreateManualReferral: (values: { referrerEmail: string; refereeEmail: string; program: ReferralTab }) => Promise<void> | void;
  setConfirmDelete: (value: ConfirmDelete | null) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<DateSortDirection>('desc');
  const [referralFilter, setReferralFilter] = useState<ReferralFilter>('all');
  const [referralTab, setReferralTab] = useState<ReferralTab>('guest');
  const [manualReferrerEmail, setManualReferrerEmail] = useState('');
  const [manualRefereeEmail, setManualRefereeEmail] = useState('');
  const filteredReferrals = sortByDate(
    allReferrals.filter((referral) => {
      const referrer = allUsers.find((user) => user.id === referral.referrerId);
      const referred = allUsers.find((user) => user.id === referral.referredUserId);
      const matchesSearch =
        referrer?.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        referred?.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        referrer?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        referred?.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = referralTab === 'guest' ? referral.trigger === 'signup' : referral.trigger === 'booking';
      const matchesFilter = referralFilter === 'all' || referral.status === referralFilter;
      return Boolean(matchesSearch && matchesTab && matchesFilter);
    }),
    (referral) => referral.createdAt,
    sortDirection,
  );
  const counts = {
    all: allReferrals.filter((referral) => (referralTab === 'guest' ? referral.trigger === 'signup' : referral.trigger === 'booking')).length,
    pending: allReferrals.filter((referral) => (referralTab === 'guest' ? referral.trigger === 'signup' : referral.trigger === 'booking') && referral.status === 'pending').length,
    confirmed: allReferrals.filter((referral) => (referralTab === 'guest' ? referral.trigger === 'signup' : referral.trigger === 'booking') && referral.status === 'confirmed').length,
    rewarded: allReferrals.filter((referral) => (referralTab === 'guest' ? referral.trigger === 'signup' : referral.trigger === 'booking') && referral.status === 'rewarded').length,
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Referral Management</h1>
          <p className="text-[#5e6064]">Track and manage user referrals.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search referrals..." className="h-10 rounded-xl pl-10" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex w-fit gap-2 rounded-xl bg-slate-100 p-1">
        <button onClick={() => setReferralTab('guest')} className={cn('rounded-lg px-6 py-2 text-sm font-medium transition-all', referralTab === 'guest' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          Guest Referrals
        </button>
        <button onClick={() => setReferralTab('host')} className={cn('rounded-lg px-6 py-2 text-sm font-medium transition-all', referralTab === 'host' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          Host Referrals
        </button>
      </div>

      <div className="flex items-center gap-3">
        {(['all', 'pending', 'confirmed', 'rewarded'] as const).map((filter) => (
          <button key={filter} onClick={() => setReferralFilter(filter)} className={cn('flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all', referralFilter === filter ? 'bg-[#1a1c23] text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300')}>
            <span className="capitalize">{filter}</span>
            {filter !== 'all' ? <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', referralFilter === filter ? 'bg-white/20' : 'bg-slate-100')}>{counts[filter]}</span> : null}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#f8fafc]">
                <th className="w-12 px-6 py-4"><input type="checkbox" className="rounded border-slate-300" /></th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Referrer</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Referee</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <SortHeader label="Date" direction={sortDirection} onToggle={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')} />
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReferrals.map((referral) => {
                const referrer = allUsers.find((user) => user.id === referral.referrerId);
                const referred = allUsers.find((user) => user.id === referral.referredUserId);
                return (
                  <tr key={referral.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4"><input type="checkbox" className="rounded border-slate-300" /></td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{referrer?.displayName || 'Unknown'}</p>
                      <p className="text-[10px] text-slate-400">{referrer?.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-900">{referred?.displayName || 'Unknown'}</p>
                      <p className="text-[10px] text-slate-400">{referred?.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={referral.status === 'rewarded' ? 'success' : referral.status === 'confirmed' ? 'secondary' : 'warning'} className="text-[10px] font-bold uppercase">
                        {referral.status || 'pending'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4"><p className="text-xs text-slate-500">{new Date(referral.createdAt).toLocaleDateString()}</p></td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="h-8 text-red-500" onClick={() => setConfirmDelete({ type: 'referral', id: referral.id })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredReferrals.length === 0 ? <tr><td colSpan={6} className="px-6 py-20 text-center italic text-slate-400">No referrals found</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4">
          <p className="text-xs text-slate-500">Showing {filteredReferrals.length > 0 ? 1 : 0} to {filteredReferrals.length} of {filteredReferrals.length} referrals</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1 px-3 text-xs" disabled><ChevronLeft className="h-3 w-3" /> Previous</Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 px-3 text-xs" disabled>Next <ChevronRight className="h-3 w-3" /></Button>
          </div>
        </div>
      </Card>

      <Card className="space-y-6 p-8">
        <h2 className="text-xl font-bold text-slate-900">Create Manual Referral</h2>
        <form className="flex items-end gap-4" onSubmit={async (event) => {
          event.preventDefault();
          await handleCreateManualReferral({ referrerEmail: manualReferrerEmail, refereeEmail: manualRefereeEmail, program: referralTab });
          setManualReferrerEmail('');
          setManualRefereeEmail('');
        }}>
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Referrer Email</label>
            <Input placeholder="referrer@example.com" value={manualReferrerEmail} onChange={(event) => setManualReferrerEmail(event.target.value)} required />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Referee Email</label>
            <Input placeholder="referee@example.com" value={manualRefereeEmail} onChange={(event) => setManualRefereeEmail(event.target.value)} required />
          </div>
          <Button type="submit" className="h-10 gap-2 px-6"><Plus className="h-4 w-4" /> Create Referral</Button>
        </form>
        <p className="text-xs italic text-slate-400">Both emails must exist in the system profiles.</p>
      </Card>
    </div>
  );
}

export function RewardsSection({ allUsers }: { allUsers: UserProfile[] }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Reward Tiers</h1>
        <p className="text-[#5e6064]">Configure referral tiers and reward multipliers.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          { tier: 'Bronze', color: 'border-orange-100 bg-orange-50 text-orange-600', icon: '🥉', referrals: '0-5', multiplier: '1.0x' },
          { tier: 'Silver', color: 'border-slate-100 bg-slate-50 text-slate-600', icon: '🥈', referrals: '6-15', multiplier: '1.2x' },
          { tier: 'Gold', color: 'border-yellow-100 bg-yellow-50 text-yellow-600', icon: '🥇', referrals: '16+', multiplier: '1.5x' },
        ].map((item) => (
          <Card key={item.tier} className={cn('space-y-6 border-2 p-8', item.color)}>
            <div className="text-4xl">{item.icon}</div>
            <div>
              <h3 className="text-2xl font-bold">{item.tier} Tier</h3>
              <p className="text-sm opacity-80">Referral Requirement: {item.referrals}</p>
            </div>
            <div className="border-t border-current border-opacity-10 pt-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider">Reward Multiplier</p>
              <p className="text-3xl font-black">{item.multiplier}</p>
            </div>
            <Button variant="outline" className="w-full border-current border-opacity-20 bg-white bg-opacity-50 hover:bg-opacity-100">Edit Rules</Button>
          </Card>
        ))}
      </div>

      <Card className="space-y-6 p-8">
        <h2 className="text-xl font-bold">Tier Distribution</h2>
        <div className="space-y-4">
          {['Bronze', 'Silver', 'Gold'].map((tier) => {
            const count = allUsers.filter((user) => user.tier?.toLowerCase() === tier.toLowerCase()).length;
            const percentage = allUsers.length > 0 ? (count / allUsers.length) * 100 : 0;
            return (
              <div key={tier} className="space-y-2">
                <div className="flex justify-between text-sm font-medium"><span>{tier}</span><span>{count} users ({percentage.toFixed(1)}%)</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={cn('h-full transition-all duration-1000', tier === 'Bronze' && 'bg-orange-500', tier === 'Silver' && 'bg-slate-400', tier === 'Gold' && 'bg-yellow-500')} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export function ReviewsSection({
  allListings,
  allReviews,
  allUsers,
  setConfirmDelete,
}: {
  allListings: Listing[];
  allReviews: Review[];
  allUsers: UserProfile[];
  setConfirmDelete: (value: ConfirmDelete | null) => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Review Management</h1>
        <p className="text-[#5e6064]">Moderate property reviews and guest feedback.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {allReviews.map((review) => {
          const listing = allListings.find((item) => item.id === review.listingId);
          const guest = allUsers.find((item) => item.id === review.guestId);
          const avgRating = (review.cleanliness + review.accuracy + review.communication + review.location + review.value) / 5;
          return (
            <Card key={review.id} className="space-y-4 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <img src={guest?.photoUrl} className="h-10 w-10 rounded-full border border-slate-100" alt="" referrerPolicy="no-referrer" />
                  <div>
                    <p className="text-sm font-bold">{guest?.displayName}</p>
                    <p className="text-[10px] text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-yellow-50 px-2 py-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-bold text-yellow-700">{avgRating.toFixed(1)}</span>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Property</p>
                <p className="truncate text-sm font-medium text-slate-900">{listing?.title || 'Deleted Property'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm italic leading-relaxed text-slate-600">"{review.comment}"</p>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500" onClick={() => setConfirmDelete({ type: 'review', id: review.id })}>Delete Review</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function FinancialsSection({
  allCheckouts,
  allSubscriptions,
  allUsers,
}: {
  allCheckouts: AdminCheckout[];
  allSubscriptions: Subscription[];
  allUsers: UserProfile[];
}) {
  const [subscriptionSortDirection, setSubscriptionSortDirection] = useState<DateSortDirection>('desc');
  const [checkoutSortDirection, setCheckoutSortDirection] = useState<DateSortDirection>('desc');
  const totalRevenue = allSubscriptions.reduce((accumulator, subscription) => accumulator + subscription.amount, 0);
  const paidCheckouts = allCheckouts.filter((checkout) => checkout.status === 'paid');
  const pendingCheckouts = allCheckouts.filter((checkout) => checkout.status === 'pending');
  const sortedSubscriptions = sortByDate(allSubscriptions, (subscription) => subscription.endDate, subscriptionSortDirection);
  const sortedCheckouts = sortByDate(allCheckouts, (checkout) => checkout.createdAt, checkoutSortDirection);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Financial Management</h1>
        <p className="text-[#5e6064]">Track subscription revenue, credit top-ups, and the actual payment flow behind them.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card className="bg-slate-900 p-6 text-white">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Total Revenue</p>
          <h3 className="text-3xl font-bold">R{totalRevenue.toLocaleString()}</h3>
          <p className="mt-2 flex items-center gap-1 text-[10px] text-green-400"><TrendingUp className="h-3 w-3" /> +15% from last month</p>
        </Card>
        <Card className="p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Active Subscriptions</p>
          <h3 className="text-3xl font-bold">{allSubscriptions.filter((subscription) => subscription.status === 'active').length}</h3>
        </Card>
        <Card className="p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Avg. Subscription</p>
          <h3 className="text-3xl font-bold">R{allSubscriptions.length > 0 ? (totalRevenue / allSubscriptions.length).toFixed(2) : '0.00'}</h3>
        </Card>
        <Card className="p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Pending Checkouts</p>
          <h3 className="text-3xl font-bold">{pendingCheckouts.length}</h3>
          <p className="mt-2 text-[10px] text-slate-500">Paid: {paidCheckouts.length}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#f8fafc]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Host</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Plan</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <SortHeader label="Expiry" direction={subscriptionSortDirection} onToggle={() => setSubscriptionSortDirection((current) => current === 'desc' ? 'asc' : 'desc')} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSubscriptions.map((subscription) => {
                const host = allUsers.find((user) => user.id === subscription.userId);
                return (
                  <tr key={subscription.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={host?.photoUrl} className="h-8 w-8 rounded-full" alt="" referrerPolicy="no-referrer" />
                        <p className="text-sm font-bold">{host?.displayName || 'Unknown'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4"><Badge variant="secondary" className="text-[10px] font-bold uppercase">{subscription.plan}</Badge></td>
                    <td className="px-6 py-4"><p className="text-sm font-bold">R{subscription.amount}</p></td>
                    <td className="px-6 py-4"><Badge variant={subscription.status === 'active' ? 'success' : 'neutral'} className="text-[10px] uppercase">{subscription.status}</Badge></td>
                    <td className="px-6 py-4"><p className="text-xs text-slate-500">{new Date(subscription.endDate).toLocaleDateString()}</p></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Yoco Checkout Activity</h2>
            <p className="text-sm text-slate-500">Ops can inspect every platform payment attempt from one place.</p>
          </div>
          <Badge variant="secondary" className="text-[10px] font-bold uppercase">{allCheckouts.length} total</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#f8fafc]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">User</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Commercial Detail</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Provider Ref</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <SortHeader label="Created" direction={checkoutSortDirection} onToggle={() => setCheckoutSortDirection((current) => current === 'desc' ? 'asc' : 'desc')} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedCheckouts.map((checkout) => {
                const user = allUsers.find((candidate) => candidate.id === checkout.userId);
                const detail = checkout.checkoutType === 'subscription' ? `${checkout.hostPlan || 'unknown'} • ${checkout.billingInterval || 'n/a'}` : `${checkout.creditQuantity || 0} credits`;
                return (
                  <tr key={checkout.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900">{user?.displayName || 'Unknown user'}</p>
                        <p className="text-xs text-slate-500">{user?.email || checkout.userId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4"><Badge variant="secondary" className="text-[10px] font-bold uppercase">{checkout.checkoutType === 'subscription' ? 'Subscription' : 'Credits'}</Badge></td>
                    <td className="px-6 py-4"><p className="text-sm text-slate-700">{detail}</p></td>
                    <td className="px-6 py-4"><p className="text-sm font-bold text-slate-900">R{checkout.amount}</p></td>
                    <td className="px-6 py-4">
                      <Badge variant={checkout.status === 'paid' ? 'success' : checkout.status === 'failed' || checkout.status === 'cancelled' ? 'danger' : 'neutral'} className="text-[10px] uppercase">
                        {checkout.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4"><p className="max-w-[180px] truncate text-xs text-slate-500">{checkout.providerPaymentId || checkout.providerCheckoutId || 'Pending provider ref'}</p></td>
                    <td className="px-6 py-4"><p className="text-xs text-slate-500">{new Date(checkout.createdAt).toLocaleString()}</p></td>
                  </tr>
                );
              })}
              {allCheckouts.length === 0 ? <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">No checkouts yet. As soon as a Yoco checkout is created it will show up here.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function NotificationsSection({
  allNotifications,
  handleSendNotification,
  setConfirmDelete,
}: {
  allNotifications: Notification[];
  handleSendNotification: (
    title: string,
    message: string,
    type: Notification['type'],
    target: Notification['target'],
    actionPath?: string | null,
  ) => Promise<void> | void;
  setConfirmDelete: (value: ConfirmDelete | null) => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Platform Notifications</h1>
        <p className="text-[#5e6064]">Send announcements and alerts to platform users.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="h-fit space-y-6 p-6 lg:col-span-1">
          <h2 className="text-lg font-bold">Send New Notification</h2>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void handleSendNotification(
              formData.get('title') as string,
              formData.get('message') as string,
              formData.get('type') as Notification['type'],
              formData.get('target') as Notification['target'],
              (formData.get('actionPath') as string | null) || null,
            );
            event.currentTarget.reset();
          }}>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Title</label>
              <Input name="title" placeholder="Announcement Title" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Message</label>
              <textarea name="message" className="min-h-[100px] w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Type your message here..." required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Type</label>
                <select name="type" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="info">Info</option><option value="warning">Warning</option><option value="success">Success</option><option value="error">Error</option></select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Target</label>
                <select name="target" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="all">All Users</option><option value="hosts">Hosts Only</option><option value="guests">Guests Only</option></select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Open Path</label>
              <Input name="actionPath" placeholder="/host/listings" />
              <p className="text-[11px] text-slate-400">Optional. Clicking the notification will open this route.</p>
            </div>
            <Button type="submit" className="w-full gap-2"><Send className="h-4 w-4" /> Send Notification</Button>
          </form>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-bold">Sent History</h2>
          <div className="space-y-4">
            {[...allNotifications].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).map((notification) => (
              <Card key={notification.id} className="group flex items-start gap-4 p-4">
                <div className={cn('rounded-xl p-2', notification.type === 'info' && 'bg-blue-50 text-blue-600', notification.type === 'warning' && 'bg-yellow-50 text-yellow-600', notification.type === 'success' && 'bg-green-50 text-green-600', notification.type === 'error' && 'bg-red-50 text-red-600')}>
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="truncate text-sm font-bold">{notification.title}</h3>
                    <span className="text-[10px] text-slate-400">{new Date(notification.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{notification.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="neutral" className="text-[9px] uppercase">{notification.target}</Badge>
                    <Badge variant="neutral" className="text-[9px] uppercase">{notification.type}</Badge>
                    {notification.actionPath ? <Badge variant="neutral" className="text-[9px]">{notification.actionPath}</Badge> : null}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-red-500 opacity-0 group-hover:opacity-100" onClick={() => setConfirmDelete({ type: 'notification', id: notification.id })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
            {allNotifications.length === 0 ? <div className="py-20 text-center italic text-slate-400">No notifications sent yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsSection({
  handleUpdateSettings,
  platformSettings,
}: {
  handleUpdateSettings: (settings: Partial<PlatformSettings>) => Promise<void> | void;
  platformSettings: PlatformSettings | null;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Platform Settings</h1>
        <p className="text-[#5e6064]">Configure global parameters and business rules.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card className="space-y-8 p-8">
          <div className="flex items-center gap-3 text-slate-900">
            <TrendingUp className="h-6 w-6" />
            <h2 className="text-xl font-bold">Referral & Rewards</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Platform Name</label>
              <Input defaultValue={platformSettings?.platformName || 'My Platform'} onBlur={(event) => handleUpdateSettings({ platformName: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Support Email</label>
              <Input type="email" defaultValue={platformSettings?.supportEmail || 'support@example.com'} onBlur={(event) => handleUpdateSettings({ supportEmail: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Referral Reward Amount (R)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R</span>
                <Input type="number" className="pl-8" defaultValue={platformSettings?.referralRewardAmount || 50} onBlur={(event) => handleUpdateSettings({ referralRewardAmount: Number(event.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Min. Withdrawal Amount (R)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R</span>
                <Input type="number" className="pl-8" defaultValue={platformSettings?.minWithdrawalAmount || 100} onBlur={(event) => handleUpdateSettings({ minWithdrawalAmount: Number(event.target.value) })} />
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-8 p-8">
          <div className="flex items-center gap-3 text-slate-900">
            <Activity className="h-6 w-6" />
            <h2 className="text-xl font-bold">Platform Rules & Status</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Cancellation Policy (Days before check-in)</label>
              <Input type="number" defaultValue={platformSettings?.cancellationPolicyDays || 7} onBlur={(event) => handleUpdateSettings({ cancellationPolicyDays: Number(event.target.value) })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Max Guests per Listing</label>
              <Input type="number" defaultValue={platformSettings?.maxGuestsPerListing || 10} onBlur={(event) => handleUpdateSettings({ maxGuestsPerListing: Number(event.target.value) })} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-500">Enable Reviews</label>
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300" defaultChecked={platformSettings?.enableReviews ?? true} onChange={(event) => handleUpdateSettings({ enableReviews: event.target.checked })} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-500">Enable Referrals</label>
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300" defaultChecked={platformSettings?.enableReferrals ?? true} onChange={(event) => handleUpdateSettings({ enableReferrals: event.target.checked })} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-500">Maintenance Mode</label>
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300" defaultChecked={platformSettings?.maintenanceMode ?? false} onChange={(event) => handleUpdateSettings({ maintenanceMode: event.target.checked })} />
            </div>
          </div>

          <div className="space-y-6 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold text-slate-900">Business Rules</h2>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Platform Commission (%)</label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                <Input type="number" className="pr-8" defaultValue={platformSettings?.commissionRate || 15} onBlur={(event) => handleUpdateSettings({ commissionRate: Number(event.target.value) })} />
              </div>
              <p className="text-[10px] italic text-slate-400">Percentage taken from each booking transaction.</p>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-blue-600" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-blue-900">Last Updated</p>
                  <p className="text-[10px] text-blue-700">{platformSettings?.updatedAt ? new Date(platformSettings.updatedAt).toLocaleString() : 'Never'}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function KycSection({
  allUsers,
  handleApproveKYC,
  handleReviewKYC,
  kycSubmissions,
  openRejectKycDialog,
}: {
  allUsers: UserProfile[];
  handleApproveKYC: (userId: string) => Promise<void> | void;
  handleReviewKYC: (submission: KycSubmission) => Promise<void> | void;
  kycSubmissions: KycSubmission[];
  openRejectKycDialog: (submission: KycSubmission) => void;
}) {
  const [kycFilter, setKycFilter] = useState<KycFilter>('pending');
  const [sortDirection, setSortDirection] = useState<DateSortDirection>('desc');
  const filteredKycSubmissions = sortByDate(
    kycFilter === 'all' ? kycSubmissions : kycSubmissions.filter((submission) => submission.status === kycFilter),
    (submission) => submission.submittedAt,
    sortDirection,
  );
  const kycCounts = {
    all: kycSubmissions.length,
    pending: kycSubmissions.filter((submission) => submission.status === 'pending').length,
    verified: kycSubmissions.filter((submission) => submission.status === 'verified').length,
    rejected: kycSubmissions.filter((submission) => submission.status === 'rejected').length,
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">KYC Verification</h1>
          <p className="text-[#5e6064]">Review and approve host identity verifications.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {(['all', 'pending', 'verified', 'rejected'] as const).map((filter) => (
          <button key={filter} onClick={() => setKycFilter(filter)} className={cn('flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all', kycFilter === filter ? 'bg-[#1a1c23] text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300')}>
            <span className="capitalize">{filter}</span>
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', kycFilter === filter ? 'bg-white/20' : 'bg-slate-100')}>{kycCounts[filter]}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#f8fafc]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">User</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">ID Type</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">ID Number</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <SortHeader label="Submitted" direction={sortDirection} onToggle={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')} />
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKycSubmissions.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">No {kycFilter === 'all' ? '' : `${kycFilter} `}verification requests.</td></tr>
              ) : filteredKycSubmissions.map((submission) => {
                const user = allUsers.find((candidate) => candidate.id === submission.userId);
                return (
                  <tr key={submission.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={user?.photoUrl || 'https://placehold.co/80x80?text=User'} className="h-10 w-10 rounded-full border border-slate-100 object-cover" alt="" referrerPolicy="no-referrer" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{user?.displayName || submission.userId}</p>
                          <p className="text-xs text-slate-500">{user?.email || 'Unknown user'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><Badge variant="neutral" className="capitalize">{submission.idType.replace('_', ' ')}</Badge></td>
                    <td className="px-6 py-4"><p className="text-sm font-medium">{submission.idNumber}</p></td>
                    <td className="px-6 py-4"><Badge variant={submission.status === 'verified' ? 'success' : submission.status === 'rejected' ? 'danger' : 'warning'} className="text-[10px] uppercase">{submission.status}</Badge></td>
                    <td className="px-6 py-4"><p className="text-xs text-slate-500">{new Date(submission.submittedAt).toLocaleString()}</p></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="flex h-8 items-center gap-1 text-xs" onClick={() => handleReviewKYC(submission)}><Eye className="h-3 w-3" /> Review</Button>
                        <Button variant="default" size="sm" className="h-8 bg-green-600 text-xs hover:bg-green-700" onClick={() => handleApproveKYC(submission.userId)} disabled={submission.status !== 'pending'}>Approve</Button>
                        <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => openRejectKycDialog(submission)} disabled={submission.status !== 'pending'}>Reject</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
