import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { AuthSessionUser } from '@/contexts/AuthContext';
import type { Notification } from '@/types';
import { listMyNotifications } from '@/lib/notification-client';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isNotificationRead: (notificationId: string) => boolean;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  isNotificationRead: () => false,
  markNotificationRead: () => {},
  markAllNotificationsRead: () => {},
});

function getReadStorageKey(userId: string) {
  return `idealstay.notifications.read.${userId}`;
}

function getReadIds(userId: string) {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }

  try {
    const raw = window.localStorage.getItem(getReadStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function persistReadIds(userId: string, readIds: Set<string>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getReadStorageKey(userId), JSON.stringify(Array.from(readIds)));
}

function normalizeNotification(notification: Notification) {
  return {
    ...notification,
    actionPath: notification.actionPath || null,
  };
}

function mergeNotifications(existing: Notification[], incoming: Notification[]) {
  const merged = new Map<string, Notification>();

  for (const notification of existing) {
    merged.set(notification.id, normalizeNotification(notification));
  }

  for (const notification of incoming) {
    merged.set(notification.id, normalizeNotification(notification));
  }

  return Array.from(merged.values()).sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export const NotificationProvider = ({ children, user }: { children: React.ReactNode; user: AuthSessionUser | null }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setReadIds(new Set());
      return;
    }

    setReadIds(getReadIds(user.uid));
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
              toast.info(notification.message);
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

  useEffect(() => {
    if (!user) {
      return;
    }

    persistReadIds(user.uid, readIds);
  }, [readIds, user]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !readIds.has(notification.id)).length,
    [notifications, readIds],
  );

  const markNotificationRead = (notificationId: string) => {
    setReadIds((current) => {
      const next = new Set(current);
      next.add(notificationId);
      return next;
    });
  };

  const markAllNotificationsRead = () => {
    setReadIds(new Set(notifications.map((notification) => notification.id)));
  };

  const isNotificationRead = (notificationId: string) => readIds.has(notificationId);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isNotificationRead,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
