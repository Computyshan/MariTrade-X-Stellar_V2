/**
 * lib/stellar/platform-signer.ts
 *
 * Shared server-side helper for signing + submitting Soroban transactions
 * with the MariTrade platform keypair. Previously this exact function was
 * copy-pasted into escrow-cancel/route.ts AND escrow-release-prep/route.ts —
 * centralised here so future auth/signing fixes only need to happen once.
 *
 * Uses basicNodeSigner, which covers both signTransaction (envelope) AND
 * signAuthEntry (Soroban auth entries) — both are required for contract
 * invocations authorised by the platform account.
 */

import { Keypair } from '@stellar/stellar-sdk';
import { Server as SorobanServer } from '@stellar/stellar-sdk/rpc';
import { AssembledTransaction, basicNodeSigner } from '@stellar/stellar-sdk/contract';
import { NETWORKS, NetworkName } from './escrow-contract';

const PLATFORM_SECRET = process.env.PLATFORM_STELLAR_SECRET_KEY ?? '';

/**
 * Sign (envelope + auth entries) and submit an AssembledTransaction using
 * the platform keypair, then poll until the transaction is confirmed.
 * Returns the confirmed transaction hash, or throws with a descriptive
 * message (including the hash, where available) on failure/timeout.
 */
export async function platformSignAndSubmit(
  assembled: AssembledTransaction<any>,
  networkName: NetworkName = 'testnet',
): Promise<string> {
  if (!PLATFORM_SECRET) {
    throw new Error('PLATFORM_STELLAR_SECRET_KEY is not configured.');
  }

  const net       = NETWORKS[networkName];
  const keypair   = Keypair.fromSecret(PLATFORM_SECRET);
  const signer    = basicNodeSigner(keypair, net.networkPassphrase);
  const server    = new SorobanServer(net.rpcUrl);

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
  throw new Error(`Transaction timed out. Check: https://stellar.expert/explorer/${networkName}/tx/${hash}`);
}
