import React, { useState, useRef, useEffect } from 'react';
import { Bell, MessageSquare, Calendar, Info, X, Trash2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell() {
  const { notifications, clearNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'chat_message': return <MessageSquare className="w-4 h-4 text-primary" />;
      case 'booking_request': return <Calendar className="w-4 h-4 text-secondary" />;
      case 'booking_update': return <Info className="w-4 h-4 text-tertiary" />;
      default: return <Bell className="w-4 h-4 text-outline" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-surface-container-high rounded-full transition-colors group"
      >
        <Bell className={cn("w-5 h-5 transition-transform group-hover:scale-110", isOpen ? "text-primary" : "text-on-surface-variant")} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-error text-on-error text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-surface">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="font-bold text-sm">Notifications</h3>
              {notifications.length > 0 && (
                <button 
                  onClick={clearNotifications}
                  className="text-[10px] uppercase tracking-wider font-bold text-error hover:text-error-container flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-outline-variant mx-auto mb-2 opacity-20" />
                  <p className="text-xs text-on-surface-variant">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant">
                  {notifications.map((notif, idx) => (
                    <div key={idx} className="p-4 hover:bg-surface-container-low transition-colors cursor-pointer group">
                      <div className="flex gap-3">
                        <div className="mt-1 shrink-0">
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-on-surface leading-tight">
                            {notif.message}
                          </p>
                          {notif.data?.text && (
                            <p className="text-xs text-on-surface-variant mt-1 line-clamp-2 italic">
                              "{notif.data.text}"
                            </p>
                          )}
                          <p className="text-[10px] text-outline-variant mt-1 font-medium">
                            Just now
                          </p>
                        </div>
                      </div>
                    </div>
                  )).reverse()}
                </div>
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="p-3 bg-surface-container-low border-t border-outline-variant text-center">
                <button className="text-[10px] uppercase tracking-widest font-bold text-primary hover:underline">
                  View All Notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
