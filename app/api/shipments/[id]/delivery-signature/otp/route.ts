/**
 * /api/shipments/[id]/delivery-signature/otp
 *
 * Phase 3 — Digital signature capture at delivery, step 1 of 2.
 *
 * The Freight Forwarder standing in front of the recipient triggers this to
 * send a one-time code to the recipient's own phone/email, so the signature
 * captured next is tied to their verified identity rather than just a tap
 * on the driver's device. See ./route.ts for step 2 (signature + OTP submit).
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { generateOtp, sendConfirmationLink } from '@/lib/verification/recipient-confirmation';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id: shipmentId } = await params;
    const body = await req.json();
    const { requestedById, contact } = body;

    if (!requestedById || !contact?.trim()) {
      return NextResponse.json(
        { success: false, error: 'requestedById and contact are required.' },
        { status: 400 }
      );
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    const assignments = await dbStore.getAssignmentsForShipment(shipment.id);
    if (!assignments.some(a => a.userId === requestedById)) {
      return NextResponse.json(
        { success: false, error: 'Only an assigned logistics chain member may request a delivery-signature OTP.' },
        { status: 403 }
      );
    }

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    await dbStore.createSignatureOtpChallenge({
      shipmentId: shipment.id,
      contact: contact.trim(),
      otpCode,
      expiresAt,
    });

    // Best-effort delivery — logs server-side if no SMS/email provider is
    // configured (see lib/verification/recipient-confirmation.ts).
    await sendConfirmationLink({
      consigneeContact: contact.trim(),
      referenceCode: shipment.referenceCode,
      confirmUrl: `Your MariTrade delivery confirmation code is ${otpCode} (valid 10 minutes).`,
    });

    return NextResponse.json({ success: true, data: { sent: true, expiresAt } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
