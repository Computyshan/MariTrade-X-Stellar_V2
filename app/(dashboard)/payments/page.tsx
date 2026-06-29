'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
import {
  CreditCard,
  Coins,
  Lock,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { Shipment } from '@/types';
import { getMariTradeEscrowClient } from '@/lib/stellar/escrow-contract';
import { formatAsset, SUPPORTED_ASSETS } from '@/lib/stellar/assets';
import { useFreighter } from '@/hooks/use-freighter';
import PphpWalletPanel from '@/components/PphpWalletPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnChainRecord {
  status: string;          // EscrowStatus enum label from the contract
  amountUsdc: number;      // strobes → USDC already converted
  confirmedCount: number;  // how many milestones confirmed on-chain
  requiredCount: number;   // total required milestones
  canRelease: boolean;
}

type ChainMap = Record<string, OnChainRecord | 'loading' | 'error' | null>;

const STELLAR_NETWORK =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

// Source address used for read-only RPC simulation (no signing, no fees).
const PLATFORM_ADDRESS =
  process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';

// Map the contract's EscrowStatus integer to a readable label
const CONTRACT_STATUS_LABEL: Record<number, string> = {
  0: 'UNFUNDED',
  1: 'FUNDED',
  2: 'RELEASED',
  3: 'CANCELLED',
  4: 'DISPUTED',
  5: 'RESOLVED',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function EscrowLedger() {
  const { currentUser } = useUserSession();
  const freighter = useFreighter();
  const [shipments,   setShipments]   = useState<Shipment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [chainMap,    setChainMap]    = useState<ChainMap>({});
  const [chainLoading, setChainLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ── Fetch shipments from DB ────────────────────────────────────────────────
  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await authFetch('/api/shipments');
      const json = await res.json();
      if (json.success && json.data) setShipments(json.data);
    } catch {
      console.warn('Escrow ledger load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  // ── Query on-chain status for all funded/on-chain shipments ───────────────
  const refreshChainData = useCallback(async (list: Shipment[]) => {
    if (!PLATFORM_ADDRESS) return; // can't do read-only queries without a source address

    const onChainShipments = list.filter(
      s => s.referenceCode && s.stellarEscrowId,
    );
    if (onChainShipments.length === 0) return;

    setChainLoading(true);

    // Mark all as loading first so the UI shows spinners immediately
    setChainMap(prev => {
      const next = { ...prev };
      onChainShipments.forEach(s => { next[s.referenceCode] = 'loading'; });
      return next;
    });

    // Query each shipment in parallel
    const client = getMariTradeEscrowClient(STELLAR_NETWORK, PLATFORM_ADDRESS);

    await Promise.allSettled(
      onChainShipments.map(async s => {
        try {
          // Correct binding: snake_case method name, object param, unwrap Result
          const tx = await client.get_escrow({ reference_code: s.referenceCode });
          const record = tx.result?.isOk() ? tx.result.unwrap() : null;

          // get_escrow returns an Err result when the contract has no record yet
          if (!record) {
            setChainMap(prev => ({ ...prev, [s.referenceCode]: 'error' }));
            return;
          }

          // EscrowRecord fields are snake_case from the generated bindings:
          // { status, amount (strobes), required_milestones, confirmed_milestones, ... }
          const statusLabel =
            CONTRACT_STATUS_LABEL[record.status as number] ??
            String(record.status);

          const confirmed = Array.isArray(record.confirmed_milestones)
            ? record.confirmed_milestones.length
            : 0;
          const required  = Array.isArray(record.required_milestones)
            ? record.required_milestones.length
            : 0;

          setChainMap(prev => ({
            ...prev,
            [s.referenceCode]: {
              status:         statusLabel,
              amountUsdc:     Number(record.amount ?? 0) / 1e7, // strobes → USDC
              confirmedCount: confirmed,
              requiredCount:  required,
              canRelease:     confirmed >= required && required > 0,
            },
          }));
        } catch {
          setChainMap(prev => ({ ...prev, [s.referenceCode]: 'error' }));
        }
      }),
    );

    setLastRefresh(new Date());
    setChainLoading(false);
  }, []);

  // Auto-refresh chain data once shipments load
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (shipments.length > 0) refreshChainData(shipments);
  }, [shipments, refreshChainData]);

  // ── Totals — prefer on-chain data where available ─────────────────────────
  const totalLocked = shipments
    .filter(s => {
      const chain = chainMap[s.referenceCode];
      if (chain && chain !== 'loading' && chain !== 'error') {
        return (chain as OnChainRecord).status === 'FUNDED';
      }
      return s.escrowStatus === 'FUNDED';
    })
    .reduce((acc, s) => {
      const chain = chainMap[s.referenceCode];
      if (chain && chain !== 'loading' && chain !== 'error') {
        return acc + (chain as OnChainRecord).amountUsdc;
      }
      return acc + (s.totalValueUSD ?? 0);
    }, 0);

  const totalReleased = shipments
    .filter(s => {
      const chain = chainMap[s.referenceCode];
      if (chain && chain !== 'loading' && chain !== 'error') {
        return (chain as OnChainRecord).status === 'RELEASED';
      }
      return s.escrowStatus === 'RELEASED';
    })
    .reduce((acc, s) => acc + (s.totalValueUSD ?? 0), 0);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getDisplayStatus = (s: Shipment): string => {
    const chain = chainMap[s.referenceCode];
    if (!chain || chain === 'loading') return s.escrowStatus ?? '—';
    if (chain === 'error') return s.escrowStatus ?? '—';
    return (chain as OnChainRecord).status;
  };

  const isChainLoading = (s: Shipment) =>
    s.stellarEscrowId && chainMap[s.referenceCode] === 'loading';

  const chainRecord = (s: Shipment): OnChainRecord | null => {
    const c = chainMap[s.referenceCode];
    if (!c || c === 'loading' || c === 'error') return null;
    return c as OnChainRecord;
  };

  const statusPill = (status: string) => {
    const base = 'px-2 py-0.5 rounded text-[9px] font-bold uppercase';
    if (status === 'RELEASED')   return `${base} bg-teal-light text-teal`;
    if (status === 'FUNDED')     return `${base} bg-steel-light text-steel`;
    if (status === 'CANCELLED')  return `${base} bg-wine-light text-wine`;
    if (status === 'DISPUTED')   return `${base} bg-amber-light text-amber`;
    if (status === 'RESOLVED')   return `${base} bg-mist text-ink-faint`;
    return `${base} bg-mist text-ink-faint`;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-medium text-ink tracking-tight">Escrow Ledger</h1>
          <p className="text-sm text-ink-faint mt-1">
            Live on-chain escrow status pulled from the Stellar {STELLAR_NETWORK} via Soroban RPC.
          </p>
        </div>

        {/* Manual refresh button */}
        <button
          onClick={() => refreshChainData(shipments)}
          disabled={chainLoading || loading}
          className="flex items-center gap-1.5 border border-mist bg-mist-light hover:bg-mist text-ink font-bold text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${chainLoading ? 'animate-spin' : ''}`} />
          {chainLoading ? 'Querying Stellar…' : 'Refresh from Chain'}
        </button>
      </div>

      {/* Last refresh timestamp */}
      {lastRefresh && (
        <p className="text-[10px] text-ink-faint flex items-center gap-1 -mt-1">
          <Zap className="w-3 h-3" style={{ color: 'var(--theme-accent)' }} />
          Last on-chain sync: {lastRefresh.toLocaleTimeString()}
        </p>
      )}

      {/* No platform address warning */}
      {!PLATFORM_ADDRESS && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs p-3 rounded-xl">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS</strong> is not set in{' '}
            <code>.env.local</code>. Live chain queries are disabled — showing DB status only.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

        <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-2">
          <Coins className="w-8 h-8 block mb-1" style={{ color: 'var(--theme-accent)' }} />
          <span className="text-[10px] text-ink-faint tracking-wider font-bold uppercase block">
            Active Contracts Locked
          </span>
          <strong className="text-3xl text-ink font-display font-medium block">
            {formatAsset(totalLocked, 'USDC')}
          </strong>
          <span className="text-[9px] text-teal block italic">
            {formatAsset(totalLocked / SUPPORTED_ASSETS.PPHP.rateToUsd, 'PPHP')} PHP indicative
          </span>
          {chainLoading && (
            <span className="text-[9px] text-ink-faint flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Updating from chain…
            </span>
          )}
        </div>

        <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-2">
          <CheckCircle2 className="w-8 h-8 text-teal block mb-1" />
          <span className="text-[10px] text-ink-faint tracking-wider font-bold uppercase block">
            Cumulative Settled Payouts
          </span>
          <strong className="text-3xl text-ink font-display font-medium block">
            {formatAsset(totalReleased, 'USDC')}
          </strong>
          <span className="text-[9px] text-teal block italic">
            {formatAsset(totalReleased / SUPPORTED_ASSETS.PPHP.rateToUsd, 'PPHP')} PHP indicative
          </span>
        </div>

        <div className="bg-ink text-white p-6 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-ink-soft opacity-50" />
          <div className="relative space-y-3">
            <Lock className="w-7 h-7 text-teal block" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal">
              Security Architecture
            </h4>
            <p className="text-[11px] text-white/70 leading-normal">
              MariTrade custody uses Soroban smart contracts on the Stellar network.
              Funds never disperse without multi-party milestone confirmations verified on-chain.
            </p>
          </div>
        </div>
      </div>

      {/* PPHP wallet onboarding — trustline, fund wallet, balances */}
      <PphpWalletPanel publicKey={freighter.publicKey} onConnect={freighter.connect} />

      {/* Escrow table */}
      <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-ink">
            Escrow Audit — All Shipments
          </h3>
          {PLATFORM_ADDRESS && (
            <span className="text-[9px] bg-teal-light text-teal border border-teal/20 px-2 py-1 rounded font-bold flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Live Stellar data
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-6">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--theme-accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-8 text-ink-faint text-xs">
            NO SHIPMENT RECORDS LODGED FOR PAYOUT AUDITING.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-mist-light text-ink-faint font-bold uppercase text-[10px] border-b border-mist">
                <tr>
                  <th className="px-4 py-3">Shipment Ref</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Milestones</th>
                  <th className="px-4 py-3 text-right">Stellar Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {shipments.map(s => {
                  const chain   = chainRecord(s);
                  const status  = getDisplayStatus(s);
                  const loading = isChainLoading(s);

                  return (
                    <tr key={s.id} className="hover:bg-mist-light/50 transition-colors">

                      {/* Reference */}
                      <td className="px-4 py-3.5 font-bold text-ink">
                        {s.referenceCode}
                      </td>

                      {/* Scope */}
                      <td className="px-4 py-3.5 text-ink-faint uppercase font-bold text-[10px]">
                        {s.shipmentScope?.replace(/_/g, ' ')}
                      </td>

                      {/* Asset badge */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                          (s.escrowAsset ?? 'USDC') === 'PPHP'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {(s.escrowAsset ?? 'USDC') === 'PPHP' ? '₱ PPHP' : '$ USDC'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 font-bold text-ink">
                        {chain
                          ? formatAsset(chain.amountUsdc, 'USDC')
                          : (s.totalValueUSD != null ? formatAsset(s.totalValueUSD, 'USDC') : '—')}
                      </td>

                      {/* Status pill — live chain or DB fallback */}
                      <td className="px-4 py-3.5">
                        {loading ? (
                        <span className="flex items-center gap-1 text-[9px] text-ink-faint">
                        <RefreshCw className="w-3 h-3 animate-spin" /> querying…
                        </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className={statusPill(status)}>{status}</span>
                            {!s.stellarEscrowId && (
                              <span className="text-[8px] text-ink-faint">DB only</span>
                            )}
                            {s.stellarEscrowId && !loading && chain && (
                              <span className="text-[8px] text-teal flex items-center gap-0.5">
                                <Zap className="w-2 h-2" /> on-chain
                              </span>
                            )}
                            {chainMap[s.referenceCode] === 'error' && (
                              <span className="text-[8px] text-amber">
                                ⚠ chain read failed
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Milestone progress */}
                      <td className="px-4 py-3.5">
                        {loading ? (
                          <span className="text-[10px] text-ink-faint">…</span>
                        ) : chain ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 bg-mist rounded-full h-1.5 max-w-[80px]">
                                <div
                                  className="h-1.5 rounded-full transition-all"
                                  style={{
                                    background: 'var(--theme-accent)',
                                    width: chain.requiredCount > 0
                                      ? `${Math.min(100, (chain.confirmedCount / chain.requiredCount) * 100)}%`
                                      : '0%',
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-ink-faint">
                                {chain.confirmedCount}/{chain.requiredCount}
                              </span>
                            </div>
                            {chain.canRelease && (
                              <span className="text-[8px] text-teal font-bold flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Eligible for release
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-ink-faint">—</span>
                        )}
                      </td>

                      {/* Stellar tx hash */}
                      <td className="px-4 py-3.5 text-right font-mono text-[10px]">
                        {s.stellarEscrowId ? (
                          <a
                            href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${s.stellarEscrowId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-end gap-1 font-semibold text-steel hover:text-ink transition-colors"
                          >
                            <span>{s.stellarEscrowId.substring(0, 8)}…</span>
                            <ExternalLink className="w-3 h-3 text-steel" />
                          </a>
                        ) : (
                          <span className="text-ink-faint">Not yet funded</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
