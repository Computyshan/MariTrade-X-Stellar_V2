import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { notifyUser } from '@/lib/notify';
import { FirmInvite } from '@/types';

// ─── POST /api/firms/invites ──────────────────────────────────────────────────
// Firm owner invites a seat by email. Enforces the seat_limit (existing
// members + pending invites must stay under the cap) and refuses to invite
// someone who already belongs to a firm.
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { firmId, email } = body;

    if (!firmId || !email || !String(email).trim()) {
      return NextResponse.json({ success: false, error: 'firmId and email are required' }, { status: 400 });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    const firm = await dbStore.getFirmById(firmId);
    if (!firm) {
      return NextResponse.json({ success: false, error: 'Firm not found' }, { status: 404 });
    }
    if (firm.ownerId !== user!.id) {
      return NextResponse.json({ success: false, error: 'Only the team owner can invite new seats' }, { status: 403 });
    }

    const inviter = await dbStore.getUserById(user!.id);
    if (normalizedEmail === inviter?.email.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'You cannot invite yourself' }, { status: 400 });
    }

    const invitedUser = await dbStore.getUserByEmail(normalizedEmail);
    if (invitedUser?.firmId) {
      return NextResponse.json(
        { success: false, error: 'That user already belongs to a team' },
        { status: 409 }
      );
    }

    const [members, existingInvites] = await Promise.all([
      dbStore.getFirmMembers(firmId),
      dbStore.getFirmInvitesForFirm(firmId),
    ]);
    const pendingCount = existingInvites.filter(i => i.status === 'PENDING').length;
    if (members.length + pendingCount >= firm.seatLimit) {
      return NextResponse.json(
        { success: false, error: `Seat limit reached (${firm.seatLimit}). Remove a member or raise the seat limit first.` },
        { status: 409 }
      );
    }

    const existingPending = existingInvites.find(
      i => i.invitedEmail.toLowerCase() === normalizedEmail && i.status === 'PENDING'
    );
    if (existingPending) {
      return NextResponse.json({ success: false, error: 'An invite is already pending for that email' }, { status: 409 });
    }

    const newInvite: FirmInvite = {
      id: 'inv_' + Math.random().toString(36).substring(2, 10),
      firmId,
      invitedEmail: normalizedEmail,
      invitedById: user!.id,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dbStore.saveFirmInvite(newInvite);

    // Best-effort in-app notification if the invited email already has an account.
    if (invitedUser) {
      await notifyUser({
        userId: invitedUser.id,
        type: 'FIRM_INVITE',
        title: 'Team invite',
        body: `${inviter?.fullName ?? 'Someone'} invited you to join "${firm.name}" on MariTrade.`,
        linkHref: '/team',
      });
    }

    return NextResponse.json({ success: true, data: newInvite }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
