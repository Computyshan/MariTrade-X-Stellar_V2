import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { summarizeDisputeEvidence } from '@/lib/gemini';

/**
 * POST /api/gemini/dispute-summary
 * Body: { shipmentId }
 *
 * Phase 2 (AI-Assisted Decision Support) — Trade Party "Dispute-evidence
 * summarizer". Summarizes the milestone/evidence trail plus the importer's
 * stated dispute reason for a human arbitrator on the Admin Dispute Panel.
 * Read-only — never auto-resolves or recommends a split. Restricted to
 * shipments that are actually in a disputed state.
 */
export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { shipmentId } = await req.json();
    if (!shipmentId) {
      return NextResponse.json({ success: false, error: 'shipmentId is required' }, { status: 400 });
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found' }, { status: 404 });
    }

    if (shipment.status !== 'DISPUTED' && shipment.escrowStatus !== 'DISPUTED') {
      return NextResponse.json(
        { success: false, error: 'This shipment has no active dispute to summarize' },
        { status: 400 },
      );
    }

    const milestones = await dbStore.getMilestones(shipment.id);

    const summary = await summarizeDisputeEvidence({
      shipment,
      disputeReason: shipment.disputeReason,
      milestones,
    });

    return NextResponse.json({ success: true, data: summary });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
