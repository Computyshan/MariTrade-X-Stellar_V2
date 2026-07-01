import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { Firm } from '@/types';

// ─── GET /api/firms?userId=... ───────────────────────────────────────────────
// Returns the caller's firm (if any) plus its member roster and pending
// invites. `userId` must match the authenticated caller.
export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || user!.id;

    if (userId !== user!.id) {
      return NextResponse.json({ success: false, error: 'Cannot inspect another user\'s firm' }, { status: 403 });
    }

    const me = await dbStore.getUserById(userId);
    if (!me) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Pending invites addressed to this user's email — relevant whether or
    // not they currently belong to a firm.
    const myPendingInvites = await dbStore.getPendingFirmInvitesForEmail(me.email);

    if (!me.firmId) {
      return NextResponse.json({
        success: true,
        data: { firm: null, members: [], invites: [], myPendingInvites },
      });
    }

    const [firm, members, invites] = await Promise.all([
      dbStore.getFirmById(me.firmId),
      dbStore.getFirmMembers(me.firmId),
      dbStore.getFirmInvitesForFirm(me.firmId),
    ]);

    return NextResponse.json({
      success: true,
      data: { firm: firm ?? null, members, invites, myPendingInvites },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST /api/firms ──────────────────────────────────────────────────────────
// Creates a new firm with the caller as OWNER. Fails if the caller already
// belongs to a firm.
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { name } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ success: false, error: 'Firm name is required' }, { status: 400 });
    }

    const me = await dbStore.getUserById(user!.id);
    if (!me) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (me.firmId) {
      return NextResponse.json(
        { success: false, error: 'You already belong to a team. Leave it before creating a new one.' },
        { status: 409 }
      );
    }

    const newFirm: Firm = {
      id: 'firm_' + Math.random().toString(36).substring(2, 10),
      name: String(name).trim(),
      ownerId: me.id,
      seatLimit: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbStore.saveFirm(newFirm);
    await dbStore.setUserFirm(me.id, newFirm.id, 'OWNER');

    return NextResponse.json({ success: true, data: newFirm }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PATCH /api/firms ─────────────────────────────────────────────────────────
// Rename the firm, or change the seat limit. Owner only.
export async function PATCH(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { firmId, name, seatLimit } = body;

    if (!firmId) {
      return NextResponse.json({ success: false, error: 'firmId is required' }, { status: 400 });
    }

    const firm = await dbStore.getFirmById(firmId);
    if (!firm) {
      return NextResponse.json({ success: false, error: 'Firm not found' }, { status: 404 });
    }
    if (firm.ownerId !== user!.id) {
      return NextResponse.json({ success: false, error: 'Only the team owner can update team settings' }, { status: 403 });
    }

    const updated: Firm = {
      ...firm,
      name: name && String(name).trim() ? String(name).trim() : firm.name,
      seatLimit: seatLimit ? Math.max(1, Math.min(50, parseInt(seatLimit, 10))) : firm.seatLimit,
      updatedAt: new Date().toISOString(),
    };

    await dbStore.saveFirm(updated);
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
