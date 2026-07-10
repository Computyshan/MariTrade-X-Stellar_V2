import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

// ─── GET /api/shipments/[id]/iot-readings ──────────────────────────────────
// Recent sensor readings for a shipment, most recent first. Any authenticated
// party on the shipment can view — same visibility level as milestones.

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
  const readings = await dbStore.getIoTReadingsForShipment(shipment.id);
  return NextResponse.json({ success: true, data: readings });
}
