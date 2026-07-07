'use client';

import React, { useState, useEffect, useMemo, useCallback, startTransition } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
import {
  Ship,
  Plus,
  MapPin,
  Calendar,
  ChevronRight,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Download,
  Bookmark,
  BookmarkPlus,
  X,
  Check,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';
import {
  Shipment,
  ShipmentStatus,
  ShipmentScope,
  EscrowStatus,
  SavedShipmentView,
  ShipmentListFilters,
  ShipmentSortField,
  SortDirection,
} from '@/types';
import { formatAsset } from '@/lib/stellar/assets';

const STATUS_OPTIONS: ShipmentStatus[] = [
  'PENDING_EXPORTER', 'COUNTER_OFFER', 'CONFIRMED', 'ESCROW_FUNDED',
  'IN_TRANSIT', 'AT_PORT', 'CUSTOMS_CLEARANCE', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'DISPUTED', 'CANCELLED',
];
const SCOPE_OPTIONS: ShipmentScope[] = ['NATIONWIDE', 'OVERSEAS'];
const ESCROW_OPTIONS: EscrowStatus[] = ['UNFUNDED', 'FUNDED', 'RELEASED', 'REFUNDED', 'DISPUTED'];

const SORT_FIELD_LABELS: Record<ShipmentSortField, string> = {
  createdAt: 'Date Created',
  estimatedArrival: 'ETA',
  totalValueUSD: 'Escrow Value',
  referenceCode: 'Reference Code',
};

function csvEscape(val: string | number): string {
  const s = String(val ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: Shipment[]) {
  const headers = ['Reference Code', 'Status', 'Scope', 'Escrow Status', 'Origin', 'Destination', 'Value (USD)', 'ETA', 'Created At'];
  const lines = [headers.join(',')];
  for (const s of rows) {
    lines.push([
      csvEscape(s.referenceCode),
      csvEscape(s.status),
      csvEscape(s.shipmentScope),
      csvEscape(s.escrowStatus),
      csvEscape(s.originCountry),
      csvEscape(s.destinationPort),
      csvEscape(s.totalValueUSD ?? 0),
      csvEscape(s.estimatedArrival ? new Date(s.estimatedArrival).toLocaleDateString() : ''),
      csvEscape(new Date(s.createdAt).toLocaleDateString()),
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maritrade-shipments-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ShipmentsList() {
  const { currentUser, loading: sessionLoading } = useUserSession();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Filters & sort ────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus[]>([]);
  const [scopeFilter, setScopeFilter] = useState<ShipmentScope[]>([]);
  const [escrowFilter, setEscrowFilter] = useState<EscrowStatus[]>([]);
  const [sortBy, setSortBy] = useState<ShipmentSortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ── Saved views ────────────────────────────────────────────────────
  const [savedViews, setSavedViews] = useState<SavedShipmentView[]>([]);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  // ── Bulk selection ───────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isTradeParty = currentUser?.userType === 'TRADE_PARTY';

  const loadSavedViews = useCallback(async () => {
    try {
      const res = await authFetch('/api/shipments/saved-views');
      const json = await res.json();
      if (json.success) setSavedViews(json.data);
    } catch {
      console.warn('Could not load saved views');
    }
  }, []);

  const loadShipments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/shipments');
      const json = await res.json();
      if (json.success) {
        setShipments(json.data);
      }
    } catch {
      console.warn('Fallback loading');
    } finally {
      setLoading(false);
    }
  }, []);

  // Wrapped in startTransition so the initial setLoading(true) inside
  // loadShipments() isn't treated as a synchronous cascading render
  // straight out of the effect (see react-hooks/set-state-in-effect).
  useEffect(() => {
    startTransition(() => {
      loadShipments();
      loadSavedViews();
    });
  }, [loadShipments, loadSavedViews]);

  const applySavedView = (view: SavedShipmentView) => {
    setStatusFilter(view.filters.status ?? []);
    setScopeFilter(view.filters.shipmentScope ?? []);
    setEscrowFilter(view.filters.escrowStatus ?? []);
    setSearchTerm(view.filters.search ?? '');
    setSortBy(view.sortBy);
    setSortDir(view.sortDir);
    setSavedViewsOpen(false);
  };

  const saveCurrentView = async () => {
    if (!newViewName.trim()) return;
    const filters: ShipmentListFilters = {
      status: statusFilter.length ? statusFilter : undefined,
      shipmentScope: scopeFilter.length ? scopeFilter : undefined,
      escrowStatus: escrowFilter.length ? escrowFilter : undefined,
      search: searchTerm.trim() || undefined,
    };
    try {
      const res = await authFetch('/api/shipments/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newViewName.trim(), filters, sortBy, sortDir }),
      });
      const json = await res.json();
      if (json.success) {
        setSavedViews(prev => [json.data, ...prev]);
        setNewViewName('');
        setSavingView(false);
      }
    } catch {
      console.warn('Could not save view');
    }
  };

  const deleteSavedView = async (id: string) => {
    setSavedViews(prev => prev.filter(v => v.id !== id));
    try {
      await authFetch(`/api/shipments/saved-views/${id}`, { method: 'DELETE' });
    } catch {
      console.warn('Could not delete view');
    }
  };

  const toggleArrayFilter = <T,>(arr: T[], setArr: (v: T[]) => void, val: T) => {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setScopeFilter([]);
    setEscrowFilter([]);
  };

  const activeFilterCount = statusFilter.length + scopeFilter.length + escrowFilter.length;

  const filtered = useMemo(() => {
    let rows = shipments.filter(s =>
      s.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.originCountry.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (statusFilter.length) rows = rows.filter(s => statusFilter.includes(s.status));
    if (scopeFilter.length) rows = rows.filter(s => scopeFilter.includes(s.shipmentScope));
    if (escrowFilter.length) rows = rows.filter(s => escrowFilter.includes(s.escrowStatus));

    const dir = sortDir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortBy) {
        case 'totalValueUSD':
          av = a.totalValueUSD ?? 0; bv = b.totalValueUSD ?? 0; break;
        case 'estimatedArrival':
          av = a.estimatedArrival ? new Date(a.estimatedArrival).getTime() : 0;
          bv = b.estimatedArrival ? new Date(b.estimatedArrival).getTime() : 0; break;
        case 'referenceCode':
          av = a.referenceCode; bv = b.referenceCode; break;
        default:
          av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [shipments, searchTerm, statusFilter, scopeFilter, escrowFilter, sortBy, sortDir]);

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(s => s.id)));
  };

  const exportSelectedOrAll = () => {
    const rows = selected.size > 0 ? filtered.filter(s => selected.has(s.id)) : filtered;
    downloadCsv(rows);
  };

  if (sessionLoading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout tradeParty={isTradeParty}>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-medium text-ink tracking-tight">Cargo Shipments</h1>
          <p className="text-sm text-ink-faint mt-1">Monitor, assign logistics crews, and verify multisig escrow contract locks.</p>
        </div>
        {isTradeParty && (
          <Link
            href="/shipments/new"
            className="font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer uppercase tracking-wider text-white"
            style={{ background: 'var(--theme-feature)' }}
          >
            <Plus className="w-4 h-4" />
            <span>New Shipment Booking</span>
          </Link>
        )}
      </div>

      {/* Toolbar: search, filters, sort, saved views, view mode */}
      <div
        className="p-4 rounded-2xl flex flex-wrap gap-3 items-center relative"
        style={isTradeParty
          ? { background: 'var(--color-wine-light)', border: '1.5px solid var(--color-wine)' }
          : { background: 'white', border: '1px solid var(--color-mist)' }
        }
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-ink-faint absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search cargo, reference MT-XXXX, or origin country..."
            className="w-full bg-mist-light border border-mist rounded-lg pl-9 pr-3 py-2 text-xs outline-none"
            style={{ outlineColor: 'var(--theme-accent)' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="relative">
          <button
            onClick={() => { setFiltersOpen(o => !o); setSortOpen(false); setSavedViewsOpen(false); }}
            className="text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 bg-mist-light border border-mist text-ink hover:bg-mist transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          {filtersOpen && (
            <div className="absolute z-20 top-full left-0 mt-2 w-72 bg-white border border-mist rounded-xl shadow-lg p-4 space-y-4">
              <div>
                <span className="block text-[9px] font-bold text-ink-faint uppercase tracking-wider mb-1.5">Status</span>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleArrayFilter(statusFilter, setStatusFilter, opt)}
                      className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase border transition-colors ${
                        statusFilter.includes(opt) ? 'bg-ink text-white border-ink' : 'bg-mist-light text-ink-faint border-mist'
                      }`}
                    >
                      {opt.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-ink-faint uppercase tracking-wider mb-1.5">Scope</span>
                <div className="flex flex-wrap gap-1.5">
                  {SCOPE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleArrayFilter(scopeFilter, setScopeFilter, opt)}
                      className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase border transition-colors ${
                        scopeFilter.includes(opt) ? 'bg-ink text-white border-ink' : 'bg-mist-light text-ink-faint border-mist'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-ink-faint uppercase tracking-wider mb-1.5">Escrow Status</span>
                <div className="flex flex-wrap gap-1.5">
                  {ESCROW_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleArrayFilter(escrowFilter, setEscrowFilter, opt)}
                      className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase border transition-colors ${
                        escrowFilter.includes(opt) ? 'bg-ink text-white border-ink' : 'bg-mist-light text-ink-faint border-mist'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-[10px] font-bold text-ink-faint hover:text-ink underline">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => { setSortOpen(o => !o); setFiltersOpen(false); setSavedViewsOpen(false); }}
            className="text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 bg-mist-light border border-mist text-ink hover:bg-mist transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort: {SORT_FIELD_LABELS[sortBy]} ({sortDir === 'asc' ? '↑' : '↓'})
          </button>
          {sortOpen && (
            <div className="absolute z-20 top-full left-0 mt-2 w-56 bg-white border border-mist rounded-xl shadow-lg p-2 space-y-1">
              {(Object.keys(SORT_FIELD_LABELS) as ShipmentSortField[]).map(field => (
                <button
                  key={field}
                  onClick={() => setSortBy(field)}
                  className={`w-full text-left text-xs font-medium px-3 py-1.5 rounded-lg flex items-center justify-between ${
                    sortBy === field ? 'bg-mist-light text-ink font-bold' : 'text-ink-faint hover:bg-mist-light'
                  }`}
                >
                  {SORT_FIELD_LABELS[field]}
                  {sortBy === field && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
              <div className="border-t border-mist mt-1 pt-1 flex gap-1">
                <button
                  onClick={() => setSortDir('asc')}
                  className={`flex-1 text-[10px] font-bold uppercase py-1.5 rounded-lg ${sortDir === 'asc' ? 'bg-ink text-white' : 'bg-mist-light text-ink-faint'}`}
                >Ascending</button>
                <button
                  onClick={() => setSortDir('desc')}
                  className={`flex-1 text-[10px] font-bold uppercase py-1.5 rounded-lg ${sortDir === 'desc' ? 'bg-ink text-white' : 'bg-mist-light text-ink-faint'}`}
                >Descending</button>
              </div>
            </div>
          )}
        </div>

        {/* Saved views */}
        <div className="relative">
          <button
            onClick={() => { setSavedViewsOpen(o => !o); setFiltersOpen(false); setSortOpen(false); }}
            className="text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 bg-mist-light border border-mist text-ink hover:bg-mist transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Saved Views{savedViews.length > 0 ? ` (${savedViews.length})` : ''}
          </button>
          {savedViewsOpen && (
            <div className="absolute z-20 top-full left-0 mt-2 w-72 bg-white border border-mist rounded-xl shadow-lg p-3 space-y-2">
              {savedViews.length === 0 && !savingView && (
                <p className="text-[11px] text-ink-faint px-1">No saved views yet.</p>
              )}
              {savedViews.map(view => (
                <div key={view.id} className="flex items-center justify-between gap-2 px-1">
                  <button onClick={() => applySavedView(view)} className="text-xs font-medium text-ink hover:underline text-left flex-1 truncate">
                    {view.name}
                  </button>
                  <button onClick={() => deleteSavedView(view.id)} className="text-ink-faint hover:text-wine">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="border-t border-mist pt-2">
                {savingView ? (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      placeholder="View name..."
                      className="flex-1 text-xs bg-mist-light border border-mist rounded-lg px-2 py-1.5 outline-none"
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveCurrentView()}
                    />
                    <button onClick={saveCurrentView} className="text-[10px] font-bold text-white px-2.5 rounded-lg" style={{ background: 'var(--theme-feature)' }}>
                      Save
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setSavingView(true)} className="w-full text-[11px] font-bold text-ink-faint hover:text-ink flex items-center gap-1.5 px-1">
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    Save current filters as a view
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Grid / list toggle */}
        <div className="flex items-center bg-mist-light border border-mist rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-ink text-white' : 'text-ink-faint'}`}
            title="Card view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-ink text-white' : 'text-ink-faint'}`}
            title="List view"
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-xs text-ink-faint ml-auto">
          Showing <strong className="text-ink font-bold">{filtered.length}</strong> matching entries
        </div>
      </div>

      {/* Bulk actions bar */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-1">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-ink-faint cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === filtered.length}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 accent-ink"
            />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </label>
          <button
            onClick={exportSelectedOrAll}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 bg-mist-light border border-mist text-ink hover:bg-mist transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export {selected.size > 0 ? `${selected.size} selected` : 'all'} to CSV
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-mist">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--theme-feature)', borderTopColor: 'transparent' }} />
          <p className="text-xs text-ink-faint font-sans">LOADING CENTRAL LEDGER INDEX...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-mist rounded-3xl space-y-4">
          <Ship className="w-12 h-12 text-mist-dark mx-auto" />
          <h3 className="text-base font-display font-medium text-ink">No Active Shipments Found</h3>
          <p className="text-xs text-ink-faint max-w-sm mx-auto">There are no cargoes assigned to your profile in this segment.</p>
          {isTradeParty && (
            <div className="pt-2">
              <Link href="/shipments/new" className="text-white text-xs font-bold px-4 py-2 rounded-lg" style={{ background: 'var(--theme-feature)' }}>
                Book Shipping Record
              </Link>
            </div>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-mist overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-mist bg-mist-light text-[9px] uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-ink"
                  />
                </th>
                <th className="px-4 py-3 text-left">Ref Code</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Scope</th>
                <th className="px-4 py-3 text-left">Escrow</th>
                <th className="px-4 py-3 text-left">Route</th>
                <th className="px-4 py-3 text-left">ETA</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ship) => (
                <tr key={ship.id} className="border-b border-mist last:border-0 hover:bg-mist-light/50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(ship.id)}
                      onChange={() => toggleSelected(ship.id)}
                      className="w-3.5 h-3.5 accent-ink"
                    />
                  </td>
                  <td className="px-4 py-3 font-bold font-sans text-ink">{ship.referenceCode}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      ship.status === 'DELIVERED' ? 'bg-teal-light text-teal'
                      : ship.status === 'IN_TRANSIT' ? 'bg-steel-light text-steel'
                      : 'bg-amber-light text-amber'
                    }`}>
                      {ship.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-ink text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded">{ship.shipmentScope}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded uppercase"
                      style={isTradeParty
                        ? { background: 'var(--color-wine-light)', color: 'var(--color-wine)' }
                        : { background: 'var(--color-steel-light)', color: 'var(--color-steel)' }
                      }
                    >{ship.escrowStatus}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-faint whitespace-nowrap">{ship.originCountry} → {ship.destinationPort}</td>
                  <td className="px-4 py-3 text-ink-faint whitespace-nowrap">{ship.estimatedArrival ? new Date(ship.estimatedArrival).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right font-bold font-sans text-ink whitespace-nowrap">{formatAsset(ship.totalValueUSD ?? 0, 'USDC')}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/shipments/${ship.id}`}
                      className="inline-flex items-center gap-1 text-white px-2.5 py-1 rounded-lg font-bold whitespace-nowrap hover:opacity-90"
                      style={{ background: 'var(--theme-feature)' }}
                    >
                      Mgt Board
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((ship) => (
            <div
              key={ship.id}
              className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6 relative"
              style={{ border: isTradeParty ? '1.5px solid var(--color-wine)' : '1px solid var(--color-mist)' }}
            >
              <label className="absolute top-4 right-4 z-10 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(ship.id)}
                  onChange={() => toggleSelected(ship.id)}
                  className="w-4 h-4 accent-ink"
                />
              </label>
              <div className="space-y-4">
                {/* Ref header */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="block text-[9px] text-ink-faint font-sans tracking-wider">REF CODE</span>
                    <strong className="text-base font-bold font-sans text-ink">{ship.referenceCode}</strong>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    ship.status === 'DELIVERED' ? 'bg-teal-light text-teal'
                    : ship.status === 'IN_TRANSIT' ? 'bg-steel-light text-steel'
                    : 'bg-amber-light text-amber'
                  }`}>
                    {ship.status?.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Scope & Description */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="bg-ink text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded">{ship.shipmentScope}</span>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded uppercase"
                      style={isTradeParty
                        ? { background: 'var(--color-wine-light)', color: 'var(--color-wine)' }
                        : { background: 'var(--color-steel-light)', color: 'var(--color-steel)' }
                      }
                    >{ship.escrowStatus}</span>
                  </div>
                  <p className="text-xs text-ink-faint font-medium leading-relaxed line-clamp-2">{ship.description}</p>
                </div>

                {/* Route & ETA */}
                <div className="border-t border-mist pt-4 space-y-2 text-[11px] text-ink-faint">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--theme-accent)' }} />
                    <span>{ship.originCountry} → {ship.destinationPort}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--theme-feature)' }} />
                    <span>ETA: {new Date(ship.estimatedArrival || '').toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Card footer */}
              <div className="border-t border-mist pt-4 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-ink-faint font-sans block">ESCROW AMOUNT</span>
                  <strong className="text-ink font-bold font-sans text-sm">{formatAsset(ship.totalValueUSD ?? 0, 'USDC')}</strong>
                </div>
                <Link
                  href={`/shipments/${ship.id}`}
                  className="text-white px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer hover:opacity-90"
                  style={{ background: 'var(--theme-feature)' }}
                >
                  <span>Mgt Board</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
