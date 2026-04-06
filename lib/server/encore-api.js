import {
  getRequestId,
  getSessionTokenFromCookieHeader,
  resolveEncoreApiUrl,
} from "./session-cookie.js";

function createEncoreHeaders(cookieHeader) {
  const headers = new Headers({
    Accept: "application/json",
    "X-Request-Id": getRequestId(),
  });
  const token = getSessionTokenFromCookieHeader(cookieHeader);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function readEncoreJson(response, fallbackMessage) {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(body || fallbackMessage || `Encore request failed with status ${response.status}`);
  }

  return body ? JSON.parse(body) : {};
}

export async function fetchEncoreJson(pathname, { env = process.env, cookieHeader } = {}) {
  const encoreApiUrl = resolveEncoreApiUrl(env, { allowLocalDefault: true });
  const url = new URL(pathname, `${encoreApiUrl}/`);
  const response = await fetch(url, {
    method: "GET",
    headers: createEncoreHeaders(cookieHeader),
  });
  return readEncoreJson(response, `Encore request failed for ${pathname}`);
}

export async function requireEncoreSession(cookieHeader, env = process.env) {
  const sessionPayload = await fetchEncoreJson("/auth/session", { env, cookieHeader });
  if (!sessionPayload?.user) {
    throw new Error("You must be signed in to use this feature.");
  }
  return sessionPayload.user;
}

export async function getListingForCurrentUser({ listingId, cookieHeader, env = process.env }) {
  const [sessionPayload, listingPayload] = await Promise.all([
    fetchEncoreJson("/auth/session", { env, cookieHeader }),
    fetchEncoreJson(`/listings/${encodeURIComponent(listingId)}`, { env, cookieHeader }),
  ]);

  const user = sessionPayload?.user;
  const listing = listingPayload?.listing;
  if (!user) {
    throw new Error("You must be signed in to use this feature.");
  }
  if (!listing) {
    throw new Error("Listing not found.");
  }
  if (user.role !== "admin" && listing.hostId !== user.id) {
    throw new Error("You can only generate creatives for your own listings.");
  }

  return { user, listing };
}
