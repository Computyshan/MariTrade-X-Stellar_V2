'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  MapPin,
  Loader,
  MessageSquareWarning,
} from 'lucide-react';

interface ConfirmData {
  shipment: {
    referenceCode: string;
    description: string;
    originCountry: string;
    destinationPort: string;
    status: string;
  };
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'EXPIRED';
  consigneeName?: string;
  requestedAt: string;
  respondedAt?: string;
}

export default function ConfirmDeliveryPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConfirmData | null>(null);
  const [errorText, setErrorText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');

  const fetchData = async (tok: string) => {
    try {
      setLoading(true);
      setErrorText('');
      const res = await fetch(`/api/recipient-confirm/${tok}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setErrorText(json.error || 'Confirmation link not found.');
      }
    } catch {
      setErrorText('Failed to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    // Deferred via setTimeout(0) rather than called inline: fetchData's first
    // setState call (setLoading(true)) happens synchronously in its own
    // function body up to the first `await`, and calling it directly from
    // the effect body would run that synchronous part inside the effect's
    // own call stack (the react-hooks/set-state-in-effect trigger). Pushing
    // it onto a new task moves that synchronous prefix out of the effect.
    const timer = setTimeout(() => fetchData(token), 0);
    return () => clearTimeout(timer);
  }, [token]);

  const submit = async (action: 'CONFIRM' | 'DISPUTE') => {
    if (action === 'DISPUTE' && !disputeNote.trim()) {
      setShowDisputeForm(true);
      return;
    }
    setSubmitting(true);
    setErrorText('');
    try {
      const res = await fetch(`/api/recipient-confirm/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, disputeNote: disputeNote.trim() || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchData(token);
      } else {
        setErrorText(json.error || 'Something went wrong.');
      }
    } catch {
      setErrorText('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-mist-light font-sans flex flex-col text-ink">
      <header className="bg-white border-b border-mist">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/MariTrade logo.png" alt="MariTrade" width={110} height={44} className="h-9 w-auto object-contain" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 sm:px-6 py-10 space-y-5">
        {loading ? (
          <div className="bg-white border border-mist p-10 rounded-xl flex flex-col items-center justify-center gap-4">
            <div className="w-9 h-9 border-4 border-amber border-t-transparent rounded-full animate-spin" />
            <p className="text-[12px] text-ink-faint">Loading your delivery confirmation&hellip;</p>
          </div>
        ) : errorText && !data ? (
          <div className="bg-white border border-mist p-10 rounded-xl text-center space-y-4">
            <div className="w-12 h-12 bg-wine-light text-wine rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-display font-medium text-[20px] text-ink">Link Not Found</h3>
            <p className="text-[13px] text-ink-faint leading-relaxed">{errorText}</p>
          </div>
        ) : data ? (
          <div className="space-y-5">
            <div className="bg-white border border-mist p-5 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-light flex items-center justify-center shrink-0">
                  <PackageCheck className="w-4 h-4 text-amber" />
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-widest text-ink-faint">MariTrade Reference</span>
                  <span className="font-display font-medium text-[20px] text-ink">{data.shipment.referenceCode}</span>
                </div>
              </div>
              <p className="text-[13px] text-ink-faint bg-mist-light p-3 rounded-md border border-mist leading-relaxed">
                {data.shipment.description}
              </p>
              <div className="flex items-center gap-2 text-[12px] text-ink-faint">
                <MapPin className="w-3.5 h-3.5" />
                <span>{data.shipment.originCountry} &rarr; {data.shipment.destinationPort}</span>
              </div>
            </div>

            {data.status === 'PENDING' && (
              <div className="bg-white border border-mist p-6 rounded-xl shadow-sm space-y-5">
                <div className="space-y-1.5">
                  <h2 className="font-display font-medium text-[19px] text-ink">Did you receive this shipment?</h2>
                  <p className="text-[12px] text-ink-faint leading-relaxed">
                    {data.consigneeName ? `Hi ${data.consigneeName}, ` : ''}
                    Your confirmation is recorded independently of the delivery driver&apos;s own report, and helps verify that this shipment actually arrived.
                  </p>
                </div>

                {!showDisputeForm ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => submit('CONFIRM')}
                      disabled={submitting}
                      className="flex items-center justify-center gap-2 bg-teal hover:opacity-90 disabled:opacity-50 text-white font-semibold text-[13px] px-4 py-3 rounded-lg transition-opacity"
                    >
                      {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Yes, I received it
                    </button>
                    <button
                      onClick={() => setShowDisputeForm(true)}
                      disabled={submitting}
                      className="flex items-center justify-center gap-2 bg-white border border-wine/30 text-wine hover:bg-wine-light font-semibold text-[13px] px-4 py-3 rounded-lg transition-colors"
                    >
                      <MessageSquareWarning className="w-4 h-4" />
                      No, there&apos;s an issue
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      autoFocus
                      placeholder="Briefly describe what's wrong (missing package, damaged goods, wrong address, etc.)"
                      className="w-full border border-mist rounded-lg p-3 text-[13px] outline-none focus:border-amber resize-none"
                      value={disputeNote}
                      onChange={e => setDisputeNote(e.target.value)}
                    />
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => submit('DISPUTE')}
                        disabled={submitting || !disputeNote.trim()}
                        className="flex-1 flex items-center justify-center gap-2 bg-wine hover:opacity-90 disabled:opacity-50 text-white font-semibold text-[13px] px-4 py-2.5 rounded-lg transition-opacity"
                      >
                        {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Submit Issue'}
                      </button>
                      <button
                        onClick={() => { setShowDisputeForm(false); setDisputeNote(''); }}
                        className="text-[12px] text-ink-faint hover:text-ink font-semibold px-3"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {errorText && (
                  <p className="text-[12px] text-wine font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> {errorText}
                  </p>
                )}
              </div>
            )}

            {data.status === 'CONFIRMED' && (
              <div className="bg-white border border-mist p-8 rounded-xl shadow-sm text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-teal mx-auto" />
                <h3 className="font-display font-medium text-[19px] text-ink">Thanks for confirming!</h3>
                <p className="text-[12px] text-ink-faint">
                  Recorded {data.respondedAt ? new Date(data.respondedAt).toLocaleString() : ''}. This shipment&apos;s delivery is now independently corroborated.
                </p>
              </div>
            )}

            {data.status === 'DISPUTED' && (
              <div className="bg-white border border-mist p-8 rounded-xl shadow-sm text-center space-y-3">
                <MessageSquareWarning className="w-10 h-10 text-wine mx-auto" />
                <h3 className="font-display font-medium text-[19px] text-ink">Issue Reported</h3>
                <p className="text-[12px] text-ink-faint">
                  Thanks for letting us know — the shipment&apos;s importer and logistics team have been notified.
                </p>
              </div>
            )}

            {data.status === 'EXPIRED' && (
              <div className="bg-white border border-mist p-8 rounded-xl shadow-sm text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-ink-faint mx-auto" />
                <h3 className="font-display font-medium text-[19px] text-ink">Link Expired</h3>
                <p className="text-[12px] text-ink-faint">Please contact the shipper for a new confirmation link.</p>
              </div>
            )}
          </div>
        ) : null}
      </main>

      <footer className="bg-white border-t border-mist py-6 text-center text-[11px] text-ink-faint mt-auto">
        <p>MariTrade &mdash; Independent Recipient Confirmation</p>
      </footer>
    </div>
  );
}
