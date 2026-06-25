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
    if (api.requestAccess) return pickAddress(await api.requestAccess());
    if (api.getAddress)    return pickAddress(await api.getAddress());
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
 * Submit a signed XDR envelope to the Stellar RPC and poll for confirmation.
 * Resolves with the transaction hash on SUCCESS.
 * Rejects on ERROR / FAILED / 30-second timeout.
 */
export async function submitTransaction(
  signedXdr: string,
  networkName: NetworkName,
): Promise<string> {
  const network = NETWORKS[networkName];
  const server  = new Server(network.rpcUrl);
  const tx      = TransactionBuilder.fromXDR(signedXdr, network.passphrase);

  const sendResult = await server.sendTransaction(tx);

  if (sendResult.status === 'ERROR') {
    throw new Error(
      `Transaction rejected by Stellar: ${JSON.stringify(sendResult.errorResult ?? 'unknown')}`,
    );
  }

  const { hash } = sendResult;

  // Poll up to 30 s (1 s cadence)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const check = await server.getTransaction(hash);
    if (check.status === 'SUCCESS') return hash;
    if (check.status === 'FAILED')  throw new Error(`Transaction failed on-chain. Hash: ${hash}`);
    // NOT_FOUND → still pending, keep polling
  }

  throw new Error(`Transaction timed out waiting for confirmation. Hash: ${hash}`);
}

/**
 * Convenience: sign with Freighter then submit to the network.
 * Returns the confirmed transaction hash.
 */
export async function signAndSubmit(
  xdr: string,
  networkName: NetworkName,
): Promise<string> {
  const signed = await signXdrWithFreighter(xdr, NETWORKS[networkName].passphrase);
  return submitTransaction(signed, networkName);
}
