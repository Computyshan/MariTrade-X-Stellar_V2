/**
 * /api/shipments/[id]/escrow-cancel
 *
 * Handles all server-side escrow cancellation and dispute flows.
 *
 * ── ACTIONS ──────────────────────────────────────────────────────────────────
 *
 * POST { action: "prepare_cancel", importerAddress }
 *   Determines the cancellation stage from the on-chain escrow record, then:
 *   - UNFUNDED     → builds cancel() XDR for Freighter (importer-only signing)
 *   - PRE_DEPARTURE → builds cancel() XDR, platform co-signs auth entries
 *                     server-side, returns partially-authorized XDR for Freighter
 *   - IN_TRANSIT   → returns { requiresDispute: true }
 *   - DELIVERED    → returns 409 error
 *   Falls back to DB-only (no chain) if Stellar is unreachable.
 *   Returns { cancelXdr, stage, refundBps, refundAmount } | { requiresDispute }
 *
 * POST { action: "submit_cancel", cancelSignedXdr }
 *   Receives the Freighter-signed cancel XDR, submits it to Stellar,
 *   polls for confirmation, returns { txHash }.
 *
 * POST { action: "confirm_cancel", txHash? }
 *   Called after cancel is confirmed (or for DB-only). Updates DB:
 *   escrowStatus → REFUNDED, status → CANCELLED. Sends notifications.
 *
 * POST { action: "raise_dispute", importerAddress }
 *   Builds raise_dispute() XDR for Freighter (importer-only signing — the
 *   contract only requires importer.require_auth(), no platform co-sign).
 *   Falls back to DB-only if Stellar is unreachable/unconfigured.
 *   Returns { disputeXdr, dbOnly } | { dbOnly: true }
 *
 * POST { action: "submit_raise_dispute", disputeSignedXdr }
 *   Receives the Freighter-signed raise_dispute XDR, submits it to Stellar,
 *   polls for confirmation, returns { txHash }.
 *
 * POST { action: "confirm_raise_dispute", txHash? }
 *   Called after raise_dispute is confirmed on-chain (or for DB-only).
 *   Updates DB to DISPUTED. Sends notifications to both parties.
 *
 * POST { action: "resolve_dispute", importerBps, exporterBps }
 *   Platform admin only. Calls resolve_dispute() on-chain, splits funds,
 *   updates DB to CANCELLED/REFUNDED. Sends notifications.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Address, Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import { Server as SorobanServer } from '@stellar/stellar-sdk/rpc';
import { AssembledTransaction, basicNodeSigner } from '@stellar/stellar-sdk/contract';
import { requireAuth } from '@/lib/auth-guard';
import { dbStore } from '@/lib/db';
import { notifyUser } from '@/lib/notify';
import {
  getMariTradeEscrowClient,
  NetworkName,
  CancellationStage,
  EscrowStatus,
} from '@/lib/stellar/escrow-contract';

// ─── Network config ──────────────────────────────────────────────────────────

const STELLAR_NETWORK = (process.env.STELLAR_NETWORK ?? 'testnet') as NetworkName;
const RPC_URL =
  STELLAR_NETWORK === 'mainnet'
    ? 'https://soroban.stellar.org'
    : 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const PLATFORM_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';
const PLATFORM_SECRET  = process.env.PLATFORM_STELLAR_SECRET_KEY ?? '';

type Params = { id: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Sign + submit an AssembledTransaction server-side using the platform keypair.
 *  Uses basicNodeSigner which covers both signTransaction (envelope) AND
 *  signAuthEntry (Soroban auth entries) — both are needed for contract calls. */
async function platformSignAndSubmit(assembled: AssembledTransaction<any>): Promise<string> {
  const keypair = Keypair.fromSecret(PLATFORM_SECRET);
  const signer  = basicNodeSigner(keypair, NETWORK_PASSPHRASE);
  const server  = new SorobanServer(RPC_URL);

  const sent = await assembled.signAndSend({ ...signer, force: true });
  const hash: string | undefined = sent?.sendTransactionResponse?.hash;
  if (!hash) throw new Error('Transaction submitted but no hash returned from Stellar.');

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const check = await server.getTransaction(hash);
    if (check.status === 'SUCCESS') return hash;
    if (check.status === 'FAILED') {
      const resultXdr = (check as any).resultXdr ?? '';
      throw new Error(`Transaction failed on-chain (hash: ${hash})${resultXdr ? ` · ${resultXdr}` : ''}`);
    }
  }
  throw new Error(`Transaction timed out. Check: https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${hash}`);
}

/** Submit a pre-signed raw XDR envelope and poll for confirmation. */
async function submitSignedXdr(signedXdr: string): Promise<string> {
  const server = new SorobanServer(RPC_URL);
  const tx = new Transaction(signedXdr, NETWORK_PASSPHRASE);
  const sendResult = await server.sendTransaction(tx);

  if (sendResult.status === 'ERROR') {
    const detail = JSON.stringify((sendResult as any).errorResult ?? (sendResult as any).error ?? 'unknown');
    throw new Error(`Transaction rejected by Stellar: ${detail}`);
  }

  const { hash } = sendResult;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const check = await server.getTransaction(hash);
    if (check.status === 'SUCCESS') return hash;
    if (check.status === 'FAILED') {
      const resultXdr = (check as any).resultXdr ?? '';
      throw new Error(`Transaction failed on-chain (hash: ${hash})${resultXdr ? ` · ${resultXdr}` : ''}`);
    }
  }
  throw new Error(`Transaction timed out. Check: https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${hash}`);
}

function stageName(stage: CancellationStage): string {
  switch (stage) {
    case CancellationStage.Unfunded:     return 'UNFUNDED';
    case CancellationStage.PreDeparture: return 'PRE_DEPARTURE';
    case CancellationStage.InTransit:    return 'IN_TRANSIT';
    case CancellationStage.Delivered:    return 'DELIVERED';
    default: return 'UNKNOWN';
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { user: authedUser, errorResponse } = await requireAuth(req);
  if (errorResponse || !authedUser) {
    return errorResponse ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: shipmentId } = await params;

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { action, importerAddress, txHash, importerBps, exporterBps, cancelSignedXdr, disputeSignedXdr } = body;

  const shipment = await dbStore.getShipmentById(shipmentId);
  if (!shipment) {
    return NextResponse.json({ success: false, error: 'Shipment not found' }, { status: 404 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  prepare_cancel — determine stage, build and (partially) sign cancel XDR
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'prepare_cancel') {
    if (authedUser.id !== shipment.importerId) {
      return NextResponse.json(
        { success: false, error: 'Only the importer may cancel this shipment' },
        { status: 403 },
      );
    }
    if (!importerAddress) {
      return NextResponse.json({ success: false, error: 'importerAddress is required' }, { status: 400 });
    }
    if (shipment.escrowStatus === 'RELEASED') {
      return NextResponse.json(
        { success: false, error: 'Escrow has already been released — cannot cancel' },
        { status: 409 },
      );
    }

    // ── No Stellar config or no reference code → DB-only cancel ─────────────
    if (!PLATFORM_SECRET || !PLATFORM_ADDRESS || !shipment.referenceCode) {
      const isUnfunded = shipment.escrowStatus !== 'FUNDED';
      return NextResponse.json({
        success: true,
        data: {
          dbOnly: true,
          stage: isUnfunded ? 'UNFUNDED' : 'PRE_DEPARTURE',
          refundBps: 10000,
          refundAmount: shipment.totalValueUSD,
        },
      });
    }

    // ── Fetch on-chain escrow state ──────────────────────────────────────────
    let onChainStage: CancellationStage;
    let onChainStatus: EscrowStatus;
    let partialRefundBps: number;

    try {
      const client = getMariTradeEscrowClient(STELLAR_NETWORK, importerAddress);
      const escrowTx = await client.get_escrow({ reference_code: shipment.referenceCode });
      if (!escrowTx.result?.isOk()) throw new Error('get_escrow returned an error result');
      const record   = escrowTx.result.unwrap();
      onChainStage    = record.cancellation_stage as CancellationStage;
      onChainStatus   = record.status as EscrowStatus;
      partialRefundBps = record.partial_refund_bps;

      // ── TEMP DIAGNOSTIC ── print the raw on-chain record exactly as read,
      // before any of it gets mapped/renamed below. This is the ground truth
      // that cancel()'s simulation will branch on.
      console.log('[escrow-cancel][diag] raw on-chain record:', {
        reference_code: record.reference_code,
        importer: record.importer,
        exporter: record.exporter,
        platform: record.platform,
        status: EscrowStatus[record.status] ?? record.status,
        cancellation_stage: CancellationStage[record.cancellation_stage] ?? record.cancellation_stage,
        partial_refund_bps: record.partial_refund_bps,
      });
      console.log('[escrow-cancel][diag] request importerAddress:', importerAddress, '| env PLATFORM_ADDRESS:', PLATFORM_ADDRESS);

      // Fail fast if the caller's importer/platform addresses don't match the
      // ones baked into this escrow record at create_escrow() time. cancel()
      // checks these with early `return Err(...)` BEFORE any require_auth()
      // call — so on a mismatch, the later cancelTx.signAuthEntries() call
      // below finds zero auth entries at all (none were ever requested) and
      // throws the SDK's generic "No unsigned non-invoker auth entries"
      // error, which is useless for debugging. Surface the real cause here
      // instead, while the actual on-chain values are still in hand.
      if (record.importer !== importerAddress) {
        return NextResponse.json(
          {
            success: false,
            error: `This escrow's on-chain importer (${record.importer}) does not match the connected wallet (${importerAddress}). The cancel transaction cannot be authorized.`,
          },
          { status: 409 },
        );
      }
      if (record.platform !== PLATFORM_ADDRESS) {
        return NextResponse.json(
          {
            success: false,
            error: `This escrow's on-chain platform address (${record.platform}) does not match the server's current NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS (${PLATFORM_ADDRESS}). It was likely created with a different platform keypair — update .env.local to match, or re-create the escrow.`,
          },
          { status: 409 },
        );
      }
    } catch (err: any) {
      console.warn('[escrow-cancel] get_escrow failed, falling back to DB-only:', err.message);
      const isUnfunded = shipment.escrowStatus !== 'FUNDED';
      return NextResponse.json({
        success: true,
        data: {
          dbOnly: true,
          stage: isUnfunded ? 'UNFUNDED' : 'PRE_DEPARTURE',
          refundBps: 10000,
          refundAmount: shipment.totalValueUSD,
        },
      });
    }

    // Already settled on-chain
    if (
      onChainStatus === EscrowStatus.Released ||
      onChainStatus === EscrowStatus.Refunded
    ) {
      return NextResponse.json(
        { success: false, error: 'Escrow is already settled on-chain — cannot cancel' },
        { status: 409 },
      );
    }

    const stage = stageName(onChainStage);

    if (onChainStage === CancellationStage.Delivered) {
      return NextResponse.json(
        { success: false, error: 'Cancellation is not allowed after delivery confirmation on-chain' },
        { status: 409 },
      );
    }

    if (onChainStage === CancellationStage.InTransit) {
      return NextResponse.json({
        success: true,
        data: { requiresDispute: true, stage },
      });
    }

    // UNFUNDED or PRE_DEPARTURE — build cancel() tx
    const refundBps = onChainStage === CancellationStage.Unfunded ? 10000 : partialRefundBps!;
    const refundAmount = Math.floor((shipment.totalValueUSD * refundBps) / 10000);

    try {
      // Build with the importer as the source account so the simulation uses
      // their current sequence number.
      const importerClient = getMariTradeEscrowClient(STELLAR_NETWORK, importerAddress);
      const cancelTx = await importerClient.cancel({
        reference_code: shipment.referenceCode,
        importer: importerAddress,
        platform: PLATFORM_ADDRESS,
      });

      // ── TEMP DIAGNOSTIC ── did the cancel() simulation itself return Ok or
      // Err? If it errored, no auth entries would ever be requested (the
      // require_auth() calls in the PreDeparture branch are never reached),
      // which would otherwise look identical to "simulation succeeded but
      // needs no platform auth". This distinguishes the two cases.
      try {
        const simResult = (cancelTx as any).result;
        console.log('[escrow-cancel][diag] cancel() sim isErr:', simResult?.isErr?.());
        if (simResult?.isErr?.()) {
          console.log('[escrow-cancel][diag] cancel() sim error value:', simResult.unwrapErr());
        }
        console.log('[escrow-cancel][diag] simulation.error:', (cancelTx as any).simulation?.error);
        console.log('[escrow-cancel][diag] simulation.restorePreamble:', (cancelTx as any).simulation?.restorePreamble);
      } catch (simDiagErr: any) {
        console.log('[escrow-cancel][diag] sim result diagnostic failed:', simDiagErr?.message ?? simDiagErr);
      }

      if (onChainStage === CancellationStage.PreDeparture) {
        // ── TEMP DIAGNOSTIC ── log exactly what the simulation returned so we
        // can see how many Soroban auth entries exist and for which addresses,
        // before signAuthEntries() decides whether there's anything to sign.
        // Safe to remove once the PRE_DEPARTURE cancel flow is confirmed working.
        try {
          const rawAuth = (cancelTx.built as any)?.operations?.[0]?.auth ?? [];
          console.log(`[escrow-cancel][diag] cancel() simulation returned ${rawAuth.length} auth entr${rawAuth.length === 1 ? 'y' : 'ies'}`);
          rawAuth.forEach((entry: any, i: number) => {
            try {
              const credType = entry.credentials().switch().name;
              if (credType === 'sorobanCredentialsAddress') {
                const addr = Address.fromScAddress(entry.credentials().address().address()).toString();
                const sigSet = entry.credentials().address().signature().switch().name !== 'scvVoid';
                console.log(`[escrow-cancel][diag]   [${i}] type=Address address=${addr} alreadySigned=${sigSet}`);
              } else {
                console.log(`[escrow-cancel][diag]   [${i}] type=${credType} (invoker/source-account — no explicit signature needed)`);
              }
            } catch (introspectErr: any) {
              console.log(`[escrow-cancel][diag]   [${i}] could not introspect entry:`, introspectErr?.message ?? introspectErr);
            }
          });
          console.log('[escrow-cancel][diag] needsNonInvokerSigningBy():', cancelTx.needsNonInvokerSigningBy());
        } catch (diagErr: any) {
          console.log('[escrow-cancel][diag] diagnostic logging failed:', diagErr?.message ?? diagErr);
        }

        // Platform must co-sign its auth entry before returning to the browser.
        // Freighter will add the importer's envelope signature (which satisfies
        // the importer's source-account auth entry automatically in Soroban).
        const keypair = Keypair.fromSecret(PLATFORM_SECRET);
        const signer  = basicNodeSigner(keypair, NETWORK_PASSPHRASE);
        await cancelTx.signAuthEntries({
          address: PLATFORM_ADDRESS,
          signAuthEntry: signer.signAuthEntry,
        });
      }
      // UNFUNDED: platform auth is required but since the escrow has no funds
      // the contract call just marks it refunded. We still need both auths per
      // the contract signature but for the UNFUNDED case the importer alone
      // is sufficient (contract checks stage before require_auth for platform).
      // The contract's cancel() for UNFUNDED only calls importer.require_auth().

      const cancelXdr = cancelTx.toXDR();
      return NextResponse.json({ success: true, data: { cancelXdr, stage, refundBps, refundAmount } });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error('[escrow-cancel] prepare_cancel build failed:', msg);
      return NextResponse.json(
        { success: false, error: `Failed to build cancel transaction: ${msg}` },
        { status: 500 },
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  submit_cancel — browser Freighter-signed the XDR; server submits + polls
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'submit_cancel') {
    if (authedUser.id !== shipment.importerId) {
      return NextResponse.json({ success: false, error: 'Only the importer may cancel' }, { status: 403 });
    }
    if (!cancelSignedXdr) {
      return NextResponse.json({ success: false, error: 'cancelSignedXdr is required' }, { status: 400 });
    }

    try {
      const confirmedHash = await submitSignedXdr(cancelSignedXdr);
      return NextResponse.json({ success: true, data: { txHash: confirmedHash } });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const friendly =
        msg.includes('#19') || msg.includes('CancellationNotAllowed')
          ? 'Cancellation is not allowed at this stage on-chain.'
          : msg.includes('#20') || msg.includes('RequiresPlatformArbitration')
          ? 'In-transit cancellations require dispute arbitration. Use "File Dispute" instead.'
          : msg.includes('#17') || msg.includes('AlreadySettled')
          ? 'This escrow has already been settled on-chain.'
          : msg.includes('#21') || msg.includes('RequiresBothPartiesForPreDeparture')
          ? 'Pre-departure cancellation requires both importer and platform signatures.'
          : msg;
      return NextResponse.json({ success: false, error: friendly }, { status: 500 });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  confirm_cancel — DB sync (called after on-chain cancel confirmed, or DB-only)
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'confirm_cancel') {
    if (authedUser.id !== shipment.importerId) {
      return NextResponse.json({ success: false, error: 'Only the importer may cancel' }, { status: 403 });
    }

    const updated = {
      ...shipment,
      status:          'CANCELLED'  as const,
      escrowStatus:    'REFUNDED'   as any,
      stellarEscrowId: txHash ?? shipment.stellarEscrowId,
      updatedAt:       new Date().toISOString(),
    };
    await dbStore.saveShipment(updated);

    await notifyUser({
      userId:   shipment.importerId,
      type:     'SHIPMENT_STATUS_CHANGE',
      title:    '🔄 Shipment Cancelled — Refund Initiated',
      body:     `Shipment ${shipment.referenceCode} has been cancelled. Your USDC refund has been processed on the Stellar ledger.`,
      linkHref: `/shipments/${shipment.id}`,
    });
    if (shipment.exporterId) {
      await notifyUser({
        userId:   shipment.exporterId,
        type:     'SHIPMENT_STATUS_CHANGE',
        title:    '⚠️ Shipment Cancelled by Importer',
        body:     `Shipment ${shipment.referenceCode} has been cancelled. The escrow has been refunded per the agreed cancellation policy.`,
        linkHref: `/shipments/${shipment.id}`,
      });
    }

    return NextResponse.json({ success: true, data: updated });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  raise_dispute — prepare the Freighter-signable raise_dispute() XDR
  //  (importer-only signing — the contract only requires importer.require_auth(),
  //  no platform co-sign needed, unlike PRE_DEPARTURE cancel).
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'raise_dispute') {
    if (authedUser.id !== shipment.importerId) {
      return NextResponse.json({ success: false, error: 'Only the importer may raise a dispute' }, { status: 403 });
    }
    if (!importerAddress) {
      return NextResponse.json({ success: false, error: 'importerAddress is required' }, { status: 400 });
    }
    if (shipment.escrowStatus === 'DISPUTED') {
      return NextResponse.json({ success: false, error: 'A dispute is already open for this shipment' }, { status: 409 });
    }
    if (shipment.escrowStatus !== 'FUNDED') {
      return NextResponse.json(
        { success: false, error: 'Escrow must be in FUNDED state to raise a dispute' },
        { status: 409 },
      );
    }

    // No Stellar config or no reference code → DB-only dispute (same fallback
    // pattern as prepare_cancel).
    if (!PLATFORM_SECRET || !PLATFORM_ADDRESS || !shipment.referenceCode) {
      return NextResponse.json({ success: true, data: { dbOnly: true } });
    }

    try {
      // Build with the importer as the source account so the simulation uses
      // their current sequence number. raise_dispute() only calls
      // importer.require_auth() — Freighter's envelope signature alone
      // satisfies it, so no platformSignAndSubmit / auth-entry co-sign step
      // is needed here at all.
      const importerClient = getMariTradeEscrowClient(STELLAR_NETWORK, importerAddress);
      const disputeTx = await importerClient.raise_dispute({
        reference_code: shipment.referenceCode,
        importer: importerAddress,
      });
      const disputeXdr = disputeTx.toXDR();
      return NextResponse.json({ success: true, data: { disputeXdr } });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error('[escrow-cancel] prepare raise_dispute build failed:', msg);
      return NextResponse.json(
        { success: false, error: `Failed to build dispute transaction: ${msg}` },
        { status: 500 },
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  submit_raise_dispute — browser Freighter-signed the XDR; server submits + polls
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'submit_raise_dispute') {
    if (authedUser.id !== shipment.importerId) {
      return NextResponse.json({ success: false, error: 'Only the importer may raise a dispute' }, { status: 403 });
    }
    if (!disputeSignedXdr) {
      return NextResponse.json({ success: false, error: 'disputeSignedXdr is required' }, { status: 400 });
    }

    try {
      const confirmedHash = await submitSignedXdr(disputeSignedXdr);
      return NextResponse.json({ success: true, data: { txHash: confirmedHash } });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const friendly =
        msg.includes('#22') || msg.includes('NotInTransit')
          ? 'Disputes can only be raised while the shipment is in transit.'
          : msg.includes('#17') || msg.includes('AlreadySettled')
          ? 'This escrow has already been settled on-chain.'
          : msg;
      return NextResponse.json({ success: false, error: friendly }, { status: 500 });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  confirm_raise_dispute — DB sync (called after on-chain dispute confirmed,
  //  or for DB-only)
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'confirm_raise_dispute') {
    if (authedUser.id !== shipment.importerId) {
      return NextResponse.json({ success: false, error: 'Only the importer may raise a dispute' }, { status: 403 });
    }

    const updated = {
      ...shipment,
      status:       'DISPUTED' as const,
      escrowStatus: 'DISPUTED' as any,
      updatedAt:    new Date().toISOString(),
    };
    await dbStore.saveShipment(updated);

    await notifyUser({
      userId:   shipment.importerId,
      type:     'SHIPMENT_STATUS_CHANGE',
      title:    '⚠️ Dispute Raised — Arbitration Pending',
      body:     `Your dispute for shipment ${shipment.referenceCode} has been submitted. MariTrade will review the case and contact both parties within 3–5 business days.`,
      linkHref: `/shipments/${shipment.id}`,
    });
    if (shipment.exporterId) {
      await notifyUser({
        userId:   shipment.exporterId,
        type:     'SHIPMENT_STATUS_CHANGE',
        title:    '⚠️ Shipment Under Dispute',
        body:     `A dispute has been raised for shipment ${shipment.referenceCode}. MariTrade will arbitrate and contact both parties with a resolution.`,
        linkHref: `/shipments/${shipment.id}`,
      });
    }

    return NextResponse.json({ success: true, data: { shipment: updated, txHash: txHash ?? null } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  resolve_dispute — platform admin splits the locked funds and closes escrow
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'resolve_dispute') {
    // Gate: must be the platform wallet, an app-level ADMIN account, or —
    // in sandbox — any authenticated user. requireAuth only returns
    // { id, email } from the JWT — not stellarWallet/userType — so we do a
    // quick DB lookup to get the caller's full profile.
    let resolvedIsPlatform = process.env.NODE_ENV === 'development';
    if (!resolvedIsPlatform) {
      try {
        const callerProfile = await dbStore.getUserById(authedUser!.id);
        resolvedIsPlatform =
          callerProfile?.userType === 'ADMIN' ||
          (!!PLATFORM_ADDRESS && callerProfile?.stellarWallet === PLATFORM_ADDRESS);
      } catch {
        resolvedIsPlatform = false;
      }
    }

    if (!resolvedIsPlatform) {
      return NextResponse.json(
        { success: false, error: 'Only the MariTrade platform may resolve disputes' },
        { status: 403 },
      );
    }
    if (typeof importerBps !== 'number' || typeof exporterBps !== 'number') {
      return NextResponse.json(
        { success: false, error: 'importerBps and exporterBps (numbers 0–10000) are required' },
        { status: 400 },
      );
    }
    if (importerBps < 0 || exporterBps < 0 || importerBps + exporterBps > 10000) {
      return NextResponse.json(
        { success: false, error: 'importerBps + exporterBps cannot exceed 10 000 (100%)' },
        { status: 400 },
      );
    }
    if (shipment.escrowStatus !== 'DISPUTED') {
      return NextResponse.json(
        { success: false, error: `Escrow is not in DISPUTED state (current: ${shipment.escrowStatus})` },
        { status: 409 },
      );
    }

    let onChainHash: string | null = null;
    if (PLATFORM_SECRET && PLATFORM_ADDRESS && shipment.referenceCode) {
      try {
        const client = getMariTradeEscrowClient(STELLAR_NETWORK, PLATFORM_ADDRESS);
        const resolveTx = await client.resolve_dispute({
          reference_code: shipment.referenceCode,
          platform: PLATFORM_ADDRESS,
          importer_bps: importerBps,
          exporter_bps: exporterBps,
        });
        onChainHash = await platformSignAndSubmit(resolveTx);
        console.log(`[escrow-cancel] ✓ resolve_dispute on-chain. Hash: ${onChainHash}`);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        console.error('[escrow-cancel] resolve_dispute on-chain failed:', msg);
        return NextResponse.json(
          { success: false, error: `On-chain dispute resolution failed: ${msg}` },
          { status: 500 },
        );
      }
    }

    const importerAmount = Math.floor((shipment.totalValueUSD * importerBps) / 10000);
    const exporterAmount = Math.floor((shipment.totalValueUSD * exporterBps) / 10000);
    const platformFee    = shipment.totalValueUSD - importerAmount - exporterAmount;

    const updated = {
      ...shipment,
      status:          'CANCELLED'  as const,
      escrowStatus:    'REFUNDED'   as any,
      stellarEscrowId: onChainHash ?? shipment.stellarEscrowId,
      updatedAt:       new Date().toISOString(),
    };
    await dbStore.saveShipment(updated);

    await notifyUser({
      userId:   shipment.importerId,
      type:     'ESCROW_RELEASED',
      title:    '⚖️ Dispute Resolved — Refund Processed',
      body:     `MariTrade has resolved the dispute for shipment ${shipment.referenceCode}. You have been refunded $${importerAmount.toLocaleString()} USDC (${(importerBps / 100).toFixed(1)}%).`,
      linkHref: `/shipments/${shipment.id}`,
    });
    if (shipment.exporterId) {
      await notifyUser({
        userId:   shipment.exporterId,
        type:     'ESCROW_RELEASED',
        title:    '⚖️ Dispute Resolved — Payment Processed',
        body:     `MariTrade has resolved the dispute for shipment ${shipment.referenceCode}. You have been paid $${exporterAmount.toLocaleString()} USDC (${(exporterBps / 100).toFixed(1)}%).`,
        linkHref: `/shipments/${shipment.id}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: { shipment: updated, onChainHash, split: { importerAmount, exporterAmount, platformFee } },
    });
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
}
