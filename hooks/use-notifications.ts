'use client';
/**
 * hooks/use-notifications.ts
 *
 * Polls /api/notifications every 30 seconds and exposes helpers to mark
 * notifications as read. Polling is intentionally lightweight — upgrade to
 * Supabase Realtime subscriptions when you want push-style delivery.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppNotification } from '@/types';
import { authFetch } from '@/hooks/use-user-session';

const POLL_INTERVAL_MS = 30_000; // 30 s

export interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  /** Mark a single notification read. */
  markRead: (id: string) => Promise<void>;
  /** Mark all notifications read. */
  markAllRead: () => Promise<void>;
  /** Trigger a manual refresh. */
  refresh: () => Promise<void>;
}

export function useNotifications(userId: string | null | undefined): NotificationsState {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading]             = useState(false);
  const timerRef                          = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res  = await authFetch('/api/notifications');
      const json = await res.json();
      if (json.success) setNotifications(json.data);
    } catch {
      // silently swallow network errors — bell badge just won't update
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch + polling
  useEffect(() => {
    if (!userId) return;
    fetchNotifications();
    timerRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
    try {
      await authFetch('/api/notifications', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ notificationId: id }),
      });
    } catch {
      // revert optimistic update on failure
      await fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await authFetch('/api/notifications', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ markAllRead: true, userId }),
      });
    } catch {
      await fetchNotifications();
    }
  }, [userId, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    refresh: fetchNotifications,
  };
}
