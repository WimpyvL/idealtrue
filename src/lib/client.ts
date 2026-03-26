import { handleFirestoreError } from './firestore';
import { OperationType } from '@/types';
import { encoreRequest } from './encore-client';

function mapBackendListingToLegacyListing(listing: any) {
  return {
    id: listing.id,
    hostUid: listing.hostId,
    title: listing.title,
    description: listing.description,
    location: listing.location,
    area: listing.area || '',
    province: listing.province || '',
    type: listing.type,
    pricePerNight: listing.pricePerNight,
    discount: listing.discountPercent,
    images: listing.images || [],
    video_url: listing.videoUrl || null,
    amenities: listing.amenities || [],
    facilities: listing.facilities || [],
    other_facility: '',
    adults: listing.adults,
    children: listing.children,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    is_self_catering: listing.isSelfCatering,
    has_restaurant: listing.hasRestaurant,
    restaurant_offers: listing.restaurantOffers || [],
    is_occupied: listing.isOccupied,
    rating: 0,
    reviews: 0,
    category: listing.category,
    status: listing.status,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    coordinates: listing.latitude != null && listing.longitude != null
      ? { lat: listing.latitude, lng: listing.longitude }
      : null,
  };
}

export const getClient = {
  hospitality: {
    async getListing(id: string) {
      const path = `listings/${id}`;
      try {
        const response = await encoreRequest<{ listing: any }>(`/listings/${id}`);
        return { listing: mapBackendListingToLegacyListing(response.listing) };
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
        return { listing: null };
      }
    },
    async saveListing(data: any) {
      const { id, ...payload } = data;
      const listingData = {
        id,
        title: payload.title,
        description: payload.description,
        location: payload.location,
        area: payload.area || null,
        province: payload.province || null,
        category: payload.category || payload.type,
        type: payload.type,
        pricePerNight: Number(payload.pricePerNight),
        discountPercent: Number(payload.discount || 0),
        adults: Number(payload.adults || 1),
        children: Number(payload.children || 0),
        bedrooms: Number(payload.bedrooms || 1),
        bathrooms: Number(payload.bathrooms || 1),
        amenities: payload.amenities || [],
        facilities: payload.facilities || [],
        restaurantOffers: payload.restaurant_offers || [],
        images: payload.images || [],
        videoUrl: payload.video_url || null,
        isSelfCatering: Boolean(payload.is_self_catering),
        hasRestaurant: Boolean(payload.has_restaurant),
        isOccupied: Boolean(payload.is_occupied),
        latitude: payload.coordinates?.lat ?? null,
        longitude: payload.coordinates?.lng ?? null,
        status: payload.status || 'pending',
      };

      try {
        const response = await encoreRequest<{ listing: { id: string } }>(
          '/host/listings',
          {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(listingData),
          },
          { auth: true },
        );
        return { id: response.listing.id };
      } catch (error) {
        handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, 'listings');
        throw error;
      }
    }
  }
};
