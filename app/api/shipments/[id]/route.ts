import { NextRequest, NextResponse } from 'next/server';
import { Keypair, Networks, Transaction, FeeBumpTransaction } from '@stellar/stellar-sdk';
import { Server as SorobanServer } from '@stellar/stellar-sdk/rpc';
import { AssembledTransaction } from '@stellar/stellar-sdk/contract';
import { dbStore } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { notifyUser, notifyUsers } from '@/lib/notify';
import { MilestoneEvent, ShipmentDocument, ShipmentStatus } from '@/types';
import { getMariTradeEscrowClient, CancellationStage, MilestoneType as ContractMilestoneType } from '@/lib/stellar/escrow-contract';
import { dbMilestonesToContractEnums } from '@/lib/stellar/milestone-map';

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
// Calls signAndSend() on an already-assembled Soroban AssembledTransaction
// using the platform keypair as the signer. This is the correct pattern for
// server-side signing — using TransactionBuilder.fromXDR() + tx.sign() on a
// Soroban-assembled XDR produces txMalformed because the auth/footprint
// entries embedded by the SDK are not preserved through that round-trip.
//
// Returns the confirmed transaction hash on success.
// Returns null (without throwing) ONLY when the platform secret key is absent.
// Throws a descriptive Error for every other failure.
async function platformSignAndSend(
  assembled: AssembledTransaction<any>,
): Promise<string | null> {
  if (!PLATFORM_SECRET || !PLATFORM_ADDRESS) {
    console.warn('[Stellar] PLATFORM_STELLAR_SECRET_KEY not set — skipping chain call.');
    return null;
  }

  const keypair = Keypair.fromSecret(PLATFORM_SECRET);

  const sent = await assembled.signAndSend({
    signTransaction: async (xdr: string): Promise<string> => {
      // In SDK v16 the signTransaction callback receives the unsigned XDR
      // string and must return the signed XDR as a plain base64 string.
      // We parse with Transaction (not TransactionBuilder) so the Soroban
      // auth footprint entries embedded by the SDK are preserved.
      const tx = new Transaction(xdr, NETWORK_PASSPHRASE);
      tx.sign(keypair);
      // toEnvelope().toXDR('base64') returns a string in stellar-sdk v16.
      return tx.toEnvelope().toXDR('base64') as string;
    },
  });

  // In SDK v16 AssembledTransaction.signAndSend() resolves to a
  // SendTransactionResponse-like object. The hash is on .hash.
  // Older shapes put it on .sendTransactionResponse.hash — check both.
  const hash: string | undefined =
    (sent as any)?.hash ??
    (sent as any)?.sendTransactionResponse?.hash;

  if (!hash) {
    // Log the full result so we can diagnose any future shape changes.
    console.error('[Stellar] platformSignAndSend: no hash in result:', JSON.stringify(sent));
    throw new Error('Transaction submitted but no hash returned from Stellar.');
  }

  return hash;
}

// Legacy helper kept for non-Soroban usages (plain Stellar payments in releaseEscrow).
// For Soroban contract calls use platformSignAndSend() above.
async function platformSignAndSubmit(xdr: string): Promise<string | null> {
  if (!PLATFORM_SECRET || !PLATFORM_ADDRESS) {
    console.warn('[Stellar] PLATFORM_STELLAR_SECRET_KEY not set — skipping chain call.');
    return null;
  }

  const keypair = Keypair.fromSecret(PLATFORM_SECRET);
  const server  = new SorobanServer(RPC_URL);

  // Deserialise the assembled XDR and attach the platform signature.
  const tx = new Transaction(xdr, NETWORK_PASSPHRASE);
  tx.sign(keypair);

  let sendResult: Awaited<ReturnType<typeof server.sendTransaction>>;
  try {
    sendResult = await server.sendTransaction(tx);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error('[Stellar] sendTransaction threw:', err);
    throw new Error(`Stellar RPC sendTransaction failed: ${msg}`);
  }

  if (sendResult.status === 'ERROR') {
    const detail = JSON.stringify((sendResult as any).errorResult ?? (sendResult as any).error ?? 'unknown');
    console.error('[Stellar] sendTransaction ERROR:', detail);
    throw new Error(`Stellar rejected the transaction: ${detail}`);
  }

  const { hash } = sendResult;

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    let check: Awaited<ReturnType<typeof server.getTransaction>>;
    try {
      check = await server.getTransaction(hash);
    } catch (err: any) {
      console.warn(`[Stellar] getTransaction poll error (attempt ${i + 1}):`, err?.message ?? err);
      continue;
    }
    if (check.status === 'SUCCESS') return hash;
    if (check.status === 'FAILED') {
      const resultXdr = (check as any).resultXdr ?? (check as any).resultMetaXdr ?? '';
      console.error(`[Stellar] Transaction FAILED on-chain. Hash: ${hash}`, resultXdr);
      throw new Error(`Transaction failed on-chain (hash: ${hash})${resultXdr ? ` — result: ${resultXdr}` : ''}`);
    }
  }

  throw new Error(`Transaction timed out after 2 minutes (hash: ${hash}). Check https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${hash}`);
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

    const [milestones, priorityMilestones, documents, assignments, vaultFolder] =
      await Promise.all([
        dbStore.getMilestones(shipment.id),
        dbStore.getPriorityMilestones(shipment.id),
        dbStore.getDocuments(shipment.id),
        dbStore.getAssignmentsForShipment(shipment.id),
        dbStore.getVaultFolderByShipmentId(shipment.id),
      ]);

    // Only expose the vault folder ID (never the password)
    const vaultFolderId = vaultFolder?.id ?? null;

    return NextResponse.json({
      success: true,
      data: { shipment, milestones, priorityMilestones, documents, assignments, vaultFolderId },
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
  const { errorResponse, user: authedUser } = await requireAuth(req);
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
      const { loggedById, type, description, evidenceUrl, evidenceRef } = body;

      if (!loggedById || !type) {
        return NextResponse.json(
          { success: false, error: 'loggedById and type are required' },
          { status: 400 },
        );
      }
      if (!evidenceUrl && !evidenceRef && !description) {
        return NextResponse.json(
          { success: false, error: 'At least one of evidenceUrl, evidenceRef, or description is required' },
          { status: 400 },
        );
      }

      const newMilestone: MilestoneEvent = {
        id:          'me_' + Math.random().toString(36).substring(2, 9),
        shipmentId:  shipment.id,
        loggedById,
        type,
        description,
        evidenceUrl:  evidenceUrl ?? undefined,
        evidenceRef:  evidenceRef ?? undefined,
        occurredAt:  new Date().toISOString(),
        verified:    true,
      };

      await dbStore.saveMilestone(newMilestone);
      await dbStore.updatePriorityMilestoneStatus(shipment.id, type, true);

      // Update shipment status in DB.
      // Rules are ordered from latest → earliest in the shipment lifecycle so
      // that logging an advanced milestone always wins over an earlier one,
      // but logging an earlier milestone never rolls the status backward.
      const STATUS_RANK: Record<ShipmentStatus, number> = {
        PENDING_EXPORTER:  0,
        COUNTER_OFFER:     1,
        CONFIRMED:         2,
        ESCROW_FUNDED:     3,
        IN_TRANSIT:        4,
        AT_PORT:           5,
        CUSTOMS_CLEARANCE: 6,
        OUT_FOR_DELIVERY:  7,
        DELIVERED:         8,
        DISPUTED:          9,
        CANCELLED:        10,
      };

      let nextStatus: ShipmentStatus = shipment.status;

      // Map milestone type → the shipment status it represents
      const MILESTONE_TO_STATUS: Partial<Record<string, ShipmentStatus>> = {
        // Cargo prep / booking — moves out of ESCROW_FUNDED into active transit
        BOOKING_CONFIRMED:              'IN_TRANSIT',
        DOCUMENTS_SUBMITTED_TO_CARRIER: 'IN_TRANSIT',
        SPACE_ON_VESSEL_SECURED:        'IN_TRANSIT',
        CONTAINER_GATED_OUT_ORIGIN:     'IN_TRANSIT',
        CONTAINER_LOADED_ON_VESSEL:     'IN_TRANSIT',
        VESSEL_CLEARED_TO_DEPART:       'IN_TRANSIT',
        VESSEL_DEPARTED_ORIGIN:         'IN_TRANSIT',
        BILL_OF_LADING_ISSUED:          'IN_TRANSIT',
        // Arrived at destination port
        VESSEL_ARRIVED_AT_BERTH:        'AT_PORT',
        VESSEL_ARRIVED_DESTINATION:     'AT_PORT',
        CONTAINER_OFFLOADED:            'AT_PORT',
        CONTAINER_GATED_IN_DESTINATION: 'AT_PORT',
        // Customs processing
        BOC_ENTRY_FILED:                'CUSTOMS_CLEARANCE',
        PORT_HOLD_PLACED_OR_LIFTED:     'CUSTOMS_CLEARANCE',
        CUSTOMS_EXAMINATION_REQUESTED:  'CUSTOMS_CLEARANCE',
        DUTIES_AND_TAXES_PAID:          'CUSTOMS_CLEARANCE',
        CUSTOMS_CLEARANCE_APPROVED:     'CUSTOMS_CLEARANCE',
        CARGO_RELEASED_FOR_PICKUP:      'CUSTOMS_CLEARANCE',
        // Last-mile delivery
        CARGO_PICKED_UP_FROM_PORT:      'OUT_FOR_DELIVERY',
        CARGO_RECEIVED_AT_WAREHOUSE:    'OUT_FOR_DELIVERY',
        CARGO_INSPECTED_AND_PACKED:     'OUT_FOR_DELIVERY',
        CARGO_STAGED_FOR_PICKUP:        'OUT_FOR_DELIVERY',
        CARGO_HANDED_OFF_TO_CARRIER:    'OUT_FOR_DELIVERY',
        CARGO_READY_FOR_COLLECTION:     'OUT_FOR_DELIVERY',
        IN_TRANSIT_TO_DESTINATION:      'OUT_FOR_DELIVERY',
        ARRIVED_AT_DELIVERY_ADDRESS:    'OUT_FOR_DELIVERY',
        INCOMING_CARGO_STORED:          'OUT_FOR_DELIVERY',
        // Final
        DELIVERED_AND_SIGNED_OFF:       'DELIVERED',
      };

      const candidateStatus = MILESTONE_TO_STATUS[type];
      // Only advance — never roll backward if an older milestone is logged late
      if (
        candidateStatus &&
        STATUS_RANK[candidateStatus] > STATUS_RANK[shipment.status]
      ) {
        nextStatus = candidateStatus;
      }

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

        let stageAssembled: AssembledTransaction<any> | null = null;

        if (type === 'VESSEL_DEPARTED_ORIGIN') {
          // PRE_DEPARTURE → IN_TRANSIT
          try {
            stageAssembled = await client.advance_stage({
              reference_code: shipment.referenceCode,
              platform:       PLATFORM_ADDRESS,
              new_stage:      CancellationStage.InTransit,
            });
          } catch (err) {
            console.error('[Stellar] advance_stage(InTransit) build failed:', err);
          }
        } else if (type === 'DELIVERED_AND_SIGNED_OFF') {
          // IN_TRANSIT → DELIVERED
          try {
            stageAssembled = await client.advance_stage({
              reference_code: shipment.referenceCode,
              platform:       PLATFORM_ADDRESS,
              new_stage:      CancellationStage.Delivered,
            });
          } catch (err) {
            console.error('[Stellar] advance_stage(Delivered) build failed:', err);
          }
        }

        if (stageAssembled) {
          const txHash = await platformSignAndSend(stageAssembled);
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
      // Only the importer on this shipment may trigger a release
      if (authedUser!.id !== shipment.importerId) {
        return NextResponse.json(
          { success: false, error: 'Only the importer may release escrow funds' },
          { status: 403 },
        );
      }

      const { evidenceUrl, txHash } = body;
      if (!evidenceUrl) {
        return NextResponse.json(
          { success: false, error: 'evidenceUrl is required to confirm escrow release' },
          { status: 400 },
        );
      }

      // Escrow must currently be FUNDED — guard against double-release
      if (shipment.escrowStatus !== 'FUNDED') {
        return NextResponse.json(
          { success: false, error: `Escrow is already ${shipment.escrowStatus} — cannot release again` },
          { status: 409 },
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

      // Notify the exporter that funds have been released to their wallet
      if (shipment.exporterId) {
        await notifyUser({
          userId:   shipment.exporterId,
          type:     'ESCROW_RELEASED',
          title:    '💸 Escrow Released — Funds Incoming',
          body:     `${shipment.totalValueUSD?.toLocaleString()} USDC from shipment ${shipment.referenceCode} has been released and is on its way to your Stellar wallet.`,
          linkHref: `/shipments/${shipment.id}`,
        });
      }

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
    // NOTE: Marks escrow as PENDING_REFUND in DB. The actual on-chain Soroban
    // cancel() call must be submitted by the importer via the UI (freighter).
    // Only FUNDED escrows can be cancelled — already-released ones cannot.
    if (action === 'CANCEL_SHIPMENT') {
      if (shipment.escrowStatus === 'RELEASED') {
        return NextResponse.json(
          { success: false, error: 'Escrow has already been released — cancellation not allowed' },
          { status: 409 },
        );
      }

      // If unfunded (no real chain record), we can mark REFUNDED immediately.
      // If funded on-chain, stay at FUNDED until the on-chain cancel() is confirmed
      // and the UI calls UPDATE_STELLAR_ESCROW with escrowStatus: 'REFUNDED'.
      const nextEscrowStatus = shipment.escrowStatus === 'FUNDED' ? 'FUNDED' : 'REFUNDED';

      const updated = {
        ...shipment,
        status:       'CANCELLED'         as const,
        escrowStatus: nextEscrowStatus     as any,
        updatedAt:    new Date().toISOString(),
      };
      await dbStore.saveShipment(updated);
      return NextResponse.json({ success: true, data: updated });
    }

    // ── 8. CHAIN CONFIRM MILESTONES ────────────────────────────────────────────
    // Server-side: the platform keypair calls confirm_milestone() on-chain for
    // every DB priority milestone that is completed but not yet confirmed on-chain.
    // This satisfies the Soroban milestone gate before release() is called.
    // Triggered by the client AFTER assign_logistics_users([platform]) is signed.
    if (action === 'CHAIN_CONFIRM_MILESTONES') {
      if (authedUser!.id !== shipment.importerId) {
        return NextResponse.json(
          { success: false, error: 'Only the importer may trigger on-chain milestone confirmation' },
          { status: 403 },
        );
      }

      if (!shipment.referenceCode) {
        return NextResponse.json(
          { success: false, error: 'Shipment has no referenceCode — cannot confirm milestones on-chain' },
          { status: 400 },
        );
      }

      if (!PLATFORM_SECRET || !PLATFORM_ADDRESS) {
        // No platform key configured — skip silently so the release flow can continue.
        console.warn('[CHAIN_CONFIRM_MILESTONES] Platform secret not set — skipping on-chain confirmation.');
        return NextResponse.json({ success: true, data: { confirmed: 0, skipped: true } });
      }

      // Collect all DB-completed priority milestones for this shipment.
      const priorityMilestones = await dbStore.getPriorityMilestones(shipment.id);
      const completedDbTypes   = priorityMilestones
        .filter(pm => pm.isCompleted)
        .map(pm => pm.type);

      // Convert DB string enums → Soroban contract numeric enums, dropping
      // any milestone types that have no on-chain equivalent (e.g. FAILED_DELIVERY_ATTEMPT).
      const contractEnums = dbMilestonesToContractEnums(completedDbTypes as any[]);

      const client = getMariTradeEscrowClient(
        STELLAR_NETWORK as 'testnet' | 'mainnet',
        PLATFORM_ADDRESS,
      );

      // Query which milestones are already confirmed on-chain so we skip them
      // (re-confirming returns MilestoneAlreadyConfirmed #14 and wastes a tx).
      let alreadyConfirmed: ContractMilestoneType[] = [];
      try {
        const confirmedTx = await client.get_confirmed_milestones({
          reference_code: shipment.referenceCode,
        });
        if (confirmedTx.result?.isOk()) {
          alreadyConfirmed = confirmedTx.result.unwrap().map((c: any) => c.milestone_type as ContractMilestoneType);
        }
      } catch (err) {
        console.warn('[CHAIN_CONFIRM_MILESTONES] Could not fetch existing confirmed milestones — will attempt all:', err);
      }

      const pending = contractEnums.filter(e => !alreadyConfirmed.includes(e));

      let confirmed = 0;
      const errors: string[] = [];

      for (const milestoneEnum of pending) {
        try {
          const tx = await client.confirm_milestone({
            reference_code: shipment.referenceCode,
            confirmer:      PLATFORM_ADDRESS,
            milestone_type: milestoneEnum,
            // Synthetic evidence URI — the DB record is the canonical source of truth.
            evidence_uri:   `db://platform-auto/${shipment.referenceCode}/${milestoneEnum}`,
          });
          // platformSignAndSend uses signAndSend() on the AssembledTransaction
          // directly — the correct path for Soroban contract calls server-side.
          const hash = await platformSignAndSend(tx);
          if (hash) {
            confirmed++;
            console.log(`[CHAIN_CONFIRM_MILESTONES] ✓ milestone ${milestoneEnum} confirmed. Hash: ${hash}`);
          }
        } catch (err: any) {
          const msg = err?.message ?? String(err);
          // Error #14 = MilestoneAlreadyConfirmed — idempotent, treat as success.
          // The Soroban SDK encodes contract errors as "Error(Contract, #14)" or similar.
          const isAlreadyConfirmed =
            msg.includes('MilestoneAlreadyConfirmed') ||
            msg.includes('Error(Contract, #14)') ||
            (msg.includes('14') && msg.toLowerCase().includes('already'));
          if (isAlreadyConfirmed) {
            confirmed++;
          } else {
            console.error(`[CHAIN_CONFIRM_MILESTONES] Failed for milestone ${milestoneEnum}:`, msg);
            errors.push(`Milestone ${milestoneEnum}: ${msg}`);
          }
        }
      }

      // Partial failure is OK — as long as at least one confirmed successfully
      // (or everything was already confirmed) we let the release proceed.
      if (errors.length > 0 && confirmed === 0 && pending.length > 0) {
        return NextResponse.json(
          { success: false, error: `On-chain milestone confirmation failed: ${errors.join('; ')}` },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          confirmed,
          total:   pending.length,
          errors:  errors.length > 0 ? errors : undefined,
        },
      });
    }

    // ── 9. FILE DISPUTE ─────────────────────────────────────────────────────
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
