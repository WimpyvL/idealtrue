import React from 'react';
import { Booking, Listing } from '../types';
import { Card } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Users, Calendar, DollarSign } from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { formatRand } from '@/lib/currency';

export default function HostReports({ bookings, listings }: { bookings: Booking[], listings: Listing[] }) {
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const totalGuests = confirmedBookings.length; // Simplified, assuming 1 guest per booking for now
  
  // Last 30 days revenue
  const thirtyDaysAgo = subDays(new Date(), 30);
  const recentBookings = confirmedBookings.filter(b => isAfter(new Date(b.createdAt), thirtyDaysAgo));
  const recentRevenue = recentBookings.reduce((sum, b) => sum + b.totalPrice, 0);

  // Generate chart data (mocked for the last 7 days based on actual data if available)
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayBookings = confirmedBookings.filter(b => format(new Date(b.createdAt), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
    const revenue = dayBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    return {
      name: format(date, 'EEE'),
      revenue,
      bookings: dayBookings.length
    };
  });

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-on-surface-variant">Track your earnings, occupancy, and overall performance.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-primary">
          <div className="p-3 bg-primary/10 rounded-full text-primary">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Total Revenue</p>
            <p className="text-2xl font-bold">{formatRand(totalRevenue)}</p>
          </div>
        </Card>
        
        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-green-500">
          <div className="p-3 bg-green-500/10 rounded-full text-green-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface-variant">30-Day Revenue</p>
            <p className="text-2xl font-bold">{formatRand(recentRevenue)}</p>
          </div>
        </Card>

        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-blue-500">
          <div className="p-3 bg-blue-500/10 rounded-full text-blue-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Total Bookings</p>
            <p className="text-2xl font-bold">{confirmedBookings.length}</p>
          </div>
        </Card>

        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-purple-500">
          <div className="p-3 bg-purple-500/10 rounded-full text-purple-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Active Listings</p>
            <p className="text-2xl font-bold">{listings.filter(l => l.status === 'active').length}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-6">Revenue (Last 7 Days)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} tickFormatter={(value) => `R${value}`} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatRand(value), 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-bold mb-6">Bookings (Last 7 Days)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} allowDecimals={false} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f3f4f6' }}
                />
                <Bar dataKey="bookings" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
