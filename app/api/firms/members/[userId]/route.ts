import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { notifyUser } from '@/lib/notify';

// ─── GET /api/firms/members/[userId] ─────────────────────────────────────────
// Returns the shipments this member is currently assigned to — used by the
// Team page to decide whether a reassignment target is needed before removal.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { userId } = await params;
    const [assignments, shipments] = await Promise.all([
      dbStore.getAssignmentsForUser(userId),
      dbStore.getShipments(),
    ]);
    const shipmentIds = new Set(assignments.map(a => a.shipmentId));
    const activeShipments = shipments.filter(
      s => shipmentIds.has(s.id) && !['DELIVERED', 'CANCELLED'].includes(s.status)
    );

    return NextResponse.json({ success: true, data: activeShipments });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE /api/firms/members/[userId] ──────────────────────────────────────
// body (optional): { reassignShipmentsTo?: string }
// - Owner may remove any member (or self, only if no other members remain).
// - A member may remove themself (leave the team).
// - If reassignShipmentsTo is provided, every active shipment_assignments row
//   belonging to the departing user is handed to that teammate first.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { user, errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { userId } = await params;
    const target = await dbStore.getUserById(userId);
    if (!target || !target.firmId) {
      return NextResponse.json({ success: false, error: 'That user is not on a team' }, { status: 404 });
    }

    const firm = await dbStore.getFirmById(target.firmId);
    if (!firm) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }

    const isSelf = user!.id === userId;
    const isOwner = firm.ownerId === user!.id;

    if (!isSelf && !isOwner) {
      return NextResponse.json({ success: false, error: 'Only the team owner can remove other members' }, { status: 403 });
    }

    if (target.firmRole === 'OWNER') {
      const members = await dbStore.getFirmMembers(firm.id);
      if (members.length > 1) {
        return NextResponse.json(
          { success: false, error: 'Remove or reassign all other members before the owner can leave.' },
          { status: 409 }
        );
      }
      // Sole remaining member — deleting the firm entirely is handled by the
      // client calling this endpoint then simply not recreating one; the
      // firm row is left intact (harmless, owner can re-invite later) but
      // the user is detached so they're free to create/join a new team.
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* no body sent */ }
    const reassignShipmentsTo: string | undefined = body?.reassignShipmentsTo;

    const assignments = await dbStore.getAssignmentsForUser(userId);
    if (assignments.length > 0) {
      if (reassignShipmentsTo) {
        const target2 = await dbStore.getUserById(reassignShipmentsTo);
        if (!target2 || target2.firmId !== firm.id) {
          return NextResponse.json({ success: false, error: 'Reassignment target must be a current teammate' }, { status: 400 });
        }
        for (const a of assignments) {
          await dbStore.reassignShipmentAssignment(a.shipmentId, userId, reassignShipmentsTo);
        }
        await notifyUser({
          userId: reassignShipmentsTo,
          type: 'SHIPMENT_REASSIGNED',
          title: 'Shipments reassigned to you',
          body: `${target.fullName}'s ${assignments.length} shipment${assignments.length === 1 ? '' : 's'} on "${firm.name}" ${assignments.length === 1 ? 'was' : 'were'} reassigned to you.`,
          linkHref: '/shipments',
        });
      }
      // If no reassignment target was given, the assignment rows are left as-is —
      // the departing user keeps their existing shipment access even after
      // leaving the team (removal only affects team-wide shared visibility).
    }

    await dbStore.removeUserFromFirm(userId);

    if (!isSelf) {
      await notifyUser({
        userId,
        type: 'FIRM_MEMBER_REMOVED',
        title: 'Removed from team',
        body: `You were removed from "${firm.name}".`,
      });
    }

    return NextResponse.json({ success: true, data: { removed: userId, reassignedShipments: reassignShipmentsTo ? assignments.length : 0 } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
