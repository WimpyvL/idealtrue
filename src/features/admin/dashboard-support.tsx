import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SaveListingInput } from '@/lib/platform-client';
import type { Listing } from '@/types';

export function toListingPayload(
  listing: Listing,
  status = listing.status,
  rejectionReason: string | null = status === 'rejected' ? listing.rejectionReason ?? null : null,
): SaveListingInput {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    location: listing.location,
    area: listing.area,
    province: listing.province,
    category: listing.category,
    type: listing.type,
    pricePerNight: listing.pricePerNight,
    discount: listing.discount,
    breakageDeposit: listing.breakageDeposit ?? null,
    amenities: listing.amenities,
    facilities: listing.facilities,
    otherFacility: listing.otherFacility,
    restaurantOffers: listing.restaurantOffers,
    images: listing.images,
    videoUrl: listing.videoUrl,
    adults: listing.adults,
    children: listing.children,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    isSelfCatering: listing.isSelfCatering,
    hasRestaurant: listing.hasRestaurant,
    isOccupied: listing.isOccupied,
    coordinates: listing.coordinates || null,
    blockedDates: listing.blockedDates || [],
    status,
    rejectionReason,
  };
}

export function sortByDate<T>(
  items: T[],
  getDateValue: (item: T) => string | null | undefined,
  direction: 'asc' | 'desc',
) {
  return [...items].sort((left, right) => {
    const leftTime = getDateValue(left) ? new Date(getDateValue(left) as string).getTime() : 0;
    const rightTime = getDateValue(right) ? new Date(getDateValue(right) as string).getTime() : 0;
    return direction === 'desc' ? rightTime - leftTime : leftTime - rightTime;
  });
}

export function formatUptime(uptimeSeconds: number) {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function StatCard({
  title,
  value,
  trend,
  isUp,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  title: string;
  value: number;
  trend?: string;
  isUp?: boolean;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card className="p-6 space-y-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900">{value.toLocaleString()}</h3>
        </div>
        <div className={cn('p-2.5 rounded-xl', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>
      {trend ? (
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md',
              isUp ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50',
            )}
          >
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend}
          </div>
          <span className="text-[10px] text-slate-400">vs last month</span>
        </div>
      ) : null}
    </Card>
  );
}

export function HealthMetric({
  label,
  value,
  max = 100,
  color,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
        <span className="text-slate-400">{label}</span>
        <span className="text-white">
          {value}
          {max === 100 ? '%' : 'ms'}
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-1000', color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
