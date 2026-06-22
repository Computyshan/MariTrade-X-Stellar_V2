import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { MilestoneEvent, ShipmentDocument, ShipmentStatus, EscrowStatus } from '@/types';

// GET Shipment Details and all nested collections
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const shipment = dbStore.getShipmentById(id);

    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found' }, { status: 404 });
    }

    const milestones = dbStore.getMilestones(shipment.id);
    const priorityMilestones = dbStore.getPriorityMilestones(shipment.id);
    const documents = dbStore.getDocuments(shipment.id);
    const assignments = dbStore.getAssignmentsForShipment(shipment.id);

    return NextResponse.json({
      success: true,
      data: {
        shipment,
        milestones,
        priorityMilestones,
        documents,
        assignments
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST Actions (Milestone logs, Document upload, Accept/Reject, Escrow release, Cancel)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const shipment = dbStore.getShipmentById(id);

    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Action parameter is required' }, { status: 400 });
    }

    // 1. LOG MILESTONE ACTION
    if (action === 'LOG_MILESTONE') {
      const { loggedById, type, description, evidenceUrl } = body;
      
      if (!loggedById || !type || !evidenceUrl) {
        return NextResponse.json({ success: false, error: 'LoggedById, MilestoneType, and EvidenceUrl are required' }, { status: 400 });
      }

      // Add Milestone Event
      const newMilestone: MilestoneEvent = {
        id: 'me_' + Math.random().toString(36).substring(2, 9),
        shipmentId: shipment.id,
        loggedById,
        type,
        description,
        evidenceUrl,
        occurredAt: new Date().toISOString(),
        verified: true
      };

      dbStore.saveMilestone(newMilestone);

      // Check if this matches a Priority Milestone and update it
      dbStore.updatePriorityMilestoneStatus(shipment.id, type, true);

      // Update shipment status mapping based on logged milestones
      let nextStatus: ShipmentStatus = shipment.status;
      if (type === 'DELIVERED_AND_SIGNED_OFF') {
        nextStatus = 'DELIVERED';
      } else if (type === 'CARGO_PICKED_UP_FROM_PORT' || type === 'IN_TRANSIT_TO_DESTINATION') {
        nextStatus = 'IN_TRANSIT';
      } else if (type === 'CUSTOMS_CLEARANCE_APPROVED') {
        nextStatus = 'CUSTOMS_CLEARANCE';
      } else if (type === 'VESSEL_ARRIVED_DESTINATION') {
        nextStatus = 'AT_PORT';
      }

      const updatedShipment = {
        ...shipment,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      };
      dbStore.saveShipment(updatedShipment);

      return NextResponse.json({ success: true, data: { milestone: newMilestone, shipment: updatedShipment } });
    }

    // 2. UPLOAD DOCUMENT ACTION
    if (action === 'UPLOAD_DOCUMENT') {
      const { fileName, fileUrl, uploadedById } = body;
      if (!fileName || !fileUrl || !uploadedById) {
        return NextResponse.json({ success: false, error: 'FileName, FileUrl, and UploadedById are required' }, { status: 400 });
      }

      // Check active documents to increase version number
      const existingDocs = dbStore.getDocuments(shipment.id).filter(d => d.fileName === fileName);
      const nextVersion = existingDocs.length + 1;

      const newDoc: ShipmentDocument = {
        id: 'doc_' + Math.random().toString(36).substring(2, 9),
        shipmentId: shipment.id,
        fileName,
        fileUrl,
        uploadedById,
        version: nextVersion,
        isLatest: true,
        createdAt: new Date().toISOString()
      };

      dbStore.saveDocument(newDoc);
      return NextResponse.json({ success: true, data: newDoc });
    }

    // 3. STELLAR ESCROW RELEASE ACTION
    if (action === 'RELEASE_ESCROW') {
      const { evidenceUrl } = body; // Importer proof upload required for payout release
      if (!evidenceUrl) {
        return NextResponse.json({ success: false, error: 'Evidence upload proof is required to authorize Stellar escrow release' }, { status: 400 });
      }

      const updatedShipment = {
        ...shipment,
        status: 'DELIVERED' as const,
        escrowStatus: 'RELEASED' as const,
        updatedAt: new Date().toISOString()
      };

      dbStore.saveShipment(updatedShipment);

      // Create a release transaction receipt document automatically
      const txReceiptDoc: ShipmentDocument = {
        id: 'doc_receipt_' + Math.random().toString(36).substring(2, 9),
        shipmentId: shipment.id,
        fileName: 'Stellar_Escrow_Release_Receipt.pdf',
        fileUrl: evidenceUrl,
        uploadedById: shipment.importerId,
        version: 1,
        isLatest: true,
        createdAt: new Date().toISOString()
      };
      dbStore.saveDocument(txReceiptDoc);

      return NextResponse.json({ success: true, data: updatedShipment });
    }

    // 4. EXPORTER ACCEPT ACTION
    if (action === 'EXPORTER_ACCEPT') {
      const updatedShipment = {
        ...shipment,
        status: 'CONFIRMED' as const,
        updatedAt: new Date().toISOString()
      };
      dbStore.saveShipment(updatedShipment);
      return NextResponse.json({ success: true, data: updatedShipment });
    }

    // 5. EXPORTER REJECT ACTION
    if (action === 'EXPORTER_REJECT') {
      const updatedShipment = {
        ...shipment,
        status: 'CANCELLED' as const,
        updatedAt: new Date().toISOString()
      };
      dbStore.saveShipment(updatedShipment);
      return NextResponse.json({ success: true, data: updatedShipment });
    }

    // 6. CANCEL SHIPMENT ACTION
    if (action === 'CANCEL_SHIPMENT') {
      const updatedShipment = {
        ...shipment,
        status: 'CANCELLED' as const,
        escrowStatus: 'REFUNDED' as const,
        updatedAt: new Date().toISOString()
      };
      dbStore.saveShipment(updatedShipment);
      return NextResponse.json({ success: true, data: updatedShipment });
    }

    // 7. FILE DISPUTE ACTION
    if (action === 'FILE_DISPUTE') {
      const updatedShipment = {
        ...shipment,
        status: 'DISPUTED' as const,
        escrowStatus: 'DISPUTED' as const,
        updatedAt: new Date().toISOString()
      };
      dbStore.saveShipment(updatedShipment);
      return NextResponse.json({ success: true, data: updatedShipment });
    }

    return NextResponse.json({ success: false, error: 'Unsupported shipment action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
