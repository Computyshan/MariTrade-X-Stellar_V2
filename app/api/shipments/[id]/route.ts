import { NextRequest, NextResponse } from 'next/server';
import { Keypair, TransactionBuilder, Networks } from '@stellar/stellar-sdk';
import { Server as SorobanServer } from '@stellar/stellar-sdk/rpc';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { notifyUser, notifyUsers } from '@/lib/notify';
import { MilestoneEvent, ShipmentDocument, ShipmentStatus } from '@/types';
import { getMariTradeEscrowClient, CancellationStage } from '@/lib/stellar/escrow-contract';

// ─── Network config ──────────────────────────────────────────────────────────
const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? 'testnet';
const RPC_URL =
  STELLAR_NETWORK === 'mainnet'
    ? 'https://mainnet.sorobanrpc.com'
    : 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;
const PLATFORM_ADDRESS  = process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';
const PLATFORM_SECRET   = process.env.PLATFORM_STELLAR_SECRET_KEY ?? '';

// ─── Server-side Stellar signer ───────────────────────────────────────────────
// Signs and submits a pre-assembled XDR envelope using the platform keypair.
// Returns the confirmed transaction hash, or null if the secret key is not set.
async function platformSignAndSubmit(xdr: string): Promise<string | null> {
  if (!PLATFORM_SECRET || !PLATFORM_ADDRESS) {
    console.warn('[Stellar] PLATFORM_STELLAR_SECRET_KEY not set — skipping chain call.');
    return null;
  }

  try {
    const keypair = Keypair.fromSecret(PLATFORM_SECRET);
    const server  = new SorobanServer(RPC_URL);

    // Deserialise the assembled XDR and attach the platform signature
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    tx.sign(keypair);

    const sendResult = await server.sendTransaction(tx);

    if (sendResult.status === 'ERROR') {
      console.error('[Stellar] sendTransaction ERROR:', sendResult.errorResult);
      return null;
    }

    const { hash } = sendResult;

    // Poll for confirmation (up to 2 min, 2 s cadence)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const check = await server.getTransaction(hash);
      if (check.status === 'SUCCESS') return hash;
      if (check.status === 'FAILED') {
        console.error(`[Stellar] Transaction FAILED on-chain. Hash: ${hash}`);
        return null;
      }
      // NOT_FOUND or PENDING → keep waiting
    }

    console.error(`[Stellar] Transaction timed out. Hash: ${hash}`);
    return null;
  } catch (err) {
    console.error('[Stellar] platformSignAndSubmit error:', err);
    return null;
  }
}

// ─── GET — Shipment details with all nested collections ─────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const shipment = await dbStore.getShipmentById(id);

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: 'Shipment not found' },
        { status: 404 },
      );
    }

    const [milestones, priorityMilestones, documents, assignments] =
      await Promise.all([
        dbStore.getMilestones(shipment.id),
        dbStore.getPriorityMilestones(shipment.id),
        dbStore.getDocuments(shipment.id),
        dbStore.getAssignmentsForShipment(shipment.id),
      ]);

    return NextResponse.json({
      success: true,
      data: { shipment, milestones, priorityMilestones, documents, assignments },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST — All shipment actions ─────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const shipment = await dbStore.getShipmentById(id);

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: 'Shipment not found' },
        { status: 404 },
      );
    }

    const body     = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action parameter is required' },
        { status: 400 },
      );
    }

    // ── 1. LOG MILESTONE ────────────────────────────────────────────────────
    if (action === 'LOG_MILESTONE') {
      const { loggedById, type, description, evidenceUrl } = body;

      if (!loggedById || !type || !evidenceUrl) {
        return NextResponse.json(
          { success: false, error: 'loggedById, type, and evidenceUrl are required' },
          { status: 400 },
        );
      }

      // Persist milestone event
      const newMilestone: MilestoneEvent = {
        id:         'me_' + Math.random().toString(36).substring(2, 9),
        shipmentId: shipment.id,
        loggedById,
        type,
        description,
        evidenceUrl,
        occurredAt: new Date().toISOString(),
        verified:   true,
      };

      await dbStore.saveMilestone(newMilestone);
      await dbStore.updatePriorityMilestoneStatus(shipment.id, type, true);

      // Update shipment status in DB
      let nextStatus: ShipmentStatus = shipment.status;
      if (type === 'DELIVERED_AND_SIGNED_OFF')                                 nextStatus = 'DELIVERED';
      else if (type === 'CARGO_PICKED_UP_FROM_PORT' || type === 'IN_TRANSIT_TO_DESTINATION') nextStatus = 'IN_TRANSIT';
      else if (type === 'CUSTOMS_CLEARANCE_APPROVED')                          nextStatus = 'CUSTOMS_CLEARANCE';
      else if (type === 'VESSEL_ARRIVED_DESTINATION')                          nextStatus = 'AT_PORT';

      const updatedShipment = {
        ...shipment,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      await dbStore.saveShipment(updatedShipment);

      // ── STELLAR: Advance escrow stage based on the logged milestone ─────────
      // Only attempt if the shipment is already funded on-chain.
      if (shipment.stellarEscrowId && shipment.referenceCode && PLATFORM_ADDRESS) {
        const client = getMariTradeEscrowClient(
          STELLAR_NETWORK as 'testnet' | 'mainnet',
          PLATFORM_ADDRESS,
        );

        let stageXdr: string | null = null;

        if (type === 'VESSEL_DEPARTED_ORIGIN') {
          // PRE_DEPARTURE → IN_TRANSIT
          try {
            const tx = await client.advance_stage({
              reference_code: shipment.referenceCode,
              platform:       PLATFORM_ADDRESS,
              new_stage:      CancellationStage.InTransit,
            });
            stageXdr = tx.toXDR();
          } catch (err) {
            console.error('[Stellar] advance_stage(InTransit) build failed:', err);
          }
        } else if (type === 'DELIVERED_AND_SIGNED_OFF') {
          // IN_TRANSIT → DELIVERED
          try {
            const tx = await client.advance_stage({
              reference_code: shipment.referenceCode,
              platform:       PLATFORM_ADDRESS,
              new_stage:      CancellationStage.Delivered,
            });
            stageXdr = tx.toXDR();
          } catch (err) {
            console.error('[Stellar] advance_stage(Delivered) build failed:', err);
          }
        }

        if (stageXdr) {
          const txHash = await platformSignAndSubmit(stageXdr);
          if (txHash) {
            console.log(
              `[Stellar] Stage advanced for ${shipment.referenceCode}. Milestone: ${type}. Hash: ${txHash}`,
            );
          }
          // Non-blocking: DB record is already updated regardless of chain result.
        }
      }

      return NextResponse.json({
        success: true,
        data:    { milestone: newMilestone, shipment: updatedShipment },
      });
    }

    // ── 2. UPLOAD DOCUMENT ──────────────────────────────────────────────────
    if (action === 'UPLOAD_DOCUMENT') {
      const { fileName, fileUrl, uploadedById } = body;
      if (!fileName || !fileUrl || !uploadedById) {
        return NextResponse.json(
          { success: false, error: 'fileName, fileUrl, and uploadedById are required' },
          { status: 400 },
        );
      }

      const existingDocs = await dbStore.getDocuments(shipment.id);
      const nextVersion  = existingDocs.filter(d => d.fileName === fileName).length + 1;

      const newDoc: ShipmentDocument = {
        id:         'doc_' + Math.random().toString(36).substring(2, 9),
        shipmentId: shipment.id,
        fileName,
        fileUrl,
        uploadedById,
        version:  nextVersion,
        isLatest: true,
        createdAt: new Date().toISOString(),
      };

      await dbStore.saveDocument(newDoc);
      return NextResponse.json({ success: true, data: newDoc });
    }

    // ── 3. RELEASE ESCROW ───────────────────────────────────────────────────
    // Called AFTER the client has already submitted the Soroban release tx.
    // txHash (optional) comes from the browser; evidenceUrl is always required.
    if (action === 'RELEASE_ESCROW') {
      const { evidenceUrl, txHash } = body;
      if (!evidenceUrl) {
        return NextResponse.json(
          { success: false, error: 'evidenceUrl is required to confirm escrow release' },
          { status: 400 },
        );
      }

      const updatedShipment = {
        ...shipment,
        status:         'DELIVERED'  as const,
        escrowStatus:   'RELEASED'   as const,
        stellarEscrowId: txHash ?? shipment.stellarEscrowId,
        updatedAt:      new Date().toISOString(),
      };
      await dbStore.saveShipment(updatedShipment);

      // Attach the release receipt as a vault document
      const txReceiptDoc: ShipmentDocument = {
        id:         'doc_receipt_' + Math.random().toString(36).substring(2, 9),
        shipmentId: shipment.id,
        fileName:   'Stellar_Escrow_Release_Receipt.pdf',
        fileUrl:    evidenceUrl,
        uploadedById: shipment.importerId,
        version:    1,
        isLatest:   true,
        createdAt:  new Date().toISOString(),
      };
      await dbStore.saveDocument(txReceiptDoc);

      return NextResponse.json({ success: true, data: updatedShipment });
    }

    // ── 4. UPDATE STELLAR ESCROW (called after fund() tx is confirmed) ──────
    // Wires the on-chain tx hash into the DB record and marks the shipment FUNDED.
    if (action === 'UPDATE_STELLAR_ESCROW') {
      const { stellarEscrowId, escrowStatus } = body;
      if (!stellarEscrowId) {
        return NextResponse.json(
          { success: false, error: 'stellarEscrowId is required' },
          { status: 400 },
        );
      }

      const updatedShipment = {
        ...shipment,
        stellarEscrowId,
        escrowStatus: (escrowStatus ?? 'FUNDED') as any,
        updatedAt:    new Date().toISOString(),
      };
      await dbStore.saveShipment(updatedShipment);

      // Notify everyone on this shipment that escrow is now funded on-chain.
      // This fires only here, the moment the real Stellar fund() tx is
      // confirmed, not at initial DB-record creation (which is optimistic).
      if ((escrowStatus ?? 'FUNDED') === 'FUNDED') {
        const assignments = await dbStore.getAssignmentsForShipment(shipment.id);
        const shipmentLink = `/shipments/${shipment.id}`;

        await notifyUser({
          userId:   shipment.importerId,
          type:     'ESCROW_FUNDED',
          title:    'Escrow funded on Stellar',
          body:     `Your deposit for shipment ${shipment.referenceCode} is now locked in the Soroban escrow contract.`,
          linkHref: shipmentLink,
        });

        if (shipment.exporterId) {
          await notifyUser({
            userId:   shipment.exporterId,
            type:     'ESCROW_FUNDED',
            title:    'Escrow funded - shipment ready',
            body:     `Escrow for shipment ${shipment.referenceCode} has been funded. Funds are locked on Stellar until release conditions are met.`,
            linkHref: shipmentLink,
          });
        }

        await notifyUsers(assignments.map(a => a.userId), {
          type:     'ESCROW_FUNDED',
          title:    'Shipment escrow funded',
          body:     `Escrow for shipment ${shipment.referenceCode} is funded. You can begin logging milestone events.`,
          linkHref: shipmentLink,
        });
      }

      return NextResponse.json({ success: true, data: updatedShipment });
    }

    // ── 5. EXPORTER ACCEPT ──────────────────────────────────────────────────
    if (action === 'EXPORTER_ACCEPT') {
      const updated = {
        ...shipment,
        status:    'CONFIRMED' as const,
        updatedAt: new Date().toISOString(),
      };
      await dbStore.saveShipment(updated);
      return NextResponse.json({ success: true, data: updated });
    }

    // ── 6. EXPORTER REJECT ──────────────────────────────────────────────────
    if (action === 'EXPORTER_REJECT') {
      const updated = {
        ...shipment,
        status:    'CANCELLED' as const,
        updatedAt: new Date().toISOString(),
      };
      await dbStore.saveShipment(updated);
      return NextResponse.json({ success: true, data: updated });
    }

    // ── 7. CANCEL SHIPMENT ──────────────────────────────────────────────────
    if (action === 'CANCEL_SHIPMENT') {
      const updated = {
        ...shipment,
        status:       'CANCELLED' as const,
        escrowStatus: 'REFUNDED'  as const,
        updatedAt:    new Date().toISOString(),
      };
      await dbStore.saveShipment(updated);
      return NextResponse.json({ success: true, data: updated });
    }

    // ── 8. FILE DISPUTE ─────────────────────────────────────────────────────
    if (action === 'FILE_DISPUTE') {
      const updated = {
        ...shipment,
        status:       'DISPUTED' as const,
        escrowStatus: 'DISPUTED' as const,
        updatedAt:    new Date().toISOString(),
      };
      await dbStore.saveShipment(updated);
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported action: ${action}` },
      { status: 400 },
    );

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
