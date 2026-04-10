import { api, APIError } from "encore.dev/api";
import { getAuthData } from "encore.dev/internal/codegen/auth";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { catalogDB } from "./db";
import { listingMediaBucket } from "./storage";
import { computeHostListingQuota, type HostListingQuota } from "./quota";
import { requireRole, type AuthData } from "../shared/auth";
import { billingDB } from "../billing/db";
import { bookingDB } from "../booking/db";
import { identityDB } from "../identity/db";
import { notifyListingReviewed } from "../ops/notifications";
import { platformEvents } from "../analytics/events";
import { reviewsDB } from "../reviews/db";
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
  const normalizedListingId = normalizeDraftListingId(listingId);
  if (!normalizedListingId) {
    return;
  }

  const listing = await catalogDB.queryRow<ListingRow>`
    SELECT * FROM listings WHERE id = ${normalizedListingId}
  `;
  if (!listing) throw APIError.notFound("Listing not found.");
  if (listing.host_id !== auth.userID && auth.role !== "admin") {
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
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function replaceListingBlockedDates(listingId: string, blockedDates: string[]) {
  const existing = await catalogDB.queryRow<ListingRow>`
    SELECT * FROM listings WHERE id = ${listingId}
  `;
  if (!existing) {
    throw APIError.notFound("Listing not found.");
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
    const hostAccess = isStaffOperator ? null : await getHostAccess(auth.userID);
    if (hostAccess) {
      assertListingImageCount(params.images, hostAccess.host_plan);
    }

    if (params.id) {
      const existing = await catalogDB.queryRow<ListingRow>`
        SELECT * FROM listings WHERE id = ${params.id}
      `;
      if (!existing) throw APIError.notFound("Listing not found.");
      if (existing.host_id !== auth.userID && !isStaffOperator) {
        throw APIError.permissionDenied("You cannot edit another host's listing.");
      }

      let nextStatus = params.status;
      let nextRejectionReason =
        params.status === "rejected" ? params.rejectionReason?.trim() || "Rejected during admin review." : null;
      if (auth.role !== "admin") {
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
            blocked_dates = ${params.blockedDates ?? existing.blocked_dates ?? []},
            status = ${nextStatus},
            rejection_reason = ${nextRejectionReason},
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

      return {
        listing: {
          ...mapListing(existing),
          ...params,
          id: params.id,
          hostId: existing.host_id,
          status: nextStatus,
          rejectionReason: nextRejectionReason,
          createdAt: existing.created_at,
          updatedAt: now,
        },
      };
    }

    if (auth.role === "support") {
      throw APIError.permissionDenied("Support staff can edit existing listings but cannot create new ones.");
    }

    if (auth.role !== "admin") {
      await assertHostCanCreateListing(auth.userID);
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
        ${id}, ${auth.userID}, ${params.title}, ${params.description}, ${params.location},
        ${params.area ?? null}, ${params.province ?? null}, ${params.category}, ${params.type},
        ${params.pricePerNight}, ${params.discountPercent}, ${params.breakageDeposit ?? null}, ${params.adults}, ${params.children},
        ${params.bedrooms}, ${params.bathrooms}, ${params.amenities}, ${params.facilities},
        ${params.restaurantOffers}, ${params.images}, ${params.videoUrl ?? null},
        ${params.isSelfCatering}, ${params.hasRestaurant}, ${params.isOccupied},
        ${params.latitude ?? null}, ${params.longitude ?? null}, ${params.blockedDates ?? []}, ${createdStatus}, ${null}, ${now}, ${now}
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
        rejectionReason: null,
        createdAt: now,
        updatedAt: now,
      },
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

    await platformEvents.publish({
      type: "listing.deleted",
      aggregateId: id,
      actorId: auth.userID,
      occurredAt: new Date().toISOString(),
      payload: JSON.stringify({ hostId: existing.host_id }),
    });

    return { deleted: true };
  },
);

export const updateListingAvailability = api<UpdateAvailabilityParams, { listing: ListingRecord }>(
  { expose: true, method: "PUT", path: "/host/listings/availability", auth: true },
  async ({ listingId, blockedDates }) => {
    const auth = requireRole("host", "admin", "support");
    const isStaffOperator = auth.role === "admin" || auth.role === "support";
    const existing = await catalogDB.queryRow<ListingRow>`
      SELECT * FROM listings WHERE id = ${listingId}
    `;
    if (!existing) throw APIError.notFound("Listing not found.");
    if (existing.host_id !== auth.userID && !isStaffOperator) {
      throw APIError.permissionDenied("You cannot manage another host's availability.");
    }

    return replaceListingBlockedDates(listingId, blockedDates);
  },
);

export const requestListingMediaUpload = api<UploadUrlParams, { objectKey: string; uploadUrl: string; publicUrl: string }>(
  { expose: true, method: "POST", path: "/host/listings/media/upload-url", auth: true },
  async ({ listingId, filename, contentType }) => {
    const auth = requireRole("host", "admin");
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
    const auth = requireRole("host", "admin");
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
      const auth = requireRole("host", "admin");
      const requestUrl = new URL(req.url || "/", "http://encore.local");
      const listingId = requestUrl.searchParams.get("listingId") || undefined;
      const filename = requestUrl.searchParams.get("filename") || req.headers["x-upload-filename"]?.toString() || "listing-video";
      const contentType = requestUrl.searchParams.get("contentType") || req.headers["content-type"]?.toString() || "application/octet-stream";

      if (!ALLOWED_LISTING_VIDEO_CONTENT_TYPES.has(contentType)) {
        throw APIError.invalidArgument("Unsupported video type. Please upload MP4, WEBM, or MOV.");
      }

      await assertCanUploadMedia(auth, listingId);
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
