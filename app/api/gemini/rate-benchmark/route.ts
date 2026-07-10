import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { benchmarkFreightRate } from '@/lib/gemini';
import { computeRouteFreightStats } from '@/lib/rate-benchmark';

/**
 * POST /api/gemini/rate-benchmark
 * Body: { shipmentId, cargoWeightKg?, cargoType }
 *
 * Phase 2 (AI-Assisted Decision Support) — Logistics Chain "Rate
 * benchmarking". Combines platform-wide historical freight-cost stats for
 * this exact route with a Gemini read on general market rates, giving a
 * Freight Forwarder a data-backed floor to negotiate against with carriers.
 * Read-only — never writes to the shipment record.
 */
export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { shipmentId, cargoWeightKg, cargoType } = await req.json();
    if (!shipmentId) {
      return NextResponse.json({ success: false, error: 'shipmentId is required' }, { status: 400 });
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found' }, { status: 404 });
    }

    const allShipments = await dbStore.getShipments();
    const stats = computeRouteFreightStats(shipment, allShipments);

    const benchmark = await benchmarkFreightRate({
      originCountry: shipment.originCountry,
      destinationPort: shipment.destinationPort,
      cargoWeightKg: typeof cargoWeightKg === 'number' ? cargoWeightKg : undefined,
      cargoType: cargoType || shipment.description,
      stats,
    });

    return NextResponse.json({ success: true, data: benchmark });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
