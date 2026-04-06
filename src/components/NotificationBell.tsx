import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Info, MessageSquare, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Notification } from '@/types';
import { cn } from '@/lib/utils';

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'success':
      return <ShieldCheck className="w-4 h-4 text-green-600" />;
    case 'warning':
      return <TriangleAlert className="w-4 h-4 text-yellow-600" />;
    case 'error':
      return <Info className="w-4 h-4 text-red-600" />;
    default:
      return <MessageSquare className="w-4 h-4 text-primary" />;
  }
}

function resolveNotificationPath(notification: Notification, role: string | undefined) {
  if (notification.actionPath) {
    return notification.actionPath;
  }

  if (notification.title === 'New message') {
    return role === 'host' ? '/host/inbox' : '/guest';
  }

  if (notification.target !== 'all' && notification.target !== 'hosts' && notification.target !== 'guests' && notification.target !== 'admins') {
    return '/account';
  }

  if (notification.target === 'hosts' || role === 'host') {
    return '/host';
  }

  if (notification.target === 'guests' || role === 'guest') {
    return '/guest';
  }

  if (notification.target === 'admins' || role === 'admin') {
    return '/admin';
  }

  return null;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const { notifications, unreadCount, isNotificationRead, dismissNotification, markNotificationRead, markAllNotificationsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const sortedNotifications = useMemo(
    () => [...notifications].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [notifications],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    markNotificationRead(notification.id);
    setIsOpen(false);

    const nextPath = resolveNotificationPath(notification, profile?.role);
    if (nextPath) {
      navigate(nextPath);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((current) => !current)}
        className="relative p-2 hover:bg-surface-container-high rounded-full transition-colors group"
        aria-label="Open notifications"
      >
        <Bell className={cn('w-5 h-5 transition-transform group-hover:scale-110', isOpen ? 'text-primary' : 'text-on-surface-variant')} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-error rounded-full ring-2 ring-surface" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
              <div>
                <h3 className="font-bold text-sm">Notifications</h3>
                <p className="text-xs text-on-surface-variant">
                  {unreadCount > 0 ? `${unreadCount} new` : 'All caught up'}
                </p>
              </div>
              {notifications.length > 0 && unreadCount > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="text-[10px] uppercase tracking-wider font-bold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {sortedNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-outline-variant mx-auto mb-2 opacity-20" />
                  <p className="text-xs text-on-surface-variant">No notifications yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant">
                  {sortedNotifications.map((notification) => {
                    const isUnread = !isNotificationRead(notification.id);

                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          'flex items-start gap-2 p-2 transition-colors',
                          isUnread ? 'bg-primary/5' : 'bg-transparent',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(notification)}
                          className="flex-1 rounded-xl p-2 text-left hover:bg-surface-container-low"
                        >
                          <div className="flex gap-3">
                            <div className="mt-1 shrink-0">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-on-surface leading-tight">
                                    {notification.title}
                                  </p>
                                  <p className="text-sm text-on-surface-variant mt-1 leading-snug">
                                    {notification.message}
                                  </p>
                                </div>
                                {isUnread && <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />}
                              </div>
                              <div className="flex items-center justify-between gap-3 mt-2">
                                <p className="text-[11px] text-outline-variant font-medium">
                                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                </p>
                                {resolveNotificationPath(notification, profile?.role) && (
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-primary">
                                    Open
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => void dismissNotification(notification.id)}
                          className="mt-2 rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                          aria-label={`Dismiss notification ${notification.title}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
