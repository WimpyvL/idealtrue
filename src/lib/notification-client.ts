import type { Notification } from '@/types';
import { encoreRequest } from './encore-client';
import { mapEncoreNotification, type EncoreNotification } from './domain-mappers';

export async function listMyNotifications() {
  try {
    const response = await encoreRequest<{ notifications: EncoreNotification[] }>(
      '/ops/my-notifications',
      {},
      { auth: true },
    );

    return response.notifications.map(mapEncoreNotification);
  } catch (error) {
    if (error instanceof Error && error.message.includes('"code":"not_found"')) {
      return [];
    }
    throw error;
  }
}

export async function markNotificationRead(notificationId: string) {
  return encoreRequest<{ ok: true; readAt: string }>(
    '/ops/my-notifications/read',
    {
      method: 'POST',
      body: JSON.stringify({ notificationId }),
    },
    { auth: true },
  );
}

export async function markAllNotificationsRead() {
  return encoreRequest<{ ok: true; readAt: string }>(
    '/ops/my-notifications/read-all',
    {
      method: 'POST',
    },
    { auth: true },
  );
}

export async function dismissNotification(notificationId: string) {
  return encoreRequest<{ ok: true; dismissedAt: string }>(
    `/ops/my-notifications/${encodeURIComponent(notificationId)}`,
    {
      method: 'DELETE',
    },
    { auth: true },
  );
}
