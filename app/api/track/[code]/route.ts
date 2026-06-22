import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const resolvedParams = await params;
    const { code } = resolvedParams;
    const shipment = dbStore.getShipmentById(code);

    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment reference code not found' }, { status: 404 });
    }

    const milestones = dbStore.getMilestones(shipment.id);

    // Filter out financial metadata and return only public-facing safe metrics
    const publicShipment = {
      referenceCode: shipment.referenceCode,
      description: shipment.description,
      originCountry: shipment.originCountry,
      destinationPort: shipment.destinationPort,
      shipmentScope: shipment.shipmentScope,
      status: shipment.status,
      estimatedArrival: shipment.estimatedArrival,
      createdAt: shipment.createdAt
    };

    return NextResponse.json({
      success: true,
      data: {
        shipment: publicShipment,
        milestones
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
