/**
 * lib/stellar/assets.ts
 *
 * MariTrade supported asset registry.
 *
 * Two active assets:
 *   1. USDC  — Circle / testnet anchor (already in production)
 *   2. PPHP  — Philippine Peso simulation; custom-issued on Stellar testnet
 *              by the MariTrade platform issuer key. NOT a real regulated
 *              stablecoin — for demo / local-currency quoting only.
 *
 * How PPHP works (classic Stellar asset):
 *   • The platform issuer account (NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS) is
 *     both the issuer of PPHP on testnet.
 *   • A user's Freighter wallet must establish a trustline to that issuer
 *     before they can hold PPHP.
 *   • On mainnet, replace the issuer with a dedicated locked account.
 *
 * To add a third asset later, add a new entry to SUPPORTED_ASSETS and
 * extend AssetCode.
 */

import * as StellarSdk from '@stellar/stellar-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetCode = 'USDC' | 'PPHP';

export interface AssetConfig {
  code: AssetCode;
  /** Full display name */
  name: string;
  /** Short symbol shown in UI (e.g. "$", "₱") */
  symbol: string;
  /** Stellar classic issuer public key (G…). */
  issuer: string;
  /** Decimals for display formatting */
  decimals: number;
  /**
   * Indicative exchange rate to USD — used only as a FALLBACK when the
   * live FX fetch in lib/stellar/fx.ts fails (e.g. offline demo). For any
   * real conversion, use getUsdToPhpRate() / convertPphpToUsdc() from
   * lib/stellar/fx.ts instead, which pulls the current live rate.
   */
  rateToUsd: number;
  /** Tailwind badge colour classes */
  badgeClass: string;
}

// ─── Asset registry ───────────────────────────────────────────────────────────

/** Circle testnet anchor issuer (matches NEXT_PUBLIC_USDC_SAC_TESTNET asset). */
const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
/** Circle mainnet issuer. */
const USDC_ISSUER_MAINNET = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

/**
 * PPHP issuer = the MariTrade platform account.
 * On testnet this is fine; on mainnet use a separate dedicated issuer key.
 * Set NEXT_PUBLIC_PPHP_ISSUER_MAINNET when going live.
 */
const PPHP_ISSUER_TESTNET =
  process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';
const PPHP_ISSUER_MAINNET =
  process.env.NEXT_PUBLIC_PPHP_ISSUER_MAINNET ?? '';

const isTestnet =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') !== 'public';

export const SUPPORTED_ASSETS: Record<AssetCode, AssetConfig> = {
  USDC: {
    code:       'USDC',
    name:       'USD Coin',
    symbol:     '$',
    issuer:     isTestnet ? USDC_ISSUER_TESTNET : USDC_ISSUER_MAINNET,
    decimals:   2,
    rateToUsd:  1.0,
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  PPHP: {
    code:       'PPHP',
    name:       'Philippine Peso (Simulated)',
    symbol:     '₱',
    issuer:     isTestnet ? PPHP_ISSUER_TESTNET : PPHP_ISSUER_MAINNET,
    decimals:   2,
    // 1 PHP ≈ 0.0170 USD indicative (≈ 58.8 PHP/USD).
    // Replace with a live-rate fetch in production.
    rateToUsd:  0.017,
    badgeClass: 'bg-yellow-100 text-yellow-700',
  },
};

/** Ordered list for UI display — USDC first. */
export const ASSET_LIST: AssetConfig[] = [
  SUPPORTED_ASSETS.USDC,
  SUPPORTED_ASSETS.PPHP,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a StellarSdk.Asset from an AssetConfig. */
export function toStellarAsset(config: AssetConfig): StellarSdk.Asset {
  if (!config.issuer) {
    throw new Error(
      `Asset ${config.code} has no issuer configured. ` +
        `Check your .env.local (NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS for PPHP).`,
    );
  }
  return new StellarSdk.Asset(config.code, config.issuer);
}

/**
 * Convert an amount in any supported asset to its USD equivalent using the
 * STATIC fallback rate only — this does NOT fetch a live rate.
 * Prefer convertPphpToUsdc() / convertUsdcToPphp() from lib/stellar/fx.ts
 * wherever an accurate, current PPHP↔USDC conversion is needed (anywhere
 * user-facing). This sync helper exists only for places that can't await
 * a fetch (e.g. quick synchronous renders) and are OK with a stale rate.
 */
export function toUsdEquivalent(amount: number, assetCode: AssetCode): number {
  return amount * SUPPORTED_ASSETS[assetCode].rateToUsd;
}

/**
 * Format an amount with the asset's currency symbol and decimal places.
 * e.g. formatAsset(1234.5, 'PPHP') → "₱1,234.50"
 *      formatAsset(100, 'USDC')    → "$100.00"
 */
export function formatAsset(amount: number, assetCode: AssetCode): string {
  const cfg = SUPPORTED_ASSETS[assetCode];
  return (
    cfg.symbol +
    amount.toLocaleString('en-PH', {
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    })
  );
}

/**
 * PHP_PER_USD — inverse of PPHP.rateToUsd; replaces the hardcoded magic
 * constant (58.7) that used to be scattered across page files.
 */
export const PHP_PER_USD: number = Math.round(1 / SUPPORTED_ASSETS.PPHP.rateToUsd);
