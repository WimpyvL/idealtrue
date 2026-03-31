import { api, APIError } from "encore.dev/api";
import { getAuthData } from "encore.dev/internal/codegen/auth";
import { randomUUID } from "node:crypto";
import { catalogDB } from "./db";
import { listingMediaBucket } from "./storage";
import { requireRole, type AuthData } from "../shared/auth";
import { identityDB } from "../identity/db";
import { platformEvents } from "../analytics/events";
import type { ListingRecord, ListingStatus } from "../shared/domain";

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
  created_at: string;
  updated_at: string;
};

type HostAccessRow = {
  id: string;
  host_plan: "standard" | "professional" | "premium";
  kyc_status: "none" | "pending" | "verified" | "rejected";
};

interface SaveListingParams {
  id?: string;
  title: string;
  description: string;
  location: string;
  area?: string | null;
  province?: string | null;
  category: string;
  type: string;
  pricePerNight: number;
  discountPercent: number;
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
  status: ListingStatus;
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

const ALLOWED_LISTING_MEDIA_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function getMaxImagesForPlan(plan: HostAccessRow["host_plan"]) {
  return plan === "standard" ? 5 : 20;
}

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

function assertListingImageCount(images: string[], plan: HostAccessRow["host_plan"]) {
  const maxImages = getMaxImagesForPlan(plan);
  if (images.length > maxImages) {
    throw APIError.invalidArgument(`Your ${plan} plan allows up to ${maxImages} images per listing.`);
  }
}

function sanitizeObjectFilename(filename: string) {
  const trimmed = filename.trim();
  const normalized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.slice(0, 120) || "upload.bin";
}

function canReadUnpublishedListing(auth: AuthData | null, listingHostId: string) {
  if (!auth) return false;
  if (auth.role === "admin" || auth.role === "support") return true;
  if (auth.role === "host" && auth.userID === listingHostId) return true;
  return false;
}

interface UpdateAvailabilityParams {
  listingId: string;
  blockedDates: string[];
}

function mapListing(row: ListingRow): ListingRecord {
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
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertHostCanCreateListing(hostId: string) {
  const host = await getHostAccess(hostId);

  if (host.kyc_status !== "verified") {
    throw APIError.permissionDenied("Hosts must complete KYC before creating listings.");
  }

  const existingListings = await catalogDB.queryRow<{ count: number }>`
    SELECT COUNT(*)::int AS count
    FROM listings
    WHERE host_id = ${hostId}
      AND status <> ${"archived"}
  `;

  if (host.host_plan === "standard" && (existingListings?.count ?? 0) >= 1) {
    throw APIError.permissionDenied("Standard plan hosts can only keep one active listing.");
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

      return { listings: rows.map(mapListing) };
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

      return { listings: rows.map(mapListing) };
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

    return { listings: rows.map(mapListing) };
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

    return { listing: mapListing(row) };
  },
);

export const saveListing = api<SaveListingParams, { listing: ListingRecord }>(
  { expose: true, method: ["POST", "PUT"], path: "/host/listings", auth: true },
  async (params) => {
    const auth = requireRole("host", "admin");
    const now = new Date().toISOString();
    const hostAccess = auth.role === "admin" ? null : await getHostAccess(auth.userID);
    if (hostAccess) {
      assertListingImageCount(params.images, hostAccess.host_plan);
    }

    if (params.id) {
      const existing = await catalogDB.queryRow<ListingRow>`
        SELECT * FROM listings WHERE id = ${params.id}
      `;
      if (!existing) throw APIError.notFound("Listing not found.");
      if (existing.host_id !== auth.userID && auth.role !== "admin") {
        throw APIError.permissionDenied("You cannot edit another host's listing.");
      }

      let nextStatus = params.status;
      if (auth.role !== "admin") {
        if (existing.status === "archived" && params.status !== "archived") {
          throw APIError.failedPrecondition("Archived listings cannot be reactivated by hosts.");
        }

        if (existing.status === "pending") {
          nextStatus = "pending";
        } else if (existing.status === "rejected") {
          nextStatus = "pending";
        } else if (!["active", "inactive", "archived"].includes(params.status)) {
          nextStatus = existing.status;
        }
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
            blocked_dates = ${params.blockedDates ?? existing.blocked_dates ?? []},
            status = ${nextStatus},
            updated_at = ${now}
        WHERE id = ${params.id}
      `;

      await platformEvents.publish({
        type: "listing.updated",
        aggregateId: params.id,
        actorId: auth.userID,
        occurredAt: now,
        payload: JSON.stringify({ hostId: auth.userID, status: nextStatus }),
      });

      return {
        listing: {
          ...params,
          status: nextStatus,
          id: params.id,
          hostId: existing.host_id,
          createdAt: existing.created_at,
          updatedAt: now,
        },
      };
    }

    if (auth.role !== "admin") {
      await assertHostCanCreateListing(auth.userID);
    }
    const createdStatus = auth.role === "admin" ? params.status : "pending";

    const id = randomUUID();
    await catalogDB.exec`
      INSERT INTO listings (
        id, host_id, title, description, location, area, province, category, type,
        price_per_night, discount_percent, adults, children, bedrooms, bathrooms,
        amenities, facilities, restaurant_offers, images, video_url, is_self_catering,
        has_restaurant, is_occupied, latitude, longitude, blocked_dates, status, created_at, updated_at
      )
      VALUES (
        ${id}, ${auth.userID}, ${params.title}, ${params.description}, ${params.location},
        ${params.area ?? null}, ${params.province ?? null}, ${params.category}, ${params.type},
        ${params.pricePerNight}, ${params.discountPercent}, ${params.adults}, ${params.children},
        ${params.bedrooms}, ${params.bathrooms}, ${params.amenities}, ${params.facilities},
        ${params.restaurantOffers}, ${params.images}, ${params.videoUrl ?? null},
        ${params.isSelfCatering}, ${params.hasRestaurant}, ${params.isOccupied},
        ${params.latitude ?? null}, ${params.longitude ?? null}, ${params.blockedDates ?? []}, ${createdStatus}, ${now}, ${now}
      )
    `;

    await platformEvents.publish({
      type: "listing.created",
      aggregateId: id,
      actorId: auth.userID,
      occurredAt: now,
      payload: JSON.stringify({ hostId: auth.userID, status: createdStatus }),
    });

    return {
      listing: {
        ...params,
        status: createdStatus,
        id,
        hostId: auth.userID,
        createdAt: now,
        updatedAt: now,
      },
    };
  },
);

export const updateListingAvailability = api<UpdateAvailabilityParams, { listing: ListingRecord }>(
  { expose: true, method: "PUT", path: "/host/listings/availability", auth: true },
  async ({ listingId, blockedDates }) => {
    const auth = requireRole("host", "admin");
    const existing = await catalogDB.queryRow<ListingRow>`
      SELECT * FROM listings WHERE id = ${listingId}
    `;
    if (!existing) throw APIError.notFound("Listing not found.");
    if (existing.host_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You cannot manage another host's availability.");
    }

    const normalizedBlockedDates = Array.from(new Set(blockedDates)).sort();
    const now = new Date().toISOString();

    await catalogDB.exec`
      UPDATE listings
      SET blocked_dates = ${normalizedBlockedDates},
          updated_at = ${now}
      WHERE id = ${listingId}
    `;

    return {
      listing: {
        ...mapListing(existing),
        blockedDates: normalizedBlockedDates,
        updatedAt: now,
      },
    };
  },
);

export const requestListingMediaUpload = api<UploadUrlParams, { objectKey: string; uploadUrl: string; publicUrl: string }>(
  { expose: true, method: "POST", path: "/host/listings/media/upload-url", auth: true },
  async ({ listingId, filename, contentType }) => {
    const auth = requireRole("host", "admin");
    if (!ALLOWED_LISTING_MEDIA_CONTENT_TYPES.has(contentType)) {
      throw APIError.invalidArgument("Unsupported listing media content type.");
    }
    const safeFilename = sanitizeObjectFilename(filename);
    if (listingId) {
      const listing = await catalogDB.queryRow<ListingRow>`
        SELECT * FROM listings WHERE id = ${listingId}
      `;
      if (!listing) throw APIError.notFound("Listing not found.");
      if (listing.host_id !== auth.userID && auth.role !== "admin") {
        throw APIError.permissionDenied("You cannot upload media for another host's listing.");
      }
    }

    const objectKey = listingId
      ? `${listingId}/${Date.now()}-${safeFilename}`
      : `drafts/${auth.userID}/${Date.now()}-${safeFilename}`;
    const signed = await listingMediaBucket.signedUploadUrl(objectKey, {
      ttl: 60 * 15,
    });

    return {
      objectKey,
      uploadUrl: signed.url,
      publicUrl: listingMediaBucket.publicUrl(objectKey),
    };
  },
);
