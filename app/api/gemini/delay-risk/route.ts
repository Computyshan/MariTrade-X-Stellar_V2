import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { predictDelayRisk } from '@/lib/gemini';
import { computeRouteHistoricalStats } from '@/lib/delay-risk';

/**
 * POST /api/gemini/delay-risk
 * Body: { shipmentId }
 *
 * Phase 2 (AI-Assisted Decision Support) — Logistics Chain "Delay-risk
 * prediction". Combines platform-wide historical stats for this exact route
 * with a Gemini read on the specific cargo, so a Freight Forwarder or
 * Customs Broker can see a heads-up before arrival. Read-only — never
 * writes to the shipment record.
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

    const [allShipments, allMilestones] = await Promise.all([
      dbStore.getShipments(),
      dbStore.getAllMilestones(),
    ]);

    const stats = computeRouteHistoricalStats(shipment, allShipments, allMilestones);

    const assessment = await predictDelayRisk({
      originCountry: shipment.originCountry,
      destinationPort: shipment.destinationPort,
      cargoDescription: shipment.description,
      isDangerousGoods: false, // not tracked on Shipment post-creation — see note below
      stats,
    });

    return NextResponse.json({ success: true, data: assessment });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Note: `isDangerousGoods` is captured at shipment-creation time (see
// app/(dashboard)/shipments/new/page.tsx Step 1) but isn't persisted on the
// Shipment record itself in types/index.ts — it's currently only used to
// steer the initial priority-milestone selection client-side. Passing
// `false` here is a known gap, not an assumption that no cargo is
// hazardous; wiring a real `isDangerousGoods` column through to Shipment
// would let this (and the milestone recommender on re-visits) read the
// real value instead.
