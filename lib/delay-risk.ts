/**
 * lib/delay-risk.ts — MariTrade v2
 *
 * Phase 2 (AI-Assisted Decision Support) — "Delay-risk prediction" support
 * data. Pure computation, same pattern as lib/reputation.ts: pulls
 * platform-wide historical signal for a route (same origin/destination
 * pair) so the Gemini call in lib/gemini has real numbers to reason over
 * instead of guessing from the cargo description alone.
 *
 * Known simplification: PORT_HOLD_PLACED_OR_LIFTED is logged for both the
 * "placed" and "lifted" sides of a hold (the milestone type doesn't
 * distinguish them — see MILESTONE_EVIDENCE_REF_LABEL in types/index.ts).
 * Treating its presence as "a hold occurred on this shipment" overcounts
 * slightly if a broker logs it twice (placed, then lifted) for the same
 * hold, but undercounting a real risk signal is worse than a mild
 * overcount here, so this errs toward flagging risk.
 */

import { Shipment, MilestoneEvent } from '../types';

export interface RouteHistoricalStats {
  /** How many past shipments this stat is drawn from — always surface this
   *  alongside the numbers so a sample of 2 doesn't read as authoritative
   *  as a sample of 50. */
  sampleSize: number;
  holdRate: number | null;
  disputeRate: number | null;
  avgClearanceHours: number | null;
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Historical stats for shipments on the same origin→destination route,
 * excluding the shipment being evaluated itself.
 */
export function computeRouteHistoricalStats(
  shipment: Pick<Shipment, 'id' | 'originCountry' | 'destinationPort'>,
  allShipments: Shipment[],
  allMilestones: MilestoneEvent[]
): RouteHistoricalStats {
  const peers = allShipments.filter(
    s =>
      s.id !== shipment.id &&
      s.originCountry.trim().toLowerCase() === shipment.originCountry.trim().toLowerCase() &&
      s.destinationPort.trim().toLowerCase() === shipment.destinationPort.trim().toLowerCase()
  );

  const sampleSize = peers.length;
  if (sampleSize === 0) {
    return { sampleSize: 0, holdRate: null, disputeRate: null, avgClearanceHours: null };
  }

  const peerIds = new Set(peers.map(s => s.id));
  const peerMilestones = allMilestones.filter(m => peerIds.has(m.shipmentId));

  const heldShipmentIds = new Set(
    peerMilestones.filter(m => m.type === 'PORT_HOLD_PLACED_OR_LIFTED').map(m => m.shipmentId)
  );
  const holdRate = pct(heldShipmentIds.size, sampleSize);

  const disputedCount = peers.filter(s => s.status === 'DISPUTED' || s.escrowStatus === 'DISPUTED').length;
  const disputeRate = pct(disputedCount, sampleSize);

  const peerById = new Map(peers.map(s => [s.id, s]));
  const clearanceHours = peerMilestones
    .filter(m => m.type === 'CUSTOMS_CLEARANCE_APPROVED')
    .map(m => {
      const s = peerById.get(m.shipmentId);
      if (!s) return null;
      const hours = (new Date(m.occurredAt).getTime() - new Date(s.createdAt).getTime()) / 3_600_000;
      return hours >= 0 ? hours : null;
    })
    .filter((h): h is number => h !== null);
  const avgClearanceHours =
    clearanceHours.length > 0
      ? Math.round((clearanceHours.reduce((a, b) => a + b, 0) / clearanceHours.length) * 10) / 10
      : null;

  return { sampleSize, holdRate, disputeRate, avgClearanceHours };
}
