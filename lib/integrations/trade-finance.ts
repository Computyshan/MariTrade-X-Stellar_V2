/**
 * lib/integrations/trade-finance.ts
 *
 * Letter of credit / trade finance hooks — Phase 5, Direct System
 * Integration. For larger shipments, lets an importer link an LC or other
 * financing product to a MariTrade shipment. Deliberately one-directional:
 * MariTrade never calls out to a bank's LC system here — it just records the
 * link and snapshots its own escrow status at link time, so the financing
 * provider's own process (or the importer, manually) can reference where
 * MariTrade's escrow stood without MariTrade needing an API integration with
 * every possible issuing bank.
 *
 * There is therefore no "not_configured" branch here the way the other
 * Phase 5 integrations have one — this module has nothing to degrade to; a
 * link is just a record. `syncTradeFinanceStatus` is a placeholder for a
 * possible future pull-based status check (e.g. re-fetching the LC's status
 * from a provider that does expose an API) and is unimplemented today.
 */

import { EscrowStatus, TradeFinanceStatus } from '../../types';

export interface TradeFinanceSnapshot {
  escrowStatusAtLink: EscrowStatus;
  linkedAt: string;
}

/** Captures the current escrow status at the moment an LC/financing
 *  instrument is linked — pure bookkeeping, no external call. */
export function snapshotEscrowStatusForLink(escrowStatus: EscrowStatus): TradeFinanceSnapshot {
  return {
    escrowStatusAtLink: escrowStatus,
    linkedAt: new Date().toISOString(),
  };
}

/**
 * Placeholder for a future pull-based re-sync against a financing
 * provider's own status API, for providers that expose one. Not
 * implemented — every deployment today relies on the importer or financing
 * provider updating `TradeFinanceLink.status` manually via the
 * PATCH-equivalent on app/api/shipments/[id]/trade-finance/route.ts.
 */
export async function syncTradeFinanceStatus(
  _referenceNumber: string
): Promise<{ status: TradeFinanceStatus } | null> {
  return null;
}
