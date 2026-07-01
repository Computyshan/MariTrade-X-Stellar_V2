import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { notifyUser } from '@/lib/notify';

// ─── POST /api/firms/invites/[id] ────────────────────────────────────────────
// body: { action: 'ACCEPT' | 'DECLINE' }
// Only the invited user (matched by email) may respond.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    const invite = await dbStore.getFirmInviteById(id);
    if (!invite) {
      return NextResponse.json({ success: false, error: 'Invite not found' }, { status: 404 });
    }
    if (invite.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: `Invite is already ${invite.status.toLowerCase()}` }, { status: 409 });
    }

    const me = await dbStore.getUserById(user!.id);
    if (!me || me.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'This invite is not addressed to you' }, { status: 403 });
    }

    if (action === 'DECLINE') {
      await dbStore.saveFirmInvite({ ...invite, status: 'DECLINED', updatedAt: new Date().toISOString() });
      return NextResponse.json({ success: true, data: { ...invite, status: 'DECLINED' } });
    }

    if (action === 'ACCEPT') {
      if (me.firmId) {
        return NextResponse.json({ success: false, error: 'Leave your current team before joining another' }, { status: 409 });
      }

      const firm = await dbStore.getFirmById(invite.firmId);
      if (!firm) {
        return NextResponse.json({ success: false, error: 'That team no longer exists' }, { status: 404 });
      }

      const members = await dbStore.getFirmMembers(firm.id);
      if (members.length >= firm.seatLimit) {
        return NextResponse.json({ success: false, error: 'That team has no open seats left' }, { status: 409 });
      }

      await dbStore.setUserFirm(me.id, firm.id, 'MEMBER');
      await dbStore.saveFirmInvite({ ...invite, status: 'ACCEPTED', updatedAt: new Date().toISOString() });

      await notifyUser({
        userId: firm.ownerId,
        type: 'FIRM_INVITE_ACCEPTED',
        title: 'Team invite accepted',
        body: `${me.fullName} joined "${firm.name}".`,
        linkHref: '/team',
      });

      return NextResponse.json({ success: true, data: { ...invite, status: 'ACCEPTED' } });
    }

    return NextResponse.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE /api/firms/invites/[id] ──────────────────────────────────────────
// Revoke a pending invite. Owner only.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const invite = await dbStore.getFirmInviteById(id);
    if (!invite) {
      return NextResponse.json({ success: false, error: 'Invite not found' }, { status: 404 });
    }

    const firm = await dbStore.getFirmById(invite.firmId);
    if (!firm || firm.ownerId !== user!.id) {
      return NextResponse.json({ success: false, error: 'Only the team owner can revoke invites' }, { status: 403 });
    }

    await dbStore.saveFirmInvite({ ...invite, status: 'REVOKED', updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true, data: { ...invite, status: 'REVOKED' } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
