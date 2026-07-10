/**
 * /api/shipments/[id]/delivery-signature
 *
 * Phase 3 — Digital signature capture at delivery, step 2 of 2.
 *
 * Attaches an OTP-verified signature to an already-logged
 * DELIVERED_AND_SIGNED_OFF milestone. The milestone itself is still created
 * through the normal POST /api/shipments/[id]/milestones flow first (so all
 * the existing priority-milestone completion + on-chain stage-sync logic
 * runs unchanged) — this endpoint only adds the richer, identity-verified
 * evidence on top of it. If the signature pad/OTP flow isn't used, the
 * milestone still stands on its plain photo-or-note evidence, per the
 * graceful-degradation rule in MariTrade_new_updates.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { DeliverySignature, SignerRelation } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(req.url);
  const milestoneEventId = searchParams.get('milestoneEventId');
  if (!milestoneEventId) {
    return NextResponse.json({ success: false, error: 'milestoneEventId query param is required.' }, { status: 400 });
  }
  const signature = await dbStore.getDeliverySignatureForMilestone(milestoneEventId);
  return NextResponse.json({ success: true, data: signature ?? null });
}

const VALID_RELATIONS: SignerRelation[] = ['CONSIGNEE', 'AUTHORIZED_REPRESENTATIVE', 'OTHER'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id: shipmentId } = await params;
    const body = await req.json();
    const {
      loggedById,
      milestoneEventId,
      signerName,
      signerRelation,
      signatureImageDataUrl,
      contact,
      otpCode,
    } = body;

    if (!loggedById || !milestoneEventId || !signerName?.trim() || !signatureImageDataUrl) {
      return NextResponse.json(
        { success: false, error: 'loggedById, milestoneEventId, signerName, and signatureImageDataUrl are required.' },
        { status: 400 }
      );
    }
    if (!VALID_RELATIONS.includes(signerRelation)) {
      return NextResponse.json(
        { success: false, error: `signerRelation must be one of ${VALID_RELATIONS.join(', ')}.` },
        { status: 400 }
      );
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    const assignments = await dbStore.getAssignmentsForShipment(shipment.id);
    if (!assignments.some(a => a.userId === loggedById)) {
      return NextResponse.json(
        { success: false, error: 'Only an assigned logistics chain member may capture a delivery signature.' },
        { status: 403 }
      );
    }

    const milestones = await dbStore.getMilestones(shipment.id);
    const milestone = milestones.find(m => m.id === milestoneEventId);
    if (!milestone) {
      return NextResponse.json({ success: false, error: 'Milestone not found on this shipment.' }, { status: 404 });
    }
    if (milestone.type !== 'DELIVERED_AND_SIGNED_OFF') {
      return NextResponse.json(
        { success: false, error: 'Signature capture only applies to the DELIVERED_AND_SIGNED_OFF milestone.' },
        { status: 400 }
      );
    }

    // OTP is optional at the API level (never blocks the signature from
    // being stored — graceful degradation) but its verified state is
    // recorded honestly either way, so the UI/audit trail can show whether
    // identity was confirmed.
    let otpVerified = false;
    let otpVerifiedContactMasked: string | undefined;
    if (contact?.trim() && otpCode?.trim()) {
      const { maskContact } = await import('@/lib/verification/recipient-confirmation');
      otpVerified = await dbStore.verifySignatureOtpChallenge(shipment.id, contact.trim(), otpCode.trim());
      if (otpVerified) otpVerifiedContactMasked = maskContact(contact.trim());
    }

    const signature: DeliverySignature = {
      id: `dsig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      milestoneEventId,
      shipmentId: shipment.id,
      signerName: signerName.trim(),
      signerRelation,
      signatureImageDataUrl,
      otpVerified,
      otpVerifiedContactMasked,
      signedAt: new Date().toISOString(),
    };

    const saved = await dbStore.saveDeliverySignature(signature);
    return NextResponse.json({ success: true, data: saved });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
