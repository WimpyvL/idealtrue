import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import type { AuthSessionUser } from '@/contexts/AuthContext';
import { getEncoreSessionToken } from '@/lib/encore-client';

interface NotificationContextType {
  socket: Socket | null;
  notifications: any[];
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType>({ 
  socket: null, 
  notifications: [],
  clearNotifications: () => {}
});

export const NotificationProvider = ({ children, user }: { children: React.ReactNode, user: AuthSessionUser | null }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  const clearNotifications = () => setNotifications([]);

  useEffect(() => {
    const token = getEncoreSessionToken();
    if (!user || !token) {
      setSocket(null);
      return;
    }

    const newSocket = io({
      auth: {
        token,
      },
    });

    newSocket.on('notification', (notification) => {
      setNotifications(prev => [...prev, notification]);
      toast.info(notification.message); // Simple toast for now
    });

    newSocket.on('connect', () => {
      setSocket(newSocket);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection failed:', error);
    });

    return () => {
      setSocket(null);
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <NotificationContext.Provider value={{ socket, notifications, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
