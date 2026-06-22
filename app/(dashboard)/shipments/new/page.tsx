'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import {
  Ship, ChevronLeft, ChevronRight, Globe, MapPin, Coins,
  ClipboardCheck, Zap, Upload, X, Check, Users, Lock,
  Wallet, RefreshCw, FileText, AlertTriangle, Plus, Calendar
} from 'lucide-react';
import { ShipmentScope, MilestoneType, JobRole } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const MILESTONE_BY_JOB: Record<string, MilestoneType[]> = {
  'Freight Forwarder': [
    'BOOKING_CONFIRMED', 'DOCUMENTS_SUBMITTED_TO_CARRIER',
    'CARGO_READY_FOR_COLLECTION', 'SPACE_ON_VESSEL_SECURED',
  ],
  'Shipping Line / Captain': [
    'BILL_OF_LADING_ISSUED', 'CONTAINER_LOADED_ON_VESSEL',
    'VESSEL_DEPARTED_ORIGIN', 'VESSEL_ARRIVED_DESTINATION', 'CONTAINER_OFFLOADED',
  ],
  'Customs Broker': [
    'BOC_ENTRY_FILED', 'DUTIES_AND_TAXES_PAID', 'CUSTOMS_EXAMINATION_REQUESTED',
    'CUSTOMS_CLEARANCE_APPROVED', 'CARGO_RELEASED_FOR_PICKUP',
  ],
  'Warehouse Operator': [
    'CARGO_RECEIVED_AT_WAREHOUSE', 'CARGO_INSPECTED_AND_PACKED',
    'CARGO_STAGED_FOR_PICKUP', 'CARGO_HANDED_OFF_TO_CARRIER', 'INCOMING_CARGO_STORED',
  ],
  'Port Authority': [
    'VESSEL_CLEARED_TO_DEPART', 'CONTAINER_GATED_OUT_ORIGIN',
    'VESSEL_ARRIVED_AT_BERTH', 'CONTAINER_GATED_IN_DESTINATION', 'PORT_HOLD_PLACED_OR_LIFTED',
  ],
  'Trucker': [
    'CARGO_PICKED_UP_FROM_PORT', 'IN_TRANSIT_TO_DESTINATION',
    'ARRIVED_AT_DELIVERY_ADDRESS', 'DELIVERED_AND_SIGNED_OFF', 'FAILED_DELIVERY_ATTEMPT',
  ],
};

const DEFAULT_PRIORITY_MILESTONES: MilestoneType[] = [
  'CUSTOMS_CLEARANCE_APPROVED',
  'DELIVERED_AND_SIGNED_OFF',
];

const JOB_ROLE_LABELS: Record<JobRole, string> = {
  FREIGHT_FORWARDER:      'Freight Forwarder',
  SHIPPING_LINE_CAPTAIN:  'Shipping Line / Captain',
  CUSTOMS_BROKER:         'Customs Broker',
  WAREHOUSE_OPERATOR:     'Warehouse Operator',
  PORT_AUTHORITY_OFFICER: 'Port Authority Officer',
  TRUCKER:                'Trucker',
  IMPORTER:               'Importer',
  EXPORTER:               'Exporter',
  COMPANY_OWNER:          'Company Owner',
  TRADER:                 'Trader',
};

const MILESTONE_LABELS: Record<MilestoneType, string> = {
  BOOKING_CONFIRMED:               'Booking Confirmed',
  DOCUMENTS_SUBMITTED_TO_CARRIER:  'Documents Submitted to Carrier',
  CARGO_READY_FOR_COLLECTION:      'Cargo Ready for Collection',
  SPACE_ON_VESSEL_SECURED:         'Space on Vessel Secured',
  BILL_OF_LADING_ISSUED:           'Bill of Lading Issued',
  CONTAINER_LOADED_ON_VESSEL:      'Container Loaded on Vessel',
  VESSEL_DEPARTED_ORIGIN:          'Vessel Departed Origin',
  VESSEL_ARRIVED_DESTINATION:      'Vessel Arrived at Destination',
  CONTAINER_OFFLOADED:             'Container Offloaded',
  BOC_ENTRY_FILED:                 'BOC Entry Filed',
  DUTIES_AND_TAXES_PAID:           'Duties and Taxes Paid',
  CUSTOMS_EXAMINATION_REQUESTED:   'Customs Examination Requested',
  CUSTOMS_CLEARANCE_APPROVED:      'Customs Clearance Approved',
  CARGO_RELEASED_FOR_PICKUP:       'Cargo Released for Pickup',
  CARGO_RECEIVED_AT_WAREHOUSE:     'Cargo Received at Warehouse',
  CARGO_INSPECTED_AND_PACKED:      'Cargo Inspected and Packed',
  CARGO_STAGED_FOR_PICKUP:         'Cargo Staged for Pickup',
  CARGO_HANDED_OFF_TO_CARRIER:     'Cargo Handed Off to Carrier',
  INCOMING_CARGO_STORED:           'Incoming Cargo Stored',
  VESSEL_CLEARED_TO_DEPART:        'Vessel Cleared to Depart',
  CONTAINER_GATED_OUT_ORIGIN:      'Container Gated Out (Origin)',
  VESSEL_ARRIVED_AT_BERTH:         'Vessel Arrived at Berth',
  CONTAINER_GATED_IN_DESTINATION:  'Container Gated In (Destination)',
  PORT_HOLD_PLACED_OR_LIFTED:      'Port Hold Placed or Lifted',
  CARGO_PICKED_UP_FROM_PORT:       'Cargo Picked Up from Port',
  IN_TRANSIT_TO_DESTINATION:       'In Transit to Destination',
  ARRIVED_AT_DELIVERY_ADDRESS:     'Arrived at Delivery Address',
  DELIVERED_AND_SIGNED_OFF:        'Delivered and Signed Off',
  FAILED_DELIVERY_ATTEMPT:         'Failed Delivery Attempt',
};

const STEPS = [
  { label: 'Cargo Details', icon: ClipboardCheck },
  { label: 'Documents',     icon: FileText },
  { label: 'Logistics',     icon: Users },
  { label: 'Fund Escrow',   icon: Wallet },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewShipmentPage() {
  const router = useRouter();
  const { currentUser, allUsers } = useUserSession();
  const [step, setStep] = useState(1);
  const [errorText, setErrorText] = useState('');

  // ── Step 1 ──
  const [description,     setDescription]     = useState('');
  const [totalValueUSD,   setTotalValueUSD]   = useState('');
  const [originCountry,   setOriginCountry]   = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [shipmentScope,   setShipmentScope]   = useState<ShipmentScope>('OVERSEAS');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const exporterId = 'dav4d-exporter-id';

  // AI autofill
  const [aiText,    setAiText]    = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // ── Step 2 — Documents ──
  const [documents,      setDocuments]      = useState<File[]>([]);
  const [skipDocWarning, setSkipDocWarning] = useState(false);

  // ── Step 3 — Logistics & Milestones ──
  const [assignedUserIds,    setAssignedUserIds]    = useState<string[]>([]);
  const [priorityMilestones, setPriorityMilestones] = useState<MilestoneType[]>(DEFAULT_PRIORITY_MILESTONES);
  const [logisticsSearch,    setLogisticsSearch]    = useState('');

  // ── Step 4 — Escrow ──
  const [phpRate,       setPhpRate]       = useState<number | null>(null);
  const [rateLoading,   setRateLoading]   = useState(false);
  const [rateError,     setRateError]     = useState(false);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [escrowSuccess, setEscrowSuccess] = useState(false);

  // Fetch live PHP/USD rate when Step 4 is reached with NATIONWIDE scope
  useEffect(() => {
    if (step === 4 && shipmentScope === 'NATIONWIDE') fetchPhpRate();
  }, [step, shipmentScope]);

  const fetchPhpRate = async () => {
    setRateLoading(true);
    setRateError(false);
    try {
      const res  = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      if (data?.rates?.PHP) setPhpRate(data.rates.PHP);
      else setRateError(true);
    } catch {
      setRateError(true);
    } finally {
      setRateLoading(false);
    }
  };

  // AI autofill handler
  const handleAutofill = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setErrorText('');
    try {
      const res  = await fetch('/api/gemini/autofill', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ invoiceText: aiText }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDescription(data.data.cargoDescription || '');
        setTotalValueUSD(String(data.data.invoiceValueUSD || ''));
        setOriginCountry(data.data.originCountry || '');
        setDestinationPort(data.data.destinationPort || '');
        if (data.data.shipmentScope) setShipmentScope(data.data.shipmentScope);
      } else {
        setErrorText('Autofill failed — please refine your invoice text.');
      }
    } catch {
      setErrorText('Could not reach Gemini service.');
    } finally {
      setAiLoading(false);
    }
  };

  // Document helpers
  const handleDocAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(prev => [...prev, ...Array.from(e.target.files!)]);
      setSkipDocWarning(false);
    }
  };
  const handleDocRemove = (i: number) =>
    setDocuments(prev => prev.filter((_, idx) => idx !== i));

  // Logistics helpers
  const logisticsUsers = allUsers.filter(u =>
    u.userType === 'LOGISTICS_CHAIN' &&
    u.id !== currentUser.id &&
    (logisticsSearch === '' ||
      u.fullName.toLowerCase().includes(logisticsSearch.toLowerCase()) ||
      (u.companyName || '').toLowerCase().includes(logisticsSearch.toLowerCase()) ||
      JOB_ROLE_LABELS[u.jobRole].toLowerCase().includes(logisticsSearch.toLowerCase()))
  );
  const toggleUser = (id: string) =>
    setAssignedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  const toggleMilestone = (m: MilestoneType) =>
    setPriorityMilestones(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );

  // Step validation
  const validate = (): boolean => {
    setErrorText('');
    if (step === 1) {
      if (!description.trim())
        { setErrorText('Cargo description is required.'); return false; }
      if (!totalValueUSD || Number(totalValueUSD) <= 0)
        { setErrorText('A valid USDC invoice value is required.'); return false; }
      if (!originCountry.trim())
        { setErrorText('Origin country is required.'); return false; }
      if (!destinationPort.trim())
        { setErrorText('Destination port is required.'); return false; }
    }
    if (step === 2 && documents.length === 0 && !skipDocWarning) {
      // Show warning first; user must click Next again to confirm skip
      setSkipDocWarning(true);
      return false;
    }
    if (step === 3 && priorityMilestones.length === 0) {
      setErrorText('Select at least one priority milestone for escrow release.');
      return false;
    }
    return true;
  };

  const nextStep = () => { if (validate()) setStep(s => Math.min(s + 1, 4)); };
  const prevStep = () => {
    setErrorText('');
    setSkipDocWarning(false);
    setStep(s => Math.max(s - 1, 1));
  };

  // Final submit — fund escrow
  const handleFundEscrow = async () => {
    setEscrowLoading(true);
    setErrorText('');
    try {
      const res  = await fetch('/api/shipments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          importerId:            currentUser.id,
          exporterId,
          description,
          totalValueUSD:         Number(totalValueUSD),
          originCountry,
          destinationPort,
          shipmentScope,
          estimatedArrival:      estimatedArrival || undefined,
          selectedLogisticsUsers: assignedUserIds,
          requiredMilestones:    priorityMilestones,
          documentNames:         documents.map(d => d.name),
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setEscrowSuccess(true);
        setTimeout(() => router.push(`/shipments/${json.data.id}`), 2000);
      } else {
        setErrorText(json.error || 'Failed to create shipment.');
      }
    } catch {
      setErrorText('Network error — please try again.');
    } finally {
      setEscrowLoading(false);
    }
  };

  const phpEquivalent = phpRate && totalValueUSD
    ? (Number(totalValueUSD) * phpRate).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="space-y-1 mb-6">
        <button
          onClick={() => router.push('/shipments')}
          className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-bold cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Shipments
        </button>
        <h1 className="text-3xl font-black text-maritime-900 tracking-tight">Book Shipping Record</h1>
        <p className="text-xs text-gray-500">
          Initiate a Stellar multi-signature escrow contract for your incoming cargo.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => {
          const n         = i + 1;
          const active    = step === n;
          const completed = step > n;
          const Icon      = s.icon;
          return (
            <React.Fragment key={n}>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all
                  ${completed ? 'bg-ocean-400 text-white' : active ? 'bg-maritime-400 text-white' : 'bg-sand-200 text-gray-400'}`}>
                  {completed ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-bold hidden sm:block
                  ${active ? 'text-maritime-900' : completed ? 'text-ocean-400' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 transition-all ${step > n ? 'bg-ocean-400' : 'bg-sand-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Error banner */}
      {errorText && (
        <div className="mb-4 bg-coral-50 border border-coral-400/20 text-coral-600 font-semibold text-xs py-2.5 px-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {errorText}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP 1 — Cargo Details
      ══════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Main form */}
          <div className="lg:col-span-3 bg-white border border-sand-200 p-6 rounded-2xl space-y-5">
            <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
              <ClipboardCheck className="w-5 h-5 text-maritime-400" /> Cargo Information
            </h3>

            {/* Scope toggle cards */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">Shipment Scope</label>
              <div className="grid grid-cols-2 gap-3">
                {(['OVERSEAS', 'NATIONWIDE'] as ShipmentScope[]).map(scope => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setShipmentScope(scope)}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer
                      ${shipmentScope === scope
                        ? 'border-maritime-400 bg-maritime-50'
                        : 'border-sand-200 hover:border-maritime-200'}`}
                  >
                    <div className={`text-xs font-black ${shipmentScope === scope ? 'text-maritime-400' : 'text-gray-500'}`}>
                      {scope === 'OVERSEAS' ? '🌏 OVERSEAS' : '🇵🇭 NATIONWIDE'}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {scope === 'OVERSEAS'
                        ? 'USD · International bank/wire transfer'
                        : 'USDC escrow · PHP indicative rate shown'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cargo description */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">
                Cargo Description <span className="text-coral-400">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. 40ft container of high-precision automobile spares (Model RX-9)"
                className="w-full border border-sand-200 rounded-lg p-2.5 text-xs outline-none focus:border-maritime-400 resize-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Invoice value */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">
                  Invoice Value (USDC) <span className="text-coral-400">*</span>
                </label>
                <div className="relative">
                  <Coins className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="number" min="0" placeholder="0.00"
                    className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs font-mono outline-none focus:border-maritime-400"
                    value={totalValueUSD}
                    onChange={e => setTotalValueUSD(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-gray-400">Escrow is always held in USDC on Stellar.</p>
              </div>

              {/* ETA */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Estimated Arrival (ETA)</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="date"
                    className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400"
                    value={estimatedArrival}
                    onChange={e => setEstimatedArrival(e.target.value)}
                  />
                </div>
              </div>

              {/* Origin country */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">
                  Origin Country <span className="text-coral-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text" placeholder="e.g. Japan"
                    className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400"
                    value={originCountry}
                    onChange={e => setOriginCountry(e.target.value)}
                  />
                </div>
              </div>

              {/* Destination port */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">
                  Destination Port <span className="text-coral-400">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text" placeholder="e.g. Port of Cebu"
                    className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400"
                    value={destinationPort}
                    onChange={e => setDestinationPort(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={nextStep}
                className="flex items-center gap-2 bg-maritime-400 hover:bg-maritime-900 text-white font-black py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all"
              >
                Next: Documents <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* AI autofill sidebar */}
          <div className="lg:col-span-2">
            <div className="bg-maritime-900 text-white p-6 rounded-2xl space-y-4">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-ocean-400" /> AI Invoice Autofill
              </h3>
              <p className="text-[11px] text-maritime-200 leading-normal">
                Paste your commercial invoice text and Gemini AI will extract cargo details,
                port codes, and values automatically.
              </p>
              <textarea
                rows={6}
                placeholder={"CONSIGNOR: Osaka Ltd\nITEM: 90 Cartons Solar Inverters\nVALUATION: USD 14,350\nPORT OF ENTRY: Cebu PH"}
                className="w-full bg-maritime-800 text-white border border-maritime-700 rounded-lg p-2.5 text-[11px] outline-none focus:ring-1 focus:ring-ocean-400 font-mono resize-none"
                value={aiText}
                onChange={e => setAiText(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAutofill}
                disabled={aiLoading}
                className="bg-ocean-400 hover:bg-ocean-600 text-maritime-900 w-full font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-60"
              >
                {aiLoading ? 'Analysing...' : 'Extract Invoice Parameters'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP 2 — Documents
      ══════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="bg-white border border-sand-200 p-6 rounded-2xl space-y-5">
          <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
            <FileText className="w-5 h-5 text-maritime-400" /> Upload Shipping Documents
          </h3>
          <p className="text-xs text-gray-500">
            Upload bills of lading, commercial invoices, packing lists, or any BOC-relevant files.
            All uploads are automatically grouped under this shipment&apos;s reference code in the Document Center.
          </p>

          {/* Drop zone */}
          <label className="block border-2 border-dashed border-sand-200 hover:border-maritime-400 rounded-xl p-10 text-center cursor-pointer transition-all group">
            <Upload className="w-9 h-9 text-gray-300 group-hover:text-maritime-400 mx-auto mb-2 transition-all" />
            <p className="text-xs font-bold text-gray-500 group-hover:text-maritime-400">
              Click to upload or drag &amp; drop
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              PDF, DOC, XLS, PNG, JPG — any file type accepted
            </p>
            <input type="file" multiple className="hidden" onChange={handleDocAdd} />
          </label>

          {/* File list */}
          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-sand-50 border border-sand-200 rounded-lg px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-maritime-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700 truncate max-w-sm">{doc.name}</p>
                      <p className="text-[10px] text-gray-400">{(doc.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDocRemove(i)}
                    className="text-gray-400 hover:text-coral-400 cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Skip warning */}
          {skipDocWarning && documents.length === 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                No documents uploaded. You can continue, but documents must be added in the Document Center
                before customs clearance can proceed.{' '}
                <strong>Click Next again to skip anyway.</strong>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={prevStep}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-maritime-900 font-bold cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={nextStep}
              className="flex items-center gap-2 bg-maritime-400 hover:bg-maritime-900 text-white font-black py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all"
            >
              Next: Assign Logistics <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP 3 — Logistics & Priority Milestones
      ══════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assign logistics users */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl space-y-4">
              <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
                <Users className="w-5 h-5 text-maritime-400" /> Assign Logistics Chain Users
              </h3>
              <p className="text-xs text-gray-500">
                Assigned users can log milestone events on this shipment.
                Customs Brokers also gain access to BOC documents.
              </p>
              <input
                type="text"
                placeholder="Search by name, company, or role..."
                className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-maritime-400"
                value={logisticsSearch}
                onChange={e => setLogisticsSearch(e.target.value)}
              />
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {logisticsUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No users found.</p>
                ) : logisticsUsers.map(user => {
                  const assigned = assignedUserIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all cursor-pointer
                        ${assigned
                          ? 'border-ocean-400 bg-ocean-50'
                          : 'border-sand-200 hover:border-maritime-200'}`}
                    >
                      <div>
                        <p className="text-xs font-bold text-maritime-900">{user.fullName}</p>
                        <p className="text-[10px] text-gray-500">
                          {user.companyName} · {JOB_ROLE_LABELS[user.jobRole]}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                        ${assigned ? 'bg-ocean-400 text-white' : 'bg-sand-100 text-gray-400'}`}>
                        {assigned ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {assignedUserIds.length > 0 && (
                <p className="text-[10px] text-ocean-400 font-bold">
                  {assignedUserIds.length} user{assignedUserIds.length > 1 ? 's' : ''} assigned
                </p>
              )}
            </div>

            {/* Priority milestones */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl space-y-4">
              <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
                <Lock className="w-5 h-5 text-maritime-400" /> Priority Milestones for Escrow Release
              </h3>
              <p className="text-xs text-gray-500">
                The <strong>Release Funds</strong> button stays locked until{' '}
                <strong>all</strong> selected milestones are confirmed by the logistics chain.
              </p>
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {Object.entries(MILESTONE_BY_JOB).map(([group, types]) => (
                  <div key={group}>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                      {group}
                    </p>
                    <div className="space-y-1">
                      {types.map(type => {
                        const selected = priorityMilestones.includes(type);
                        return (
                          <button
                            key={type}
                            onClick={() => toggleMilestone(type)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer text-xs
                              ${selected
                                ? 'border-maritime-400 bg-maritime-50 text-maritime-900 font-semibold'
                                : 'border-sand-200 text-gray-500 hover:border-maritime-200'}`}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0
                              ${selected ? 'bg-maritime-400' : 'bg-sand-100'}`}>
                              {selected && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            {MILESTONE_LABELS[type]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {priorityMilestones.length > 0 && (
                <p className="text-[10px] text-maritime-400 font-bold">
                  {priorityMilestones.length} milestone{priorityMilestones.length > 1 ? 's' : ''} required for fund release
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={prevStep}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-maritime-900 font-bold cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={nextStep}
              className="flex items-center gap-2 bg-maritime-400 hover:bg-maritime-900 text-white font-black py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all"
            >
              Next: Fund Escrow <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP 4 — Fund Escrow
      ══════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Shipment summary */}
          <div className="lg:col-span-3 bg-white border border-sand-200 p-6 rounded-2xl space-y-5">
            <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
              <ClipboardCheck className="w-5 h-5 text-maritime-400" /> Shipment Summary
            </h3>
            <dl className="text-xs divide-y divide-sand-100">
              {([
                ['Scope', (
                  <span className={`font-black px-2 py-0.5 rounded text-[10px]
                    ${shipmentScope === 'OVERSEAS'
                      ? 'bg-maritime-100 text-maritime-700'
                      : 'bg-ocean-50 text-ocean-600'}`}>
                    {shipmentScope}
                  </span>
                )],
                ['Cargo',                description],
                ['Route',                `${originCountry} → ${destinationPort}`],
                ['ETA',                  estimatedArrival || 'Not specified'],
                ['Documents',            documents.length > 0
                  ? `${documents.length} file${documents.length > 1 ? 's' : ''} uploaded`
                  : 'None — add later in Document Center'],
                ['Logistics Assigned',   assignedUserIds.length > 0
                  ? `${assignedUserIds.length} user${assignedUserIds.length > 1 ? 's' : ''}`
                  : 'None assigned'],
                ['Priority Milestones',  `${priorityMilestones.length} required for release`],
              ] as [string, React.ReactNode][]).map(([label, value], i) => (
                <div key={i} className="flex items-start justify-between py-2.5 gap-4">
                  <dt className="text-gray-400 font-semibold flex-shrink-0">{label}</dt>
                  <dd className="text-right font-semibold text-maritime-900">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="pt-2">
              <button
                onClick={prevStep}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-maritime-900 font-bold cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </div>
          </div>

          {/* Escrow payment panel */}
          <div className="lg:col-span-2">
            <div className="bg-maritime-900 text-white p-6 rounded-2xl space-y-5">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Wallet className="w-5 h-5 text-ocean-400" /> Stellar Escrow
              </h3>

              {/* USDC amount */}
              <div className="bg-maritime-800 rounded-xl p-4 space-y-1">
                <p className="text-[10px] text-maritime-300 font-semibold uppercase tracking-wider">
                  Escrow Amount
                </p>
                <p className="text-3xl font-black text-white font-mono">
                  {Number(totalValueUSD).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-xs text-ocean-400 font-bold">USDC · Stellar Network</p>
              </div>

              {/* PHP equivalent — NATIONWIDE only */}
              {shipmentScope === 'NATIONWIDE' && (
                <div className="bg-maritime-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-maritime-300 font-semibold uppercase tracking-wider">
                      PHP Equivalent
                    </p>
                    <button
                      onClick={fetchPhpRate}
                      disabled={rateLoading}
                      title="Refresh exchange rate"
                      className="text-ocean-400 hover:text-ocean-300 cursor-pointer disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3 h-3 ${rateLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {rateLoading && (
                    <p className="text-sm text-maritime-400 animate-pulse">Fetching live rate…</p>
                  )}
                  {!rateLoading && rateError && (
                    <p className="text-xs text-coral-400">
                      Rate unavailable — tap ↻ to retry.
                    </p>
                  )}
                  {!rateLoading && !rateError && phpEquivalent && (
                    <>
                      <p className="text-2xl font-black text-white font-mono">₱ {phpEquivalent}</p>
                      <p className="text-[10px] text-maritime-400">
                        Live rate: 1 USD = ₱{phpRate?.toFixed(4)}
                      </p>
                    </>
                  )}

                  <div className="flex items-start gap-1.5 pt-1 border-t border-maritime-700">
                    <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-400 leading-relaxed">
                      Escrow is always settled in <strong>USDC</strong>, regardless of scope.
                      PHP rate is indicative only and not used for on-chain settlement.
                    </p>
                  </div>
                </div>
              )}

              {/* Fund / success button */}
              {escrowSuccess ? (
                <div className="bg-ocean-400 rounded-xl p-4 flex items-center gap-3">
                  <Check className="w-6 h-6 text-white flex-shrink-0" />
                  <div>
                    <p className="text-sm font-black text-white">Escrow Funded!</p>
                    <p className="text-[10px] text-white/80">Redirecting to shipment record…</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleFundEscrow}
                  disabled={escrowLoading}
                  className="w-full bg-ocean-400 hover:bg-ocean-600 text-maritime-900 font-black py-3 rounded-xl text-sm uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {escrowLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                  ) : (
                    <><Ship className="w-4 h-4" /> Fund Escrow via Stellar</>
                  )}
                </button>
              )}

              <p className="text-[10px] text-maritime-400 text-center leading-relaxed">
                Funds are locked in a multi-signature Stellar escrow until all priority
                milestones are confirmed and you approve the release.
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
