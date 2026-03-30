import React, { useState, useEffect } from 'react';
import { Listing } from '../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Building2, Plus, Edit, Trash2, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConfirmationDialog } from '../components/ui/confirmation-dialog';
import { getClient } from '../lib/client';
import { formatRand } from '@/lib/currency';

type Props = {
  listings: Listing[];
  onListingUpdated?: (listing: Listing) => void;
  onListingRemoved?: (listingId: string) => void;
};

function toSaveListingPayload(listing: Listing, status: Listing['status']) {
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
    amenities: listing.amenities,
    facilities: listing.facilities,
    restaurant_offers: listing.restaurant_offers,
    images: listing.images,
    video_url: listing.video_url,
    adults: listing.adults,
    children: listing.children,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    is_self_catering: listing.is_self_catering,
    has_restaurant: listing.has_restaurant,
    is_occupied: listing.is_occupied,
    coordinates: listing.coordinates || null,
    status,
  };
}

export default function HostListings({ listings, onListingUpdated, onListingRemoved }: Props) {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [listingToDelete, setListingToDelete] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const toggleStatus = async (listing: Listing) => {
    const newStatus = listing.status === 'active' ? 'inactive' : 'active';
    setIsUpdating(listing.id);
    try {
      await getClient.hospitality.saveListing(toSaveListingPayload(listing, newStatus));
      onListingUpdated?.({ ...listing, status: newStatus });
    } catch (error) {
      console.error('Failed to update listing status', error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!listingToDelete) return;
    
    setIsDeleting(listingToDelete);
    try {
      const listing = listings.find((item) => item.id === listingToDelete);
      if (!listing) return;
      await getClient.hospitality.saveListing(toSaveListingPayload(listing, 'archived'));
      onListingRemoved?.(listingToDelete);
      setListingToDelete(null);
    } catch (error) {
      console.error('Failed to archive listing', error);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Listings Management</h1>
          <p className="text-on-surface-variant">Manage your properties, update details, and control availability.</p>
        </header>
        <Button onClick={() => navigate('/host/create-listing')}>
          <Plus className="w-4 h-4 mr-2" /> Add New Listing
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {listings.map(listing => (
          <Card key={listing.id} className="p-4 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <img 
              src={listing.images[0] || `https://picsum.photos/seed/${listing.id}/300/200`} 
              className="w-full sm:w-48 h-32 rounded-xl object-cover shrink-0" 
              alt={listing.title} 
            />
            <div className="flex-1 min-w-0 space-y-2 w-full">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg truncate">{listing.title}</h3>
                  <p className="text-sm text-on-surface-variant mb-1">{listing.location}</p>
                  <p className="font-medium text-primary">{formatRand(listing.pricePerNight)} <span className="text-sm text-on-surface-variant font-normal">/ night</span></p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <Badge variant={listing.status === 'active' ? 'success' : listing.status === 'pending' ? 'warning' : 'secondary'}>
                    {listing.status}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant font-medium">
                      {listing.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                    <Switch 
                      checked={listing.status === 'active'} 
                      onCheckedChange={() => toggleStatus(listing)}
                      disabled={isUpdating === listing.id || isDeleting === listing.id}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => navigate(`/host/edit-listing/${listing.id}`)}>
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/host/social?listingId=${listing.id}`)}>
                  <Share2 className="w-4 h-4 mr-2" /> Social Post
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setListingToDelete(listing.id)}
                  disabled={isDeleting === listing.id || isUpdating === listing.id}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> {isDeleting === listing.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {listings.length === 0 && (
          <div className="text-center py-12 bg-surface-container-lowest rounded-xl border border-outline-variant border-dashed">
            <Building2 className="w-12 h-12 mx-auto text-outline-variant mb-4" />
            <h3 className="text-lg font-bold mb-2">No listings yet</h3>
            <p className="text-on-surface-variant mb-4">Create your first listing to start hosting guests.</p>
            <Button onClick={() => navigate('/host/create-listing')}>
              <Plus className="w-4 h-4 mr-2" /> Create Listing
            </Button>
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={!!listingToDelete}
        onClose={() => setListingToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Listing"
        description="Are you sure you want to delete this listing? This action cannot be undone and all associated data will be removed."
        confirmText="Delete Listing"
        isLoading={!!isDeleting}
      />
    </div>
  );
}
