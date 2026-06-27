/**
 * lib/notify.ts
 *
 * Small server-side helper for creating in-app notifications (the bell icon
 * in DashboardLayout + useNotifications hook already read from the
 * `notifications` table via dbStore — this module is just the missing
 * "write" side that other API routes call into).
 *
 * Usage from any API route:
 *   import { notifyUser, notifyUsers } from '@/lib/notify';
 *   await notifyUser({ userId, type: 'SHIPMENT_ASSIGNED', title, body, linkHref });
 *
 * Failures are swallowed (logged, not thrown) so a notification problem never
 * blocks the primary action (creating a shipment, funding escrow, etc).
 */

import { dbStore } from './db';
import { AppNotification, NotificationType } from '@/types';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkHref?: string;
}

/** Create a single notification. Never throws — logs and resolves on failure. */
export async function notifyUser(input: NotifyInput): Promise<void> {
  // Skip silently if there's no real recipient (e.g. an unassigned exporter slot).
  if (!input.userId) return;

  const notification: AppNotification = {
    id:        'notif_' + Math.random().toString(36).substring(2, 11),
    userId:    input.userId,
    type:      input.type,
    title:     input.title,
    body:      input.body,
    linkHref:  input.linkHref,
    isRead:    false,
    createdAt: new Date().toISOString(),
  };

  try {
    await dbStore.saveNotification(notification);
  } catch (err) {
    // Notifications are best-effort — never let this break the calling route.
    console.error('[notify] Failed to save notification:', err);
  }
}

/**
 * Create the same notification for several recipients at once.
 * Duplicate / falsy user IDs are deduped and skipped automatically.
 */
export async function notifyUsers(
  userIds: (string | null | undefined)[],
  rest: Omit<NotifyInput, 'userId'>,
): Promise<void> {
  const uniqueIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  await Promise.all(uniqueIds.map(userId => notifyUser({ userId, ...rest })));
}
