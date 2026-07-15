/**
 * /api/shipments/[id]/boc-filing
 *
 * Phase 5 — Direct System Integration. Lets the assigned Customs Broker file
 * the BOC entry and confirm duty payment *through* MariTrade (via BOC's e2m
 * gateway — see lib/integrations/boc-e2m.ts) instead of doing it on BOC's
 * own portal and pasting a reference number back in.
 *
 * Degrades gracefully: if e2m isn't configured for this deployment,
 * submitBocEntryFiling/submitBocDutyPayment return `not_configured` and this
 * route responds with `fallbackToManual: true` — the client should fall
 * back to the ordinary manual BOC_ENTRY_FILED / DUTIES_AND_TAXES_PAID
 * milestone flow (typed reference number / uploaded Official Receipt) in
 * that case, exactly as before Phase 5. A CONFIRMED e2m response, by
 * contrast, auto-creates the corresponding MilestoneEvent with
 * evidenceSource: 'SYSTEM_VERIFIED'.
 *
 * Body (POST):
 * {
 *   filedByUserId: string,
 *   action: 'FILE_ENTRY' | 'PAY_DUTY',
 *   hsCode?: string,             // FILE_ENTRY
 *   cargoDescription?: string,   // FILE_ENTRY — falls back to shipment.description
 *   amountUSD?: number,          // PAY_DUTY — falls back to the filing's dutiesAssessedUSD
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { MilestoneEvent, getMilestonesForUser } from '@/types';
import { submitBocEntryFiling, submitBocDutyPayment } from '@/lib/integrations/boc-e2m';

// ─── GET /api/shipments/[id]/boc-filing ───────────────────────────────────────

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
  const filing = await dbStore.getBocFilingForShipment(shipment.id);
  return NextResponse.json({ success: true, data: filing ?? null });
}

// ─── POST /api/shipments/[id]/boc-filing ──────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id: shipmentId } = await params;
    const body = await req.json();
    const { filedByUserId, action, hsCode, cargoDescription, amountUSD } = body;

    if (!filedByUserId || !action) {
      return NextResponse.json(
        { success: false, error: 'filedByUserId and action are required.' },
        { status: 400 }
      );
    }
    if (action !== 'FILE_ENTRY' && action !== 'PAY_DUTY') {
      return NextResponse.json(
        { success: false, error: "action must be 'FILE_ENTRY' or 'PAY_DUTY'." },
        { status: 400 }
      );
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    const filer = await dbStore.getUserById(filedByUserId);
    if (!filer) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Same role gate as the manual milestone flow — only a Customs Broker
    // may file/pay, since this ultimately backs BOC_ENTRY_FILED /
    // DUTIES_AND_TAXES_PAID which are Customs-Broker-only milestones.
    const allowed = getMilestonesForUser(filer);
    const requiredMilestone = action === 'FILE_ENTRY' ? 'BOC_ENTRY_FILED' : 'DUTIES_AND_TAXES_PAID';
    if (!allowed.includes(requiredMilestone)) {
      return NextResponse.json(
        { success: false, error: `User is not authorized to ${action === 'FILE_ENTRY' ? 'file BOC entries' : 'confirm duty payment'}.` },
        { status: 403 }
      );
    }

    if (action === 'FILE_ENTRY') {
      const result = await submitBocEntryFiling({
        shipmentReferenceCode: shipment.referenceCode,
        hsCode,
        cargoDescription: cargoDescription ?? shipment.description,
        totalValueUSD: shipment.totalValueUSD,
        originCountry: shipment.originCountry,
      });

      if (!result.ok && result.reason === 'not_configured') {
        const filing = await dbStore.saveBocFiling({
          shipmentId: shipment.id,
          filedByUserId,
          status: 'NOT_FILED',
        });
        return NextResponse.json({ success: true, data: filing, fallbackToManual: true, message: result.message });
      }
      if (!result.ok) {
        const filing = await dbStore.saveBocFiling({
          shipmentId: shipment.id,
          filedByUserId,
          status: 'REJECTED',
          rejectedReason: result.message,
        });
        return NextResponse.json({ success: false, error: result.message, data: filing }, { status: 502 });
      }

      const now = new Date().toISOString();
      const filing = await dbStore.saveBocFiling({
        shipmentId: shipment.id,
        filedByUserId,
        status: 'CONFIRMED',
        entrySeriesNumber: result.data.entrySeriesNumber,
        dutiesAssessedUSD: result.data.dutiesAssessedUSD,
        submittedAt: now,
        confirmedAt: now,
      });

      const milestone = await autoLogMilestone(shipment.id, filedByUserId, 'BOC_ENTRY_FILED', result.data.entrySeriesNumber);
      return NextResponse.json({ success: true, data: filing, milestone });
    }

    // PAY_DUTY
    const existingFiling = await dbStore.getBocFilingForShipment(shipment.id);
    if (!existingFiling?.entrySeriesNumber) {
      return NextResponse.json(
        { success: false, error: 'No confirmed BOC entry filing found for this shipment yet.' },
        { status: 400 }
      );
    }

    const result = await submitBocDutyPayment({
      entrySeriesNumber: existingFiling.entrySeriesNumber,
      amountUSD: amountUSD ?? existingFiling.dutiesAssessedUSD ?? 0,
    });

    if (!result.ok && result.reason === 'not_configured') {
      return NextResponse.json({ success: true, data: existingFiling, fallbackToManual: true, message: result.message });
    }
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.message }, { status: 502 });
    }

    const filing = await dbStore.saveBocFiling({
      ...existingFiling,
      status: 'CONFIRMED',
      officialReceiptNumber: result.data.officialReceiptNumber,
    });

    const milestone = await autoLogMilestone(shipment.id, filedByUserId, 'DUTIES_AND_TAXES_PAID', result.data.officialReceiptNumber);
    return NextResponse.json({ success: true, data: filing, milestone });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

/** Auto-creates a MilestoneEvent from a confirmed e2m response, marking it
 *  SYSTEM_VERIFIED, and auto-completes the matching priority milestone if
 *  one is configured for this shipment. Mirrors the equivalent block in
 *  app/api/shipments/[id]/milestones/route.ts for manually-logged milestones. */
async function autoLogMilestone(
  shipmentId: string,
  loggedById: string,
  type: 'BOC_ENTRY_FILED' | 'DUTIES_AND_TAXES_PAID',
  evidenceRef: string,
): Promise<MilestoneEvent> {
  const milestone: MilestoneEvent = {
    id: `me-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    shipmentId,
    loggedById,
    type,
    evidenceRef,
    occurredAt: new Date().toISOString(),
    verified: true,
    evidenceSource: 'SYSTEM_VERIFIED',
  };
  await dbStore.saveMilestone(milestone);

  const priorityMilestones = await dbStore.getPriorityMilestones(shipmentId);
  const matching = priorityMilestones.find(pm => pm.type === type && !pm.isCompleted);
  if (matching) {
    await dbStore.updatePriorityMilestoneStatus(shipmentId, type, true);
  }

  return milestone;
}
