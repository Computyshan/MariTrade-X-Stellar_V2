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
  PENDING_EXPORTER:  { label: 'Pending Exporter', className: 'bg-gray-100 text-gray-600' },
  COUNTER_OFFER:     { label: 'Counter Offer',    className: 'bg-amber-100 text-amber-700' },
  CONFIRMED:         { label: 'Confirmed',         className: 'bg-maritime-100 text-maritime-700' },
  ESCROW_FUNDED:     { label: 'Escrow Funded',     className: 'bg-maritime-100 text-maritime-400' },
  IN_TRANSIT:        { label: 'In Transit',         className: 'bg-ocean-100 text-ocean-600' },
  AT_PORT:           { label: 'At Port',            className: 'bg-sky-100 text-sky-700' },
  CUSTOMS_CLEARANCE: { label: 'Customs Clearance', className: 'bg-maritime-50 text-maritime-700' },
  OUT_FOR_DELIVERY:  { label: 'Out for Delivery',  className: 'bg-amber-100 text-amber-700' },
  DELIVERED:         { label: 'Delivered',          className: 'bg-green-100 text-green-700' },
  DISPUTED:          { label: 'Disputed',           className: 'bg-red-50 text-red-500' },
  CANCELLED:         { label: 'Cancelled',          className: 'bg-gray-100 text-gray-500' },
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

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  // ── SESSION STILL LOADING ───────────────────────────────────────────────────
  // currentUser is null until the Supabase session resolves on mount — render a
  // lightweight loading state instead of touching currentUser.jobRole too early.
  if (!currentUser) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-gray-400 text-xs gap-2">
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
            <FolderLock className="w-6 h-6 text-maritime-400" />
            <h1 className="text-3xl font-black text-maritime-900 tracking-tight">BOC Document Vault</h1>
          </div>
          <p className="text-sm text-gray-500">
            Shipment folders are visible to all authorized users. Each folder requires its vault password to access documents inside.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 bg-white border border-sand-200 px-3 py-1.5 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${hasAccess ? 'bg-ocean-400' : 'bg-red-400'}`} />
            <span className="font-semibold text-gray-700">
              {hasAccess ? 'Vault Access: Authorized' : 'Vault Access: Restricted'}
            </span>
          </div>
          <div className="bg-maritime-50 border border-maritime-100 text-maritime-700 font-bold px-3 py-1.5 rounded-lg">
            {folders.length} folder{folders.length !== 1 ? 's' : ''}
          </div>
          <button
            onClick={fetchFolders}
            disabled={loading}
            className="p-2 rounded-lg border border-sand-200 text-gray-400 hover:text-maritime-400 hover:border-maritime-200 transition-colors disabled:opacity-40"
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
          <div className="bg-white border border-sand-200 rounded-xl p-3 flex items-center gap-3">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by folder name, reference code, cargo description, port…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* SECURITY BANNER */}
          <div className="bg-maritime-50 border border-maritime-100 rounded-xl p-3 flex items-start gap-3 text-xs text-maritime-700">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-maritime-400" />
            <div>
              <strong className="font-bold">Folder Vault Security</strong> — All shipment folders below are visible to authorized users.
              Click any folder to enter its vault password and access the documents inside.
              Folders re-lock when you leave the session.
            </div>
          </div>

          {/* LOADING */}
          {loading && (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-maritime-400" />
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
            <div className="text-center py-16 bg-white border border-sand-200 rounded-xl text-gray-400 text-xs">
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
                    className="group flex flex-col rounded-2xl border border-sand-200 bg-white p-3 text-left transition-all hover:border-maritime-200 hover:bg-maritime-50/30 hover:shadow-md active:scale-[0.97] cursor-pointer"
                  >
                    {/* Square icon area */}
                    <div className="w-full aspect-square rounded-xl bg-sand-100 group-hover:bg-maritime-100/60 transition-colors flex items-center justify-center mb-3">
                      <FolderLock className="w-10 h-10 text-gray-400 group-hover:text-maritime-400 transition-colors" />
                    </div>

                    <p className="text-[11px] font-black text-maritime-900 font-mono truncate w-full">
                      {folder.folderName}
                    </p>
                    <p className="text-[9px] font-mono text-gray-400 truncate w-full mt-0.5">
                      {folder.referenceCode}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {statusCfg && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      )}
                      <span className="text-[9px] text-gray-400 flex items-center gap-0.5 ml-auto">
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
