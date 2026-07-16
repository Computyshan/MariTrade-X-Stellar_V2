'use client';

import React from 'react';
import { Ship, RefreshCw, Download, ShieldAlert, ShieldCheck, PenTool } from 'lucide-react';
import type { MilestoneEvent, PriorityMilestone, DeliverySignature } from '@/types';

interface ShipmentMilestoneTimelineProps {
  priorityMilestones: PriorityMilestone[];
  milestones: MilestoneEvent[];
  checkingRelease: boolean;
  hasRealEscrowId: boolean;
  chainCanRelease: boolean | null;
  allPriorityCompleted: boolean;
  deliverySignature: DeliverySignature | null;
  isLogisticsChainUser: boolean;
  onOpenSignatureModal: () => void;
}

export default function ShipmentMilestoneTimeline({
  priorityMilestones, milestones, checkingRelease, hasRealEscrowId, chainCanRelease,
  allPriorityCompleted, deliverySignature, isLogisticsChainUser, onOpenSignatureModal,
}: ShipmentMilestoneTimelineProps) {
  return (
    <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-6">
      <h3 className="font-extrabold text-sm text-ink tracking-tight flex items-center gap-2">
        <Ship className="w-5 h-5 text-amber" /><span>Milestone Tracking &amp; Signoffs</span>
      </h3>

      <div className="bg-mist-light p-4 rounded-xl border border-mist space-y-3">
        <h4 className="text-xs font-bold text-ink-faint uppercase tracking-wider font-sans">Escrow Release Requirements</h4>
        <div className="space-y-2">
          {priorityMilestones.map((pm) => (
            <div key={pm.id} className="flex items-center gap-2.5 text-xs text-ink-faint">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${pm.isCompleted ? 'bg-teal text-ink' : 'bg-amber-light text-amber animate-pulse'}`}>
                {pm.isCompleted ? '✓' : '●'}
              </span>
              <span className="font-bold uppercase tracking-tight">{pm.type.replace(/_/g, ' ')}</span>
              <span className="text-ink-faint">({pm.isCompleted ? 'CONFIRMED' : 'AWAITING SIGNOFF'})</span>
            </div>
          ))}
        </div>
        {checkingRelease && (
          <div className="flex items-center gap-1.5 text-[10px] text-steel pt-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> Checking on-chain release status…
          </div>
        )}
        {hasRealEscrowId && chainCanRelease !== null && !checkingRelease && (
          <div className={`text-[10px] font-bold pt-1 flex items-center gap-1 ${allPriorityCompleted || chainCanRelease ? 'text-steel' : 'text-wine'}`}>
            {allPriorityCompleted || chainCanRelease
              ? '✓ All priority milestones confirmed — payout unlocked'
              : '⊘ On-chain gate: pending milestone confirmations'}
          </div>
        )}
        {!hasRealEscrowId && !checkingRelease && (
          <div className={`text-[10px] font-bold pt-1 flex items-center gap-1 ${allPriorityCompleted ? 'text-steel' : 'text-wine'}`}>
            {allPriorityCompleted ? '✓ All priority milestones confirmed — payout unlocked' : '⊘ Awaiting milestone confirmations — payout locked'}
          </div>
        )}
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-12 text-ink-faint text-xs font-sans">AWAITING INITIAL FORWARDING AND BOOKING MILESTONES.</div>
      ) : (
        <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-mist">
          {milestones.map((me) => {
            const isPriority = priorityMilestones.some(pm => pm.type === me.type);
            return (
              <div key={me.id} className="relative space-y-1 text-xs">
                <span className={`absolute -left-[22.5px] top-1 w-4 h-4 rounded-full border-2 border-white ring-4 inline-block ${isPriority ? 'bg-teal ring-teal-light' : 'bg-mist ring-mist-light'}`} />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <strong className="font-bold text-ink text-xs font-sans uppercase">{me.type.replace(/_/g, ' ')}</strong>
                  <span className="text-[10px] text-ink-faint font-sans">{new Date(me.occurredAt).toLocaleString()}</span>
                </div>
                <p className="text-ink-faint leading-normal pl-1">{me.description || 'No custom notes logged.'}</p>
                {me.aisVerification && (
                  <div className={`flex items-start gap-1.5 pl-1 text-[10px] rounded-lg px-2 py-1.5 border ${
                    me.aisVerification.status === 'VERIFIED' ? 'bg-teal-light border-steel-light text-steel' :
                    me.aisVerification.status === 'MISMATCH' ? 'bg-wine-light border-wine/20 text-wine' :
                    'bg-mist-light border-mist text-ink-faint'
                  }`}>
                    <ShieldAlert className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-black uppercase tracking-wide">AIS {me.aisVerification.status}</strong>
                      {me.aisVerification.vesselName && <> — {me.aisVerification.vesselName}</>}
                      {me.aisVerification.note && <span className="block text-[9px] mt-0.5 opacity-80">{me.aisVerification.note}</span>}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-1 text-[10px] pl-1 text-ink-faint font-medium">
                  <span>Logged by user ID: <strong className="text-ink-faint">{me.loggedById}</strong></span>
                  <span>•</span>
                  {me.evidenceUrl ? (
                    <a href={me.evidenceUrl} target="_blank" rel="noreferrer" className="text-steel hover:underline flex items-center gap-0.5 font-bold cursor-pointer">
                      <Download className="w-3 h-3 text-teal" /><span>View Evidence</span>
                    </a>
                  ) : me.evidenceRef ? (
                    <span className="flex items-center gap-1 font-sans text-ink-soft bg-amber-light border border-amber-light px-2 py-0.5 rounded">
                      <span className="text-amber">#</span>{me.evidenceRef}
                    </span>
                  ) : null}
                  {/* Phase 5 · provenance badge — distinguishes a system-verified
                      reference (BOC e2m / carrier API / port-gate webhook) from a
                      self-typed one. Absent entirely for MANUAL evidence so it
                      never implies unearned confidence on the common case. */}
                  {me.evidenceSource === 'SYSTEM_VERIFIED' && (
                    <span className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wide text-teal bg-teal-light border border-steel-light px-1.5 py-0.5 rounded shrink-0">
                      <ShieldCheck className="w-2.5 h-2.5" /> System Verified
                    </span>
                  )}
                </div>

                {/* Phase 3 · Digital signature capture at delivery */}
                {me.type === 'DELIVERED_AND_SIGNED_OFF' && (
                  <div className="pl-1 pt-1.5">
                    {deliverySignature && deliverySignature.milestoneEventId === me.id ? (
                      <div className="flex items-start gap-2 text-[10px] rounded-lg px-2 py-1.5 border bg-teal-light border-steel-light text-steel">
                        <ShieldCheck className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong className="font-black uppercase tracking-wide">SIGNATURE ON FILE</strong>
                          {' — '}{deliverySignature.signerName} ({deliverySignature.signerRelation.replace(/_/g, ' ').toLowerCase()})
                          {deliverySignature.otpVerified && (
                            <span className="block text-[9px] mt-0.5 opacity-80">
                              Identity verified via OTP{deliverySignature.otpVerifiedContactMasked ? ` to ${deliverySignature.otpVerifiedContactMasked}` : ''}.
                            </span>
                          )}
                        </span>
                      </div>
                    ) : isLogisticsChainUser ? (
                      <button
                        type="button"
                        onClick={onOpenSignatureModal}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-steel hover:text-teal border border-steel-light hover:border-teal-light bg-steel-light/40 hover:bg-teal-light px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        <PenTool className="w-3 h-3" /> Capture Delivery Signature
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
