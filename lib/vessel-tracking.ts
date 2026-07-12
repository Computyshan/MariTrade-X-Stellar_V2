/**
 * lib/vessel-tracking.ts
 *
 * Client-safe helper for the "Vessel Identity" step a Freight Forwarder
 * fills in on the SPACE_ON_VESSEL_SECURED milestone (see
 * app/(dashboard)/shipments/[id]/log-milestone/page.tsx). Two jobs:
 *
 *   1. Validate the MMSI is well-formed *before* it's submitted, entirely
 *      offline — no network call, safe to run on every keystroke.
 *   2. Let the user check whether MariTrade has already seen this vessel
 *      report a position, by reading the same cache
 *      lib/verification/ais-tracking.ts reads from.
 *
 * IMPORTANT — this does NOT call aisstream.io, and it cannot "look up an
 * arbitrary MMSI" the way a vessel-registry API would. aisstream.io is a
 * persistent WebSocket push stream (see scripts/ais-worker.ts's header
 * comment) — there's no per-request "give me info for MMSI X" endpoint to
 * call, on the server or the client, and the API key + DB service role are
 * server-only regardless. So "look up an MMSI" here means: confirm the
 * number is validly formatted, and if scripts/ais-worker.ts has already
 * observed that vessel (because it was set on some shipment before and is
 * being watched), surface its last-known name/position from the cache. If
 * nobody has watched this MMSI yet, that's expected and fine — saving it
 * on the shipment is what makes the worker start watching it.
 */

import { AisVesselPosition } from '@/types';

// ─── MMSI format validation ─────────────────────────────────────────────────
// An MMSI (Maritime Mobile Service Identity) is always exactly 9 digits.
// The first digit tells you what kind of station it is; ordinary ship
// stations always start with 2-7 (the digit encodes the region of the
// Maritime Identification Digits, MID, that follow as digits 1-3). Other
// leading digits are reserved for coast stations (00), group ship calls (0),
// SAR aircraft (111), AIS aids-to-navigation (99), etc. — not something a
// Freight Forwarder would ever type in here, so treating them as invalid
// input is the right default rather than an oversight.
const MMSI_PATTERN = /^[2-7]\d{8}$/;

export function isValidMmsi(input: string): boolean {
  return MMSI_PATTERN.test(input.trim());
}

/** Human-readable reason a candidate MMSI is invalid, or undefined if it's
 *  fine — lets the log-milestone page show a specific inline message
 *  instead of a generic "invalid" error. */
export function mmsiValidationError(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined; // empty is valid — the field is optional
  if (!/^\d*$/.test(trimmed)) return 'MMSI must contain only digits.';
  if (trimmed.length !== 9) return `MMSI must be exactly 9 digits (got ${trimmed.length}).`;
  if (!MMSI_PATTERN.test(trimmed)) {
    return 'This looks like a coast station, group call, or aid-to-navigation MMSI, not a ship — double-check the number.';
  }
  return undefined;
}

// ─── MID → flag state lookup ────────────────────────────────────────────────
// The first three digits of a ship MMSI are its Maritime Identification
// Digits (MID), assigned by the ITU to the vessel's flag state. This is a
// deliberately partial table of the MIDs most likely to show up on
// MariTrade's Philippine-import-heavy trade lanes, plus the largest global
// flag/open registries — not the full ITU table. Returning undefined for an
// unrecognized MID is the correct behavior, not a bug: it just means we
// don't have that one mapped, not that the MMSI is invalid.
const MID_FLAG_STATE: Record<string, string> = {
  '548': 'Philippines',
  '416': 'Taiwan',
  '477': 'Hong Kong',
  '412': 'China',
  '413': 'China',
  '414': 'China',
  '431': 'Japan',
  '432': 'Japan',
  '440': 'South Korea',
  '441': 'South Korea',
  '563': 'Singapore',
  '566': 'Singapore',
  '525': 'Indonesia',
  '533': 'Malaysia',
  '235': 'United Kingdom',
  '232': 'United Kingdom',
  '338': 'United States',
  '366': 'United States',
  '367': 'United States',
  '368': 'United States',
  '369': 'United States',
  '311': 'Bahamas',
  '308': 'Bahamas',
  '351': 'Panama',
  '352': 'Panama',
  '353': 'Panama',
  '354': 'Panama',
  '355': 'Panama',
  '356': 'Panama',
  '357': 'Panama',
  '370': 'Panama',
  '371': 'Panama',
  '372': 'Panama',
  '373': 'Panama',
  '374': 'Panama',
  '229': 'Malta',
  '215': 'Malta',
  '256': 'Malta',
  '247': 'Italy',
  '636': 'Liberia',
  '609': 'Liberia',
  '667': 'Sierra Leone',
  '245': 'Netherlands',
  '246': 'Netherlands',
};

/** Best-effort flag-state guess from an MMSI's MID prefix, purely for a
 *  friendly inline hint ("Flag: Panama") — never treat this as
 *  authoritative vessel identity; it's a lookup table, not a registry. */
export function guessFlagState(mmsi: string): string | undefined {
  const trimmed = mmsi.trim();
  if (!isValidMmsi(trimmed)) return undefined;
  return MID_FLAG_STATE[trimmed.slice(0, 3)];
}

// ─── Cached tracking status (reads the AIS position cache) ─────────────────

export type VesselTrackingStatus =
  | { state: 'not_configured' }
  | { state: 'invalid_mmsi' }
  | { state: 'not_yet_tracked' }
  | { state: 'tracked'; position: AisVesselPosition };

/**
 * Checks whether MariTrade already has a cached AIS position for this MMSI
 * (i.e. scripts/ais-worker.ts has previously seen it, because it was set on
 * some shipment before). Calls the server — never aisstream.io directly and
 * never the DB from the browser, since the DB read uses the Supabase
 * service-role key, which must stay server-only.
 *
 * This is a nice-to-have confirmation, not a gate: an MMSI correctly typed
 * in for the *first* time on MariTrade will always come back
 * 'not_yet_tracked', because nothing has watched it yet — the worker only
 * starts watching once this MMSI is saved onto the shipment. Callers should
 * treat 'not_yet_tracked' as "looks fine, nothing to show yet", not an error.
 */
export async function checkVesselTrackingStatus(
  mmsi: string,
  fetcher: typeof fetch = fetch,
): Promise<VesselTrackingStatus> {
  const trimmed = mmsi.trim();
  if (!trimmed) return { state: 'not_configured' };
  if (!isValidMmsi(trimmed)) return { state: 'invalid_mmsi' };

  const res = await fetcher(`/api/vessels/${encodeURIComponent(trimmed)}`);
  if (!res.ok) {
    // Treat any server-side failure as "nothing to show" rather than
    // surfacing a scary error for what is, at worst, a missing convenience
    // feature — the milestone can always still be logged from the typed MMSI.
    return { state: 'not_yet_tracked' };
  }
  const json = await res.json();
  if (!json.success || !json.data) return { state: 'not_yet_tracked' };
  return { state: 'tracked', position: json.data as AisVesselPosition };
}
