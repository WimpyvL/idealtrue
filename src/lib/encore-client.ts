export const DEFAULT_ENCORE_API_URL = "http://127.0.0.1:4000";
export const TOKEN_STORAGE_KEY = "idealstay.encore.token";

export function getEncoreApiUrl() {
  return (import.meta as any).env?.VITE_ENCORE_API_URL || DEFAULT_ENCORE_API_URL;
}

function getStorage() {
  if (typeof window === "undefined") {
    throw new Error("Encore session storage is unavailable outside the browser.");
  }

  return window.localStorage;
}

function getStoredToken() {
  return getStorage().getItem(TOKEN_STORAGE_KEY);
}

export function getEncoreSessionToken() {
  return getStoredToken();
}

export function hasEncoreSessionToken() {
  return !!getStoredToken();
}

export function clearEncoreSession() {
  getStorage().removeItem(TOKEN_STORAGE_KEY);
}

export function setEncoreSessionToken(token: string) {
  getStorage().setItem(TOKEN_STORAGE_KEY, token);
}

export async function encoreRequest<T>(
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");

  if (opts.auth) {
    const token = getStoredToken();
    if (!token) {
      throw new Error("Missing Encore session token.");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getEncoreApiUrl()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Encore request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
