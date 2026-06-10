// (|/) Klaasvaakie
export type ListingAdminTagKey =
  | 'payment_setup_review'
  | 'ops_attention'
  | 'special_conditions'
  | 'contact_before_booking'
  | 'verified_host_pick';

export type ListingAdminTagTone = 'info' | 'warning' | 'success';

export interface ListingAdminTagDefinition {
  key: ListingAdminTagKey;
  label: string;
  message: string;
  tone: ListingAdminTagTone;
}

export const LISTING_ADMIN_TAGS: ListingAdminTagDefinition[] = [
  {
    key: 'payment_setup_review',
    label: 'Payment setup review',
    message: 'This listing has a payment setup note the admin team wants guests to see before booking.',
    tone: 'warning',
  },
  {
    key: 'ops_attention',
    label: 'Ops attention',
    message: 'This listing is under active operations review. Expect manual follow-up if needed.',
    tone: 'info',
  },
  {
    key: 'special_conditions',
    label: 'Special conditions',
    message: 'This listing has special conditions that apply before booking is confirmed.',
    tone: 'warning',
  },
  {
    key: 'contact_before_booking',
    label: 'Contact before booking',
    message: 'Please contact the host or admin team before booking this listing.',
    tone: 'warning',
  },
  {
    key: 'verified_host_pick',
    label: 'Verified host pick',
    message: 'This listing has been reviewed and highlighted by the admin team.',
    tone: 'success',
  },
];

const listingAdminTagByKey = new Map(LISTING_ADMIN_TAGS.map((tag) => [tag.key, tag] as const));

export function isListingAdminTagKey(value: unknown): value is ListingAdminTagKey {
  return typeof value === 'string' && listingAdminTagByKey.has(value as ListingAdminTagKey);
}

export function getListingAdminTagDefinition(key: ListingAdminTagKey | null | undefined) {
  if (!key) {
    return null;
  }

  return listingAdminTagByKey.get(key) ?? null;
}
