'use client';

import React from 'react';
import { PenTool, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import SignaturePad, { SignaturePadHandle } from '@/components/SignaturePad';
import type { SignerRelation } from '@/types';

interface DeliverySignatureModalProps {
  open: boolean;
  onClose: () => void;
  referenceCode: string;
  signatureError: string;
  signatureSubmitting: boolean;
  signerName: string;
  setSignerName: (v: string) => void;
  signerRelation: SignerRelation;
  setSignerRelation: (v: SignerRelation) => void;
  signerContact: string;
  setSignerContact: (v: string) => void;
  onContactChange: (v: string) => void;
  otpSent: boolean;
  otpSending: boolean;
  otpExpiresAt: string;
  otpCode: string;
  setOtpCode: (v: string) => void;
  onSendOtp: () => void;
  signaturePadRef: React.RefObject<SignaturePadHandle | null>;
  onSubmit: () => void;
}

export default function DeliverySignatureModal({
  open, onClose, referenceCode, signatureError, signatureSubmitting,
  signerName, setSignerName, signerRelation, setSignerRelation,
  signerContact, onContactChange, otpSent, otpSending, otpExpiresAt, otpCode, setOtpCode,
  onSendOtp, signaturePadRef, onSubmit,
}: DeliverySignatureModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-mist rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-steel-light rounded-xl flex items-center justify-center shrink-0">
            <PenTool className="w-5 h-5 text-steel" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-ink">Capture Delivery Signature</h3>
            <p className="text-[10px] text-ink-faint font-sans uppercase">{referenceCode}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-ink-faint hover:text-ink text-lg leading-none"
            disabled={signatureSubmitting}
          >✕</button>
        </div>

        {signatureError && (
          <div className="bg-wine-light border border-wine/20 text-wine text-xs p-2.5 rounded-lg flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{signatureError}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Signer Name <span className="text-wine">*</span></label>
              <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)}
                placeholder="Full name of the person signing"
                className="w-full border border-mist rounded-lg p-2 text-xs outline-none focus:border-teal" />
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Relation to Consignee</label>
              <select value={signerRelation} onChange={e => setSignerRelation(e.target.value as SignerRelation)}
                className="w-full border border-mist rounded-lg p-2 text-xs outline-none focus:border-teal bg-white">
                <option value="CONSIGNEE">Consignee</option>
                <option value="AUTHORIZED_REPRESENTATIVE">Authorized Representative</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-mist-light pt-3">
            <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">
              Identity Verification <span className="text-ink-faint font-normal normal-case">— optional but recommended</span>
            </label>
            <p className="text-[10px] text-ink-faint leading-relaxed">
              Send a one-time code to the signer&apos;s own phone or email to tie this signature to their verified identity.
            </p>
            <div className="flex gap-1.5">
              <input type="text" value={signerContact} onChange={e => onContactChange(e.target.value)}
                placeholder="Phone or email"
                className="w-full border border-mist rounded-lg p-2 text-xs outline-none focus:border-teal" />
              <button type="button" onClick={onSendOtp}
                disabled={!signerContact.trim() || otpSending}
                className="shrink-0 flex items-center gap-1 border border-mist hover:border-teal disabled:opacity-40 disabled:cursor-not-allowed text-ink-faint hover:text-teal font-bold text-[10px] px-3 rounded-lg transition-colors">
                {otpSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Send Code'}
              </button>
            </div>
            {otpSent && (
              <div className="space-y-1 pt-1">
                <p className="text-[10px] text-teal font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Code sent — valid until {new Date(otpExpiresAt).toLocaleTimeString()}.
                </p>
                <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value)}
                  placeholder="6-digit code" maxLength={6} inputMode="numeric"
                  className="w-full border border-mist rounded-lg p-2 text-xs font-mono outline-none focus:border-teal" />
              </div>
            )}
          </div>

          <div className="space-y-1.5 border-t border-mist-light pt-3">
            <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Signature <span className="text-wine">*</span></label>
            <SignaturePad ref={signaturePadRef} height={150} />
            <button type="button" onClick={() => signaturePadRef.current?.clear()}
              className="text-[10px] text-ink-faint hover:text-wine font-bold">Clear</button>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2 text-xs">
          <button type="button" className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold"
            onClick={onClose} disabled={signatureSubmitting}>
            Cancel
          </button>
          <button type="button" onClick={onSubmit} disabled={signatureSubmitting}
            className="px-4 py-1.5 bg-steel hover:bg-teal text-white rounded-lg font-black disabled:opacity-50 flex items-center gap-1.5">
            {signatureSubmitting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><PenTool className="w-3.5 h-3.5" /> Save Signature</>}
          </button>
        </div>
      </div>
    </div>
  );
}
