/**
 * app/api/notifications/route.ts
 *
 * GET   /api/notifications  — fetch all notifications for the authenticated user
 * POST  /api/notifications  — create a notification (called by other API routes)
 * PATCH /api/notifications  — mark one or all as read
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { dbStore } from '@/lib/db';
import { AppNotification, NotificationType } from '@/types';
import { randomUUID } from 'crypto';

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const notifications = await dbStore.getNotificationsForUser(user!.id);
    return NextResponse.json({ success: true, data: notifications });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { userId, type, title, body: msgBody, linkHref } = body as {
      userId: string;
      type: NotificationType;
      title: string;
      body: string;
      linkHref?: string;
    };

    if (!userId || !type || !title || !msgBody) {
      return NextResponse.json(
        { success: false, error: 'userId, type, title and body are required.' },
        { status: 400 }
      );
    }

    const notification: AppNotification = {
      id:        randomUUID(),
      userId,
      type,
      title,
      body:      msgBody,
      linkHref:  linkHref ?? undefined,
      isRead:    false,
      createdAt: new Date().toISOString(),
    };

    const saved = await dbStore.saveNotification(notification);
    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
// Body: { notificationId: string } | { markAllRead: true, userId: string }
export async function PATCH(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();

    if (body.markAllRead && body.userId) {
      await dbStore.markAllNotificationsRead(body.userId);
      return NextResponse.json({ success: true });
    }

    if (body.notificationId) {
      await dbStore.markNotificationRead(body.notificationId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: 'Provide notificationId or markAllRead + userId.' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
