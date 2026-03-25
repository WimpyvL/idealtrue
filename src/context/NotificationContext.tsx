import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { User } from 'firebase/auth';

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

export const NotificationProvider = ({ children, user }: { children: React.ReactNode, user: User | null }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  const clearNotifications = () => setNotifications([]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    if (user) {
      newSocket.emit('join', user.uid);
    }

    newSocket.on('notification', (notification) => {
      setNotifications(prev => [...prev, notification]);
      toast.info(notification.message); // Simple toast for now
    });

    return () => {
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
