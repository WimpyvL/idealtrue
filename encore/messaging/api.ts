import { api } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { messagingDB } from "./db";
import { chatAttachmentBucket } from "./storage";
import { requireAuth } from "../shared/auth";
import { platformEvents } from "../analytics/events";
import type { MessageRecord } from "../shared/domain";

type MessageRow = {
  id: string;
  booking_id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  is_system: boolean;
  suggestion_type: "checkin" | "checkout" | "payment_info" | "directions" | "house_rules" | null;
  attachment_url: string | null;
  created_at: string;
};

interface SendMessageParams {
  bookingId: string;
  receiverId: string;
  text: string;
  isSystem?: boolean;
  suggestionType?: "checkin" | "checkout" | "payment_info" | "directions" | "house_rules" | null;
  attachmentUrl?: string | null;
}

function mapMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    bookingId: row.booking_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    text: row.text,
    isSystem: row.is_system,
    suggestionType: row.suggestion_type,
    attachmentUrl: row.attachment_url,
    createdAt: row.created_at,
  };
}

export const listMessages = api<{ bookingId: string }, { messages: MessageRecord[] }>(
  { expose: true, method: "GET", path: "/messages/:bookingId", auth: true },
  async ({ bookingId }) => {
    const auth = requireAuth();
    const rows = await messagingDB.queryAll<MessageRow>`
      SELECT * FROM messages
      WHERE booking_id = ${bookingId}
        AND (sender_id = ${auth.userID} OR receiver_id = ${auth.userID})
      ORDER BY created_at ASC
    `;
    return { messages: rows.map(mapMessage) };
  },
);

export const sendMessage = api<SendMessageParams, { message: MessageRecord }>(
  { expose: true, method: "POST", path: "/messages", auth: true },
  async (params) => {
    const auth = requireAuth();
    const id = randomUUID();
    const now = new Date().toISOString();

    await messagingDB.exec`
      INSERT INTO messages (id, booking_id, sender_id, receiver_id, text, is_system, suggestion_type, attachment_url, created_at)
      VALUES (${id}, ${params.bookingId}, ${auth.userID}, ${params.receiverId}, ${params.text}, ${params.isSystem ?? false}, ${params.suggestionType ?? null}, ${params.attachmentUrl ?? null}, ${now})
    `;

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

    return {
      message: {
        id,
        bookingId: params.bookingId,
        senderId: auth.userID,
        receiverId: params.receiverId,
        text: params.text,
        isSystem: params.isSystem ?? false,
        suggestionType: params.suggestionType ?? null,
        attachmentUrl: params.attachmentUrl ?? null,
        createdAt: now,
      },
    };
  },
);

export const requestAttachmentUpload = api<{ bookingId: string; filename: string }, { objectKey: string; uploadUrl: string }>(
  { expose: true, method: "POST", path: "/messages/attachments/upload-url", auth: true },
  async ({ bookingId, filename }) => {
    const auth = requireAuth();
    const objectKey = `${bookingId}/${auth.userID}/${Date.now()}-${filename}`;
    const signed = await chatAttachmentBucket.signedUploadUrl(objectKey, { ttl: 900 });
    return { objectKey, uploadUrl: signed.url };
  },
);
