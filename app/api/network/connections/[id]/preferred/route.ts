import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

/**
 * PATCH /api/network/connections/[id]/preferred
 * Body: { actorId }
 *
 * Toggles whether actorId (a Trade Party user) has flagged this counterparty
 * as a "Preferred Partner" — Implementation Plan §4, "Preferred partner"
 * fast-track. Unlike favorite (either side, any role combo), this is
 * intentionally one-directional: only a Trade Party account may mark a
 * Logistics Chain counterparty as preferred, since the fast-track exists to
 * streamline *who the importer/exporter assigns to their shipments* — a
 * Logistics Chain user marking a Trade Party as "preferred" wouldn't hook
 * into anything meaningful yet.
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
        { success: false, error: 'Not authorised to mark this connection as preferred' },
        { status: 403 }
      );
    }

    if (conn.status !== 'ACCEPTED') {
      return NextResponse.json(
        { success: false, error: 'Only an accepted MariNet connection can be marked as preferred' },
        { status: 409 }
      );
    }

    const otherPartyId = conn.requesterId === actorId ? conn.receiverId : conn.requesterId;
    const [actor, otherParty] = await Promise.all([
      dbStore.getUserById(actorId),
      dbStore.getUserById(otherPartyId),
    ]);

    if (!actor || !otherParty) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (actor.userType !== 'TRADE_PARTY' || otherParty.userType !== 'LOGISTICS_CHAIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Only a Trade Party account can mark a Logistics Chain partner as preferred',
        },
        { status: 400 }
      );
    }

    const updated = await dbStore.toggleConnectionPreferred(id, actorId);
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
