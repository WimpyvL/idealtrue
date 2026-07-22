// ( |╲ ) Author: Klaasvaakie
import { api, APIError } from "encore.dev/api";
import { Counter, Gauge, GaugeGroup } from "encore.dev/metrics";
import { randomUUID } from "node:crypto";
import { analyticsDB } from "../analytics/db";
import { billingDB } from "../billing/db";
import { bookingDB } from "../booking/db";
import { catalogDB } from "../catalog/db";
import { identityDB } from "../identity/db";
import { messagingDB } from "../messaging/db";
import { notifyKycReviewed } from "./notifications";
import { opsDB } from "./db";
import { referralsDB } from "../referrals/db";
import { reviewsDB } from "../reviews/db";
import { kycDocumentsBucket } from "./storage";
import { decryptSensitiveString, encryptSensitiveString, maskSensitiveString } from "./kyc-crypto";
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
  actionPath?: string | null;
  readAt?: string | null;
  createdAt: string;
}

interface PlatformSettingsRecord {
  id: "global";
  referralRewardAmount: number;
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

interface DatabaseObservabilityRecord {
  name: string;
  healthy: boolean;
  latencyMs: number;
}

interface ObservabilitySnapshot {
  checkedAt: string;
  backendStartedAt: string;
  uptimeSeconds: number;
  averageDbPingMs: number;
  healthyDatabases: number;
  totalDatabases: number;
  databases: DatabaseObservabilityRecord[];
  encoreCloudTracingAvailable: true;
  encoreCloudMetricsAvailable: true;
  encoreCloudLogsAvailable: true;
}

interface UpdatePlatformSettingsParams {
  referralRewardAmount?: number;
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
  idNumberMasked: string;
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

interface KycHistoryEntry {
  id: string;
  submissionId: string;
  userId: string;
  action: "submitted" | "resubmitted" | "reviewed";
  actorId: string;
  status: "pending" | "verified" | "rejected";
  rejectionReason?: string | null;
  createdAt: string;
}

interface RequestKycUploadParams {
  filename: string;
  contentType: string;
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

type AuditLogRow = {
  id: string;
  actor_id: string;
  action: string;
  target_id: string | null;
  payload: string;
  created_at: string;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  target: string;
  action_path: string | null;
  read_at: string | null;
  created_at: string;
};

type PlatformSettingsRow = {
  id: "global";
  referral_reward_amount: number;
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

const ALLOWED_KYC_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const KYC_HISTORY_ACTIONS = {
  created: "kyc.submission.created",
  resubmitted: "kyc.submission.resubmitted",
  reviewed: "kyc.submission.reviewed",
} as const;

const backendStartedAt = new Date();
export const observabilityChecks = new Counter("admin_observability_checks_total");
export const observabilityFailures = new Counter("admin_observability_check_failures_total");
export const observabilityDbPing = new GaugeGroup<{ database: string }>("admin_observability_db_ping_ms");
export const observabilityDbHealthy = new GaugeGroup<{ database: string }>("admin_observability_db_healthy");
export const observabilityUptime = new Gauge("admin_observability_uptime_seconds");

function mapKycSubmission(row: KycSubmissionRow, options?: { includeSensitiveIdNumber?: boolean }): KycSubmission {
  const decryptedIdNumber = decryptSensitiveString(row.id_number);
  return {
    id: row.id,
    userId: row.user_id,
    idType: row.id_type,
    idNumber: options?.includeSensitiveIdNumber ? decryptedIdNumber : maskSensitiveString(decryptedIdNumber),
    idNumberMasked: maskSensitiveString(decryptedIdNumber),
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
    actionPath: row.action_path,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function mapPlatformSettings(row: PlatformSettingsRow): PlatformSettingsRecord {
  return {
    id: row.id,
    referralRewardAmount: row.referral_reward_amount,
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

function mapAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    targetId: row.target_id,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

function parseAuditPayload(payload: string) {
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapKycHistoryEntry(row: AuditLogRow): KycHistoryEntry | null {
  const payload = parseAuditPayload(row.payload);
  const submissionId = typeof payload.submissionId === "string" ? payload.submissionId : null;
  const userId = typeof payload.userId === "string" ? payload.userId : row.target_id;
  const statusValue = payload.status;
  const status = statusValue === "pending" || statusValue === "verified" || statusValue === "rejected" ? statusValue : null;

  let action: KycHistoryEntry["action"] | null = null;
  if (row.action === KYC_HISTORY_ACTIONS.created) {
    action = "submitted";
  } else if (row.action === KYC_HISTORY_ACTIONS.resubmitted) {
    action = "resubmitted";
  } else if (row.action === KYC_HISTORY_ACTIONS.reviewed) {
    action = "reviewed";
  }

  if (!submissionId || !userId || !status || !action) {
    return null;
  }

  return {
    id: row.id,
    submissionId,
    userId,
    action,
    actorId: row.actor_id,
    status,
    rejectionReason: typeof payload.rejectionReason === "string" ? payload.rejectionReason : null,
    createdAt: row.created_at,
  };
}

function buildNotificationAudience(auth: { userID: string; role: string }) {
  const audience = ["all", auth.userID];

  if (auth.role === "host") {
    audience.push("hosts");
  }
  if (auth.role === "guest") {
    audience.push("guests");
  }
  if (auth.role === "admin" || auth.role === "support") {
    audience.push("admins");
  }

  return audience;
}

async function assertNotificationAccessible(notificationId: string, auth: { userID: string; role: string }) {
  const audience = buildNotificationAudience(auth);
  const notification = await opsDB.queryRow<{ id: string }>`
    SELECT id
    FROM notifications
    WHERE id = ${notificationId}
      AND target = ANY(${audience})
    LIMIT 1
  `;

  if (!notification) {
    throw APIError.notFound("Notification not found.");
  }
}

function sanitizeKycFilename(filename: string) {
  const normalized = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.slice(0, 120) || "kyc-upload.bin";
}

async function assertKycUploadBelongsToUser(userId: string, objectKey: string) {
  if (!objectKey.startsWith(`${userId}/`)) {
    throw APIError.permissionDenied("KYC upload does not belong to this account.");
  }

  try {
    await kycDocumentsBucket.attrs(objectKey);
  } catch {
    throw APIError.failedPrecondition("KYC image upload is missing or incomplete. Upload the image again.");
  }
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
    throw APIError.invalidArgument("Upload payload cannot be empty.");
  }

  return buffer;
}

function validatePlatformSettings(settings: PlatformSettingsRecord) {
  if (!Number.isFinite(settings.referralRewardAmount) || settings.referralRewardAmount < 0) {
    throw APIError.invalidArgument("Referral reward amount must be zero or positive.");
  }
  if (!Number.isFinite(settings.minWithdrawalAmount) || settings.minWithdrawalAmount <= 0) {
    throw APIError.invalidArgument("Minimum withdrawal amount must be positive.");
  }
  if (!settings.platformName.trim()) {
    throw APIError.invalidArgument("Platform name cannot be empty.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.supportEmail.trim())) {
    throw APIError.invalidArgument("Support email must be valid.");
  }
  if (!Number.isInteger(settings.cancellationPolicyDays) || settings.cancellationPolicyDays < 0) {
    throw APIError.invalidArgument("Cancellation policy days must be a whole number of zero or more.");
  }
  if (!Number.isInteger(settings.maxGuestsPerListing) || settings.maxGuestsPerListing < 1) {
    throw APIError.invalidArgument("Maximum guests per listing must be at least one.");
  }
}

async function measureDatabase(
  name: string,
  query: () => Promise<unknown>,
): Promise<DatabaseObservabilityRecord> {
  const startedAt = Date.now();

  try {
    await query();
    const latencyMs = Date.now() - startedAt;
    observabilityDbPing.with({ database: name }).set(latencyMs);
    observabilityDbHealthy.with({ database: name }).set(1);
    return { name, healthy: true, latencyMs };
  } catch {
    const latencyMs = Date.now() - startedAt;
    observabilityDbPing.with({ database: name }).set(latencyMs);
    observabilityDbHealthy.with({ database: name }).set(0);
    return { name, healthy: false, latencyMs };
  }
}

async function appendAuditLog(params: {
  actorId: string;
  action: string;
  targetId?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
}) {
  const id = randomUUID();
  await opsDB.exec`
    INSERT INTO audit_log (id, actor_id, action, target_id, payload, created_at)
    VALUES (
      ${id},
      ${params.actorId},
      ${params.action},
      ${params.targetId ?? null},
      ${JSON.stringify(params.payload ?? {})}::jsonb,
      ${params.createdAt}
    )
  `;
  return id;
}

async function listKycHistoryEntries(userId: string) {
  const rows = await opsDB.rawQueryAll<AuditLogRow>(
    `
      SELECT id, actor_id, action, target_id, payload::text AS payload, created_at
      FROM audit_log
      WHERE target_id = $1
        AND action IN ('kyc.submission.created', 'kyc.submission.resubmitted', 'kyc.submission.reviewed')
      ORDER BY created_at ASC
    `,
    userId,
  );

  return rows
    .map((row) => mapKycHistoryEntry(row))
    .filter((entry): entry is KycHistoryEntry => entry !== null);
}

export const requestKycUpload = api<RequestKycUploadParams, { objectKey: string; uploadUrl: string }>(
  { expose: true, method: "POST", path: "/ops/kyc/upload-url", auth: true },
  async ({ filename, contentType }) => {
    const auth = requireRole("host", "admin");
    if (!ALLOWED_KYC_CONTENT_TYPES.has(contentType)) {
      throw APIError.invalidArgument("Unsupported KYC upload content type.");
    }
    const objectKey = `${auth.userID}/${Date.now()}-${sanitizeKycFilename(filename)}`;
    const signed = await kycDocumentsBucket.signedUploadUrl(objectKey, { ttl: 900 });
    return { objectKey, uploadUrl: signed.url };
  },
);

export const submitKyc = api<{
  idType: "id_card" | "passport" | "drivers_license";
  idNumber: string;
  idImageKey?: string;
  selfieImageKey?: string;
  idImageFilename?: string;
  idImageContentType?: string;
  idImageDataBase64?: string;
  selfieImageFilename?: string;
  selfieImageContentType?: string;
  selfieImageDataBase64?: string;
}, { submission: KycSubmission }>(
  { expose: true, method: "POST", path: "/ops/kyc/submissions", auth: true },
  async (params) => {
    const auth = requireRole("host", "admin");
    const now = new Date().toISOString();
    const encryptedIdNumber = encryptSensitiveString(params.idNumber.trim());
    let idImageKey = params.idImageKey;
    let selfieImageKey = params.selfieImageKey;

    if (!idImageKey) {
      if (!params.idImageFilename || !params.idImageContentType || !params.idImageDataBase64) {
        throw APIError.invalidArgument("Missing ID document upload payload.");
      }
      if (!ALLOWED_KYC_CONTENT_TYPES.has(params.idImageContentType)) {
        throw APIError.invalidArgument("Unsupported ID document content type.");
      }
      const idImageData = decodeBase64Payload(params.idImageDataBase64);
      if (idImageData.byteLength > 7 * 1024 * 1024) {
        throw APIError.invalidArgument("ID document exceeds the 7MB limit.");
      }
      idImageKey = `${auth.userID}/${Date.now()}-${sanitizeKycFilename(params.idImageFilename)}`;
      await kycDocumentsBucket.upload(idImageKey, idImageData, { contentType: params.idImageContentType });
    }

    if (!selfieImageKey) {
      if (!params.selfieImageFilename || !params.selfieImageContentType || !params.selfieImageDataBase64) {
        throw APIError.invalidArgument("Missing selfie upload payload.");
      }
      if (!ALLOWED_KYC_CONTENT_TYPES.has(params.selfieImageContentType)) {
        throw APIError.invalidArgument("Unsupported selfie content type.");
      }
      const selfieImageData = decodeBase64Payload(params.selfieImageDataBase64);
      if (selfieImageData.byteLength > 7 * 1024 * 1024) {
        throw APIError.invalidArgument("Selfie exceeds the 7MB limit.");
      }
      selfieImageKey = `${auth.userID}/${Date.now()}-${sanitizeKycFilename(params.selfieImageFilename)}`;
      await kycDocumentsBucket.upload(selfieImageKey, selfieImageData, { contentType: params.selfieImageContentType });
    }

    if (!idImageKey || !selfieImageKey) {
      throw APIError.invalidArgument("Both KYC images are required.");
    }

    await Promise.all([
      assertKycUploadBelongsToUser(auth.userID, idImageKey),
      assertKycUploadBelongsToUser(auth.userID, selfieImageKey),
    ]);

    const existing = await opsDB.queryRow<KycSubmissionRow>`
      SELECT * FROM kyc_submissions WHERE user_id = ${auth.userID}
    `;

    if (existing) {
      await opsDB.exec`
        UPDATE kyc_submissions
        SET id_type = ${params.idType},
            id_number = ${encryptedIdNumber},
            id_image_key = ${idImageKey},
            selfie_image_key = ${selfieImageKey},
            status = ${"pending"},
            rejection_reason = ${null},
            submitted_at = ${now},
            reviewed_at = ${null},
            reviewer_id = ${null}
        WHERE user_id = ${auth.userID}
      `;

      const submission: KycSubmission = {
        ...mapKycSubmission(existing, { includeSensitiveIdNumber: true }),
        idType: params.idType,
        idNumber: params.idNumber,
        idNumberMasked: maskSensitiveString(params.idNumber.trim()),
        idImageKey,
        selfieImageKey,
        status: "pending",
        rejectionReason: null,
        submittedAt: now,
        reviewedAt: null,
        reviewerId: null,
      };

      await appendAuditLog({
        actorId: auth.userID,
        action: KYC_HISTORY_ACTIONS.resubmitted,
        targetId: auth.userID,
        payload: {
          submissionId: existing.id,
          userId: auth.userID,
          status: submission.status,
          idType: submission.idType,
        },
        createdAt: now,
      });

      return { submission };
    }

    const id = randomUUID();
    await opsDB.exec`
      INSERT INTO kyc_submissions (
        id, user_id, id_type, id_number, id_image_key, selfie_image_key, status, submitted_at
      )
      VALUES (
        ${id}, ${auth.userID}, ${params.idType}, ${encryptedIdNumber}, ${idImageKey}, ${selfieImageKey}, ${"pending"}, ${now}
      )
    `;

    const submission: KycSubmission = {
      id,
      userId: auth.userID,
      idType: params.idType,
      idNumber: params.idNumber,
      idNumberMasked: maskSensitiveString(params.idNumber.trim()),
      idImageKey,
      selfieImageKey,
      status: "pending",
      rejectionReason: null,
      submittedAt: now,
      reviewedAt: null,
      reviewerId: null,
    };

    await appendAuditLog({
      actorId: auth.userID,
      action: KYC_HISTORY_ACTIONS.created,
      targetId: auth.userID,
      payload: {
        submissionId: id,
        userId: auth.userID,
        status: submission.status,
        idType: submission.idType,
      },
      createdAt: now,
    });

    return { submission };
  },
);

export const getMyKycSubmission = api<void, { submission: KycSubmission | null }>(
  { expose: true, method: "GET", path: "/ops/kyc/submissions/me", auth: true },
  async () => {
    const auth = requireAuth();
    const submission = await opsDB.queryRow<KycSubmissionRow>`
      SELECT * FROM kyc_submissions WHERE user_id = ${auth.userID}
    `;
    return { submission: submission ? mapKycSubmission(submission, { includeSensitiveIdNumber: true }) : null };
  },
);

export const getMyKycSubmissionHistory = api<void, { history: KycHistoryEntry[] }>(
  { expose: true, method: "GET", path: "/ops/kyc/submissions/me/history", auth: true },
  async () => {
    const auth = requireAuth();
    return { history: await listKycHistoryEntries(auth.userID) };
  },
);

export const listKycSubmissions = api<void, { submissions: KycSubmission[] }>(
  { expose: true, method: "GET", path: "/ops/kyc/submissions", auth: true },
  async () => {
    requireRole("admin", "support");
    const submissions = await opsDB.rawQueryAll<KycSubmissionRow>(
      `SELECT * FROM kyc_submissions ORDER BY submitted_at DESC`,
    );
    return { submissions: submissions.map((submission) => mapKycSubmission(submission)) };
  },
);

export const getKycSubmissionHistory = api<{ userId: string }, { history: KycHistoryEntry[] }>(
  { expose: true, method: "GET", path: "/ops/kyc/submissions/:userId/history", auth: true },
  async ({ userId }) => {
    requireRole("admin", "support");
    return { history: await listKycHistoryEntries(userId) };
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
      throw APIError.notFound("KYC submission not found.");
    }
    const now = new Date().toISOString();
    const rejectionReason = params.status === "rejected" ? params.rejectionReason ?? "Rejected during review." : null;
    await opsDB.exec`
      UPDATE kyc_submissions
      SET status = ${params.status},
          rejection_reason = ${rejectionReason},
          reviewed_at = ${now},
          reviewer_id = ${auth.userID}
      WHERE user_id = ${params.userId}
    `;

    await appendAuditLog({
      actorId: auth.userID,
      action: KYC_HISTORY_ACTIONS.reviewed,
      targetId: params.userId,
      payload: {
        submissionId: existing.id,
        userId: params.userId,
        status: params.status,
        rejectionReason,
      },
      createdAt: now,
    });

    try {
      await notifyKycReviewed({
        userId: params.userId,
        status: params.status,
        rejectionReason,
      });
    } catch (error) {
      console.error("Failed to notify KYC review outcome:", error);
    }
    return {
      submission: {
        ...mapKycSubmission(existing),
        status: params.status,
        rejectionReason,
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
      throw APIError.notFound("KYC submission not found.");
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
    const logs = await opsDB.rawQueryAll<AuditLogRow>(
      `SELECT id, actor_id, action, target_id, payload::text AS payload, created_at FROM audit_log ORDER BY created_at DESC LIMIT 100`,
    );

    return {
      logs: logs.map((log) => mapAuditLogEntry(log)),
    };
  },
);

export const listAdminNotifications = api<void, { notifications: NotificationRecord[] }>(
  { expose: true, method: "GET", path: "/ops/admin/notifications", auth: true },
  async () => {
    requireRole("admin", "support");
    const notifications = await opsDB.rawQueryAll<NotificationRow>(
      `SELECT id, title, message, type, target, action_path, NULL::TEXT AS read_at, created_at FROM notifications ORDER BY created_at DESC`,
    );
    return { notifications: notifications.map(mapNotification) };
  },
);

export const listMyNotifications = api<void, { notifications: NotificationRecord[] }>(
  { expose: true, method: "GET", path: "/ops/my-notifications", auth: true },
  async () => {
    const auth = requireAuth();
    const audience = buildNotificationAudience(auth);

    const notifications = await opsDB.queryAll<NotificationRow>`
      SELECT
        notifications.id,
        notifications.title,
        notifications.message,
        notifications.type,
        notifications.target,
        notifications.action_path,
        notification_reads.read_at,
        notifications.created_at
      FROM notifications
      LEFT JOIN notification_reads
        ON notification_reads.notification_id = notifications.id
       AND notification_reads.user_id = ${auth.userID}
      LEFT JOIN notification_dismissals
        ON notification_dismissals.notification_id = notifications.id
       AND notification_dismissals.user_id = ${auth.userID}
      WHERE notifications.target = ANY(${audience})
        AND notification_dismissals.notification_id IS NULL
      ORDER BY created_at DESC
    `;

    return { notifications: notifications.map(mapNotification) };
  },
);

export const markNotificationRead = api<{ notificationId: string }, { ok: true; readAt: string }>(
  { expose: true, method: "POST", path: "/ops/my-notifications/read", auth: true },
  async ({ notificationId }) => {
    const auth = requireAuth();
    await assertNotificationAccessible(notificationId, auth);
    const readAt = new Date().toISOString();

    await opsDB.exec`
      INSERT INTO notification_reads (notification_id, user_id, read_at)
      VALUES (${notificationId}, ${auth.userID}, ${readAt})
      ON CONFLICT (notification_id, user_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
    `;

    return { ok: true, readAt };
  },
);

export const markAllNotificationsRead = api<void, { ok: true; readAt: string }>(
  { expose: true, method: "POST", path: "/ops/my-notifications/read-all", auth: true },
  async () => {
    const auth = requireAuth();
    const audience = buildNotificationAudience(auth);

    const readAt = new Date().toISOString();

    await opsDB.exec`
      INSERT INTO notification_reads (notification_id, user_id, read_at)
      SELECT notifications.id, ${auth.userID}, ${readAt}
      FROM notifications
      LEFT JOIN notification_dismissals
        ON notification_dismissals.notification_id = notifications.id
       AND notification_dismissals.user_id = ${auth.userID}
      WHERE notifications.target = ANY(${audience})
        AND notification_dismissals.notification_id IS NULL
      ON CONFLICT (notification_id, user_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
    `;

    return { ok: true, readAt };
  },
);

export const dismissNotification = api<{ notificationId: string }, { ok: true; dismissedAt: string }>(
  { expose: true, method: "DELETE", path: "/ops/my-notifications/:notificationId", auth: true },
  async ({ notificationId }) => {
    const auth = requireAuth();
    await assertNotificationAccessible(notificationId, auth);
    const dismissedAt = new Date().toISOString();

    await opsDB.exec`
      INSERT INTO notification_dismissals (notification_id, user_id, dismissed_at)
      VALUES (${notificationId}, ${auth.userID}, ${dismissedAt})
      ON CONFLICT (notification_id, user_id)
      DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at
    `;

    return { ok: true, dismissedAt };
  },
);

export const getAdminObservability = api<void, { snapshot: ObservabilitySnapshot }>(
  { expose: true, method: "GET", path: "/ops/admin/observability", auth: true },
  async () => {
    requireRole("admin", "support");
    observabilityChecks.increment();

    const checkedAt = new Date();
    const uptimeSeconds = Math.max(0, Math.floor((checkedAt.getTime() - backendStartedAt.getTime()) / 1000));
    observabilityUptime.set(uptimeSeconds);

    const databases = await Promise.all([
      measureDatabase("analytics", () => analyticsDB.queryRow<{ ok: number }>`SELECT 1 AS ok`),
      measureDatabase("billing", () => billingDB.queryRow<{ ok: number }>`SELECT 1 AS ok`),
      measureDatabase("booking", () => bookingDB.queryRow<{ ok: number }>`SELECT 1 AS ok`),
      measureDatabase("catalog", () => catalogDB.queryRow<{ ok: number }>`SELECT 1 AS ok`),
      measureDatabase("identity", () => identityDB.queryRow<{ ok: number }>`SELECT 1 AS ok`),
      measureDatabase("messaging", () => messagingDB.queryRow<{ ok: number }>`SELECT 1 AS ok`),
      measureDatabase("ops", () => opsDB.queryRow<{ ok: number }>`SELECT 1 AS ok`),
      measureDatabase("referrals", () => referralsDB.queryRow<{ ok: number }>`SELECT 1 AS ok`),
      measureDatabase("reviews", () => reviewsDB.queryRow<{ ok: number }>`SELECT 1 AS ok`),
    ]);

    const healthyDatabases = databases.filter((database) => database.healthy).length;
    if (healthyDatabases !== databases.length) {
      observabilityFailures.increment();
    }

    const averageDbPingMs = databases.length
      ? Math.round(databases.reduce((sum, database) => sum + database.latencyMs, 0) / databases.length)
      : 0;

    return {
      snapshot: {
        checkedAt: checkedAt.toISOString(),
        backendStartedAt: backendStartedAt.toISOString(),
        uptimeSeconds,
        averageDbPingMs,
        healthyDatabases,
        totalDatabases: databases.length,
        databases,
        encoreCloudTracingAvailable: true,
        encoreCloudMetricsAvailable: true,
        encoreCloudLogsAvailable: true,
      },
    };
  },
);

export const createAdminNotification = api<{
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  target: string;
  actionPath?: string | null;
}, { notification: NotificationRecord }>(
  { expose: true, method: "POST", path: "/ops/admin/notifications", auth: true },
  async ({ title, message, type, target, actionPath }) => {
    requireRole("admin", "support");
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await opsDB.exec`
      INSERT INTO notifications (id, title, message, type, target, action_path, created_at)
      VALUES (${id}, ${title}, ${message}, ${type}, ${target}, ${actionPath ?? null}, ${createdAt})
    `;
    return {
      notification: {
        id,
        title,
        message,
        type,
        target,
        actionPath: actionPath ?? null,
        createdAt,
      },
    };
  },
);

export const deleteAdminNotification = api<{ notificationId: string }, { deleted: true }>(
  { expose: true, method: "DELETE", path: "/ops/admin/notifications/:notificationId", auth: true },
  async ({ notificationId }) => {
    requireRole("admin", "support");
    const deleted = await opsDB.queryRow<{ id: string }>`
      DELETE FROM notifications
      WHERE id = ${notificationId}
      RETURNING id
    `;
    if (!deleted) {
      throw APIError.notFound("Notification not found.");
    }
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
      throw APIError.failedPrecondition("Platform settings not initialized.");
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
      throw APIError.failedPrecondition("Platform settings not initialized.");
    }

    const updated: PlatformSettingsRecord = {
      ...mapPlatformSettings(existing),
      ...settings,
      id: "global",
      updatedAt: new Date().toISOString(),
    };

    validatePlatformSettings(updated);

    await opsDB.exec`
      UPDATE platform_settings
      SET referral_reward_amount = ${updated.referralRewardAmount},
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
