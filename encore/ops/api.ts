import { api } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { opsDB } from "./db";
import { kycDocumentsBucket } from "./storage";
import { requireRole } from "../shared/auth";
import { requireAuth } from "../shared/auth";

interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetId?: string | null;
  payload: string;
  createdAt: string;
}

interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  target: string;
  createdAt: string;
}

interface PlatformSettingsRecord {
  id: "global";
  referralRewardAmount: number;
  commissionRate: number;
  minWithdrawalAmount: number;
  platformName: string;
  supportEmail: string;
  cancellationPolicyDays: number;
  maxGuestsPerListing: number;
  enableReviews: boolean;
  enableReferrals: boolean;
  maintenanceMode: boolean;
  updatedAt: string;
}

interface UpdatePlatformSettingsParams {
  referralRewardAmount?: number;
  commissionRate?: number;
  minWithdrawalAmount?: number;
  platformName?: string;
  supportEmail?: string;
  cancellationPolicyDays?: number;
  maxGuestsPerListing?: number;
  enableReviews?: boolean;
  enableReferrals?: boolean;
  maintenanceMode?: boolean;
}

interface KycSubmission {
  id: string;
  userId: string;
  idType: "id_card" | "passport" | "drivers_license";
  idNumber: string;
  idImageKey: string;
  selfieImageKey: string;
  status: "pending" | "verified" | "rejected";
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewerId?: string | null;
}

interface KycSubmissionAssets {
  idImageUrl: string;
  selfieImageUrl: string;
}

type KycSubmissionRow = {
  id: string;
  user_id: string;
  id_type: "id_card" | "passport" | "drivers_license";
  id_number: string;
  id_image_key: string;
  selfie_image_key: string;
  status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewer_id: string | null;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  target: string;
  created_at: string;
};

type PlatformSettingsRow = {
  id: "global";
  referral_reward_amount: number;
  commission_rate: number;
  min_withdrawal_amount: number;
  platform_name: string;
  support_email: string;
  cancellation_policy_days: number;
  max_guests_per_listing: number;
  enable_reviews: boolean;
  enable_referrals: boolean;
  maintenance_mode: boolean;
  updated_at: string;
};

function mapKycSubmission(row: KycSubmissionRow): KycSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    idType: row.id_type,
    idNumber: row.id_number,
    idImageKey: row.id_image_key,
    selfieImageKey: row.selfie_image_key,
    status: row.status,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewerId: row.reviewer_id,
  };
}

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    target: row.target,
    createdAt: row.created_at,
  };
}

function mapPlatformSettings(row: PlatformSettingsRow): PlatformSettingsRecord {
  return {
    id: row.id,
    referralRewardAmount: row.referral_reward_amount,
    commissionRate: row.commission_rate,
    minWithdrawalAmount: row.min_withdrawal_amount,
    platformName: row.platform_name,
    supportEmail: row.support_email,
    cancellationPolicyDays: row.cancellation_policy_days,
    maxGuestsPerListing: row.max_guests_per_listing,
    enableReviews: row.enable_reviews,
    enableReferrals: row.enable_referrals,
    maintenanceMode: row.maintenance_mode,
    updatedAt: row.updated_at,
  };
}

export const requestKycUpload = api<{ filename: string }, { objectKey: string; uploadUrl: string }>(
  { expose: true, method: "POST", path: "/ops/kyc/upload-url", auth: true },
  async ({ filename }) => {
    const auth = requireRole("host", "admin");
    const objectKey = `${auth.userID}/${Date.now()}-${filename}`;
    const signed = await kycDocumentsBucket.signedUploadUrl(objectKey, { ttl: 900 });
    return { objectKey, uploadUrl: signed.url };
  },
);

export const submitKyc = api<{
  idType: "id_card" | "passport" | "drivers_license";
  idNumber: string;
  idImageKey: string;
  selfieImageKey: string;
}, { submission: KycSubmission }>(
  { expose: true, method: "POST", path: "/ops/kyc/submissions", auth: true },
  async (params) => {
    const auth = requireRole("host", "admin");
    const now = new Date().toISOString();
    const existing = await opsDB.queryRow<KycSubmissionRow>`
      SELECT * FROM kyc_submissions WHERE user_id = ${auth.userID}
    `;

    if (existing) {
      await opsDB.exec`
        UPDATE kyc_submissions
        SET id_type = ${params.idType},
            id_number = ${params.idNumber},
            id_image_key = ${params.idImageKey},
            selfie_image_key = ${params.selfieImageKey},
            status = ${"pending"},
            rejection_reason = ${null},
            submitted_at = ${now},
            reviewed_at = ${null},
            reviewer_id = ${null}
        WHERE user_id = ${auth.userID}
      `;

      return {
        submission: {
          ...mapKycSubmission(existing),
          idType: params.idType,
          idNumber: params.idNumber,
          idImageKey: params.idImageKey,
          selfieImageKey: params.selfieImageKey,
          status: "pending",
          rejectionReason: null,
          submittedAt: now,
          reviewedAt: null,
          reviewerId: null,
        },
      };
    }

    const id = randomUUID();
    await opsDB.exec`
      INSERT INTO kyc_submissions (
        id, user_id, id_type, id_number, id_image_key, selfie_image_key, status, submitted_at
      )
      VALUES (
        ${id}, ${auth.userID}, ${params.idType}, ${params.idNumber}, ${params.idImageKey}, ${params.selfieImageKey}, ${"pending"}, ${now}
      )
    `;

    return {
      submission: {
        id,
        userId: auth.userID,
        idType: params.idType,
        idNumber: params.idNumber,
        idImageKey: params.idImageKey,
        selfieImageKey: params.selfieImageKey,
        status: "pending",
        rejectionReason: null,
        submittedAt: now,
        reviewedAt: null,
        reviewerId: null,
      },
    };
  },
);

export const getMyKycSubmission = api<void, { submission: KycSubmission | null }>(
  { expose: true, method: "GET", path: "/ops/kyc/submissions/me", auth: true },
  async () => {
    const auth = requireAuth();
    const submission = await opsDB.queryRow<KycSubmissionRow>`
      SELECT * FROM kyc_submissions WHERE user_id = ${auth.userID}
    `;
    return { submission: submission ? mapKycSubmission(submission) : null };
  },
);

export const listKycSubmissions = api<void, { submissions: KycSubmission[] }>(
  { expose: true, method: "GET", path: "/ops/kyc/submissions", auth: true },
  async () => {
    requireRole("admin", "support");
    const submissions = await opsDB.rawQueryAll<KycSubmissionRow>(
      `SELECT * FROM kyc_submissions ORDER BY submitted_at DESC`,
    );
    return { submissions: submissions.map(mapKycSubmission) };
  },
);

export const reviewKycSubmission = api<{
  userId: string;
  status: "verified" | "rejected";
  rejectionReason?: string | null;
}, { submission: KycSubmission }>(
  { expose: true, method: "POST", path: "/ops/kyc/submissions/review", auth: true },
  async (params) => {
    const auth = requireRole("admin", "support");
    const existing = await opsDB.queryRow<KycSubmissionRow>`
      SELECT * FROM kyc_submissions WHERE user_id = ${params.userId}
    `;
    if (!existing) {
      throw new Error("KYC submission not found.");
    }
    const now = new Date().toISOString();
    await opsDB.exec`
      UPDATE kyc_submissions
      SET status = ${params.status},
          rejection_reason = ${params.status === "rejected" ? params.rejectionReason ?? "Rejected during review." : null},
          reviewed_at = ${now},
          reviewer_id = ${auth.userID}
      WHERE user_id = ${params.userId}
    `;
    return {
      submission: {
        ...mapKycSubmission(existing),
        status: params.status,
        rejectionReason: params.status === "rejected" ? params.rejectionReason ?? "Rejected during review." : null,
        reviewedAt: now,
        reviewerId: auth.userID,
      },
    };
  },
);

export const getKycSubmissionAssets = api<{ userId: string }, { assets: KycSubmissionAssets }>(
  { expose: true, method: "GET", path: "/ops/kyc/submissions/:userId/assets", auth: true },
  async ({ userId }) => {
    requireRole("admin", "support");
    const existing = await opsDB.queryRow<KycSubmissionRow>`
      SELECT * FROM kyc_submissions WHERE user_id = ${userId}
    `;
    if (!existing) {
      throw new Error("KYC submission not found.");
    }

    const [idImageUrl, selfieImageUrl] = await Promise.all([
      kycDocumentsBucket.signedDownloadUrl(existing.id_image_key, { ttl: 900 }),
      kycDocumentsBucket.signedDownloadUrl(existing.selfie_image_key, { ttl: 900 }),
    ]);

    return {
      assets: {
        idImageUrl: idImageUrl.url,
        selfieImageUrl: selfieImageUrl.url,
      },
    };
  },
);

export const writeAuditLog = api<{ action: string; targetId?: string | null; payload?: string }, { id: string }>(
  { expose: true, method: "POST", path: "/ops/audit", auth: true },
  async ({ action, targetId, payload }) => {
    const auth = requireRole("admin", "support");
    const id = randomUUID();
    await opsDB.exec`
      INSERT INTO audit_log (id, actor_id, action, target_id, payload, created_at)
      VALUES (${id}, ${auth.userID}, ${action}, ${targetId ?? null}, ${payload ?? "{}"}, ${new Date().toISOString()})
    `;
    return { id };
  },
);

export const listAuditLogs = api<void, { logs: AuditLogEntry[] }>(
  { expose: true, method: "GET", path: "/ops/audit", auth: true },
  async () => {
    requireRole("admin", "support");
    const logs = await opsDB.rawQueryAll<{
      id: string;
      actor_id: string;
      action: string;
      target_id: string | null;
      payload: string;
      created_at: string;
    }>(`SELECT id, actor_id, action, target_id, payload::text AS payload, created_at FROM audit_log ORDER BY created_at DESC LIMIT 100`);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        actorId: log.actor_id,
        action: log.action,
        targetId: log.target_id,
        payload: log.payload,
        createdAt: log.created_at,
      })),
    };
  },
);

export const listAdminNotifications = api<void, { notifications: NotificationRecord[] }>(
  { expose: true, method: "GET", path: "/ops/admin/notifications", auth: true },
  async () => {
    requireRole("admin", "support");
    const notifications = await opsDB.rawQueryAll<NotificationRow>(
      `SELECT id, title, message, type, target, created_at FROM notifications ORDER BY created_at DESC`,
    );
    return { notifications: notifications.map(mapNotification) };
  },
);

export const createAdminNotification = api<{
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  target: string;
}, { notification: NotificationRecord }>(
  { expose: true, method: "POST", path: "/ops/admin/notifications", auth: true },
  async ({ title, message, type, target }) => {
    requireRole("admin", "support");
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await opsDB.exec`
      INSERT INTO notifications (id, title, message, type, target, created_at)
      VALUES (${id}, ${title}, ${message}, ${type}, ${target}, ${createdAt})
    `;
    return {
      notification: {
        id,
        title,
        message,
        type,
        target,
        createdAt,
      },
    };
  },
);

export const deleteAdminNotification = api<{ notificationId: string }, { deleted: true }>(
  { expose: true, method: "DELETE", path: "/ops/admin/notifications/:notificationId", auth: true },
  async ({ notificationId }) => {
    requireRole("admin", "support");
    await opsDB.exec`
      DELETE FROM notifications
      WHERE id = ${notificationId}
    `;
    return { deleted: true };
  },
);

export const getPlatformSettings = api<void, { settings: PlatformSettingsRecord }>(
  { expose: true, method: "GET", path: "/ops/admin/settings", auth: true },
  async () => {
    requireRole("admin", "support");
    const row = await opsDB.queryRow<PlatformSettingsRow>`
      SELECT * FROM platform_settings
      WHERE id = 'global'
    `;

    if (!row) {
      throw new Error("Platform settings not initialized.");
    }

    return { settings: mapPlatformSettings(row) };
  },
);

export const updatePlatformSettings = api<UpdatePlatformSettingsParams, { settings: PlatformSettingsRecord }>(
  { expose: true, method: "PUT", path: "/ops/admin/settings", auth: true },
  async (settings) => {
    requireRole("admin", "support");
    const existing = await opsDB.queryRow<PlatformSettingsRow>`
      SELECT * FROM platform_settings
      WHERE id = 'global'
    `;

    if (!existing) {
      throw new Error("Platform settings not initialized.");
    }

    const updated: PlatformSettingsRecord = {
      ...mapPlatformSettings(existing),
      ...settings,
      id: "global",
      updatedAt: new Date().toISOString(),
    };

    await opsDB.exec`
      UPDATE platform_settings
      SET referral_reward_amount = ${updated.referralRewardAmount},
          commission_rate = ${updated.commissionRate},
          min_withdrawal_amount = ${updated.minWithdrawalAmount},
          platform_name = ${updated.platformName},
          support_email = ${updated.supportEmail},
          cancellation_policy_days = ${updated.cancellationPolicyDays},
          max_guests_per_listing = ${updated.maxGuestsPerListing},
          enable_reviews = ${updated.enableReviews},
          enable_referrals = ${updated.enableReferrals},
          maintenance_mode = ${updated.maintenanceMode},
          updated_at = ${updated.updatedAt}
      WHERE id = 'global'
    `;

    return { settings: updated };
  },
);
