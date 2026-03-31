import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import type { AuthSessionUser } from '@/contexts/AuthContext';
import type { Notification } from '@/types';
import { getEncoreSessionToken } from '@/lib/encore-client';
import { listMyNotifications } from '@/lib/notification-client';

interface SocketNotificationPayload {
  id?: string;
  title?: string;
  message: string;
  type?: string;
  createdAt?: string;
  actionPath?: string | null;
  data?: Record<string, unknown>;
}

interface NotificationContextType {
  socket: Socket | null;
  notifications: Notification[];
  unreadCount: number;
  isNotificationRead: (notificationId: string) => boolean;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  socket: null,
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

function normalizeSocketNotification(notification: SocketNotificationPayload): Notification {
  return {
    id: notification.id || `socket-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    title: notification.title || 'New activity',
    message: notification.message,
    type: notification.type === 'warning' || notification.type === 'success' || notification.type === 'error' ? notification.type : 'info',
    target: 'session',
    actionPath: typeof notification.actionPath === 'string' ? notification.actionPath : null,
    createdAt: notification.createdAt || new Date().toISOString(),
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
  const [socket, setSocket] = useState<Socket | null>(null);
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

    listMyNotifications()
      .then((fetchedNotifications) => {
        if (cancelled) {
          return;
        }
        setNotifications((current) => mergeNotifications(current, fetchedNotifications));
      })
      .catch((error) => {
        console.error('Failed to load notifications:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    persistReadIds(user.uid, readIds);
  }, [readIds, user]);

  useEffect(() => {
    const token = getEncoreSessionToken();
    const env = (import.meta as any).env ?? {};
    const explicitSocketUrl = typeof env.VITE_SOCKET_SERVER_URL === 'string' ? env.VITE_SOCKET_SERVER_URL.trim() : '';
    const allowImplicitLocalSocket = !!env.DEV;
    const socketUrl = explicitSocketUrl || (allowImplicitLocalSocket ? window.location.origin : '');

    if (!user || !token || !socketUrl) {
      setSocket(null);
      return;
    }

    const newSocket = io(socketUrl, {
      auth: {
        token,
      },
    });

    newSocket.on('notification', (notification: SocketNotificationPayload) => {
      const normalized = normalizeSocketNotification(notification);
      setNotifications((current) => mergeNotifications(current, [normalized]));
      toast.info(normalized.message);
    });

    newSocket.on('connect', () => {
      setSocket(newSocket);
    });

    newSocket.on('connect_error', (error) => {
      console.error(`Socket connection failed for ${socketUrl}:`, error);
    });

    return () => {
      setSocket(null);
      newSocket.disconnect();
    };
  }, [user]);

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
        socket,
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
