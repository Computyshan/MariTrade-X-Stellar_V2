/**
 * lib/verification/ais-tracking.ts
 *
 * Phase 3 — Vessel-tracking cross-check.
 *
 * Before accepting a VESSEL_DEPARTED_ORIGIN milestone at face value, cross-
 * check the freight forwarder's claimed reference (vessel name / voyage
 * number) against a public AIS (Automatic Identification System) feed.
 * This is the same "best-effort, non-blocking" pattern already used for
 * on-chain stage sync in app/api/shipments/[id]/milestones/route.ts:
 * the milestone is always saved regardless of whether this check succeeds.
 *
 * No AIS provider is wired to a live key by default — set AIS_API_URL and
 * AIS_API_KEY to point this at a real feed (e.g. AISHub, MarineTraffic,
 * Datalastic). Until then every check resolves to UNVERIFIABLE with a
 * clear note, exactly like getAccountBalance()'s sandbox fallback in
 * lib/stellar/escrow.ts.
 */

import { AisVerificationResult } from '@/types';

const AIS_API_URL = process.env.AIS_API_URL ?? '';
const AIS_API_KEY = process.env.AIS_API_KEY ?? '';

/**
 * Attempts to confirm that a named vessel actually reported an underway/
 * departed status around the claimed time, via a configurable AIS HTTP API.
 * Never throws — always resolves to a result, so the caller can attach it
 * to the milestone without risking the milestone POST itself.
 */
export async function crossCheckVesselDeparture(params: {
  claimedReference: string; // vessel name / voyage number the FF typed in
  occurredAt: string;
}): Promise<AisVerificationResult> {
  const { claimedReference, occurredAt } = params;
  const checkedAt = new Date().toISOString();

  if (!AIS_API_URL || !AIS_API_KEY || !claimedReference?.trim()) {
    return {
      status: 'UNVERIFIABLE',
      claimedReference,
      source: 'unconfigured',
      checkedAt,
      note: !claimedReference?.trim()
        ? 'No vessel/voyage reference was provided to check.'
        : 'AIS integration is not configured (AIS_API_URL / AIS_API_KEY unset) — falling back to the self-reported reference number.',
    };
  }

  try {
    const url = `${AIS_API_URL}?vessel=${encodeURIComponent(claimedReference)}&key=${encodeURIComponent(AIS_API_KEY)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        status: 'UNVERIFIABLE',
        claimedReference,
        source: 'ais-provider',
        checkedAt,
        note: `AIS provider returned HTTP ${res.status} — treating as unverifiable, not blocking.`,
      };
    }

    const data = await res.json();
    // Expected shape (provider-agnostic, normalize in your integration):
    // { vesselName, imoNumber, status: 'underway'|'moored'|..., positionReceivedAt }
    const observedUnderway = data?.status === 'underway' || data?.status === 'departed';
    const aisObservedAt: string | undefined = data?.positionReceivedAt;

    if (!observedUnderway) {
      return {
        status: 'MISMATCH',
        vesselName: data?.vesselName,
        imoNumber: data?.imoNumber,
        claimedReference,
        aisObservedAt,
        source: 'ais-provider',
        checkedAt,
        note: `AIS feed does not show "${claimedReference}" as underway/departed around ${occurredAt}.`,
      };
    }

    return {
      status: 'VERIFIED',
      vesselName: data?.vesselName,
      imoNumber: data?.imoNumber,
      claimedReference,
      aisObservedAt,
      source: 'ais-provider',
      checkedAt,
    };
  } catch (err: any) {
    console.warn('[ais-tracking] cross-check failed, treating as unverifiable:', err?.message ?? err);
    return {
      status: 'UNVERIFIABLE',
      claimedReference,
      source: 'ais-provider',
      checkedAt,
      note: 'AIS feed unreachable or timed out — the milestone was still logged from the self-reported reference.',
    };
  }
}
