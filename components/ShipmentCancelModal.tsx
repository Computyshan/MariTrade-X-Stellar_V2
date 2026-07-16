'use client';

import React from 'react';
import {
  XCircle, AlertTriangle, Wallet, ShieldAlert, Scale, RefreshCw, CheckCircle2, ExternalLink,
} from 'lucide-react';
import type { CancelState } from '@/hooks/use-cancel-flow';
import { formatAsset } from '@/lib/stellar/assets';

interface FreighterLike {
  publicKey: string | null;
  connecting: boolean;
  connect: () => Promise<string>;
}

interface ShipmentCancelModalProps {
  open: boolean;
  onClose: () => void;
  referenceCode: string;
  escrowAsset: 'USDC' | 'PPHP';
  network: 'testnet' | 'mainnet';
  freighter: FreighterLike;
  cancelState: CancelState;
  setCancelState: React.Dispatch<React.SetStateAction<CancelState>>;
  disputeReasonInput: string;
  setDisputeReasonInput: (v: string) => void;
  onPrepareCancel: () => void;
  onRaiseDispute: () => void;
}

export default function ShipmentCancelModal({
  open, onClose, referenceCode, escrowAsset, network, freighter,
  cancelState, setCancelState, disputeReasonInput, setDisputeReasonInput,
  onPrepareCancel, onRaiseDispute,
}: ShipmentCancelModalProps) {
  if (!open) return null;

  const cancelStageLabel: Record<string, string> = {
    UNFUNDED: 'Full refund — escrow not yet funded',
    PRE_DEPARTURE: `Partial refund (${cancelState.refundBps / 100}% = ${formatAsset(cancelState.refundAmount, escrowAsset)})`,
    IN_TRANSIT: 'Disputed — arbitration required',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-mist rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-mist-light pb-3">
          <div className="w-10 h-10 bg-wine-light rounded-xl flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-wine" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-ink">Cancel Shipment &amp; Request Refund</h3>
            <p className="text-[10px] text-ink-faint font-sans">{referenceCode}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-ink-faint hover:text-ink text-lg leading-none"
            disabled={cancelState.step === 'preparing' || cancelState.step === 'submitting' || cancelState.step === 'confirming_db'}
          >✕</button>
        </div>

        {/* ── IDLE / pre-action ──────────────────────────────────────── */}
        {(cancelState.step === 'idle' && !cancelState.requiresDispute) && (
          <div className="space-y-4">
            <div className="bg-amber-light border border-amber/30 rounded-xl p-4 text-xs text-amber space-y-2">
              <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Cancellation Policy</p>
              <ul className="space-y-1.5 pl-2 text-[11px] leading-relaxed">
                <li><strong>Unfunded:</strong> Full refund — escrow has no USDC deposited yet.</li>
                <li><strong>Pre-Departure:</strong> Partial refund per agreed terms; platform fee applies.</li>
                <li><strong>In-Transit:</strong> Requires dispute arbitration — MariTrade reviews and splits funds.</li>
                <li><strong>Delivered:</strong> No cancellation allowed after delivery confirmation.</li>
              </ul>
            </div>

            {!freighter.publicKey ? (
              <button
                onClick={freighter.connect}
                disabled={freighter.connecting}
                className="w-full flex items-center justify-center gap-1.5 border border-amber/30 bg-amber-light hover:bg-amber-light/70 text-ink font-bold py-2 rounded-lg text-xs"
              >
                <Wallet className="w-3.5 h-3.5" />
                {freighter.connecting ? 'Connecting…' : 'Connect Freighter Wallet First'}
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-teal-light border border-steel-light rounded-lg px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                <span className="font-sans text-[10px] text-ink truncate">{freighter.publicKey}</span>
              </div>
            )}

            <p className="text-[10px] text-ink-faint leading-relaxed">
              Clicking <strong>Proceed with Cancellation</strong> will check the current escrow stage on Stellar,
              then open a Freighter signing popup. The platform co-signature for PRE_DEPARTURE cancellations
              is added server-side automatically.
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={onClose} className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold text-xs">
                Keep Shipment
              </button>
              <button
                onClick={onPrepareCancel}
                className="px-4 py-1.5 bg-wine hover:bg-wine/85 text-white rounded-lg font-black text-xs"
              >
                Proceed with Cancellation
              </button>
            </div>
          </div>
        )}

        {/* ── IN_TRANSIT → dispute required ─────────────────────────── */}
        {cancelState.requiresDispute && cancelState.step === 'idle' && (
          <div className="space-y-4">
            <div className="bg-wine-light border border-wine/20 rounded-xl p-4 text-xs text-ink-soft space-y-2">
              <p className="font-bold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> In-Transit — Dispute Required</p>
              <p className="text-[11px] leading-relaxed">
                Your shipment is currently <strong>In Transit</strong>. Direct cancellation is not permitted once
                the vessel has departed. You must raise a formal dispute which MariTrade will arbitrate.
                Funds remain locked until a resolution is issued.
              </p>
              <p className="text-[10px] text-wine">Resolution typically takes 3–5 business days.</p>
            </div>

            {!freighter.publicKey ? (
              <button onClick={freighter.connect} disabled={freighter.connecting}
                className="w-full flex items-center justify-center gap-1.5 border border-amber/30 bg-amber-light hover:bg-amber-light/70 text-ink font-bold py-2 rounded-lg text-xs">
                <Wallet className="w-3.5 h-3.5" />{freighter.connecting ? 'Connecting…' : 'Connect Freighter Wallet'}
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-teal-light border border-steel-light rounded-lg px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                <span className="font-sans text-[10px] text-ink truncate">{freighter.publicKey}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-ink-faint uppercase tracking-wide">
                Reason for dispute (optional, but helps arbitration)
              </label>
              <textarea
                value={disputeReasonInput}
                onChange={e => setDisputeReasonInput(e.target.value)}
                rows={3}
                placeholder="e.g. Cargo arrived with visible water damage on 3 pallets; photos attached to Delivered milestone."
                className="w-full border border-mist rounded-lg p-2.5 text-xs outline-none font-sans resize-none"
              />
              <p className="text-[9px] text-ink-faint">
                This is shown to MariTrade&apos;s arbitrators and summarized by AI alongside the milestone log — it doesn&apos;t affect the outcome on its own.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={onClose} className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold text-xs">
                Cancel
              </button>
              <button
                onClick={onRaiseDispute}
                className="px-4 py-1.5 bg-wine hover:bg-wine/85 text-white rounded-lg font-black text-xs flex items-center gap-1.5"
              >
                <Scale className="w-3.5 h-3.5" /> File Dispute with MariTrade
              </button>
            </div>
          </div>
        )}

        {/* ── In-progress steps ──────────────────────────────────────── */}
        {(cancelState.step === 'preparing' || cancelState.step === 'awaiting_sign' || cancelState.step === 'submitting' || cancelState.step === 'confirming_db') && (
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              {[
                { key: 'preparing',    label: 'Checking escrow stage on Stellar…' },
                { key: 'awaiting_sign', label: 'Waiting for Freighter signature…' },
                { key: 'submitting',   label: 'Broadcasting cancellation to Stellar…' },
                { key: 'confirming_db', label: 'Updating shipment record…' },
              ].map(({ key, label }) => {
                const steps = ['preparing', 'awaiting_sign', 'submitting', 'confirming_db'];
                const currentIdx = steps.indexOf(cancelState.step);
                const thisIdx    = steps.indexOf(key);
                const isDone    = thisIdx < currentIdx;
                const isCurrent = thisIdx === currentIdx;
                return (
                  <div key={key} className={`flex items-center gap-3 text-xs ${isDone ? 'text-steel' : isCurrent ? 'text-ink' : 'text-mist-dark'}`}>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] flex-shrink-0 ${
                      isDone    ? 'border-teal bg-teal text-white' :
                      isCurrent ? 'border-amber bg-amber-light' :
                      'border-mist bg-white'
                    }`}>
                      {isDone ? '✓' : isCurrent ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : '·'}
                    </span>
                    <span className={`font-medium ${isCurrent ? 'font-bold' : ''}`}>{label}</span>
                  </div>
                );
              })}
            </div>

            {cancelState.stage && (
              <div className="bg-mist-light border border-mist rounded-lg p-3 text-[11px]">
                <span className="text-ink-faint">Stage: </span>
                <strong className="text-ink">{cancelState.stage}</strong>
                {cancelStageLabel[cancelState.stage] && (
                  <span className="text-ink-faint block mt-0.5">{cancelStageLabel[cancelState.stage]}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Done ──────────────────────────────────────────────────── */}
        {cancelState.step === 'done' && (
          <div className="space-y-4">
            <div className="bg-steel-light border border-steel-light rounded-xl p-5 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-steel mx-auto" />
              <p className="font-extrabold text-sm text-ink">
                {cancelState.requiresDispute ? 'Dispute Filed Successfully' : 'Cancellation Complete'}
              </p>
              <p className="text-xs text-ink-faint leading-relaxed">
                {cancelState.requiresDispute
                  ? 'Your dispute has been submitted. MariTrade will review the case and notify you within 3–5 business days.'
                  : `Your ${escrowAsset === 'PPHP' ? 'PPHP' : 'USDC'} refund has been processed on the Stellar ledger. ${cancelState.stage === 'PRE_DEPARTURE' ? `${formatAsset(cancelState.refundAmount, escrowAsset)} has been returned to your wallet.` : 'Full refund confirmed.'}`
                }
              </p>
              {cancelState.txHash && cancelState.txHash.length === 64 && (
                <a
                  href={`https://stellar.expert/explorer/${network}/tx/${cancelState.txHash}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1 text-[10px] text-steel font-sans hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  {cancelState.txHash.substring(0, 16)}…{cancelState.txHash.substring(cancelState.txHash.length - 8)}
                </a>
              )}
            </div>
            <button onClick={onClose} className="w-full px-4 py-2 bg-amber hover:bg-ink text-white rounded-lg font-black text-xs">
              Close
            </button>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────── */}
        {cancelState.step === 'error' && (
          <div className="space-y-4">
            <div className="bg-wine-light border border-wine/20 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-wine flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-xs text-wine">Cancellation Failed</p>
                <p className="text-[11px] text-wine leading-relaxed">{cancelState.error}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold text-xs">
                Close
              </button>
              <button
                onClick={() => setCancelState(s => ({ ...s, step: 'idle', error: '' }))}
                className="px-4 py-1.5 bg-wine hover:bg-wine/85 text-white rounded-lg font-black text-xs"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
