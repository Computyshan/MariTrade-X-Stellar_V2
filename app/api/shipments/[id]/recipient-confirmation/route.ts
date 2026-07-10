/**
 * /api/shipments/[id]/recipient-confirmation
 *
 * Phase 3 — Recipient-side confirmation flow.
 *
 * Lets an assigned logistics chain member or the importer send the named
 * consignee a one-time link to confirm (or dispute) receipt independently —
 * so the "proof" of arrival isn't solely supplied by the logistics side.
 * The public-facing confirm/dispute endpoint lives at
 * /api/recipient-confirm/[token] and app/(public)/confirm-delivery/[token].
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { RecipientConfirmation } from '@/types';
import { generateConfirmationToken, sendConfirmationLink } from '@/lib/verification/recipient-confirmation';

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
  const confirmations = await dbStore.getRecipientConfirmationsForShipment(shipment.id);
  return NextResponse.json({ success: true, data: confirmations });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id: shipmentId } = await params;
    const body = await req.json();
    const { requestedById, consigneeContact, consigneeName } = body;

    if (!requestedById || !consigneeContact?.trim()) {
      return NextResponse.json(
        { success: false, error: 'requestedById and consigneeContact are required.' },
        { status: 400 }
      );
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    // Either the importer or an assigned logistics chain member may trigger
    // the confirmation request.
    const assignments = await dbStore.getAssignmentsForShipment(shipment.id);
    const isAssigned = assignments.some(a => a.userId === requestedById);
    const isImporter = shipment.importerId === requestedById;
    if (!isAssigned && !isImporter) {
      return NextResponse.json(
        { success: false, error: 'Only the importer or an assigned logistics chain member may request recipient confirmation.' },
        { status: 403 }
      );
    }

    const confirmationToken = generateConfirmationToken();
    const confirmation: RecipientConfirmation = {
      id: `rcon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shipmentId: shipment.id,
      consigneeContact: consigneeContact.trim(),
      consigneeName: consigneeName?.trim() || undefined,
      status: 'PENDING',
      confirmationToken,
      requestedById,
      requestedAt: new Date().toISOString(),
    };

    const saved = await dbStore.saveRecipientConfirmation(confirmation);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
    const confirmUrl = `${siteUrl}/confirm-delivery/${confirmationToken}`;
    const delivery = await sendConfirmationLink({
      consigneeContact: confirmation.consigneeContact,
      consigneeName: confirmation.consigneeName,
      referenceCode: shipment.referenceCode,
      confirmUrl,
    });

    return NextResponse.json({ success: true, data: { ...saved, confirmUrl, delivery } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
