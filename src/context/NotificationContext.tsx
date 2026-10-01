import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { playChime } from '../utils/audio';

export type NotificationType = 'pending' | 'success' | 'error' | 'info';

export interface NotificationFileMeta {
  name: string;
  size?: number;
  mime?: string;
  category?: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  fileMeta?: NotificationFileMeta;
  progress?: number; // 0 - 100
  speed?: number; // bytes/sec
  createdAt: number;
  duration?: number; // ms to auto dismiss (default 4500ms, or 0 / undefined for manual)
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ShowNotificationOptions {
  type: NotificationType;
  title: string;
  message?: string;
  fileMeta?: NotificationFileMeta;
  progress?: number;
  speed?: number;
  duration?: number;
  sound?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: NotificationItem[];
  notify: (opts: ShowNotificationOptions) => string;
  notifyPending: (title: string, message?: string, fileMeta?: NotificationFileMeta, progress?: number, speed?: number) => string;
  notifySuccess: (title: string, message?: string, fileMeta?: NotificationFileMeta) => string;
  notifyError: (title: string, message?: string, fileMeta?: NotificationFileMeta, action?: { label: string; onClick: () => void }) => string;
  notifyInfo: (title: string, message?: string) => string;
  updateNotification: (id: string, updates: Partial<NotificationItem>) => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismissNotification = useCallback((id: string) => {
    // Clear auto-dismiss timer if running
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    setNotifications([]);
  }, []);

  const notify = useCallback((opts: ShowNotificationOptions): string => {
    const id = 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const duration = opts.duration !== undefined ? opts.duration : (opts.type === 'pending' ? 0 : 4500);

    const newItem: NotificationItem = {
      id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      fileMeta: opts.fileMeta,
      progress: opts.progress,
      speed: opts.speed,
      createdAt: Date.now(),
      duration,
      action: opts.action
    };

    // Play chime feedback
    if (opts.sound !== false) {
      if (opts.type === 'success') {
        playChime('complete');
      } else if (opts.type === 'error') {
        playChime('error');
      } else if (opts.type === 'pending' || opts.type === 'info') {
        playChime('message');
      }
    }

    setNotifications((prev) => {
      // Keep up to 3 notifications on screen to avoid clutter
      const filtered = prev.slice(-2);
      return [...filtered, newItem];
    });

    // Setup auto-dismiss timer
    if (duration > 0) {
      const timer = setTimeout(() => {
        dismissNotification(id);
      }, duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [dismissNotification]);

  const updateNotification = useCallback((id: string, updates: Partial<NotificationItem>) => {
    setNotifications((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          // If changed from pending to success/error and duration not explicitly set, auto dismiss
          if (item.type === 'pending' && (updates.type === 'success' || updates.type === 'error')) {
            const duration = updates.duration || 4500;
            if (!timersRef.current.has(id)) {
              const timer = setTimeout(() => {
                dismissNotification(id);
              }, duration);
              timersRef.current.set(id, timer);
            }
          }
          return updated;
        }
        return item;
      })
    );
  }, [dismissNotification]);

  const notifyPending = useCallback((
    title: string,
    message?: string,
    fileMeta?: NotificationFileMeta,
    progress?: number,
    speed?: number
  ) => {
    return notify({
      type: 'pending',
      title,
      message,
      fileMeta,
      progress,
      speed,
      duration: 0, // Doesn't auto-dismiss until transfer finishes
      sound: true
    });
  }, [notify]);

  const notifySuccess = useCallback((title: string, message?: string, fileMeta?: NotificationFileMeta) => {
    return notify({
      type: 'success',
      title,
      message,
      fileMeta,
      duration: 4500,
      sound: true
    });
  }, [notify]);

  const notifyError = useCallback((
    title: string,
    message?: string,
    fileMeta?: NotificationFileMeta,
    action?: { label: string; onClick: () => void }
  ) => {
    return notify({
      type: 'error',
      title,
      message,
      fileMeta,
      duration: 6000,
      sound: true,
      action
    });
  }, [notify]);

  const notifyInfo = useCallback((title: string, message?: string) => {
    return notify({
      type: 'info',
      title,
      message,
      duration: 3500,
      sound: false
    });
  }, [notify]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        notify,
        notifyPending,
        notifySuccess,
        notifyError,
        notifyInfo,
        updateNotification,
        dismissNotification,
        clearAllNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return ctx;
};
