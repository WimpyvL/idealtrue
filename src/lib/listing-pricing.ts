import type { Listing } from "@/types";

// (|/) Klaasvaakie: listing discounts must affect the actual marketplace price, not only badges.
export function computeDiscountedNightlyRate(pricePerNight: number, discountPercent: number) {
  const nightlyRate = Math.max(0, Number(pricePerNight) || 0);
  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0));

  if (discount <= 0) {
    return Math.round(nightlyRate);
  }

  return Math.max(0, Math.round(nightlyRate * (1 - discount / 100)));
}

export function getListingNightlyRate(listing: Pick<Listing, "pricePerNight" | "discount">) {
  return computeDiscountedNightlyRate(listing.pricePerNight, listing.discount);
}

export function getListingOriginalNightlyRate(listing: Pick<Listing, "pricePerNight" | "discount">) {
  return listing.discount > 0 ? Math.max(0, Number(listing.pricePerNight) || 0) : null;
}
