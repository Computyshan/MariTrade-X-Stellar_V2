'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
import {
  FolderLock,
  FolderOpen,
  FileText,
  Lock,
  Unlock,
  Download,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Clock,
  Key,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  Upload,
  X,
  Paperclip,
} from 'lucide-react';
import { ShipmentDocument, ShipmentScope, ShipmentStatus } from '@/types';
import { canAccessBOCDocuments, canDownloadDocuments, canUploadDocuments } from '@/lib/permissions/documents';
import { motion } from 'motion/react';

// ── STATUS CONFIG ────────────────────────────────────────────────────────────

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

// ── DATA SHAPE (API-returned, password always stripped) ──────────────────────

interface FolderDetail {
  id: string;
  shipmentId: string;
  referenceCode: string;
  folderName: string;
  createdByUserId: string;
  createdAt: string;
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

// ── HELPERS ──────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
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

type PageParams = { folderId: string };

export default function VaultFolderPage({ params }: { params: Promise<PageParams> }) {
  const { folderId } = use(params);
  const router = useRouter();
  const { currentUser } = useUserSession();

  // ── API state ──
  const [folder,   setFolder]   = useState<FolderDetail | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [fetchErr, setFetchErr] = useState('');

  // ── Upload state ──
  const [uploadFile,     setUploadFile]     = useState<File | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState('');
  const [uploadSuccess,  setUploadSuccess]  = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auth state ──
  const [unlocked,       setUnlocked]       = useState(false);
  const [passwordInput,  setPasswordInput]  = useState('');
  const [showPassword,   setShowPassword]   = useState(false);
  const [passwordError,  setPasswordError]  = useState('');
  const [verifying,      setVerifying]      = useState(false);
  const [shakeForm,      setShakeForm]      = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch folder from API ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      setFetchErr('');
      try {
        const res  = await authFetch(`/api/vault/folders/${folderId}`);
        const json = await res.json();
        if (json.success) {
          setFolder(json.data);
        } else {
          setFetchErr(json.error ?? 'Folder not found.');
        }
      } catch {
        setFetchErr('Network error — could not reach the server.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [folderId]);

  // Auto-focus the password field when the lock screen appears
  useEffect(() => {
    if (!unlocked && !loading && folder) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [unlocked, loading, folder]);

  // ── SESSION STILL LOADING ─────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-gray-400 text-xs gap-2">
          <Clock className="w-4 h-4 animate-pulse" />
          Loading your session…
        </div>
      </DashboardLayout>
    );
  }

  const hasAccess   = canAccessBOCDocuments(currentUser.jobRole);
  const canDownload = canDownloadDocuments(currentUser.jobRole);
  const canUpload   = canUploadDocuments(currentUser.jobRole);

  // ── Upload handler ──
  async function handleUpload() {
    if (!uploadFile || uploading) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const res  = await authFetch(`/api/vault/folders/${folderId}/documents`, {
        method: 'POST',
        body:   fd,
      });
      const json = await res.json();
      if (json.success) {
        setUploadSuccess(`"${uploadFile.name}" uploaded successfully.`);
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        // Refresh folder data so the new doc appears in the list
        const refreshRes  = await authFetch(`/api/vault/folders/${folderId}`);
        const refreshJson = await refreshRes.json();
        if (refreshJson.success) setFolder(refreshJson.data);
      } else {
        setUploadError(json.error ?? 'Upload failed.');
      }
    } catch {
      setUploadError('Network error — upload failed.');
    } finally {
      setUploading(false);
    }
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-gray-400 text-xs gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-maritime-400" />
          Loading vault folder…
        </div>
      </DashboardLayout>
    );
  }

  // ── FETCH ERROR / NOT FOUND ───────────────────────────────────────────────
  if (fetchErr || !folder) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <button
            onClick={() => router.push('/documents')}
            className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to BOC Document Vault
          </button>
          <div className="bg-white border border-sand-200 p-8 rounded-2xl text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-coral-400 mx-auto" />
            <h2 className="text-lg font-bold text-maritime-900">Vault Folder Not Found</h2>
            <p className="text-xs text-gray-500">
              {fetchErr || `No BOC vault folder found with ID: `}
              {!fetchErr && <code className="font-mono bg-sand-100 px-1 rounded">{folderId}</code>}
            </p>
            <button
              onClick={() => router.push('/documents')}
              className="bg-maritime-400 text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              Back to Document Vault
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── NO ROLE ACCESS ────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <button
            onClick={() => router.push('/documents')}
            className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to BOC Document Vault
          </button>
          <div className="bg-red-50 border border-red-200 p-10 rounded-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="font-extrabold text-base text-red-950">BOC Vault — Access Restricted</h3>
            <p className="text-xs text-red-700 max-w-sm mx-auto leading-relaxed">
              Your active profile (<strong className="uppercase">{currentUser.jobRole}</strong>) does not have
              clearance to access the Bureau of Customs Document Vault.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const statusCfg = folder.shipment ? STATUS_CONFIG[folder.shipment.status] : null;

  // ── SERVER-SIDE PASSWORD VERIFICATION ────────────────────────────────────
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordInput.trim() || verifying) return;

    setVerifying(true);
    setPasswordError('');
    try {
      const res  = await authFetch(`/api/vault/folders/${folderId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'verify_password', password: passwordInput }),
      });
      const json = await res.json();

      if (json.success) {
        setUnlocked(true);
        setPasswordError('');
      } else {
        const next = failedAttempts + 1;
        setFailedAttempts(next);
        setPasswordError(
          `Incorrect vault password.${next >= 3 ? ` ${next} failed attempts recorded.` : ' Please try again.'}`
        );
        setShakeForm(true);
        setTimeout(() => setShakeForm(false), 500);
      }
    } catch {
      setPasswordError('Network error — please try again.');
    } finally {
      setVerifying(false);
    }
  }

  // ── PASSWORD GATE ─────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <DashboardLayout>
        <div className="space-y-4 max-w-lg mx-auto">
          <button
            onClick={() => router.push('/documents')}
            className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to BOC Document Vault
          </button>

          <motion.div
            animate={{ x: shakeForm ? [0, -8, 8, -6, 6, -3, 3, 0] : 0 }}
            transition={shakeForm ? { duration: 0.4 } : {}}
            className="bg-white border border-sand-200 rounded-2xl shadow-sm overflow-hidden"
          >
            {/* Header */}
            <div className="bg-maritime-900 px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-maritime-700 rounded-xl flex items-center justify-center">
                  <FolderLock className="w-5 h-5 text-maritime-200" />
                </div>
                <div>
                  <h1 className="font-black text-white text-base">Vault Authorization</h1>
                  <p className="text-[10px] text-maritime-200 font-mono">{folder.referenceCode}</p>
                </div>
              </div>

              {/* Folder summary */}
              <div className="bg-maritime-800/60 rounded-xl p-3 space-y-1.5 text-xs">
                <p className="text-white font-semibold">{folder.folderName}</p>
                {folder.shipment && (
                  <div className="flex flex-wrap items-center gap-3 text-maritime-300 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {folder.shipment.originCountry} → {folder.shipment.destinationPort}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {folder.documents.length} document{folder.documents.length !== 1 ? 's' : ''}
                    </span>
                    {statusCfg && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handlePasswordSubmit} className="px-6 py-6 space-y-5">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-maritime-50 border-2 border-maritime-100 rounded-full flex items-center justify-center mx-auto">
                  <Key className="w-6 h-6 text-maritime-400" />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
                  Enter the vault password to access documents in this shipment folder.
                  Passwords are set by the shipment owner at creation time.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-maritime-900 block">Vault Password</label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
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

                {passwordError && (
                  <div className="flex items-center gap-1.5 text-[11px] text-coral-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {passwordError}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/documents')}
                  className="flex-1 border border-sand-200 text-gray-600 font-bold py-2.5 rounded-xl text-sm hover:bg-sand-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!passwordInput.trim() || verifying}
                  className="flex-1 bg-maritime-400 hover:bg-maritime-700 disabled:bg-maritime-100 disabled:text-maritime-300 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {verifying
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Verifying…</>
                    : <><Unlock className="w-4 h-4" /> Unlock Folder</>
                  }
                </button>
              </div>

              <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                All vault access attempts are logged for compliance. Unauthorized access violates BOC Article II data
                security protocols.
              </p>
            </form>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  // ── UNLOCKED — DOCUMENT LIST ──────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <button
              onClick={() => router.push('/documents')}
              className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to BOC Document Vault
            </button>
            <h1 className="text-2xl sm:text-3xl font-black text-maritime-900 tracking-tight font-mono break-words">{folder.referenceCode}</h1>
            <p className="text-xs text-gray-500 font-semibold">{folder.folderName}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
            {statusCfg && folder.shipment && (
              <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${statusCfg.className}`}>
                {statusCfg.label}
              </span>
            )}
            {folder.shipment && (
              <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                folder.shipment.shipmentScope === 'OVERSEAS'
                  ? 'bg-maritime-50 text-maritime-400'
                  : 'bg-ocean-50 text-ocean-600'
              }`}>
                {folder.shipment.shipmentScope}
              </span>
            )}
            <div className="flex items-center gap-1.5 bg-ocean-50 border border-ocean-100 text-ocean-600 font-bold px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Vault Unlocked</span>
            </div>
            <button
              onClick={() => setUnlocked(false)}
              className="flex items-center gap-1 border border-sand-200 text-gray-400 hover:text-coral-400 hover:border-coral-200 hover:bg-coral-50 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
            >
              <Lock className="w-3 h-3" />
              Lock
            </button>
          </div>
        </div>

        {/* Folder meta strip */}
        {folder.shipment && (
          <div className="bg-white border border-sand-200 rounded-2xl p-4 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-gray-400" />
              <strong className="text-gray-700">{folder.shipment.originCountry}</strong> →{' '}
              <strong className="text-gray-700">{folder.shipment.destinationPort}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              {folder.documents.length} document{folder.documents.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              Created {timeAgo(folder.createdAt)}
            </span>
          </div>
        )}

        {/* Security notice */}
        <div className="bg-ocean-50 border border-ocean-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-ocean-700">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-ocean-400" />
          <span>
            Vault session active — this folder will lock automatically when you navigate away or click Lock.
          </span>
        </div>

        {/* Upload section */}
        {canUpload && (
          <div className="bg-white border border-sand-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-maritime-400" />
              <h2 className="text-sm font-black text-maritime-900">Upload Document</h2>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) { setUploadFile(f); setUploadError(''); setUploadSuccess(''); }
              }}
              className="border-2 border-dashed border-sand-300 hover:border-maritime-300 hover:bg-maritime-50/30 rounded-xl p-8 text-center cursor-pointer transition-colors"
            >
              <Paperclip className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-500">
                {uploadFile ? uploadFile.name : 'Click or drag & drop a file here'}
              </p>
              {uploadFile && (
                <p className="text-[10px] text-gray-400 mt-1">
                  {(uploadFile.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                setUploadFile(f);
                setUploadError('');
                setUploadSuccess('');
              }}
            />

            {uploadError && (
              <div className="flex items-center gap-2 text-[11px] text-coral-500 bg-coral-50 border border-coral-100 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div className="flex items-center gap-2 text-[11px] text-ocean-700 bg-ocean-50 border border-ocean-100 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {uploadSuccess}
              </div>
            )}

            <div className="flex gap-3">
              {uploadFile && (
                <button
                  onClick={() => { setUploadFile(null); setUploadError(''); setUploadSuccess(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="flex items-center gap-1.5 text-xs border border-sand-200 text-gray-500 hover:border-coral-200 hover:text-coral-400 px-3 py-2 rounded-xl transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="flex-1 flex items-center justify-center gap-2 bg-maritime-400 hover:bg-maritime-700 disabled:bg-maritime-100 disabled:text-maritime-300 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                {uploading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading…</>
                  : <><Upload className="w-4 h-4" /> Upload to Vault</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Document list */}
        {folder.documents.length === 0 ? (
          <div className="text-center py-16 bg-white border border-sand-200 rounded-2xl text-gray-400 text-xs font-mono">
            NO ENCRYPTED CARGO FILES IN THIS VAULT FOLDER YET.
          </div>
        ) : (
          <div className="bg-white border border-sand-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="divide-y divide-sand-100">
              {folder.documents.map((doc) => {
                const { ext, className: extClass } = fileExtBadge(doc.fileName);
                return (
                  <div key={doc.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-sand-50 border border-sand-200 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-bold text-maritime-900 truncate max-w-sm">{doc.fileName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                          <span className={`px-1.5 py-0.5 rounded font-bold font-mono ${extClass}`}>{ext}</span>
                          <span>v{doc.version}</span>
                          {doc.version > 1 && (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black uppercase text-[9px]">
                              Amended
                            </span>
                          )}
                          <span className="text-gray-300">•</span>
                          <span>Uploaded {timeAgo(doc.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {canDownload && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-sand-50 border border-sand-200 text-gray-600 px-3 py-2 rounded-xl transition-colors shrink-0"
                      >
                        <Download className="w-3.5 h-3.5 text-gray-400" />
                        Download
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-ocean-50/60 border-t border-ocean-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-ocean-600 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {folder.documents.length} file{folder.documents.length !== 1 ? 's' : ''} — Vault session active
              </span>
              <button
                onClick={() => setUnlocked(false)}
                className="text-[10px] text-gray-400 hover:text-coral-400 font-bold flex items-center gap-1 transition-colors"
              >
                <Lock className="w-3 h-3" />
                Lock Folder
              </button>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
