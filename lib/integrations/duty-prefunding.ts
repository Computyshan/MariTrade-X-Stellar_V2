/**
 * lib/integrations/duty-prefunding.ts
 *
 * Bank/wallet integration for duty pre-funding — Phase 5, Direct System
 * Integration. Lets an importer pre-authorize the estimated duty amount
 * through MariTrade's own rails, so the assigned Customs Broker can draw on
 * it to actually pay BOC instead of needing a separate payment channel
 * outside the platform.
 *
 * SCOPE NOTE: This is a genuinely new payment rail, separate from the
 * escrow contract (contracts/escrow) — duty pre-funding is importer funds
 * held for BOC duty payment, not the cargo-value escrow between importer
 * and exporter. The functions below define the provider contract and record
 * the authorization lifecycle in the DB; the actual on-chain hold/capture
 * mechanism (e.g. a dedicated Soroban duty-vault contract, or a simple
 * platform-custodied Stellar payment) is a follow-up build, gated behind
 * `isDutyPreFundingConfigured()` exactly like the other Phase 5 providers.
 * Until that lands, every call here returns `not_configured` and
 * app/api/shipments/[id]/duty-prefunding/route.ts records the authorization
 * intent in `duty_prefunding_authorizations` without moving any funds —
 * the Customs Broker still pays BOC through today's outside channel and
 * logs DUTIES_AND_TAXES_PAID manually either way.
 *
 * Required env vars once the on-chain hold mechanism is built:
 *   DUTY_PREFUNDING_PLATFORM_ADDRESS — Stellar address that custodies
 *     pre-authorized duty funds pending capture
 *   DUTY_PREFUNDING_PLATFORM_SECRET  — its signing key, for capture/release
 */

import { IntegrationResult, notConfigured, ok } from './types';

export function isDutyPreFundingConfigured(): boolean {
  return Boolean(
    process.env.DUTY_PREFUNDING_PLATFORM_ADDRESS && process.env.DUTY_PREFUNDING_PLATFORM_SECRET
  );
}

export interface AuthorizeDutyPreFundingParams {
  shipmentReferenceCode: string;
  importerStellarAddress: string;
  estimatedDutyAmountUSD: number;
}

export interface DutyPreFundingReference {
  /** Opaque reference to whatever on-chain/off-chain hold was created. */
  rawReference: string;
}

/**
 * Place a hold on the importer's estimated duty amount. Returns
 * `not_configured` until the on-chain hold mechanism above is built —
 * callers should still create a `duty_prefunding_authorizations` row with
 * status `NOT_REQUESTED`/`AUTHORIZED` as appropriate so the intent and
 * amount are recorded even before funds actually move.
 */
export async function authorizeDutyPreFunding(
  params: AuthorizeDutyPreFundingParams
): Promise<IntegrationResult<DutyPreFundingReference>> {
  if (!isDutyPreFundingConfigured()) {
    return notConfigured('DUTY_PREFUNDING_PLATFORM_ADDRESS / _SECRET not set — recording intent only.');
  }
  // TODO: build the real hold mechanism (dedicated Soroban duty-vault
  // contract, or a simple platform-custodied Stellar payment) and call it
  // here. Left unimplemented deliberately — see SCOPE NOTE above.
  return ok({ rawReference: `unimplemented:${params.shipmentReferenceCode}` });
}

export interface CaptureDutyPreFundingParams {
  rawReference: string;
  capturedAmountUSD: number;
}

/** Draw down a previously-authorized hold to actually pay BOC. */
export async function captureDutyPreFunding(
  params: CaptureDutyPreFundingParams
): Promise<IntegrationResult<{ capturedAt: string }>> {
  if (!isDutyPreFundingConfigured()) {
    return notConfigured('DUTY_PREFUNDING_PLATFORM_ADDRESS / _SECRET not set.');
  }
  // TODO: see authorizeDutyPreFunding — same follow-up build.
  return ok({ capturedAt: new Date().toISOString() });
}

/** Release a hold that's no longer needed (shipment cancelled, duty waived, etc.). */
export async function cancelDutyPreFunding(
  rawReference: string
): Promise<IntegrationResult<{ cancelledAt: string }>> {
  if (!isDutyPreFundingConfigured()) {
    return notConfigured('DUTY_PREFUNDING_PLATFORM_ADDRESS / _SECRET not set.');
  }
  return ok({ cancelledAt: new Date().toISOString() });
}
