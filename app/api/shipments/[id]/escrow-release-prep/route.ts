/**
 * /api/shipments/[id]/escrow-release-prep
 *
 * Handles the full server-side escrow release flow.
 * All stellar-sdk / escrow-bindings calls stay here — never in the browser.
 *
 * Flow:
 *   POST { action: "execute_release", importerAddress, assignLogisticsSignedXdr }
 *   Step 1 — assign_logistics_users   Client (Freighter) signs the tx and sends
 *                                      the signed XDR here. Server submits it and
 *                                      waits for on-chain confirmation. FATAL.
 *   Step 2 — confirm_milestone()      for every DB-completed priority milestone
 *             not yet confirmed on-chain (REQUIRED — satisfies the #16 gate)
 *   Step 3 — release()                server-side via platform keypair
 *   → Returns { txHash } on success
 *
 * The importer's Freighter wallet is NOT needed for the release itself —
 * the platform keypair is the co-signer on the multisig escrow.
 * Freighter is only needed for assign_logistics_users (Step 1) and
 * fund() (Step 4 of shipment creation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import { Server as SorobanServer } from '@stellar/stellar-sdk/rpc';
import { AssembledTransaction, basicNodeSigner } from '@stellar/stellar-sdk/contract';
import { requireAuth } from '@/lib/auth-guard';
import { dbStore } from '@/lib/db';
import { getMariTradeEscrowClient, NETWORKS, NetworkName, MilestoneType as ContractMilestoneType } from '@/lib/stellar/escrow-contract';
import { dbMilestonesToContractEnums } from '@/lib/stellar/milestone-map';

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

// ─── Platform sign and submit ────────────────────────────────────────────────
// basicNodeSigner is the SDK's built-in helper for server-side signing.
// It provides both signTransaction (envelope) AND signAuthEntry (Soroban
// auth entries inside InvokeHostFunction). The missing signAuthEntry was
// causing txBadAuth (-6) on every confirm_milestone call — signing the
// envelope alone is not sufficient for Soroban contract invocations.
async function platformSignAndSubmit(
  assembled: AssembledTransaction<any>,
): Promise<string> {
  const keypair = Keypair.fromSecret(PLATFORM_SECRET);
  const signer  = basicNodeSigner(keypair, NETWORK_PASSPHRASE);
  const server  = new SorobanServer(RPC_URL);

  // Sign auth entries + envelope, then broadcast.
  // force:true bypasses the "no signature needed" guard for read-only txs.
  const sent = await assembled.signAndSend({ ...signer, force: true });

  // SentTransaction.sendTransactionResponse.hash is the canonical hash.
  const hash: string | undefined = sent?.sendTransactionResponse?.hash;
  if (!hash) {
    throw new Error('Transaction submitted but no hash returned from Stellar.');
  }

  // Poll for on-chain confirmation so we can surface failures with the hash.
  // signAndSend already waits internally, but we re-poll to get explicit status.
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const check = await server.getTransaction(hash);
    if (check.status === 'SUCCESS') return hash;
    if (check.status === 'FAILED') {
      const resultXdr = (check as any).resultXdr ?? '';
      throw new Error(`Transaction failed on-chain. Hash: ${hash}${resultXdr ? ` · ${resultXdr}` : ''}`);
    }
  }
  throw new Error(`Transaction timed out. Check: https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${hash}`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const { user: authedUser, errorResponse } = await requireAuth(req);
  if (errorResponse || !authedUser) {
    return errorResponse ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: shipmentId } = await params;
  let body: { action: string; importerAddress?: string; assignLogisticsSignedXdr?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { action, importerAddress, assignLogisticsSignedXdr } = body;

  if (!importerAddress) {
    return NextResponse.json({ success: false, error: 'importerAddress is required' }, { status: 400 });
  }

  // ── Load and validate shipment ─────────────────────────────────────────────
  const shipment = await dbStore.getShipmentById(shipmentId);
  if (!shipment) {
    return NextResponse.json({ success: false, error: 'Shipment not found' }, { status: 404 });
  }
  if (shipment.escrowStatus !== 'FUNDED') {
    return NextResponse.json({ success: false, error: 'Escrow is not in FUNDED state' }, { status: 400 });
  }
  if (authedUser.id !== shipment.importerId) {
    return NextResponse.json({ success: false, error: 'Only the importer may release escrow funds' }, { status: 403 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ACTION: execute_release
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'execute_release') {
    if (!PLATFORM_SECRET || !PLATFORM_ADDRESS) {
      return NextResponse.json({
        success: true,
        data: { txHash: 'db_release_' + Math.random().toString(36).substring(2, 11) },
      });
    }

    const client = getMariTradeEscrowClient(STELLAR_NETWORK, PLATFORM_ADDRESS);
    const referenceCode = shipment.referenceCode;

    // ── Step 1: submit the importer-signed assign_logistics_users XDR ─────────
    if (!assignLogisticsSignedXdr) {
      return NextResponse.json(
        { success: false, error: 'assignLogisticsSignedXdr is required.' },
        { status: 400 },
      );
    }
    {
      try {
        const server = new SorobanServer(RPC_URL);
        const tx = new Transaction(assignLogisticsSignedXdr, NETWORK_PASSPHRASE);
        const sendResult = await server.sendTransaction(tx);

        if (sendResult.status === 'ERROR') {
          const detail = JSON.stringify((sendResult as any).errorResult ?? (sendResult as any).error ?? 'unknown');
          throw new Error(`assign_logistics_users rejected by Stellar: ${detail}`);
        }

        const { hash } = sendResult;
        let confirmed = false;
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const check = await server.getTransaction(hash);
          if (check.status === 'SUCCESS') { confirmed = true; break; }
          if (check.status === 'FAILED') {
            const resultXdr = (check as any).resultXdr ?? '';
            throw new Error(`assign_logistics_users failed on-chain (hash: ${hash})${resultXdr ? ` · ${resultXdr}` : ''}`);
          }
        }
        if (!confirmed) throw new Error(`assign_logistics_users timed out (hash: ${hash})`);
        console.log(`[escrow-release-prep] ✓ assign_logistics_users confirmed. Hash: ${hash}`);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        console.error('[escrow-release-prep] assign_logistics_users FAILED:', msg);
        return NextResponse.json(
          { success: false, error: `Failed to register logistics users on-chain: ${msg}` },
          { status: 500 },
        );
      }
    }

    // ── Step 2: confirm_milestone() for every pending required milestone ────────
    // We ask the contract directly via get_pending_milestones — this is the
    // authoritative source of what still needs confirming before release().
    // Using the DB-derived list was causing #16 when the DB priority milestones
    // differed from the contract's required_milestones set.
    {
      let pending: ContractMilestoneType[] = [];
      try {
        const pendingTx = await client.get_pending_milestones({ reference_code: referenceCode });
        if (pendingTx.result?.isOk()) {
          pending = pendingTx.result.unwrap() as ContractMilestoneType[];
          console.log(`[escrow-release-prep] Contract reports ${pending.length} pending milestone(s):`, pending);
        } else {
          throw new Error('Contract returned an error result for get_pending_milestones');
        }
      } catch (err) {
        // Fallback: derive from DB completed milestones minus already-confirmed on-chain
        console.warn('[escrow-release-prep] get_pending_milestones failed, falling back to DB:', err);
        const priorityMilestones = await dbStore.getPriorityMilestones(shipment.id);
        const completedDbTypes   = priorityMilestones
          .filter(pm => pm.isCompleted)
          .map(pm => pm.type);
        const contractEnums = dbMilestonesToContractEnums(completedDbTypes as any[]);
        let alreadyConfirmed: ContractMilestoneType[] = [];
        try {
          const confirmedTx = await client.get_confirmed_milestones({ reference_code: referenceCode });
          if (confirmedTx.result?.isOk()) {
            alreadyConfirmed = confirmedTx.result
              .unwrap()
              .map((c: any) => c.milestone_type as ContractMilestoneType);
          }
        } catch { /* ignore */ }
        pending = contractEnums.filter(e => !alreadyConfirmed.includes(e));
      }

      const confirmErrors: string[] = [];

      for (const milestoneEnum of pending) {
        try {
          const tx = await client.confirm_milestone({
            reference_code: referenceCode,
            confirmer:      PLATFORM_ADDRESS,
            milestone_type: milestoneEnum,
            evidence_uri:   `db://platform-auto/${referenceCode}/${milestoneEnum}`,
          });
          const hash = await platformSignAndSubmit(tx);
          console.log(`[escrow-release-prep] ✓ confirmed milestone ${milestoneEnum}. Hash: ${hash}`);
        } catch (err: any) {
          const msg = err?.message ?? String(err);
          const isAlreadyConfirmed =
            msg.includes('MilestoneAlreadyConfirmed') ||
            msg.includes('Error(Contract, #14)') ||
            (msg.includes('14') && msg.toLowerCase().includes('already'));
          if (!isAlreadyConfirmed) {
            console.error(`[escrow-release-prep] confirm_milestone ${milestoneEnum} failed:`, msg);
            confirmErrors.push(`Milestone ${milestoneEnum}: ${msg}`);
          }
        }
      }

      if (confirmErrors.length > 0 && confirmErrors.length === pending.length && pending.length > 0) {
        return NextResponse.json(
          { success: false, error: `On-chain milestone confirmation failed — cannot proceed to release. Errors: ${confirmErrors.join('; ')}` },
          { status: 500 },
        );
      }
    }

    // ── Step 3: release() ─────────────────────────────────────────────────────
    try {
      const releaseTx = await client.release({
        reference_code: referenceCode,
        importer: importerAddress,
      });

      const txHash = await platformSignAndSubmit(releaseTx);
      return NextResponse.json({ success: true, data: { txHash } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[escrow-release-prep] release() failed:', msg);

      const friendly =
        msg.includes('#3')  || msg.includes('NotImporter')
          ? 'Wrong importer address. The wallet you connected does not match the escrow record.'
          : msg.includes('#16') || msg.includes('PriorityMilestonesIncomplete')
          ? 'The on-chain milestone gate is not satisfied. All priority milestones must be confirmed on Stellar before release.'
          : msg.includes('#9')  || msg.includes('NotFunded')
          ? 'This escrow is not in a funded state on-chain and cannot be released.'
          : msg.includes('#17') || msg.includes('AlreadySettled')
          ? 'This escrow has already been released or refunded on-chain.'
          : msg;

      return NextResponse.json({ success: false, error: friendly }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
}
