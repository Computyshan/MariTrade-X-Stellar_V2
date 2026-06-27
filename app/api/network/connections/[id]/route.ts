import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth-guard';

/**
 * PATCH /api/network/connections/[id]
 * Body: { status: 'ACCEPTED' | 'REJECTED', actorId }
 *
 * Only the RECEIVER can accept or reject a connection request.
 * actorId must match the receiverId on the stored request.
 *
 * DELETE /api/network/connections/[id]
 * Body: { actorId }
 *
 * Either party can cancel a PENDING request or remove an ACCEPTED connection.
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
    const { status, actorId } = body;

    if (!status || !actorId) {
      return NextResponse.json(
        { success: false, error: 'status and actorId are required' },
        { status: 400 }
      );
    }

    if (status !== 'ACCEPTED' && status !== 'REJECTED') {
      return NextResponse.json(
        { success: false, error: 'status must be ACCEPTED or REJECTED' },
        { status: 400 }
      );
    }

    const conn = await dbStore.getConnectionRequestById(id);
    if (!conn) {
      return NextResponse.json({ success: false, error: 'Connection request not found' }, { status: 404 });
    }

    if (conn.receiverId !== actorId) {
      return NextResponse.json(
        { success: false, error: 'Only the receiver can accept or reject a request' },
        { status: 403 }
      );
    }

    if (conn.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `Cannot update a ${conn.status} request` },
        { status: 409 }
      );
    }

    const updated = { ...conn, status, updatedAt: new Date().toISOString() };
    await dbStore.saveConnectionRequest(updated);

    // Notify the original requester that their request was accepted
    if (status === 'ACCEPTED') {
      const receiver = await dbStore.getUserById(actorId);
      try {
        await dbStore.saveNotification({
          id: 'notif_' + Math.random().toString(36).substring(2, 10),
          userId: conn.requesterId,
          type: 'CONNECTION_ACCEPTED',
          title: 'Connection request accepted',
          body: `${receiver?.fullName ?? 'A member'}${receiver?.companyName ? ' (' + receiver.companyName + ')' : ''} accepted your MariNet connection request.`,
          linkHref: '/network',
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      } catch (_) {
        // Non-fatal
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
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

    // Either party can cancel/remove
    if (conn.requesterId !== actorId && conn.receiverId !== actorId) {
      return NextResponse.json(
        { success: false, error: 'Not authorised to remove this connection' },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('connection_requests').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
