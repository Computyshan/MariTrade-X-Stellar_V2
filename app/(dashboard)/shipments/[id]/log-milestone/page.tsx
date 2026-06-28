'use client';

import React, { useState, use } from 'react';
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
} from 'lucide-react';
import { MilestoneType, JobRole, PHASE_MILESTONE_SEQUENCE, ROLE_MILESTONES, ShipmentPhase } from '@/types';

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
  const [uploading, setUploading]                 = useState(false);
  const [submitting, setSubmitting]               = useState(false);
  const [success, setSuccess]                     = useState(false);
  const [error, setError]                         = useState('');

  if (loading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-maritime-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const role             = currentUser.jobRole;
  const meta             = ROLE_META[role];
  const Icon             = meta.icon;
  const allowedMilestones = ROLE_MILESTONES[role];
  const canLog           = allowedMilestones.length > 0;

  // Which phases contain milestones this role can log
  const phases = (Object.keys(PHASE_MILESTONE_SEQUENCE) as ShipmentPhase[]).filter(phase =>
    PHASE_MILESTONE_SEQUENCE[phase].some(m => allowedMilestones.includes(m))
  );

  const handleMockUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setEvidenceUrl(`https://picsum.photos/seed/${Math.random().toString(36).slice(2, 7)}/800/600`);
      setUploading(false);
    }, 900);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestone) { setError('Please select a milestone.'); return; }
    if (!evidenceUrl)        { setError('Evidence proof is required before logging.'); return; }
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
          evidenceUrl,
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

  // ─── No-permission guard ─────────────────────────────────────────────────────

  if (!canLog) {
    return (
      <DashboardLayout>
        <div className="space-y-1 mb-6">
          <button
            onClick={() => router.push(`/shipments/${shipmentId}`)}
            className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-bold cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Shipment
          </button>
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight">Log Milestone</h1>
        </div>
        <div className="bg-white border border-sand-200 rounded-2xl p-10 text-center space-y-4 max-w-lg mx-auto">
          <AlertTriangle className="w-12 h-12 text-coral-400 mx-auto" />
          <h2 className="font-extrabold text-lg text-maritime-900">Access Restricted</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your current role{' '}
            <strong className="text-maritime-900 uppercase">({meta.label})</strong>{' '}
            is a Trade Party observer. Milestone logging is exclusively managed by
            Logistics Chain operators: <strong>Freight Forwarder</strong>,{' '}
            <strong>Customs Broker</strong>, and <strong>Warehouse Operator</strong>.
          </p>
          <p className="text-[11px] text-gray-400">
            Switch your profile in the top bar to a logistics role to log milestones.
          </p>
          <button
            onClick={() => router.push(`/shipments/${shipmentId}`)}
            className="mt-2 bg-maritime-400 hover:bg-maritime-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all"
          >
            Return to Shipment
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Success state ───────────────────────────────────────────────────────────

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

  // ─── Main form ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-1 mb-6">
        <button
          onClick={() => router.push(`/shipments/${shipmentId}`)}
          className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-bold cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Shipment
        </button>
        <h1 className="text-3xl font-black text-maritime-900 tracking-tight">Log Milestone</h1>
        <p className="text-xs text-gray-400 font-mono">SHIPMENT · {shipmentId.toUpperCase()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-5xl">

        {/* ── Left: form ─────────────────────────────────────────────────── */}
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

            {/* Milestone picker grouped by phase */}
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
                const phaseMilestones = PHASE_MILESTONE_SEQUENCE[phase].filter(m =>
                  allowedMilestones.includes(m)
                );
                return (
                  <div key={phase} className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {PHASE_LABELS[phase]}
                    </p>
                    <div className="space-y-1.5">
                      {phaseMilestones.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedMilestone(m)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all cursor-pointer text-xs
                            ${selectedMilestone === m
                              ? `${meta.border} ${meta.bg} font-bold text-maritime-900`
                              : 'border-sand-200 hover:border-maritime-200 text-gray-600'
                            }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                            ${selectedMilestone === m ? 'border-maritime-400' : 'border-gray-300'}`}>
                            {selectedMilestone === m && (
                              <div className="w-2 h-2 rounded-full bg-maritime-400" />
                            )}
                          </div>
                          {MILESTONE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Description */}
            <div className="space-y-1 border-t border-sand-100 pt-5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Notes / Description
              </label>
              <textarea
                rows={3}
                placeholder="Optional — add context, reference numbers, or remarks…"
                className="w-full border border-sand-200 rounded-lg p-2.5 text-xs outline-none focus:border-maritime-400 resize-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* Evidence upload */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Evidence Proof <span className="text-coral-400">*</span>
              </label>
              <p className="text-[10px] text-gray-400">
                Upload a photo, scan, or screenshot confirming this milestone occurred.
              </p>

              {evidenceUrl ? (
                <div className="flex items-center gap-2 bg-ocean-50 border border-ocean-100 rounded-lg px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ocean-400 shrink-0" />
                  <span className="text-xs text-ocean-600 font-bold truncate">{evidenceUrl}</span>
                  <button
                    type="button"
                    onClick={() => setEvidenceUrl('')}
                    className="ml-auto text-[10px] text-gray-400 hover:text-coral-400 font-bold shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-sand-200 rounded-xl p-5 text-center space-y-2">
                  <button
                    type="button"
                    onClick={handleMockUpload}
                    className="text-xs bg-maritime-50 hover:bg-maritime-100 text-maritime-900 border border-maritime-200 rounded-lg px-4 py-2 flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    {uploading ? (
                      <><Loader className="w-4 h-4 animate-spin" /> Uploading…</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Upload Evidence File</>
                    )}
                  </button>
                  <span className="block text-[10px] text-gray-400 font-mono">
                    JPG, PNG or PDF · Max 20MB
                  </span>
                </div>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 bg-coral-50 border border-coral-200 text-coral-600 text-xs p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {/* Submit row */}
            <div className="flex items-center justify-between pt-2 border-t border-sand-100">
              <button
                type="button"
                onClick={() => router.push(`/shipments/${shipmentId}`)}
                className="text-xs text-gray-400 hover:text-maritime-900 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedMilestone || !evidenceUrl}
                className="bg-maritime-400 hover:bg-maritime-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2"
              >
                {submitting ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Logging…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Log Milestone</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── Right: reference guide ──────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-maritime-900 text-white p-6 rounded-2xl space-y-5 sticky top-6">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Ship className="w-4 h-4 text-ocean-400" />
              Your Milestone Responsibilities
            </h3>
            <p className="text-[11px] text-maritime-300 leading-relaxed">
              As a <strong className="text-white">{meta.label}</strong>, you own the
              following milestones across the shipment phases.
            </p>

            <div className="space-y-5">
              {phases.map(phase => {
                const phaseMilestones = PHASE_MILESTONE_SEQUENCE[phase].filter(m =>
                  allowedMilestones.includes(m)
                );
                return (
                  <div key={phase} className="space-y-2">
                    <p className="text-[10px] font-black text-maritime-400 uppercase tracking-widest">
                      {PHASE_LABELS[phase]}
                    </p>
                    <ul className="space-y-1">
                      {phaseMilestones.map(m => (
                        <li key={m} className="flex items-center gap-2 text-[11px] text-maritime-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-maritime-500 shrink-0" />
                          {MILESTONE_LABELS[m]}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-maritime-700 pt-4 text-[10px] text-maritime-400 leading-relaxed">
              Milestones logged here are appended to the shipment&apos;s immutable event ledger.
              Priority milestones gate the Stellar escrow release.
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
