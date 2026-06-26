'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { authFetch } from '@/hooks/use-user-session';
import {
  FolderLock, FolderOpen, FileText, Lock, Unlock, Download,
  ShieldCheck, Search, Eye, EyeOff, X, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronRight, Globe, Clock,
  Key, RefreshCw,
} from 'lucide-react';
import { VaultFolder, ShipmentDocument, ShipmentStatus, ShipmentScope } from '@/types';
import { canAccessBOCDocuments, canDownloadDocuments } from '@/lib/permissions/documents';

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

function fileExtBadge(fileName: string) {
  const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
  const map: Record<string, string> = {
    PDF:  'bg-red-100 text-red-600',
    XLSX: 'bg-green-100 text-green-700',
    XLS:  'bg-green-100 text-green-700',
    DOCX: 'bg-blue-100 text-blue-700',
    DOC:  'bg-blue-100 text-blue-700',
  };
  return { ext, className: map[ext] ?? 'bg-gray-100 text-gray-500' };
}

// ── PAGE ─────────────────────────────────────────────────────────────────────

export default function DocumentVaultPage() {
  const { currentUser } = useUserSession();

  // ── data ──
  const [folders,  setFolders]  = useState<DecoratedFolder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [fetchErr, setFetchErr] = useState('');

  // ── unlock state (session-only) ──
  const [unlockedIds,  setUnlockedIds]  = useState<Set<string>>(new Set());
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set());

  // ── password modal ──
  const [modalTarget,    setModalTarget]    = useState<DecoratedFolder | null>(null);
  const [passwordInput,  setPasswordInput]  = useState('');
  const [showPassword,   setShowPassword]   = useState(false);
  const [passwordError,  setPasswordError]  = useState('');
  const [shakeModal,     setShakeModal]     = useState(false);
  const [attempts,       setAttempts]       = useState<Record<string, number>>({});

  const [searchTerm, setSearchTerm] = useState('');

  const passwordInputRef = useRef<HTMLInputElement>(null);

  const hasAccess  = canAccessBOCDocuments(currentUser.jobRole);
  const canDownload = canDownloadDocuments(currentUser.jobRole);

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

  // auto-focus password field when modal opens
  useEffect(() => {
    if (modalTarget) {
      setTimeout(() => passwordInputRef.current?.focus(), 80);
      setPasswordInput('');
      setPasswordError('');
      setShowPassword(false);
    }
  }, [modalTarget]);

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

  function handleFolderClick(folder: DecoratedFolder) {
    if (unlockedIds.has(folder.id)) {
      setExpandedIds(prev => {
        const next = new Set(prev);
        next.has(folder.id) ? next.delete(folder.id) : next.add(folder.id);
        return next;
      });
    } else {
      setModalTarget(folder);
    }
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modalTarget) return;

    if (passwordInput === modalTarget.password) {
      setUnlockedIds(prev => new Set([...prev, modalTarget.id]));
      setExpandedIds(prev => new Set([...prev, modalTarget.id]));
      setModalTarget(null);
    } else {
      const next = (attempts[modalTarget.id] ?? 0) + 1;
      setAttempts(prev => ({ ...prev, [modalTarget.id]: next }));
      setPasswordError(`Incorrect vault password.${next >= 3 ? ` ${next} failed attempts recorded.` : ' Please try again.'}`);
      setShakeModal(true);
      setTimeout(() => setShakeModal(false), 500);
    }
  }

  function handleLockFolder(folderId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setUnlockedIds(prev => { const n = new Set(prev); n.delete(folderId); return n; });
    setExpandedIds(prev => { const n = new Set(prev); n.delete(folderId); return n; });
  }

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
            {unlockedIds.size} / {folders.length} Unlocked
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

          {/* FOLDER LIST */}
          {!loading && !fetchErr && filteredFolders.length > 0 && (
            <div className="space-y-3">
              {filteredFolders.map(folder => {
                const isUnlocked   = unlockedIds.has(folder.id);
                const isExpanded   = expandedIds.has(folder.id);
                const ship         = folder.shipment;
                const statusCfg    = ship ? STATUS_CONFIG[ship.status] : null;
                const failedCount  = attempts[folder.id] ?? 0;

                return (
                  <div
                    key={folder.id}
                    className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-colors ${
                      isUnlocked ? 'border-ocean-400/50' : 'border-sand-200 hover:border-maritime-200'
                    }`}
                  >
                    {/* FOLDER HEADER */}
                    <button
                      onClick={() => handleFolderClick(folder)}
                      className="w-full text-left p-4 md:p-5 flex items-center gap-4 group"
                    >
                      {/* ICON */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isUnlocked
                          ? 'bg-ocean-50 text-ocean-400'
                          : 'bg-sand-100 text-gray-400 group-hover:bg-maritime-50 group-hover:text-maritime-400'
                      }`}>
                        {isUnlocked ? <FolderOpen className="w-6 h-6" /> : <FolderLock className="w-6 h-6" />}
                      </div>

                      {/* INFO */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-maritime-900 text-sm font-mono tracking-tight">
                            {folder.folderName}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 bg-sand-100 px-1.5 py-0.5 rounded">
                            {folder.referenceCode}
                          </span>
                          {statusCfg && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusCfg.className}`}>
                              {statusCfg.label}
                            </span>
                          )}
                          {ship && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              ship.shipmentScope === 'OVERSEAS'
                                ? 'bg-maritime-50 text-maritime-400'
                                : 'bg-ocean-50 text-ocean-600'
                            }`}>
                              {ship.shipmentScope}
                            </span>
                          )}
                        </div>

                        {ship && (
                          <p className="text-xs font-semibold text-gray-700 truncate">{ship.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400 font-medium">
                          {ship && (
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {ship.originCountry} → {ship.destinationPort}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {folder.documents.length} document{folder.documents.length !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Created {timeAgo(folder.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* RIGHT: LOCK STATUS */}
                      <div className="flex items-center gap-3 shrink-0">
                        {!isUnlocked && failedCount > 0 && (
                          <span className="hidden sm:block text-[9px] text-red-400 font-bold">
                            {failedCount} failed attempt{failedCount > 1 ? 's' : ''}
                          </span>
                        )}

                        {isUnlocked ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-[10px] text-ocean-600 font-bold bg-ocean-50 border border-ocean-100 px-2 py-1 rounded">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Unlocked
                            </div>
                            <button
                              onClick={e => handleLockFolder(folder.id, e)}
                              className="p-1.5 rounded-lg border border-sand-200 text-gray-400 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-colors"
                              title="Re-lock this folder"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-gray-300" />
                              : <ChevronRight className="w-4 h-4 text-gray-300" />
                            }
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-maritime-400 border border-maritime-100 bg-maritime-50 px-3 py-1.5 rounded-lg">
                            <Lock className="w-3.5 h-3.5" /> Enter Password
                          </div>
                        )}
                      </div>
                    </button>

                    {/* DOCUMENT LIST */}
                    {isUnlocked && isExpanded && (
                      <div className="border-t border-ocean-100 bg-ocean-50/40 divide-y divide-sand-100">
                        {folder.documents.length === 0 ? (
                          <div className="px-5 py-8 text-center text-xs text-gray-400">
                            No documents uploaded to this folder yet.
                          </div>
                        ) : (
                          folder.documents.map(doc => {
                            const { ext, className: extClass } = fileExtBadge(doc.fileName);
                            return (
                              <div key={doc.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-lg bg-white border border-sand-200 flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4 text-gray-400" />
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="text-xs font-bold text-maritime-900 truncate max-w-xs">{doc.fileName}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                                      <span className={`px-1.5 py-0.5 rounded font-bold font-mono ${extClass}`}>{ext}</span>
                                      <span>v{doc.version}</span>
                                      {doc.version > 1 && (
                                        <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black uppercase text-[9px]">Amended</span>
                                      )}
                                      <span className="text-gray-300">·</span>
                                      <span>Uploaded {timeAgo(doc.createdAt)}</span>
                                    </div>
                                  </div>
                                </div>
                                {canDownload && (
                                  <a
                                    href={doc.fileUrl}
                                    download
                                    className="flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-sand-50 border border-sand-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                                  >
                                    <Download className="w-3.5 h-3.5 text-gray-400" />
                                    Download
                                  </a>
                                )}
                              </div>
                            );
                          })
                        )}

                        {/* FOLDER FOOTER */}
                        <div className="px-5 py-3 bg-ocean-50/60 border-t border-ocean-100 flex items-center justify-between">
                          <span className="text-[10px] text-ocean-600 font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Vault session active — re-locks on page leave
                          </span>
                          <button
                            onClick={e => handleLockFolder(folder.id, e)}
                            className="text-[10px] text-gray-400 hover:text-red-400 font-bold flex items-center gap-1 transition-colors"
                          >
                            <Lock className="w-3 h-3" /> Lock Folder
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ACCESS MATRIX */}
          <div className="bg-white border border-sand-200 rounded-2xl p-5 space-y-4 mt-2">
            <h3 className="font-extrabold text-xs text-maritime-900 flex items-center gap-1.5 border-b border-sand-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-ocean-400" /> Vault Access Matrix
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
              {[
                { role: 'Importer / Exporter',       canSee: true,  canUnlock: true,  canDownload: true  },
                { role: 'Customs Broker',             canSee: true,  canUnlock: true,  canDownload: true  },
                { role: 'Freight Forwarder',          canSee: false, canUnlock: false, canDownload: false },
                { role: 'Shipping Line Captain',      canSee: false, canUnlock: false, canDownload: false },
                { role: 'Warehouse Operator',         canSee: false, canUnlock: false, canDownload: false },
                { role: 'Port Authority Officer',     canSee: false, canUnlock: false, canDownload: false },
                { role: 'Trucker',                    canSee: false, canUnlock: false, canDownload: false },
              ].map(r => (
                <div key={r.role} className="border border-sand-100 rounded-lg p-2.5 space-y-1">
                  <span className="font-bold text-maritime-900 block">{r.role}</span>
                  <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
                    <span className={r.canSee      ? 'text-ocean-600' : 'text-red-400'}>{r.canSee      ? '✓' : '✕'} View</span>
                    <span className={r.canUnlock   ? 'text-ocean-600' : 'text-red-400'}>{r.canUnlock   ? '✓' : '✕'} Unlock</span>
                    <span className={r.canDownload ? 'text-ocean-600' : 'text-red-400'}>{r.canDownload ? '✓' : '✕'} Download</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD MODAL */}
      {modalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* BACKDROP */}
          <div
            className="absolute inset-0 bg-maritime-900/60 backdrop-blur-sm"
            onClick={() => setModalTarget(null)}
          />

          {/* CARD */}
          <div
            className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-transform ${shakeModal ? 'animate-shake' : ''}`}
            style={shakeModal ? { animation: 'shake 0.4s ease' } : {}}
          >
            {/* MODAL HEADER */}
            <div className="bg-maritime-900 px-6 pt-6 pb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-maritime-700 rounded-xl flex items-center justify-center">
                    <FolderLock className="w-5 h-5 text-maritime-200" />
                  </div>
                  <div>
                    <h2 className="font-black text-white text-sm">Vault Authorization</h2>
                    <p className="text-[10px] text-maritime-200 font-mono">{modalTarget.referenceCode}</p>
                  </div>
                </div>
                <button
                  onClick={() => setModalTarget(null)}
                  className="text-maritime-400 hover:text-white p-1 rounded transition-colors mt-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* FOLDER SUMMARY */}
              <div className="mt-4 bg-maritime-800/60 rounded-xl p-3 space-y-1.5 text-xs">
                <p className="text-white font-black font-mono truncate">{modalTarget.folderName}</p>
                {modalTarget.shipment && (
                  <>
                    <p className="text-maritime-200 font-semibold truncate">{modalTarget.shipment.description}</p>
                    <div className="flex items-center gap-3 text-maritime-300 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {modalTarget.shipment.originCountry} → {modalTarget.shipment.destinationPort}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {modalTarget.documents.length} doc{modalTarget.documents.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* MODAL BODY */}
            <form onSubmit={handlePasswordSubmit} className="px-6 py-5 space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-maritime-50 border-2 border-maritime-100 rounded-full flex items-center justify-center mx-auto">
                  <Key className="w-5 h-5 text-maritime-400" />
                </div>
                <p className="text-xs text-gray-500 pt-1">
                  Enter the vault password to access documents in this shipment folder.
                  Passwords are set by the shipment owner at creation time.
                </p>
              </div>

              {/* PASSWORD FIELD */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-maritime-900 block">Vault Password</label>
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
                    placeholder="Enter folder password…"
                    className={`w-full border rounded-xl px-4 py-3 pr-10 text-sm outline-none font-mono tracking-widest transition-colors ${
                      passwordError
                        ? 'border-red-400 bg-red-50 text-red-700 placeholder:text-red-300'
                        : 'border-sand-200 bg-sand-50 focus:border-maritime-400 text-maritime-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {passwordError && (
                  <div className="flex items-center gap-1.5 text-[11px] text-red-500 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {passwordError}
                  </div>
                )}
              </div>

              {/* ACTIONS */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setModalTarget(null)}
                  className="flex-1 border border-sand-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm hover:bg-sand-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!passwordInput.trim()}
                  className="flex-1 bg-maritime-400 hover:bg-maritime-700 disabled:bg-maritime-100 disabled:text-maritime-300 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Unlock className="w-4 h-4" /> Unlock Folder
                </button>
              </div>

              <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                All vault access attempts are logged for compliance. Unauthorized access violates
                BOC Article II data security protocols.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* shake keyframe (injected inline) */}
      <style jsx global>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-5px); }
          80%      { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.4s ease; }
      `}</style>
    </DashboardLayout>
  );
}
