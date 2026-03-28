const ENCORE_API_URL = (import.meta as any).env?.VITE_ENCORE_API_URL || "http://127.0.0.1:4100";
const TOKEN_STORAGE_KEY = "idealstay.encore.token";

type EncoreUserRole = "guest" | "host" | "admin";

interface EncoreSessionUser {
  email: string;
  displayName: string;
  photoUrl?: string | null;
  role: EncoreUserRole;
  referredByCode?: string | null;
}

function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function hasEncoreSessionToken() {
  return !!getStoredToken();
}

export function clearEncoreSession() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function setEncoreSessionToken(token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
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

  const response = await fetch(`${ENCORE_API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Encore request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function syncEncoreSession(user: EncoreSessionUser) {
  const response = await encoreRequest<{ token: string; user: unknown }>(
    "/auth/dev-login",
    {
      method: "POST",
      body: JSON.stringify(user),
    },
  );

  setEncoreSessionToken(response.token);
  return response;
}
