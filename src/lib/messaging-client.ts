import { encoreRequest } from './encore-client';
import { uploadToSignedUrl } from './media-client';
import type { HostQuickReplySettings, Message } from '@/types';

interface EncoreMessage {
  id: string;
  bookingId: string;
  senderId: string;
  receiverId: string;
  text: string;
  isSystem?: boolean;
  suggestionType?: Message['suggestionType'] | null;
  attachmentUrl?: string | null;
  createdAt: string;
}

function mapMessage(message: EncoreMessage): Message {
  return {
    id: message.id,
    bookingId: message.bookingId,
    senderId: message.senderId,
    receiverId: message.receiverId,
    text: message.text,
    isSystem: message.isSystem,
    suggestionType: message.suggestionType || undefined,
    attachmentUrl: message.attachmentUrl || undefined,
    createdAt: message.createdAt,
  };
}

export async function listMessages(bookingId: string) {
  const response = await encoreRequest<{ messages: EncoreMessage[] }>(`/messages/${bookingId}`, {}, { auth: true });
  return response.messages.map(mapMessage);
}

export async function sendMessage(params: {
  bookingId: string;
  receiverId: string;
  text: string;
  isSystem?: boolean;
  suggestionType?: Message['suggestionType'];
  attachmentUrl?: string | null;
}) {
  const response = await encoreRequest<{ message: EncoreMessage }>(
    '/messages',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );

  return mapMessage(response.message);
}

export async function uploadMessageAttachment(params: { bookingId: string; file: File }) {
  const signed = await encoreRequest<{ objectKey: string; uploadUrl: string }>(
    '/messages/attachments/upload-url',
    {
      method: 'POST',
      body: JSON.stringify({
        bookingId: params.bookingId,
        filename: params.file.name,
        contentType: params.file.type || 'application/octet-stream',
        fileSize: params.file.size,
      }),
    },
    { auth: true },
  );

  await uploadToSignedUrl(signed.uploadUrl, params.file);
  return signed.objectKey;
}

function normalizeQuickReply(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getMyHostQuickReplies(): Promise<HostQuickReplySettings> {
  const response = await encoreRequest<{ quickReplies: HostQuickReplySettings }>(
    '/messages/quick-replies/me',
    {},
    { auth: true },
  );

  return response.quickReplies;
}

export async function saveMyHostQuickReplies(params: HostQuickReplySettings): Promise<HostQuickReplySettings> {
  const response = await encoreRequest<{ quickReplies: HostQuickReplySettings }>(
    '/messages/quick-replies/me',
    {
      method: 'PUT',
      body: JSON.stringify({
        checkin: normalizeQuickReply(params.checkin),
        checkout: normalizeQuickReply(params.checkout),
        paymentInfo: normalizeQuickReply(params.paymentInfo),
        directions: normalizeQuickReply(params.directions),
        houseRules: normalizeQuickReply(params.houseRules),
      }),
    },
    { auth: true },
  );

  return response.quickReplies;
}
