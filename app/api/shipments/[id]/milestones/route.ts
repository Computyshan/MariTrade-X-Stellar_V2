import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { MilestoneEvent, MilestoneType, MILESTONE_EVIDENCE_MODE, getMilestonesForUser, getUserJobRoles } from '@/types';
import { getMariTradeEscrowClient, CancellationStage, NetworkName } from '@/lib/stellar/escrow-contract';
import { platformSignAndSubmit } from '@/lib/stellar/platform-signer';
import { crossCheckVesselDeparture } from '@/lib/verification/ais-tracking';

const STELLAR_NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as NetworkName;
const PLATFORM_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';
const PLATFORM_SECRET  = process.env.PLATFORM_STELLAR_SECRET_KEY ?? '';

/**
 * Milestones that gate the on-chain cancellation_stage transition, per the
 * contract's own advance_stage() docstring:
 *   VESSEL_DEPARTED_ORIGIN   → IN_TRANSIT
 *   DELIVERED_AND_SIGNED_OFF → DELIVERED
 * Any other milestone type does not move the stage.
 */
const STAGE_ADVANCING_MILESTONES: Partial<Record<MilestoneType, CancellationStage>> = {
  VESSEL_DEPARTED_ORIGIN:   CancellationStage.InTransit,
  DELIVERED_AND_SIGNED_OFF: CancellationStage.Delivered,
};

/**
 * Best-effort on-chain advance_stage() call. Milestone logging (the DB write)
 * is the primary, must-succeed operation — the on-chain stage sync is
 * secondary and must never block or fail the milestone POST if Stellar is
 * unreachable or misconfigured. Errors are logged, not thrown.
 */
async function tryAdvanceOnChainStage(
  referenceCode: string | undefined,
  milestoneType: MilestoneType,
): Promise<{ attempted: boolean; hash: string | null; error: string | null }> {
  const newStage = STAGE_ADVANCING_MILESTONES[milestoneType];
  if (!newStage) return { attempted: false, hash: null, error: null };
  if (!referenceCode || !PLATFORM_SECRET || !PLATFORM_ADDRESS) {
    return { attempted: false, hash: null, error: null };
  }

  try {
    const client = getMariTradeEscrowClient(STELLAR_NETWORK, PLATFORM_ADDRESS);
    const tx = await client.advance_stage({
      reference_code: referenceCode,
      platform: PLATFORM_ADDRESS,
      new_stage: newStage,
    });
    const hash = await platformSignAndSubmit(tx, STELLAR_NETWORK);
    console.log(`[milestones] ✓ advance_stage(${CancellationStage[newStage]}) confirmed for ${referenceCode}. Hash: ${hash}`);
    return { attempted: true, hash, error: null };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.warn(`[milestones] advance_stage(${CancellationStage[newStage]}) failed for ${referenceCode} (milestone was still logged in DB):`, msg);
    return { attempted: true, hash: null, error: msg };
  }
}

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
    const { loggedById, type, description, evidenceUrl, evidenceRef, occurredAt, vesselMmsi, vesselName } = body;

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

    // Phase 3 — vessel identity capture. Optional, typed by the Freight
    // Forwarder alongside SPACE_ON_VESSEL_SECURED once the vessel is known.
    // Saved onto the shipment (not the milestone) since it's a durable fact
    // about the shipment, and it's what powers the AIS cross-check on the
    // later VESSEL_DEPARTED_ORIGIN milestone below. Non-blocking: a failure
    // here never stops the milestone itself from being logged.
    if (type === 'SPACE_ON_VESSEL_SECURED' && (vesselMmsi?.trim() || vesselName?.trim())) {
      try {
        await dbStore.saveShipment({
          ...shipment,
          vesselMmsi: vesselMmsi?.trim() || shipment.vesselMmsi,
          vesselName: vesselName?.trim() || shipment.vesselName,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[milestones] Failed to save vessel identity onto shipment, continuing:', err);
      }
    }

    // Phase 3 — vessel-tracking cross-check. Best-effort and non-blocking:
    // the milestone above is saved either way, this only attaches
    // corroborating (or contradicting) evidence to it.
    if (type === 'VESSEL_DEPARTED_ORIGIN') {
      try {
        milestone.aisVerification = await crossCheckVesselDeparture({
          vesselMmsi: vesselMmsi?.trim() || shipment.vesselMmsi,
          claimedReference: evidenceRef ?? '',
          occurredAt: milestone.occurredAt,
        });
      } catch (err) {
        console.warn('[milestones] AIS cross-check threw unexpectedly, continuing without it:', err);
      }
    }

    await dbStore.saveMilestone(milestone);

    // Phase 3 — IoT sensor ingestion: attach any sensor readings that
    // arrived in a ±6h window around this milestone and haven't been linked
    // to a milestone yet. Best-effort — never blocks the milestone save above.
    try {
      const occurredMs = new Date(milestone.occurredAt).getTime();
      const windowStart = new Date(occurredMs - 6 * 60 * 60 * 1000).toISOString();
      const windowEnd = new Date(occurredMs + 6 * 60 * 60 * 1000).toISOString();
      await dbStore.linkIoTReadingsToMilestone(shipment.id, milestone.id, windowStart, windowEnd);
    } catch (err) {
      console.warn('[milestones] IoT reading backfill failed (non-blocking):', err);
    }

    // Auto-complete any matching priority milestone
    const priorityMilestones = await dbStore.getPriorityMilestones(shipment.id);
    const matchingPriority = priorityMilestones.find(pm => pm.type === type && !pm.isCompleted);
    if (matchingPriority) {
      await dbStore.updatePriorityMilestoneStatus(shipment.id, type, true);
    }

    // Sync the on-chain cancellation_stage for milestones that gate it
    // (VESSEL_DEPARTED_ORIGIN → IN_TRANSIT, DELIVERED_AND_SIGNED_OFF → DELIVERED).
    // Best-effort: the milestone above is already durably saved regardless
    // of whether this succeeds.
    const stageSync = await tryAdvanceOnChainStage(shipment.referenceCode, type as MilestoneType);

    return NextResponse.json({
      success: true,
      data: milestone,
      ...(stageSync.attempted ? { onChainStageSync: { hash: stageSync.hash, error: stageSync.error } } : {}),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
