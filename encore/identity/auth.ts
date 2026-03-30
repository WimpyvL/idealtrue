import { createHmac, timingSafeEqual } from "node:crypto";
import { APIError, Gateway, Header } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";
import type { AuthData } from "../shared/auth";

interface TokenPayload extends AuthData {
  exp: number;
}

interface GatewayAuthParams {
  authorization: Header<"Authorization">;
}

const authTokenSecret = secret("AUTH_TOKEN_SECRET");
const allowInsecureAuthSecret = process.env.IDEAL_STAY_ALLOW_INSECURE_AUTH === "true";

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSigningSecret() {
  const configuredSecret = authTokenSecret();
  if (configuredSecret) {
    return configuredSecret;
  }
  if (allowInsecureAuthSecret) {
    return "ideal-stay-local-dev-secret";
  }
  throw new Error(
    "Missing AUTH_TOKEN_SECRET. Set AUTH_TOKEN_SECRET or explicitly opt in to insecure local auth via IDEAL_STAY_ALLOW_INSECURE_AUTH=true.",
  );
}

function signValue(value: string) {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

export function issueToken(auth: Omit<AuthData, "userID"> & { userID: string }, ttlSeconds = 60 * 60 * 24 * 7) {
  const payload: TokenPayload = {
    ...auth,
    exp: Date.now() + ttlSeconds * 1000,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${signValue(encoded)}`;
}

export function parseToken(token: string): AuthData | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = signValue(encoded);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encoded)) as TokenPayload;
  if (!payload.exp || payload.exp < Date.now()) {
    return null;
  }

  return {
    userID: payload.userID,
    email: payload.email,
    displayName: payload.displayName,
    role: payload.role,
    hostPlan: payload.hostPlan,
    kycStatus: payload.kycStatus,
  };
}

export const gatewayAuth = authHandler<GatewayAuthParams, AuthData>(
  async (params) => {
    const rawHeader = params.authorization;
    if (!rawHeader) return null;

    const token = rawHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;

    const auth = parseToken(token);
    if (!auth) {
      throw APIError.unauthenticated("Invalid or expired bearer token.");
    }

    return auth;
  },
);

export const gateway = new Gateway({
  authHandler: gatewayAuth,
});
