import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

/**
 * PATCH /api/network/connections/[id]
 * Body: { status: 'ACCEPTED' | 'REJECTED', actorId }
 *
 * Only the RECEIVER can accept or reject a connection request.
 * actorId must match the receiverId on the stored request.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
