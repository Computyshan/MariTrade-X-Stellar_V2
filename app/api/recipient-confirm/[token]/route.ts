/**
 * /api/recipient-confirm/[token]
 *
 * Public endpoint (no user session) backing the consignee-facing
 * app/(public)/confirm-delivery/[token] page. Token-authenticated instead
 * of session-authenticated — same public-safe-data discipline as
 * /api/track/[code]: no financials, no wallet/contact info beyond what the
 * consignee already has.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const confirmation = await dbStore.getRecipientConfirmationByToken(token);
    if (!confirmation) {
      return NextResponse.json({ success: false, error: 'Confirmation link not found or has expired.' }, { status: 404 });
    }

    const shipment = await dbStore.getShipmentById(confirmation.shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    const publicShipment = {
      referenceCode: shipment.referenceCode,
      description: shipment.description,
      originCountry: shipment.originCountry,
      destinationPort: shipment.destinationPort,
      status: shipment.status,
    };

    return NextResponse.json({
      success: true,
      data: {
        shipment: publicShipment,
        status: confirmation.status,
        consigneeName: confirmation.consigneeName,
        requestedAt: confirmation.requestedAt,
        respondedAt: confirmation.respondedAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const { action, disputeNote } = body; // action: 'CONFIRM' | 'DISPUTE'

    const confirmation = await dbStore.getRecipientConfirmationByToken(token);
    if (!confirmation) {
      return NextResponse.json({ success: false, error: 'Confirmation link not found or has expired.' }, { status: 404 });
    }
    if (confirmation.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `This confirmation has already been recorded as ${confirmation.status}.` },
        { status: 400 }
      );
    }
    if (action !== 'CONFIRM' && action !== 'DISPUTE') {
      return NextResponse.json({ success: false, error: "action must be 'CONFIRM' or 'DISPUTE'." }, { status: 400 });
    }
    if (action === 'DISPUTE' && !disputeNote?.trim()) {
      return NextResponse.json({ success: false, error: 'Please describe the issue when disputing receipt.' }, { status: 400 });
    }

    const updated = await dbStore.updateRecipientConfirmationStatus(
      token,
      action === 'CONFIRM' ? 'CONFIRMED' : 'DISPUTED',
      action === 'DISPUTE' ? disputeNote.trim() : undefined,
    );

    // Best-effort: let the shipment's importer/logistics chain know.
    try {
      const shipment = await dbStore.getShipmentById(updated.shipmentId);
      if (shipment) {
        const { notifyUsers } = await import('@/lib/notify');
        const assignments = await dbStore.getAssignmentsForShipment(shipment.id);
        await notifyUsers(
          [shipment.importerId, ...assignments.map(a => a.userId)],
          {
            type: 'MILESTONE_LOGGED',
            title: action === 'CONFIRM' ? 'Recipient confirmed delivery' : 'Recipient disputed delivery',
            body: `${updated.consigneeName || 'The consignee'} ${action === 'CONFIRM' ? 'confirmed receipt of' : 'disputed receipt of'} shipment ${shipment.referenceCode}.`,
            linkHref: `/shipments/${shipment.id}`,
          },
        );
      }
    } catch (err) {
      console.warn('[recipient-confirm] notification failed (non-blocking):', err);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
