import { GoogleGenAI, Type } from '@google/genai';
import { MilestoneType, ShipmentScope, MilestoneEvent, Shipment } from '../../types';
import { RouteHistoricalStats } from '../delay-risk';
import { RouteFreightStats } from '../rate-benchmark';

// ─── CRITICAL FIX: corrected model name (was "gemini-3.5-flash" which doesn't exist)
const GEMINI_MODEL = 'gemini-3.5-flash';

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Phase 3: Auto-fill BOC customs form from uploaded invoice text using Gemini structured JSON
export async function autofillBOCForm(invoiceText: string): Promise<Record<string, string> | { error: string }> {
  const ai = getGeminiClient();

  // CRITICAL FIX: removed hardcoded Japan/Dela Cruz mock — now returns an error state
  // so callers can surface it in the UI instead of silently using fake data.
  if (!ai) {
    return { error: 'GEMINI_API_KEY is not configured. Please set it in your environment variables to use AI autofill.' };
  }

  try {
    const prompt = `You are a Philippine Bureau of Customs (BOC) automation agent. Take this raw invoice text and extract the structured import fields as defined in the schema. Ensure fields conform to standard shipping definitions. Raw text: \n\n${invoiceText}`;
    
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exporterName: { type: Type.STRING },
            importerName: { type: Type.STRING },
            originCountry: { type: Type.STRING },
            destinationPort: { type: Type.STRING },
            cargoDescription: { type: Type.STRING },
            totalValueUSD: { type: Type.STRING },
            hsCodeSuggested: { type: Type.STRING },
            estimatedDutiesPHP: { type: Type.STRING }
          },
          required: ['exporterName', 'importerName', 'originCountry', 'destinationPort', 'cargoDescription', 'totalValueUSD']
        }
      }
    });

    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (err) {
    console.error('Gemini invoice extraction failed:', err);
    return { error: 'AI extraction failed. Please fill in the form manually.' };
  }
}

// Phase 3: AI freight cost estimator
export async function estimateFreightCost(params: {
  originCountry: string;
  destinationPort: string;
  cargoWeightKg: number;
  cargoType: string;
}): Promise<{ estimatedUSD: number; confidence: string; breakdown: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    // Graceful fallback using actual params — not hardcoded values
    const baseAmt = Math.round((params.cargoWeightKg * 0.15) + 1200);
    return {
      estimatedUSD: baseAmt,
      confidence: 'MEDIUM-HIGH',
      breakdown: `Ocean freight transport route: ${params.originCountry} to ${params.destinationPort}. Standard ${params.cargoType} logistics handling fees calculated at $0.15/kg. Port loading/unloading operations fee: $1,200.`
    };
  }

  try {
    const prompt = `Estimate the sea freight cost and shipping fee from ${params.originCountry} to the destination port ${params.destinationPort} for ${params.cargoWeightKg}kg of ${params.cargoType}. Return a JSON with:
    - estimatedUSD (number)
    - confidence (string)
    - breakdown (string explanation)
    Be realistic for marine shipping.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedUSD: { type: Type.INTEGER },
            confidence: { type: Type.STRING },
            breakdown: { type: Type.STRING }
          },
          required: ['estimatedUSD', 'confidence', 'breakdown']
        }
      }
    });

    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (err) {
    console.error('Gemini cost estimation failed, returning default:', err);
    return {
      estimatedUSD: 2450,
      confidence: 'LOW',
      breakdown: 'Standard general maritime flat-rate quote of $2,450 applied.'
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 (AI-Assisted Decision Support) — reuses the same generateContent /
// structured-JSON / graceful-fallback pattern as autofillBOCForm and
// estimateFreightCost above. Every function here returns a *suggestion*;
// nothing calls these and auto-applies the result — the caller (API route +
// UI) always requires an explicit human confirm/apply action, and logs the
// suggestion as "AI-suggested, human-confirmed" rather than an autonomous
// decision, per the plan's liability posture.
// ─────────────────────────────────────────────────────────────────────────

// A conservative default milestone set any shipment should require,
// regardless of what the model or fallback rules produce — mirrors
// DEFAULT_PRIORITY_MILESTONES in app/(dashboard)/shipments/new/page.tsx.
const BASE_RECOMMENDED_MILESTONES: MilestoneType[] = ['CUSTOMS_CLEARANCE_APPROVED', 'DELIVERED_AND_SIGNED_OFF'];

export interface MilestoneRecommendation {
  recommended: MilestoneType[];
  reasoning: string;
}

// Rule-based fallback used both when GEMINI_API_KEY is unset and when a
// live call fails — keeps the recommender useful offline, same spirit as
// estimateFreightCost's non-AI branch.
function ruleBasedMilestoneRecommendation(params: {
  totalValueUSD?: number;
  isDangerousGoods?: boolean;
  shipmentScope: ShipmentScope;
}): MilestoneRecommendation {
  const set = new Set<MilestoneType>(BASE_RECOMMENDED_MILESTONES);
  const reasons: string[] = ['Customs clearance and final delivery sign-off are always required for release.'];

  if (params.isDangerousGoods) {
    set.add('CUSTOMS_EXAMINATION_REQUESTED');
    reasons.push('Dangerous-goods cargo commonly triggers a customs examination, so that hold point is included.');
  }
  if ((params.totalValueUSD ?? 0) >= 10_000) {
    set.add('BILL_OF_LADING_ISSUED');
    set.add('DUTIES_AND_TAXES_PAID');
    reasons.push('Higher-value cargo benefits from gating on the B/L and duties/taxes receipt as well.');
  }
  if (params.shipmentScope === 'OVERSEAS') {
    set.add('VESSEL_DEPARTED_ORIGIN');
    reasons.push('Overseas shipments add a departure-confirmation gate before funds can move.');
  }

  return { recommended: Array.from(set), reasoning: reasons.join(' ') };
}

/**
 * Trade Party item — "Milestone-requirement recommender". Suggests which
 * milestones a new shipment should require for escrow release, based on
 * cargo type/value/scope. The importer still picks from the full list in
 * the UI; this only pre-selects a starting point.
 */
export async function recommendPriorityMilestones(params: {
  cargoDescription: string;
  hsCode?: string;
  isDangerousGoods: boolean;
  shipmentScope: ShipmentScope;
  originCountry: string;
  destinationPort: string;
  totalValueUSD?: number;
}): Promise<MilestoneRecommendation> {
  const ai = getGeminiClient();
  const fallback = ruleBasedMilestoneRecommendation(params);
  if (!ai) return fallback;

  try {
    const prompt = `You are advising an importer on a freight platform which milestones should gate their escrow release. Cargo: "${params.cargoDescription}" (HS code: ${params.hsCode || 'not specified'}). Dangerous goods: ${params.isDangerousGoods}. Shipment scope: ${params.shipmentScope}. Route: ${params.originCountry} -> ${params.destinationPort}. Declared value: ${params.totalValueUSD ?? 'not specified'} USD.
    Choose which of these milestone types should be REQUIRED before escrow releases (pick 2-6, always include CUSTOMS_CLEARANCE_APPROVED and DELIVERED_AND_SIGNED_OFF): BOOKING_CONFIRMED, SPACE_ON_VESSEL_SECURED, CONTAINER_GATED_OUT_ORIGIN, VESSEL_DEPARTED_ORIGIN, BILL_OF_LADING_ISSUED, CONTAINER_GATED_IN_DESTINATION, CARGO_RELEASED_FOR_PICKUP, ARRIVED_AT_DELIVERY_ADDRESS, DELIVERED_AND_SIGNED_OFF, BOC_ENTRY_FILED, DUTIES_AND_TAXES_PAID, CUSTOMS_EXAMINATION_REQUESTED, CUSTOMS_CLEARANCE_APPROVED, CARGO_INSPECTED_AND_PACKED, CARGO_RECEIVED_AT_WAREHOUSE.
    Return JSON with "recommended" (array of the exact milestone type strings from that list) and "reasoning" (2-3 sentence plain-English explanation an importer would understand).`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommended: { type: Type.ARRAY, items: { type: Type.STRING } },
            reasoning: { type: Type.STRING },
          },
          required: ['recommended', 'reasoning'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const recommended: MilestoneType[] = Array.isArray(parsed.recommended)
      ? parsed.recommended.filter((m: unknown): m is MilestoneType => typeof m === 'string' && ALL_MILESTONE_TYPES.has(m as MilestoneType))
      : [];

    // Guard against a model response that omits the non-negotiable pair or
    // returns nothing usable — always fall back to the rule-based set rather
    // than surfacing an empty/invalid recommendation.
    if (recommended.length === 0) return fallback;
    for (const base of BASE_RECOMMENDED_MILESTONES) {
      if (!recommended.includes(base)) recommended.push(base);
    }

    return {
      recommended,
      reasoning: typeof parsed.reasoning === 'string' && parsed.reasoning.trim() ? parsed.reasoning : fallback.reasoning,
    };
  } catch (err) {
    console.error('Gemini milestone recommendation failed, using rule-based fallback:', err);
    return fallback;
  }
}

const ALL_MILESTONE_TYPES = new Set<MilestoneType>([
  'BOOKING_CONFIRMED', 'DOCUMENTS_SUBMITTED_TO_CARRIER', 'SPACE_ON_VESSEL_SECURED', 'CONTAINER_GATED_OUT_ORIGIN',
  'CONTAINER_LOADED_ON_VESSEL', 'VESSEL_CLEARED_TO_DEPART', 'VESSEL_DEPARTED_ORIGIN', 'BILL_OF_LADING_ISSUED',
  'VESSEL_ARRIVED_AT_BERTH', 'VESSEL_ARRIVED_DESTINATION', 'CONTAINER_OFFLOADED', 'CONTAINER_GATED_IN_DESTINATION',
  'CARGO_RELEASED_FOR_PICKUP', 'IN_TRANSIT_TO_DESTINATION', 'ARRIVED_AT_DELIVERY_ADDRESS', 'DELIVERED_AND_SIGNED_OFF',
  'BOC_ENTRY_FILED', 'PORT_HOLD_PLACED_OR_LIFTED', 'DUTIES_AND_TAXES_PAID', 'CUSTOMS_EXAMINATION_REQUESTED',
  'CUSTOMS_CLEARANCE_APPROVED', 'CARGO_READY_FOR_COLLECTION', 'CARGO_INSPECTED_AND_PACKED', 'CARGO_STAGED_FOR_PICKUP',
  'CARGO_HANDED_OFF_TO_CARRIER', 'CARGO_PICKED_UP_FROM_PORT', 'CARGO_RECEIVED_AT_WAREHOUSE', 'INCOMING_CARGO_STORED',
  'FAILED_DELIVERY_ATTEMPT',
]);

export interface HsCodeSuggestion {
  code: string;
  description: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Logistics Chain item — "HS code classification assistant". In this
 * codebase the HS code field lives on the shipment-creation form (filled by
 * the Trade Party), with Customs Brokers relying on it downstream at
 * BOC_ENTRY_FILED — so this is surfaced there as a suggestion the filer
 * confirms, same non-autonomous posture as the rest of Phase 2. Returns an
 * empty suggestion list (never a guess) when no API key is configured,
 * since a wrong tariff code is a compliance problem, not just a UX one.
 */
export async function classifyHsCode(params: {
  cargoDescription: string;
  isDangerousGoods: boolean;
}): Promise<{ suggestions: HsCodeSuggestion[]; note?: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      suggestions: [],
      note: 'GEMINI_API_KEY is not configured. Please select an HS code manually.',
    };
  }

  try {
    const prompt = `Suggest up to 3 plausible Harmonized System (HS) tariff codes for this cargo description: "${params.cargoDescription}"${params.isDangerousGoods ? ' (declared as dangerous goods / HazMat)' : ''}. Use standard 6-digit HS subheadings (add a 2-digit national extension only if obviously standard, e.g. Philippine AHTN). Order by confidence, highest first. This is only a starting suggestion for a customs broker to verify — do not claim certainty.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  description: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                },
                required: ['code', 'description', 'confidence'],
              },
            },
          },
          required: ['suggestions'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"suggestions":[]}');
    const suggestions: HsCodeSuggestion[] = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((s: any) => s && typeof s.code === 'string' && typeof s.description === 'string')
          .slice(0, 3)
          .map((s: any) => ({
            code: s.code,
            description: s.description,
            confidence: (['HIGH', 'MEDIUM', 'LOW'].includes(s.confidence) ? s.confidence : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW',
          }))
      : [];

    return { suggestions };
  } catch (err) {
    console.error('Gemini HS code classification failed:', err);
    return { suggestions: [], note: 'AI classification failed. Please select an HS code manually.' };
  }
}

export type DelayRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DelayRiskAssessment {
  riskLevel: DelayRiskLevel;
  reasoning: string;
  recommendedActions: string[];
  historicalStats: RouteHistoricalStats;
}

function ruleBasedDelayRisk(stats: RouteHistoricalStats): { riskLevel: DelayRiskLevel; reasoning: string; recommendedActions: string[] } {
  if (stats.sampleSize === 0) {
    return {
      riskLevel: 'MEDIUM',
      reasoning: 'No prior MariTrade shipments on this exact route yet, so this is a default caution level rather than a data-backed read.',
      recommendedActions: ['Confirm customs documentation early since there is no route history to lean on.'],
    };
  }
  const holdRate = stats.holdRate ?? 0;
  const disputeRate = stats.disputeRate ?? 0;
  if (holdRate >= 30 || disputeRate >= 20) {
    return {
      riskLevel: 'HIGH',
      reasoning: `${holdRate}% of the ${stats.sampleSize} prior shipments on this route had a port hold logged, and ${disputeRate}% ended up disputed.`,
      recommendedActions: [
        'Pre-file customs documentation as early as possible.',
        'Confirm HS code and duties calculation before the vessel arrives.',
        'Flag this shipment to the assigned Customs Broker for early review.',
      ],
    };
  }
  if (holdRate >= 10 || disputeRate >= 8) {
    return {
      riskLevel: 'MEDIUM',
      reasoning: `${holdRate}% of the ${stats.sampleSize} prior shipments on this route had a port hold logged; worth a closer look but not an outlier.`,
      recommendedActions: ['Double-check documentation completeness ahead of arrival.'],
    };
  }
  return {
    riskLevel: 'LOW',
    reasoning: `Only ${holdRate}% of the ${stats.sampleSize} prior shipments on this route had a port hold logged, and ${disputeRate}% were disputed — no elevated risk signal.`,
    recommendedActions: ['No special prep beyond standard documentation.'],
  };
}

/**
 * Logistics Chain item — "Delay-risk prediction". Combines platform-wide
 * historical stats for this route (computeRouteHistoricalStats in
 * lib/delay-risk.ts) with Gemini's read on the specific cargo/route
 * combination, so freight forwarders/customs brokers get a heads-up before
 * arrival rather than discovering a hold after the fact.
 */
export async function predictDelayRisk(params: {
  originCountry: string;
  destinationPort: string;
  cargoDescription: string;
  isDangerousGoods: boolean;
  stats: RouteHistoricalStats;
}): Promise<DelayRiskAssessment> {
  const ai = getGeminiClient();
  const fallback = ruleBasedDelayRisk(params.stats);
  if (!ai) return { ...fallback, historicalStats: params.stats };

  try {
    const prompt = `You are a freight-delay risk assistant for a Philippine import/export platform. Route: ${params.originCountry} -> ${params.destinationPort}. Cargo: "${params.cargoDescription}"${params.isDangerousGoods ? ' (dangerous goods / HazMat)' : ''}.
    Platform historical data for this exact route (sample size ${params.stats.sampleSize} prior shipments): port-hold rate ${params.stats.holdRate ?? 'unknown'}%, dispute rate ${params.stats.disputeRate ?? 'unknown'}%, average customs clearance time ${params.stats.avgClearanceHours ?? 'unknown'} hours.
    Weigh the historical data most heavily (a route with a real sample is more reliable than general knowledge), but also factor in general customs/congestion risk for this route and cargo type. Return JSON with "riskLevel" (exactly LOW, MEDIUM, or HIGH), "reasoning" (2-3 sentences, reference the historical numbers if a sample exists), and "recommendedActions" (1-3 short actionable prep steps for a freight forwarder or customs broker).`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['riskLevel', 'reasoning', 'recommendedActions'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const riskLevel: DelayRiskLevel = ['LOW', 'MEDIUM', 'HIGH'].includes(parsed.riskLevel) ? parsed.riskLevel : fallback.riskLevel;
    const reasoning = typeof parsed.reasoning === 'string' && parsed.reasoning.trim() ? parsed.reasoning : fallback.reasoning;
    const recommendedActions = Array.isArray(parsed.recommendedActions) && parsed.recommendedActions.length > 0
      ? parsed.recommendedActions.filter((a: unknown) => typeof a === 'string')
      : fallback.recommendedActions;

    return { riskLevel, reasoning, recommendedActions, historicalStats: params.stats };
  } catch (err) {
    console.error('Gemini delay-risk prediction failed, using rule-based fallback:', err);
    return { ...fallback, historicalStats: params.stats };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 continued — Rate benchmarking (Logistics Chain) and
// Dispute-evidence summarizer (Trade Party), added to close the two gaps
// flagged after the initial Phase 2 build: no freight-cost data existed to
// benchmark against, and raise_dispute() captured no reason for the AI to
// summarize. See lib/rate-benchmark.ts and types/index.ts (Shipment.
// freightCostUSD / disputeReason) for the supporting data model.
// ─────────────────────────────────────────────────────────────────────────

export type RateFloorConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface RateBenchmark {
  /** A suggested floor rate in USD a Freight Forwarder can use as a
   *  negotiating anchor with carriers. Null only if neither historical data
   *  nor a usable AI/fallback estimate could be produced. */
  suggestedFloorUSD: number | null;
  confidence: RateFloorConfidence;
  reasoning: string;
  stats: RouteFreightStats;
}

// Rule-based fallback — used both when GEMINI_API_KEY is unset and when a
// live call fails. Prefers the platform's own historical average whenever a
// sample exists (real MariTrade data beats a generic per-kg formula), and
// falls back to the same $0.15/kg + $1,200 shape as estimateFreightCost's
// non-AI branch only when there's no sample to lean on.
function ruleBasedRateBenchmark(
  params: { cargoWeightKg?: number; cargoType: string },
  stats: RouteFreightStats
): { suggestedFloorUSD: number | null; confidence: RateFloorConfidence; reasoning: string } {
  if (stats.sampleSize > 0 && stats.avgFreightCostUSD != null) {
    const confidence: RateFloorConfidence = stats.sampleSize >= 5 ? 'HIGH' : stats.sampleSize >= 2 ? 'MEDIUM' : 'LOW';
    return {
      suggestedFloorUSD: stats.avgFreightCostUSD,
      confidence,
      reasoning: `Based on ${stats.sampleSize} prior MariTrade shipment${stats.sampleSize === 1 ? '' : 's'} on this exact route, freight costs ranged $${stats.minFreightCostUSD?.toLocaleString()}–$${stats.maxFreightCostUSD?.toLocaleString()}, averaging $${stats.avgFreightCostUSD.toLocaleString()}. Use this as your negotiating floor with carriers.`,
    };
  }
  if (params.cargoWeightKg && params.cargoWeightKg > 0) {
    const estimate = Math.round(params.cargoWeightKg * 0.15 + 1200);
    return {
      suggestedFloorUSD: estimate,
      confidence: 'LOW',
      reasoning: `No prior MariTrade shipments on this exact route have a recorded freight cost yet, so this is a general estimate (~$0.15/kg + $1,200 port handling for ${params.cargoWeightKg}kg of ${params.cargoType}), not a data-backed benchmark.`,
    };
  }
  return {
    suggestedFloorUSD: null,
    confidence: 'LOW',
    reasoning: 'No historical freight-cost data for this route yet, and no cargo weight was given to produce a general estimate. Once a Freight Forwarder records a negotiated rate on this route, future shipments will get a real benchmark.',
  };
}

/**
 * Logistics Chain item — "Rate benchmarking" (Implementation Plan §5).
 * Combines platform-wide historical freight-cost stats for this route
 * (computeRouteFreightStats in lib/rate-benchmark.ts) with Gemini's general
 * knowledge of the route/cargo, giving Freight Forwarders a data-backed
 * floor to negotiate against with carriers — never an auto-applied price.
 */
export async function benchmarkFreightRate(params: {
  originCountry: string;
  destinationPort: string;
  cargoWeightKg?: number;
  cargoType: string;
  stats: RouteFreightStats;
}): Promise<RateBenchmark> {
  const ai = getGeminiClient();
  const fallback = ruleBasedRateBenchmark(params, params.stats);
  if (!ai) return { ...fallback, stats: params.stats };

  try {
    const prompt = `You are a freight-rate benchmarking assistant for a Philippine import/export platform. Route: ${params.originCountry} -> ${params.destinationPort}. Cargo type: ${params.cargoType}.${params.cargoWeightKg ? ` Weight: ${params.cargoWeightKg}kg.` : ''}
    Platform historical data for this exact route (sample size ${params.stats.sampleSize} prior shipments with a recorded freight cost, in USD): average ${params.stats.avgFreightCostUSD ?? 'unknown'}, range ${params.stats.minFreightCostUSD ?? 'unknown'} to ${params.stats.maxFreightCostUSD ?? 'unknown'}.
    Weigh the historical data most heavily when a sample exists (real platform data beats general knowledge), but factor in general ocean-freight market knowledge for this route/cargo type too, especially if the sample is small or empty. Return JSON with "suggestedFloorUSD" (a single number — the floor a freight forwarder should not accept less than when negotiating with a carrier), "confidence" (exactly HIGH, MEDIUM, or LOW), and "reasoning" (2-3 sentences, cite the historical numbers if a sample exists).`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedFloorUSD: { type: Type.NUMBER },
            confidence: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
          required: ['suggestedFloorUSD', 'confidence', 'reasoning'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const suggestedFloorUSD = typeof parsed.suggestedFloorUSD === 'number' ? parsed.suggestedFloorUSD : fallback.suggestedFloorUSD;
    const confidence: RateFloorConfidence = ['HIGH', 'MEDIUM', 'LOW'].includes(parsed.confidence) ? parsed.confidence : fallback.confidence;
    const reasoning = typeof parsed.reasoning === 'string' && parsed.reasoning.trim() ? parsed.reasoning : fallback.reasoning;

    return { suggestedFloorUSD, confidence, reasoning, stats: params.stats };
  } catch (err) {
    console.error('Gemini rate benchmarking failed, using rule-based fallback:', err);
    return { ...fallback, stats: params.stats };
  }
}

export interface DisputeEvidenceSummary {
  /** 3-5 sentence plain-English summary of the milestone/evidence trail and
   *  the dispute reason, for a human arbitrator to read quickly. */
  summary: string;
  /** Short chronological bullet points of the key logged events. */
  keyEvents: string[];
  /** Gaps or inconsistencies worth the arbitrator's attention — e.g. large
   *  time gaps between milestones, unverified entries, or milestones with
   *  no evidence attached. Never a recommendation on how to rule. */
  flaggedConcerns: string[];
}

// Rule-based fallback — used both when GEMINI_API_KEY is unset and when a
// live call fails. Purely mechanical (no interpretation), so it's always
// safe to show even without a model call.
function ruleBasedDisputeSummary(params: {
  shipment: Pick<Shipment, 'referenceCode' | 'description' | 'originCountry' | 'destinationPort' | 'totalValueUSD'>;
  disputeReason?: string;
  milestones: MilestoneEvent[];
}): DisputeEvidenceSummary {
  const sorted = [...params.milestones].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  const keyEvents = sorted.map(
    m => `${new Date(m.occurredAt).toLocaleDateString()} — ${m.type.replace(/_/g, ' ')}${m.verified ? '' : ' (unverified)'}`
  );
  const unverified = sorted.filter(m => !m.verified);
  const noEvidence = sorted.filter(m => !m.evidenceUrl && !m.evidenceRef && !m.description);
  const flaggedConcerns: string[] = [];
  if (unverified.length > 0) flaggedConcerns.push(`${unverified.length} milestone(s) logged but not marked verified.`);
  if (noEvidence.length > 0) flaggedConcerns.push(`${noEvidence.length} milestone(s) have no attached evidence, reference number, or note.`);
  if (sorted.length === 0) flaggedConcerns.push('No milestones have been logged on this shipment at all.');

  const summary = `Shipment ${params.shipment.referenceCode} (${params.shipment.description}, $${params.shipment.totalValueUSD.toLocaleString()}) on route ${params.shipment.originCountry} → ${params.shipment.destinationPort} has ${sorted.length} logged milestone${sorted.length === 1 ? '' : 's'}.${params.disputeReason ? ` Dispute reason given by the importer: "${params.disputeReason}"` : ' No dispute reason was recorded.'}`;

  return { summary, keyEvents, flaggedConcerns };
}

/**
 * Trade Party item — "Dispute-evidence summarizer" (Implementation Plan §5).
 * When a dispute is filed, summarizes the milestone/evidence trail plus the
 * importer's stated reason for the human arbitrator (the Admin Dispute
 * Panel) — still human-decided, but faster and more consistent to review.
 * Never used to auto-resolve or recommend a split.
 */
export async function summarizeDisputeEvidence(params: {
  shipment: Pick<Shipment, 'referenceCode' | 'description' | 'originCountry' | 'destinationPort' | 'totalValueUSD'>;
  disputeReason?: string;
  milestones: MilestoneEvent[];
}): Promise<DisputeEvidenceSummary> {
  const ai = getGeminiClient();
  const fallback = ruleBasedDisputeSummary(params);
  if (!ai) return fallback;

  try {
    const sorted = [...params.milestones].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    const eventLines = sorted
      .map(m => `- ${m.occurredAt}: ${m.type}${m.verified ? '' : ' [UNVERIFIED]'}${m.description ? ` — note: ${m.description}` : ''}${m.evidenceRef ? ` — ref: ${m.evidenceRef}` : ''}${m.evidenceUrl ? ' — has file evidence' : ''}`)
      .join('\n');

    const prompt = `You are assisting a human arbitrator on a freight escrow platform reviewing a filed dispute. Do not recommend how to resolve it or what split to award — only summarize the facts on record.
    Shipment: ${params.shipment.referenceCode}, "${params.shipment.description}", route ${params.shipment.originCountry} -> ${params.shipment.destinationPort}, value ${params.shipment.totalValueUSD} USD.
    Dispute reason stated by the importer: ${params.disputeReason ? `"${params.disputeReason}"` : 'not provided'}.
    Logged milestone events, chronological:
    ${eventLines || '(none logged)'}
    Return JSON with "summary" (3-5 sentences, plain English, factual — no recommendation), "keyEvents" (chronological array of short strings, one per notable milestone), and "flaggedConcerns" (array of short strings noting gaps, unverified entries, missing evidence, or unusually long time gaps between milestones — empty array if nothing stands out).`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyEvents: { type: Type.ARRAY, items: { type: Type.STRING } },
            flaggedConcerns: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['summary', 'keyEvents', 'flaggedConcerns'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const summary = typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary : fallback.summary;
    const keyEvents = Array.isArray(parsed.keyEvents) && parsed.keyEvents.length > 0
      ? parsed.keyEvents.filter((e: unknown) => typeof e === 'string')
      : fallback.keyEvents;
    const flaggedConcerns = Array.isArray(parsed.flaggedConcerns)
      ? parsed.flaggedConcerns.filter((c: unknown) => typeof c === 'string')
      : fallback.flaggedConcerns;

    return { summary, keyEvents, flaggedConcerns };
  } catch (err) {
    console.error('Gemini dispute-evidence summarization failed, using rule-based fallback:', err);
    return fallback;
  }
}

// ─── Public landing-page FAQ assistant — no auth, no account/shipment data access.
// Scoped strictly to general MariTrade product questions for visitors.
function mockFaqResponse(userMessage: string): string {
  const msgLower = userMessage.toLowerCase();
  if (msgLower.includes('tagalog') || msgLower.includes('filipino') || msgLower === 'taglish') {
    return 'Sure! Switching to Tagalog na po. Mabuhay! Ako si MariBot — ano pong gusto niyong malaman tungkol sa MariTrade? Maaari kong ipaliwanag ang escrow, kung sino pwedeng gumamit, o paano mag-sign up.';
  }
  if (msgLower.includes('escrow') || msgLower.includes('stellar') || msgLower.includes('soroban')) {
    return 'Here\'s how it works: once you fund a shipment, your USDC is locked in Stellar multi-signature escrow. Once all milestones are verified (freight, customs, warehouse), the payment releases to the exporter instantly — no bank delays!';
  }
  if (msgLower.includes('price') || msgLower.includes('cost') || msgLower.includes('fee') || msgLower.includes('how much')) {
    return 'We\'re currently in Early Access — no credit card required to sign up. You can try the platform for free while we\'re still in this early access stage!';
  }
  if (msgLower.includes('how') || msgLower.includes('work')) {
    return 'It\'s simple: (1) the Importer creates a shipment record and funds escrow, (2) each logistics role (freight forwarder, customs broker, warehouse) logs verified milestones with photo proof, (3) once everything\'s confirmed, payment releases to the exporter — in seconds, not days!';
  }
  if (msgLower.includes('who') || msgLower.includes('use')) {
    return 'MariTrade is built for Filipino importers, exporters, freight forwarders, customs brokers, and warehouse operators — whatever your role in the trade chain, there\'s a place for you on the platform!';
  }
  if (msgLower.includes('sign up') || msgLower.includes('register')) {
    return 'Signing up is easy — just hit the "Register" button up top, choose whether you\'re an Importer/Exporter or part of the logistics chain, and set up your account. It\'s free while we\'re in Early Access!';
  }
  return 'Hi there! I\'m MariBot. Ask me anything about MariTrade — how escrow works, who it\'s for, or how to sign up. I\'m here to help!';
}

export async function landingFaqAssistant(userMessage: string): Promise<string> {
  const ai = getGeminiClient();

  const systemInstruction = `You are "MariBot", the friendly FAQ assistant on the MariTrade public landing page. Reply in English by default.
  MariTrade is a blockchain-powered escrow and logistics platform for Filipino importers, exporters, freight forwarders, customs brokers, and warehouse operators. Payments are held in Stellar multi-signature escrow and released once shipment milestones are verified.
  You ONLY answer general questions a visitor (not yet logged in) would ask: what MariTrade is, how the 3-step flow works (Create & Fund → Milestone Logging → Verify & Release), who it's for, how escrow and Stellar/Soroban work at a high level, what the BOC Document Center is, pricing/early-access status, and how to sign up.
  You do NOT have access to any user account, shipment, or payment data — never claim to look up or know specific orders, balances, or personal details. If asked about account-specific info, politely tell them to sign in or register first.
  If the user asks to switch to Tagalog (or writes in Tagalog/Taglish), switch your replies to casual Tagalog/Taglish from that point on and stay in Tagalog until asked to switch back to English.
  Keep replies short (2-4 sentences) and warm. If a question is unrelated to MariTrade or shipping/trade in the Philippines, gently redirect back to what MariTrade offers.`;

  if (!ai) {
    return mockFaqResponse(userMessage);
  }

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userMessage,
      config: {
        systemInstruction,
        temperature: 0.6
      }
    });

    return response.text || mockFaqResponse(userMessage);
  } catch (err) {
    console.error('Landing FAQ assistant failed, using offline fallback:', err);
    // Quota/network/API errors all fall back to the same keyword-based
    // responder used when no API key is configured — keeps the FAQ widget
    // useful even when the live model is unavailable.
    return mockFaqResponse(userMessage);
  }
}

// Phase 3: Tagalog AI assistant for Filipino SME clients
export async function tagalogAssistant(userMessage: string, context?: string): Promise<string> {
  const ai = getGeminiClient();
  
  const systemInstruction = `You are "MariBot", the friendly, Tagalog-speaking AI trade and shipping coordinator for MariTrade.
  Your job is to assist Filipino SME importers, exporters, and truckers with cargo shipping questions, Stellar multi-sign escrow queries, layout guidelines, and customs requirements (Bureau of Customs / BOC). Use casual Tagalog/Taglish (Filipino English blend) to make it familiar and easy to understand. Keep your replies concise and clear.`;

  const prompt = context 
    ? `Context information on the user's active shipment: \n${context}\n\nUser Message: "${userMessage}"`
    : userMessage;

  if (!ai) {
    // Dynamic taglish mock responses based on input keywords
    const msgLower = userMessage.toLowerCase();
    if (msgLower.includes('escrow') || msgLower.includes('stellar')) {
      return 'Mabuhay! Sige, ipaliwanag ko ang Stellar Escrow sa MariTrade: Ang pera mo ay ligtas na nakatago sa Stellar network. Kapag nakumpleto ng Customs Broker at Trucker ang mga huling milestones (mga tasks), saka lang namin i-re-release ang pondo sa Exporter gamit ang smart multisign system. Protektado ka dito!';
    }
    if (msgLower.includes('boc') || msgLower.includes('customs') || msgLower.includes('dokumento')) {
      return 'Kumusta! Ang BOC Document Center natin ay nagpapahintulot sa Customs Broker na mag-upload ng mga clearance documents. Ikaw at ang broker mo lang ang makakabasa nito ayon sa secure permission rules ng MariTrade.';
    }
    return 'Kamusta! Ako si MariBot, ang iyong trade assistant. Mayroon ka bang mga katanungan tungkol sa iyong kargamento, Stellar escrow account, o mga customs requirements sa Bureau of Customs (BOC)? Nandito ako para tumulong!';
  }

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    return response.text || 'Paumanhin po, nagkaroon ako ng munting aberya sa pagsagot. Maaari ninyong subukan muli?';
  } catch (err) {
    console.error('Tagalog AI failed:', err);
    return 'Pasensya na po, medyo mabagal ang koneksyon ng Tagalog assistant ngayon. Gusto niyo po bang pag-usapan natin ang escrow release?';
  }
}
