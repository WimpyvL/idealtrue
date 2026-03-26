import { encoreRequest } from './encore-client';
import type { Message } from '@/types';

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
