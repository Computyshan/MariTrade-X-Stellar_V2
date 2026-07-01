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

/**
 * Plays a short two-note chime using the Web Audio API — no audio file
 * needed. Wrapped in try/catch since audio can fail silently in some
 * browser/embed contexts (e.g. before any user interaction) and that
 * should never break notification polling.
 */
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, gainPeak = 0.16) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.linearRampToValueAtTime(gainPeak, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    };

    // Pleasant ascending two-note "ding-dong" chime.
    playTone(880, 0, 0.18);
    playTone(1320, 0.12, 0.24);

    setTimeout(() => { ctx.close().catch(() => {}); }, 700);
  } catch {
    // Sound is a non-critical enhancement — never let it throw.
  }
}

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

export function useNotifications(userId: string | null | undefined, options?: { sound?: boolean }): NotificationsState {
  const soundEnabled = options?.sound ?? true;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading]             = useState(false);
  const timerRef                          = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownIdsRef                       = useRef<Set<string> | null>(null); // null until first successful fetch

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res  = await authFetch('/api/notifications');
      const json = await res.json();
      if (json.success) {
        const incoming: AppNotification[] = json.data;

        // Only chime for notifications that are (a) unread and (b) weren't
        // present on the previous fetch. Skipped entirely on the very first
        // load so existing unread notifications don't all chime at once.
        if (soundEnabled && knownIdsRef.current) {
          const hasNewUnread = incoming.some(n => !n.isRead && !knownIdsRef.current!.has(n.id));
          if (hasNewUnread) playNotificationChime();
        }
        knownIdsRef.current = new Set(incoming.map(n => n.id));

        setNotifications(incoming);
      }
    } catch {
      // silently swallow network errors — bell badge just won't update
    } finally {
      setLoading(false);
    }
  }, [userId, soundEnabled]);

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
