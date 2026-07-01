import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

/**
 * PATCH /api/network/connections/[id]/favorite
 * Body: { actorId }
 *
 * Toggles whether actorId has favorited/saved this counterparty. Either
 * party on an ACCEPTED connection may favorite it — personal bookmark,
 * not a mutual flag. Only meaningful on ACCEPTED connections, but we don't
 * hard-block other statuses since a favorite on a since-removed connection
 * is harmless and the row will disappear anyway.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await req.json();
    const { actorId } = body;

    if (!actorId) {
      return NextResponse.json({ success: false, error: 'actorId is required' }, { status: 400 });
    }

    const conn = await dbStore.getConnectionRequestById(id);
    if (!conn) {
      return NextResponse.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    if (conn.requesterId !== actorId && conn.receiverId !== actorId) {
      return NextResponse.json(
        { success: false, error: 'Not authorised to favorite this connection' },
        { status: 403 }
      );
    }

    const updated = await dbStore.toggleConnectionFavorite(id, actorId);
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
