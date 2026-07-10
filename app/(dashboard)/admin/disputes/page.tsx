'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
import {
  Scale,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  AlertCircle,
  Wallet,
  Ship,
  Bot,
  ListChecks,
  Flag,
} from 'lucide-react';
import { Shipment } from '@/types';

const STELLAR_NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

interface EnrichedDispute extends Shipment {
  importerUser: { fullName: string; email: string; stellarWallet?: string } | null;
  exporterUser: { fullName: string; email: string; stellarWallet?: string } | null;
}

interface ResolveState {
  shipmentId: string;
  importerPct: number;   // 0–100
  exporterPct: number;   // 0–100
  working: boolean;
  error: string;
  done: boolean;
  txHash: string;
  split: { importerAmount: number; exporterAmount: number; platformFee: number } | null;
}

const RESOLVE_INITIAL = (shipmentId: string): ResolveState => ({
  shipmentId,
  importerPct: 50,
  exporterPct: 50,
  working: false,
  error: '',
  done: false,
  txHash: '',
  split: null,
});

export default function AdminDisputesPage() {
  const { currentUser, loading: sessionLoading } = useUserSession();

  const [disputes, setDisputes] = useState<EnrichedDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // One resolve state per open panel (keyed by shipmentId)
  const [resolveStates, setResolveStates] = useState<Record<string, ResolveState>>({});

  // ── Phase 2 · AI Dispute-Evidence Summarizer — one per shipmentId ─────
  interface DisputeSummaryState {
    loading: boolean;
    error: string;
    summary: string;
    keyEvents: string[];
    flaggedConcerns: string[];
  }
  const [disputeSummaries, setDisputeSummaries] = useState<Record<string, DisputeSummaryState>>({});

  const handleSummarizeEvidence = async (shipmentId: string) => {
    setDisputeSummaries(prev => ({
      ...prev,
      [shipmentId]: { loading: true, error: '', summary: '', keyEvents: [], flaggedConcerns: [] },
    }));
    try {
      const res = await authFetch('/api/gemini/dispute-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentId }),
      });
      const json = await res.json();
      if (json.success) {
        setDisputeSummaries(prev => ({
          ...prev,
          [shipmentId]: {
            loading: false,
            error: '',
            summary: json.data.summary,
            keyEvents: json.data.keyEvents ?? [],
            flaggedConcerns: json.data.flaggedConcerns ?? [],
          },
        }));
      } else {
        setDisputeSummaries(prev => ({
          ...prev,
          [shipmentId]: { loading: false, error: json.error || 'Summarization failed.', summary: '', keyEvents: [], flaggedConcerns: [] },
        }));
      }
    } catch (err: any) {
      setDisputeSummaries(prev => ({
        ...prev,
        [shipmentId]: { loading: false, error: err?.message ?? 'Network error.', summary: '', keyEvents: [], flaggedConcerns: [] },
      }));
    }
  };

  // Disputes that were just resolved in this session, kept pinned in the UI
  // (with their full "Dispute Resolved" split breakdown) even after a
  // background refetch removes them from the server's DISPUTED list —
  // otherwise the confirmation card vanishes out from under the admin
  // before they can read the split / copy the tx hash. Cleared only when
  // the admin explicitly dismisses that card.
  const [resolvedDisputes, setResolvedDisputes] = useState<Record<string, EnrichedDispute>>({});

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await authFetch('/api/admin/disputes');
      const json = await res.json();
      if (json.success) {
        setDisputes(json.data.disputes);
      } else {
        setFetchError(json.error || 'Failed to load disputes.');
      }
    } catch {
      setFetchError('Network error — could not reach the disputes API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) fetchDisputes();
  }, [sessionLoading, fetchDisputes]);

  const openResolvePanel = (shipmentId: string) => {
    setResolveStates(prev => ({
      ...prev,
      [shipmentId]: RESOLVE_INITIAL(shipmentId),
    }));
  };

  const closeResolvePanel = (shipmentId: string) => {
    setResolveStates(prev => {
      const next = { ...prev };
      delete next[shipmentId];
      return next;
    });
    // Dismissing the resolved card is also what finally lets it drop out of
    // view — see the comment on resolvedDisputes above.
    setResolvedDisputes(prev => {
      if (!(shipmentId in prev)) return prev;
      const next = { ...prev };
      delete next[shipmentId];
      return next;
    });
  };

  const updatePct = (shipmentId: string, field: 'importerPct' | 'exporterPct', raw: number) => {
    const val = Math.max(0, Math.min(100, Math.round(raw)));
    setResolveStates(prev => {
      const s = prev[shipmentId];
      if (!s) return prev;
      // Auto-clamp the other side so they don't exceed 100
      const other = field === 'importerPct' ? 'exporterPct' : 'importerPct';
      const otherVal = Math.max(0, Math.min(100 - val, s[other]));
      return {
        ...prev,
        [shipmentId]: { ...s, [field]: val, [other]: otherVal },
      };
    });
  };

  const handleResolve = async (dispute: EnrichedDispute) => {
    const s = resolveStates[dispute.id];
    if (!s) return;

    const importerBps = Math.round(s.importerPct * 100);
    const exporterBps = Math.round(s.exporterPct * 100);

    if (importerBps + exporterBps > 10000) {
      setResolveStates(prev => ({
        ...prev,
        [dispute.id]: { ...s, error: 'Total allocation cannot exceed 100%.' },
      }));
      return;
    }

    setResolveStates(prev => ({ ...prev, [dispute.id]: { ...s, working: true, error: '' } }));

    try {
      const res = await authFetch(`/api/shipments/${dispute.id}/escrow-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_dispute', importerBps, exporterBps }),
      });
      const json = await res.json();

      if (json.success) {
        setResolveStates(prev => ({
          ...prev,
          [dispute.id]: {
            ...s,
            working: false,
            done: true,
            txHash: json.data.onChainHash ?? '',
            split: json.data.split,
          },
        }));
        // Pin this dispute locally so its resolved card stays visible and
        // readable — the imminent refetch below will otherwise drop it from
        // `disputes` the instant the server no longer reports it as DISPUTED.
        setResolvedDisputes(prev => ({ ...prev, [dispute.id]: dispute }));
        // Still refresh in the background so other admins' concurrent
        // resolutions and new incoming disputes stay up to date.
        setTimeout(fetchDisputes, 1500);
      } else {
        setResolveStates(prev => ({
          ...prev,
          [dispute.id]: { ...s, working: false, error: json.error || 'Resolution failed.' },
        }));
      }
    } catch (err: any) {
      setResolveStates(prev => ({
        ...prev,
        [dispute.id]: { ...s, working: false, error: err?.message ?? 'Network error.' },
      }));
    }
  };

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (sessionLoading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-maritime-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <Link href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-medium">
            <ChevronLeft className="w-4 h-4" />Back to Dashboard
          </Link>
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight font-mono flex items-center gap-3">
            <Scale className="w-7 h-7 text-orange-400" />
            Dispute Resolution Panel
          </h1>
          <p className="text-xs text-gray-400">Platform admin tool — arbitrate locked escrow funds between parties.</p>
        </div>
        <button onClick={fetchDisputes} disabled={loading}
          className="flex items-center gap-1.5 border border-sand-200 bg-white hover:bg-sand-50 text-maritime-900 font-bold text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {fetchError && (
        <div className="bg-coral-50 border border-coral-200 text-coral-700 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {fetchError}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="text-center py-24 bg-white rounded-3xl border border-sand-200">
          <div className="w-8 h-8 border-4 border-orange-300 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs text-gray-400 font-mono">LOADING DISPUTE QUEUE…</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetchError && disputes.length === 0 && (
        <div className="bg-white border border-sand-200 rounded-2xl p-12 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-ocean-400 mx-auto" />
          <h2 className="text-base font-extrabold text-maritime-900">No Active Disputes</h2>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            All escrows are settled or in transit. Disputed shipments will appear here for resolution.
          </p>
        </div>
      )}

      {/* Dispute cards */}
      {!loading && (disputes.length > 0 || Object.keys(resolvedDisputes).length > 0) && (
        <div className="space-y-6">
          {[
            ...disputes,
            // Append any locally-pinned resolved disputes that the latest fetch
            // no longer returns, so their confirmation card stays on screen
            // until explicitly dismissed (see resolvedDisputes above).
            ...Object.values(resolvedDisputes).filter(rd => !disputes.some(d => d.id === rd.id)),
          ].map((dispute) => {
            const rs = resolveStates[dispute.id];
            const platformFee = rs ? Math.round((100 - rs.importerPct - rs.exporterPct) * 100) / 100 : 0;
            const importerAmt = rs ? Math.floor((dispute.totalValueUSD * rs.importerPct) / 100) : 0;
            const exporterAmt = rs ? Math.floor((dispute.totalValueUSD * rs.exporterPct) / 100) : 0;
            const platformAmt = rs ? dispute.totalValueUSD - importerAmt - exporterAmt : 0;
            const hasRealEscrowId = !!dispute.stellarEscrowId && /^[0-9a-fA-F]{64}$/.test(dispute.stellarEscrowId);

            return (
              <div key={dispute.id}
                className="bg-white border border-orange-200 rounded-2xl shadow-sm overflow-hidden">

                {/* Card header */}
                <div className="bg-orange-50 border-b border-orange-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-extrabold text-sm text-maritime-900 font-mono">{dispute.referenceCode}</h2>
                        <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">DISPUTED</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{dispute.description}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {dispute.originCountry} → {dispute.destinationPort} · {dispute.shipmentScope}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasRealEscrowId && (
                      <a href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${dispute.stellarEscrowId}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] text-blue-600 font-mono bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-all">
                        <ExternalLink className="w-3 h-3" /> Stellar
                      </a>
                    )}
                    <Link href={`/shipments/${dispute.id}`}
                      className="flex items-center gap-1 text-[10px] text-maritime-700 font-bold bg-white hover:bg-maritime-50 border border-maritime-200 px-2.5 py-1 rounded-lg transition-all">
                      <Ship className="w-3 h-3" /> View Shipment
                    </Link>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-5 space-y-5">

                  {/* Parties + value row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Importer */}
                    <div className="bg-sand-50 border border-sand-200 rounded-xl p-3 space-y-1">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Importer</p>
                      <p className="text-xs font-bold text-maritime-900 truncate">{dispute.importerUser?.fullName ?? dispute.importerId}</p>
                      <p className="text-[10px] text-gray-500 truncate">{dispute.importerUser?.email ?? '—'}</p>
                      {dispute.importerUser?.stellarWallet && (
                        <p className="text-[9px] font-mono text-gray-400 truncate flex items-center gap-1">
                          <Wallet className="w-2.5 h-2.5" />
                          {dispute.importerUser.stellarWallet.substring(0, 8)}…{dispute.importerUser.stellarWallet.slice(-6)}
                        </p>
                      )}
                    </div>

                    {/* Escrow value */}
                    <div className="bg-sand-50 border border-sand-200 rounded-xl p-3 text-center space-y-1">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Locked Escrow</p>
                      <p className="text-xl font-black text-maritime-900 font-mono">${dispute.totalValueUSD.toLocaleString()}</p>
                      <p className="text-[9px] text-ocean-600 font-mono">USDC · Stellar Soroban</p>
                    </div>

                    {/* Exporter */}
                    <div className="bg-sand-50 border border-sand-200 rounded-xl p-3 space-y-1">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">Exporter</p>
                      <p className="text-xs font-bold text-maritime-900 truncate">{dispute.exporterUser?.fullName ?? (dispute.exporterId ?? 'Unassigned')}</p>
                      <p className="text-[10px] text-gray-500 truncate">{dispute.exporterUser?.email ?? '—'}</p>
                      {dispute.exporterUser?.stellarWallet && (
                        <p className="text-[9px] font-mono text-gray-400 truncate flex items-center gap-1">
                          <Wallet className="w-2.5 h-2.5" />
                          {dispute.exporterUser.stellarWallet.substring(0, 8)}…{dispute.exporterUser.stellarWallet.slice(-6)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Phase 2 · AI Dispute-Evidence Summarizer */}
                  {(() => {
                    const ds = disputeSummaries[dispute.id];
                    return (
                      <div className="border-t border-sand-100 pt-4 space-y-3">
                        {!ds || (!ds.loading && !ds.summary && !ds.error) ? (
                          <button
                            onClick={() => handleSummarizeEvidence(dispute.id)}
                            className="flex items-center gap-1.5 border border-maritime-200 bg-white hover:bg-maritime-50 text-maritime-900 font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            AI Summarize Evidence
                          </button>
                        ) : ds.loading ? (
                          <p className="text-xs text-gray-400 italic flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Reading milestone log and dispute reason…
                          </p>
                        ) : ds.error ? (
                          <div className="bg-coral-50 border border-coral-200 text-coral-700 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            {ds.error}
                            <button onClick={() => handleSummarizeEvidence(dispute.id)} className="ml-auto underline font-bold">Retry</button>
                          </div>
                        ) : (
                          <div className="bg-maritime-50 border border-maritime-100 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-1.5">
                              <Bot className="w-4 h-4 text-maritime-700" />
                              <p className="text-xs font-extrabold text-maritime-900">AI Evidence Summary</p>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">{ds.summary}</p>
                            {ds.keyEvents.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                                  <ListChecks className="w-3 h-3" /> Key Events
                                </p>
                                <ul className="text-[11px] text-gray-600 space-y-0.5 pl-4 list-disc">
                                  {ds.keyEvents.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                              </div>
                            )}
                            {ds.flaggedConcerns.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide flex items-center gap-1">
                                  <Flag className="w-3 h-3" /> Flagged Concerns
                                </p>
                                <ul className="text-[11px] text-orange-700 space-y-0.5 pl-4 list-disc">
                                  {ds.flaggedConcerns.map((c, i) => <li key={i}>{c}</li>)}
                                </ul>
                              </div>
                            )}
                            <p className="text-[9px] text-gray-400">AI-generated from the milestone log — not a recommendation on how to rule.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Resolve panel or CTA */}
                  {!rs ? (
                    <div className="flex justify-end pt-1 border-t border-sand-100">
                      <button
                        onClick={() => openResolvePanel(dispute.id)}
                        className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs px-4 py-2 rounded-lg transition-all shadow-sm"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        Open Resolution Panel
                      </button>
                    </div>
                  ) : rs.done ? (
                    /* ── Done state ───────────────────────────────────────── */
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <p className="font-extrabold text-sm text-green-800">Dispute Resolved</p>
                      </div>
                      {rs.split && (
                        <div className="grid grid-cols-3 gap-3 text-center text-[11px]">
                          <div className="bg-green-100 rounded-lg p-2 space-y-0.5">
                            <p className="text-green-600 font-bold">Importer Refund</p>
                            <p className="font-black text-green-800">${rs.split.importerAmount.toLocaleString()}</p>
                          </div>
                          <div className="bg-green-100 rounded-lg p-2 space-y-0.5">
                            <p className="text-green-600 font-bold">Exporter Payment</p>
                            <p className="font-black text-green-800">${rs.split.exporterAmount.toLocaleString()}</p>
                          </div>
                          <div className="bg-gray-100 rounded-lg p-2 space-y-0.5">
                            <p className="text-gray-500 font-bold">Platform Fee</p>
                            <p className="font-black text-gray-700">${rs.split.platformFee.toLocaleString()}</p>
                          </div>
                        </div>
                      )}
                      {rs.txHash && rs.txHash.length === 64 && (
                        <a href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${rs.txHash}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-[10px] text-green-600 font-mono hover:underline">
                          <ExternalLink className="w-3 h-3" />
                          {rs.txHash.substring(0, 16)}…{rs.txHash.slice(-8)}
                        </a>
                      )}
                      <button onClick={() => closeResolvePanel(dispute.id)}
                        className="text-[10px] text-gray-400 hover:text-gray-700 underline">
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    /* ── Active resolution panel ──────────────────────────── */
                    <div className="border border-orange-100 rounded-xl p-5 space-y-5 bg-orange-50/40">
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2">
                          <Scale className="w-4 h-4 text-orange-400" />
                          Allocate Escrow Funds
                        </h3>
                        <button onClick={() => closeResolvePanel(dispute.id)}
                          className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
                      </div>

                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Set how the ${dispute.totalValueUSD.toLocaleString()} USDC should be split.
                        Any remainder after importer + exporter allocations is retained as the platform arbitration fee.
                      </p>

                      {/* Slider row */}
                      <div className="space-y-4">
                        {/* Importer */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-bold text-gray-700">
                              Importer — {dispute.importerUser?.fullName ?? 'Importer'}
                            </span>
                            <span className="font-mono font-black text-maritime-900">{rs.importerPct}% · ${importerAmt.toLocaleString()}</span>
                          </div>
                          <input
                            type="range" min={0} max={100} step={1}
                            value={rs.importerPct}
                            onChange={e => updatePct(dispute.id, 'importerPct', Number(e.target.value))}
                            className="w-full accent-maritime-400 h-1.5 rounded cursor-pointer"
                          />
                        </div>

                        {/* Exporter */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-bold text-gray-700">
                              Exporter — {dispute.exporterUser?.fullName ?? 'Exporter'}
                            </span>
                            <span className="font-mono font-black text-maritime-900">{rs.exporterPct}% · ${exporterAmt.toLocaleString()}</span>
                          </div>
                          <input
                            type="range" min={0} max={100} step={1}
                            value={rs.exporterPct}
                            onChange={e => updatePct(dispute.id, 'exporterPct', Number(e.target.value))}
                            className="w-full accent-ocean-400 h-1.5 rounded cursor-pointer"
                          />
                        </div>

                        {/* Platform fee summary */}
                        <div className="bg-white border border-sand-200 rounded-lg p-3 flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 font-medium">Platform Arbitration Fee</span>
                          <span className="font-black font-mono text-maritime-900">
                            {Math.max(0, 100 - rs.importerPct - rs.exporterPct).toFixed(1)}% · ${Math.max(0, platformAmt).toLocaleString()}
                          </span>
                        </div>

                        {rs.importerPct + rs.exporterPct > 100 && (
                          <div className="bg-coral-50 border border-coral-200 text-coral-700 text-[11px] px-3 py-2 rounded-lg flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            Importer + Exporter allocations cannot exceed 100%.
                          </div>
                        )}
                      </div>

                      {/* Error */}
                      {rs.error && (
                        <div className="bg-coral-50 border border-coral-200 text-coral-700 text-xs p-3 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{rs.error}</span>
                        </div>
                      )}

                      {/* Submit */}
                      <div className="flex gap-2 justify-end pt-1 border-t border-sand-100">
                        <button onClick={() => closeResolvePanel(dispute.id)}
                          className="px-3 py-1.5 border border-sand-200 rounded-lg text-gray-500 font-bold text-xs">
                          Cancel
                        </button>
                        <button
                          onClick={() => handleResolve(dispute)}
                          disabled={rs.working || rs.importerPct + rs.exporterPct > 100}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-black text-xs transition-all"
                        >
                          {rs.working
                            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Resolving…</>
                            : <><Scale className="w-3.5 h-3.5" /> Confirm Resolution</>
                          }
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
