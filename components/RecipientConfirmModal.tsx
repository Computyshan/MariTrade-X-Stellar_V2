'use client';

import React from 'react';
import { UserCheck, AlertTriangle, CheckCircle2, Copy, Send, RefreshCw } from 'lucide-react';

interface RecipientConfirmModalProps {
  open: boolean;
  onClose: () => void;
  referenceCode: string;
  rcError: string;
  rcJustSentUrl: string;
  rcSubmitting: boolean;
  consigneeContact: string;
  setConsigneeContact: (v: string) => void;
  consigneeName: string;
  setConsigneeName: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function RecipientConfirmModal({
  open, onClose, referenceCode, rcError, rcJustSentUrl, rcSubmitting,
  consigneeContact, setConsigneeContact, consigneeName, setConsigneeName, onSubmit,
}: RecipientConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-mist rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-light rounded-xl flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-amber" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-ink">Request Delivery Confirmation</h3>
            <p className="text-[10px] text-ink-faint font-sans uppercase">{referenceCode}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-ink-faint hover:text-ink text-lg leading-none"
            disabled={rcSubmitting}
          >✕</button>
        </div>

        {rcError && (
          <div className="bg-wine-light border border-wine/20 text-wine text-xs p-2.5 rounded-lg flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{rcError}
          </div>
        )}

        {rcJustSentUrl ? (
          <div className="space-y-3">
            <div className="bg-teal-light border border-steel-light text-steel p-3 rounded-lg text-xs flex items-start gap-1.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Confirmation request sent. No SMS/email provider is configured yet — share this link with the consignee directly:</span>
            </div>
            <div className="flex items-center gap-2 bg-mist-light border border-mist rounded-lg px-3 py-2">
              <span className="font-mono text-[10px] text-ink truncate flex-1">{rcJustSentUrl}</span>
              <button type="button" onClick={() => navigator.clipboard?.writeText(rcJustSentUrl)}
                className="shrink-0 text-ink-faint hover:text-teal"><Copy className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex justify-end pt-1">
              <button onClick={onClose} className="px-4 py-2 bg-amber hover:bg-ink text-white rounded-lg font-bold text-xs transition-all">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Consignee Contact <span className="text-wine">*</span></label>
              <input type="text" required value={consigneeContact} onChange={e => setConsigneeContact(e.target.value)}
                placeholder="Phone or email"
                className="w-full border border-mist rounded-lg p-2.5 text-xs outline-none focus:border-teal" />
            </div>
            <div className="space-y-1.5">
              <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Consignee Name</label>
              <input type="text" value={consigneeName} onChange={e => setConsigneeName(e.target.value)}
                placeholder="Optional"
                className="w-full border border-mist rounded-lg p-2.5 text-xs outline-none focus:border-teal" />
            </div>
            <p className="text-[10px] text-ink-faint leading-relaxed">
              A one-time link will be generated for the consignee to confirm or dispute receipt independently of the logistics chain.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold"
                onClick={onClose}>
                Cancel
              </button>
              <button type="submit" disabled={rcSubmitting || !consigneeContact.trim()}
                className="px-4 py-1.5 bg-amber hover:bg-ink text-white rounded-lg font-black disabled:opacity-50 flex items-center gap-1.5">
                {rcSubmitting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Send className="w-3.5 h-3.5" /> Send Request</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
