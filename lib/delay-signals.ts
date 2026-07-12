/**
 * lib/delay-signals.ts
 *
 * Phase 4 — pluggable external-signal interface for the two "pull"
 * feeds in the implementation plan's Proactive Nudges section:
 * port congestion and customs backlog. Polled by
 * app/api/cron/delay-monitor/route.ts.
 *
 * HONESTY NOTE — same posture as scripts/ais-worker.ts and the Gemini
 * "suggestion, not decision" features elsewhere in this codebase: there is
 * no single standard public API for "port congestion" or "customs backlog."
 * These are typically paid, provider-specific data products (terminal
 * operators, customs-broker data feeds, freight-visibility platforms like
 * project44/FourKites, etc.), matching the plan doc's own build note:
 * "IoT and AIS integrations are third-party API contracts — budget for
 * per-provider onboarding, not a single generic connector."
 *
 * So this module does NOT call a specific vendor. It defines the shape a
 * real provider must satisfy, and ships a default implementation that
 * reports "not configured" — which the cron job treats as "nothing to
 * alert on," never as an error. This mirrors the cross-cutting note in the
 * plan doc: "every feature should degrade gracefully... if an integration
 * or feed is unavailable."
 *
 * TO PLUG IN A REAL PROVIDER:
 *   1. Set PORT_CONGESTION_API_URL / PORT_CONGESTION_API_KEY and/or
 *      CUSTOMS_BACKLOG_API_URL / CUSTOMS_BACKLOG_API_KEY in .env.local
 *      (see .env.example).
 *   2. Replace the fetch bodies in checkPortCongestion / checkCustomsBacklog
 *      below with that provider's actual request/response shape — the
 *      current bodies are placeholders showing the *contract* this module
 *      promises the cron job, not a real endpoint.
 */

import { DelayAlertSeverity } from '@/types';

export interface DelaySignalResult {
  detected: boolean;
  severity?: DelayAlertSeverity;
  summary?: string;
  detail?: string;
}

const NOT_DETECTED: DelaySignalResult = { detected: false };

/**
 * Port congestion / dwell-time check for a destination port.
 * Returns { detected: false } if no provider is configured — this is the
 * expected default state for a fresh deployment, not a failure.
 */
export async function checkPortCongestion(
  destinationPort: string,
  fetcher: typeof fetch = fetch,
): Promise<DelaySignalResult> {
  const apiUrl = process.env.PORT_CONGESTION_API_URL;
  const apiKey = process.env.PORT_CONGESTION_API_KEY;
  if (!apiUrl || !apiKey) return NOT_DETECTED;

  try {
    // Placeholder request shape — replace with the real provider's contract
    // once one is chosen. Treated as advisory-only until then.
    const res = await fetcher(`${apiUrl}?port=${encodeURIComponent(destinationPort)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return NOT_DETECTED;
    const json = await res.json();
    if (!json?.congested) return NOT_DETECTED;
    return {
      detected: true,
      severity: json.severity === 'HIGH' ? 'WARNING' : 'ADVISORY',
      summary: `${destinationPort} reporting elevated port congestion.`,
      detail: typeof json.note === 'string' ? json.note : undefined,
    };
  } catch {
    // A feed outage is never surfaced as an alert — it just means "nothing
    // to report this cycle," same as the AIS cache falling back silently.
    return NOT_DETECTED;
  }
}

/**
 * Customs backlog check for an origin→destination lane.
 * Same "not configured → nothing to report" contract as checkPortCongestion.
 */
export async function checkCustomsBacklog(
  originCountry: string,
  destinationPort: string,
  fetcher: typeof fetch = fetch,
): Promise<DelaySignalResult> {
  const apiUrl = process.env.CUSTOMS_BACKLOG_API_URL;
  const apiKey = process.env.CUSTOMS_BACKLOG_API_KEY;
  if (!apiUrl || !apiKey) return NOT_DETECTED;

  try {
    const res = await fetcher(
      `${apiUrl}?origin=${encodeURIComponent(originCountry)}&destination=${encodeURIComponent(destinationPort)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!res.ok) return NOT_DETECTED;
    const json = await res.json();
    if (!json?.backlogged) return NOT_DETECTED;
    return {
      detected: true,
      severity: json.severity === 'HIGH' ? 'WARNING' : 'ADVISORY',
      summary: `Customs backlog reported on the ${originCountry} → ${destinationPort} lane.`,
      detail: typeof json.note === 'string' ? json.note : undefined,
    };
  } catch {
    return NOT_DETECTED;
  }
}
