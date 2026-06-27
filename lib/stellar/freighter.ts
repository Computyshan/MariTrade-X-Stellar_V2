/**
 * lib/stellar/freighter.ts
 *
 * Browser-only Freighter wallet utilities.
 * Never import this file in server components or API routes.
 *
 * Defensive wrappers handle both v2 (plain-string returns) and
 * v3/v4 (object-return) variants of @stellar/freighter-api.
 */

import { TransactionBuilder } from '@stellar/stellar-sdk';
import { Server } from '@stellar/stellar-sdk/rpc';
import { NETWORKS, NetworkName } from './escrow-contract';

// ─── Loose type for dynamic import ──────────────────────────────────────────

type AnyReturn = string | { address?: string; signedTxXdr?: string; isConnected?: boolean };

interface FreighterModule {
  isConnected?:     () => Promise<AnyReturn>;
  requestAccess?:   () => Promise<AnyReturn>;
  getAddress?:      () => Promise<AnyReturn>;
  getPublicKey?:    () => Promise<string>;
  signTransaction?: (
    xdr: string,
    opts?: { networkPassphrase?: string; network?: string; accountToSign?: string },
  ) => Promise<AnyReturn>;
}

let _cached: FreighterModule | null = null;

async function loadFreighter(): Promise<FreighterModule> {
  if (_cached) return _cached;
  try {
    _cached = (await import('@stellar/freighter-api')) as unknown as FreighterModule;
  } catch {
    throw new Error(
      'Freighter API not found. Run: npm install @stellar/freighter-api',
    );
  }
  return _cached;
}

// ─── Return-value normalisers ─────────────────────────────────────────────

function pickAddress(raw: AnyReturn): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'address' in raw && typeof raw.address === 'string') {
    return raw.address;
  }
  throw new Error('Could not read wallet address from Freighter response.');
}

function pickSignedXdr(raw: AnyReturn): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'signedTxXdr' in raw && typeof raw.signedTxXdr === 'string') {
    return raw.signedTxXdr;
  }
  throw new Error('Could not read signed XDR from Freighter response.');
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Returns true if the Freighter extension is installed in the browser. */
export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const api = await loadFreighter();
    if (!api.isConnected) return false;
    const raw = await api.isConnected();
    if (typeof raw === 'boolean') return raw;
    if (raw && typeof raw === 'object' && 'isConnected' in raw) {
      return Boolean(raw.isConnected);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Request wallet access and return the connected Stellar public key (G…).
 * Prompts the user to approve in the Freighter extension popup.
 * Throws a user-friendly message if Freighter is missing or the user rejects.
 */
export async function connectFreighter(): Promise<string> {
  const api = await loadFreighter();

  const hasFn = api.requestAccess ?? api.getAddress ?? api.getPublicKey;
  if (!hasFn) {
    throw new Error(
      'Freighter extension not detected. Install Freighter from freighter.app and try again.',
    );
  }

  try {
    if (api.getAddress)    return pickAddress(await api.getAddress());
    if (api.requestAccess) return pickAddress(await api.requestAccess());
    return await api.getPublicKey!();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/reject|deny|cancel|user/i.test(msg)) {
      throw new Error('Wallet connection was rejected. Approve the request in Freighter.');
    }
    throw new Error(`Freighter connection failed: ${msg}`);
  }
}

/**
 * Sign an assembled XDR transaction envelope using Freighter.
 * Returns the signed XDR string ready for submission.
 */
export async function signXdrWithFreighter(
  xdr: string,
  networkPassphrase: string,
): Promise<string> {
  const api = await loadFreighter();

  if (!api.signTransaction) {
    throw new Error('signTransaction not found in Freighter API. Please update your Freighter extension.');
  }

  try {
    const raw = await api.signTransaction(xdr, { networkPassphrase });
    return pickSignedXdr(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/reject|deny|cancel|user/i.test(msg)) {
      throw new Error('Transaction signing was cancelled. Sign the transaction in Freighter to continue.');
    }
    throw new Error(`Signing failed: ${msg}`);
  }
}

/**
 * Thrown specifically when Stellar rejects a transaction for a stale/incorrect
 * sequence number (txBadSeq). This is recoverable by rebuilding the transaction
 * with a fresh simulation (which re-fetches the account's current sequence)
 * and resubmitting — see `signAndSubmitWithRetry` below.
 */
export class BadSequenceError extends Error {}

function isBadSeqResult(detail: any): boolean {
  return detail?.result?._switch?.name === 'txBadSeq';
}

/**
 * Submit a signed XDR envelope to the Stellar RPC and poll for confirmation.
 * Resolves with the transaction hash on SUCCESS.
 * Rejects on ERROR / FAILED / 60-second timeout.
 *
 * Soroban contract invocations can take longer than classic Stellar txs —
 * NOT_FOUND and PENDING both mean "still processing", so we keep polling.
 * We use a 2 s cadence for 60 polls = up to 2 minutes total.
 */
export async function submitTransaction(
  signedXdr: string,
  networkName: NetworkName,
): Promise<string> {
  const network = NETWORKS[networkName];
  const server  = new Server(network.rpcUrl);
  const tx      = TransactionBuilder.fromXDR(signedXdr, network.networkPassphrase);

  const sendResult = await server.sendTransaction(tx);

  if (sendResult.status === 'ERROR') {
    const detail = (sendResult as any).errorResult ?? (sendResult as any).error ?? 'unknown';
    if (isBadSeqResult(detail)) {
      throw new BadSequenceError(
        `Transaction rejected by Stellar (stale sequence number): ${JSON.stringify(detail)}`,
      );
    }
    throw new Error(
      `Transaction rejected by Stellar: ${JSON.stringify(detail)}`,
    );
  }

  const { hash } = sendResult;

  // Poll up to 2 min (2 s cadence × 60 polls).
  // NOT_FOUND = tx not yet ingested; PENDING = ingested but not yet applied.
  // Both are transient — keep polling until SUCCESS, FAILED, or timeout.
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const check = await server.getTransaction(hash);
    if (check.status === 'SUCCESS') return hash;
    if (check.status === 'FAILED') {
      const resultXdr = (check as any).resultXdr ?? (check as any).resultMetaXdr ?? '';
      throw new Error(`Transaction failed on-chain. Hash: ${hash}${resultXdr ? ` · Result: ${resultXdr}` : ''}`);
    }
    // NOT_FOUND or PENDING — keep waiting
  }

  throw new Error(
    `Transaction timed out after 2 minutes. It may still confirm — check: https://stellar.expert/explorer/${networkName}/tx/${hash}`,
  );
}

/**
 * Convenience: sign with Freighter then submit to the network.
 * Returns the confirmed transaction hash.
 */
export async function signAndSubmit(
  xdr: string,
  networkName: NetworkName,
): Promise<string> {
  const signed = await signXdrWithFreighter(xdr, NETWORKS[networkName].networkPassphrase);
  return submitTransaction(signed, networkName);
}

/**
 * Build (or rebuild), sign, and submit a Soroban contract call — automatically
 * retrying with a freshly-simulated transaction if Stellar rejects it for a
 * stale sequence number (txBadSeq).
 *
 * Why this is needed: each contract method call (e.g. `client.create_escrow(...)`)
 * builds a transaction using the account's sequence number *at build time*. If
 * the RPC node's view of the account hasn't caught up yet — which can happen
 * right after a previous transaction in the same flow was just confirmed — the
 * pre-built sequence number is stale by the time Freighter signs and submits it,
 * and Stellar rejects it with txBadSeq. Reusing the same XDR can't fix this;
 * the only fix is to re-simulate against the account's current sequence and
 * resubmit, which is what `buildTx` lets us do on each retry.
 *
 * @param buildTx      A function that builds (or rebuilds) the AssembledTransaction,
 *                     e.g. `() => client.fund({ reference_code, importer })`.
 * @param networkName  "testnet" or "mainnet"
 * @param maxRetries   How many times to rebuild + resubmit on txBadSeq (default 2)
 */
export async function signAndSubmitWithRetry(
  buildTx: () => Promise<{ toXDR(): string }>,
  networkName: NetworkName,
  maxRetries = 4,
): Promise<string> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tx = await buildTx();
    try {
      return await signAndSubmit(tx.toXDR(), networkName);
    } catch (err) {
      if (!(err instanceof BadSequenceError) || attempt >= maxRetries) throw err;
      attempt++;
      // Backoff grows each retry (2s, 3.5s, 5s, 6.5s…) to give the RPC
      // node's account view time to catch up to the ledger that just closed.
      // Rebuilding from scratch re-simulates and fetches a current sequence.
      await new Promise(r => setTimeout(r, 2000 + (attempt - 1) * 1500));
    }
  }
}
