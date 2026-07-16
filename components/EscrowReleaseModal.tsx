'use client';

import React from 'react';
import { Wallet, RefreshCw } from 'lucide-react';

interface FreighterLike {
  publicKey: string | null;
  connecting: boolean;
  connect: () => Promise<string>;
}

interface EscrowReleaseModalProps {
  open: boolean;
  onClose: () => void;
  freighter: FreighterLike;
  stellarError: string;
  stellarWorking: boolean;
  stellarStep: string;
  releaseProofUrl: string;
  setReleaseProofUrl: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function EscrowReleaseModal({
  open, onClose, freighter, stellarError, stellarWorking, stellarStep,
  releaseProofUrl, setReleaseProofUrl, onSubmit,
}: EscrowReleaseModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-mist rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
        <h3 className="font-extrabold text-sm text-ink uppercase tracking-tight">Stellar Escrow Release Consent</h3>
        <p className="text-[11px] text-ink-faint leading-normal">
          You are authorizing the immediate release of locked USDC via the Soroban escrow contract. Freighter will prompt you to sign the release transaction. Upload a signed handoff receipt first.
        </p>

        {freighter.publicKey ? (
          <div className="flex items-center gap-2 bg-teal-light border border-steel-light rounded-lg px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
            <span className="font-sans text-[10px] text-ink truncate">{freighter.publicKey}</span>
          </div>
        ) : (
          <button onClick={freighter.connect} disabled={freighter.connecting}
            className="w-full flex items-center justify-center gap-1.5 bg-amber-light border border-amber/30 text-ink font-bold py-2 rounded-lg text-xs">
            <Wallet className="w-3.5 h-3.5" />{freighter.connecting ? 'Connecting…' : 'Connect Freighter'}
          </button>
        )}

        {stellarError && (
          <div className="bg-wine-light border border-wine/20 text-wine text-xs p-2.5 rounded-lg">{stellarError}</div>
        )}
        {stellarWorking && stellarStep && (
          <div className="flex items-center gap-2 text-[11px] text-ink-soft bg-amber-light border border-amber-light rounded-lg p-2.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber" />{stellarStep}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="block font-bold text-ink-faint">Signed Handoff Receipt (URL)</label>
            <input type="text" required placeholder="https://signoffs.ph/receipt.png"
              className="w-full border border-mist rounded p-2 text-xs outline-none font-sans"
              value={releaseProofUrl} onChange={(e) => setReleaseProofUrl(e.target.value)} />
            <button type="button" onClick={() => setReleaseProofUrl('https://picsum.photos/seed/release_sc/800/600')}
              className="text-[10px] text-steel underline block">
              Quick attach handoff photo proof
            </button>
          </div>

          <div className="flex gap-2 justify-end pt-2 text-xs">
            <button type="button" className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint"
              onClick={onClose}>
              Close
            </button>
            <button type="submit" disabled={stellarWorking || !releaseProofUrl}
              className="px-4 py-1.5 bg-steel hover:bg-teal text-white rounded-lg font-black disabled:opacity-50">
              {stellarWorking ? 'Processing…' : 'Sign & Authorize Release'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
