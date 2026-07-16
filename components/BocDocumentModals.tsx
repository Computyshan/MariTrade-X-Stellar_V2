'use client';

import React from 'react';
import { Lock, Upload, AlertTriangle, FileText, RefreshCw } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
//  BOC AUTHORIZATION GATE MODAL
// ═══════════════════════════════════════════════════════════════════════════

export function BocAuthDeniedModal({ open, onClose, jobRole }: { open: boolean; onClose: () => void; jobRole: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-mist rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-wine-light rounded-xl flex items-center justify-center shrink-0"><Lock className="w-5 h-5 text-wine" /></div>
          <div>
            <h3 className="font-extrabold text-sm text-ink">BOC Vault Access Denied</h3>
            <p className="text-[10px] text-ink-faint font-sans uppercase">{jobRole}</p>
          </div>
        </div>
        <p className="text-xs text-ink-faint leading-relaxed">
          Your current role (<strong className="uppercase text-ink">{jobRole}</strong>) does not have clearance to access the Bureau of Customs Document Vault. Only Trade Party members and Customs Brokers may upload or view vault documents.
        </p>
        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 bg-amber hover:bg-ink text-white rounded-lg font-bold text-xs transition-all">Understood</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  UPLOAD DOCUMENT MODAL
// ═══════════════════════════════════════════════════════════════════════════

interface BocUploadModalProps {
  open: boolean;
  onClose: () => void;
  referenceCode: string;
  uploadFile: File | null;
  uploading: boolean;
  uploadError: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function BocUploadModal({
  open, onClose, referenceCode, uploadFile, uploading, uploadError, fileInputRef, onFileChange, onSubmit,
}: BocUploadModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-mist rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-light rounded-xl flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-amber" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-ink">Upload BOC Document</h3>
            <p className="text-[10px] text-ink-faint font-sans uppercase">{referenceCode}</p>
          </div>
        </div>

        {uploadError && (
          <div className="bg-wine-light border border-wine/20 text-wine text-xs p-2.5 rounded-lg flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{uploadError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) onFileChange(f);
            }}
            className="border-2 border-dashed border-mist-dark hover:border-amber-light hover:bg-amber-light/30 rounded-xl p-6 text-center cursor-pointer transition-colors space-y-2"
          >
            <FileText className="w-8 h-8 text-mist-dark mx-auto" />
            <p className="text-xs font-semibold text-ink-faint">
              {uploadFile ? uploadFile.name : 'Click or drag & drop a file here'}
            </p>
            {uploadFile && <p className="text-[10px] text-ink-faint">{(uploadFile.size / 1024).toFixed(1)} KB</p>}
            <p className="text-[10px] text-ink-faint">PDF, JPG or PNG · Max 50MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={e => onFileChange(e.target.files?.[0] ?? null)}
          />
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold"
              onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={uploading || !uploadFile}
              className="px-4 py-1.5 bg-amber hover:bg-ink text-white rounded-lg font-black disabled:opacity-50 flex items-center gap-1.5">
              {uploading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading…</> : <><Upload className="w-3.5 h-3.5" /> Upload</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
