/**
 * /api/shipments/[id]/duty-prefunding
 *
 * Phase 5 — Direct System Integration. Lets the importer pre-authorize the
 * estimated BOC duty amount through MariTrade's own rails (see
 * lib/integrations/duty-prefunding.ts) so the assigned Customs Broker can
 * draw on it later instead of needing a separate payment channel outside
 * the platform.
 *
 * This is a new payment rail, separate from the cargo-value escrow in
 * contracts/escrow — see the SCOPE NOTE in lib/integrations/duty-prefunding.ts
 * for what's implemented vs. still a follow-up build. Until the on-chain
 * hold mechanism exists, every action here just records the authorization
 * lifecycle in `duty_prefunding_authorizations` without moving funds, and
 * responds with `fallbackToManual: true` so the client can tell the
 * Customs Broker to keep paying BOC through today's outside channel.
 *
 * Body (POST):
 * {
 *   action: 'AUTHORIZE' | 'CAPTURE' | 'CANCEL',
 *   userId: string,
 *   estimatedDutyAmountUSD?: number,  // AUTHORIZE
 *   capturedAmountUSD?: number,       // CAPTURE
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { getUserJobRoles } from '@/types';
import { authorizeDutyPreFunding, captureDutyPreFunding, cancelDutyPreFunding } from '@/lib/integrations/duty-prefunding';

// ─── GET /api/shipments/[id]/duty-prefunding ──────────────────────────────────

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
  const authorization = await dbStore.getDutyPreFundingForShipment(shipment.id);
  return NextResponse.json({ success: true, data: authorization ?? null });
}

// ─── POST /api/shipments/[id]/duty-prefunding ─────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id: shipmentId } = await params;
    const body = await req.json();
    const { action, userId, estimatedDutyAmountUSD, capturedAmountUSD } = body;

    if (!action || !userId) {
      return NextResponse.json({ success: false, error: 'action and userId are required.' }, { status: 400 });
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    const user = await dbStore.getUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    if (action === 'AUTHORIZE') {
      if (user.id !== shipment.importerId) {
        return NextResponse.json(
          { success: false, error: 'Only the importer can authorize duty pre-funding.' },
          { status: 403 }
        );
      }
      if (typeof estimatedDutyAmountUSD !== 'number' || estimatedDutyAmountUSD <= 0) {
        return NextResponse.json(
          { success: false, error: 'estimatedDutyAmountUSD (positive number) is required.' },
          { status: 400 }
        );
      }
      if (!user.stellarWallet) {
        return NextResponse.json(
          { success: false, error: 'Importer has no linked Stellar wallet.' },
          { status: 400 }
        );
      }

      const result = await authorizeDutyPreFunding({
        shipmentReferenceCode: shipment.referenceCode,
        importerStellarAddress: user.stellarWallet,
        estimatedDutyAmountUSD,
      });

      const now = new Date().toISOString();
      const authorization = await dbStore.saveDutyPreFunding({
        shipmentId: shipment.id,
        importerId: user.id,
        estimatedDutyAmountUSD,
        status: result.ok ? 'AUTHORIZED' : 'NOT_REQUESTED',
        authorizedAt: result.ok ? now : undefined,
        rawReference: result.ok ? result.data.rawReference : undefined,
      });

      return NextResponse.json({
        success: true,
        data: authorization,
        ...(result.ok ? {} : { fallbackToManual: true, message: (result as any).message }),
      });
    }

    if (action === 'CAPTURE') {
      const roles = getUserJobRoles(user);
      if (!roles.includes('CUSTOMS_BROKER')) {
        return NextResponse.json(
          { success: false, error: 'Only a Customs Broker can capture pre-funded duty.' },
          { status: 403 }
        );
      }

      const existing = await dbStore.getDutyPreFundingForShipment(shipment.id);
      if (!existing || existing.status !== 'AUTHORIZED') {
        return NextResponse.json(
          { success: false, error: 'No authorized duty pre-funding hold found for this shipment.' },
          { status: 400 }
        );
      }

      const result = await captureDutyPreFunding({
        rawReference: existing.rawReference ?? '',
        capturedAmountUSD: capturedAmountUSD ?? existing.estimatedDutyAmountUSD,
      });

      const authorization = await dbStore.saveDutyPreFunding({
        ...existing,
        status: result.ok ? 'CAPTURED' : existing.status,
        capturedAt: result.ok ? result.data.capturedAt : undefined,
        capturedByUserId: result.ok ? user.id : undefined,
        capturedAmountUSD: result.ok ? (capturedAmountUSD ?? existing.estimatedDutyAmountUSD) : undefined,
      });

      return NextResponse.json({
        success: true,
        data: authorization,
        ...(result.ok ? {} : { fallbackToManual: true, message: (result as any).message }),
      });
    }

    if (action === 'CANCEL') {
      if (user.id !== shipment.importerId) {
        return NextResponse.json(
          { success: false, error: 'Only the importer can cancel a duty pre-funding hold.' },
          { status: 403 }
        );
      }

      const existing = await dbStore.getDutyPreFundingForShipment(shipment.id);
      if (!existing) {
        return NextResponse.json({ success: false, error: 'No duty pre-funding hold found for this shipment.' }, { status: 400 });
      }

      const result = await cancelDutyPreFunding(existing.rawReference ?? '');

      const authorization = await dbStore.saveDutyPreFunding({
        ...existing,
        status: 'CANCELLED',
        cancelledAt: result.ok ? result.data.cancelledAt : new Date().toISOString(),
      });

      return NextResponse.json({ success: true, data: authorization });
    }

    return NextResponse.json(
      { success: false, error: "action must be 'AUTHORIZE', 'CAPTURE', or 'CANCEL'." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
