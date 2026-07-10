/**
 * lib/rate-benchmark.ts — MariTrade v2
 *
 * Phase 2 (AI-Assisted Decision Support) — "Rate benchmarking" support
 * data. Pure computation, same pattern as lib/delay-risk.ts: pulls
 * platform-wide historical freight-cost signal for a route (same
 * origin/destination pair) so the Gemini call in lib/gemini has real
 * numbers to reason over instead of guessing from a generic per-kg formula
 * alone.
 *
 * Only shipments where a Freight Forwarder has actually recorded
 * `freightCostUSD` count toward the sample — most shipments never get a
 * cost logged, so this is deliberately a subset of computeRouteHistoricalStats's
 * peer set, not the same denominator.
 */

import { Shipment } from '../types';

export interface RouteFreightStats {
  /** How many past shipments with a recorded freight cost this stat is
   *  drawn from — always surface this alongside the numbers so a sample of
   *  1 doesn't read as authoritative as a sample of 20. */
  sampleSize: number;
  avgFreightCostUSD: number | null;
  minFreightCostUSD: number | null;
  maxFreightCostUSD: number | null;
}

/**
 * Historical freight-cost stats for shipments on the same origin→destination
 * route that have a recorded freightCostUSD, excluding the shipment being
 * evaluated itself.
 */
export function computeRouteFreightStats(
  shipment: Pick<Shipment, 'id' | 'originCountry' | 'destinationPort'>,
  allShipments: Shipment[]
): RouteFreightStats {
  const peers = allShipments.filter(
    s =>
      s.id !== shipment.id &&
      s.originCountry.trim().toLowerCase() === shipment.originCountry.trim().toLowerCase() &&
      s.destinationPort.trim().toLowerCase() === shipment.destinationPort.trim().toLowerCase() &&
      typeof s.freightCostUSD === 'number' &&
      s.freightCostUSD > 0
  );

  const sampleSize = peers.length;
  if (sampleSize === 0) {
    return { sampleSize: 0, avgFreightCostUSD: null, minFreightCostUSD: null, maxFreightCostUSD: null };
  }

  const costs = peers.map(s => s.freightCostUSD as number);
  const avgFreightCostUSD = Math.round((costs.reduce((a, b) => a + b, 0) / sampleSize) * 100) / 100;
  const minFreightCostUSD = Math.min(...costs);
  const maxFreightCostUSD = Math.max(...costs);

  return { sampleSize, avgFreightCostUSD, minFreightCostUSD, maxFreightCostUSD };
}
