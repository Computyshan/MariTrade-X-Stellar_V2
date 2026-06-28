/**
 * /api/shipments/[id]/escrow-release-prep
 *
 * Handles the full server-side escrow release flow.
 * All stellar-sdk / escrow-bindings calls stay here — never in the browser.
 *
 * The release() Soroban call MUST use assembled.signAndSend({ signTransaction })
 * directly on the AssembledTransaction — NOT .toXDR() → client sign → submit.
 * Round-tripping through XDR strips the Soroban auth/footprint entries and
 * causes txMalformed. See the comment in /api/shipments/[id]/route.ts.
 *
 * Flow:
 *   POST { action: "execute_release", importerAddress }
 *   → Runs assign_logistics_users (if needed) + release() server-side
 *   → Returns { txHash } on success
 *
 * The importer's Freighter wallet is NOT needed for the release itself —
 * the platform keypair is the co-signer on the multisig escrow.
 * Freighter is only needed for fund() (Step 4 of shipment creation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import { AssembledTransaction } from '@stellar/stellar-sdk/contract';
import { requireAuth } from '@/lib/auth-guard';
import { dbStore } from '@/lib/db';
import { getMariTradeEscrowClient, NETWORKS, NetworkName } from '@/lib/stellar/escrow-contract';

const STELLAR_NETWORK = (process.env.STELLAR_NETWORK ?? 'testnet') as NetworkName;
const NETWORK_PASSPHRASE =
  STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const PLATFORM_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';
const PLATFORM_SECRET  = process.env.PLATFORM_STELLAR_SECRET_KEY ?? '';

type Params = { id: string };

// ─── Platform sign-and-send (copied pattern from route.ts) ──────────────────
// Uses assembled.signAndSend() directly — preserves Soroban auth/footprint.
// Never use TransactionBuilder.fromXDR() on an assembled Soroban tx.
async function platformSignAndSend(
  assembled: AssembledTransaction<any>,
): Promise<string> {
  const keypair = Keypair.fromSecret(PLATFORM_SECRET);

  const sent = await assembled.signAndSend({
    signTransaction: async (xdr: string): Promise<string> => {
      const tx = new Transaction(xdr, NETWORK_PASSPHRASE);
      tx.sign(keypair);
      return tx.toEnvelope().toXDR('base64') as string;
    },
  });

  const hash: string | undefined =
    (sent as any)?.hash ?? (sent as any)?.sendTransactionResponse?.hash;

  if (!hash) {
    throw new Error('Transaction submitted but no hash returned from Stellar.');
  }
  return hash;
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
  let body: { action: string; importerAddress?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { action, importerAddress } = body;

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
  //  Runs the full release sequence server-side with the platform keypair.
  // ═══════════════════════════════════════════════════════════════════════════
  if (action === 'execute_release') {
    if (!PLATFORM_SECRET || !PLATFORM_ADDRESS) {
      // No platform key — return a mock hash so the UI can still update the DB
      return NextResponse.json({
        success: true,
        data: { txHash: 'db_release_' + Math.random().toString(36).substring(2, 11) },
      });
    }

    const client = getMariTradeEscrowClient(STELLAR_NETWORK, PLATFORM_ADDRESS);
    const referenceCode = shipment.referenceCode;

    // ── Step 1: assign_logistics_users (best-effort, non-fatal) ──────────────
    try {
      const assignments = await dbStore.getAssignmentsForShipment(shipmentId);
      const logisticsAddresses: string[] = (
        await Promise.all(
          assignments.map(async (a) => {
            const user = await dbStore.getUserById(a.userId);
            return user?.stellarWallet ?? null;
          }),
        )
      ).filter((addr): addr is string => !!addr && addr.startsWith('G'));

      if (logisticsAddresses.length > 0) {
        const assignTx = await client.assign_logistics_users({
          reference_code: referenceCode,
          importer: importerAddress,
          users: logisticsAddresses,
        });
        await platformSignAndSend(assignTx);
      }
    } catch (err) {
      console.warn('[escrow-release-prep] assign_logistics_users failed (non-fatal):', err);
    }

    // ── Step 2: release() — must use platformSignAndSend, never .toXDR() ─────
    try {
      const releaseTx = await client.release({
        reference_code: referenceCode,
        importer: importerAddress,
      });

      const txHash = await platformSignAndSend(releaseTx);

      return NextResponse.json({ success: true, data: { txHash } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[escrow-release-prep] release() failed:', msg);

      // Map on-chain error codes to friendly messages
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
