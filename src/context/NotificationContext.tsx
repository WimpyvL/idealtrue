import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { AuthSessionUser } from '@/contexts/AuthContext';
import type { Notification } from '@/types';
import {
  dismissNotification as persistDismissNotification,
  listMyNotifications,
  markAllNotificationsRead as persistMarkAllNotificationsRead,
  markNotificationRead as persistMarkNotificationRead,
} from '@/lib/notification-client';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isNotificationRead: (notificationId: string) => boolean;
  dismissNotification: (notificationId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  isNotificationRead: () => false,
  dismissNotification: async () => {},
  markNotificationRead: async () => {},
  markAllNotificationsRead: async () => {},
});

function normalizeNotification(notification: Notification) {
  return {
    ...notification,
    actionPath: notification.actionPath || null,
    readAt: notification.readAt || null,
  };
}

function mergeNotifications(existing: Notification[], incoming: Notification[]) {
  const merged = new Map<string, Notification>();

  for (const notification of existing) {
    merged.set(notification.id, normalizeNotification(notification));
  }

  for (const notification of incoming) {
    const current = merged.get(notification.id);
    const next = normalizeNotification(notification);

    if (current?.readAt && !next.readAt) {
      next.readAt = current.readAt;
    }

    merged.set(notification.id, next);
  }

  return Array.from(merged.values()).sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function notifyForNotification(notification: Notification) {
  const message = notification.message;

  switch (notification.type) {
    case 'success':
      toast.success(message);
      break;
    case 'warning':
      toast.warning(message);
      break;
    case 'error':
      toast.error(message);
      break;
    default:
      toast.info(message);
      break;
  }
}

export const NotificationProvider = ({ children, user }: { children: React.ReactNode; user: AuthSessionUser | null }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    let cancelled = false;

    const refreshNotifications = async (showToastForNew = false) => {
      try {
        const fetchedNotifications = await listMyNotifications();
        if (cancelled) {
          return;
        }

        setNotifications((current) => {
          if (!showToastForNew) {
            return mergeNotifications(current, fetchedNotifications);
          }

          const existingIds = new Set(current.map((notification) => notification.id));
          for (const notification of fetchedNotifications) {
            if (!existingIds.has(notification.id)) {
              notifyForNotification(notification);
            }
          }

          return mergeNotifications(current, fetchedNotifications);
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('"code":"not_found"')) {
          return;
        }
        console.error('Failed to load notifications:', error);
      }
    };

    void refreshNotifications(false);
    const interval = window.setInterval(() => {
      void refreshNotifications(true);
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  const markNotificationRead = async (notificationId: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId && !notification.readAt
          ? { ...notification, readAt: new Date().toISOString() }
          : notification,
      ),
    );

    try {
      const response = await persistMarkNotificationRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, readAt: response.readAt } : notification,
        ),
      );
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  };

  const dismissNotification = async (notificationId: string) => {
    const existing = notifications.find((notification) => notification.id === notificationId) ?? null;
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));

    try {
      await persistDismissNotification(notificationId);
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
      if (existing) {
        setNotifications((current) => mergeNotifications(current, [existing]));
      }
    }
  };

  const markAllNotificationsRead = async () => {
    const optimisticReadAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, readAt: notification.readAt || optimisticReadAt })),
    );

    try {
      const response = await persistMarkAllNotificationsRead();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, readAt: notification.readAt || response.readAt })),
      );
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  };

  const isNotificationRead = (notificationId: string) =>
    notifications.some((notification) => notification.id === notificationId && Boolean(notification.readAt));

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isNotificationRead,
        dismissNotification,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
