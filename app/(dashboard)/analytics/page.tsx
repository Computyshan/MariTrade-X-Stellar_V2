'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
import {
  BarChart3,
  TrendingUp,
  Ship,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  Package,
  Globe,
  Activity,
  Zap,
} from 'lucide-react';
import { formatAsset } from '@/lib/stellar/assets';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthlyStat {
  month: string;
  created: number;
  delivered: number;
  valueUSD: number;
}

interface RouteEntry {
  route: string;
  count: number;
  valueUSD: number;
}

interface MilestoneDayEntry {
  day: string;
  count: number;
}

interface AnalyticsData {
  summary: {
    total: number;
    active: number;
    delivered: number;
    disputed: number;
    cancelled: number;
    totalValueUSD: number;
    escrowLockedUSD: number;
    escrowReleasedUSD: number;
  };
  statusCounts: Record<string, number>;
  escrowCounts: Record<string, number>;
  scopeCounts: { nationwide: number; overseas: number };
  monthly: MonthlyStat[];
  topRoutes: RouteEntry[];
  milestoneFeed: MilestoneDayEntry[];
  monthlySummary: {
    month: string;
    created: number;
    delivered: number;
    valueUSD: number;
    milestonesLogged: number;
  };
}

// ─── CSV export helper ────────────────────────────────────────────────────────

function downloadCSV(rows: Record<string, string | number>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Donut chart (pure SVG) ───────────────────────────────────────────────────

function DonutChart({ slices, size = 88 }: { slices: { value: number; color: string; label: string }[]; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <div style={{ width: size, height: size }} className="rounded-full bg-mist-light border border-mist" />;
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  let cumulative = 0;
  const paths = slices.map((s, i) => {
    const start = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += s.value;
    const end = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    const innerR = r * 0.55;
    const xi1 = cx + innerR * Math.cos(start);
    const yi1 = cy + innerR * Math.sin(start);
    const xi2 = cx + innerR * Math.cos(end);
    const yi2 = cy + innerR * Math.sin(end);
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi1} ${yi1} Z`;
    return <path key={i} d={d} fill={s.color} opacity={0.9} />;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, accent = false }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col gap-3 border shadow-sm ${accent ? 'border-0' : 'bg-white border-mist'}`}
      style={accent ? { background: 'linear-gradient(135deg, var(--theme-accent) 0%, var(--theme-accent-hover, var(--theme-accent)) 100%)' } : {}}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent ? 'bg-white/15' : 'bg-mist-light'}`}>
        <div className={accent ? 'text-white' : ''} style={accent ? {} : { color: 'var(--theme-accent)' }}>
          {icon}
        </div>
      </div>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${accent ? 'text-white/60' : 'text-ink-faint'}`}>{label}</p>
        <p className={`text-3xl font-display font-medium leading-none mt-1 ${accent ? 'text-white' : 'text-ink'}`}>{value}</p>
        {sub && <p className={`text-[11px] mt-1 ${accent ? 'text-white/50' : 'text-ink-faint'}`}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DELIVERED:        '#0BAFB0',
  IN_TRANSIT:       '#1f6f8c',
  ESCROW_FUNDED:    '#FE9900',
  CONFIRMED:        '#81a1c6',
  PENDING_EXPORTER: '#b0b8c8',
  CANCELLED:        '#8B1646',
  DISPUTED:         '#E05C00',
  CUSTOMS_CLEARANCE:'#4a7a9b',
  AT_PORT:          '#6b8fa3',
  OUT_FOR_DELIVERY: '#3d7ab5',
  COUNTER_OFFER:    '#9b7a3d',
};
const ESCROW_COLORS: Record<string, string> = {
  FUNDED:   '#FE9900',
  RELEASED: '#0BAFB0',
  REFUNDED: '#81a1c6',
  DISPUTED: '#E05C00',
  UNFUNDED: '#b0b8c8',
};

export default function AnalyticsPage() {
  const { currentUser } = useUserSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/analytics');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      console.warn('Analytics load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExportAll = () => {
    if (!data) return;
    setExporting(true);
    try {
      downloadCSV(
        data.monthly.map(m => ({
          Month: m.month,
          'Shipments Created': m.created,
          'Shipments Delivered': m.delivered,
          'Cargo Value (USD)': m.valueUSD,
        })),
        `maritrade-monthly-${new Date().toISOString().slice(0, 7)}.csv`,
      );
      setTimeout(() => {
        downloadCSV(
          data.topRoutes.map(r => ({ Route: r.route, 'Shipment Count': r.count, 'Total Value (USD)': r.valueUSD })),
          `maritrade-routes-${new Date().toISOString().slice(0, 7)}.csv`,
        );
        setExporting(false);
      }, 400);
    } catch {
      setExporting(false);
    }
  };

  if (!currentUser) return null;
  const isTradeParty = currentUser.userType === 'TRADE_PARTY';

  return (
    <DashboardLayout tradeParty={isTradeParty}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-medium text-ink tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8" style={{ color: 'var(--theme-accent)' }} />
            Analytics & Reports
          </h1>
          <p className="text-xs text-ink-faint mt-1">
            Shipment volume, escrow flow, route intelligence, and monthly summaries.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 border border-mist bg-white hover:bg-mist-light text-ink font-bold text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportAll}
            disabled={!data || exporting}
            className="flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            style={{ background: 'var(--theme-accent)' }}
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-mist">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--theme-accent)', borderTopColor: 'transparent' }} />
          <p className="text-xs text-ink-faint font-mono tracking-wide">AGGREGATING TRADE LEDGER DATA…</p>
        </div>
      ) : !data ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-mist text-ink-faint text-sm">
          No analytics data available.
        </div>
      ) : (
        <>

          {/* Monthly Summary Banner */}
          <div
            className="rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between"
            style={isTradeParty
              ? { background: 'linear-gradient(110deg, #5C0A2E 0%, #8B1646 55%, #4A0A26 100%)' }
              : { background: 'linear-gradient(110deg, var(--color-ink) 0%, var(--color-ink-soft) 55%, var(--color-teal-hover) 140%)' }
            }
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Monthly Summary</p>
                <p className="text-xl font-display font-medium text-white">{data.monthlySummary.month}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              {[
                { label: 'Created',          value: data.monthlySummary.created },
                { label: 'Delivered',        value: data.monthlySummary.delivered },
                { label: 'Milestones Logged',value: data.monthlySummary.milestonesLogged },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-display font-medium text-white">{String(stat.value).padStart(2, '0')}</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-widest">{stat.label}</p>
                </div>
              ))}
              <div className="text-center">
                <p className="text-2xl font-display font-medium text-white">{formatAsset(data.monthlySummary.valueUSD, 'USDC')}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-widest">Cargo Value</p>
              </div>
            </div>
          </div>

          {/* KPI Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Shipments" value={data.summary.total}     icon={<Ship className="w-4 h-4" />} />
            <StatCard label="Active Cargoes"  value={data.summary.active}    icon={<Activity className="w-4 h-4" />} />
            <StatCard label="Delivered"       value={data.summary.delivered} icon={<CheckCircle2 className="w-4 h-4" />} />
            <StatCard
              label="Escrow Locked"
              value={formatAsset(data.summary.escrowLockedUSD, 'USDC')}
              sub="USDC on Stellar"
              icon={<Coins className="w-4 h-4" />}
              accent
            />
          </div>

          {/* KPI Row 2 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Cargo Value"  value={formatAsset(data.summary.totalValueUSD, 'USDC')}     icon={<TrendingUp className="w-4 h-4" />} />
            <StatCard label="Escrow Released"    value={formatAsset(data.summary.escrowReleasedUSD, 'USDC')} icon={<Zap className="w-4 h-4" />} />
            <StatCard label="Disputed"           value={data.summary.disputed}  icon={<AlertTriangle className="w-4 h-4" />} />
            <StatCard label="Cancelled"          value={data.summary.cancelled} icon={<Package className="w-4 h-4" />} />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Monthly volume — spans 2 cols */}
            <div className="lg:col-span-2 bg-white border border-mist rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-display font-medium text-ink">Shipment Volume — Last 12 Months</h3>
                  <p className="text-[10px] text-ink-faint mt-0.5">Monthly shipments created vs delivered</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold text-ink-faint">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'var(--theme-accent)' }} /> Created
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-2 rounded-sm inline-block bg-teal" /> Delivered
                  </span>
                </div>
              </div>
              <div className="flex items-end gap-2 w-full" style={{ height: 120 }}>
                {data.monthly.map((m, i) => {
                  const maxVal = Math.max(...data.monthly.map(x => x.created), 1);
                  const createdPct = (m.created / maxVal) * 100;
                  const delivPct   = (m.delivered / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full">
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                        <div className="bg-ink text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap">
                          {m.month}: {m.created} / {m.delivered}
                        </div>
                        <div className="w-1.5 h-1.5 bg-ink rotate-45 -mt-0.5" />
                      </div>
                      <div className="w-full flex items-end gap-0.5 h-full">
                        <div className="flex-1 rounded-sm" style={{ height: `${Math.max(createdPct, 2)}%`, background: 'var(--theme-accent)', opacity: 0.8 }} />
                        <div className="flex-1 rounded-sm bg-teal opacity-80" style={{ height: `${Math.max(delivPct, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 w-full">
                {data.monthly.map((m, i) => (
                  <div key={i} className="flex-1 text-center text-[8px] text-ink-faint font-mono">
                    {i % 2 === 0 ? m.month : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Status + Escrow donuts */}
            <div className="bg-white border border-mist rounded-2xl p-6 space-y-4 shadow-sm">
              <h3 className="text-sm font-display font-medium text-ink">Shipment Status</h3>
              <div className="flex items-center gap-4">
                <DonutChart
                  size={96}
                  slices={Object.entries(data.statusCounts).map(([s, c]) => ({
                    value: c, color: STATUS_COLORS[s] ?? '#b0b8c8', label: s,
                  }))}
                />
                <div className="flex-1 space-y-2 min-w-0">
                  {Object.entries(data.statusCounts).sort((a, b) => b[1] - a[1]).map(([s, c]) => (
                    <div key={s} className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[s] ?? '#b0b8c8' }} />
                        <span className="text-[10px] text-ink-faint truncate">{s.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-[10px] font-bold text-ink shrink-0">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-mist pt-4">
                <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider mb-3">Escrow Status</p>
                <div className="flex items-center gap-4">
                  <DonutChart
                    size={72}
                    slices={Object.entries(data.escrowCounts).map(([s, c]) => ({
                      value: c, color: ESCROW_COLORS[s] ?? '#b0b8c8', label: s,
                    }))}
                  />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {Object.entries(data.escrowCounts).map(([s, c]) => (
                      <div key={s} className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ESCROW_COLORS[s] ?? '#b0b8c8' }} />
                          <span className="text-[9px] text-ink-faint truncate">{s}</span>
                        </div>
                        <span className="text-[9px] font-bold text-ink shrink-0">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Top routes */}
            <div className="lg:col-span-2 bg-white border border-mist rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-display font-medium text-ink flex items-center gap-2">
                  <Globe className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
                  Top Trade Routes
                </h3>
                <button
                  onClick={() => data && downloadCSV(data.topRoutes.map(r => ({ Route: r.route, Count: r.count, 'Value USD': r.valueUSD })), 'maritrade-routes.csv')}
                  className="flex items-center gap-1 text-[10px] font-bold text-ink-faint hover:text-ink transition-colors"
                >
                  <Download className="w-3 h-3" /> Export
                </button>
              </div>
              {data.topRoutes.length === 0 ? (
                <p className="text-xs text-ink-faint text-center py-8">No route data yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.topRoutes.map((r, i) => {
                    const maxCount = data.topRoutes[0].count;
                    const pct = (r.count / maxCount) * 100;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-ink truncate max-w-[55%]">{r.route}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-ink-faint">{r.count} shipment{r.count !== 1 ? 's' : ''}</span>
                            <span className="font-bold text-ink">{formatAsset(r.valueUSD, 'USDC')}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-mist-light overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--theme-accent)', opacity: 0.75 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scope + Milestone activity */}
            <div className="flex flex-col gap-6">
              <div className="bg-white border border-mist rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-display font-medium text-ink">Scope Breakdown</h3>
                <div className="flex items-center gap-4">
                  <DonutChart
                    size={72}
                    slices={[
                      { value: data.scopeCounts.nationwide, color: '#0BAFB0', label: 'Nationwide' },
                      { value: data.scopeCounts.overseas,   color: '#FE9900', label: 'Overseas' },
                    ]}
                  />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal inline-block" />
                      <span className="text-ink-faint">Nationwide</span>
                      <span className="font-bold text-ink ml-auto pl-4">{data.scopeCounts.nationwide}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#FE9900' }} />
                      <span className="text-ink-faint">Overseas</span>
                      <span className="font-bold text-ink ml-auto pl-4">{data.scopeCounts.overseas}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-mist rounded-2xl p-6 shadow-sm space-y-3 flex-1">
                <div>
                  <h3 className="text-sm font-display font-medium text-ink flex items-center gap-2">
                    <Activity className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
                    Milestone Activity
                  </h3>
                  <p className="text-[10px] text-ink-faint mt-0.5">Logs per day — last 14 days</p>
                </div>
                {data.milestoneFeed.length === 0 ? (
                  <p className="text-xs text-ink-faint text-center py-4">No recent activity.</p>
                ) : (
                  <div className="flex items-end gap-1 w-full" style={{ height: 72 }}>
                    {data.milestoneFeed.map((d, i) => {
                      const max = Math.max(...data.milestoneFeed.map(x => x.count), 1);
                      const pct = (d.count / max) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center group relative" style={{ height: '100%' }}>
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                            <div className="bg-ink text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap">
                              {d.day}: {d.count}
                            </div>
                            <div className="w-1.5 h-1.5 bg-ink rotate-45 -mt-0.5" />
                          </div>
                          <div className="w-full mt-auto rounded-sm" style={{ height: `${Math.max(pct, 4)}%`, background: 'var(--theme-accent)', opacity: 0.8 }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Export options */}
          <div className="bg-white border border-mist rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-display font-medium text-ink flex items-center gap-2">
                  <Download className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
                  Custom Exports
                </h3>
                <p className="text-xs text-ink-faint mt-0.5">Download your data as CSV for reporting or reconciliation.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => data && downloadCSV(
                    data.monthly.map(m => ({ Month: m.month, Created: m.created, Delivered: m.delivered, 'Value (USD)': m.valueUSD })),
                    `maritrade-monthly-volume-${new Date().toISOString().slice(0, 7)}.csv`,
                  )}
                  className="flex items-center gap-1.5 border border-mist hover:bg-mist-light text-ink text-xs font-bold px-3 py-2 rounded-lg transition-all"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> Monthly Volume
                </button>
                <button
                  onClick={() => data && downloadCSV(
                    data.topRoutes.map(r => ({ Route: r.route, Count: r.count, 'Value (USD)': r.valueUSD })),
                    `maritrade-routes-${new Date().toISOString().slice(0, 7)}.csv`,
                  )}
                  className="flex items-center gap-1.5 border border-mist hover:bg-mist-light text-ink text-xs font-bold px-3 py-2 rounded-lg transition-all"
                >
                  <Globe className="w-3.5 h-3.5" /> Top Routes
                </button>
                <button
                  onClick={() => data && downloadCSV(
                    Object.entries(data.statusCounts).map(([s, c]) => ({ Status: s, Count: c })),
                    `maritrade-status-${new Date().toISOString().slice(0, 7)}.csv`,
                  )}
                  className="flex items-center gap-1.5 border border-mist hover:bg-mist-light text-ink text-xs font-bold px-3 py-2 rounded-lg transition-all"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Status Breakdown
                </button>
                <button
                  onClick={handleExportAll}
                  disabled={exporting}
                  className="flex items-center gap-1.5 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                  style={{ background: 'var(--theme-accent)' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  {exporting ? 'Exporting…' : 'Export All'}
                </button>
              </div>
            </div>
          </div>

        </>
      )}
    </DashboardLayout>
  );
}
