import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { identityDB } from "./db";
import { issueToken } from "./auth";
import { isDevLoginEnabled } from "./dev-login";
import { sendAuthEmail } from "./email";
import { hashPassword, verifyPassword } from "./passwords";
import { createRawAuthToken, hashAuthToken } from "./tokens";
import { requireAuth, requireRole } from "../shared/auth";
import { profileMediaBucket } from "./storage";
import { platformEvents } from "../analytics/events";
import { billingDB } from "../billing/db";
import { bookingDB } from "../booking/db";
import { catalogDB } from "../catalog/db";
import { opsDB } from "../ops/db";
import { kycDocumentsBucket } from "../ops/storage";
import { referralsDB } from "../referrals/db";
import { reviewsDB } from "../reviews/db";
import type { HostPlan, KycStatus, ReferralTier, UserProfile, UserRole } from "../shared/domain";

interface SignupParams {
  email: string;
  displayName: string;
  password: string;
  role?: UserRole;
  photoUrl?: string | null;
  referredByCode?: string | null;
}

interface LoginParams {
  email: string;
  password: string;
}

interface RequestPasswordResetParams {
  email: string;
}

interface ResetPasswordParams {
  token: string;
  password: string;
}

interface VerifyEmailParams {
  token: string;
}

interface DevLoginParams {
  email: string;
  displayName: string;
  photoUrl?: string | null;
  role?: UserRole;
  referredByCode?: string | null;
}

interface DevLoginResponse {
  token: string;
  user: UserProfile;
}

interface SessionResponse {
  token: string;
  user: UserProfile;
}

interface UpsertProfileParams {
  displayName?: string;
  photoUrl?: string | null;
  role?: UserRole;
  hostPlan?: HostPlan;
  kycStatus?: KycStatus;
  referredByCode?: string | null;
  paymentMethod?: string | null;
  paymentInstructions?: string | null;
  paymentReferencePrefix?: string | null;
}

interface ReferralLeaderboardUser {
  id: string;
  displayName: string;
  photoUrl: string | null;
  tier: ReferralTier;
  referralCount: number;
}

interface RequestProfilePhotoUploadParams {
  filename: string;
}

interface UploadProfilePhotoParams {
  filename: string;
  contentType: string;
  dataBase64: string;
}

interface AdminUpdateUserParams {
  userId: string;
  displayName?: string;
  role?: UserRole;
  hostPlan?: HostPlan;
  kycStatus?: KycStatus;
  balance?: number;
  tier?: ReferralTier;
}

interface AdminSetPasswordParams {
  userId: string;
  password: string;
}

type UserRow = {
  id: string;
  email: string;
  email_verified: boolean;
  display_name: string;
  password_hash: string | null;
  photo_url: string | null;
  role: UserRole;
  is_admin: boolean;
  host_plan: HostPlan;
  kyc_status: KycStatus;
  balance: number;
  referral_count: number;
  tier: ReferralTier;
  referral_code: string | null;
  referred_by_code: string | null;
  payment_method: string | null;
  payment_instructions: string | null;
  payment_reference_prefix: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type AuthTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  token_type: "verify_email" | "reset_password";
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

type DeleteDependencyCounts = {
  listings: number;
  bookingsAsGuest: number;
  bookingsAsHost: number;
  reviewsAsGuest: number;
  reviewsAsHost: number;
  referralRewardsAsReferrer: number;
  referralRewardsAsReferred: number;
  referredAccounts: number;
  subscriptions: number;
  billingCheckouts: number;
  contentCreditLedgerEntries: number;
};

type UserKycMediaRow = {
  id_image_key: string;
  selfie_image_key: string;
};

const USER_SELECT = `
  SELECT
    id,
    email,
    email_verified,
    display_name,
    password_hash,
    photo_url,
    role,
    is_admin,
    host_plan,
    kyc_status,
    balance,
    referral_count,
    tier,
    referral_code,
    referred_by_code,
    payment_method,
    payment_instructions,
    payment_reference_prefix,
    last_login_at,
    created_at,
    updated_at
  FROM users
`;

const AUTH_TOKEN_SELECT = `
  SELECT
    id,
    user_id,
    token_hash,
    token_type,
    expires_at,
    consumed_at,
    created_at
  FROM auth_tokens
`;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validatePassword(password: string | null | undefined) {
  if (!password || password.length < 8) {
    throw APIError.invalidArgument("Password must be at least 8 characters long.");
  }
}

const ALLOWED_PROFILE_PHOTO_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function sanitizeUploadFilename(filename: string) {
  const normalized = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.slice(0, 120) || "upload.jpg";
}

function decodeBase64Payload(dataBase64: string) {
  const normalized = dataBase64.trim().replace(/^data:[^;]+;base64,/, "");
  let buffer: Buffer;

  try {
    buffer = Buffer.from(normalized, "base64");
  } catch {
    throw APIError.invalidArgument("Invalid base64 upload payload.");
  }

  if (!buffer.length) {
    throw APIError.invalidArgument("Upload payload was empty.");
  }

  return buffer;
}

function resolveSelfServiceRole(existingRole: UserRole, isAdmin: boolean, requestedRole?: UserRole) {
  if (!requestedRole || requestedRole === existingRole) {
    return existingRole;
  }

  if (requestedRole === "admin") {
    if (isAdmin) {
      return "admin";
    }
    throw APIError.permissionDenied("Only active admins can switch back into admin mode.");
  }

  const existingIsUserRole = existingRole === "guest" || existingRole === "host";
  const requestedIsUserRole = requestedRole === "guest" || requestedRole === "host";
  if ((existingIsUserRole || isAdmin || existingRole === "admin") && requestedIsUserRole) {
    return requestedRole;
  }

  throw APIError.permissionDenied("Self-service role updates can only switch between guest and host.");
}

function mapUser(row: UserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.email_verified,
    displayName: row.display_name,
    photoUrl: row.photo_url,
    role: row.role,
    isAdmin: row.is_admin,
    hostPlan: row.host_plan,
    kycStatus: row.kyc_status,
    balance: row.balance,
    referralCount: row.referral_count,
    tier: row.tier,
    referralCode: row.referral_code,
    referredByCode: row.referred_by_code,
    paymentMethod: row.payment_method,
    paymentInstructions: row.payment_instructions,
    paymentReferencePrefix: row.payment_reference_prefix,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function makeReferralCode(email: string) {
  return email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || "IDEAL";
}

function getBucketObjectKey(publicUrl: string | null | undefined, publicPrefix: string) {
  const trimmed = `${publicUrl || ""}`.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (trimmed.startsWith(publicPrefix)) {
      return decodeURIComponent(trimmed.slice(publicPrefix.length)).replace(/^\/+/, "") || null;
    }

    const parsed = new URL(trimmed);
    return decodeURIComponent(parsed.pathname).replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

async function getUserDeleteDependencyCounts(userId: string): Promise<DeleteDependencyCounts> {
  const [
    listings,
    bookingsAsGuest,
    bookingsAsHost,
    reviewsAsGuest,
    reviewsAsHost,
    referralRewardsAsReferrer,
    referralRewardsAsReferred,
    referredAccounts,
    subscriptions,
    billingCheckouts,
    contentCreditLedgerEntries,
  ] = await Promise.all([
    catalogDB.queryRow<{ count: number }>`SELECT COUNT(*)::int AS count FROM listings WHERE host_id = ${userId}`,
    bookingDB.queryRow<{ count: number }>`SELECT COUNT(*)::int AS count FROM bookings WHERE guest_id = ${userId}`,
    bookingDB.queryRow<{ count: number }>`SELECT COUNT(*)::int AS count FROM bookings WHERE host_id = ${userId}`,
    reviewsDB.queryRow<{ count: number }>`SELECT COUNT(*)::int AS count FROM reviews WHERE guest_id = ${userId}`,
    reviewsDB.queryRow<{ count: number }>`SELECT COUNT(*)::int AS count FROM reviews WHERE host_id = ${userId}`,
    referralsDB.queryRow<{ count: number }>`SELECT COUNT(*)::int AS count FROM referral_rewards WHERE referrer_id = ${userId}`,
    referralsDB.queryRow<{ count: number }>`SELECT COUNT(*)::int AS count FROM referral_rewards WHERE referred_user_id = ${userId}`,
    identityDB.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE referred_by_code = (
        SELECT referral_code FROM users WHERE id = ${userId}
      )
    `,
    billingDB.queryRow<{ count: number }>`SELECT COUNT(*)::int AS count FROM subscriptions WHERE user_id = ${userId}`,
    billingDB.queryRow<{ count: number }>`SELECT COUNT(*)::int AS count FROM billing_checkout_sessions WHERE user_id = ${userId}`,
    billingDB.queryRow<{ count: number }>`SELECT COUNT(*)::int AS count FROM content_credit_ledger WHERE user_id = ${userId}`,
  ]);

  return {
    listings: listings?.count ?? 0,
    bookingsAsGuest: bookingsAsGuest?.count ?? 0,
    bookingsAsHost: bookingsAsHost?.count ?? 0,
    reviewsAsGuest: reviewsAsGuest?.count ?? 0,
    reviewsAsHost: reviewsAsHost?.count ?? 0,
    referralRewardsAsReferrer: referralRewardsAsReferrer?.count ?? 0,
    referralRewardsAsReferred: referralRewardsAsReferred?.count ?? 0,
    referredAccounts: referredAccounts?.count ?? 0,
    subscriptions: subscriptions?.count ?? 0,
    billingCheckouts: billingCheckouts?.count ?? 0,
    contentCreditLedgerEntries: contentCreditLedgerEntries?.count ?? 0,
  };
}

function getUserDeleteBlockers(counts: DeleteDependencyCounts) {
  const blockers: string[] = [];

  if (counts.listings > 0) blockers.push(`${counts.listings} listing${counts.listings === 1 ? "" : "s"}`);
  if (counts.bookingsAsGuest > 0) blockers.push(`${counts.bookingsAsGuest} guest booking${counts.bookingsAsGuest === 1 ? "" : "s"}`);
  if (counts.bookingsAsHost > 0) blockers.push(`${counts.bookingsAsHost} host booking${counts.bookingsAsHost === 1 ? "" : "s"}`);
  if (counts.reviewsAsGuest > 0) blockers.push(`${counts.reviewsAsGuest} guest review${counts.reviewsAsGuest === 1 ? "" : "s"}`);
  if (counts.reviewsAsHost > 0) blockers.push(`${counts.reviewsAsHost} host review${counts.reviewsAsHost === 1 ? "" : "s"}`);
  if (counts.referralRewardsAsReferrer > 0) blockers.push(`${counts.referralRewardsAsReferrer} referral reward${counts.referralRewardsAsReferrer === 1 ? "" : "s"} earned`);
  if (counts.referralRewardsAsReferred > 0) blockers.push(`${counts.referralRewardsAsReferred} referral conversion record${counts.referralRewardsAsReferred === 1 ? "" : "s"}`);
  if (counts.referredAccounts > 0) blockers.push(`${counts.referredAccounts} referred account${counts.referredAccounts === 1 ? "" : "s"}`);
  if (counts.subscriptions > 0) blockers.push(`${counts.subscriptions} subscription record${counts.subscriptions === 1 ? "" : "s"}`);
  if (counts.billingCheckouts > 0) blockers.push(`${counts.billingCheckouts} billing checkout${counts.billingCheckouts === 1 ? "" : "s"}`);
  if (counts.contentCreditLedgerEntries > 0) blockers.push(`${counts.contentCreditLedgerEntries} content credit ledger entr${counts.contentCreditLedgerEntries === 1 ? "y" : "ies"}`);

  return blockers;
}

async function removeUserMedia(existing: UserRow, kycSubmission: UserKycMediaRow | null) {
  const removals: Promise<unknown>[] = [];

  const profilePhotoKey = getBucketObjectKey(existing.photo_url, profileMediaBucket.publicUrl(""));
  if (profilePhotoKey) {
    removals.push(
      profileMediaBucket.remove(profilePhotoKey).catch((error) => {
        console.warn(`Failed to remove profile photo ${profilePhotoKey}:`, error);
      }),
    );
  }

  if (kycSubmission?.id_image_key) {
    removals.push(
      kycDocumentsBucket.remove(kycSubmission.id_image_key).catch((error) => {
        console.warn(`Failed to remove KYC ID document ${kycSubmission.id_image_key}:`, error);
      }),
    );
  }

  if (kycSubmission?.selfie_image_key) {
    removals.push(
      kycDocumentsBucket.remove(kycSubmission.selfie_image_key).catch((error) => {
        console.warn(`Failed to remove KYC selfie ${kycSubmission.selfie_image_key}:`, error);
      }),
    );
  }

  await Promise.all(removals);
}

function issueSession(user: UserProfile): SessionResponse {
  return {
    token: issueToken({
      userID: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      hostPlan: user.hostPlan,
      kycStatus: user.kycStatus,
    }),
    user,
  };
}

async function issueAuthToken(userId: string, type: "verify_email" | "reset_password", ttlMinutes: number) {
  const rawToken = createRawAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  await identityDB.exec`
    DELETE FROM auth_tokens
    WHERE user_id = ${userId}
      AND token_type = ${type}
      AND consumed_at IS NULL
  `;

  await identityDB.exec`
    INSERT INTO auth_tokens (id, user_id, token_hash, token_type, expires_at, created_at)
    VALUES (${id}, ${userId}, ${tokenHash}, ${type}, ${expiresAt}, ${now.toISOString()})
  `;

  return rawToken;
}

async function consumeAuthToken(rawToken: string, type: "verify_email" | "reset_password") {
  const tokenHash = hashAuthToken(rawToken);
  const row = await identityDB.rawQueryRow<AuthTokenRow>(
    `${AUTH_TOKEN_SELECT}
     WHERE token_hash = $1
       AND token_type = $2
       AND consumed_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    tokenHash,
    type,
  );
  if (!row) {
    throw APIError.failedPrecondition("This link is invalid or has expired.");
  }

  const now = new Date().toISOString();
  await identityDB.exec`
    UPDATE auth_tokens
    SET consumed_at = ${now}
    WHERE id = ${row.id}
  `;

  return row;
}

export const signup = api<SignupParams, SessionResponse>(
  { expose: true, method: "POST", path: "/auth/signup" },
  async (params) => {
    const email = normalizeEmail(params.email);
    validatePassword(params.password);

    const existing = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE email = $1`,
      email,
    );
    if (existing) {
      if (existing.password_hash) {
        throw APIError.alreadyExists("An account already exists for this email.");
      }
      throw APIError.failedPrecondition("This account exists without password access yet. Reset or migration flow still needs to be added.");
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const role = params.role ?? "guest";
    if (!["guest", "host"].includes(role)) {
      throw APIError.invalidArgument("Public signup can only create guest or host accounts.");
    }
    const referralCode = `${makeReferralCode(email)}${Math.floor(Math.random() * 900 + 100)}`;
    const passwordHash = await hashPassword(params.password);

    await identityDB.exec`
      INSERT INTO users (
        id, email, email_verified, display_name, password_hash, photo_url, role, is_admin, host_plan, kyc_status, balance, referral_count, tier, referral_code, referred_by_code, last_login_at, created_at, updated_at
      )
      VALUES (
        ${id}, ${email}, ${false}, ${params.displayName}, ${passwordHash}, ${params.photoUrl ?? null}, ${role}, ${false}, ${"standard"}, ${"none"}, ${0}, ${0}, ${"bronze"}, ${referralCode}, ${params.referredByCode ?? null}, ${now}, ${now}, ${now}
      )
    `;

    const user: UserProfile = {
      id,
      email,
      emailVerified: false,
      displayName: params.displayName,
      photoUrl: params.photoUrl ?? null,
      role,
      isAdmin: false,
      hostPlan: "standard",
      kycStatus: "none",
      balance: 0,
      referralCount: 0,
      tier: "bronze",
      referralCode,
      referredByCode: params.referredByCode ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await platformEvents.publish({
      type: "user.registered",
      aggregateId: user.id,
      actorId: user.id,
      occurredAt: now,
      payload: JSON.stringify({ role: user.role, email: user.email }),
    });

    const verificationToken = await issueAuthToken(user.id, "verify_email", 60 * 24);
    await sendAuthEmail({
      to: user.email,
      displayName: user.displayName,
      kind: "verify_email",
      token: verificationToken,
    });

    return issueSession(user);
  },
);

export const login = api<LoginParams, SessionResponse>(
  { expose: true, method: "POST", path: "/auth/login" },
  async (params) => {
    const email = normalizeEmail(params.email);
    const existing = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE email = $1`,
      email,
    );
    if (!existing || !existing.password_hash) {
      throw APIError.unauthenticated("Invalid email or password.");
    }

    const matches = await verifyPassword(params.password, existing.password_hash);
    if (!matches) {
      throw APIError.unauthenticated("Invalid email or password.");
    }

    const now = new Date().toISOString();
    await identityDB.exec`
      UPDATE users
      SET last_login_at = ${now},
          updated_at = ${now}
      WHERE id = ${existing.id}
    `;

    return issueSession(mapUser({
      ...existing,
      last_login_at: now,
    }));
  },
);

export const devLogin = api<DevLoginParams, DevLoginResponse>(
  { expose: true, method: "POST", path: "/auth/dev-login" },
  async (params) => {
    if (!isDevLoginEnabled()) {
      throw APIError.permissionDenied("Dev login is disabled in this environment.");
    }

    const email = normalizeEmail(params.email);
    const existing = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE email = $1`,
      email,
    );

    const now = new Date().toISOString();
    const role = params.role ?? "guest";
    if (!["guest", "host"].includes(role)) {
      throw APIError.invalidArgument("Dev login only supports guest or host roles.");
    }
    let user: UserProfile;

    if (existing) {
      await identityDB.exec`
        UPDATE users
        SET display_name = ${params.displayName},
            photo_url = ${params.photoUrl ?? existing.photo_url},
            role = ${role},
            is_admin = CASE WHEN ${role} = ${"admin"} THEN true ELSE is_admin END,
            email_verified = ${true},
            referred_by_code = COALESCE(${params.referredByCode ?? null}, referred_by_code),
            payment_method = ${existing.payment_method},
            payment_instructions = ${existing.payment_instructions},
            payment_reference_prefix = ${existing.payment_reference_prefix},
            updated_at = ${now}
        WHERE id = ${existing.id}
      `;

      user = mapUser({
        ...existing,
        display_name: params.displayName,
        photo_url: params.photoUrl ?? existing.photo_url,
        role,
        is_admin: role === "admin" ? true : existing.is_admin,
        email_verified: true,
        referred_by_code: params.referredByCode ?? existing.referred_by_code,
        updated_at: now,
      });
    } else {
      const id = randomUUID();
      const referralCode = `${makeReferralCode(email)}${Math.floor(Math.random() * 900 + 100)}`;
      await identityDB.exec`
        INSERT INTO users (
          id, email, email_verified, display_name, photo_url, role, is_admin, host_plan, kyc_status, balance, referral_count, tier, referral_code, referred_by_code, created_at, updated_at
        )
        VALUES (
        ${id}, ${email}, ${true}, ${params.displayName}, ${params.photoUrl ?? null}, ${role}, ${false}, ${"standard"}, ${"none"}, ${0}, ${0}, ${"bronze"}, ${referralCode}, ${params.referredByCode ?? null}, ${now}, ${now}
        )
      `;
      user = {
        id,
        email,
        emailVerified: true,
        displayName: params.displayName,
        photoUrl: params.photoUrl ?? null,
        role,
        isAdmin: false,
        hostPlan: "standard",
        kycStatus: "none",
        balance: 0,
        referralCount: 0,
        tier: "bronze",
        referralCode,
        referredByCode: params.referredByCode ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await platformEvents.publish({
        type: "user.registered",
        aggregateId: user.id,
        actorId: user.id,
        occurredAt: now,
        payload: JSON.stringify({ role: user.role, email: user.email }),
      });
    }

    return issueSession(user);
  },
);

export const requestEmailVerification = api<void, { ok: true }>(
  { expose: true, method: "POST", path: "/auth/request-email-verification", auth: true },
  async () => {
    const auth = requireAuth();
    const existing = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE id = $1`,
      auth.userID,
    );
    if (!existing) throw APIError.notFound("User not found.");
    if (existing.email_verified) {
      return { ok: true };
    }

    const token = await issueAuthToken(existing.id, "verify_email", 60 * 24);
    await sendAuthEmail({
      to: existing.email,
      displayName: existing.display_name,
      kind: "verify_email",
      token,
    });

    return { ok: true };
  },
);

export const verifyEmail = api<VerifyEmailParams, { ok: true }>(
  { expose: true, method: "POST", path: "/auth/verify-email" },
  async ({ token }) => {
    const authToken = await consumeAuthToken(token, "verify_email");
    const now = new Date().toISOString();
    await identityDB.exec`
      UPDATE users
      SET email_verified = ${true},
          updated_at = ${now}
      WHERE id = ${authToken.user_id}
    `;
    return { ok: true };
  },
);

export const requestPasswordReset = api<RequestPasswordResetParams, { ok: true }>(
  { expose: true, method: "POST", path: "/auth/request-password-reset" },
  async ({ email }) => {
    const normalizedEmail = normalizeEmail(email);
    const existing = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE email = $1`,
      normalizedEmail,
    );
    if (!existing) {
      return { ok: true };
    }

    const token = await issueAuthToken(existing.id, "reset_password", 60);
    await sendAuthEmail({
      to: existing.email,
      displayName: existing.display_name,
      kind: "reset_password",
      token,
    });

    return { ok: true };
  },
);

export const resetPassword = api<ResetPasswordParams, { ok: true }>(
  { expose: true, method: "POST", path: "/auth/reset-password" },
  async ({ token, password }) => {
    validatePassword(password);
    const authToken = await consumeAuthToken(token, "reset_password");
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    await identityDB.exec`
      UPDATE users
      SET password_hash = ${passwordHash},
          updated_at = ${now}
      WHERE id = ${authToken.user_id}
    `;
    return { ok: true };
  },
);

export const getSession = api<void, SessionResponse>(
  { expose: true, method: "GET", path: "/auth/session", auth: true },
  async () => {
    const auth = requireAuth();
    const user = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE id = $1`,
      auth.userID,
    );
    if (!user) throw APIError.notFound("User session could not be resolved.");
    const mappedUser = mapUser(user);
    return issueSession(mappedUser);
  },
);

export const upsertProfile = api<UpsertProfileParams, SessionResponse>(
  { expose: true, method: "PUT", path: "/users/me", auth: true },
  async (params) => {
    const auth = requireAuth();
    const existing = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE id = $1`,
      auth.userID,
    );
    if (!existing) throw APIError.notFound("User not found.");

    if (params.hostPlan !== undefined || params.kycStatus !== undefined) {
      throw APIError.permissionDenied("Host plan and KYC status can only be changed by administrators.");
    }

    const nextRole = resolveSelfServiceRole(existing.role, existing.is_admin, params.role);
    const nextPlan = existing.host_plan;
    const nextKyc = existing.kyc_status;
    const nextDisplayName = params.displayName ?? existing.display_name;
    const nextPhoto = params.photoUrl ?? existing.photo_url;
    const nextReferredByCode = params.referredByCode ?? existing.referred_by_code;
    const nextPaymentMethod = params.paymentMethod ?? existing.payment_method;
    const nextPaymentInstructions = params.paymentInstructions ?? existing.payment_instructions;
    const nextPaymentReferencePrefix = params.paymentReferencePrefix ?? existing.payment_reference_prefix;
    const now = new Date().toISOString();

    await identityDB.exec`
      UPDATE users
      SET display_name = ${nextDisplayName},
      photo_url = ${nextPhoto},
      role = ${nextRole},
          host_plan = ${nextPlan},
          kyc_status = ${nextKyc},
          referred_by_code = ${nextReferredByCode},
          payment_method = ${nextPaymentMethod},
          payment_instructions = ${nextPaymentInstructions},
          payment_reference_prefix = ${nextPaymentReferencePrefix},
          updated_at = ${now}
      WHERE id = ${auth.userID}
    `;

    const user = mapUser({
      ...existing,
      display_name: nextDisplayName,
      photo_url: nextPhoto,
      role: nextRole,
      is_admin: existing.is_admin,
      host_plan: nextPlan,
      kyc_status: nextKyc,
      referred_by_code: nextReferredByCode,
      payment_method: nextPaymentMethod,
      payment_instructions: nextPaymentInstructions,
      payment_reference_prefix: nextPaymentReferencePrefix,
      updated_at: now,
    });

    return issueSession(user);
  },
);

export const listReferralLeaderboard = api<void, { users: ReferralLeaderboardUser[] }>(
  { expose: true, method: "GET", path: "/users/leaderboard/referrals" },
  async () => {
    const rows = await identityDB.queryAll<{
      id: string;
      display_name: string;
      photo_url: string | null;
      tier: ReferralTier;
      referral_count: number;
    }>`
      SELECT id, display_name, photo_url, tier, referral_count
      FROM users
      ORDER BY referral_count DESC, created_at ASC
      LIMIT 5
    `;
    return {
      users: rows.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        photoUrl: row.photo_url,
        tier: row.tier,
        referralCount: row.referral_count,
      })),
    };
  },
);

export const requestProfilePhotoUpload = api<RequestProfilePhotoUploadParams, { objectKey: string; uploadUrl: string; publicUrl: string }>(
  { expose: true, method: "POST", path: "/users/me/photo/upload-url", auth: true },
  async ({ filename }) => {
    const auth = requireAuth();
    const objectKey = `${auth.userID}/${Date.now()}-${filename}`;
    const signed = await profileMediaBucket.signedUploadUrl(objectKey, { ttl: 900 });

    return {
      objectKey,
      uploadUrl: signed.url,
      publicUrl: profileMediaBucket.publicUrl(objectKey),
    };
  },
);

export const uploadProfilePhoto = api<UploadProfilePhotoParams, { photoUrl: string }>(
  { expose: true, method: "POST", path: "/users/me/photo", auth: true },
  async ({ filename, contentType, dataBase64 }) => {
    const auth = requireAuth();
    if (!ALLOWED_PROFILE_PHOTO_CONTENT_TYPES.has(contentType)) {
      throw APIError.invalidArgument("Only JPG, PNG, and WEBP profile photos are supported.");
    }

    const buffer = decodeBase64Payload(dataBase64);
    if (buffer.byteLength > 700 * 1024) {
      throw APIError.invalidArgument("Profile photo is too large. Please upload a smaller image.");
    }

    const safeFilename = sanitizeUploadFilename(filename);
    const objectKey = `${auth.userID}/${Date.now()}-${safeFilename}`;
    await profileMediaBucket.upload(objectKey, buffer, { contentType });

    return {
      photoUrl: profileMediaBucket.publicUrl(objectKey),
    };
  },
);

export const listUsers = api<void, { users: UserProfile[] }>(
  { expose: true, method: "GET", path: "/admin/users", auth: true },
  async () => {
    requireRole("admin", "support");
    const rows = await identityDB.rawQueryAll<UserRow>(`${USER_SELECT} ORDER BY created_at DESC`);
    return { users: rows.map(mapUser) };
  },
);

export const adminUpdateUser = api<AdminUpdateUserParams, { user: UserProfile }>(
  { expose: true, method: "PUT", path: "/admin/users/:userId", auth: true },
  async (params) => {
    requireRole("admin", "support");
    const existing = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE id = $1`,
      params.userId,
    );
    if (!existing) throw APIError.notFound("User not found.");

    const nextDisplayName = params.displayName ?? existing.display_name;
    const nextRole = params.role ?? existing.role;
    const nextIsAdmin = nextRole === "admin" ? true : existing.is_admin;
    const nextHostPlan = params.hostPlan ?? existing.host_plan;
    const nextKycStatus = params.kycStatus ?? existing.kyc_status;
    const nextBalance = params.balance ?? existing.balance;
    const nextTier = params.tier ?? existing.tier;
    const now = new Date().toISOString();

    await identityDB.exec`
      UPDATE users
      SET display_name = ${nextDisplayName},
          role = ${nextRole},
          is_admin = ${nextIsAdmin},
          host_plan = ${nextHostPlan},
          kyc_status = ${nextKycStatus},
          balance = ${nextBalance},
          tier = ${nextTier},
          updated_at = ${now}
      WHERE id = ${params.userId}
    `;

    return {
      user: mapUser({
        ...existing,
        display_name: nextDisplayName,
        role: nextRole,
        is_admin: nextIsAdmin,
        host_plan: nextHostPlan,
        kyc_status: nextKycStatus,
        balance: nextBalance,
        tier: nextTier,
        updated_at: now,
      }),
    };
  },
);

export const adminDeleteUser = api<{ userId: string }, { deleted: true }>(
  { expose: true, method: "DELETE", path: "/admin/users/:userId", auth: true },
  async ({ userId }) => {
    const auth = requireRole("admin", "support");
    if (auth.userID === userId) {
      throw APIError.failedPrecondition("You cannot delete your own account while you are signed in.");
    }

    const existing = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE id = $1`,
      userId,
    );
    if (!existing) {
      throw APIError.notFound("User not found.");
    }

    const dependencyCounts = await getUserDeleteDependencyCounts(userId);
    const blockers = getUserDeleteBlockers(dependencyCounts);
    if (blockers.length > 0) {
      throw APIError.failedPrecondition(
        `This user cannot be permanently deleted because the account still has ${blockers.join(", ")}.`,
      );
    }

    const kycSubmission = await opsDB.queryRow<UserKycMediaRow>`
      SELECT id_image_key, selfie_image_key
      FROM kyc_submissions
      WHERE user_id = ${userId}
    `;

    await Promise.all([
      identityDB.exec`DELETE FROM auth_tokens WHERE user_id = ${userId}`,
      billingDB.exec`DELETE FROM content_drafts WHERE user_id = ${userId}`,
      billingDB.exec`DELETE FROM content_credit_wallets WHERE user_id = ${userId}`,
      opsDB.exec`DELETE FROM notification_reads WHERE user_id = ${userId}`,
      opsDB.exec`DELETE FROM notifications WHERE target = ${userId}`,
      opsDB.exec`DELETE FROM kyc_submissions WHERE user_id = ${userId}`,
    ]);

    await identityDB.exec`
      DELETE FROM users WHERE id = ${userId}
    `;

    await removeUserMedia(existing, kycSubmission);

    await platformEvents.publish({
      type: "user.deleted",
      aggregateId: userId,
      actorId: auth.userID,
      occurredAt: new Date().toISOString(),
      payload: JSON.stringify({ email: existing.email, role: existing.role }),
    });

    return { deleted: true };
  },
);

export const adminSetPassword = api<AdminSetPasswordParams, { ok: true }>(
  { expose: true, method: "POST", path: "/admin/users/password", auth: true },
  async ({ userId, password }) => {
    requireRole("admin", "support");
    validatePassword(password);
    const existing = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE id = $1`,
      userId,
    );
    if (!existing) throw APIError.notFound("User not found.");

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    await identityDB.exec`
      UPDATE users
      SET password_hash = ${passwordHash},
          updated_at = ${now}
      WHERE id = ${userId}
    `;
    return { ok: true };
  },
);

export const setUserKycStatus = api<{
  userId: string;
  kycStatus: KycStatus;
}, { user: UserProfile }>(
  { expose: true, method: "POST", path: "/admin/users/kyc-status", auth: true },
  async (params) => {
    requireRole("admin", "support");
    const existing = await identityDB.rawQueryRow<UserRow>(
      `${USER_SELECT} WHERE id = $1`,
      params.userId,
    );
    if (!existing) throw APIError.notFound("User not found.");
    const now = new Date().toISOString();

    await identityDB.exec`
      UPDATE users
      SET kyc_status = ${params.kycStatus},
          updated_at = ${now}
      WHERE id = ${params.userId}
    `;

    return {
      user: mapUser({
        ...existing,
        kyc_status: params.kycStatus,
        updated_at: now,
      }),
    };
  },
);
