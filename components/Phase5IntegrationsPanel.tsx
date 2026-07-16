'use client';

/**
 * components/Phase5IntegrationsPanel.tsx
 *
 * Phase 5 — Direct System Integration, display side. Surfaces the four
 * integrations built in lib/integrations/*.ts + their API routes:
 *   - Carrier booking API        (Freight Forwarder)
 *   - BOC e2m entry filing/duty  (Customs Broker)
 *   - Duty pre-funding           (Importer authorizes, Customs Broker captures)
 *   - Trade finance (LC) links   (Importer)
 *
 * Every section here can render in one of two states depending on whether
 * the deployment has the underlying provider configured:
 *   - Configured: the action button calls through to the real integration
 *     and, on success, auto-logs the milestone as SYSTEM_VERIFIED.
 *   - Not configured: the button still records the *intent* (e.g. an
 *     AUTHORIZED pre-funding row, or a NOT_FILED filing row) but responds
 *     with `fallbackToManual: true`, which this panel surfaces as a plain
 *     note pointing back at the ordinary "+ Log Milestone" flow — never as
 *     an error, since not-configured is the expected state for most
 *     deployments today (see the SANDBOX NOTE in each lib/integrations file).
 *
 * Sections are independently visible based on role, mirroring the
 * getMilestonesForUser() gates already used by the milestone-logging flow.
 */

import { useEffect, useState, FormEvent } from 'react';
import {
  Ship, Landmark, Wallet, FileStack, RefreshCw, AlertTriangle, CheckCircle2,
  Info, PlusCircle, X,
} from 'lucide-react';
import { authFetch } from '@/hooks/use-user-session';
import {
  User, Shipment, getMilestonesForUser, userHasJobRole,
  BocEntryFiling, CarrierBookingRequest, DutyPreFundingAuthorization, TradeFinanceLink,
  TradeFinanceInstrumentType,
} from '@/types';

interface Props {
  shipment: Shipment;
  currentUser: User;
}

/** Small reusable "not configured — falls back to manual" note. Never styled
 *  as an error — this is the expected default state for most deployments. */
function FallbackNote({ message }: { message?: string }) {
  return (
    <div className="flex items-start gap-1.5 text-[10px] text-ink-faint bg-mist-light border border-mist rounded-lg px-2.5 py-2">
      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <span>
        {message || 'This integration isn\u2019t connected for this deployment yet.'} Use the ordinary{' '}
        <strong>+ Log Milestone</strong> flow to continue manually — nothing is blocked.
      </span>
    </div>
  );
}

export default function Phase5IntegrationsPanel({ shipment, currentUser }: Props) {
  const isImporter = currentUser.id === shipment.importerId;
  const canFileBoc = getMilestonesForUser(currentUser).includes('BOC_ENTRY_FILED');
  const canBook = getMilestonesForUser(currentUser).includes('BOOKING_CONFIRMED');
  const isCustomsBroker = userHasJobRole(currentUser, 'CUSTOMS_BROKER');

  const showCarrier = canBook;
  const showBoc = canFileBoc;
  const showDutyPreFunding = isImporter || isCustomsBroker;
  const showTradeFinance = isImporter;

  if (!showCarrier && !showBoc && !showDutyPreFunding && !showTradeFinance) return null;

  return (
    <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-6">
      <div className="space-y-1">
        <h3 className="font-extrabold text-sm text-ink tracking-tight flex items-center gap-2">
          <Landmark className="w-5 h-5 text-steel" /><span>Direct System Integrations</span>
        </h3>
        <p className="text-[10px] text-ink-faint leading-relaxed">
          File, book, and pre-fund directly through MariTrade instead of a separate outside system — each falls
          back to manual milestone logging automatically if not connected for your organization.
        </p>
      </div>

      {showCarrier && <CarrierBookingSection shipment={shipment} currentUser={currentUser} />}
      {showBoc && <BocFilingSection shipment={shipment} currentUser={currentUser} />}
      {showDutyPreFunding && (
        <DutyPreFundingSection shipment={shipment} currentUser={currentUser} isImporter={isImporter} isCustomsBroker={isCustomsBroker} />
      )}
      {showTradeFinance && <TradeFinanceSection shipment={shipment} currentUser={currentUser} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Carrier booking
// ═══════════════════════════════════════════════════════════════════════════

function CarrierBookingSection({ shipment, currentUser }: { shipment: Shipment; currentUser: User }) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<CarrierBookingRequest[]>([]);
  const [carriers, setCarriers] = useState<Record<string, { label: string }>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [carrierCode, setCarrierCode] = useState('');
  const [containerType, setContainerType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fallbackMsg, setFallbackMsg] = useState<string | null>(null);

  const load = () => {
    authFetch(`/api/shipments/${shipment.id}/carrier-booking`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setBookings(json.data ?? []);
          setCarriers(json.supportedCarriers ?? {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [shipment.id]);

  const confirmed = bookings.find(b => b.status === 'CONFIRMED');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!carrierCode) return;
    setSubmitting(true);
    setError('');
    setFallbackMsg(null);
    try {
      const res = await authFetch(`/api/shipments/${shipment.id}/carrier-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedByUserId: currentUser.id, carrierCode, containerType: containerType || undefined }),
      });
      const json = await res.json();
      if (!json.success && !json.fallbackToManual) { setError(json.error || 'Booking request failed.'); return; }
      if (json.fallbackToManual) setFallbackMsg(json.message);
      else setFormOpen(false);
      load();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2.5 border-t border-mist-light pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-ink flex items-center gap-1.5"><Ship className="w-3.5 h-3.5 text-steel" /> Carrier Booking API</h4>
        {!confirmed && (
          <button type="button" onClick={() => setFormOpen(o => !o)}
            className="flex items-center gap-1 text-[10px] font-bold text-steel hover:text-teal">
            <PlusCircle className="w-3.5 h-3.5" /> {formOpen ? 'Cancel' : 'Book Space'}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-[10px] text-ink-faint flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Loading booking status…</p>
      ) : confirmed ? (
        <div className="flex items-start gap-1.5 text-[11px] text-steel bg-teal-light border border-steel-light rounded-lg px-2.5 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>{carriers[confirmed.carrierCode]?.label ?? confirmed.carrierCode}</strong> booking confirmed —
            ref <strong>{confirmed.bookingReference}</strong>
            {confirmed.vesselName && <>, vessel <strong>{confirmed.vesselName}</strong>{confirmed.voyageNumber ? ` (voyage ${confirmed.voyageNumber})` : ''}</>}.
            BOOKING_CONFIRMED was logged automatically as system-verified.
          </span>
        </div>
      ) : bookings.some(b => b.status === 'FAILED') ? (
        <p className="text-[10px] text-wine">Last booking attempt failed — {bookings[0]?.failureReason || 'see error above'}. You can retry or log the milestone manually.</p>
      ) : (
        <p className="text-[10px] text-ink-faint">No booking requested yet — book through a carrier API below, or use + Log Milestone to enter a reference manually.</p>
      )}

      {fallbackMsg && <FallbackNote message={fallbackMsg} />}
      {error && (
        <div className="flex items-start gap-1.5 text-[10px] text-wine bg-wine-light border border-wine/20 rounded-lg px-2.5 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      {formOpen && !confirmed && (
        <form onSubmit={handleSubmit} className="space-y-2.5 bg-mist-light border border-mist rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-ink-faint uppercase tracking-wide">Carrier</label>
              <select required value={carrierCode} onChange={e => setCarrierCode(e.target.value)}
                className="w-full border border-mist rounded-lg p-1.5 text-[11px] outline-none bg-white">
                <option value="">Select…</option>
                {Object.entries(carriers).map(([code, c]) => <option key={code} value={code}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-ink-faint uppercase tracking-wide">Container Type</label>
              <input type="text" value={containerType} onChange={e => setContainerType(e.target.value)}
                placeholder="e.g. 40HC" className="w-full border border-mist rounded-lg p-1.5 text-[11px] outline-none" />
            </div>
          </div>
          <button type="submit" disabled={submitting || !carrierCode}
            className="w-full bg-steel hover:bg-teal text-white font-bold text-[11px] py-1.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
            {submitting ? <><RefreshCw className="w-3 h-3 animate-spin" /> Requesting…</> : 'Request Booking'}
          </button>
        </form>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  BOC e2m filing
// ═══════════════════════════════════════════════════════════════════════════

function BocFilingSection({ shipment, currentUser }: { shipment: Shipment; currentUser: User }) {
  const [loading, setLoading] = useState(true);
  const [filing, setFiling] = useState<BocEntryFiling | null>(null);
  const [working, setWorking] = useState<'FILE_ENTRY' | 'PAY_DUTY' | null>(null);
  const [error, setError] = useState('');
  const [fallbackMsg, setFallbackMsg] = useState<string | null>(null);

  const load = () => {
    authFetch(`/api/shipments/${shipment.id}/boc-filing`)
      .then(r => r.json())
      .then(json => { if (json.success) setFiling(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [shipment.id]);

  const runAction = async (action: 'FILE_ENTRY' | 'PAY_DUTY') => {
    setWorking(action);
    setError('');
    setFallbackMsg(null);
    try {
      const res = await authFetch(`/api/shipments/${shipment.id}/boc-filing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filedByUserId: currentUser.id, action, cargoDescription: shipment.description }),
      });
      const json = await res.json();
      if (!json.success && !json.fallbackToManual) { setError(json.error || 'Request failed.'); return; }
      if (json.fallbackToManual) setFallbackMsg(json.message);
      load();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setWorking(null);
    }
  };

  const entryConfirmed = filing?.status === 'CONFIRMED' && !!filing.entrySeriesNumber;
  const dutyPaid = !!filing?.officialReceiptNumber;

  return (
    <div className="space-y-2.5 border-t border-mist-light pt-4">
      <h4 className="text-xs font-bold text-ink flex items-center gap-1.5"><FileStack className="w-3.5 h-3.5 text-wine" /> BOC e2m Filing</h4>

      {loading ? (
        <p className="text-[10px] text-ink-faint flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Loading filing status…</p>
      ) : (
        <div className="space-y-2">
          {entryConfirmed ? (
            <div className="flex items-start gap-1.5 text-[11px] text-steel bg-teal-light border border-steel-light rounded-lg px-2.5 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Entry filed — series no. <strong>{filing!.entrySeriesNumber}</strong>
                {filing!.dutiesAssessedUSD != null && <> · duties assessed ${filing!.dutiesAssessedUSD.toLocaleString()}</>}.
                BOC_ENTRY_FILED logged automatically as system-verified.</span>
            </div>
          ) : (
            <button type="button" onClick={() => runAction('FILE_ENTRY')} disabled={working !== null}
              className="w-full bg-wine/90 hover:bg-wine text-white font-bold text-[11px] py-1.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
              {working === 'FILE_ENTRY' ? <><RefreshCw className="w-3 h-3 animate-spin" /> Filing…</> : 'File Entry via BOC e2m'}
            </button>
          )}

          {entryConfirmed && !dutyPaid && (
            <button type="button" onClick={() => runAction('PAY_DUTY')} disabled={working !== null}
              className="w-full bg-wine/90 hover:bg-wine text-white font-bold text-[11px] py-1.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
              {working === 'PAY_DUTY' ? <><RefreshCw className="w-3 h-3 animate-spin" /> Confirming…</> : 'Confirm Duty Payment via e2m'}
            </button>
          )}

          {dutyPaid && (
            <div className="flex items-start gap-1.5 text-[11px] text-steel bg-teal-light border border-steel-light rounded-lg px-2.5 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Duty payment confirmed — receipt no. <strong>{filing!.officialReceiptNumber}</strong>.
                DUTIES_AND_TAXES_PAID logged automatically as system-verified.</span>
            </div>
          )}
        </div>
      )}

      {fallbackMsg && <FallbackNote message={fallbackMsg} />}
      {error && (
        <div className="flex items-start gap-1.5 text-[10px] text-wine bg-wine-light border border-wine/20 rounded-lg px-2.5 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Duty pre-funding
// ═══════════════════════════════════════════════════════════════════════════

function DutyPreFundingSection({
  shipment, currentUser, isImporter, isCustomsBroker,
}: { shipment: Shipment; currentUser: User; isImporter: boolean; isCustomsBroker: boolean }) {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState<DutyPreFundingAuthorization | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [fallbackMsg, setFallbackMsg] = useState<string | null>(null);

  const load = () => {
    authFetch(`/api/shipments/${shipment.id}/duty-prefunding`)
      .then(r => r.json())
      .then(json => { if (json.success) setAuth(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [shipment.id]);

  const runAction = async (action: 'AUTHORIZE' | 'CAPTURE' | 'CANCEL') => {
    setWorking(true);
    setError('');
    setFallbackMsg(null);
    try {
      const res = await authFetch(`/api/shipments/${shipment.id}/duty-prefunding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId: currentUser.id,
          estimatedDutyAmountUSD: action === 'AUTHORIZE' ? Number(amountInput) : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success && !json.fallbackToManual) { setError(json.error || 'Request failed.'); return; }
      if (json.fallbackToManual) setFallbackMsg(json.message);
      load();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-2.5 border-t border-mist-light pt-4">
      <h4 className="text-xs font-bold text-ink flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-amber" /> Duty Pre-Funding</h4>
      <p className="text-[10px] text-ink-faint leading-relaxed">
        Pre-authorize the estimated BOC duty amount so your Customs Broker can draw on it directly instead of a separate payment channel.
      </p>

      {loading ? (
        <p className="text-[10px] text-ink-faint flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Loading pre-funding status…</p>
      ) : (
        <div className="space-y-2">
          {!auth || auth.status === 'NOT_REQUESTED' || auth.status === 'CANCELLED' ? (
            isImporter ? (
              <div className="flex gap-2">
                <input type="number" min={0} step={0.01} value={amountInput} onChange={e => setAmountInput(e.target.value)}
                  placeholder="Estimated duty (USD)"
                  className="flex-1 border border-mist rounded-lg p-1.5 text-[11px] outline-none" />
                <button type="button" onClick={() => runAction('AUTHORIZE')} disabled={working || !amountInput}
                  className="shrink-0 bg-amber hover:bg-ink text-white font-bold text-[11px] px-3 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                  {working ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Authorize'}
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-ink-faint">No duty pre-funding authorized yet — the importer can set this up.</p>
            )
          ) : auth.status === 'AUTHORIZED' ? (
            <>
              <div className="flex items-start gap-1.5 text-[11px] text-amber bg-amber-light border border-amber-light rounded-lg px-2.5 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>${auth.estimatedDutyAmountUSD.toLocaleString()} authorized{auth.authorizedAt && <> on {new Date(auth.authorizedAt).toLocaleDateString()}</>}, awaiting capture.</span>
              </div>
              {isCustomsBroker && (
                <button type="button" onClick={() => runAction('CAPTURE')} disabled={working}
                  className="w-full bg-steel hover:bg-teal text-white font-bold text-[11px] py-1.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {working ? <><RefreshCw className="w-3 h-3 animate-spin" /> Capturing…</> : 'Capture for Duty Payment'}
                </button>
              )}
              {isImporter && (
                <button type="button" onClick={() => runAction('CANCEL')} disabled={working}
                  className="w-full border border-mist-dark text-ink-faint hover:text-wine hover:border-wine font-bold text-[10px] py-1.5 rounded-lg">
                  Cancel Hold
                </button>
              )}
            </>
          ) : auth.status === 'CAPTURED' ? (
            <div className="flex items-start gap-1.5 text-[11px] text-steel bg-teal-light border border-steel-light rounded-lg px-2.5 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>${(auth.capturedAmountUSD ?? auth.estimatedDutyAmountUSD).toLocaleString()} captured{auth.capturedAt && <> on {new Date(auth.capturedAt).toLocaleDateString()}</>} for BOC duty payment.</span>
            </div>
          ) : null}
        </div>
      )}

      {fallbackMsg && <FallbackNote message={fallbackMsg} />}
      {error && (
        <div className="flex items-start gap-1.5 text-[10px] text-wine bg-wine-light border border-wine/20 rounded-lg px-2.5 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Trade finance links
// ═══════════════════════════════════════════════════════════════════════════

const INSTRUMENT_LABELS: Record<TradeFinanceInstrumentType, string> = {
  LETTER_OF_CREDIT: 'Letter of Credit',
  INVOICE_FINANCING: 'Invoice Financing',
  SUPPLY_CHAIN_FINANCE: 'Supply Chain Finance',
};

function TradeFinanceSection({ shipment, currentUser }: { shipment: Shipment; currentUser: User }) {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<TradeFinanceLink[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [instrumentType, setInstrumentType] = useState<TradeFinanceInstrumentType>('LETTER_OF_CREDIT');
  const [providerName, setProviderName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [faceValue, setFaceValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    authFetch(`/api/shipments/${shipment.id}/trade-finance`)
      .then(r => r.json())
      .then(json => { if (json.success) setLinks(json.data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [shipment.id]);

  const openModal = () => {
    setInstrumentType('LETTER_OF_CREDIT');
    setProviderName('');
    setReferenceNumber('');
    setFaceValue('');
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!providerName.trim() || !referenceNumber.trim() || !faceValue) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await authFetch(`/api/shipments/${shipment.id}/trade-finance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importerId: currentUser.id,
          instrumentType,
          providerName: providerName.trim(),
          referenceNumber: referenceNumber.trim(),
          faceValueUSD: Number(faceValue),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setModalOpen(false);
        load();
      } else {
        setError(json.error || 'Failed to link instrument.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2.5 border-t border-mist-light pt-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-ink flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5 text-steel" /> Trade Finance Links</h4>
        <button type="button" onClick={openModal} className="flex items-center gap-1 text-[10px] font-bold text-steel hover:text-teal">
          <PlusCircle className="w-3.5 h-3.5" /> Link Instrument
        </button>
      </div>

      {loading ? (
        <p className="text-[10px] text-ink-faint flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Loading linked instruments…</p>
      ) : links.length === 0 ? (
        <p className="text-[10px] text-ink-faint">No LC or financing instrument linked to this shipment yet.</p>
      ) : (
        <div className="space-y-1.5">
          {links.map(l => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-[11px] border border-mist rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="font-bold text-ink truncate">{INSTRUMENT_LABELS[l.instrumentType]} — {l.providerName}</p>
                <p className="text-[10px] text-ink-faint truncate">
                  Ref {l.referenceNumber} · ${l.faceValueUSD.toLocaleString()} · escrow was {l.escrowStatusAtLink} at link time
                </p>
              </div>
              <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide bg-steel-light text-steel-hover border border-steel-light">
                {l.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-mist rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-steel-light rounded-xl flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5 text-steel" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-sm text-ink">Link Financing Instrument</h3>
                <p className="text-[10px] text-ink-faint font-sans">{shipment.referenceCode}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-ink-faint hover:text-ink"><X className="w-4 h-4" /></button>
            </div>

            {error && (
              <div className="bg-wine-light border border-wine/20 text-wine text-xs p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Instrument Type</label>
                <select value={instrumentType} onChange={e => setInstrumentType(e.target.value as TradeFinanceInstrumentType)}
                  className="w-full border border-mist rounded-lg p-2 text-xs outline-none bg-white">
                  {(Object.keys(INSTRUMENT_LABELS) as TradeFinanceInstrumentType[]).map(t => (
                    <option key={t} value={t}>{INSTRUMENT_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Issuing Bank / Provider <span className="text-wine">*</span></label>
                <input type="text" required value={providerName} onChange={e => setProviderName(e.target.value)}
                  placeholder="e.g. BDO Unibank" className="w-full border border-mist rounded-lg p-2 text-xs outline-none" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Reference Number <span className="text-wine">*</span></label>
                <input type="text" required value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)}
                  placeholder="LC / instrument reference" className="w-full border border-mist rounded-lg p-2 text-xs outline-none" />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-ink-faint text-[10px] uppercase tracking-wide">Face Value (USD) <span className="text-wine">*</span></label>
                <input type="number" required min={0} step={0.01} value={faceValue} onChange={e => setFaceValue(e.target.value)}
                  placeholder="0.00" className="w-full border border-mist rounded-lg p-2 text-xs outline-none" />
              </div>
              <p className="text-[10px] text-ink-faint leading-relaxed">
                This shipment&apos;s current escrow status (<strong>{shipment.escrowStatus}</strong>) will be snapshotted at link time for the financing provider&apos;s reference.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="px-4 py-1.5 bg-steel hover:bg-teal text-white rounded-lg font-black disabled:opacity-50 flex items-center gap-1.5">
                  {submitting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Linking…</> : 'Link Instrument'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
