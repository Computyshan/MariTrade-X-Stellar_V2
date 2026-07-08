'use client';

import React, { useState, useCallback, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { authFetch } from '@/hooks/use-user-session';
import { useRouter } from 'next/navigation';
import {
  FolderLock, FileText, Lock,
  ShieldCheck, Search, X, AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { VaultFolder, ShipmentStatus, ShipmentScope, ShipmentDocument } from '@/types';
import { canAccessBOCDocuments } from '@/lib/permissions/documents';

// ── API SHAPE ────────────────────────────────────────────────────────────────

interface DecoratedFolder extends VaultFolder {
  shipment: {
    id: string;
    referenceCode: string;
    description: string;
    originCountry: string;
    destinationPort: string;
    shipmentScope: ShipmentScope;
    status: ShipmentStatus;
  } | null;
  documents: ShipmentDocument[];
}

// ── STATUS BADGE CONFIG ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; className: string }> = {
  PENDING_EXPORTER:  { label: 'Pending Exporter', className: 'bg-mist text-ink-faint' },
  COUNTER_OFFER:     { label: 'Counter Offer',    className: 'bg-amber-light text-amber' },
  CONFIRMED:         { label: 'Confirmed',         className: 'bg-teal-light text-teal' },
  ESCROW_FUNDED:     { label: 'Escrow Funded',     className: 'bg-steel-light text-steel' },
  IN_TRANSIT:        { label: 'In Transit',         className: 'bg-steel-light text-steel' },
  AT_PORT:           { label: 'At Port',            className: 'bg-mist text-ink-faint' },
  CUSTOMS_CLEARANCE: { label: 'Customs Clearance', className: 'bg-teal-light text-teal' },
  OUT_FOR_DELIVERY:  { label: 'Out for Delivery',  className: 'bg-amber-light text-amber' },
  DELIVERED:         { label: 'Delivered',          className: 'bg-teal-light text-teal' },
  DISPUTED:          { label: 'Disputed',           className: 'bg-wine-light text-wine' },
  CANCELLED:         { label: 'Cancelled',          className: 'bg-mist text-ink-faint' },
};

// ── HELPERS ──────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const h    = Math.floor(diff / 3600000);
  if (h < 1)  return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── PAGE ─────────────────────────────────────────────────────────────────────

export default function DocumentVaultPage() {
  const { currentUser } = useUserSession();
  const router = useRouter();

  // ── data ──
  const [folders,  setFolders]  = useState<DecoratedFolder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [fetchErr, setFetchErr] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  // ── fetch from API ──
  const fetchFolders = useCallback(async () => {
    setLoading(true);
    setFetchErr('');
    try {
      const res  = await authFetch('/api/vault/folders');
      const json = await res.json();
      if (json.success) {
        setFolders(json.data);
      } else {
        setFetchErr(json.error ?? 'Failed to load vault folders.');
      }
    } catch {
      setFetchErr('Network error — could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  // ── SESSION STILL LOADING ───────────────────────────────────────────────────
  // currentUser is null until the Supabase session resolves on mount — render a
  // lightweight loading state instead of touching currentUser.jobRole too early.
  if (!currentUser) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-ink-faint text-xs gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading your session…
        </div>
      </DashboardLayout>
    );
  }

  const hasAccess = canAccessBOCDocuments(currentUser.jobRole);

  const filteredFolders = folders.filter(f => {
    const q = searchTerm.toLowerCase();
    return (
      f.folderName.toLowerCase().includes(q) ||
      f.referenceCode.toLowerCase().includes(q) ||
      (f.shipment?.description ?? '').toLowerCase().includes(q) ||
      (f.shipment?.originCountry ?? '').toLowerCase().includes(q) ||
      (f.shipment?.destinationPort ?? '').toLowerCase().includes(q)
    );
  });

  // ── handlers ──

  // ── render ──

  return (
    <DashboardLayout>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderLock className="w-6 h-6" style={{ color: 'var(--theme-accent)' }} />
            <h1 className="text-3xl font-display font-medium text-ink tracking-tight">BOC Document Vault</h1>
          </div>
          <p className="text-sm text-ink-faint">
            You only see folders for shipments you're assigned to. Each folder still requires its vault password to access documents inside.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 bg-white border border-mist px-3 py-1.5 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${hasAccess ? 'bg-teal' : 'bg-wine'}`} />
            <span className="font-semibold text-ink-faint">
              {hasAccess ? 'Vault Access: Authorized' : 'Vault Access: Restricted'}
            </span>
          </div>
          <div className="bg-mist-light border border-mist text-ink-faint font-bold px-3 py-1.5 rounded-lg">
            {folders.length} folder{folders.length !== 1 ? 's' : ''}
          </div>
          <button
            onClick={fetchFolders}
            disabled={loading}
            className="p-2 rounded-lg border border-mist text-ink-faint hover:text-steel hover:border-steel/30 transition-colors disabled:opacity-40"
            title="Refresh folders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ACCESS DENIED */}
      {!hasAccess ? (
        <div className="bg-red-50 border border-red-200 p-10 rounded-2xl text-center space-y-4 mt-2">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="font-extrabold text-base text-red-950">BOC Vault — Access Restricted</h3>
          <p className="text-xs text-red-700 max-w-sm mx-auto leading-relaxed">
            Your active profile (<strong className="uppercase">{currentUser.jobRole}</strong>) does not have clearance to access the Bureau of Customs Document Vault.
          </p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* SEARCH */}
          <div className="bg-white border border-mist rounded-xl p-3 flex items-center gap-3">
            <Search className="w-4 h-4 text-ink-faint shrink-0" />
            <input
              type="text"
              placeholder="Search by folder name, reference code, cargo description, port…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-ink-faint"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-ink-faint hover:text-ink">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* SECURITY BANNER */}
          <div className="bg-mist-light border border-mist rounded-xl p-3 flex items-start gap-3 text-xs text-ink-faint">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--theme-accent)' }} />
            <div>
              <strong className="font-bold">Folder Vault Security</strong> — Only shipments you're assigned to appear below.
              Click any folder to enter its vault password and access the documents inside.
              Folders re-lock when you leave the session.
            </div>
          </div>

          {/* LOADING */}
          {loading && (
            <div className="flex items-center justify-center py-20 gap-3 text-ink-faint text-xs">
              <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--theme-accent)' }} />
              Loading vault folders…
            </div>
          )}

          {/* FETCH ERROR */}
          {!loading && fetchErr && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs p-4 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {fetchErr}
              <button onClick={fetchFolders} className="ml-auto font-bold underline">Retry</button>
            </div>
          )}

          {/* EMPTY */}
          {!loading && !fetchErr && filteredFolders.length === 0 && (
            <div className="text-center py-16 bg-white border border-mist rounded-xl text-ink-faint text-xs">
              {searchTerm ? 'No folders match your search.' : 'No vault folders yet. Create a shipment to generate one.'}
            </div>
          )}

          {/* FOLDER GRID */}
          {!loading && !fetchErr && filteredFolders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredFolders.map(folder => {
                const ship      = folder.shipment;
                const statusCfg = ship ? STATUS_CONFIG[ship.status] : null;

                return (
                  <div
                    key={folder.id}
                    onClick={() => router.push(`/documents/${folder.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && router.push(`/documents/${folder.id}`)}
                    className="group flex flex-col rounded-2xl border border-mist bg-white p-3 text-left transition-all hover:shadow-md active:scale-[0.97] cursor-pointer"
                  >
                    {/* Square icon area */}
                    <div className="w-full aspect-square rounded-xl bg-mist-light group-hover:bg-mist transition-colors flex items-center justify-center mb-3">
                      <FolderLock className="w-10 h-10 text-ink-faint/40 group-hover:text-ink-faint transition-colors" />
                    </div>

                    <p className="text-[11px] font-bold text-ink truncate w-full">
                      {folder.folderName}
                    </p>
                    <p className="text-[9px] text-ink-faint truncate w-full mt-0.5">
                      {folder.referenceCode}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {statusCfg && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      )}
                      <span className="text-[9px] text-ink-faint flex items-center gap-0.5 ml-auto">
                        <FileText className="w-2.5 h-2.5" />
                        {folder.documents.length}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}


        </div>
      )}

    </DashboardLayout>
  );
}
