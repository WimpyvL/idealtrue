import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { messagingDB } from "./db";
import { chatAttachmentBucket } from "./storage";
import { requireAuth, requireRole } from "../shared/auth";
import { platformEvents } from "../analytics/events";
import { getBookingById, recordHostInquiryResponseFromMessage } from "../booking/api";
import { getListing } from "../catalog/api";
import { notifyMessageReceived } from "../ops/notifications";
import type { HostQuickReplySettingsRecord, MessageRecord, MessageSuggestionType } from "../shared/domain";

type MessageRow = {
  id: string;
  booking_id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  is_system: boolean;
  suggestion_type: MessageSuggestionType | null;
  attachment_url: string | null;
  created_at: string;
};

type HostQuickReplyRow = {
  host_id: string;
  checkin: string | null;
  checkout: string | null;
  payment_info: string | null;
  directions: string | null;
  house_rules: string | null;
  updated_at: string;
};

interface SendMessageParams {
  bookingId: string;
  receiverId: string;
  text: string;
  isSystem?: boolean;
  suggestionType?: MessageSuggestionType | null;
  attachmentUrl?: string | null;
}

interface SaveHostQuickRepliesParams {
  checkin?: string | null;
  checkout?: string | null;
  paymentInfo?: string | null;
  directions?: string | null;
  houseRules?: string | null;
}

interface RequestAttachmentUploadParams {
  bookingId: string;
  filename: string;
  contentType?: string | null;
  fileSize?: number | null;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function sanitizeAttachmentFilename(filename: string) {
  const normalized = filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.slice(0, 120) || "chat-attachment.bin";
}

async function resolveAttachmentUrl(attachmentRef: string | null) {
  if (!attachmentRef) {
    return null;
  }
  if (isHttpUrl(attachmentRef)) {
    return attachmentRef;
  }

  const signed = await chatAttachmentBucket.signedDownloadUrl(attachmentRef, { ttl: 900 });
  return signed.url;
}

async function mapMessageForRead(row: MessageRow): Promise<MessageRecord> {
  let attachmentUrl: string | null;

  try {
    attachmentUrl = await resolveAttachmentUrl(row.attachment_url);
  } catch {
    attachmentUrl = null;
  }

  return {
    id: row.id,
    bookingId: row.booking_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    text: row.text,
    isSystem: row.is_system,
    suggestionType: row.suggestion_type,
    attachmentUrl,
    createdAt: row.created_at,
  };
}

function normalizeQuickReply(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 2000) : null;
}

function emptyHostQuickReplies(updatedAt: string | null = null): HostQuickReplySettingsRecord {
  return {
    checkin: null,
    checkout: null,
    paymentInfo: null,
    directions: null,
    houseRules: null,
    updatedAt,
  };
}

function mapHostQuickReplies(row: HostQuickReplyRow | null): HostQuickReplySettingsRecord {
  if (!row) {
    return emptyHostQuickReplies();
  }

  return {
    checkin: row.checkin,
    checkout: row.checkout,
    paymentInfo: row.payment_info,
    directions: row.directions,
    houseRules: row.house_rules,
    updatedAt: row.updated_at,
  };
}

async function requireBookingParticipant(bookingId: string, userId: string) {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw APIError.notFound("Booking not found.");
  }
  if (booking.guestId !== userId && booking.hostId !== userId) {
    throw APIError.permissionDenied("You are not part of this booking conversation.");
  }
  return booking;
}

async function assertAttachmentBelongsToSender(bookingId: string, userId: string, attachmentRef: string | null | undefined) {
  if (!attachmentRef || isHttpUrl(attachmentRef)) {
    return;
  }

  if (!attachmentRef.startsWith(`${bookingId}/${userId}/`)) {
    throw APIError.permissionDenied("Attachment does not belong to this booking conversation.");
  }

  try {
    await chatAttachmentBucket.attrs(attachmentRef);
  } catch {
    throw APIError.failedPrecondition("Attachment upload is missing or incomplete. Upload the file again.");
  }
}

export const listMessages = api<{ bookingId: string }, { messages: MessageRecord[] }>(
  { expose: true, method: "GET", path: "/messages/:bookingId", auth: true },
  async ({ bookingId }) => {
    const auth = requireAuth();
    await requireBookingParticipant(bookingId, auth.userID);
    const rows = await messagingDB.queryAll<MessageRow>`
      SELECT * FROM messages
      WHERE booking_id = ${bookingId}
      ORDER BY created_at ASC
    `;
    return { messages: await Promise.all(rows.map(mapMessageForRead)) };
  },
);

export const sendMessage = api<SendMessageParams, { message: MessageRecord }>(
  { expose: true, method: "POST", path: "/messages", auth: true },
  async (params) => {
    const auth = requireAuth();
    const booking = await requireBookingParticipant(params.bookingId, auth.userID);
    if (params.isSystem) {
      throw APIError.permissionDenied("System messages cannot be sent through the public messaging endpoint.");
    }
    const expectedReceiverId = booking.guestId === auth.userID ? booking.hostId : booking.guestId;
    if (params.receiverId !== expectedReceiverId) {
      throw APIError.failedPrecondition("Messages can only be sent to the other booking participant.");
    }

    const text = params.text.trim();
    const attachmentRef = params.attachmentUrl?.trim() || null;
    if (!text && !attachmentRef) {
      throw APIError.invalidArgument("Message text or attachment is required.");
    }

    await assertAttachmentBelongsToSender(params.bookingId, auth.userID, attachmentRef);

    const id = randomUUID();
    const now = new Date().toISOString();

    await messagingDB.exec`
      INSERT INTO messages (id, booking_id, sender_id, receiver_id, text, is_system, suggestion_type, attachment_url, created_at)
      VALUES (${id}, ${params.bookingId}, ${auth.userID}, ${params.receiverId}, ${text}, ${false}, ${params.suggestionType ?? null}, ${attachmentRef}, ${now})
    `;

    if (auth.userID === booking.hostId) {
      await recordHostInquiryResponseFromMessage(params.bookingId, auth.userID);
    }

    await platformEvents.publish({
      type: "message.sent",
      aggregateId: id,
      actorId: auth.userID,
      occurredAt: now,
      payload: JSON.stringify({
        bookingId: params.bookingId,
        receiverId: params.receiverId,
      }),
    });

    try {
      const { listing } = await getListing({ id: booking.listingId });
      await notifyMessageReceived({
        receiverId: params.receiverId,
        listingTitle: listing.title,
        actionPath: params.receiverId === booking.hostId ? "/host/inbox" : "/guest",
      });
    } catch (error) {
      console.error("Failed to create message notification:", error);
    }

    return {
      message: {
        id,
        bookingId: params.bookingId,
        senderId: auth.userID,
        receiverId: params.receiverId,
        text,
        isSystem: false,
        suggestionType: params.suggestionType ?? null,
        attachmentUrl: await resolveAttachmentUrl(attachmentRef),
        createdAt: now,
      },
    };
  },
);

export const getMyHostQuickReplies = api<void, { quickReplies: HostQuickReplySettingsRecord }>(
  { expose: true, method: "GET", path: "/messages/quick-replies/me", auth: true },
  async () => {
    const auth = requireRole("host");
    const row = await messagingDB.queryRow<HostQuickReplyRow>`
      SELECT * FROM host_message_quick_replies
      WHERE host_id = ${auth.userID}
    `;

    return { quickReplies: mapHostQuickReplies(row) };
  },
);

export const saveMyHostQuickReplies = api<SaveHostQuickRepliesParams, { quickReplies: HostQuickReplySettingsRecord }>(
  { expose: true, method: "PUT", path: "/messages/quick-replies/me", auth: true },
  async (params) => {
    const auth = requireRole("host");
    const now = new Date().toISOString();
    const checkin = normalizeQuickReply(params.checkin);
    const checkout = normalizeQuickReply(params.checkout);
    const paymentInfo = normalizeQuickReply(params.paymentInfo);
    const directions = normalizeQuickReply(params.directions);
    const houseRules = normalizeQuickReply(params.houseRules);

    const row = await messagingDB.queryRow<HostQuickReplyRow>`
      INSERT INTO host_message_quick_replies (
        host_id, checkin, checkout, payment_info, directions, house_rules, updated_at
      )
      VALUES (
        ${auth.userID}, ${checkin}, ${checkout}, ${paymentInfo}, ${directions}, ${houseRules}, ${now}
      )
      ON CONFLICT (host_id) DO UPDATE SET
        checkin = EXCLUDED.checkin,
        checkout = EXCLUDED.checkout,
        payment_info = EXCLUDED.payment_info,
        directions = EXCLUDED.directions,
        house_rules = EXCLUDED.house_rules,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    return { quickReplies: mapHostQuickReplies(row) };
  },
);

export const requestAttachmentUpload = api<RequestAttachmentUploadParams, { objectKey: string; uploadUrl: string }>(
  { expose: true, method: "POST", path: "/messages/attachments/upload-url", auth: true },
  async ({ bookingId, filename, contentType, fileSize }) => {
    const auth = requireAuth();
    await requireBookingParticipant(bookingId, auth.userID);

    if (contentType && !ALLOWED_ATTACHMENT_CONTENT_TYPES.has(contentType)) {
      throw APIError.invalidArgument("Unsupported attachment content type.");
    }
    if (typeof fileSize === "number" && (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_ATTACHMENT_BYTES)) {
      throw APIError.invalidArgument("Attachment must be between 1 byte and 10MB.");
    }

    const objectKey = `${bookingId}/${auth.userID}/${Date.now()}-${sanitizeAttachmentFilename(filename)}`;
    const signed = await chatAttachmentBucket.signedUploadUrl(objectKey, { ttl: 900 });
    return { objectKey, uploadUrl: signed.url };
  },
);
