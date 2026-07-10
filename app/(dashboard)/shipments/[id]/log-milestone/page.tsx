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
  ShipmentPhase,
  MILESTONE_EVIDENCE_MODE,
  MILESTONE_EVIDENCE_REF_LABEL,
  getUserJobRoles,
  getMilestonesForUser,
} from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────
// Role accent colors are drawn from the app's actual design system
// (app/globals.css — amber / mist / steel / ink / wine / teal). Teal is the
// Logistics Chain portal's primary accent, so the most common role
// (Freight Forwarder) uses it; Steel and Amber differentiate the other two
// roles without introducing any colors outside the palette.

const ROLE_META: Record<JobRole, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  IMPORTER:           { label: 'Importer',          icon: Building2, color: 'text-ink-faint', bg: 'bg-mist-light',  border: 'border-mist'        },
  EXPORTER:           { label: 'Exporter',           icon: Building2, color: 'text-ink-faint', bg: 'bg-mist-light',  border: 'border-mist'        },
  FREIGHT_FORWARDER:  { label: 'Freight Forwarder',  icon: Ship,      color: 'text-teal',      bg: 'bg-teal-light',  border: 'border-teal-light'  },
  CUSTOMS_BROKER:     { label: 'Customs Broker',     icon: FileCheck, color: 'text-steel',     bg: 'bg-steel-light', border: 'border-steel-light' },
  WAREHOUSE_OPERATOR: { label: 'Warehouse Operator', icon: Package,   color: 'text-amber',     bg: 'bg-amber-light', border: 'border-amber-light' },
  // Admins never reach this page in practice (getMilestonesForUser returns []
  // for ADMIN, so canLog is false and the Access Restricted guard below
  // renders instead) — present only to satisfy Record<JobRole, ...>.
  ADMIN:               { label: 'Admin',              icon: Building2, color: 'text-ink-faint', bg: 'bg-mist-light',  border: 'border-mist'        },
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
  const [chainSyncWarning, setChainSyncWarning]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  // Multi-role support: a user can hold more than one Logistics Chain role
  // at once (e.g. Freight Forwarder + Customs Broker). Their allowed
  // milestones are the union across every role they hold, and the badge
  // strip below shows one chip per role rather than a single role.
  const roles             = getUserJobRoles(currentUser);
  const primaryRole       = roles[0] ?? currentUser.jobRole;
  const meta              = ROLE_META[primaryRole];
  const Icon              = meta.icon;
  const allowedMilestones = getMilestonesForUser(currentUser);
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
        // Surface a failed on-chain cancellation-stage sync instead of letting
        // it disappear silently — the milestone POST is best-effort on the
        // chain side (the DB write is the must-succeed part), but a silent
        // failure here means the escrow's on-chain stage can drift out of
        // sync with what the shipment timeline shows, which later confuses
        // the cancel/dispute flow (it reads the on-chain stage directly).
        const sync = json.onChainStageSync;
        if (sync && sync.error) {
          setChainSyncWarning(
            `Milestone saved, but the on-chain escrow stage did not update: ${sync.error}`
          );
        }
        setSuccess(true);
        setTimeout(() => router.push(`/shipments/${shipmentId}`), sync?.error ? 4000 : 1800);
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
            className="flex items-center gap-1.5 text-xs text-teal hover:text-ink font-bold cursor-pointer">
            <ChevronLeft className="w-4 h-4" /> Back to Shipment
          </button>
          <h1 className="text-3xl font-black text-ink tracking-tight">Log Milestone</h1>
        </div>
        <div className="bg-white border border-mist rounded-2xl p-10 text-center space-y-4 max-w-lg mx-auto">
          <AlertTriangle className="w-12 h-12 text-wine mx-auto" />
          <h2 className="font-extrabold text-lg text-ink">Access Restricted</h2>
          <p className="text-xs text-ink-faint leading-relaxed">
            Your current role{roles.length > 1 ? 's' : ''} <strong className="text-ink uppercase">({roles.map(r => ROLE_META[r].label).join(', ')})</strong> {roles.length > 1 ? 'are' : 'is a'} Trade Party
            observer{roles.length > 1 ? 's' : ''}. Milestone logging is exclusively managed by Logistics Chain operators:{' '}
            <strong>Freight Forwarder</strong>, <strong>Customs Broker</strong>, and <strong>Warehouse Operator</strong>.
          </p>
          <p className="text-[11px] text-ink-faint">Switch your profile in the top bar to a logistics role to log milestones.</p>
          <button onClick={() => router.push(`/shipments/${shipmentId}`)}
            className="mt-2 bg-teal hover:bg-ink text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all">
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
          <div className="text-center space-y-4 max-w-md">
            <CheckCircle2 className="w-16 h-16 text-teal mx-auto" />
            <h2 className="text-xl font-black text-ink">Milestone Logged!</h2>
            <p className="text-xs text-ink-faint">Redirecting to shipment record…</p>
            {chainSyncWarning && (
              <div className="flex items-start gap-2 bg-wine-light border border-wine/20 text-wine text-xs p-3 rounded-lg text-left">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{chainSyncWarning}</span>
              </div>
            )}
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
          className="flex items-center gap-1.5 text-xs text-teal hover:text-ink font-bold cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Back to Shipment
        </button>
        <h1 className="text-3xl font-black text-ink tracking-tight">Log Milestone</h1>
        <p className="text-xs text-ink-faint font-mono">SHIPMENT · {shipmentId.toUpperCase()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-5xl">

        {/* ── Left: form ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Role badge(s) — one chip per stacked role */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${meta.border} ${meta.bg}`}>
            <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
              <Icon className={`w-5 h-5 ${meta.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {roles.map(r => (
                  <span key={r} className="text-xs font-black text-ink uppercase tracking-wide">
                    {ROLE_META[r].label}{roles.indexOf(r) < roles.length - 1 ? ' ·' : ''}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-ink-faint">{currentUser.fullName} · {currentUser.companyName}</p>
            </div>
            <span className="ml-auto text-[9px] bg-teal text-ink font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
              {allowedMilestones.length} milestones
              {roles.length > 1 ? ` · ${roles.length} roles` : ''}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="bg-white border border-mist rounded-2xl p-6 space-y-6">

            {/* ── Milestone picker ─────────────────────────────────────────── */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1 uppercase tracking-wider">
                  Select Milestone <span className="text-wine">*</span>
                </label>
                <p className="text-[10px] text-ink-faint mb-3">
                  Only milestones assigned to your role are shown, in their correct phase order.
                </p>
              </div>

              {phases.map(phase => {
                const phaseMilestones = PHASE_MILESTONE_SEQUENCE[phase].filter(m => allowedMilestones.includes(m));
                return (
                  <div key={phase} className="space-y-2">
                    <p className="text-[10px] font-black text-ink-faint uppercase tracking-widest">{PHASE_LABELS[phase]}</p>
                    <div className="space-y-1.5">
                      {phaseMilestones.map(m => {
                        const mode = MILESTONE_EVIDENCE_MODE[m];
                        const modeIcon = mode === 'REFERENCE_NUMBER'
                          ? <Hash className="w-3 h-3 text-ink-faint shrink-0" />
                          : mode === 'DOCUMENT'
                          ? <FileText className="w-3 h-3 text-ink-faint shrink-0" />
                          : <Camera className="w-3 h-3 text-ink-faint shrink-0" />;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleMilestoneSelect(m)}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all cursor-pointer text-xs
                              ${selectedMilestone === m
                                ? `${meta.border} ${meta.bg} font-bold text-ink`
                                : 'border-mist hover:border-teal-light text-ink-faint'
                              }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                              ${selectedMilestone === m ? 'border-teal' : 'border-mist-dark'}`}>
                              {selectedMilestone === m && <div className="w-2 h-2 rounded-full bg-teal" />}
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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-ink-faint pt-1">
                <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Reference number</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Document upload</span>
                <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> Photo or note</span>
              </div>
            </div>

            {/* ── Notes ───────────────────────────────────────────────────── */}
            <div className="space-y-1 border-t border-mist-light pt-5">
              <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                Notes / Description
                {evidenceMode === 'PHOTO_OR_NOTE' && <span className="text-ink-faint font-normal normal-case ml-1">— required if no photo uploaded</span>}
              </label>
              <textarea
                rows={3}
                placeholder={
                  evidenceMode === 'PHOTO_OR_NOTE'
                    ? 'Describe what happened, who was present, any issues noted…'
                    : 'Optional — add context, remarks, or additional references…'
                }
                className="w-full border border-mist rounded-lg p-2.5 text-xs outline-none focus:border-teal resize-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* ── Evidence — dynamic per mode ──────────────────────────────── */}
            {evidenceMode && (
              <div className="space-y-3 border-t border-mist-light pt-5">
                <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                  Evidence Proof <span className="text-wine">*</span>
                </label>

                {/* REFERENCE_NUMBER mode */}
                {evidenceMode === 'REFERENCE_NUMBER' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Hash className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder={selectedMilestone ? MILESTONE_EVIDENCE_REF_LABEL[selectedMilestone] : 'Enter reference number…'}
                        className="w-full border border-mist rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono outline-none focus:border-teal bg-mist-light"
                        value={evidenceRef}
                        onChange={e => setEvidenceRef(e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-ink-faint">
                      Enter the reference code from your carrier / port / customs system. This is stored as-is on the audit ledger.
                    </p>
                  </div>
                )}

                {/* DOCUMENT mode */}
                {evidenceMode === 'DOCUMENT' && (
                  <div className="space-y-2">
                    {evidenceUrl ? (
                      <div className="flex items-center gap-2 bg-teal-light border border-teal-light rounded-xl px-4 py-3">
                        <FileText className="w-4 h-4 text-teal shrink-0" />
                        <span className="text-xs text-teal-hover font-bold truncate flex-1">{evidenceUrl.split('/').pop()}</span>
                        <button type="button" onClick={() => { setEvidenceUrl(''); setUploadError(''); }}
                          className="text-[10px] text-ink-faint hover:text-wine font-bold shrink-0">Remove</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-mist-dark hover:border-teal hover:bg-teal-light/30 rounded-xl p-6 text-center cursor-pointer transition-colors space-y-2"
                      >
                        <FileText className="w-8 h-8 text-mist-dark mx-auto" />
                        <p className="text-xs font-semibold text-ink-faint">
                          {uploading ? 'Uploading…' : (EVIDENCE_UPLOAD_HINT[selectedMilestone as MilestoneType] ?? 'Click to upload document')}
                        </p>
                        <p className="text-[10px] text-ink-faint">PDF, JPG or PNG · Max 20MB</p>
                        {uploading && <Loader className="w-4 h-4 animate-spin text-teal mx-auto" />}
                      </div>
                    )}
                    {uploadError && (
                      <p className="text-[11px] text-wine font-semibold flex items-center gap-1">
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
                        <div className="relative rounded-xl overflow-hidden border border-mist bg-mist-light">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={evidenceUrl} alt="Evidence" className="w-full max-h-48 object-cover" />
                          <button type="button" onClick={() => { setEvidenceUrl(''); setUploadError(''); }}
                            className="absolute top-2 right-2 bg-white/90 hover:bg-wine-light text-ink-faint hover:text-wine text-[10px] font-bold px-2 py-1 rounded-lg border border-mist transition-colors">
                            Remove
                          </button>
                        </div>
                        <p className="text-[10px] text-teal font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Photo uploaded — you can still add a description above.
                        </p>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-mist-dark hover:border-teal hover:bg-teal-light/30 rounded-xl p-6 text-center cursor-pointer transition-colors space-y-2"
                      >
                        <Camera className="w-8 h-8 text-mist-dark mx-auto" />
                        <p className="text-xs font-semibold text-ink-faint">
                          {uploading ? 'Uploading…' : (EVIDENCE_UPLOAD_HINT[selectedMilestone as MilestoneType] ?? 'Click to upload a photo')}
                        </p>
                        <p className="text-[10px] text-ink-faint">JPG, PNG or WEBP · Max 20MB</p>
                        {uploading && <Loader className="w-4 h-4 animate-spin text-teal mx-auto" />}
                        <p className="text-[10px] text-ink-faint font-semibold">or skip and use the description field above</p>
                      </div>
                    )}
                    {uploadError && (
                      <p className="text-[11px] text-wine font-semibold flex items-center gap-1">
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
              <div className="flex items-center gap-2 bg-wine-light border border-wine/20 text-wine text-xs p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {/* ── Submit ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between pt-2 border-t border-mist-light">
              <button type="button" onClick={() => router.push(`/shipments/${shipmentId}`)}
                className="text-xs text-ink-faint hover:text-ink font-bold">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !isReady}
                className="bg-teal hover:bg-ink disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2"
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
          <div className="bg-ink text-white p-6 rounded-2xl space-y-5 sticky top-6">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Ship className="w-4 h-4 text-teal" />
              Your Milestone Responsibilities
            </h3>
            <p className="text-[11px] text-white/60 leading-relaxed">
              As a <strong className="text-white">{roles.map(r => ROLE_META[r].label).join(' + ')}</strong>, you own the following milestones
              {roles.length > 1 ? ' (combined across your roles)' : ''}. Each milestone uses the most practical evidence type for that event.
            </p>

            {/* Evidence mode explanation */}
            <div className="space-y-2 bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] text-white/60">
              <p className="flex items-center gap-2"><Hash className="w-3 h-3 text-teal shrink-0" /><span><strong className="text-white">Reference Number</strong> — enter the code from your carrier/customs system</span></p>
              <p className="flex items-center gap-2"><FileText className="w-3 h-3 text-amber shrink-0" /><span><strong className="text-white">Document</strong> — upload the official document (B/L, OR, CAO)</span></p>
              <p className="flex items-center gap-2"><Camera className="w-3 h-3 text-steel shrink-0" /><span><strong className="text-white">Photo or Note</strong> — photo optional; description accepted instead</span></p>
            </div>

            <div className="space-y-5">
              {phases.map(phase => {
                const phaseMilestones = PHASE_MILESTONE_SEQUENCE[phase].filter(m => allowedMilestones.includes(m));
                return (
                  <div key={phase} className="space-y-1.5">
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">{PHASE_LABELS[phase]}</p>
                    <ul className="space-y-1">
                      {phaseMilestones.map(m => {
                        const mode = MILESTONE_EVIDENCE_MODE[m];
                        const icon = mode === 'REFERENCE_NUMBER'
                          ? <Hash className="w-2.5 h-2.5 text-teal shrink-0" />
                          : mode === 'DOCUMENT'
                          ? <FileText className="w-2.5 h-2.5 text-amber shrink-0" />
                          : <Camera className="w-2.5 h-2.5 text-steel shrink-0" />;
                        return (
                          <li key={m} className="flex items-center gap-2 text-[11px] text-white/80">
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

            <div className="border-t border-white/10 pt-4 text-[10px] text-white/50 leading-relaxed">
              Milestones logged here are appended to the shipment&apos;s immutable event ledger.
              Priority milestones gate the Stellar escrow release.
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
