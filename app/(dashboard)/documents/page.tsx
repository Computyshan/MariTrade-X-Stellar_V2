'use client';

import React, { useState, useRef, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import {
  FolderLock,
  FolderOpen,
  FileText,
  Lock,
  Unlock,
  Download,
  ShieldCheck,
  Search,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Ship,
  Globe,
  Clock,
  Key,
  Badge,
} from 'lucide-react';
import { ShipmentDocument, ShipmentScope, ShipmentStatus } from '@/types';
import { canAccessBOCDocuments, canDownloadDocuments } from '@/lib/permissions/documents';
import { motion, AnimatePresence } from 'motion/react';

// ── MOCK VAULT DATA ─────────────────────────────────────────────────────────────

interface VaultFolder {
  id: string;
  referenceCode: string;
  description: string;
  originCountry: string;
  destinationPort: string;
  scope: ShipmentScope;
  status: ShipmentStatus;
  vaultPassword: string; // in production: hashed + stored server-side
  documents: ShipmentDocument[];
  createdAt: string;
}

const MOCK_VAULT_FOLDERS: VaultFolder[] = [
  {
    id: 'folder-001',
    referenceCode: 'MT-2026-00001',
    description: 'Industrial Steel Coils & Fabricated Parts — Q1 Batch',
    originCountry: 'Japan',
    destinationPort: 'Manila South Harbor',
    scope: 'OVERSEAS',
    status: 'CUSTOMS_CLEARANCE',
    vaultPassword: 'TKY2026',
    createdAt: '2026-01-15T08:00:00Z',
    documents: [
      {
        id: 'doc-001-a',
        shipmentId: 'folder-001',
        fileName: 'BOC_Customs_Entry_Declaration_Signed.pdf',
        fileUrl: 'https://picsum.photos/seed/doc1a/800/600',
        version: 2,
        isLatest: true,
        uploadedById: 'charles-broker-id',
        createdAt: new Date(Date.now() - 36 * 3600000).toISOString(),
      },
      {
        id: 'doc-001-b',
        shipmentId: 'folder-001',
        fileName: 'Cargo_Manifest_Packing_List_Osaka.xlsx',
        fileUrl: 'https://picsum.photos/seed/doc1b/800/600',
        version: 1,
        isLatest: true,
        uploadedById: 'dav4d-exporter-id',
        createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
      },
      {
        id: 'doc-001-c',
        shipmentId: 'folder-001',
        fileName: 'Bill_of_Lading_Pacific_Ocean_Lines.pdf',
        fileUrl: 'https://picsum.photos/seed/doc1c/800/600',
        version: 1,
        isLatest: true,
        uploadedById: 'von-captain-id',
        createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
      },
      {
        id: 'doc-001-d',
        shipmentId: 'folder-001',
        fileName: 'Duties_Taxes_Official_Receipt_BOC.pdf',
        fileUrl: 'https://picsum.photos/seed/doc1d/800/600',
        version: 1,
        isLatest: true,
        uploadedById: 'charles-broker-id',
        createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      },
    ],
  },
  {
    id: 'folder-002',
    referenceCode: 'MT-2026-00002',
    description: 'Automotive Parts & Engine Components — Subic Batch',
    originCountry: 'South Korea',
    destinationPort: 'Subic Bay Freeport',
    scope: 'OVERSEAS',
    status: 'AT_PORT',
    vaultPassword: 'SEL2026',
    createdAt: '2026-02-03T10:30:00Z',
    documents: [
      {
        id: 'doc-002-a',
        shipmentId: 'folder-002',
        fileName: 'Subic_Dry_Harbour_Gated_Release_Permit.pdf',
        fileUrl: 'https://picsum.photos/seed/doc2a/800/600',
        version: 1,
        isLatest: true,
        uploadedById: 'jed-port-id',
        createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      },
      {
        id: 'doc-002-b',
        shipmentId: 'folder-002',
        fileName: 'Commercial_Invoice_Hyundai_Parts_USD.pdf',
        fileUrl: 'https://picsum.photos/seed/doc2b/800/600',
        version: 1,
        isLatest: true,
        uploadedById: 'shaun-importer-id',
        createdAt: new Date(Date.now() - 96 * 3600000).toISOString(),
      },
    ],
  },
  {
    id: 'folder-003',
    referenceCode: 'MT-2026-00003',
    description: 'Fresh Produce — Nationwide Cold Chain (Davao-Cebu)',
    originCountry: 'Philippines',
    destinationPort: 'Cebu Baseport',
    scope: 'NATIONWIDE',
    status: 'IN_TRANSIT',
    vaultPassword: 'DAV2026',
    createdAt: '2026-02-20T14:00:00Z',
    documents: [
      {
        id: 'doc-003-a',
        shipmentId: 'folder-003',
        fileName: 'Phytosanitary_Certificate_DA_Davao.pdf',
        fileUrl: 'https://picsum.photos/seed/doc3a/800/600',
        version: 1,
        isLatest: true,
        uploadedById: 'shaun-importer-id',
        createdAt: new Date(Date.now() - 18 * 3600000).toISOString(),
      },
      {
        id: 'doc-003-b',
        shipmentId: 'folder-003',
        fileName: 'Trucking_Waybill_Manila_Heavy_Movers.pdf',
        fileUrl: 'https://picsum.photos/seed/doc3b/800/600',
        version: 1,
        isLatest: true,
        uploadedById: 'reginald-trucker-id',
        createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
      },
      {
        id: 'doc-003-c',
        shipmentId: 'folder-003',
        fileName: 'Delivery_Receipt_Cold_Chain_Manifest.xlsx',
        fileUrl: 'https://picsum.photos/seed/doc3c/800/600',
        version: 2,
        isLatest: true,
        uploadedById: 'quinn-warehouse-id',
        createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
    ],
  },
];

// ── STATUS BADGE CONFIG ─────────────────────────────────────────────────────────

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
  DISPUTED:          { label: 'Disputed',           className: 'bg-coral-50 text-coral-400' },
  CANCELLED:         { label: 'Cancelled',          className: 'bg-gray-100 text-gray-500' },
};

// ── HELPERS ─────────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fileExtBadge(fileName: string) {
  const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
  const map: Record<string, string> = {
    PDF: 'bg-red-100 text-red-600',
    XLSX: 'bg-green-100 text-green-700',
    XLS: 'bg-green-100 text-green-700',
    DOCX: 'bg-blue-100 text-blue-700',
    DOC: 'bg-blue-100 text-blue-700',
  };
  return { ext, className: map[ext] ?? 'bg-gray-100 text-gray-500' };
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────────

export default function DocumentVaultPage() {
  const { currentUser } = useUserSession();

  // which folders have been unlocked this session: Set<folder.id>
  const [unlockedFolders, setUnlockedFolders] = useState<Set<string>>(new Set());
  // which unlocked folders are expanded (showing doc list)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // password modal state
  const [modalTarget, setModalTarget] = useState<VaultFolder | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [shakeModal, setShakeModal] = useState(false);
  const [attempts, setAttempts] = useState<Record<string, number>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const hasAccess = canAccessBOCDocuments(currentUser.jobRole);
  const canDownload = canDownloadDocuments(currentUser.jobRole);

  // auto-focus input when modal opens
  useEffect(() => {
    if (modalTarget) {
      setTimeout(() => passwordInputRef.current?.focus(), 80);
      setPasswordInput('');
      setPasswordError('');
      setShowPassword(false);
    }
  }, [modalTarget]);

  const filteredFolders = MOCK_VAULT_FOLDERS.filter((f) =>
    f.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.originCountry.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.destinationPort.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── HANDLERS ──

  function handleFolderClick(folder: VaultFolder) {
    if (unlockedFolders.has(folder.id)) {
      // toggle expand
      setExpandedFolders((prev) => {
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

    if (passwordInput === modalTarget.vaultPassword) {
      // correct
      setUnlockedFolders((prev) => new Set([...prev, modalTarget.id]));
      setExpandedFolders((prev) => new Set([...prev, modalTarget.id]));
      setModalTarget(null);
      setPasswordInput('');
    } else {
      // wrong
      const next = (attempts[modalTarget.id] ?? 0) + 1;
      setAttempts((prev) => ({ ...prev, [modalTarget.id]: next }));
      setPasswordError(`Incorrect vault password. ${next >= 3 ? `${next} failed attempts recorded.` : 'Please try again.'}`);
      setShakeModal(true);
      setTimeout(() => setShakeModal(false), 500);
    }
  }

  function handleLockFolder(folderId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setUnlockedFolders((prev) => {
      const next = new Set(prev);
      next.delete(folderId);
      return next;
    });
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.delete(folderId);
      return next;
    });
  }

  // ── RENDER ──

  return (
    <DashboardLayout>
      {/* PAGE HEADER */}
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

        {/* vault access summary */}
        <div className="flex items-center gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 bg-white border border-sand-200 px-3 py-1.5 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${hasAccess ? 'bg-ocean-400' : 'bg-coral-400'}`} />
            <span className="font-semibold text-gray-700">
              {hasAccess ? 'Vault Access: Authorized' : 'Vault Access: Restricted'}
            </span>
          </div>
          <div className="bg-maritime-50 border border-maritime-100 text-maritime-700 font-bold px-3 py-1.5 rounded-lg">
            {unlockedFolders.size} / {MOCK_VAULT_FOLDERS.length} Unlocked
          </div>
        </div>
      </div>

      {/* ACCESS DENIED STATE */}
      {!hasAccess ? (
        <div className="bg-red-50 border border-red-200 p-10 rounded-2xl text-center space-y-4 mt-2">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="font-extrabold text-base text-red-950">BOC Vault — Access Restricted</h3>
          <p className="text-xs text-red-700 max-w-sm mx-auto leading-relaxed">
            Your active profile (<strong className="uppercase">{currentUser.jobRole}</strong>) does not have clearance to access the Bureau of Customs Document Vault. Only Trade Party members and Customs Brokers are authorized.
          </p>
          <div className="text-[11px] bg-white border border-sand-200 rounded-lg p-3 max-w-sm mx-auto text-gray-500 font-medium">
            💡 Switch to <strong>Charles Solomon (CUSTOMS_BROKER)</strong> or <strong>Tyshaun Louis (IMPORTER)</strong> via the toolbar above to access the vault.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* SEARCH BAR */}
          <div className="bg-white border border-sand-200 rounded-xl p-3 flex items-center gap-3">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search folders by reference, description, origin, or port..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* VAULT INSTRUCTION BANNER */}
          <div className="bg-maritime-50 border border-maritime-100 rounded-xl p-3 flex items-start gap-3 text-xs text-maritime-700">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-maritime-400" />
            <div>
              <strong className="font-bold">Folder Vault Security</strong> — All shipment folders below are visible to authorized users. Click any folder to enter its vault password and access the documents inside. Folders lock again when you re-lock or leave the session.
              <span className="block mt-0.5 text-maritime-400 font-semibold">Demo passwords are shown on each locked folder card for testing purposes.</span>
            </div>
          </div>

          {/* FOLDER GRID */}
          {filteredFolders.length === 0 ? (
            <div className="text-center py-16 bg-white border border-sand-200 rounded-xl text-gray-400 text-xs">
              No shipment folders match your search.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFolders.map((folder) => {
                const isUnlocked = unlockedFolders.has(folder.id);
                const isExpanded = expandedFolders.has(folder.id);
                const statusCfg = STATUS_CONFIG[folder.status];
                const failedAttempts = attempts[folder.id] ?? 0;

                return (
                  <motion.div
                    key={folder.id}
                    layout
                    className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-colors ${
                      isUnlocked
                        ? 'border-ocean-400/50 shadow-ocean-100'
                        : 'border-sand-200 hover:border-maritime-200'
                    }`}
                  >
                    {/* FOLDER HEADER — clickable */}
                    <button
                      onClick={() => handleFolderClick(folder)}
                      className="w-full text-left p-4 md:p-5 flex items-center gap-4 group"
                    >
                      {/* FOLDER ICON */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isUnlocked
                          ? 'bg-ocean-50 text-ocean-400'
                          : 'bg-sand-100 text-gray-400 group-hover:bg-maritime-50 group-hover:text-maritime-400'
                      }`}>
                        {isUnlocked
                          ? <FolderOpen className="w-6 h-6" />
                          : <FolderLock className="w-6 h-6" />
                        }
                      </div>

                      {/* FOLDER INFO */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-maritime-900 text-sm font-mono tracking-tight">{folder.referenceCode}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusCfg.className}`}>
                            {statusCfg.label}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            folder.scope === 'OVERSEAS'
                              ? 'bg-maritime-50 text-maritime-400'
                              : 'bg-ocean-50 text-ocean-600'
                          }`}>
                            {folder.scope}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 truncate">{folder.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400 font-medium">
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {folder.originCountry} → {folder.destinationPort}
                          </span>
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

                      {/* RIGHT: LOCK STATUS + DEMO HINT */}
                      <div className="flex items-center gap-3 shrink-0">
                        {!isUnlocked && (
                          <div className="hidden sm:flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono bg-sand-50 border border-sand-200 px-2 py-1 rounded">
                              <Key className="w-3 h-3" />
                              <span>Demo: <strong className="text-maritime-400">{folder.vaultPassword}</strong></span>
                            </div>
                            {failedAttempts > 0 && (
                              <span className="text-[9px] text-coral-400 font-bold">{failedAttempts} failed attempt{failedAttempts > 1 ? 's' : ''}</span>
                            )}
                          </div>
                        )}

                        {isUnlocked ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-[10px] text-ocean-600 font-bold bg-ocean-50 border border-ocean-100 px-2 py-1 rounded">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Unlocked</span>
                            </div>
                            <button
                              onClick={(e) => handleLockFolder(folder.id, e)}
                              className="p-1.5 rounded-lg border border-sand-200 text-gray-400 hover:text-coral-400 hover:border-coral-200 hover:bg-coral-50 transition-colors"
                              title="Re-lock this folder"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                            <div className="text-gray-300">
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />
                              }
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-maritime-400 border border-maritime-100 bg-maritime-50 px-3 py-1.5 rounded-lg">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </button>

                    {/* DOCUMENT LIST — shown when unlocked & expanded */}
                    <AnimatePresence>
                      {isUnlocked && isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-ocean-100 bg-ocean-50/40 divide-y divide-sand-100">
                            {folder.documents.map((doc) => {
                              const { ext, className: extClass } = fileExtBadge(doc.fileName);
                              return (
                                <div key={doc.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {/* FILE ICON */}
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
                                        <span className="text-gray-300">•</span>
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
                            })}
                          </div>

                          {/* FOLDER FOOTER */}
                          <div className="px-5 py-3 bg-ocean-50/60 border-t border-ocean-100 flex items-center justify-between">
                            <span className="text-[10px] text-ocean-600 font-bold flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              Vault session active — will lock on page leave
                            </span>
                            <button
                              onClick={(e) => handleLockFolder(folder.id, e)}
                              className="text-[10px] text-gray-400 hover:text-coral-400 font-bold flex items-center gap-1 transition-colors"
                            >
                              <Lock className="w-3 h-3" />
                              Lock Folder
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ROLE PERMISSIONS PANEL */}
          <div className="bg-white border border-sand-200 rounded-2xl p-5 space-y-4 mt-2">
            <h3 className="font-extrabold text-xs text-maritime-900 flex items-center gap-1.5 border-b border-sand-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-ocean-400" />
              Vault Access Matrix
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
              {[
                { role: 'Importer / Exporter', canSee: true, canUnlock: true, canDownload: true },
                { role: 'Customs Broker', canSee: true, canUnlock: true, canDownload: true },
                { role: 'Freight Forwarder', canSee: false, canUnlock: false, canDownload: false },
                { role: 'Shipping Line Captain', canSee: false, canUnlock: false, canDownload: false },
                { role: 'Warehouse Operator', canSee: false, canUnlock: false, canDownload: false },
                { role: 'Port Authority Officer', canSee: false, canUnlock: false, canDownload: false },
                { role: 'Trucker', canSee: false, canUnlock: false, canDownload: false },
              ].map((r) => (
                <div key={r.role} className="border border-sand-100 rounded-lg p-2.5 space-y-1">
                  <span className="font-bold text-maritime-900 block">{r.role}</span>
                  <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
                    <span className={r.canSee ? 'text-ocean-600' : 'text-coral-400'}>
                      {r.canSee ? '✓' : '✕'} View
                    </span>
                    <span className={r.canUnlock ? 'text-ocean-600' : 'text-coral-400'}>
                      {r.canUnlock ? '✓' : '✕'} Unlock
                    </span>
                    <span className={r.canDownload ? 'text-ocean-600' : 'text-coral-400'}>
                      {r.canDownload ? '✓' : '✕'} Download
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD MODAL */}
      <AnimatePresence>
        {modalTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* BACKDROP */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-maritime-900/60 backdrop-blur-sm"
              onClick={() => setModalTarget(null)}
            />

            {/* MODAL CARD */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                x: shakeModal ? [0, -8, 8, -6, 6, -3, 3, 0] : 0,
              }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={shakeModal ? { x: { duration: 0.4 } } : { duration: 0.18 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
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

                {/* SHIPMENT SUMMARY */}
                <div className="mt-4 bg-maritime-800/60 rounded-xl p-3 space-y-1.5 text-xs">
                  <p className="text-white font-semibold truncate">{modalTarget.description}</p>
                  <div className="flex items-center gap-3 text-maritime-300 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {modalTarget.originCountry} → {modalTarget.destinationPort}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {modalTarget.documents.length} docs
                    </span>
                  </div>
                </div>
              </div>

              {/* MODAL BODY */}
              <form onSubmit={handlePasswordSubmit} className="px-6 py-5 space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 bg-maritime-50 border-2 border-maritime-100 rounded-full flex items-center justify-center mx-auto">
                    <Key className="w-5 h-5 text-maritime-400" />
                  </div>
                  <p className="text-xs text-gray-500 pt-1">
                    Enter the vault password to access documents in this shipment folder. Passwords are managed by the Trade Party.
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
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder="Enter folder password..."
                      className={`w-full border rounded-xl px-4 py-3 pr-10 text-sm outline-none font-mono tracking-widest transition-colors ${
                        passwordError
                          ? 'border-coral-400 bg-coral-50 text-coral-700 placeholder:text-coral-300'
                          : 'border-sand-200 bg-sand-50 focus:border-maritime-400 text-maritime-900'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* ERROR */}
                  {passwordError && (
                    <div className="flex items-center gap-1.5 text-[11px] text-coral-400 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {passwordError}
                    </div>
                  )}

                  {/* DEMO HINT */}
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 bg-sand-50 border border-sand-100 rounded-lg px-3 py-2 font-mono">
                    <Key className="w-3 h-3 text-maritime-400" />
                    Demo password for <strong className="text-maritime-400">{modalTarget.referenceCode}</strong>:{' '}
                    <strong className="text-ocean-600">{modalTarget.vaultPassword}</strong>
                  </div>
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
                    <Unlock className="w-4 h-4" />
                    Unlock Folder
                  </button>
                </div>

                {/* SECURITY NOTICE */}
                <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                  All vault access attempts are logged for compliance. Unauthorized access violates BOC Article II data security protocols.
                </p>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
