export const DEFAULT_ENCORE_API_URL = "/api/encore";

export class EncoreRequestError extends Error {
  status: number;
  path: string;
  body: string;
  code?: string;

  constructor(params: {
    status: number;
    path: string;
    message: string;
    body: string;
    code?: string;
  }) {
    super(params.message);
    this.name = "EncoreRequestError";
    this.status = params.status;
    this.path = params.path;
    this.body = params.body;
    this.code = params.code;
  }
}

export function isEncoreRequestError(error: unknown): error is EncoreRequestError {
  return error instanceof EncoreRequestError;
}

export function getEncoreErrorMessage(error: unknown, fallback = "Request failed. Please try again.") {
  if (error instanceof EncoreRequestError) {
    return error.message || fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function getEncoreApiUrl() {
  return DEFAULT_ENCORE_API_URL;
}

export function clearEncoreSession() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  return fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => undefined);
}

function parseEncoreErrorBody(body: string): { message: string; code?: string } {
  if (!body.trim()) {
    return { message: "Encore request failed." };
  }

  try {
    const parsed = JSON.parse(body) as {
      error?: string;
      message?: string;
      code?: string;
    };

    return {
      message: parsed.error || parsed.message || body,
      code: parsed.code,
    };
  } catch {
    return { message: body };
  }
}

export async function encoreRequest<T>(
  path: string,
  init: RequestInit = {},
  _opts: { auth?: boolean } = {},
): Promise<T> {
  const response = await encoreFetch(path, init);

  if (!response.ok) {
    const body = await response.text();
    const parsed = parseEncoreErrorBody(body);
    throw new EncoreRequestError({
      status: response.status,
      path,
      message: parsed.message || `Encore request failed with status ${response.status}`,
      body,
      code: parsed.code,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.text();
  if (!body.trim()) {
    return undefined as T;
  }

  return JSON.parse(body) as T;
}

async function encoreFetch(
  path: string,
  init: RequestInit = {},
  _opts: { auth?: boolean } = {},
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const body = init.body;

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
  const isBinaryBody =
    isFormData ||
    isBlob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body as ArrayBufferView | null);

  if (body && !headers.has("Content-Type") && !isBinaryBody) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${getEncoreApiUrl()}${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });
}
