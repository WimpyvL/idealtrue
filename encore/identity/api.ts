import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { identityDB } from "./db";
import { issueToken } from "./auth";
import { hashPassword, verifyPassword } from "./passwords";
import { requireAuth, requireRole } from "../shared/auth";
import { profileMediaBucket } from "./storage";
import { platformEvents } from "../analytics/events";
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

interface RequestProfilePhotoUploadParams {
  filename: string;
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
  display_name: string;
  password_hash: string | null;
  photo_url: string | null;
  role: UserRole;
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validatePassword(password: string) {
  if (password.length < 8) {
    throw APIError.invalidArgument("Password must be at least 8 characters long.");
  }
}

function mapUser(row: UserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    photoUrl: row.photo_url,
    role: row.role,
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

export const signup = api<SignupParams, SessionResponse>(
  { expose: true, method: "POST", path: "/auth/signup" },
  async (params) => {
    const email = normalizeEmail(params.email);
    validatePassword(params.password);

    const existing = await identityDB.queryRow<UserRow>`
      SELECT * FROM users WHERE email = ${email}
    `;
    if (existing) {
      if (existing.password_hash) {
        throw APIError.alreadyExists("An account already exists for this email.");
      }
      throw APIError.failedPrecondition("This account exists without password access yet. Reset or migration flow still needs to be added.");
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const role = params.role ?? "guest";
    const referralCode = `${makeReferralCode(email)}${Math.floor(Math.random() * 900 + 100)}`;
    const passwordHash = await hashPassword(params.password);

    await identityDB.exec`
      INSERT INTO users (
        id, email, display_name, password_hash, photo_url, role, host_plan, kyc_status, balance, referral_count, tier, referral_code, referred_by_code, last_login_at, created_at, updated_at
      )
      VALUES (
        ${id}, ${email}, ${params.displayName}, ${passwordHash}, ${params.photoUrl ?? null}, ${role}, ${"free"}, ${"none"}, ${0}, ${0}, ${"bronze"}, ${referralCode}, ${params.referredByCode ?? null}, ${now}, ${now}, ${now}
      )
    `;

    const user: UserProfile = {
      id,
      email,
      displayName: params.displayName,
      photoUrl: params.photoUrl ?? null,
      role,
      hostPlan: "free",
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

    return issueSession(user);
  },
);

export const login = api<LoginParams, SessionResponse>(
  { expose: true, method: "POST", path: "/auth/login" },
  async (params) => {
    const email = normalizeEmail(params.email);
    const existing = await identityDB.queryRow<UserRow>`
      SELECT * FROM users WHERE email = ${email}
    `;
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
          updated_at = ${existing.updated_at}
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
    const email = normalizeEmail(params.email);
    const existing = await identityDB.queryRow<UserRow>`
      SELECT * FROM users WHERE email = ${email}
    `;

    const now = new Date().toISOString();
    const role = params.role ?? "guest";
    let user: UserProfile;

    if (existing) {
      await identityDB.exec`
        UPDATE users
        SET display_name = ${params.displayName},
            photo_url = ${params.photoUrl ?? existing.photo_url},
            role = ${role},
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
        referred_by_code: params.referredByCode ?? existing.referred_by_code,
        updated_at: now,
      });
    } else {
      const id = randomUUID();
      const referralCode = `${makeReferralCode(email)}${Math.floor(Math.random() * 900 + 100)}`;
      await identityDB.exec`
        INSERT INTO users (
          id, email, display_name, photo_url, role, host_plan, kyc_status, balance, referral_count, tier, referral_code, referred_by_code, created_at, updated_at
        )
        VALUES (
          ${id}, ${email}, ${params.displayName}, ${params.photoUrl ?? null}, ${role}, ${"free"}, ${"none"}, ${0}, ${0}, ${"bronze"}, ${referralCode}, ${params.referredByCode ?? null}, ${now}, ${now}
        )
      `;
      user = {
        id,
        email,
        displayName: params.displayName,
        photoUrl: params.photoUrl ?? null,
        role,
        hostPlan: "free",
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

export const getSession = api<void, SessionResponse>(
  { expose: true, method: "GET", path: "/auth/session", auth: true },
  async () => {
    const auth = requireAuth();
    const user = await identityDB.queryRow<UserRow>`
      SELECT * FROM users WHERE id = ${auth.userID}
    `;
    if (!user) throw APIError.notFound("User session could not be resolved.");
    const mappedUser = mapUser(user);
    return issueSession(mappedUser);
  },
);

export const upsertProfile = api<UpsertProfileParams, SessionResponse>(
  { expose: true, method: "PUT", path: "/users/me", auth: true },
  async (params) => {
    const auth = requireAuth();
    const existing = await identityDB.queryRow<UserRow>`
      SELECT * FROM users WHERE id = ${auth.userID}
    `;
    if (!existing) throw APIError.notFound("User not found.");

    const nextRole = params.role ?? existing.role;
    const nextPlan = params.hostPlan ?? existing.host_plan;
    const nextKyc = params.kycStatus ?? existing.kyc_status;
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

export const listReferralLeaderboard = api<void, { users: UserProfile[] }>(
  { expose: true, method: "GET", path: "/users/leaderboard/referrals" },
  async () => {
    const rows = await identityDB.queryAll<UserRow>`
      SELECT * FROM users
      ORDER BY referral_count DESC, created_at ASC
      LIMIT 5
    `;
    return { users: rows.map(mapUser) };
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

export const listUsers = api<void, { users: UserProfile[] }>(
  { expose: true, method: "GET", path: "/admin/users", auth: true },
  async () => {
    requireRole("admin", "support");
    const rows = await identityDB.queryAll<UserRow>`
      SELECT * FROM users
      ORDER BY created_at DESC
    `;
    return { users: rows.map(mapUser) };
  },
);

export const adminUpdateUser = api<AdminUpdateUserParams, { user: UserProfile }>(
  { expose: true, method: "PUT", path: "/admin/users/:userId", auth: true },
  async (params) => {
    requireRole("admin", "support");
    const existing = await identityDB.queryRow<UserRow>`
      SELECT * FROM users WHERE id = ${params.userId}
    `;
    if (!existing) throw APIError.notFound("User not found.");

    const nextDisplayName = params.displayName ?? existing.display_name;
    const nextRole = params.role ?? existing.role;
    const nextHostPlan = params.hostPlan ?? existing.host_plan;
    const nextKycStatus = params.kycStatus ?? existing.kyc_status;
    const nextBalance = params.balance ?? existing.balance;
    const nextTier = params.tier ?? existing.tier;
    const now = new Date().toISOString();

    await identityDB.exec`
      UPDATE users
      SET display_name = ${nextDisplayName},
          role = ${nextRole},
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
    requireRole("admin", "support");
    await identityDB.exec`
      DELETE FROM users WHERE id = ${userId}
    `;
    return { deleted: true };
  },
);

export const adminSetPassword = api<AdminSetPasswordParams, { ok: true }>(
  { expose: true, method: "POST", path: "/admin/users/:userId/password", auth: true },
  async ({ userId, password }) => {
    requireRole("admin", "support");
    validatePassword(password);
    const existing = await identityDB.queryRow<UserRow>`
      SELECT * FROM users WHERE id = ${userId}
    `;
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
    const existing = await identityDB.queryRow<UserRow>`
      SELECT * FROM users WHERE id = ${params.userId}
    `;
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
