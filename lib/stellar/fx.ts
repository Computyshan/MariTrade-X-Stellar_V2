/**
 * lib/stellar/fx.ts
 *
 * Live USD↔PHP exchange rate for PPHP — the single source of truth for
 * converting between PPHP (Philippine Peso) and USDC anywhere in the app.
 *
 * Why this exists: lib/stellar/assets.ts previously hardcoded a static
 * rateToUsd (0.017 ≈ ₱58.8/USD) for PPHP. That's a snapshot from whenever
 * it was written — USD/PHP moves daily, so any "indicative" conversion
 * shown to a user was drifting from the real rate over time. This module
 * fetches the live rate instead, with a short in-memory cache (so we don't
 * hammer the FX API on every render) and a static fallback if the network
 * call fails.
 *
 * Uses the same open.er-api.com endpoint already used in
 * app/(dashboard)/shipments/new/page.tsx for invoice currency conversion,
 * so the whole app is now quoting PPHP off the same source.
 */

import { SUPPORTED_ASSETS } from './assets';

const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — FX doesn't need to be querying on every keystroke

interface CachedRate {
  usdToPhp: number;
  fetchedAt: number;
}

let cache: CachedRate | null = null;

/** Static fallback used only if the live FX fetch fails (e.g. offline demo). */
const FALLBACK_USD_TO_PHP = Math.round(1 / SUPPORTED_ASSETS.PPHP.rateToUsd); // ≈ 58.8

/**
 * Fetch the current USD→PHP rate (i.e. how many PHP per 1 USD).
 * Cached for CACHE_TTL_MS to avoid refetching on every component render.
 * Falls back to the static indicative rate in assets.ts if the request fails.
 */
export async function getUsdToPhpRate(): Promise<{ rate: number; isLive: boolean }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { rate: cache.usdToPhp, isLive: true };
  }

  try {
    const res = await fetch(FX_ENDPOINT);
    const data = await res.json();
    const rate = data?.rates?.PHP;
    if (!rate || typeof rate !== 'number') throw new Error('PHP rate missing from FX response');

    cache = { usdToPhp: rate, fetchedAt: now };
    return { rate, isLive: true };
  } catch {
    // Network failure / API down — fall back to the static rate so the UI
    // still renders something sensible instead of breaking.
    return { rate: FALLBACK_USD_TO_PHP, isLive: false };
  }
}

/** Convert a PHP (PPHP) amount to its USDC equivalent using the live rate. */
export async function convertPphpToUsdc(phpAmount: number): Promise<{ usdc: number; rate: number; isLive: boolean }> {
  const { rate, isLive } = await getUsdToPhpRate();
  return { usdc: phpAmount / rate, rate, isLive };
}

/** Convert a USDC amount to its PPHP equivalent using the live rate. */
export async function convertUsdcToPphp(usdcAmount: number): Promise<{ pphp: number; rate: number; isLive: boolean }> {
  const { rate, isLive } = await getUsdToPhpRate();
  return { pphp: usdcAmount * rate, rate, isLive };
}

/** Clears the in-memory cache. Mostly useful for tests or a manual "refresh rate" button. */
export function clearFxCache(): void {
  cache = null;
}
