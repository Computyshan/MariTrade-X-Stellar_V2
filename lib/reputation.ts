/**
 * lib/reputation.ts — MariTrade v2
 *
 * Phase 1 (Reputation & Marketplace Pressure) computation layer.
 * Pure functions only — no DB access here, so they're easy to unit test and
 * safe to call from any route (directory, scorecard, public profile) without
 * duplicating query logic. Callers fetch the raw tables once (getShipments,
 * getAssignments, getAllMilestones) and pass them in, so scoring N users in
 * one request stays O(shipments + milestones) instead of N queries.
 *
 * All rates are proxies computed strictly from data that already exists in
 * the schema (types/index.ts). Two known limitations, called out here so
 * nobody mistakes these for more precise than they are:
 *   - There is no dedicated `Dispute` entity with an `initiatedById` field,
 *     so "dispute rate" below means *involvement* in a disputed shipment,
 *     not proof of who raised the dispute.
 *   - There is no explicit "funded at" timestamp, so funding promptness is
 *     measured as a completion rate (did they fund it at all) rather than a
 *     precise turnaround time. A future EscrowRecord timestamp (see the
 *     Phase 5 escrow-as-incentive plan) would let this become a true
 *     time-based metric.
 */

import {
  Shipment,
  ShipmentAssignment,
  MilestoneEvent,
  MilestoneType,
  MILESTONE_EVIDENCE_MODE,
  User,
  JobRole,
  getUserJobRoles,
} from '../types';

export type PerformanceBadgeTier = 'BRONZE' | 'SILVER' | 'GOLD';

export const PERFORMANCE_BADGE_LABELS: Record<PerformanceBadgeTier, string> = {
  BRONZE: 'Bronze Track Record',
  SILVER: 'Silver Track Record',
  GOLD: 'Gold Track Record',
};

export interface LogisticsScorecard {
  userId: string;
  shipmentsHandled: number;
  shipmentsCompleted: number;
  /** % of DELIVERED_AND_SIGNED_OFF logs at/before the shipment's
   *  estimatedArrival. null if there's no scoreable sample yet. */
  onTimeDeliveryRate: number | null;
  /** % of handled shipments that ever carried a DISPUTED status/escrowStatus. */
  disputeRate: number | null;
  /** % of this user's logged milestones with complete evidence for their
   *  declared MilestoneEvidenceMode. */
  evidenceCompletenessRate: number | null;
  /** Avg hours between shipment creation and this user's
   *  CUSTOMS_CLEARANCE_APPROVED log — only populated for Customs Brokers
   *  (or anyone else who has logged that milestone). */
  avgCustomsClearanceHours: number | null;
  milestonesLogged: number;
  badgeTier: PerformanceBadgeTier | null;
  sampleSize: {
    deliveriesWithEta: number;
    clearancesTimed: number;
  };
}

export interface TradePartyReliability {
  userId: string;
  shipmentsInvolved: number;
  /** % of shipments (as importer) past negotiation that reached
   *  FUNDED/RELEASED escrow status. */
  fundingCompletionRate: number | null;
  /** % of involved shipments that ever carried a DISPUTED status/escrowStatus. */
  disputeInvolvementRate: number | null;
  badgeTier: PerformanceBadgeTier | null;
  sampleSize: {
    shipmentsPastNegotiation: number;
  };
}

const DISPUTED_STATUSES = new Set(['DISPUTED']);

function isMilestoneEvidenceComplete(m: MilestoneEvent): boolean {
  const mode = MILESTONE_EVIDENCE_MODE[m.type as MilestoneType];
  if (mode === 'REFERENCE_NUMBER') return !!m.evidenceRef && m.evidenceRef.trim().length > 0;
  if (mode === 'DOCUMENT') return !!m.evidenceUrl && m.evidenceUrl.trim().length > 0;
  // PHOTO_OR_NOTE — evidenceUrl is optional, a written description satisfies it
  return (!!m.evidenceUrl && m.evidenceUrl.trim().length > 0) || (!!m.description && m.description.trim().length > 0);
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal place
}

function logisticsBadgeTier(s: Omit<LogisticsScorecard, 'badgeTier'>): PerformanceBadgeTier | null {
  const disputeRate = s.disputeRate ?? 0;
  if (s.shipmentsCompleted >= 10 && (s.onTimeDeliveryRate ?? 0) >= 90 && disputeRate <= 5) return 'GOLD';
  if (s.shipmentsCompleted >= 5 && (s.onTimeDeliveryRate ?? 0) >= 75 && disputeRate <= 15) return 'SILVER';
  if (s.shipmentsCompleted >= 2 && disputeRate <= 25) return 'BRONZE';
  return null;
}

function tradePartyBadgeTier(s: Omit<TradePartyReliability, 'badgeTier'>): PerformanceBadgeTier | null {
  const disputeRate = s.disputeInvolvementRate ?? 0;
  if (s.shipmentsInvolved >= 10 && (s.fundingCompletionRate ?? 0) >= 95 && disputeRate <= 5) return 'GOLD';
  if (s.shipmentsInvolved >= 5 && (s.fundingCompletionRate ?? 0) >= 85 && disputeRate <= 15) return 'SILVER';
  if (s.shipmentsInvolved >= 2 && disputeRate <= 25) return 'BRONZE';
  return null;
}

/**
 * Compute a Logistics Chain performance scorecard for every `userId` in one
 * pass over the already-fetched shipments/assignments/milestones tables.
 */
export function computeLogisticsScorecards(
  userIds: string[],
  data: { shipments: Shipment[]; assignments: ShipmentAssignment[]; milestones: MilestoneEvent[] }
): Map<string, LogisticsScorecard> {
  const shipmentById = new Map(data.shipments.map(s => [s.id, s]));
  const result = new Map<string, LogisticsScorecard>();

  for (const userId of userIds) {
    const myAssignments = data.assignments.filter(a => a.userId === userId);
    const myShipmentIds = new Set(myAssignments.map(a => a.shipmentId));
    const myShipments = [...myShipmentIds]
      .map(id => shipmentById.get(id))
      .filter((s): s is Shipment => !!s);
    const myMilestones = data.milestones.filter(m => m.loggedById === userId);

    const shipmentsHandled = myShipments.length;
    const shipmentsCompleted = myShipments.filter(s => s.status === 'DELIVERED').length;

    const disputedCount = myShipments.filter(
      s => DISPUTED_STATUSES.has(s.status) || DISPUTED_STATUSES.has(s.escrowStatus)
    ).length;
    const disputeRate = pct(disputedCount, shipmentsHandled);

    // On-time delivery: compare this user's DELIVERED_AND_SIGNED_OFF logs
    // against the shipment's estimatedArrival, scoped to shipments they handled.
    const deliveryMilestones = myMilestones.filter(
      m => m.type === 'DELIVERED_AND_SIGNED_OFF' && myShipmentIds.has(m.shipmentId)
    );
    const deliveriesWithEta = deliveryMilestones.filter(m => !!shipmentById.get(m.shipmentId)?.estimatedArrival);
    const onTimeCount = deliveriesWithEta.filter(m => {
      const s = shipmentById.get(m.shipmentId)!;
      return new Date(m.occurredAt).getTime() <= new Date(s.estimatedArrival!).getTime();
    }).length;
    const onTimeDeliveryRate = pct(onTimeCount, deliveriesWithEta.length);

    // Customs clearance turnaround: only populated for users who actually
    // logged CUSTOMS_CLEARANCE_APPROVED (i.e. Customs Brokers).
    const clearanceHours = myMilestones
      .filter(m => m.type === 'CUSTOMS_CLEARANCE_APPROVED')
      .map(m => {
        const s = shipmentById.get(m.shipmentId);
        if (!s) return null;
        const hours = (new Date(m.occurredAt).getTime() - new Date(s.createdAt).getTime()) / 3_600_000;
        return hours >= 0 ? hours : null;
      })
      .filter((h): h is number => h !== null);
    const avgCustomsClearanceHours =
      clearanceHours.length > 0
        ? Math.round((clearanceHours.reduce((a, b) => a + b, 0) / clearanceHours.length) * 10) / 10
        : null;

    // Evidence completeness across every milestone this user has ever logged
    // (not scoped to myShipmentIds — it's a measure of their logging habit).
    const evidenceCompleteCount = myMilestones.filter(isMilestoneEvidenceComplete).length;
    const evidenceCompletenessRate = pct(evidenceCompleteCount, myMilestones.length);

    const base = {
      userId,
      shipmentsHandled,
      shipmentsCompleted,
      onTimeDeliveryRate,
      disputeRate,
      evidenceCompletenessRate,
      avgCustomsClearanceHours,
      milestonesLogged: myMilestones.length,
      sampleSize: {
        deliveriesWithEta: deliveriesWithEta.length,
        clearancesTimed: clearanceHours.length,
      },
    };

    result.set(userId, { ...base, badgeTier: logisticsBadgeTier(base) });
  }

  return result;
}

/**
 * Compute a Trade Party reliability score for every `userId` in one pass.
 * Trade Party accounts aren't tracked via shipment_assignments — they're
 * the importerId/exporterId directly on Shipment — so we filter there.
 */
export function computeTradePartyReliabilityScores(
  userIds: string[],
  data: { shipments: Shipment[] }
): Map<string, TradePartyReliability> {
  const result = new Map<string, TradePartyReliability>();
  const NEGOTIATION_STATUSES = new Set(['PENDING_EXPORTER', 'COUNTER_OFFER']);

  for (const userId of userIds) {
    const involved = data.shipments.filter(s => s.importerId === userId || s.exporterId === userId);
    const shipmentsInvolved = involved.length;

    const disputedCount = involved.filter(
      s => DISPUTED_STATUSES.has(s.status) || DISPUTED_STATUSES.has(s.escrowStatus)
    ).length;
    const disputeInvolvementRate = pct(disputedCount, shipmentsInvolved);

    // Funding is the importer's action — only count shipments where this
    // user is the importer AND the deal actually cleared negotiation, since
    // a shipment stuck at PENDING_EXPORTER/COUNTER_OFFER was never theirs to
    // fund yet.
    const fundable = involved.filter(
      s => s.importerId === userId && !NEGOTIATION_STATUSES.has(s.status) && s.status !== 'CANCELLED'
    );
    const fundedCount = fundable.filter(s => s.escrowStatus === 'FUNDED' || s.escrowStatus === 'RELEASED').length;
    const fundingCompletionRate = pct(fundedCount, fundable.length);

    const base = {
      userId,
      shipmentsInvolved,
      fundingCompletionRate,
      disputeInvolvementRate,
      sampleSize: { shipmentsPastNegotiation: fundable.length },
    };

    result.set(userId, { ...base, badgeTier: tradePartyBadgeTier(base) });
  }

  return result;
}

export type AnyScorecard =
  | { kind: 'LOGISTICS_CHAIN'; scorecard: LogisticsScorecard }
  | { kind: 'TRADE_PARTY'; scorecard: TradePartyReliability };

/** Convenience: compute the right scorecard shape for a single user based on
 *  their role category, given already-fetched tables. Returns null if the
 *  user is ADMIN or has no roles (category can't be determined). */
export function computeScorecardForUser(
  user: Pick<User, 'id' | 'jobRole' | 'jobRoles'>,
  data: { shipments: Shipment[]; assignments: ShipmentAssignment[]; milestones: MilestoneEvent[] }
): AnyScorecard | null {
  const roles = getUserJobRoles(user);
  if (roles.length === 0) return null;
  const isLogistics = roles.some(
    (r: JobRole) => r === 'FREIGHT_FORWARDER' || r === 'WAREHOUSE_OPERATOR' || r === 'CUSTOMS_BROKER'
  );
  const isTradeParty = roles.some((r: JobRole) => r === 'IMPORTER' || r === 'EXPORTER');

  if (isLogistics) {
    const map = computeLogisticsScorecards([user.id], data);
    return { kind: 'LOGISTICS_CHAIN', scorecard: map.get(user.id)! };
  }
  if (isTradeParty) {
    const map = computeTradePartyReliabilityScores([user.id], { shipments: data.shipments });
    return { kind: 'TRADE_PARTY', scorecard: map.get(user.id)! };
  }
  return null;
}

/** Batch version of computeScorecardForUser — one Map keyed by userId,
 *  computed with a single pass over the shared tables. Used by the
 *  directory route to decorate every listed member without N+1 queries. */
export function computeScorecardsForUsers(
  users: Pick<User, 'id' | 'jobRole' | 'jobRoles'>[],
  data: { shipments: Shipment[]; assignments: ShipmentAssignment[]; milestones: MilestoneEvent[] }
): Map<string, AnyScorecard> {
  const logisticsIds: string[] = [];
  const tradePartyIds: string[] = [];
  for (const u of users) {
    const roles = getUserJobRoles(u);
    if (roles.some((r: JobRole) => r === 'FREIGHT_FORWARDER' || r === 'WAREHOUSE_OPERATOR' || r === 'CUSTOMS_BROKER')) {
      logisticsIds.push(u.id);
    } else if (roles.some((r: JobRole) => r === 'IMPORTER' || r === 'EXPORTER')) {
      tradePartyIds.push(u.id);
    }
  }

  const logisticsMap = computeLogisticsScorecards(logisticsIds, data);
  const tradePartyMap = computeTradePartyReliabilityScores(tradePartyIds, { shipments: data.shipments });

  const result = new Map<string, AnyScorecard>();
  for (const [id, scorecard] of logisticsMap) result.set(id, { kind: 'LOGISTICS_CHAIN', scorecard });
  for (const [id, scorecard] of tradePartyMap) result.set(id, { kind: 'TRADE_PARTY', scorecard });
  return result;
}
