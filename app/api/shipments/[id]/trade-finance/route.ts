/**
 * /api/shipments/[id]/trade-finance
 *
 * Phase 5 — Direct System Integration. Lets the importer link a Letter of
 * Credit or other financing instrument to a shipment, snapshotting the
 * MariTrade escrow status at the moment it's linked (see
 * lib/integrations/trade-finance.ts). MariTrade never calls out to a bank's
 * LC system here — this is a one-directional record, not a live
 * integration, so there's no "not configured" fallback to handle.
 *
 * Body (POST /link):
 * {
 *   importerId: string,
 *   instrumentType: 'LETTER_OF_CREDIT' | 'INVOICE_FINANCING' | 'SUPPLY_CHAIN_FINANCE',
 *   providerName: string,
 *   referenceNumber: string,
 *   faceValueUSD: number,
 *   notes?: string,
 * }
 *
 * Body (PATCH — update status, e.g. once the financing provider confirms
 * issuance/drawdown/settlement out of band):
 * {
 *   linkId: string,
 *   status: 'LINKED' | 'ISSUED' | 'DRAWN' | 'SETTLED' | 'EXPIRED' | 'CANCELLED',
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { TradeFinanceInstrumentType, TradeFinanceLink, TradeFinanceStatus } from '@/types';
import { snapshotEscrowStatusForLink } from '@/lib/integrations/trade-finance';

const VALID_INSTRUMENT_TYPES: TradeFinanceInstrumentType[] = [
  'LETTER_OF_CREDIT',
  'INVOICE_FINANCING',
  'SUPPLY_CHAIN_FINANCE',
];
const VALID_STATUSES: TradeFinanceStatus[] = ['LINKED', 'ISSUED', 'DRAWN', 'SETTLED', 'EXPIRED', 'CANCELLED'];

// ─── GET /api/shipments/[id]/trade-finance ────────────────────────────────────

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
  const links = await dbStore.getTradeFinanceLinksForShipment(shipment.id);
  return NextResponse.json({ success: true, data: links });
}

// ─── POST /api/shipments/[id]/trade-finance ───────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id: shipmentId } = await params;
    const body = await req.json();
    const { importerId, instrumentType, providerName, referenceNumber, faceValueUSD, notes } = body;

    if (!importerId || !instrumentType || !providerName || !referenceNumber || typeof faceValueUSD !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'importerId, instrumentType, providerName, referenceNumber, and faceValueUSD are required.',
        },
        { status: 400 }
      );
    }
    if (!VALID_INSTRUMENT_TYPES.includes(instrumentType)) {
      return NextResponse.json(
        { success: false, error: `instrumentType must be one of ${VALID_INSTRUMENT_TYPES.join(', ')}.` },
        { status: 400 }
      );
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }
    if (shipment.importerId !== importerId) {
      return NextResponse.json(
        { success: false, error: 'Only the importer on this shipment can link a financing instrument.' },
        { status: 403 }
      );
    }

    const snapshot = snapshotEscrowStatusForLink(shipment.escrowStatus);

    const link: Omit<TradeFinanceLink, 'id'> = {
      shipmentId: shipment.id,
      importerId,
      instrumentType,
      providerName,
      referenceNumber,
      faceValueUSD,
      status: 'LINKED',
      escrowStatusAtLink: snapshot.escrowStatusAtLink,
      linkedByUserId: importerId,
      linkedAt: snapshot.linkedAt,
      notes,
    };

    const saved = await dbStore.saveTradeFinanceLink(link);
    return NextResponse.json({ success: true, data: saved });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/shipments/[id]/trade-finance ──────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id: shipmentId } = await params;
    const body = await req.json();
    const { linkId, status } = body;

    if (!linkId || !status) {
      return NextResponse.json({ success: false, error: 'linkId and status are required.' }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `status must be one of ${VALID_STATUSES.join(', ')}.` },
        { status: 400 }
      );
    }

    const shipment = await dbStore.getShipmentById(shipmentId);
    if (!shipment) {
      return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });
    }

    const links = await dbStore.getTradeFinanceLinksForShipment(shipment.id);
    const link = links.find(l => l.id === linkId);
    if (!link) {
      return NextResponse.json({ success: false, error: 'Trade finance link not found.' }, { status: 404 });
    }

    await dbStore.updateTradeFinanceLinkStatus(linkId, status);
    return NextResponse.json({ success: true, data: { ...link, status } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
