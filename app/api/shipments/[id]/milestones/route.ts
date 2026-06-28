import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { MilestoneEvent, MilestoneType, JobRole, MILESTONE_EVIDENCE_MODE } from '@/types';

// ─── Role permission map ───────────────────────────────────────────────────────

const ROLE_MILESTONES: Record<JobRole, MilestoneType[]> = {
  // Trade Party — no logging rights
  IMPORTER: [],
  EXPORTER: [],
  // ─── Logistics Chain ───
  FREIGHT_FORWARDER: [
    'BOOKING_CONFIRMED',
    'DOCUMENTS_SUBMITTED_TO_CARRIER',
    'SPACE_ON_VESSEL_SECURED',
    'CONTAINER_GATED_OUT_ORIGIN',
    'CONTAINER_LOADED_ON_VESSEL',
    'VESSEL_CLEARED_TO_DEPART',
    'VESSEL_DEPARTED_ORIGIN',
    'BILL_OF_LADING_ISSUED',
    'VESSEL_ARRIVED_AT_BERTH',
    'VESSEL_ARRIVED_DESTINATION',
    'CONTAINER_OFFLOADED',
    'CONTAINER_GATED_IN_DESTINATION',
    'CARGO_RELEASED_FOR_PICKUP',
    'IN_TRANSIT_TO_DESTINATION',
    'ARRIVED_AT_DELIVERY_ADDRESS',
    'DELIVERED_AND_SIGNED_OFF',
  ],
  CUSTOMS_BROKER: [
    'BOC_ENTRY_FILED',
    'PORT_HOLD_PLACED_OR_LIFTED',
    'DUTIES_AND_TAXES_PAID',
    'CUSTOMS_EXAMINATION_REQUESTED',
    'CUSTOMS_CLEARANCE_APPROVED',
  ],
  WAREHOUSE_OPERATOR: [
    'CARGO_READY_FOR_COLLECTION',
    'CARGO_INSPECTED_AND_PACKED',
    'CARGO_STAGED_FOR_PICKUP',
    'CARGO_HANDED_OFF_TO_CARRIER',
    'CARGO_PICKED_UP_FROM_PORT',
    'CARGO_RECEIVED_AT_WAREHOUSE',
    'INCOMING_CARGO_STORED',
  ],
};

// ─── GET /api/shipments/[id]/milestones ───────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const milestones = await dbStore.getMilestones(id);
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

    // Enforce role-based milestone permission
    const allowedForRole = ROLE_MILESTONES[logger.jobRole] ?? [];
    if (!allowedForRole.includes(type as MilestoneType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Role '${logger.jobRole}' is not authorized to log milestone '${type}'. Check the milestone responsibility matrix.`,
        },
        { status: 403 }
      );
    }

    // Build and persist the milestone event
    const milestone: MilestoneEvent = {
      id: `me-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shipmentId,
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
    const priorityMilestones = await dbStore.getPriorityMilestones(shipmentId);
    const matchingPriority = priorityMilestones.find(pm => pm.type === type && !pm.isCompleted);
    if (matchingPriority) {
      await dbStore.updatePriorityMilestoneStatus(shipmentId, type, true);
    }

    return NextResponse.json({ success: true, data: milestone });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
