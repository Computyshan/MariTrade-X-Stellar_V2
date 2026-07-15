/**
 * lib/integrations/types.ts
 *
 * Shared contract for every Phase 5 (Direct System Integration) provider
 * client — BOC e2m, carrier booking, duty pre-funding. Mirrors the
 * "unconfigured degrades gracefully" pattern already used by
 * lib/verification/ais-tracking.ts and lib/vessel-tracking.ts, generalized
 * so every route calling one of these clients can handle the "not wired up
 * yet" case identically instead of each inventing its own shape.
 *
 * `reason: 'not_configured'` is not an error — it's the expected result for
 * any deployment that hasn't set the relevant provider's env vars, and every
 * caller must treat it as "fall back to the manual flow", not as a 500.
 */

export type IntegrationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'not_configured'; message?: string }
  | { ok: false; reason: 'provider_error'; message: string };

export function notConfigured<T>(message?: string): IntegrationResult<T> {
  return { ok: false, reason: 'not_configured', message };
}

export function providerError<T>(message: string): IntegrationResult<T> {
  return { ok: false, reason: 'provider_error', message };
}

export function ok<T>(data: T): IntegrationResult<T> {
  return { ok: true, data };
}
