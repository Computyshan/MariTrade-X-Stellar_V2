/**
 * lib/verification/ais-tracking.ts
 *
 * Phase 3 — Vessel-tracking cross-check.
 *
 * Before accepting a VESSEL_DEPARTED_ORIGIN milestone at face value, cross-
 * check the freight forwarder's claimed vessel against a live AIS feed. This
 * is the same "best-effort, non-blocking" pattern already used for on-chain
 * stage sync in app/api/shipments/[id]/milestones/route.ts: the milestone
 * is always saved regardless of whether this check succeeds.
 *
 * IMPORTANT — why this reads from a DB cache instead of calling an AIS
 * provider directly: aisstream.io (the configured provider) is a persistent
 * WebSocket stream, not a request/response HTTP API. There's no endpoint to
 * hit for "what is vessel X's position right now" — you subscribe once and
 * it pushes PositionReport messages continuously. That doesn't fit inside a
 * serverless Next.js API route, so a standalone process (scripts/ais-worker.ts)
 * holds the actual WebSocket connection and upserts the latest position per
 * MMSI into the `ais_vessel_positions` table. This function only ever reads
 * that cache — it never calls aisstream.io itself.
 *
 * Until a shipment has a vesselMmsi set (captured alongside the
 * SPACE_ON_VESSEL_SECURED milestone) and the worker has actually seen that
 * MMSI report a position, this resolves to UNVERIFIABLE with a clear note —
 * exactly like getAccountBalance()'s sandbox fallback in lib/stellar/escrow.ts.
 */

import { AisVerificationResult } from '@/types';
import { dbStore } from '@/lib/db';

/** How stale a cached position can be and still count as corroborating —
 *  the worker should be updating this every few minutes while connected, so
 *  anything older than this suggests the worker is down or the vessel has
 *  gone out of AIS range, not that it's still confidently "underway". */
const MAX_POSITION_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Speed-over-ground threshold (knots) above which we treat a vessel as
 *  genuinely underway rather than idling/moored with the odd noisy report. */
const UNDERWAY_SOG_KNOTS = 1.0;

/**
 * Attempts to confirm that the shipment's assigned vessel actually reported
 * an underway position around the claimed departure time, using the cached
 * aisstream.io feed (see file header). Never throws — always resolves to a
 * result, so the caller can attach it to the milestone without risking the
 * milestone POST itself.
 */
export async function crossCheckVesselDeparture(params: {
  vesselMmsi?: string;       // from shipment.vesselMmsi, if the FF set one
  claimedReference: string;  // vessel name / voyage number the FF typed in
  occurredAt: string;
}): Promise<AisVerificationResult> {
  const { vesselMmsi, claimedReference, occurredAt } = params;
  const checkedAt = new Date().toISOString();

  if (!vesselMmsi) {
    return {
      status: 'UNVERIFIABLE',
      claimedReference,
      source: 'unconfigured',
      checkedAt,
      note: 'No vessel MMSI is set on this shipment yet — falling back to the self-reported reference number. Set the MMSI when logging SPACE_ON_VESSEL_SECURED to enable AIS cross-checking.',
    };
  }

  try {
    const cached = await dbStore.getLatestAisPosition(vesselMmsi);

    if (!cached) {
      return {
        status: 'UNVERIFIABLE',
        claimedReference,
        source: 'aisstream.io (cache)',
        checkedAt,
        note: `No AIS position has been observed yet for MMSI ${vesselMmsi} — either the vessel hasn't reported recently, it's outside AIS station range, or the AIS worker (scripts/ais-worker.ts) isn't running.`,
      };
    }

    const receivedMs = new Date(cached.receivedAt).getTime();
    const ageMs = Date.now() - receivedMs;
    if (ageMs > MAX_POSITION_AGE_MS) {
      return {
        status: 'UNVERIFIABLE',
        vesselName: cached.shipName,
        imoNumber: cached.imoNumber,
        claimedReference,
        aisObservedAt: cached.receivedAt,
        source: 'aisstream.io (cache)',
        checkedAt,
        note: `Last AIS position for MMSI ${vesselMmsi} is ${Math.round(ageMs / 3_600_000)}h old — too stale to corroborate a departure right now.`,
      };
    }

    const isUnderway =
      (cached.sogKnots ?? 0) >= UNDERWAY_SOG_KNOTS ||
      (cached.navStatus?.toLowerCase().includes('under way') ?? false);

    if (!isUnderway) {
      return {
        status: 'MISMATCH',
        vesselName: cached.shipName,
        imoNumber: cached.imoNumber,
        claimedReference,
        aisObservedAt: cached.receivedAt,
        source: 'aisstream.io (cache)',
        checkedAt,
        note: `AIS shows MMSI ${vesselMmsi}${cached.shipName ? ` (${cached.shipName})` : ''} as ${cached.navStatus || 'not underway'} (${cached.sogKnots ?? 0} kn) as of ${cached.receivedAt}, not departed as claimed around ${occurredAt}.`,
      };
    }

    return {
      status: 'VERIFIED',
      vesselName: cached.shipName,
      imoNumber: cached.imoNumber,
      claimedReference,
      aisObservedAt: cached.receivedAt,
      source: 'aisstream.io (cache)',
      checkedAt,
    };
  } catch (err: any) {
    console.warn('[ais-tracking] cross-check failed, treating as unverifiable:', err?.message ?? err);
    return {
      status: 'UNVERIFIABLE',
      claimedReference,
      source: 'aisstream.io (cache)',
      checkedAt,
      note: 'AIS position cache unreachable — the milestone was still logged from the self-reported reference.',
    };
  }
}
