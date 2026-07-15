/**
 * /api/shipments/[id]/carrier-booking
 *
 * Phase 5 — Direct System Integration. Lets the assigned Freight Forwarder
 * book vessel/container space *through* MariTrade via a carrier's booking
 * API (see lib/integrations/carrier-booking.ts) instead of booking elsewhere
 * and typing the reference number back in.
 *
 * Degrades gracefully: if the named carrier has no booking API credentials
 * configured for this deployment, this route responds with
 * `fallbackToManual: true` — the client should fall back to the ordinary
 * manual BOOKING_CONFIRMED milestone flow. A CONFIRMED booking response, by
 * contrast, auto-creates the BOOKING_CONFIRMED MilestoneEvent with
 * evidenceSource: 'SYSTEM_VERIFIED'.
 *
 * Body (POST):
 * {
 *   requestedByUserId: string,
 *   carrierCode: string,       // e.g. 'MAERSK' — see SUPPORTED_CARRIERS
 *   containerType?: string,
 *   cargoDescription?: string, // falls back to shipment.description
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { MilestoneEvent, getMilestonesForUser } from '@/types';
import { requestCarrierBooking, SUPPORTED_CARRIERS } from '@/lib/integrations/carrier-booking';

// ─── GET /api/shipments/[id]/carrier-booking ──────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const shipment = await dbStore.getShipmentById(id);
  if (!shipment) {
    return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
  }
  const bookings = await dbStore.getCarrierBookingsForShipment(shipment.id);
  return NextResponse.json({ success: true, data: bookings, supportedCarriers: SUPPORTED_CARRIERS });
}

// ─── POST /api/shipments/[id]/carrier-booking ─────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id: shipmentId } = await params;
    const body = await req.json();
    const { requestedByUserId, carrierCode, containerType, cargoDescription } = body;

    if (!requestedByUserId || !carrierCode) {
      return NextResponse.json(
        { success: false, error: 'requestedByUserId and carrierCode are required.' },
        { status: 400 }
      );
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    const requester = await dbStore.getUserById(requestedByUserId);
    if (!requester) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Same role gate as the manual milestone flow — only a Freight
    // Forwarder may book, since this backs BOOKING_CONFIRMED, a
    // Freight-Forwarder-only milestone.
    if (!getMilestonesForUser(requester).includes('BOOKING_CONFIRMED')) {
      return NextResponse.json(
        { success: false, error: 'User is not authorized to request carrier bookings.' },
        { status: 403 }
      );
    }

    const result = await requestCarrierBooking({
      carrierCode,
      shipmentReferenceCode: shipment.referenceCode,
      originPort: shipment.originCountry,
      destinationPort: shipment.destinationPort,
      containerType,
      cargoDescription: cargoDescription ?? shipment.description,
    });

    if (!result.ok && result.reason === 'not_configured') {
      const booking = await dbStore.saveCarrierBooking({
        shipmentId: shipment.id,
        requestedByUserId,
        carrierCode,
        containerType,
        status: 'NOT_REQUESTED',
      });
      return NextResponse.json({ success: true, data: booking, fallbackToManual: true, message: result.message });
    }
    if (!result.ok) {
      const booking = await dbStore.saveCarrierBooking({
        shipmentId: shipment.id,
        requestedByUserId,
        carrierCode,
        containerType,
        status: 'FAILED',
        failureReason: result.message,
      });
      return NextResponse.json({ success: false, error: result.message, data: booking }, { status: 502 });
    }

    const now = new Date().toISOString();
    const booking = await dbStore.saveCarrierBooking({
      shipmentId: shipment.id,
      requestedByUserId,
      carrierCode,
      containerType,
      status: 'CONFIRMED',
      bookingReference: result.data.bookingReference,
      vesselName: result.data.vesselName,
      voyageNumber: result.data.voyageNumber,
      requestedAt: now,
      confirmedAt: now,
    });

    // Vessel identity captured here powers the Phase 3 AIS cross-check on
    // the later VESSEL_DEPARTED_ORIGIN milestone — same field the manual
    // SPACE_ON_VESSEL_SECURED flow writes to (see milestones/route.ts).
    if (result.data.vesselName) {
      try {
        await dbStore.saveShipment({ ...shipment, vesselName: result.data.vesselName, updatedAt: now });
      } catch (err) {
        console.warn('[carrier-booking] Failed to save vessel identity onto shipment, continuing:', err);
      }
    }

    const milestone = await autoLogBookingConfirmedMilestone(shipment.id, requestedByUserId, result.data.bookingReference);
    return NextResponse.json({ success: true, data: booking, milestone });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

async function autoLogBookingConfirmedMilestone(
  shipmentId: string,
  loggedById: string,
  bookingReference: string,
): Promise<MilestoneEvent> {
  const milestone: MilestoneEvent = {
    id: `me-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    shipmentId,
    loggedById,
    type: 'BOOKING_CONFIRMED',
    evidenceRef: bookingReference,
    occurredAt: new Date().toISOString(),
    verified: true,
    evidenceSource: 'SYSTEM_VERIFIED',
  };
  await dbStore.saveMilestone(milestone);

  const priorityMilestones = await dbStore.getPriorityMilestones(shipmentId);
  const matching = priorityMilestones.find(pm => pm.type === 'BOOKING_CONFIRMED' && !pm.isCompleted);
  if (matching) {
    await dbStore.updatePriorityMilestoneStatus(shipmentId, 'BOOKING_CONFIRMED', true);
  }

  return milestone;
}
