'use client';

import React, { useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
import {
  ChevronLeft,
  Ship,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Loader,
  Building2,
  Package,
  FileCheck,
  Hash,
  FileText,
  Camera,
} from 'lucide-react';
import {
  MilestoneType,
  JobRole,
  PHASE_MILESTONE_SEQUENCE,
  ROLE_MILESTONES,
  ShipmentPhase,
  MILESTONE_EVIDENCE_MODE,
  MILESTONE_EVIDENCE_REF_LABEL,
} from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_META: Record<JobRole, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  IMPORTER:           { label: 'Importer',          icon: Building2, color: 'text-gray-400',     bg: 'bg-gray-50',     border: 'border-gray-200'     },
  EXPORTER:           { label: 'Exporter',           icon: Building2, color: 'text-gray-400',     bg: 'bg-gray-50',     border: 'border-gray-200'     },
  FREIGHT_FORWARDER:  { label: 'Freight Forwarder',  icon: Ship,      color: 'text-maritime-400', bg: 'bg-maritime-50', border: 'border-maritime-200' },
  CUSTOMS_BROKER:     { label: 'Customs Broker',     icon: FileCheck, color: 'text-coral-400',    bg: 'bg-coral-50',    border: 'border-coral-200'    },
  WAREHOUSE_OPERATOR: { label: 'Warehouse Operator', icon: Package,   color: 'text-ocean-400',    bg: 'bg-ocean-50',    border: 'border-ocean-200'    },
};

const PHASE_LABELS: Record<ShipmentPhase, string> = {
  CARGO_PREPARATION:         '📦 Phase 1 — Cargo Preparation & Origin Warehouse',
  ORIGIN_PORT_EXPORT:        '⚓ Phase 2 — Origin Port & Export Clearance',
  OCEAN_TRANSIT_DESTINATION: '🌊 Phase 3 — Ocean Transit & Destination Port',
  LAST_MILE_DELIVERY:        '🚛 Phase 4 — Last-Mile Delivery & Final Receipt',
};

const MILESTONE_LABELS: Record<MilestoneType, string> = {
  BOOKING_CONFIRMED:               'Booking Confirmed',
  DOCUMENTS_SUBMITTED_TO_CARRIER:  'Documents Submitted to Carrier',
  SPACE_ON_VESSEL_SECURED:         'Space on Vessel Secured',
  CONTAINER_GATED_OUT_ORIGIN:      'Container Gated Out (Origin)',
  CONTAINER_LOADED_ON_VESSEL:      'Container Loaded on Vessel',
  VESSEL_CLEARED_TO_DEPART:        'Vessel Cleared to Depart',
  VESSEL_DEPARTED_ORIGIN:          'Vessel Departed Origin',
  BILL_OF_LADING_ISSUED:           'Bill of Lading Issued',
  VESSEL_ARRIVED_AT_BERTH:         'Vessel Arrived at Berth',
  VESSEL_ARRIVED_DESTINATION:      'Vessel Arrived at Destination',
  CONTAINER_OFFLOADED:             'Container Offloaded',
  CONTAINER_GATED_IN_DESTINATION:  'Container Gated In (Destination)',
  CARGO_RELEASED_FOR_PICKUP:       'Cargo Released for Pickup',
  IN_TRANSIT_TO_DESTINATION:       'In Transit to Destination',
  ARRIVED_AT_DELIVERY_ADDRESS:     'Arrived at Delivery Address',
  DELIVERED_AND_SIGNED_OFF:        'Delivered and Signed Off',
  BOC_ENTRY_FILED:                 'BOC Entry Filed',
  PORT_HOLD_PLACED_OR_LIFTED:      'Port Hold Placed or Lifted',
  DUTIES_AND_TAXES_PAID:           'Duties and Taxes Paid',
  CUSTOMS_EXAMINATION_REQUESTED:   'Customs Examination Requested',
  CUSTOMS_CLEARANCE_APPROVED:      'Customs Clearance Approved',
  CARGO_READY_FOR_COLLECTION:      'Cargo Ready for Collection',
  CARGO_INSPECTED_AND_PACKED:      'Cargo Inspected and Packed',
  CARGO_STAGED_FOR_PICKUP:         'Cargo Staged for Pickup',
  CARGO_HANDED_OFF_TO_CARRIER:     'Cargo Handed Off to Carrier',
  CARGO_PICKED_UP_FROM_PORT:       'Cargo Picked Up from Port',
  CARGO_RECEIVED_AT_WAREHOUSE:     'Cargo Received at Warehouse',
  INCOMING_CARGO_STORED:           'Incoming Cargo Stored',
  FAILED_DELIVERY_ATTEMPT:         'Failed Delivery Attempt',
};

// What document/photo to upload for each DOCUMENT or PHOTO_OR_NOTE milestone
const EVIDENCE_UPLOAD_HINT: Partial<Record<MilestoneType, string>> = {
  BILL_OF_LADING_ISSUED:       'Upload the Bill of Lading PDF',
  DUTIES_AND_TAXES_PAID:       'Upload the Official Receipt (OR)',
  CUSTOMS_CLEARANCE_APPROVED:  'Upload the CAO / Customs Release Certificate',
  ARRIVED_AT_DELIVERY_ADDRESS: 'Photo of arrival at address (optional)',
  DELIVERED_AND_SIGNED_OFF:    'Photo of signed delivery receipt (optional)',
  CARGO_INSPECTED_AND_PACKED:  'Inspection photo (optional)',
  CARGO_RECEIVED_AT_WAREHOUSE: 'Receiving photo or Goods Receipt note (optional)',
  FAILED_DELIVERY_ATTEMPT:     'Photo of failed attempt (optional but strongly recommended)',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LogMilestonePage({ params }: PageProps) {
  const { id: shipmentId } = use(params);
  const router = useRouter();
  const { currentUser, loading } = useUserSession();

  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneType | ''>('');
  const [description, setDescription]             = useState('');
  const [evidenceUrl, setEvidenceUrl]             = useState('');
  const [evidenceRef, setEvidenceRef]             = useState('');
  const [uploading, setUploading]                 = useState(false);
  const [uploadError, setUploadError]             = useState('');
  const [submitting, setSubmitting]               = useState(false);
  const [success, setSuccess]                     = useState(false);
  const [error, setError]                         = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-maritime-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const role              = currentUser.jobRole;
  const meta              = ROLE_META[role];
  const Icon              = meta.icon;
  const allowedMilestones = ROLE_MILESTONES[role];
  const canLog            = allowedMilestones.length > 0;

  const phases = (Object.keys(PHASE_MILESTONE_SEQUENCE) as ShipmentPhase[]).filter(phase =>
    PHASE_MILESTONE_SEQUENCE[phase].some(m => allowedMilestones.includes(m))
  );

  const evidenceMode = selectedMilestone ? MILESTONE_EVIDENCE_MODE[selectedMilestone] : null;

  // ── Milestone selection — resets evidence fields ──────────────────────────
  const handleMilestoneSelect = (m: MilestoneType) => {
    setSelectedMilestone(m);
    setEvidenceUrl('');
    setEvidenceRef('');
    setUploadError('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── File upload (DOCUMENT + PHOTO_OR_NOTE modes) ──────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await authFetch('/api/upload?bucket=milestone-evidence', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.success) {
        setEvidenceUrl(json.url);
      } else {
        setUploadError(json.error ?? 'Upload failed.');
      }
    } catch {
      setUploadError('Network error — upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestone) { setError('Please select a milestone.'); return; }

    // Client-side evidence validation per mode
    if (evidenceMode === 'REFERENCE_NUMBER' && !evidenceRef.trim()) {
      setError('Please enter a reference number.'); return;
    }
    if (evidenceMode === 'DOCUMENT' && !evidenceUrl) {
      setError('Please upload the required document.'); return;
    }
    if (evidenceMode === 'PHOTO_OR_NOTE' && !evidenceUrl && !description.trim()) {
      setError('Please upload a photo or add a written description.'); return;
    }

    setError('');
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/shipments/${shipmentId}/milestones`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loggedById:  currentUser.id,
          type:        selectedMilestone,
          description: description.trim() || undefined,
          evidenceUrl: evidenceUrl || undefined,
          evidenceRef: evidenceRef.trim() || undefined,
          occurredAt:  new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(true);
        setTimeout(() => router.push(`/shipments/${shipmentId}`), 1800);
      } else {
        setError(json.error || 'Failed to log milestone.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Is the submit button ready? ───────────────────────────────────────────
  const isReady = (() => {
    if (!selectedMilestone) return false;
    if (evidenceMode === 'REFERENCE_NUMBER') return evidenceRef.trim().length > 0;
    if (evidenceMode === 'DOCUMENT')         return evidenceUrl.length > 0;
    if (evidenceMode === 'PHOTO_OR_NOTE')    return evidenceUrl.length > 0 || description.trim().length > 0;
    return false;
  })();

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (!canLog) {
    return (
      <DashboardLayout>
        <div className="space-y-1 mb-6">
          <button onClick={() => router.push(`/shipments/${shipmentId}`)}
            className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-bold cursor-pointer">
            <ChevronLeft className="w-4 h-4" /> Back to Shipment
          </button>
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight">Log Milestone</h1>
        </div>
        <div className="bg-white border border-sand-200 rounded-2xl p-10 text-center space-y-4 max-w-lg mx-auto">
          <AlertTriangle className="w-12 h-12 text-coral-400 mx-auto" />
          <h2 className="font-extrabold text-lg text-maritime-900">Access Restricted</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your current role <strong className="text-maritime-900 uppercase">({meta.label})</strong> is a Trade Party
            observer. Milestone logging is exclusively managed by Logistics Chain operators:{' '}
            <strong>Freight Forwarder</strong>, <strong>Customs Broker</strong>, and <strong>Warehouse Operator</strong>.
          </p>
          <p className="text-[11px] text-gray-400">Switch your profile in the top bar to a logistics role to log milestones.</p>
          <button onClick={() => router.push(`/shipments/${shipmentId}`)}
            className="mt-2 bg-maritime-400 hover:bg-maritime-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all">
            Return to Shipment
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (success) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-ocean-400 mx-auto" />
            <h2 className="text-xl font-black text-maritime-900">Milestone Logged!</h2>
            <p className="text-xs text-gray-500">Redirecting to shipment record…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Main form ────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-1 mb-6">
        <button onClick={() => router.push(`/shipments/${shipmentId}`)}
          className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-bold cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Back to Shipment
        </button>
        <h1 className="text-3xl font-black text-maritime-900 tracking-tight">Log Milestone</h1>
        <p className="text-xs text-gray-400 font-mono">SHIPMENT · {shipmentId.toUpperCase()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-5xl">

        {/* ── Left: form ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Role badge */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${meta.border} ${meta.bg}`}>
            <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
              <Icon className={`w-5 h-5 ${meta.color}`} />
            </div>
            <div>
              <p className="text-xs font-black text-maritime-900 uppercase tracking-wide">{meta.label}</p>
              <p className="text-[11px] text-gray-500">{currentUser.fullName} · {currentUser.companyName}</p>
            </div>
            <span className="ml-auto text-[9px] bg-ocean-400 text-maritime-900 font-black px-2 py-0.5 rounded uppercase tracking-wider">
              {allowedMilestones.length} milestones
            </span>
          </div>

          <form onSubmit={handleSubmit} className="bg-white border border-sand-200 rounded-2xl p-6 space-y-6">

            {/* ── Milestone picker ─────────────────────────────────────────── */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Select Milestone <span className="text-coral-400">*</span>
                </label>
                <p className="text-[10px] text-gray-400 mb-3">
                  Only milestones assigned to your role are shown, in their correct phase order.
                </p>
              </div>

              {phases.map(phase => {
                const phaseMilestones = PHASE_MILESTONE_SEQUENCE[phase].filter(m => allowedMilestones.includes(m));
                return (
                  <div key={phase} className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{PHASE_LABELS[phase]}</p>
                    <div className="space-y-1.5">
                      {phaseMilestones.map(m => {
                        const mode = MILESTONE_EVIDENCE_MODE[m];
                        const modeIcon = mode === 'REFERENCE_NUMBER'
                          ? <Hash className="w-3 h-3 text-gray-400 shrink-0" />
                          : mode === 'DOCUMENT'
                          ? <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                          : <Camera className="w-3 h-3 text-gray-400 shrink-0" />;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleMilestoneSelect(m)}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all cursor-pointer text-xs
                              ${selectedMilestone === m
                                ? `${meta.border} ${meta.bg} font-bold text-maritime-900`
                                : 'border-sand-200 hover:border-maritime-200 text-gray-600'
                              }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                              ${selectedMilestone === m ? 'border-maritime-400' : 'border-gray-300'}`}>
                              {selectedMilestone === m && <div className="w-2 h-2 rounded-full bg-maritime-400" />}
                            </div>
                            <span className="flex-1">{MILESTONE_LABELS[m]}</span>
                            {modeIcon}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Evidence mode legend */}
              <div className="flex items-center gap-4 text-[10px] text-gray-400 pt-1">
                <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Reference number</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Document upload</span>
                <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> Photo or note</span>
              </div>
            </div>

            {/* ── Notes ───────────────────────────────────────────────────── */}
            <div className="space-y-1 border-t border-sand-100 pt-5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Notes / Description
                {evidenceMode === 'PHOTO_OR_NOTE' && <span className="text-gray-400 font-normal normal-case ml-1">— required if no photo uploaded</span>}
              </label>
              <textarea
                rows={3}
                placeholder={
                  evidenceMode === 'PHOTO_OR_NOTE'
                    ? 'Describe what happened, who was present, any issues noted…'
                    : 'Optional — add context, remarks, or additional references…'
                }
                className="w-full border border-sand-200 rounded-lg p-2.5 text-xs outline-none focus:border-maritime-400 resize-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* ── Evidence — dynamic per mode ──────────────────────────────── */}
            {evidenceMode && (
              <div className="space-y-3 border-t border-sand-100 pt-5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Evidence Proof <span className="text-coral-400">*</span>
                </label>

                {/* REFERENCE_NUMBER mode */}
                {evidenceMode === 'REFERENCE_NUMBER' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder={selectedMilestone ? MILESTONE_EVIDENCE_REF_LABEL[selectedMilestone] : 'Enter reference number…'}
                        className="w-full border border-sand-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono outline-none focus:border-maritime-400 bg-sand-50"
                        value={evidenceRef}
                        onChange={e => setEvidenceRef(e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Enter the reference code from your carrier / port / customs system. This is stored as-is on the audit ledger.
                    </p>
                  </div>
                )}

                {/* DOCUMENT mode */}
                {evidenceMode === 'DOCUMENT' && (
                  <div className="space-y-2">
                    {evidenceUrl ? (
                      <div className="flex items-center gap-2 bg-ocean-50 border border-ocean-100 rounded-xl px-4 py-3">
                        <FileText className="w-4 h-4 text-ocean-400 shrink-0" />
                        <span className="text-xs text-ocean-700 font-bold truncate flex-1">{evidenceUrl.split('/').pop()}</span>
                        <button type="button" onClick={() => { setEvidenceUrl(''); setUploadError(''); }}
                          className="text-[10px] text-gray-400 hover:text-coral-400 font-bold shrink-0">Remove</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-sand-300 hover:border-maritime-300 hover:bg-maritime-50/30 rounded-xl p-6 text-center cursor-pointer transition-colors space-y-2"
                      >
                        <FileText className="w-8 h-8 text-gray-300 mx-auto" />
                        <p className="text-xs font-semibold text-gray-500">
                          {uploading ? 'Uploading…' : (EVIDENCE_UPLOAD_HINT[selectedMilestone as MilestoneType] ?? 'Click to upload document')}
                        </p>
                        <p className="text-[10px] text-gray-400">PDF, JPG or PNG · Max 20MB</p>
                        {uploading && <Loader className="w-4 h-4 animate-spin text-maritime-400 mx-auto" />}
                      </div>
                    )}
                    {uploadError && (
                      <p className="text-[11px] text-coral-500 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {uploadError}
                      </p>
                    )}
                  </div>
                )}

                {/* PHOTO_OR_NOTE mode */}
                {evidenceMode === 'PHOTO_OR_NOTE' && (
                  <div className="space-y-2">
                    {evidenceUrl ? (
                      <div className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden border border-sand-200 bg-sand-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={evidenceUrl} alt="Evidence" className="w-full max-h-48 object-cover" />
                          <button type="button" onClick={() => { setEvidenceUrl(''); setUploadError(''); }}
                            className="absolute top-2 right-2 bg-white/90 hover:bg-coral-50 text-gray-600 hover:text-coral-400 text-[10px] font-bold px-2 py-1 rounded-lg border border-sand-200 transition-colors">
                            Remove
                          </button>
                        </div>
                        <p className="text-[10px] text-ocean-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Photo uploaded — you can still add a description above.
                        </p>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-sand-300 hover:border-maritime-300 hover:bg-maritime-50/30 rounded-xl p-6 text-center cursor-pointer transition-colors space-y-2"
                      >
                        <Camera className="w-8 h-8 text-gray-300 mx-auto" />
                        <p className="text-xs font-semibold text-gray-500">
                          {uploading ? 'Uploading…' : (EVIDENCE_UPLOAD_HINT[selectedMilestone as MilestoneType] ?? 'Click to upload a photo')}
                        </p>
                        <p className="text-[10px] text-gray-400">JPG, PNG or WEBP · Max 20MB</p>
                        {uploading && <Loader className="w-4 h-4 animate-spin text-maritime-400 mx-auto" />}
                        <p className="text-[10px] text-gray-400 font-semibold">or skip and use the description field above</p>
                      </div>
                    )}
                    {uploadError && (
                      <p className="text-[11px] text-coral-500 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {uploadError}
                      </p>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={evidenceMode === 'PHOTO_OR_NOTE' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,application/pdf'}
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}

            {/* ── Error banner ─────────────────────────────────────────────── */}
            {error && (
              <div className="flex items-center gap-2 bg-coral-50 border border-coral-200 text-coral-600 text-xs p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {/* ── Submit ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between pt-2 border-t border-sand-100">
              <button type="button" onClick={() => router.push(`/shipments/${shipmentId}`)}
                className="text-xs text-gray-400 hover:text-maritime-900 font-bold">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !isReady}
                className="bg-maritime-400 hover:bg-maritime-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2"
              >
                {submitting
                  ? <><Loader className="w-4 h-4 animate-spin" /> Logging…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Log Milestone</>
                }
              </button>
            </div>
          </form>
        </div>

        {/* ── Right: reference guide ───────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-maritime-900 text-white p-6 rounded-2xl space-y-5 sticky top-6">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Ship className="w-4 h-4 text-ocean-400" />
              Your Milestone Responsibilities
            </h3>
            <p className="text-[11px] text-maritime-300 leading-relaxed">
              As a <strong className="text-white">{meta.label}</strong>, you own the following milestones.
              Each milestone uses the most practical evidence type for that event.
            </p>

            {/* Evidence mode explanation */}
            <div className="space-y-2 bg-maritime-800 rounded-xl p-3 text-[10px] text-maritime-300">
              <p className="flex items-center gap-2"><Hash className="w-3 h-3 text-ocean-400 shrink-0" /><span><strong className="text-white">Reference Number</strong> — enter the code from your carrier/customs system</span></p>
              <p className="flex items-center gap-2"><FileText className="w-3 h-3 text-amber-400 shrink-0" /><span><strong className="text-white">Document</strong> — upload the official document (B/L, OR, CAO)</span></p>
              <p className="flex items-center gap-2"><Camera className="w-3 h-3 text-maritime-400 shrink-0" /><span><strong className="text-white">Photo or Note</strong> — photo optional; description accepted instead</span></p>
            </div>

            <div className="space-y-5">
              {phases.map(phase => {
                const phaseMilestones = PHASE_MILESTONE_SEQUENCE[phase].filter(m => allowedMilestones.includes(m));
                return (
                  <div key={phase} className="space-y-1.5">
                    <p className="text-[10px] font-black text-maritime-400 uppercase tracking-widest">{PHASE_LABELS[phase]}</p>
                    <ul className="space-y-1">
                      {phaseMilestones.map(m => {
                        const mode = MILESTONE_EVIDENCE_MODE[m];
                        const icon = mode === 'REFERENCE_NUMBER'
                          ? <Hash className="w-2.5 h-2.5 text-ocean-400 shrink-0" />
                          : mode === 'DOCUMENT'
                          ? <FileText className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          : <Camera className="w-2.5 h-2.5 text-maritime-400 shrink-0" />;
                        return (
                          <li key={m} className="flex items-center gap-2 text-[11px] text-maritime-200">
                            {icon}
                            {MILESTONE_LABELS[m]}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-maritime-700 pt-4 text-[10px] text-maritime-400 leading-relaxed">
              Milestones logged here are appended to the shipment's immutable event ledger.
              Priority milestones gate the Stellar escrow release.
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
