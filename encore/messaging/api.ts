import { api } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { messagingDB } from "./db";
import { chatAttachmentBucket } from "./storage";
import { APIError } from "encore.dev/api";
import { requireAuth } from "../shared/auth";
import { platformEvents } from "../analytics/events";
import { getBookingById } from "../booking/api";
import { getListing } from "../catalog/api";
import { notifyMessageReceived } from "../ops/notifications";
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
    return { messages: rows.map(mapMessage) };
  },
);

export const sendMessage = api<SendMessageParams, { message: MessageRecord }>(
  { expose: true, method: "POST", path: "/messages", auth: true },
  async (params) => {
    const auth = requireAuth();
    const booking = await requireBookingParticipant(params.bookingId, auth.userID);
    const expectedReceiverId = booking.guestId === auth.userID ? booking.hostId : booking.guestId;
    if (params.receiverId !== expectedReceiverId) {
      throw APIError.failedPrecondition("Messages can only be sent to the other booking participant.");
    }
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
    await requireBookingParticipant(bookingId, auth.userID);
    const objectKey = `${bookingId}/${auth.userID}/${Date.now()}-${filename}`;
    const signed = await chatAttachmentBucket.signedUploadUrl(objectKey, { ttl: 900 });
    return { objectKey, uploadUrl: signed.url };
  },
);
