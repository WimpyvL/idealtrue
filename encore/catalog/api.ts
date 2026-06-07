import { api, APIError } from "encore.dev/api";
import { getAuthData } from "encore.dev/internal/codegen/auth";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { catalogDB } from "./db";
import {
  bookingTimestampToAvailabilityDateKey,
  buildBlockedDatesFromAvailability,
  buildIntervalsFromDateKeys,
  buildManualBlockedDates,
  buildSingleNightInterval,
  enumerateAvailabilityNights,
  findAvailabilityConflict,
  mergeLegacyBlockedDatesWithBookingNights,
  normalizeAvailabilityDateKey,
  toAvailabilityBlockRecord,
  type AvailabilityBlockInput,
} from "./availability";
import { listingMediaBucket } from "./storage";
import { computeHostListingQuota, type HostListingQuota } from "./quota";
import { getMaxImagesForPlan, supportsListingVideo } from "./host-plan";
import { requireRole, type AuthData } from "../shared/auth";
import { billingDB } from "../billing/db";
import { assertHostBillingOperationalAccess } from "../billing/host-billing-service";
import { bookingDB } from "../booking/db";
import { identityDB } from "../identity/db";
import { notifyListingReviewed } from "../ops/notifications";
import { platformEvents } from "../analytics/events";
import { reviewsDB } from "../reviews/db";
import type {
  AvailabilityBlockSource,
  ListingAvailabilityManualBlockInput,
  ListingAvailabilityBlockRecord,
  ListingAvailabilitySummaryRecord,
  ListingRecord,
  ListingSettlementProfileRecord,
  ListingStatus,
} from "../shared/domain";

type ListingRow = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  location: string;
  area: string | null;
  province: string | null;
  category: string;
  type: string;
  price_per_night: number;
  discount_percent: number;
  breakage_deposit: number | null;
  adults: number;
  children: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  facilities: string[];
  restaurant_offers: string[];
  images: string[];
  video_url: string | null;
  is_self_catering: boolean;
  has_restaurant: boolean;
  is_occupied: boolean;
  latitude: number | null;
  longitude: number | null;
  blocked_dates: string[];
  status: ListingStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

type AvailabilityBlockRow = {
  id: string;
  listing_id: string;
  source_type: AvailabilityBlockSource;
  source_id: string;
  starts_on: string;
  ends_on: string;
  nights: string[];
  note: string | null;
  created_at: string;
  updated_at: string;
};

type HostAccessRow = {
  id: string;
  host_plan: "standard" | "professional" | "premium";
  kyc_status: "none" | "pending" | "verified" | "rejected";
};

type SettlementProfileRow = {
  listing_id: string;
  payment_method: string | null;
  payment_instructions: string | null;
  payment_reference_prefix: string | null;
  created_at: string;
  updated_at: string;
};

type SettlementProfileInput = {
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReferencePrefix?: string | null;
};

interface SaveListingParams {
  id?: string;
  hostId?: string;
  title: string;
  description: string;
  location: string;
  area?: string | null;
  province?: string | null;
  category: string;
  type: string;
  pricePerNight: number;
  discountPercent: number;
  breakageDeposit?: number | null;
  adults: number;
  children: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  facilities: string[];
  restaurantOffers: string[];
  images: string[];
  videoUrl?: string | null;
  isSelfCatering: boolean;
  hasRestaurant: boolean;
  isOccupied: boolean;
  latitude?: number | null;
  longitude?: number | null;
  blockedDates?: string[];
  settlementProfile?: SettlementProfileInput | null;
  status: ListingStatus;
  rejectionReason?: string | null;
}

interface ListListingsParams {
  hostId?: string;
  status?: ListingStatus;
}

interface UploadUrlParams {
  listingId?: string;
  filename: string;
  contentType: string;
}

interface UploadListingImageParams {
  listingId?: string;
  filename: string;
  contentType: string;
  dataBase64: string;
}

const ALLOWED_LISTING_MEDIA_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const ALLOWED_LISTING_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_LISTING_VIDEO_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

async function getHostAccess(hostId: string) {
  const host = await identityDB.queryRow<HostAccessRow>`
    SELECT id, host_plan, kyc_status
    FROM users
    WHERE id = ${hostId}
  `;

  if (!host) {
    throw APIError.notFound("Host profile not found.");
  }

  return host;
}

async function getHostListingQuota(hostId: string): Promise<HostListingQuota> {
  const host = await getHostAccess(hostId);
  const existingListings = await catalogDB.queryRow<{ count: number }>`
    SELECT COUNT(*)::int AS count
    FROM listings
    WHERE host_id = ${hostId}
      AND status <> ${"archived"}
      AND status <> ${"draft"}
  `;

  return computeHostListingQuota(host.host_plan, existingListings?.count ?? 0);
}

function assertListingImageCount(images: string[], plan: HostAccessRow["host_plan"]) {
  const maxImages = getMaxImagesForPlan(plan);
  if (images.length > maxImages) {
    throw APIError.invalidArgument(`Your ${plan} plan allows up to ${maxImages} images per listing.`);
  }
}

function assertListingVideoAccess(videoUrl: string | null | undefined, plan: HostAccessRow["host_plan"]) {
  if (videoUrl && !supportsListingVideo(plan)) {
    throw APIError.invalidArgument("Standard hosts cannot add a showcase video.");
  }
}

function sanitizeObjectFilename(filename: string) {
  const trimmed = filename.trim();
  const normalized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.slice(0, 120) || "upload.bin";
}

function decodeBase64Payload(dataBase64: string) {
  const normalized = dataBase64.trim().replace(/^data:[^;]+;base64,/, "");
  let buffer: Buffer;

  try {
    buffer = Buffer.from(normalized, "base64");
  } catch {
    throw APIError.invalidArgument("Invalid image upload payload.");
  }

  if (!buffer.length) {
    throw APIError.invalidArgument("Image upload payload cannot be empty.");
  }

  return buffer;
}

function normalizeDraftListingId(listingId?: string | null) {
  if (!listingId) {
    return undefined;
  }

  const normalized = listingId.trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return undefined;
  }

  return normalized;
}

async function readRawBuffer(req: IncomingMessage, maxBytes: number) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw APIError.invalidArgument("Upload is too large.");
    }
    chunks.push(buffer);
  }

  const payload = Buffer.concat(chunks);
  if (!payload.length) {
    throw APIError.invalidArgument("Upload payload cannot be empty.");
  }

  return payload;
}

async function assertCanUploadMedia(auth: AuthData, listingId?: string) {
  if (auth.role === "host") {
    await assertHostBillingOperationalAccess(auth.userID, "listings");
  }

  const normalizedListingId = normalizeDraftListingId(listingId);
  if (!normalizedListingId) {
    return;
  }

  const listing = await catalogDB.queryRow<ListingRow>`
    SELECT * FROM listings WHERE id = ${normalizedListingId}
  `;
  if (!listing) throw APIError.notFound("Listing not found.");
  if (listing.host_id !== auth.userID && auth.role !== "admin" && auth.role !== "support") {
    throw APIError.permissionDenied("You cannot upload media for another host's listing.");
  }
}

function buildListingMediaObjectKey(params: {
  auth: AuthData;
  listingId?: string;
  filename: string;
}) {
  const normalizedListingId = normalizeDraftListingId(params.listingId);
  const safeFilename = sanitizeObjectFilename(params.filename);
  return normalizedListingId
    ? `${normalizedListingId}/${Date.now()}-${safeFilename}`
    : `drafts/${params.auth.userID}/${Date.now()}-${safeFilename}`;
}

function canReadUnpublishedListing(auth: AuthData | null, listingHostId: string) {
  if (!auth) return false;
  if (auth.role === "admin" || auth.role === "support") return true;
  if (auth.role === "host" && auth.userID === listingHostId) return true;
  return false;
}

function canReadListingSettlementProfile(auth: AuthData | null, listingHostId: string) {
  return canReadUnpublishedListing(auth, listingHostId);
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeSettlementProfileInput(input: SettlementProfileInput | null | undefined) {
  if (input === undefined) {
    return undefined;
  }

  const paymentMethod = normalizeOptionalText(input?.paymentMethod);
  const paymentInstructions = normalizeOptionalText(input?.paymentInstructions);
  const paymentReferencePrefix = normalizeOptionalText(input?.paymentReferencePrefix);

  return {
    paymentMethod: paymentMethod ?? null,
    paymentInstructions: paymentInstructions ?? null,
    paymentReferencePrefix: paymentReferencePrefix ?? null,
  };
}

function mapSettlementProfile(row: SettlementProfileRow): ListingSettlementProfileRecord {
  return {
    listingId: row.listing_id,
    paymentMethod: row.payment_method,
    paymentInstructions: row.payment_instructions,
    paymentReferencePrefix: row.payment_reference_prefix,
    updatedAt: row.updated_at,
  };
}

function isSettlementProfileSchemaError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("listing_settlement_profiles");
}

async function getListingSettlementProfile(listingId: string): Promise<ListingSettlementProfileRecord | null> {
  try {
    const row = await catalogDB.queryRow<SettlementProfileRow>`
      SELECT listing_id, payment_method, payment_instructions, payment_reference_prefix, created_at, updated_at
      FROM listing_settlement_profiles
      WHERE listing_id = ${listingId}
    `;

    return row ? mapSettlementProfile(row) : null;
  } catch (error) {
    if (isSettlementProfileSchemaError(error)) {
      return null;
    }
    throw error;
  }
}

async function upsertListingSettlementProfile(
  listingId: string,
  settlementProfile: SettlementProfileInput | null | undefined,
  now: string,
) {
  const normalized = normalizeSettlementProfileInput(settlementProfile);
  if (normalized === undefined) {
    return;
  }

  const hasAnyValue =
    normalized.paymentMethod !== null
    || normalized.paymentInstructions !== null
    || normalized.paymentReferencePrefix !== null;

  try {
    if (!hasAnyValue) {
      await catalogDB.exec`
        DELETE FROM listing_settlement_profiles
        WHERE listing_id = ${listingId}
      `;
      return;
    }

    await catalogDB.exec`
      INSERT INTO listing_settlement_profiles (
        listing_id, payment_method, payment_instructions, payment_reference_prefix, created_at, updated_at
      )
      VALUES (
        ${listingId},
        ${normalized.paymentMethod},
        ${normalized.paymentInstructions},
        ${normalized.paymentReferencePrefix},
        ${now},
        ${now}
      )
      ON CONFLICT (listing_id) DO UPDATE
      SET payment_method = EXCLUDED.payment_method,
          payment_instructions = EXCLUDED.payment_instructions,
          payment_reference_prefix = EXCLUDED.payment_reference_prefix,
          updated_at = EXCLUDED.updated_at
    `;
  } catch (error) {
    if (isSettlementProfileSchemaError(error)) {
      console.warn(`Listing settlement profile schema missing for ${listingId}; skipping settlement save.`, error);
      return;
    }
    throw error;
  }
}

async function isHostGreylisted(hostId: string) {
  try {
    const row = await billingDB.queryRow<{ billing_status: string }>`
      SELECT billing_status
      FROM host_billing_accounts
      WHERE user_id = ${hostId}
    `;
    return row?.billing_status === "greylisted";
  } catch (error) {
    console.warn(`Failed to read host billing status for ${hostId}; allowing listing visibility fallback.`, error);
    return false;
  }
}

async function filterPubliclyVisibleListings(rows: ListingRow[]) {
  const hostIds = Array.from(new Set(rows.map((row) => row.host_id).filter(Boolean)));
  if (hostIds.length === 0) {
    return rows;
  }

  try {
    const greylistedRows = await billingDB.rawQueryAll<{ user_id: string }>(
      `
        SELECT user_id
        FROM host_billing_accounts
        WHERE billing_status = 'greylisted'
          AND user_id = ANY($1::text[])
      `,
      hostIds,
    );
    const greylistedHosts = new Set(greylistedRows.map((row) => row.user_id));
    return rows.filter((row) => !greylistedHosts.has(row.host_id));
  } catch (error) {
    console.warn("Failed to filter public listings against host billing status; returning unfiltered listings.", error);
    return rows;
  }
}

function getListingMediaObjectKey(publicUrl: string) {
  const trimmed = `${publicUrl || ""}`.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const directPrefix = listingMediaBucket.publicUrl("");
    if (directPrefix && trimmed.startsWith(directPrefix)) {
      return decodeURIComponent(trimmed.slice(directPrefix.length)).replace(/^\/+/, "") || null;
    }

    const parsed = new URL(trimmed);
    const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
    if (!path) {
      return null;
    }

    const bucketPrefix = "listing-media-public/";
    if (path.startsWith(bucketPrefix)) {
      return path.slice(bucketPrefix.length) || null;
    }

    return path;
  } catch {
    return null;
  }
}

async function removeListingMediaAssets(listing: ListingRow) {
  const objectKeys = new Set<string>();

  for (const imageUrl of listing.images ?? []) {
    const objectKey = getListingMediaObjectKey(imageUrl);
    if (objectKey) {
      objectKeys.add(objectKey);
    }
  }

  if (listing.video_url) {
    const videoKey = getListingMediaObjectKey(listing.video_url);
    if (videoKey) {
      objectKeys.add(videoKey);
    }
  }

  await Promise.all(
    [...objectKeys].map(async (objectKey) => {
      try {
        await listingMediaBucket.remove(objectKey);
      } catch (error) {
        console.warn(`Failed to remove listing media object ${objectKey}:`, error);
      }
    }),
  );
}

interface UpdateAvailabilityParams {
  listingId: string;
  blockedDates: string[];
}

interface UpdateAvailabilityBlocksParams {
  listingId: string;
  manualBlocks: ListingAvailabilityManualBlockInput[];
}

interface BookingAvailabilitySnapshotItem {
  bookingId: string;
  checkIn: Date | string;
  checkOut: Date | string;
  sourceType: Extract<AvailabilityBlockSource, "APPROVED_HOLD" | "BOOKED">;
}

type BookingAvailabilityRow = {
  id: string;
  check_in: Date | string;
  check_out: Date | string;
  inquiry_state: "APPROVED" | "BOOKED";
  payment_state: "INITIATED" | "COMPLETED";
};

function toAvailabilityBlockInput(row: AvailabilityBlockRow): AvailabilityBlockInput {
  return {
    id: row.id,
    listingId: row.listing_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    startsOn: normalizeAvailabilityDateKey(row.starts_on),
    endsOn: normalizeAvailabilityDateKey(row.ends_on),
    nights: (row.nights ?? []).map(normalizeAvailabilityDateKey),
    note: row.note ?? null,
    bookingId: row.source_type === "MANUAL" ? null : row.source_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listAvailabilityBlockInputs(listingId: string) {
  try {
    const rows = await catalogDB.queryAll<AvailabilityBlockRow>`
      SELECT id, listing_id, source_type, source_id, starts_on::text, ends_on::text, nights, note, created_at, updated_at
      FROM listing_availability_blocks
      WHERE listing_id = ${listingId}
      ORDER BY starts_on ASC, source_type ASC, created_at ASC
    `;

    return rows.map(toAvailabilityBlockInput);
  } catch (error) {
    console.warn(`Failed to read availability blocks for listing ${listingId}; falling back to legacy availability.`, error);
    return [];
  }
}

async function insertManualAvailabilityDates(listingId: string, dates: string[]) {
  const normalizedDates = Array.from(new Set((dates ?? []).map(normalizeAvailabilityDateKey))).sort();

  for (const dateKey of normalizedDates) {
    const interval = buildSingleNightInterval(dateKey);
    const now = new Date().toISOString();
    await catalogDB.exec`
      INSERT INTO listing_availability_blocks (
        id, listing_id, source_type, source_id, starts_on, ends_on, nights, note, created_at, updated_at
      )
      VALUES (
        ${randomUUID()},
        ${listingId},
        ${"MANUAL"},
        ${dateKey},
        ${interval.startsOn},
        ${interval.endsOn},
        ${interval.nights},
        ${null},
        ${now},
        ${now}
      )
    `;
  }
}

async function insertManualAvailabilityBlocks(listingId: string, manualBlocks: ListingAvailabilityManualBlockInput[]) {
  for (const manualBlock of manualBlocks) {
    const startsOn = normalizeAvailabilityDateKey(manualBlock.startsOn);
    const endsOn = normalizeAvailabilityDateKey(manualBlock.endsOn);
    const nights = enumerateAvailabilityNights(startsOn, endsOn);
    const now = new Date().toISOString();
    const sourceId = nights.length === 1 ? nights[0]! : `${startsOn}:${endsOn}`;

    await catalogDB.exec`
      INSERT INTO listing_availability_blocks (
        id, listing_id, source_type, source_id, starts_on, ends_on, nights, note, created_at, updated_at
      )
      VALUES (
        ${randomUUID()},
        ${listingId},
        ${"MANUAL"},
        ${sourceId},
        ${startsOn},
        ${endsOn},
        ${nights},
        ${manualBlock.note?.trim() || null},
        ${now},
        ${now}
      )
    `;
  }
}

async function ensureListingAvailabilityHydrated(row: ListingRow) {
  try {
    const existingBlocks = await listAvailabilityBlockInputs(row.id);

    const bookingRows = await bookingDB.rawQueryAll<BookingAvailabilityRow>(
      `
        SELECT id, check_in, check_out, inquiry_state, payment_state
        FROM bookings
        WHERE listing_id = $1
          AND (
            (inquiry_state = 'BOOKED' AND payment_state = 'COMPLETED')
            OR (inquiry_state = 'APPROVED' AND payment_state = 'INITIATED')
          )
      `,
      row.id,
    );

    if (bookingRows.length === 0) {
      if (existingBlocks.length > 0) {
        return existingBlocks;
      }
      if ((row.blocked_dates ?? []).length === 0) {
        return [];
      }
    }

    const bookingEntries: BookingAvailabilitySnapshotItem[] = bookingRows.map((booking) => ({
      bookingId: booking.id,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      sourceType: booking.inquiry_state === "BOOKED" ? "BOOKED" : "APPROVED_HOLD",
    }));

    const bookingNights = new Set(
      bookingEntries.flatMap((entry) =>
        enumerateAvailabilityNights(
          bookingTimestampToAvailabilityDateKey(entry.checkIn),
          bookingTimestampToAvailabilityDateKey(entry.checkOut),
        ),
      ),
    );
    const manualLegacyDates = (row.blocked_dates ?? [])
      .map(normalizeAvailabilityDateKey)
      .filter((dateKey) => !bookingNights.has(dateKey));

    if (manualLegacyDates.length > 0) {
      await insertManualAvailabilityDates(row.id, manualLegacyDates);
    }

    if (bookingEntries.length > 0) {
      // (|/) Klaasvaakie - marketplace reads must refresh booking-owned blocks even when manual blocks already exist.
      await replaceBookingAvailabilityBlocks(row.id, bookingEntries);
    }

    const refreshed = await refreshListingBlockedDatesFromAvailability(row.id);
    return refreshed.availabilityBlocks.map((block) => ({
      id: block.id,
      listingId: block.listingId,
      sourceType: block.sourceType,
      sourceId: block.sourceId,
      startsOn: block.startsOn,
      endsOn: block.endsOn,
      nights: block.nights,
      bookingId: block.bookingId,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    }));
  } catch (error) {
    console.warn(`Failed to hydrate availability blocks for listing ${row.id}; falling back to legacy listing payload.`, error);
    return [];
  }
}

async function listAvailabilityBlocksForListings(listingIds: string[]) {
  const uniqueListingIds = Array.from(new Set(listingIds.filter(Boolean)));
  const availabilityByListing = new Map<string, ListingAvailabilityBlockRecord[]>();

  await Promise.all(
    uniqueListingIds.map(async (listingId) => {
      const listingRow = await catalogDB.queryRow<ListingRow>`
        SELECT * FROM listings WHERE id = ${listingId}
      `;
      if (!listingRow) {
        availabilityByListing.set(listingId, []);
        return;
      }

      const blocks = await ensureListingAvailabilityHydrated(listingRow);
      availabilityByListing.set(
        listingId,
        blocks.map((block) => toAvailabilityBlockRecord(block)),
      );
    }),
  );

  return availabilityByListing;
}

async function refreshListingBlockedDatesFromAvailability(listingId: string) {
  const blocks = await listAvailabilityBlockInputs(listingId);
  const blockedDates = buildBlockedDatesFromAvailability(blocks);
  const now = new Date().toISOString();

  await catalogDB.exec`
    UPDATE listings
    SET blocked_dates = ${blockedDates},
        updated_at = ${now}
    WHERE id = ${listingId}
  `;

  return {
    blockedDates,
    updatedAt: now,
    availabilityBlocks: blocks.map((block) => toAvailabilityBlockRecord(block)),
    manualBlockedDates: buildManualBlockedDates(blocks),
  };
}

function isAvailabilityLedgerSchemaError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("listing_availability_blocks")
    && (
      message.includes("does not exist")
      || message.includes("doesn't exist")
      || message.includes("unknown column")
      || message.includes("column")
      || message.includes("relation")
    )
  );
}

function buildAvailabilitySummaryRecord(
  listingId: string,
  availabilityBlocks: ListingAvailabilityBlockRecord[],
): ListingAvailabilitySummaryRecord {
  const manualBlocks = availabilityBlocks.filter((block) => block.sourceType === "MANUAL");
  const lockedDates = availabilityBlocks
    .filter((block) => block.sourceType !== "MANUAL")
    .flatMap((block) => block.nights)
    .map(normalizeAvailabilityDateKey);
  const today = new Date().toISOString().slice(0, 10);

  return {
    listingId,
    manualBlockCount: manualBlocks.length,
    manualBlockedDates: buildManualBlockedDates(availabilityBlocks),
    lockedDates: Array.from(new Set(lockedDates)).sort(),
    upcomingBlocks: availabilityBlocks
      .filter((block) => normalizeAvailabilityDateKey(block.endsOn) >= today)
      .sort((left, right) => left.startsOn.localeCompare(right.startsOn))
      .slice(0, 12),
  };
}

async function getListingWithAvailability(
  row: ListingRow,
  options?: { includeSettlementProfile?: boolean },
): Promise<ListingRecord> {
  try {
    const availabilityBlocks = await ensureListingAvailabilityHydrated(row);
    const settlementProfile = options?.includeSettlementProfile ? await getListingSettlementProfile(row.id) : null;
    return mapListing(
      row,
      availabilityBlocks.map((block) => toAvailabilityBlockRecord(block)),
      settlementProfile,
    );
  } catch (error) {
    console.error(`Failed to hydrate availability for listing ${row.id}. Returning listing without availability blocks.`, error);
    const settlementProfile = options?.includeSettlementProfile ? await getListingSettlementProfile(row.id) : null;
    return mapListing(row, [], settlementProfile);
  }
}

function mapListing(
  row: ListingRow,
  availabilityBlocks?: ListingAvailabilityBlockRecord[],
  settlementProfile?: ListingSettlementProfileRecord | null,
): ListingRecord {
  const resolvedAvailabilityBlocks = availabilityBlocks ?? [];
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    description: row.description,
    location: row.location,
    area: row.area,
    province: row.province,
    category: row.category,
    type: row.type,
    pricePerNight: row.price_per_night,
    discountPercent: row.discount_percent,
    breakageDeposit: row.breakage_deposit,
    adults: row.adults,
    children: row.children,
    bedrooms: row.bedrooms,
    bathrooms: Number(row.bathrooms),
    amenities: row.amenities ?? [],
    facilities: row.facilities ?? [],
    restaurantOffers: row.restaurant_offers ?? [],
    images: row.images ?? [],
    videoUrl: row.video_url,
    isSelfCatering: row.is_self_catering,
    hasRestaurant: row.has_restaurant,
    isOccupied: row.is_occupied,
    latitude: row.latitude,
    longitude: row.longitude,
    blockedDates: row.blocked_dates ?? [],
    manualBlockedDates: buildManualBlockedDates(resolvedAvailabilityBlocks),
    availabilityBlocks: resolvedAvailabilityBlocks,
    settlementProfile: settlementProfile ?? null,
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function assertListingDateRangeAvailable(
  listingId: string,
  checkIn: string | Date | number,
  checkOut: string | Date | number,
  options?: {
    excludeSourceType?: AvailabilityBlockSource;
    excludeSourceId?: string;
  },
) {
  const normalizeDateInput = (value: string | Date | number, label: "check-in" | "check-out") => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        throw APIError.invalidArgument(`Invalid ${label} date.`);
      }
      return normalizeAvailabilityDateKey(trimmed.slice(0, 10));
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw APIError.invalidArgument(`Invalid ${label} date.`);
      }
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw APIError.invalidArgument(`Invalid ${label} date.`);
      }
      return parsed.toISOString().slice(0, 10);
    }
    throw APIError.invalidArgument(`Invalid ${label} date.`);
  };

  const normalizedCheckIn = normalizeDateInput(checkIn, "check-in");
  const normalizedCheckOut = normalizeDateInput(checkOut, "check-out");
  const blocks = await listAvailabilityBlockInputs(listingId);
  const requestedNights = enumerateAvailabilityNights(normalizedCheckIn, normalizedCheckOut);
  const conflict = findAvailabilityConflict(requestedNights, blocks, options);

  if (!conflict) {
    return;
  }

  const descriptor =
    conflict.block.sourceType === "MANUAL"
      ? "a manual host block"
      : conflict.block.sourceType === "APPROVED_HOLD"
        ? "another approved enquiry hold"
        : "an existing booked stay";

  throw APIError.failedPrecondition(
    `Selected dates overlap ${descriptor} on ${conflict.conflictingNights.join(", ")}.`,
  );
}

export async function replaceManualListingAvailability(listingId: string, blockedDates: string[]) {
  const existing = await catalogDB.queryRow<ListingRow>`
    SELECT * FROM listings WHERE id = ${listingId}
  `;
  if (!existing) {
    throw APIError.notFound("Listing not found.");
  }

  const normalizedBlockedDates = Array.from(new Set((blockedDates ?? []).map(normalizeAvailabilityDateKey))).sort();
  const existingBlocks = await listAvailabilityBlockInputs(listingId);
  const nonManualBlocks = existingBlocks.filter((block) => block.sourceType !== "MANUAL");
  const manualConflict = findAvailabilityConflict(normalizedBlockedDates, nonManualBlocks);

  if (manualConflict) {
    const descriptor =
      manualConflict.block.sourceType === "BOOKED" ? "a booked stay" : "an approved enquiry hold";
    throw APIError.failedPrecondition(
      `Manual availability cannot overlap ${descriptor} on ${manualConflict.conflictingNights.join(", ")}.`,
    );
  }

  await catalogDB.exec`
    DELETE FROM listing_availability_blocks
    WHERE listing_id = ${listingId}
      AND source_type = ${"MANUAL"}
  `;

  const manualIntervals = buildIntervalsFromDateKeys(normalizedBlockedDates).map((interval) => ({
    startsOn: interval.startsOn,
    endsOn: interval.endsOn,
    note: null,
  }));

  await insertManualAvailabilityBlocks(listingId, manualIntervals);

  const refreshed = await refreshListingBlockedDatesFromAvailability(listingId);

  return {
    listing: {
      ...mapListing(existing, refreshed.availabilityBlocks),
      blockedDates: refreshed.blockedDates,
      manualBlockedDates: refreshed.manualBlockedDates,
      availabilityBlocks: refreshed.availabilityBlocks,
      updatedAt: refreshed.updatedAt,
    },
  };
}

export async function replaceManualListingAvailabilityBlocks(
  listingId: string,
  manualBlocks: ListingAvailabilityManualBlockInput[],
) {
  const existing = await catalogDB.queryRow<ListingRow>`
    SELECT * FROM listings WHERE id = ${listingId}
  `;
  if (!existing) {
    throw APIError.notFound("Listing not found.");
  }

  const normalizedManualBlocks = manualBlocks.map((block) => {
    const startsOn = normalizeAvailabilityDateKey(block.startsOn);
    const endsOn = normalizeAvailabilityDateKey(block.endsOn);
    return {
      startsOn,
      endsOn,
      nights: enumerateAvailabilityNights(startsOn, endsOn),
      note: block.note?.trim() || null,
    };
  });

  const existingBlocks = await listAvailabilityBlockInputs(listingId);
  const nonManualBlocks = existingBlocks.filter((block) => block.sourceType !== "MANUAL");
  const manualCandidateBlocks: AvailabilityBlockInput[] = normalizedManualBlocks.map((block, index) => ({
    id: `manual:${index}`,
    listingId,
    sourceType: "MANUAL",
    sourceId: `${block.startsOn}:${block.endsOn}`,
    startsOn: block.startsOn,
    endsOn: block.endsOn,
    nights: block.nights,
    note: block.note,
    bookingId: null,
    createdAt: existing.created_at,
    updatedAt: existing.updated_at,
  }));

  for (const manualBlock of normalizedManualBlocks) {
    const manualConflict = findAvailabilityConflict(manualBlock.nights, nonManualBlocks);
    if (manualConflict) {
      const descriptor =
        manualConflict.block.sourceType === "BOOKED" ? "a booked stay" : "an approved enquiry hold";
      throw APIError.failedPrecondition(
        `Manual availability cannot overlap ${descriptor} on ${manualConflict.conflictingNights.join(", ")}.`,
      );
    }
  }

  for (const candidate of manualCandidateBlocks) {
    const conflictWithManual = findAvailabilityConflict(candidate.nights, manualCandidateBlocks, {
      excludeSourceType: "MANUAL",
      excludeSourceId: candidate.sourceId,
    });

    if (conflictWithManual) {
      throw APIError.failedPrecondition(
        `Manual availability intervals cannot overlap on ${conflictWithManual.conflictingNights.join(", ")}.`,
      );
    }
  }

  await catalogDB.exec`
    DELETE FROM listing_availability_blocks
    WHERE listing_id = ${listingId}
      AND source_type = ${"MANUAL"}
  `;

  await insertManualAvailabilityBlocks(
    listingId,
    normalizedManualBlocks.map((block) => ({
      startsOn: block.startsOn,
      endsOn: block.endsOn,
      note: block.note,
    })),
  );

  const refreshed = await refreshListingBlockedDatesFromAvailability(listingId);

  return {
    listing: {
      ...mapListing(existing, refreshed.availabilityBlocks),
      blockedDates: refreshed.blockedDates,
      manualBlockedDates: refreshed.manualBlockedDates,
      availabilityBlocks: refreshed.availabilityBlocks,
      updatedAt: refreshed.updatedAt,
    },
    summary: buildAvailabilitySummaryRecord(listingId, refreshed.availabilityBlocks),
  };
}

export async function replaceBookingAvailabilityBlocks(listingId: string, entries: BookingAvailabilitySnapshotItem[]) {
  const existing = await catalogDB.queryRow<ListingRow>`
    SELECT * FROM listings WHERE id = ${listingId}
  `;
  if (!existing) {
    throw APIError.notFound("Listing not found.");
  }

  const normalizedEntries = entries.flatMap((entry) => {
    const checkIn = bookingTimestampToAvailabilityDateKey(entry.checkIn);
    const checkOut = bookingTimestampToAvailabilityDateKey(entry.checkOut);
    const nights = enumerateAvailabilityNights(checkIn, checkOut);

    // (|/) Klaasvaakie - tolerate malformed zero-night rows during sync so host approval does not crash with a 500.
    if (nights.length === 0) {
      console.warn(
        `Skipping malformed booking availability row for listing ${listingId}: booking ${entry.bookingId} has non-positive stay window (${checkIn} -> ${checkOut}).`,
      );
      return [];
    }

    return [{
      bookingId: entry.bookingId,
      sourceType: entry.sourceType,
      sourceId: entry.bookingId,
      startsOn: nights[0],
      endsOn: checkOut,
      nights,
    }];
  });

  const manualBlocks = (await listAvailabilityBlockInputs(listingId)).filter((block) => block.sourceType === "MANUAL");
  const bookingCandidateBlocks: AvailabilityBlockInput[] = normalizedEntries.map((entry) => ({
    id: `${entry.sourceType}:${entry.bookingId}`,
    listingId,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    startsOn: entry.startsOn,
    endsOn: entry.endsOn,
    nights: entry.nights,
    bookingId: entry.bookingId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  for (const candidate of bookingCandidateBlocks) {
    const conflictWithManual = findAvailabilityConflict(candidate.nights, manualBlocks);
    if (conflictWithManual) {
      throw APIError.failedPrecondition(
        `Availability for inquiry ${candidate.sourceId} overlaps a manual host block on ${conflictWithManual.conflictingNights.join(", ")}.`,
      );
    }

    const conflictWithBooking = findAvailabilityConflict(candidate.nights, bookingCandidateBlocks, {
      excludeSourceType: candidate.sourceType,
      excludeSourceId: candidate.sourceId,
    });

    if (conflictWithBooking) {
      throw APIError.failedPrecondition(
        `Availability for inquiry ${candidate.sourceId} overlaps another active inquiry or booking on ${conflictWithBooking.conflictingNights.join(", ")}.`,
      );
    }
  }

  await catalogDB.exec`
    DELETE FROM listing_availability_blocks
    WHERE listing_id = ${listingId}
      AND (source_type = ${"APPROVED_HOLD"} OR source_type = ${"BOOKED"})
  `;

  for (const entry of normalizedEntries) {
    const now = new Date().toISOString();
    await catalogDB.exec`
      INSERT INTO listing_availability_blocks (
        id, listing_id, source_type, source_id, starts_on, ends_on, nights, created_at, updated_at
      )
      VALUES (
        ${randomUUID()},
        ${listingId},
        ${entry.sourceType},
        ${entry.sourceId},
        ${entry.startsOn},
        ${entry.endsOn},
        ${entry.nights},
        ${now},
        ${now}
      )
    `;
  }

  return refreshListingBlockedDatesFromAvailability(listingId);
}

export async function syncLegacyBlockedDatesForBookings(listingId: string, entries: BookingAvailabilitySnapshotItem[]) {
  const existing = await catalogDB.queryRow<Pick<ListingRow, "id" | "blocked_dates">>`
    SELECT id, blocked_dates
    FROM listings
    WHERE id = ${listingId}
  `;

  if (!existing) {
    throw APIError.notFound("Listing not found.");
  }

  const blockedDates = mergeLegacyBlockedDatesWithBookingNights(
    existing.blocked_dates ?? [],
    entries.map((entry) => ({
      checkIn: entry.checkIn,
      checkOut: entry.checkOut,
    })),
  );

  await catalogDB.exec`
    UPDATE listings
    SET blocked_dates = ${blockedDates},
        updated_at = ${new Date().toISOString()}
    WHERE id = ${listingId}
  `;
}

export async function syncBookingAvailabilityWithCompatibility(
  listingId: string,
  entries: BookingAvailabilitySnapshotItem[],
) {
  try {
    await replaceBookingAvailabilityBlocks(listingId, entries);
  } catch (error) {
    if (error instanceof APIError && error.code === "not_found") {
      throw error;
    }
    const fallbackReason = isAvailabilityLedgerSchemaError(error)
      ? "Availability ledger schema is unavailable"
      : error instanceof APIError
        ? `Availability ledger sync failed with ${error.code}`
        : "Availability ledger sync failed unexpectedly";
    console.warn(
      `${fallbackReason} for listing ${listingId}. Falling back to legacy blocked_dates sync.`,
      error,
    );
    await syncLegacyBlockedDatesForBookings(listingId, entries);
  }
}

async function safePublishPlatformEvent(params: Parameters<typeof platformEvents.publish>[0], context: string) {
  try {
    await platformEvents.publish(params);
  } catch (error) {
    console.error(`Failed to publish platform event for ${context}.`, error);
  }
}

async function assertHostCanCreateListing(hostId: string) {
  const host = await getHostAccess(hostId);

  if (host.kyc_status !== "verified") {
    throw APIError.permissionDenied("Hosts must complete KYC before creating listings.");
  }

  const quota = await getHostListingQuota(hostId);
  if (!quota.canCreate) {
    throw APIError.permissionDenied("Standard plan hosts can only keep one non-archived listing.");
  }
}

export const listListings = api<ListListingsParams, { listings: ListingRecord[] }>(
  { expose: true, method: "GET", path: "/listings" },
  async (params) => {
    const auth = getAuthData<AuthData>();
    const hostId = params.hostId ?? null;
    const status = params.status ?? null;

    if (!auth) {
      const rows = await catalogDB.rawQueryAll<ListingRow>(
        `
        SELECT * FROM listings
        WHERE status = $1
          AND ($2::text IS NULL OR host_id = $2)
        ORDER BY created_at DESC
        `,
        "active",
        hostId,
      );

      const visibleRows = await filterPubliclyVisibleListings(rows);
      const availabilityByListing = await listAvailabilityBlocksForListings(visibleRows.map((row) => row.id));
      return { listings: visibleRows.map((row) => mapListing(row, availabilityByListing.get(row.id) ?? [], null)) };
    }

    const canSeeUnpublished =
      auth.role === "admin" ||
      auth.role === "support" ||
      (auth.role === "host" && hostId === auth.userID);

    if (!canSeeUnpublished) {
      const rows = await catalogDB.rawQueryAll<ListingRow>(
        `
        SELECT * FROM listings
        WHERE status = $1
          AND ($2::text IS NULL OR host_id = $2)
        ORDER BY created_at DESC
        `,
        "active",
        hostId,
      );

      const visibleRows = await filterPubliclyVisibleListings(rows);
      const availabilityByListing = await listAvailabilityBlocksForListings(visibleRows.map((row) => row.id));
      return { listings: visibleRows.map((row) => mapListing(row, availabilityByListing.get(row.id) ?? [], null)) };
    }

    const rows = await catalogDB.rawQueryAll<ListingRow>(
      `
      SELECT * FROM listings
      WHERE ($1::text IS NULL OR host_id = $1)
        AND ($2::text IS NULL OR status = $2)
      ORDER BY created_at DESC
      `,
      hostId,
      status,
    );

    const availabilityByListing = await listAvailabilityBlocksForListings(rows.map((row) => row.id));
    return {
      listings: await Promise.all(
        rows.map(async (row) =>
          mapListing(
            row,
            availabilityByListing.get(row.id) ?? [],
            canReadListingSettlementProfile(auth, row.host_id) ? await getListingSettlementProfile(row.id) : null,
          ),
        ),
      ),
    };
  },
);

export const getListing = api<{ id: string }, { listing: ListingRecord }>(
  { expose: true, method: "GET", path: "/listings/:id" },
  async ({ id }) => {
    const row = await catalogDB.queryRow<ListingRow>`
      SELECT * FROM listings WHERE id = ${id}
    `;
    if (!row) throw APIError.notFound("Listing not found.");

    const auth = getAuthData<AuthData>();
    if (row.status !== "active" && !canReadUnpublishedListing(auth, row.host_id)) {
      throw APIError.notFound("Listing not found.");
    }
    if (row.status === "active" && !canReadUnpublishedListing(auth, row.host_id) && await isHostGreylisted(row.host_id)) {
      throw APIError.notFound("Listing not found.");
    }

    return {
      listing: await getListingWithAvailability(row, {
        includeSettlementProfile: canReadListingSettlementProfile(auth, row.host_id),
      }),
    };
  },
);

export const getMyListingQuota = api<void, { quota: HostListingQuota }>(
  { expose: true, method: "GET", path: "/host/listings/quota", auth: true },
  async () => {
    const auth = requireRole("host", "admin");
    return { quota: await getHostListingQuota(auth.userID) };
  },
);

export const saveListing = api<SaveListingParams, { listing: ListingRecord }>(
  { expose: true, method: ["POST", "PUT"], path: "/host/listings", auth: true },
  async (params) => {
    const auth = requireRole("host", "admin", "support");
    const now = new Date().toISOString();
    const isStaffOperator = auth.role === "admin" || auth.role === "support";
    if (!isStaffOperator) {
      await assertHostBillingOperationalAccess(auth.userID, "listings");
    }

    if (params.id) {
      const existing = await catalogDB.queryRow<ListingRow>`
        SELECT * FROM listings WHERE id = ${params.id}
      `;
      if (!existing) throw APIError.notFound("Listing not found.");
      if (existing.host_id !== auth.userID && !isStaffOperator) {
        throw APIError.permissionDenied("You cannot edit another host's listing.");
      }
      const hostAccess = await getHostAccess(existing.host_id);
      assertListingImageCount(params.images, hostAccess.host_plan);
      assertListingVideoAccess(params.videoUrl, hostAccess.host_plan);

      let nextStatus = params.status;
      let nextRejectionReason =
        params.status === "rejected" ? params.rejectionReason?.trim() || "Rejected during admin review." : null;
      if (!isStaffOperator) {
        if (existing.status === "archived" && params.status !== "archived") {
          throw APIError.failedPrecondition("Archived listings cannot be reactivated by hosts.");
        }

        if (existing.status === "pending") {
          nextStatus = "pending";
          nextRejectionReason = null;
        } else if (existing.status === "rejected") {
          nextStatus = "pending";
          nextRejectionReason = null;
        } else if (!["active", "inactive", "archived"].includes(params.status)) {
          nextStatus = existing.status;
          nextRejectionReason = existing.rejection_reason;
        }
      }

      if (nextStatus !== "rejected") {
        nextRejectionReason = null;
      }

      await catalogDB.exec`
        UPDATE listings
        SET title = ${params.title},
            description = ${params.description},
            location = ${params.location},
            area = ${params.area ?? null},
            province = ${params.province ?? null},
            category = ${params.category},
            type = ${params.type},
            price_per_night = ${params.pricePerNight},
            discount_percent = ${params.discountPercent},
            breakage_deposit = ${params.breakageDeposit ?? null},
            adults = ${params.adults},
            children = ${params.children},
            bedrooms = ${params.bedrooms},
            bathrooms = ${params.bathrooms},
            amenities = ${params.amenities},
            facilities = ${params.facilities},
            restaurant_offers = ${params.restaurantOffers},
            images = ${params.images},
            video_url = ${params.videoUrl ?? null},
            is_self_catering = ${params.isSelfCatering},
            has_restaurant = ${params.hasRestaurant},
            is_occupied = ${params.isOccupied},
            latitude = ${params.latitude ?? null},
            longitude = ${params.longitude ?? null},
            blocked_dates = ${existing.blocked_dates ?? []},
            status = ${nextStatus},
            rejection_reason = ${nextRejectionReason},
            updated_at = ${now}
        WHERE id = ${params.id}
      `;
      await upsertListingSettlementProfile(params.id, params.settlementProfile, now);

      await safePublishPlatformEvent({
        type: "listing.updated",
        aggregateId: params.id,
        actorId: auth.userID,
        occurredAt: now,
        payload: JSON.stringify({ hostId: existing.host_id, status: nextStatus }),
      }, `listing.updated:${params.id}`);

      if (
        isStaffOperator &&
        (nextStatus === "active" || nextStatus === "rejected") &&
        (existing.status !== nextStatus || existing.rejection_reason !== nextRejectionReason)
      ) {
        try {
          await notifyListingReviewed({
            hostId: existing.host_id,
            listingTitle: params.title,
            status: nextStatus,
            rejectionReason: nextRejectionReason,
          });
        } catch (error) {
          console.error("Failed to notify host about listing review:", error);
        }
      }

      const updatedRow = await catalogDB.queryRow<ListingRow>`
        SELECT * FROM listings WHERE id = ${params.id}
      `;
      if (!updatedRow) {
        throw APIError.notFound("Listing not found after update.");
      }

      return {
        listing: await getListingWithAvailability(updatedRow, { includeSettlementProfile: true }),
      };
    }

    const targetHostId = isStaffOperator ? params.hostId?.trim() : auth.userID;
    if (!targetHostId) {
      throw APIError.invalidArgument("Staff-created listings must specify the host that owns the listing.");
    }
    const hostAccess = await getHostAccess(targetHostId);
    assertListingImageCount(params.images, hostAccess.host_plan);
    assertListingVideoAccess(params.videoUrl, hostAccess.host_plan);

    if (!isStaffOperator) {
      await assertHostCanCreateListing(targetHostId);
    }
    const createdStatus = auth.role === "admin" ? params.status : "pending";

    const id = randomUUID();
    await catalogDB.exec`
      INSERT INTO listings (
        id, host_id, title, description, location, area, province, category, type,
        price_per_night, discount_percent, breakage_deposit, adults, children, bedrooms, bathrooms,
        amenities, facilities, restaurant_offers, images, video_url, is_self_catering,
        has_restaurant, is_occupied, latitude, longitude, blocked_dates, status, rejection_reason, created_at, updated_at
      )
      VALUES (
        ${id}, ${targetHostId}, ${params.title}, ${params.description}, ${params.location},
        ${params.area ?? null}, ${params.province ?? null}, ${params.category}, ${params.type},
        ${params.pricePerNight}, ${params.discountPercent}, ${params.breakageDeposit ?? null}, ${params.adults}, ${params.children},
        ${params.bedrooms}, ${params.bathrooms}, ${params.amenities}, ${params.facilities},
        ${params.restaurantOffers}, ${params.images}, ${params.videoUrl ?? null},
        ${params.isSelfCatering}, ${params.hasRestaurant}, ${params.isOccupied},
        ${params.latitude ?? null}, ${params.longitude ?? null}, ${[]}, ${createdStatus}, ${null}, ${now}, ${now}
      )
    `;
    await upsertListingSettlementProfile(id, params.settlementProfile, now);

    await safePublishPlatformEvent({
      type: "listing.created",
      aggregateId: id,
      actorId: auth.userID,
      occurredAt: now,
      payload: JSON.stringify({ hostId: targetHostId, status: createdStatus }),
    }, `listing.created:${id}`);

    const createdRow = await catalogDB.queryRow<ListingRow>`
      SELECT * FROM listings WHERE id = ${id}
    `;
    if (!createdRow) {
      throw APIError.notFound("Listing not found after creation.");
    }

    return {
      listing: await getListingWithAvailability(createdRow, { includeSettlementProfile: true }),
    };
  },
);

export const deleteListing = api<{ id: string }, { deleted: true }>(
  { expose: true, method: "DELETE", path: "/host/listings/:id", auth: true },
  async ({ id }) => {
    const auth = requireRole("host", "admin", "support");
    const isStaffOperator = auth.role === "admin" || auth.role === "support";
    const existing = await catalogDB.queryRow<ListingRow>`
      SELECT * FROM listings WHERE id = ${id}
    `;
    if (!existing) throw APIError.notFound("Listing not found.");
    if (existing.host_id !== auth.userID && !isStaffOperator) {
      throw APIError.permissionDenied("You cannot delete another host's listing.");
    }

    const bookingCount = await bookingDB.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM bookings
      WHERE listing_id = ${id}
    `;
    if ((bookingCount?.count ?? 0) > 0) {
      throw APIError.failedPrecondition("This listing has booking history and cannot be permanently deleted.");
    }

    await Promise.all([
      billingDB.exec`
        DELETE FROM content_drafts
        WHERE listing_id = ${id}
      `,
      catalogDB.exec`
        DELETE FROM listing_settlement_profiles
        WHERE listing_id = ${id}
      `,
      reviewsDB.exec`
        DELETE FROM reviews
        WHERE listing_id = ${id}
      `,
    ]);

    await catalogDB.exec`
      DELETE FROM listings
      WHERE id = ${id}
    `;

    await removeListingMediaAssets(existing);

    await safePublishPlatformEvent({
      type: "listing.deleted",
      aggregateId: id,
      actorId: auth.userID,
      occurredAt: new Date().toISOString(),
      payload: JSON.stringify({ hostId: existing.host_id }),
    }, `listing.deleted:${id}`);

    return { deleted: true };
  },
);

export const updateListingAvailability = api<UpdateAvailabilityParams, { listing: ListingRecord }>(
  { expose: true, method: "PUT", path: "/host/listings/availability", auth: true },
  async ({ listingId, blockedDates }) => {
    const auth = requireRole("host", "admin", "support");
    const isStaffOperator = auth.role === "admin" || auth.role === "support";
    if (!isStaffOperator) {
      await assertHostBillingOperationalAccess(auth.userID, "listings");
    }
    const existing = await catalogDB.queryRow<ListingRow>`
      SELECT * FROM listings WHERE id = ${listingId}
    `;
    if (!existing) throw APIError.notFound("Listing not found.");
    if (existing.host_id !== auth.userID && !isStaffOperator) {
      throw APIError.permissionDenied("You cannot manage another host's availability.");
    }

    return replaceManualListingAvailability(listingId, blockedDates);
  },
);

export const updateListingAvailabilityBlocks = api<UpdateAvailabilityBlocksParams, { listing: ListingRecord; summary: ListingAvailabilitySummaryRecord }>(
  { expose: true, method: "PUT", path: "/host/listings/availability/blocks", auth: true },
  async ({ listingId, manualBlocks }) => {
    const auth = requireRole("host", "admin", "support");
    const isStaffOperator = auth.role === "admin" || auth.role === "support";
    if (!isStaffOperator) {
      await assertHostBillingOperationalAccess(auth.userID, "listings");
    }
    const existing = await catalogDB.queryRow<ListingRow>`
      SELECT * FROM listings WHERE id = ${listingId}
    `;
    if (!existing) throw APIError.notFound("Listing not found.");
    if (existing.host_id !== auth.userID && !isStaffOperator) {
      throw APIError.permissionDenied("You cannot manage another host's availability.");
    }

    return replaceManualListingAvailabilityBlocks(listingId, manualBlocks ?? []);
  },
);

export const getListingAvailabilitySummary = api<{ listingId: string }, { summary: ListingAvailabilitySummaryRecord }>(
  { expose: true, method: "GET", path: "/host/listings/:listingId/availability-summary", auth: true },
  async ({ listingId }) => {
    const auth = requireRole("host", "admin", "support");
    const isStaffOperator = auth.role === "admin" || auth.role === "support";
    const existing = await catalogDB.queryRow<ListingRow>`
      SELECT * FROM listings WHERE id = ${listingId}
    `;
    if (!existing) throw APIError.notFound("Listing not found.");
    if (existing.host_id !== auth.userID && !isStaffOperator) {
      throw APIError.permissionDenied("You cannot read another host's availability.");
    }

    const availabilityBlocks = await ensureListingAvailabilityHydrated(existing);
    return { summary: buildAvailabilitySummaryRecord(listingId, availabilityBlocks) };
  },
);

export const requestListingMediaUpload = api<UploadUrlParams, { objectKey: string; uploadUrl: string; publicUrl: string }>(
  { expose: true, method: "POST", path: "/host/listings/media/upload-url", auth: true },
  async ({ listingId, filename, contentType }) => {
    const auth = requireRole("host", "admin", "support");
    if (!ALLOWED_LISTING_MEDIA_CONTENT_TYPES.has(contentType)) {
      throw APIError.invalidArgument("Unsupported listing media content type.");
    }
    const normalizedListingId = normalizeDraftListingId(listingId);
    await assertCanUploadMedia(auth, normalizedListingId);
    const objectKey = buildListingMediaObjectKey({ auth, listingId: normalizedListingId, filename });
    const signed = await listingMediaBucket.signedUploadUrl(objectKey, {
      // Large video uploads on slower uplinks routinely exceed 15 minutes.
      ttl: 60 * 60,
    });

    return {
      objectKey,
      uploadUrl: signed.url,
      publicUrl: listingMediaBucket.publicUrl(objectKey),
    };
  },
);

export const uploadListingImage = api<UploadListingImageParams, { objectKey: string; publicUrl: string }>(
  { expose: true, method: "POST", path: "/host/listings/media/images", auth: true },
  async ({ listingId, filename, contentType, dataBase64 }) => {
    const auth = requireRole("host", "admin", "support");
    if (!ALLOWED_LISTING_IMAGE_CONTENT_TYPES.has(contentType)) {
      throw APIError.invalidArgument("Unsupported image type. Please upload JPG, PNG, or WEBP.");
    }

    await assertCanUploadMedia(auth, listingId);

    const imageData = decodeBase64Payload(dataBase64);
    if (imageData.byteLength > 2 * 1024 * 1024) {
      throw APIError.invalidArgument("Image is still too large after compression. Please use a smaller photo.");
    }

    const safeFilename = sanitizeObjectFilename(filename).replace(/\.[^.]+$/, "") || "listing-image";
    const objectKey = buildListingMediaObjectKey({
      auth,
      listingId,
      filename: `${safeFilename}.jpg`,
    });

    await listingMediaBucket.upload(objectKey, imageData, {
      contentType,
    });

    return {
      objectKey,
      publicUrl: listingMediaBucket.publicUrl(objectKey),
    };
  },
);

export const uploadListingVideo = api.raw(
  {
    expose: true,
    method: "POST",
    path: "/host/listings/media/videos",
    auth: true,
    bodyLimit: 120 * 1024 * 1024,
    sensitive: true,
  },
  async (req: IncomingMessage, resp: ServerResponse) => {
    try {
      const auth = requireRole("host", "admin", "support");
      const requestUrl = new URL(req.url || "/", "http://encore.local");
      const listingId = requestUrl.searchParams.get("listingId") || undefined;
      const filename = requestUrl.searchParams.get("filename") || req.headers["x-upload-filename"]?.toString() || "listing-video";
      const contentType = requestUrl.searchParams.get("contentType") || req.headers["content-type"]?.toString() || "application/octet-stream";

      if (!ALLOWED_LISTING_VIDEO_CONTENT_TYPES.has(contentType)) {
        throw APIError.invalidArgument("Unsupported video type. Please upload MP4, WEBM, or MOV.");
      }

      await assertCanUploadMedia(auth, listingId);
      if (auth.role === "host") {
        const hostAccess = await getHostAccess(auth.userID);
        if (!supportsListingVideo(hostAccess.host_plan)) {
          throw APIError.permissionDenied("Standard hosts cannot upload showcase videos.");
        }
      }
      const videoData = await readRawBuffer(req, 100 * 1024 * 1024);
      const objectKey = buildListingMediaObjectKey({ auth, listingId, filename });

      await listingMediaBucket.upload(objectKey, videoData, {
        contentType,
      });

      resp.statusCode = 200;
      resp.setHeader("Content-Type", "application/json");
      resp.end(JSON.stringify({
        objectKey,
        publicUrl: listingMediaBucket.publicUrl(objectKey),
      }));
    } catch (error) {
      const statusCode = error instanceof APIError
        ? error.code === "invalid_argument"
          ? 400
          : error.code === "permission_denied"
            ? 403
            : error.code === "unauthenticated"
              ? 401
              : error.code === "not_found"
                ? 404
                : 500
        : 500;
      const message = error instanceof Error ? error.message : "Video upload failed.";
      resp.statusCode = statusCode;
      resp.setHeader("Content-Type", "application/json");
      resp.end(JSON.stringify({ error: message }));
    }
  },
);
