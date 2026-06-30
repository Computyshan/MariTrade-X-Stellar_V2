import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const resolvedParams = await params;
    const { code } = resolvedParams;
    const shipment = await dbStore.getShipmentById(code);

    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment reference code not found' }, { status: 404 });
    }

    const milestones = await dbStore.getMilestones(shipment.id);

    // ── Involved parties — public-safe view ──────────────────────────────────
    // Trade Party (Importer / Exporter): only the company name is exposed,
    // never the individual's name, email, contact number, or wallet.
    // Logistics Chain (Freight Forwarder / Customs Broker / Warehouse Operator):
    // the assigned individual's name and role are shown, since they act as the
    // shipment's operational point of contact — still no email/contact/wallet.
    const importerUser = await dbStore.getUserById(shipment.importerId);
    const exporterUser = shipment.exporterId ? await dbStore.getUserById(shipment.exporterId) : undefined;

    const assignments = await dbStore.getAssignmentsForShipment(shipment.id);
    const assignedUsers = await Promise.all(
      assignments.map((a) => dbStore.getUserById(a.userId))
    );
    const logisticsChain = assignedUsers
      .filter((u): u is NonNullable<typeof u> => !!u && u.userType === 'LOGISTICS_CHAIN')
      .map((u) => ({
        fullName: u.fullName,
        jobRole: u.jobRole,
        companyName: u.companyName ?? undefined,
      }));

    const involvedParties = {
      importerCompany: importerUser?.companyName || importerUser?.fullName || 'Undisclosed Importer',
      exporterCompany: exporterUser ? (exporterUser.companyName || exporterUser.fullName) : undefined,
      logisticsChain,
    };

    // Filter out financial metadata and return only public-facing safe metrics
    const publicShipment = {
      referenceCode: shipment.referenceCode,
      description: shipment.description,
      originCountry: shipment.originCountry,
      destinationPort: shipment.destinationPort,
      shipmentScope: shipment.shipmentScope,
      status: shipment.status,
      estimatedArrival: shipment.estimatedArrival,
      createdAt: shipment.createdAt,
    };

    return NextResponse.json({ success: true, data: { shipment: publicShipment, milestones, involvedParties } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
