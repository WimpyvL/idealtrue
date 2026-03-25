import React, { useState, useEffect } from 'react';
import { Listing } from '../types';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Building2, Plus, Edit, Trash2, Power, PowerOff, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError } from '../lib/firestore';
import { OperationType } from '../types';
import { ConfirmationDialog } from '../components/ui/confirmation-dialog';

export default function HostListings({ listings }: { listings: Listing[] }) {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [listingToDelete, setListingToDelete] = useState<string | null>(null);

  const toggleStatus = async (listing: Listing) => {
    const newStatus = listing.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'listings', listing.id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `listings/${listing.id}`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!listingToDelete) return;
    
    setIsDeleting(listingToDelete);
    try {
      await deleteDoc(doc(db, 'listings', listingToDelete));
      setListingToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `listings/${listingToDelete}`);
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
                  <p className="font-medium text-primary">${listing.pricePerNight} <span className="text-sm text-on-surface-variant font-normal">/ night</span></p>
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
                      onCheckedChange={(checked) => toggleStatus(listing)}
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
                  disabled={isDeleting === listing.id}
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
