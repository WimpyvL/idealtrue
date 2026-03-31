import type { Notification } from '@/types';
import { encoreRequest } from './encore-client';

interface EncoreNotification {
  id: string;
  title: string;
  message: string;
  type: Notification['type'];
  target: string;
  actionPath?: string | null;
  createdAt: string;
}

function mapNotification(notification: EncoreNotification): Notification {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    target: notification.target,
    actionPath: notification.actionPath || null,
    createdAt: notification.createdAt,
  };
}

export async function listMyNotifications() {
  const response = await encoreRequest<{ notifications: EncoreNotification[] }>(
    '/ops/notifications',
    {},
    { auth: true },
  );

  return response.notifications.map(mapNotification);
}
