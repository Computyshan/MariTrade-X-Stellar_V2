'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import {
  Ship, ChevronLeft, ChevronRight, Globe, MapPin, Coins,
  ClipboardCheck, Zap, Upload, X, Check, Users, Lock,
  Wallet, RefreshCw, FileText, AlertTriangle, Plus, Calendar,
  Building2, Package, Weight, Search, ToggleLeft, ToggleRight,
  DollarSign, Hash
} from 'lucide-react';
import { ShipmentScope, MilestoneType, JobRole } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

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

const HS_CODE_SUGGESTIONS = [
  { code: '8471.30', description: 'Portable automatic data-processing machines (laptops)' },
  { code: '8517.12', description: 'Telephones for cellular networks (smartphones)' },
  { code: '8704.21', description: 'Motor vehicles for goods transport, diesel' },
  { code: '6109.10', description: 'T-shirts and singlets, knitted, cotton' },
  { code: '0303.89', description: 'Frozen fish, excluding fillets' },
  { code: '2709.00', description: 'Petroleum oils and oils from bituminous minerals, crude' },
  { code: '8544.42', description: 'Electric conductors, fitted with connectors' },
  { code: '9403.20', description: 'Metal furniture of a kind used in offices' },
  { code: '8501.10', description: 'Electric motors of an output not exceeding 37.5W' },
  { code: '3926.90', description: 'Other articles of plastics' },
];

const PACKAGING_TYPES = ['Cartons', 'Pallets', 'Crates', 'Drums', 'Bags', 'Bales', 'Rolls', 'Bundles', 'Containers (20ft)', 'Containers (40ft)'];

// ─── Sub-section Header ───────────────────────────────────────────────────────

function SubSectionHeader({ icon: Icon, title, description, accent }: {
  icon: React.ElementType;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border-l-4 ${accent} bg-opacity-40 mb-5`}>
      <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-maritime-400" />
      </div>
      <div>
        <h4 className="text-sm font-extrabold text-maritime-900">{title}</h4>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{description}</p>
      </div>
    </div>
  );
}

// ─── Read-only country badge for Nationwide ───────────────────────────────────

function PhilippinesBadge() {
  return (
    <div className="flex items-center gap-2 bg-sand-100 border border-sand-200 rounded-lg px-3 py-2 text-xs cursor-not-allowed select-none">
      <span>🇵🇭</span>
      <span className="font-bold text-maritime-900">Philippines</span>
      <span className="ml-auto text-[9px] bg-maritime-100 text-maritime-400 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Auto-set</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewShipmentPage() {
  const router = useRouter();
  const { currentUser, allUsers } = useUserSession();
  const [step, setStep] = useState(1);
  const [errorText, setErrorText] = useState('');

  // ── Step 1 · SCOPE ──────────────────────────────────────────────────────────
  const [shipmentScope,    setShipmentScope]    = useState<ShipmentScope>('OVERSEAS');
  const [description,      setDescription]      = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [originCountry,    setOriginCountry]    = useState('');
  const [originAddress,    setOriginAddress]    = useState('');
  const [originPort,       setOriginPort]       = useState('');
  const [destCountry,      setDestCountry]      = useState('');
  const [destAddress,      setDestAddress]      = useState('');
  const [destinationPort,  setDestinationPort]  = useState('');
  const [importerContact,  setImporterContact]  = useState('');
  const [exporterContact,  setExporterContact]  = useState('');

  // ── Step 1 · COMMERCIAL VALUE ──────────────────────────────────────────────
  const [invoiceCurrency,  setInvoiceCurrency]  = useState<'USD' | 'PHP' | 'EUR' | 'JPY'>('USD');
  const [invoiceValue,     setInvoiceValue]     = useState('');
  const [totalValueUSD,    setTotalValueUSD]    = useState('');
  const [hsCode,           setHsCode]           = useState('');
  const [hsSearch,         setHsSearch]         = useState('');
  const [hsDropOpen,       setHsDropOpen]       = useState(false);
  const [oracleRate,       setOracleRate]       = useState<{ rate: number; label: string } | null>(null);
  const [oracleLoading,    setOracleLoading]    = useState(false);
  const hsRef = useRef<HTMLDivElement>(null);

  // ── Step 1 · PHYSICAL SPECIFICATIONS ──────────────────────────────────────
  const [isDangerousGoods, setIsDangerousGoods] = useState(false);
  const [packageCount,     setPackageCount]     = useState('');
  const [packagingType,    setPackagingType]    = useState('Cartons');
  const [grossWeight,      setGrossWeight]      = useState('');
  const [weightUnit,       setWeightUnit]       = useState<'KG' | 'LBS'>('KG');

  const exporterId = 'dav4d-exporter-id';
  const [aiText,    setAiText]    = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // ── Step 2 — Documents ──────────────────────────────────────────────────────
  const [documents,      setDocuments]      = useState<File[]>([]);
  const [skipDocWarning, setSkipDocWarning] = useState(false);

  // ── Step 3 — Logistics & Milestones ────────────────────────────────────────
  const [assignedUserIds,    setAssignedUserIds]    = useState<string[]>([]);
  const [priorityMilestones, setPriorityMilestones] = useState<MilestoneType[]>(DEFAULT_PRIORITY_MILESTONES);
  const [logisticsSearch,    setLogisticsSearch]    = useState('');

  // ── Step 4 — Escrow ─────────────────────────────────────────────────────────
  const [phpRate,       setPhpRate]       = useState<number | null>(null);
  const [rateLoading,   setRateLoading]   = useState(false);
  const [rateError,     setRateError]     = useState(false);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [escrowSuccess, setEscrowSuccess] = useState(false);

  // ── Auto-lock country fields when scope is NATIONWIDE ───────────────────────
  useEffect(() => {
    if (shipmentScope === 'NATIONWIDE') {
      setOriginCountry('Philippines');
      setDestCountry('Philippines');
    }
  }, [shipmentScope]);

  // ── Fetch oracle rate whenever invoice currency or value changes ─────────────
  useEffect(() => {
    if (!invoiceValue || Number(invoiceValue) <= 0) {
      setOracleRate(null);
      setTotalValueUSD('');
      return;
    }
    const timeout = setTimeout(() => fetchOracleRate(invoiceCurrency), 600);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceCurrency, invoiceValue]);

  const fetchOracleRate = async (currency: string) => {
    setOracleLoading(true);
    try {
      if (currency === 'USD') {
        setOracleRate({ rate: 1, label: '1 USD = 1.0002 USDC (Stellar peg)' });
        setTotalValueUSD(invoiceValue);
      } else {
        const res  = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
        const data = await res.json();
        const toUSD = data?.rates?.USD ?? null;
        if (toUSD) {
          const usdcVal = (Number(invoiceValue) * toUSD * 1.0002).toFixed(2);
          setOracleRate({
            rate: toUSD,
            label: `1 ${currency} = ${toUSD.toFixed(6)} USD ≈ ${(toUSD * 1.0002).toFixed(6)} USDC`,
          });
          setTotalValueUSD(usdcVal);
        }
      }
    } catch {
      setOracleRate(null);
    } finally {
      setOracleLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (hsRef.current && !hsRef.current.contains(e.target as Node)) {
        setHsDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredHs = HS_CODE_SUGGESTIONS.filter(h =>
    h.code.includes(hsSearch) ||
    h.description.toLowerCase().includes(hsSearch.toLowerCase())
  );

  useEffect(() => {
    if (step === 4 && shipmentScope === 'NATIONWIDE') fetchPhpRate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setInvoiceValue(String(data.data.invoiceValueUSD || ''));
        setTotalValueUSD(String(data.data.invoiceValueUSD || ''));
        // Only autofill origin country if scope is OVERSEAS
        if (shipmentScope === 'OVERSEAS') {
          setOriginCountry(data.data.originCountry || '');
        }
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

  const handleDocAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(prev => [...prev, ...Array.from(e.target.files!)]);
      setSkipDocWarning(false);
    }
  };
  const handleDocRemove = (i: number) =>
    setDocuments(prev => prev.filter((_, idx) => idx !== i));

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

  const validate = (): boolean => {
    setErrorText('');
    if (step === 1) {
      if (!description.trim())
        { setErrorText('Cargo description is required.'); return false; }
      if (!invoiceValue || Number(invoiceValue) <= 0)
        { setErrorText('A valid invoice value is required.'); return false; }
      if (!originCountry.trim())
        { setErrorText('Origin country is required.'); return false; }
      if (!destinationPort.trim())
        { setErrorText('Destination port is required.'); return false; }
    }
    if (step === 2 && documents.length === 0 && !skipDocWarning) {
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

  const handleFundEscrow = async () => {
    setEscrowLoading(true);
    setErrorText('');
    try {
      const res  = await fetch('/api/shipments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          importerId:             currentUser.id,
          exporterId,
          description,
          totalValueUSD:          Number(totalValueUSD),
          originCountry,
          destinationPort,
          shipmentScope,
          estimatedArrival:       estimatedArrival || undefined,
          selectedLogisticsUsers: assignedUserIds,
          requiredMilestones:     priorityMilestones,
          documentNames:          documents.map(d => d.name),
          invoiceCurrency,
          invoiceValue:           Number(invoiceValue),
          hsCode,
          isDangerousGoods,
          packageCount:           Number(packageCount),
          packagingType,
          grossWeight:            Number(grossWeight),
          weightUnit,
          originAddress,
          originPort,
          destCountry,
          destAddress,
          importerContact,
          exporterContact,
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

  const isNationwide = shipmentScope === 'NATIONWIDE';

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
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

      {errorText && (
        <div className="mb-4 bg-coral-50 border border-coral-400/20 text-coral-600 font-semibold text-xs py-2.5 px-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {errorText}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1 — Cargo Details
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">

            {/* ── SUB-SECTION A · SCOPE ── */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl">
              <SubSectionHeader
                icon={Globe}
                title="Scope"
                description="Define the shipment route, scope, and both parties' contact details."
                accent="border-maritime-400 bg-maritime-50"
              />

              {/* Scope toggle */}
              <div className="space-y-2 mb-5">
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

              {/* Importer + Exporter contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-maritime-400" /> Importer Company / Contact
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Binondo Metals Importing Inc."
                    className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-maritime-400"
                    value={importerContact}
                    onChange={e => setImporterContact(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-ocean-400" /> Exporter Company / Contact
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Osaka Trading Ltd."
                    className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-maritime-400"
                    value={exporterContact}
                    onChange={e => setExporterContact(e.target.value)}
                  />
                </div>
              </div>

              {/* Cargo description */}
              <div className="space-y-1 mb-5">
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

              {/* ETA */}
              <div className="space-y-1 mb-5">
                <label className="block text-xs font-bold text-gray-700">Estimated Arrival (ETA)</label>
                <div className="relative max-w-xs">
                  <Calendar className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="date"
                    className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400"
                    value={estimatedArrival}
                    onChange={e => setEstimatedArrival(e.target.value)}
                  />
                </div>
              </div>

              {/* Origin */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-maritime-400 flex-shrink-0" />
                  <span className="text-[10px] font-black text-maritime-900 uppercase tracking-widest">Origin</span>
                  <div className="flex-1 h-px bg-sand-200" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Origin Country — locked when Nationwide */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">
                      Country <span className="text-coral-400">*</span>
                    </label>
                    {isNationwide ? (
                      <PhilippinesBadge />
                    ) : (
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="e.g. Japan"
                          className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400"
                          value={originCountry}
                          onChange={e => setOriginCountry(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Address</label>
                    <input
                      type="text"
                      placeholder={isNationwide ? 'e.g. Binondo, Manila' : 'e.g. 1-2-3 Namba, Osaka'}
                      className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-maritime-400"
                      value={originAddress}
                      onChange={e => setOriginAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Port</label>
                    <div className="relative">
                      <Ship className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder={isNationwide ? 'e.g. Port of Manila' : 'e.g. Port of Osaka'}
                        className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400"
                        value={originPort}
                        onChange={e => setOriginPort(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Destination */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-ocean-400 flex-shrink-0" />
                  <span className="text-[10px] font-black text-ocean-600 uppercase tracking-widest">Destination</span>
                  <div className="flex-1 h-px bg-sand-200" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Destination Country — locked when Nationwide */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Country</label>
                    {isNationwide ? (
                      <PhilippinesBadge />
                    ) : (
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="e.g. Philippines"
                          className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400"
                          value={destCountry}
                          onChange={e => setDestCountry(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Address</label>
                    <input
                      type="text"
                      placeholder="e.g. Binondo, Manila 1006"
                      className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-maritime-400"
                      value={destAddress}
                      onChange={e => setDestAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">
                      Port <span className="text-coral-400">*</span>
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="e.g. Port of Cebu"
                        className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400"
                        value={destinationPort}
                        onChange={e => setDestinationPort(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SUB-SECTION B · COMMERCIAL VALUE ── */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl">
              <SubSectionHeader
                icon={Coins}
                title="Commercial Value"
                description="Invoice currency, value, live oracle conversion rate, and HS tariff code."
                accent="border-ocean-400 bg-ocean-50"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">
                    Invoice Currency <span className="text-coral-400">*</span>
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['USD', 'PHP', 'EUR', 'JPY'] as const).map(cur => (
                      <button
                        key={cur}
                        type="button"
                        onClick={() => setInvoiceCurrency(cur)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all cursor-pointer
                          ${invoiceCurrency === cur
                            ? 'border-ocean-400 bg-ocean-50 text-ocean-600'
                            : 'border-sand-200 text-gray-500 hover:border-maritime-200'}`}
                      >
                        {cur}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">
                    Invoice Value <span className="text-coral-400">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                    <input
                      type="number"
                      min="0"
                      placeholder="0.00"
                      className="w-full border border-sand-200 rounded-lg pl-8 pr-14 py-2 text-xs font-mono outline-none focus:border-maritime-400"
                      value={invoiceValue}
                      onChange={e => setInvoiceValue(e.target.value)}
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-gray-400 font-bold">{invoiceCurrency}</span>
                  </div>
                </div>
              </div>

              {/* Live Oracle Rate */}
              <div className="mt-4 p-3 rounded-xl border border-sand-200 bg-sand-50 flex items-center gap-3 min-h-[46px]">
                <RefreshCw className={`w-4 h-4 text-ocean-400 flex-shrink-0 ${oracleLoading ? 'animate-spin' : ''}`} />
                {oracleLoading && (
                  <span className="text-[11px] text-gray-400 italic">Fetching live oracle rate…</span>
                )}
                {!oracleLoading && oracleRate && (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[11px] text-ocean-600 font-bold font-mono">{oracleRate.label}</span>
                    {totalValueUSD && (
                      <span className="text-[11px] bg-ocean-50 text-ocean-600 border border-ocean-100 rounded px-2 py-0.5 font-black font-mono">
                        ≈ {Number(totalValueUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
                      </span>
                    )}
                  </div>
                )}
                {!oracleLoading && !oracleRate && (
                  <span className="text-[11px] text-gray-400">
                    {invoiceValue && Number(invoiceValue) > 0
                      ? 'Rate unavailable — escrow will use manual USDC entry.'
                      : 'Enter an invoice value to see live conversion rate.'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 pl-1">
                Live rate via open.er-api.com · Read-only · Escrow always settled in USDC on Stellar.
              </p>

              {/* HS Code */}
              <div className="mt-5 space-y-1" ref={hsRef}>
                <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-maritime-400" />
                  HS Code / Tariff Code
                  <span className="text-[10px] font-normal text-gray-400">(6–10 digits)</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Type code or keyword (e.g. 8471 or laptop)…"
                    className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs font-mono outline-none focus:border-maritime-400"
                    value={hsCode || hsSearch}
                    onChange={e => {
                      const val = e.target.value;
                      setHsSearch(val);
                      setHsCode(val);
                      setHsDropOpen(true);
                    }}
                    onFocus={() => setHsDropOpen(true)}
                  />
                  {hsDropOpen && filteredHs.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-sand-200 rounded-xl shadow-lg overflow-hidden">
                      {filteredHs.map(h => (
                        <button
                          key={h.code}
                          type="button"
                          onClick={() => {
                            setHsCode(h.code);
                            setHsSearch(h.code);
                            setHsDropOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-maritime-50 text-left transition-all group"
                        >
                          <span className="font-mono text-xs font-black text-maritime-400 flex-shrink-0 group-hover:text-maritime-900">
                            {h.code}
                          </span>
                          <span className="text-[11px] text-gray-500 truncate">{h.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">
                  Used by Customs Broker for BOC entry filing. Required for dutiable imports.
                </p>
              </div>
            </div>

            {/* ── SUB-SECTION C · PHYSICAL SPECIFICATIONS ── */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl">
              <SubSectionHeader
                icon={Package}
                title="Physical Specifications"
                description="Dangerous goods classification, package count, and gross weight details."
                accent="border-coral-400 bg-coral-50"
              />

              {/* HazMat toggle */}
              <div className="flex items-center justify-between p-4 bg-sand-50 rounded-xl border border-sand-200 mb-5">
                <div>
                  <p className="text-xs font-bold text-maritime-900 flex items-center gap-1.5">
                    <AlertTriangle className={`w-4 h-4 ${isDangerousGoods ? 'text-coral-400' : 'text-gray-300'}`} />
                    Dangerous Goods / HazMat
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Does this shipment contain IMDG-classified hazardous materials?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDangerousGoods(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all cursor-pointer
                    ${isDangerousGoods
                      ? 'border-coral-400 bg-coral-50 text-coral-600'
                      : 'border-sand-200 bg-white text-gray-400 hover:border-gray-300'}`}
                >
                  {isDangerousGoods
                    ? <><ToggleRight className="w-4 h-4" /> YES — HazMat</>
                    : <><ToggleLeft className="w-4 h-4" /> NO</>
                  }
                </button>
              </div>

              {isDangerousGoods && (
                <div className="mb-5 flex items-start gap-2 bg-coral-50 border border-coral-400/30 text-coral-700 text-[11px] p-3 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-coral-400 flex-shrink-0 mt-0.5" />
                  <span>
                    HazMat shipments require MSDS/SDS documents and must comply with IMDG/DOT regulations.
                    Ensure proper packaging markings are declared in the BOC documents section.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-maritime-400" />
                    Total Package / Piece Count
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="98"
                      className="w-24 border border-sand-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-maritime-400 flex-shrink-0"
                      value={packageCount}
                      onChange={e => setPackageCount(e.target.value)}
                    />
                    <select
                      className="flex-1 border border-sand-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-maritime-400 bg-white cursor-pointer"
                      value={packagingType}
                      onChange={e => setPackagingType(e.target.value)}
                    >
                      {PACKAGING_TYPES.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {packageCount && packagingType ? `${packageCount} ${packagingType}` : 'e.g. 98 Cartons, 4 Pallets'}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Weight className="w-3.5 h-3.5 text-maritime-400" />
                    Total Gross Weight
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="5200"
                      className="flex-1 border border-sand-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-maritime-400"
                      value={grossWeight}
                      onChange={e => setGrossWeight(e.target.value)}
                    />
                    <div className="flex gap-1">
                      {(['KG', 'LBS'] as const).map(unit => (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => setWeightUnit(unit)}
                          className={`px-3 py-2 rounded-lg text-xs font-black border-2 transition-all cursor-pointer
                            ${weightUnit === unit
                              ? 'border-maritime-400 bg-maritime-50 text-maritime-400'
                              : 'border-sand-200 text-gray-400 hover:border-maritime-200'}`}
                        >
                          {unit}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Includes all packaging, pallets, and crates.
                    {grossWeight && ` = ${grossWeight} ${weightUnit}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pb-4">
              <button
                onClick={nextStep}
                className="flex items-center gap-2 bg-maritime-400 hover:bg-maritime-900 text-white font-black py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all shadow-sm"
              >
                Next: Documents <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* AI sidebar */}
          <div className="lg:col-span-2">
            <div className="bg-maritime-900 text-white p-6 rounded-2xl space-y-4 sticky top-6">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-ocean-400" /> AI Invoice Autofill
              </h3>
              <p className="text-[11px] text-maritime-200 leading-normal">
                Paste your commercial invoice text and Gemini AI will extract cargo details,
                port codes, and values automatically.
              </p>
              <textarea
                rows={7}
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
                {aiLoading ? 'Analysing…' : 'Extract Invoice Parameters'}
              </button>

              <div className="border-t border-maritime-700 pt-4 space-y-3">
                <p className="text-[10px] font-black text-maritime-300 uppercase tracking-widest">Form guide</p>
                {[
                  { dot: 'bg-maritime-400', label: 'Scope', desc: 'Route, contacts, cargo description' },
                  { dot: 'bg-ocean-400',    label: 'Commercial Value', desc: 'Invoice currency, HS code, oracle rate' },
                  { dot: 'bg-coral-400',    label: 'Physical Specs', desc: 'Weight, package count, HazMat' },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${item.dot} mt-1.5 flex-shrink-0`} />
                    <div>
                      <p className="text-[11px] font-bold text-white">{item.label}</p>
                      <p className="text-[10px] text-maritime-300">{item.desc}</p>
                    </div>
                  </div>
                ))}

                {/* Nationwide notice in sidebar */}
                {isNationwide && (
                  <div className="mt-3 flex items-start gap-2 bg-maritime-800 border border-maritime-600 rounded-lg p-3">
                    <span className="text-base leading-none mt-0.5">🇵🇭</span>
                    <p className="text-[10px] text-maritime-200 leading-relaxed">
                      <strong className="text-white">Nationwide scope active.</strong> Origin and
                      destination countries are automatically set to <strong className="text-ocean-400">Philippines</strong> and
                      cannot be changed. Only address and port fields are editable.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2 — Documents
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="bg-white border border-sand-200 p-6 rounded-2xl space-y-5">
          <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
            <FileText className="w-5 h-5 text-maritime-400" /> Upload Shipping Documents
          </h3>
          <p className="text-xs text-gray-500">
            Upload bills of lading, commercial invoices, packing lists, or any BOC-relevant files.
            All uploads are automatically grouped under this shipment&apos;s reference code in the Document Center.
          </p>

          <label className="block border-2 border-dashed border-sand-200 hover:border-maritime-400 rounded-xl p-10 text-center cursor-pointer transition-all group">
            <Upload className="w-9 h-9 text-gray-300 group-hover:text-maritime-400 mx-auto mb-2 transition-all" />
            <p className="text-xs font-bold text-gray-500 group-hover:text-maritime-400">
              Click to upload or drag &amp; drop
            </p>
            <p className="text-[10px] text-gray-400 mt-1">PDF, DOC, XLS, PNG, JPG — any file type accepted</p>
            <input type="file" multiple className="hidden" onChange={handleDocAdd} />
          </label>

          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc, i) => (
                <div key={i} className="flex items-center justify-between bg-sand-50 border border-sand-200 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-maritime-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700 truncate max-w-sm">{doc.name}</p>
                      <p className="text-[10px] text-gray-400">{(doc.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button onClick={() => handleDocRemove(i)} className="text-gray-400 hover:text-coral-400 cursor-pointer transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

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
            <button onClick={prevStep} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-maritime-900 font-bold cursor-pointer">
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

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 3 — Logistics & Priority Milestones
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        ${assigned ? 'border-ocean-400 bg-ocean-50' : 'border-sand-200 hover:border-maritime-200'}`}
                    >
                      <div>
                        <p className="text-xs font-bold text-maritime-900">{user.fullName}</p>
                        <p className="text-[10px] text-gray-500">{user.companyName} · {JOB_ROLE_LABELS[user.jobRole]}</p>
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
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">{group}</p>
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
            <button onClick={prevStep} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-maritime-900 font-bold cursor-pointer">
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

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 4 — Fund Escrow
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
                ['Cargo',       description],
                ['Importer',    importerContact || currentUser.fullName],
                ['Exporter',    exporterContact || 'Not specified'],
                ['Route',       `${originCountry}${originPort ? ` (${originPort})` : ''} → ${destinationPort}${destCountry ? `, ${destCountry}` : ''}`],
                ['ETA',         estimatedArrival || 'Not specified'],
                ['Invoice',     `${invoiceValue} ${invoiceCurrency}${totalValueUSD ? ` ≈ ${Number(totalValueUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC` : ''}`],
                ['HS Code',     hsCode || 'Not specified'],
                ['HazMat',      isDangerousGoods ? '⚠️ YES — Dangerous Goods declared' : 'No'],
                ['Packaging',   packageCount && packagingType ? `${packageCount} ${packagingType}` : 'Not specified'],
                ['Gross Weight', grossWeight ? `${grossWeight} ${weightUnit}` : 'Not specified'],
                ['Documents',   documents.length > 0
                  ? `${documents.length} file${documents.length > 1 ? 's' : ''} uploaded`
                  : 'None — add later in Document Center'],
                ['Logistics',   assignedUserIds.length > 0
                  ? `${assignedUserIds.length} user${assignedUserIds.length > 1 ? 's' : ''} assigned`
                  : 'None assigned'],
                ['Priority Milestones', `${priorityMilestones.length} required for release`],
              ] as [string, React.ReactNode][]).map(([label, value], i) => (
                <div key={i} className="flex items-start justify-between py-2.5 gap-4">
                  <dt className="text-gray-400 font-semibold flex-shrink-0">{label}</dt>
                  <dd className="text-right font-semibold text-maritime-900">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="pt-2">
              <button onClick={prevStep} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-maritime-900 font-bold cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-maritime-900 text-white p-6 rounded-2xl space-y-5">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Wallet className="w-5 h-5 text-ocean-400" /> Stellar Escrow
              </h3>

              <div className="bg-maritime-800 rounded-xl p-4 space-y-1">
                <p className="text-[10px] text-maritime-300 font-semibold uppercase tracking-wider">Escrow Amount</p>
                <p className="text-3xl font-black text-white font-mono">
                  {Number(totalValueUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-ocean-400 font-bold">USDC · Stellar Network</p>
                {invoiceCurrency !== 'USD' && invoiceValue && (
                  <p className="text-[10px] text-maritime-300 pt-1">Invoice: {invoiceValue} {invoiceCurrency}</p>
                )}
              </div>

              {shipmentScope === 'NATIONWIDE' && (
                <div className="bg-maritime-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-maritime-300 font-semibold uppercase tracking-wider">PHP Equivalent</p>
                    <button onClick={fetchPhpRate} disabled={rateLoading} title="Refresh" className="text-ocean-400 hover:text-ocean-300 cursor-pointer disabled:opacity-40">
                      <RefreshCw className={`w-3 h-3 ${rateLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  {rateLoading && <p className="text-sm text-maritime-400 animate-pulse">Fetching live rate…</p>}
                  {!rateLoading && rateError && <p className="text-xs text-coral-400">Rate unavailable — tap ↻ to retry.</p>}
                  {!rateLoading && !rateError && phpEquivalent && (
                    <>
                      <p className="text-2xl font-black text-white font-mono">₱ {phpEquivalent}</p>
                      <p className="text-[10px] text-maritime-400">Live rate: 1 USD = ₱{phpRate?.toFixed(4)}</p>
                    </>
                  )}
                  <div className="flex items-start gap-1.5 pt-1 border-t border-maritime-700">
                    <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-400 leading-relaxed">
                      Escrow is always settled in <strong>USDC</strong>. PHP rate is indicative only.
                    </p>
                  </div>
                </div>
              )}

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
                  {escrowLoading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                    : <><Ship className="w-4 h-4" /> Fund Escrow via Stellar</>
                  }
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
