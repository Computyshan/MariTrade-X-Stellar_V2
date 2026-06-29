/**
 * lib/stellar/trustline.ts
 *
 * Trustline management helpers for MariTrade custom assets.
 *
 * PPHP (Philippine Peso simulation) is a classic Stellar asset. Before a
 * user's wallet can receive or hold PPHP, it must establish a trustline to
 * the PPHP issuer (the MariTrade platform account on testnet).
 *
 * This module:
 *   1. Checks whether a trustline already exists for a given asset.
 *   2. Builds a changeTrust XDR that the user signs with Freighter.
 *   3. Provides a convenience function used by the wallet balance hook.
 *
 * Usage (in a React component):
 * ```ts
 * import { ensureTrustline } from '@/lib/stellar/trustline';
 * import { signAndSubmit } from '@/lib/stellar/freighter';
 *
 * const xdr = await ensureTrustline(publicKey, 'PPHP', networkName);
 * if (xdr) {
 *   await signAndSubmit(xdr, networkName);
 * }
 * ```
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { AssetCode, SUPPORTED_ASSETS, toStellarAsset } from './assets';
import { NetworkName, NETWORKS } from './escrow-contract';

function getHorizonUrl(networkName: NetworkName): string {
  return networkName === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
}

/**
 * Check if `publicKey` already has a trustline for the given asset.
 * Returns the balance string if trusted, or null if not.
 */
export async function getTrustlineBalance(
  publicKey: string,
  assetCode: AssetCode,
  networkName: NetworkName,
): Promise<string | null> {
  if (!publicKey) return null;
  const cfg = SUPPORTED_ASSETS[assetCode];
  if (!cfg.issuer) return null;

  try {
    const server = new StellarSdk.Horizon.Server(getHorizonUrl(networkName));
    const account = await server.loadAccount(publicKey);

    for (const balance of account.balances) {
      if (
        balance.asset_type !== 'native' &&
        'asset_code' in balance &&
        balance.asset_code === assetCode &&
        'asset_issuer' in balance &&
        balance.asset_issuer === cfg.issuer
      ) {
        return balance.balance;
      }
    }
    return null; // trustline not found
  } catch {
    return null;
  }
}

/**
 * Build an unsigned changeTrust XDR to establish a trustline for `assetCode`.
 * Returns null if the trustline already exists (nothing to do).
 *
 * The caller must sign this with Freighter and submit it.
 *
 * @param publicKey   User's Stellar public key (G…)
 * @param assetCode   'PPHP' (or any future custom asset)
 * @param networkName 'testnet' | 'mainnet'
 * @param limit       Max amount of the asset the user agrees to hold (default: '1000000000')
 */
export async function buildTrustlineXdr(
  publicKey: string,
  assetCode: AssetCode,
  networkName: NetworkName,
  limit = '1000000000',
): Promise<string | null> {
  const existing = await getTrustlineBalance(publicKey, assetCode, networkName);
  if (existing !== null) return null; // already trusted

  const cfg = SUPPORTED_ASSETS[assetCode];
  if (!cfg.issuer) {
    throw new Error(
      `Cannot create trustline: ${assetCode} has no issuer set. ` +
        `Ensure NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS is set in .env.local.`,
    );
  }

  const server = new StellarSdk.Horizon.Server(getHorizonUrl(networkName));
  const account = await server.loadAccount(publicKey);
  const network = NETWORKS[networkName];

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: network.networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: toStellarAsset(cfg),
        limit,
      }),
    )
    .setTimeout(180)
    .build();

  return tx.toXDR();
}

/**
 * Check trustline status for all supported custom assets in one call.
 * Returns a map of assetCode → balance (or null if not trusted).
 */
export async function getAllTrustlineBalances(
  publicKey: string,
  networkName: NetworkName,
): Promise<Partial<Record<AssetCode, string | null>>> {
  if (!publicKey) return {};

  try {
    const server = new StellarSdk.Horizon.Server(getHorizonUrl(networkName));
    const account = await server.loadAccount(publicKey);

    const result: Partial<Record<AssetCode, string | null>> = {
      USDC: null,
      PPHP: null,
    };

    for (const balance of account.balances) {
      if (balance.asset_type === 'native') continue;
      if (!('asset_code' in balance) || !('asset_issuer' in balance)) continue;

      const code = balance.asset_code as AssetCode;
      const cfg = SUPPORTED_ASSETS[code];
      if (!cfg) continue;

      if (balance.asset_issuer === cfg.issuer) {
        result[code] = balance.balance;
      }
    }

    return result;
  } catch {
    return {};
  }
}
