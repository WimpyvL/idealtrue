import { createHash, randomBytes } from "node:crypto";
import { secret } from "encore.dev/config";

const authTokenPepper = secret("AUTH_TOKEN_SECRET");
const allowInsecureAuthSecret = process.env.IDEAL_STAY_ALLOW_INSECURE_AUTH === "true";

type AuthTokenType = "verify_email" | "reset_password";

function getPepper() {
  const configuredSecret = authTokenPepper();
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

export function createRawAuthToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAuthToken(token: string) {
  return createHash("sha256").update(`${getPepper()}:${token}`).digest("hex");
}

export type { AuthTokenType };
