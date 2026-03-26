import { APIError } from "encore.dev/api";
import { getAuthData } from "encore.dev/internal/codegen/auth";
import type { HostPlan, KycStatus, UserRole } from "./domain";

export interface AuthData {
  userID: string;
  email: string;
  displayName: string;
  role: UserRole;
  hostPlan: HostPlan;
  kycStatus: KycStatus;
}

export function requireAuth() {
  const auth = getAuthData<AuthData>();
  if (!auth) {
    throw APIError.unauthenticated("Authentication is required for this endpoint.");
  }
  return auth;
}

export function requireRole(...roles: UserRole[]) {
  const auth = requireAuth();
  if (!roles.includes(auth.role)) {
    throw APIError.permissionDenied(`This endpoint requires one of: ${roles.join(", ")}.`);
  }
  return auth;
}
