'use client';

import React from 'react';
import { Bot, TrendingUp, Coins, RefreshCw } from 'lucide-react';

// ── Phase 2 · AI Delay-Risk Prediction — Logistics Chain only ──────────────
export interface DelayRisk {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasoning: string;
  recommendedActions: string[];
  historicalStats: { sampleSize: number; holdRate: number | null; disputeRate: number | null; avgClearanceHours: number | null };
}

export function DelayRiskPanel({ loading, data }: { loading: boolean; data: DelayRisk | null }) {
  if (!loading && !data) return null;
  return (
    <div className={`border rounded-xl p-4 flex items-start gap-3 ${
      data?.riskLevel === 'HIGH' ? 'bg-wine-light border-wine/20' :
      data?.riskLevel === 'MEDIUM' ? 'bg-amber-light border-amber/30' :
      'bg-teal-light border-steel-light'
    }`}>
      <Bot className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
        data?.riskLevel === 'HIGH' ? 'text-wine' : data?.riskLevel === 'MEDIUM' ? 'text-amber' : 'text-steel'
      }`} />
      <div className="space-y-1.5 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-ink-soft flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> AI Delay-Risk Prediction
          </p>
          {data && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide ${
              data.riskLevel === 'HIGH' ? 'bg-wine text-white' : data.riskLevel === 'MEDIUM' ? 'bg-amber text-white' : 'bg-teal text-ink'
            }`}>{data.riskLevel} RISK</span>
          )}
        </div>
        {loading ? (
          <p className="text-xs text-ink-faint italic flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Checking route history and customs risk…</p>
        ) : data ? (
          <>
            <p className="text-xs text-ink-faint leading-relaxed">{data.reasoning}</p>
            {data.recommendedActions.length > 0 && (
              <ul className="text-[11px] text-ink-faint space-y-0.5 pl-4 list-disc">
                {data.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
            <p className="text-[9px] text-ink-faint/70">
              Based on {data.historicalStats.sampleSize} prior MariTrade shipment{data.historicalStats.sampleSize === 1 ? '' : 's'} on this exact route.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Phase 2 · AI Rate Benchmarking — Freight Forwarders only ───────────────
export interface RateBenchmark {
  suggestedFloorUSD: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  stats: { sampleSize: number; avgFreightCostUSD: number | null; minFreightCostUSD: number | null; maxFreightCostUSD: number | null };
}

export function RateBenchmarkPanel({ loading, data }: { loading: boolean; data: RateBenchmark | null }) {
  if (!loading && !data) return null;
  return (
    <div className="border rounded-xl p-4 flex items-start gap-3 bg-steel-light border-steel-light">
      <Bot className="w-5 h-5 flex-shrink-0 mt-0.5 text-steel" />
      <div className="space-y-1.5 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-ink-soft flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" /> AI Rate Benchmark
          </p>
          {data && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide bg-steel text-white">
              {data.confidence} CONFIDENCE
            </span>
          )}
        </div>
        {loading ? (
          <p className="text-xs text-ink-faint italic flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Checking route freight history and market rates…</p>
        ) : data ? (
          <>
            {data.suggestedFloorUSD != null && (
              <p className="text-lg font-black text-ink font-sans">
                ${data.suggestedFloorUSD.toLocaleString()} <span className="text-xs font-bold text-ink-faint">suggested negotiating floor</span>
              </p>
            )}
            <p className="text-xs text-ink-faint leading-relaxed">{data.reasoning}</p>
            <p className="text-[9px] text-ink-faint/70">
              Based on {data.stats.sampleSize} prior MariTrade shipment{data.stats.sampleSize === 1 ? '' : 's'} with a recorded freight cost on this exact route.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
