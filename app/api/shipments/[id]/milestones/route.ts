import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { MilestoneEvent, MilestoneType, MILESTONE_EVIDENCE_MODE, getMilestonesForUser, getUserJobRoles } from '@/types';

// Role → milestone permission comes from the canonical ROLE_MILESTONES map
// in types/index.ts via getMilestonesForUser(), which unions the milestone
// sets of every role a user holds — so a dual-role account (e.g. Freight
// Forwarder + Customs Broker) is authorized for both sets, not just one.

// ─── GET /api/shipments/[id]/milestones ───────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const shipment = await dbStore.getShipmentById(id);
  if (!shipment) {
    return NextResponse.json({ success: false, error: 'Shipment not found' }, { status: 404 });
  }
  const milestones = await dbStore.getMilestones(shipment.id);
  return NextResponse.json({ success: true, data: milestones });
}

// ─── POST /api/shipments/[id]/milestones ──────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id: shipmentId } = await params;
    const body = await req.json();
    const { loggedById, type, description, evidenceUrl, evidenceRef, occurredAt } = body;

    // Validate required fields — at least one evidence field must be present
    if (!loggedById || !type) {
      return NextResponse.json(
        { success: false, error: 'loggedById and type are required.' },
        { status: 400 }
      );
    }
    const mode = MILESTONE_EVIDENCE_MODE[type as MilestoneType];
    if (mode === 'REFERENCE_NUMBER' && !evidenceRef?.trim()) {
      return NextResponse.json(
        { success: false, error: 'A reference number is required for this milestone.' },
        { status: 400 }
      );
    }
    if (mode === 'DOCUMENT' && !evidenceUrl?.trim()) {
      return NextResponse.json(
        { success: false, error: 'A document upload is required for this milestone.' },
        { status: 400 }
      );
    }
    if (mode === 'PHOTO_OR_NOTE' && !evidenceUrl?.trim() && !description?.trim()) {
      return NextResponse.json(
        { success: false, error: 'A photo upload or written description is required for this milestone.' },
        { status: 400 }
      );
    }

    // Validate shipment exists
    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    // Validate logger exists
    const logger = await dbStore.getUserById(loggedById);
    if (!logger) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Enforce role-based milestone permission — union across every role the
    // logger's account holds (stacked responsibilities), not just their
    // single primary jobRole.
    const loggerRoles = getUserJobRoles(logger);
    const allowedForRole = getMilestonesForUser(logger);
    if (!allowedForRole.includes(type as MilestoneType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Role(s) '${loggerRoles.join(', ')}' are not authorized to log milestone '${type}'. Check the milestone responsibility matrix.`,
        },
        { status: 403 }
      );
    }

    // Build and persist the milestone event
    const milestone: MilestoneEvent = {
      id: `me-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shipmentId: shipment.id,
      loggedById,
      type: type as MilestoneType,
      description: description ?? undefined,
      evidenceUrl: evidenceUrl ?? undefined,
      evidenceRef: evidenceRef ?? undefined,
      occurredAt: occurredAt ?? new Date().toISOString(),
      verified: false,
    };

    await dbStore.saveMilestone(milestone);

    // Auto-complete any matching priority milestone
    const priorityMilestones = await dbStore.getPriorityMilestones(shipment.id);
    const matchingPriority = priorityMilestones.find(pm => pm.type === type && !pm.isCompleted);
    if (matchingPriority) {
      await dbStore.updatePriorityMilestoneStatus(shipment.id, type, true);
    }

    return NextResponse.json({ success: true, data: milestone });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
