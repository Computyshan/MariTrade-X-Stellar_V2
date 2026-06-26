'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { authFetch } from '@/hooks/use-user-session';
import { useFreighter } from '@/hooks/use-freighter';
import {
  Ship, ChevronLeft, ChevronRight, Globe, MapPin, Coins,
  ClipboardCheck, Zap, Upload, X, Check, Users, Lock,
  Wallet, RefreshCw, FileText, AlertTriangle, Plus, Calendar,
  Building2, Package, Weight, Search, ToggleLeft, ToggleRight,
  DollarSign, Hash, FolderLock, Key, Eye, EyeOff, Copy, CheckCircle2,
  Shuffle, ShieldCheck, FolderOpen, ExternalLink,
} from 'lucide-react';
import { ShipmentScope, MilestoneType, JobRole } from '@/types';
import { getMariTradeEscrowClient, NETWORKS } from '@/lib/stellar/escrow-contract';
import { signAndSubmit } from '@/lib/stellar/freighter';
import { dbMilestonesToContractEnums } from '@/lib/stellar/milestone-map';

// ─── Constants ────────────────────────────────────────────────────────────────

const MILESTONE_BY_JOB: Record<string, MilestoneType[]> = {
  '🏢 Freight Forwarder': [
    'BOOKING_CONFIRMED',
    'DOCUMENTS_SUBMITTED_TO_CARRIER',
    'SPACE_ON_VESSEL_SECURED',
    'CONTAINER_GATED_OUT_ORIGIN',
    'CONTAINER_LOADED_ON_VESSEL',
    'VESSEL_CLEARED_TO_DEPART',
    'VESSEL_DEPARTED_ORIGIN',
    'BILL_OF_LADING_ISSUED',
    'VESSEL_ARRIVED_AT_BERTH',
    'VESSEL_ARRIVED_DESTINATION',
    'CONTAINER_OFFLOADED',
    'CONTAINER_GATED_IN_DESTINATION',
    'CARGO_RELEASED_FOR_PICKUP',
    'IN_TRANSIT_TO_DESTINATION',
    'ARRIVED_AT_DELIVERY_ADDRESS',
    'DELIVERED_AND_SIGNED_OFF',
  ],
  '🛃 Customs Broker': [
    'BOC_ENTRY_FILED',
    'PORT_HOLD_PLACED_OR_LIFTED',
    'DUTIES_AND_TAXES_PAID',
    'CUSTOMS_EXAMINATION_REQUESTED',
    'CUSTOMS_CLEARANCE_APPROVED',
  ],
  '🏬 Warehouse Operator': [
    'CARGO_READY_FOR_COLLECTION',
    'CARGO_INSPECTED_AND_PACKED',
    'CARGO_STAGED_FOR_PICKUP',
    'CARGO_HANDED_OFF_TO_CARRIER',
    'CARGO_PICKED_UP_FROM_PORT',
    'CARGO_RECEIVED_AT_WAREHOUSE',
    'INCOMING_CARGO_STORED',
  ],
};

const DEFAULT_PRIORITY_MILESTONES: MilestoneType[] = [
  'CUSTOMS_CLEARANCE_APPROVED',
  'DELIVERED_AND_SIGNED_OFF',
];

const JOB_ROLE_LABELS: Record<JobRole, string> = {
  IMPORTER:            'Importer',
  EXPORTER:            'Exporter',
  FREIGHT_FORWARDER:   'Freight Forwarder',
  WAREHOUSE_OPERATOR:  'Warehouse Operator',
  CUSTOMS_BROKER:      'Customs Broker',
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

const STELLAR_NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const PLATFORM_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';

// ─── Stellar step labels ──────────────────────────────────────────────────────

const STELLAR_STEPS = [
  { key: 'connect',  label: 'Connecting Freighter wallet…' },
  { key: 'create',   label: 'Signing: Create escrow vault on Stellar (1/3)…' },
  { key: 'assign',   label: 'Signing: Assigning logistics users on-chain (2/3)…' },
  { key: 'fund',     label: 'Signing: Depositing USDC into escrow (3/3)…' },
  { key: 'confirm',  label: 'Confirming transaction on Stellar…' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateVaultPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(3)}-${seg(4)}-${seg(4)}`;
}

function deriveFolderName(description: string, origin: string, dest: string): string {
  const year = new Date().getFullYear();
  const slug = description.trim().split(/\s+/).slice(0, 4).join('_').toUpperCase().replace(/[^A-Z0-9_]/g, '') || 'CARGO';
  const from = origin.trim().slice(0, 3).toUpperCase() || 'ORI';
  const to   = dest.trim().slice(0, 3).toUpperCase() || 'DST';
  return `${from}-${to}_${slug}_${year}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubSectionHeader({ icon: Icon, title, description, accent }: {
  icon: React.ElementType; title: string; description: string; accent: string;
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

function PhilippinesBadge() {
  return (
    <div className="flex items-center gap-2 bg-sand-100 border border-sand-200 rounded-lg px-3 py-2 text-xs cursor-not-allowed select-none">
      <span>🇵🇭</span>
      <span className="font-bold text-maritime-900">Philippines</span>
      <span className="ml-auto text-[9px] bg-maritime-100 text-maritime-400 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Auto-set</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewShipmentPage() {
  const router = useRouter();
  const { currentUser, allUsers } = useUserSession();
  const freighter = useFreighter();
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

  // ── Step 2 · DOCUMENTS ──────────────────────────────────────────────────────
  const [documents,        setDocuments]        = useState<File[]>([]);
  const [skipDocWarning,   setSkipDocWarning]   = useState(false);

  // ── Step 2 · VAULT SETUP ────────────────────────────────────────────────────
  const [vaultFolderName,  setVaultFolderName]  = useState('');
  const [vaultPassword,    setVaultPassword]    = useState('');
  const [showVaultPw,      setShowVaultPw]      = useState(false);
  const [pwCopied,         setPwCopied]         = useState(false);
  const [nameCopied,       setNameCopied]       = useState(false);

  // ── Step 3 · LOGISTICS ──────────────────────────────────────────────────────
  const [assignedUserIds,    setAssignedUserIds]    = useState<string[]>([]);
  const [priorityMilestones, setPriorityMilestones] = useState<MilestoneType[]>(DEFAULT_PRIORITY_MILESTONES);
  const [logisticsSearch,    setLogisticsSearch]    = useState('');
  const [trustedNetworkIds,  setTrustedNetworkIds]  = useState<string[]>([]);
  const [networkLoading,     setNetworkLoading]     = useState(false);

  // ── Step 4 · ESCROW ─────────────────────────────────────────────────────────
  const [phpRate,       setPhpRate]       = useState<number | null>(null);
  const [rateLoading,   setRateLoading]   = useState(false);
  const [rateError,     setRateError]     = useState(false);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [escrowSuccess, setEscrowSuccess] = useState(false);
  const [stellarStep,   setStellarStep]   = useState(''); // current step label
  const [txHash,        setTxHash]        = useState('');

  // ── Auto-suggest vault folder name when Step 2 becomes active ───────────────
  useEffect(() => {
    if (step === 2 && !vaultFolderName) {
      const suggested = deriveFolderName(description, originCountry, destinationPort);
      setVaultFolderName(suggested);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Fetch Trusted Network when reaching Step 3 ─────────────────────────────
  useEffect(() => {
    if (step !== 3) return;
    setNetworkLoading(true);
    authFetch(`/api/network/connections?userId=${currentUser.id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const acceptedIds: string[] = json.data
            .filter((c: { status: string; direction: string; otherParty?: { id: string } }) => c.status === 'ACCEPTED' && c.direction === 'SENT')
            .map((c: { otherParty?: { id: string } }) => c.otherParty?.id)
            .filter(Boolean);
          setTrustedNetworkIds(acceptedIds);
        }
      })
      .catch(() => {})
      .finally(() => setNetworkLoading(false));
  }, [step, currentUser.id]);

  // ── Auto-lock country fields when scope is NATIONWIDE ───────────────────────
  useEffect(() => {
    if (shipmentScope === 'NATIONWIDE') {
      setOriginCountry('Philippines');
      setDestCountry('Philippines');
    }
  }, [shipmentScope]);

  // ── Fetch oracle rate ────────────────────────────────────────────────────────
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
          setOracleRate({ rate: toUSD, label: `1 ${currency} = ${toUSD.toFixed(6)} USD ≈ ${(toUSD * 1.0002).toFixed(6)} USDC` });
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
      if (hsRef.current && !hsRef.current.contains(e.target as Node)) setHsDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredHs = HS_CODE_SUGGESTIONS.filter(h =>
    h.code.includes(hsSearch) || h.description.toLowerCase().includes(hsSearch.toLowerCase())
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ invoiceText: aiText }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDescription(data.data.cargoDescription || '');
        setInvoiceValue(String(data.data.invoiceValueUSD || ''));
        setTotalValueUSD(String(data.data.invoiceValueUSD || ''));
        if (shipmentScope === 'OVERSEAS') setOriginCountry(data.data.originCountry || '');
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
  const handleDocRemove = (i: number) => setDocuments(prev => prev.filter((_, idx) => idx !== i));

  const handleGeneratePassword = () => {
    setVaultPassword(generateVaultPassword());
    setPwCopied(false);
  };

  const handleCopyPassword = async () => {
    if (!vaultPassword) return;
    await navigator.clipboard.writeText(vaultPassword);
    setPwCopied(true);
    setTimeout(() => setPwCopied(false), 2000);
  };

  const handleCopyName = async () => {
    if (!vaultFolderName) return;
    await navigator.clipboard.writeText(vaultFolderName);
    setNameCopied(true);
    setTimeout(() => setNameCopied(false), 2000);
  };

  const logisticsUsers = allUsers.filter(u =>
    u.userType === 'LOGISTICS_CHAIN' &&
    u.id !== currentUser.id &&
    trustedNetworkIds.includes(u.id) &&
    (logisticsSearch === '' ||
      u.fullName.toLowerCase().includes(logisticsSearch.toLowerCase()) ||
      (u.companyName || '').toLowerCase().includes(logisticsSearch.toLowerCase()) ||
      JOB_ROLE_LABELS[u.jobRole].toLowerCase().includes(logisticsSearch.toLowerCase()))
  );
  const toggleUser = (id: string) =>
    setAssignedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleMilestone = (m: MilestoneType) =>
    setPriorityMilestones(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

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
    if (step === 2) {
      if (!vaultFolderName.trim())
        { setErrorText('A vault folder name is required.'); return false; }
      if (!vaultPassword.trim())
        { setErrorText('A vault password is required. Use the generator or type a custom one.'); return false; }
      if (vaultPassword.length < 6)
        { setErrorText('Vault password must be at least 6 characters.'); return false; }
      if (documents.length === 0 && !skipDocWarning) {
        setSkipDocWarning(true);
        return false;
      }
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

  // ── Stellar escrow fund flow ───────────────────────────────────────────────

  const handleFundEscrow = async () => {
    setEscrowLoading(true);
    setErrorText('');
    setStellarStep('');
    setTxHash('');

    let shipmentId   = '';
    let referenceCode = '';

    try {
      // ── 1. Create the DB shipment record ────────────────────────────────────
      const res = await authFetch('/api/shipments', {
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
          vaultFolderName,
          vaultPassword,
        }),
      });
      const json = await res.json();
      if (!json.success || !json.data) {
        setErrorText(json.error || 'Failed to create shipment record.');
        return;
      }
      shipmentId    = json.data.id;
      referenceCode = json.data.referenceCode;

      // ── 2. Connect Freighter wallet ──────────────────────────────────────────
      setStellarStep('connect');
      const importerAddress = freighter.publicKey ?? await freighter.connect();

      // ── 3. Resolve on-chain addresses ───────────────────────────────────────
      const exporterUser    = allUsers.find(u => u.id === exporterId);
      const exporterAddress = exporterUser?.stellarWallet ?? PLATFORM_ADDRESS;

      const logisticsAddresses = assignedUserIds
        .map(uid => allUsers.find(u => u.id === uid)?.stellarWallet)
        .filter((addr): addr is string => Boolean(addr));

      // ── 4. Build escrow client ────────────────────────────────────────────────
      const client            = getMariTradeEscrowClient(STELLAR_NETWORK, importerAddress);
      const requiredMilestones = dbMilestonesToContractEnums(priorityMilestones);

      // ── 5. createEscrow (Freighter signs tx #1) ───────────────────────────────
      setStellarStep('create');
      const createXdr = await client.createEscrow({
        referenceCode,
        importer:             importerAddress,
        exporter:             exporterAddress,
        amountUsd:            Number(totalValueUSD),
        requiredMilestones,
        partialRefundPercent: 80,
      });
      await signAndSubmit(createXdr, STELLAR_NETWORK);

      // ── 6. assignLogisticsUsers (Freighter signs tx #2) ─────────────────────
      if (logisticsAddresses.length > 0) {
        setStellarStep('assign');
        const assignXdr = await client.assignLogisticsUsers({
          referenceCode,
          importer: importerAddress,
          users:    logisticsAddresses,
        });
        await signAndSubmit(assignXdr, STELLAR_NETWORK);
      }

      // ── 7. fund (Freighter signs tx #3 — transfers USDC into vault) ──────────
      setStellarStep('fund');
      const fundXdr = await client.fund({ referenceCode, importer: importerAddress });
      const fundHash = await signAndSubmit(fundXdr, STELLAR_NETWORK);
      setTxHash(fundHash);

      // ── 8. Update DB record with Stellar contract ID + FUNDED status ─────────
      setStellarStep('confirm');
      await authFetch(`/api/shipments/${shipmentId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:         'UPDATE_STELLAR_ESCROW',
          stellarEscrowId: fundHash,
          escrowStatus:   'FUNDED',
        }),
      });

      setEscrowSuccess(true);
      setTimeout(() => router.push(`/shipments/${shipmentId}`), 2500);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stellar transaction failed.';
      setErrorText(msg);
      // If the DB record was created but chain failed, we still redirect so the
      // user can see their shipment and retry funding from the detail page.
      if (shipmentId) {
        setTimeout(() => router.push(`/shipments/${shipmentId}`), 3000);
      }
    } finally {
      setEscrowLoading(false);
      setStellarStep('');
    }
  };

  const phpEquivalent = phpRate && totalValueUSD
    ? (Number(totalValueUSD) * phpRate).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  const isNationwide = shipmentScope === 'NATIONWIDE';

  // Current Stellar step label for the UI
  const currentStellarLabel = STELLAR_STEPS.find(s => s.key === stellarStep)?.label ?? '';

  // ─── Render ───────────────────────────────────────────────────────────────────

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

      {/* Step Indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => {
          const n = i + 1;
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

            {/* A · SCOPE */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl">
              <SubSectionHeader
                icon={Globe}
                title="Scope"
                description="Define the shipment route, scope, and both parties' contact details."
                accent="border-maritime-400 bg-maritime-50"
              />
              <div className="space-y-2 mb-5">
                <label className="block text-xs font-bold text-gray-700">Shipment Scope</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['OVERSEAS', 'NATIONWIDE'] as ShipmentScope[]).map(scope => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setShipmentScope(scope)}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer
                        ${shipmentScope === scope ? 'border-maritime-400 bg-maritime-50' : 'border-sand-200 hover:border-maritime-200'}`}
                    >
                      <div className={`text-xs font-black ${shipmentScope === scope ? 'text-maritime-400' : 'text-gray-500'}`}>
                        {scope === 'OVERSEAS' ? '🌏 OVERSEAS' : '🇵🇭 NATIONWIDE'}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {scope === 'OVERSEAS' ? 'USD · International bank/wire transfer' : 'USDC escrow · PHP indicative rate shown'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-maritime-400" /> Importer Company / Contact
                  </label>
                  <input type="text" placeholder="e.g. Binondo Metals Importing Inc." className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-maritime-400" value={importerContact} onChange={e => setImporterContact(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-ocean-400" /> Exporter Company / Contact
                  </label>
                  <input type="text" placeholder="e.g. Osaka Trading Ltd." className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-maritime-400" value={exporterContact} onChange={e => setExporterContact(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1 mb-5">
                <label className="block text-xs font-bold text-gray-700">Cargo Description <span className="text-coral-400">*</span></label>
                <textarea rows={3} placeholder="e.g. 40ft container of high-precision automobile spares (Model RX-9)" className="w-full border border-sand-200 rounded-lg p-2.5 text-xs outline-none focus:border-maritime-400 resize-none" value={description} onChange={e => setDescription(e.target.value)} />
              </div>

              <div className="space-y-1 mb-5">
                <label className="block text-xs font-bold text-gray-700">Estimated Arrival (ETA)</label>
                <div className="relative max-w-xs">
                  <Calendar className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input type="date" className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400" value={estimatedArrival} onChange={e => setEstimatedArrival(e.target.value)} />
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-maritime-400 flex-shrink-0" />
                  <span className="text-[10px] font-black text-maritime-900 uppercase tracking-widest">Origin</span>
                  <div className="flex-1 h-px bg-sand-200" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Country <span className="text-coral-400">*</span></label>
                    {isNationwide ? <PhilippinesBadge /> : (
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                        <input type="text" placeholder="e.g. Japan" className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400" value={originCountry} onChange={e => setOriginCountry(e.target.value)} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Address</label>
                    <input type="text" placeholder={isNationwide ? 'e.g. Binondo, Manila' : 'e.g. 1-2-3 Namba, Osaka'} className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-maritime-400" value={originAddress} onChange={e => setOriginAddress(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Port</label>
                    <div className="relative">
                      <Ship className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                      <input type="text" placeholder={isNationwide ? 'e.g. Port of Manila' : 'e.g. Port of Osaka'} className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400" value={originPort} onChange={e => setOriginPort(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-ocean-400 flex-shrink-0" />
                  <span className="text-[10px] font-black text-ocean-600 uppercase tracking-widest">Destination</span>
                  <div className="flex-1 h-px bg-sand-200" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Country</label>
                    {isNationwide ? <PhilippinesBadge /> : (
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                        <input type="text" placeholder="e.g. Philippines" className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400" value={destCountry} onChange={e => setDestCountry(e.target.value)} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Address</label>
                    <input type="text" placeholder="e.g. Binondo, Manila 1006" className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-maritime-400" value={destAddress} onChange={e => setDestAddress(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">Port <span className="text-coral-400">*</span></label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                      <input type="text" placeholder="e.g. Port of Cebu" className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-maritime-400" value={destinationPort} onChange={e => setDestinationPort(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* B · COMMERCIAL VALUE */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl">
              <SubSectionHeader icon={Coins} title="Commercial Value" description="Invoice currency, value, live oracle conversion rate, and HS tariff code." accent="border-ocean-400 bg-ocean-50" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">Invoice Currency <span className="text-coral-400">*</span></label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['USD', 'PHP', 'EUR', 'JPY'] as const).map(cur => (
                      <button key={cur} type="button" onClick={() => setInvoiceCurrency(cur)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all cursor-pointer ${invoiceCurrency === cur ? 'border-ocean-400 bg-ocean-50 text-ocean-600' : 'border-sand-200 text-gray-500 hover:border-maritime-200'}`}>
                        {cur}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">Invoice Value <span className="text-coral-400">*</span></label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                    <input type="number" min="0" placeholder="0.00" className="w-full border border-sand-200 rounded-lg pl-8 pr-14 py-2 text-xs font-mono outline-none focus:border-maritime-400" value={invoiceValue} onChange={e => setInvoiceValue(e.target.value)} />
                    <span className="absolute right-3 top-2 text-[10px] text-gray-400 font-bold">{invoiceCurrency}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl border border-sand-200 bg-sand-50 flex items-center gap-3 min-h-[46px]">
                <RefreshCw className={`w-4 h-4 text-ocean-400 flex-shrink-0 ${oracleLoading ? 'animate-spin' : ''}`} />
                {oracleLoading && <span className="text-[11px] text-gray-400 italic">Fetching live oracle rate…</span>}
                {!oracleLoading && oracleRate && (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[11px] text-ocean-600 font-bold font-mono">{oracleRate.label}</span>
                    {totalValueUSD && <span className="text-[11px] bg-ocean-50 text-ocean-600 border border-ocean-100 rounded px-2 py-0.5 font-black font-mono">≈ {Number(totalValueUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC</span>}
                  </div>
                )}
                {!oracleLoading && !oracleRate && <span className="text-[11px] text-gray-400">{invoiceValue && Number(invoiceValue) > 0 ? 'Rate unavailable.' : 'Enter an invoice value to see live conversion rate.'}</span>}
              </div>
              <div className="mt-5 space-y-1" ref={hsRef}>
                <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-maritime-400" /> HS Code / Tariff Code <span className="text-[10px] font-normal text-gray-400">(6–10 digits)</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input type="text" placeholder="Type code or keyword…" className="w-full border border-sand-200 rounded-lg pl-8 pr-2.5 py-2 text-xs font-mono outline-none focus:border-maritime-400"
                    value={hsCode || hsSearch}
                    onChange={e => { setHsSearch(e.target.value); setHsCode(e.target.value); setHsDropOpen(true); }}
                    onFocus={() => setHsDropOpen(true)}
                  />
                  {hsDropOpen && filteredHs.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-sand-200 rounded-xl shadow-lg overflow-hidden">
                      {filteredHs.map(h => (
                        <button key={h.code} type="button" onClick={() => { setHsCode(h.code); setHsSearch(h.code); setHsDropOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-maritime-50 text-left transition-all group">
                          <span className="font-mono text-xs font-black text-maritime-400 flex-shrink-0 group-hover:text-maritime-900">{h.code}</span>
                          <span className="text-[11px] text-gray-500 truncate">{h.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* C · PHYSICAL SPECIFICATIONS */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl">
              <SubSectionHeader icon={Package} title="Physical Specifications" description="Dangerous goods classification, package count, and gross weight details." accent="border-coral-400 bg-coral-50" />
              <div className="flex items-center justify-between p-4 bg-sand-50 rounded-xl border border-sand-200 mb-5">
                <div>
                  <p className="text-xs font-bold text-maritime-900 flex items-center gap-1.5">
                    <AlertTriangle className={`w-4 h-4 ${isDangerousGoods ? 'text-coral-400' : 'text-gray-300'}`} /> Dangerous Goods / HazMat
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">IMDG-classified hazardous materials?</p>
                </div>
                <button type="button" onClick={() => setIsDangerousGoods(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all cursor-pointer ${isDangerousGoods ? 'border-coral-400 bg-coral-50 text-coral-600' : 'border-sand-200 bg-white text-gray-400 hover:border-gray-300'}`}>
                  {isDangerousGoods ? <><ToggleRight className="w-4 h-4" /> YES — HazMat</> : <><ToggleLeft className="w-4 h-4" /> NO</>}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-maritime-400" /> Total Package / Piece Count</label>
                  <div className="flex gap-2">
                    <input type="number" min="1" placeholder="00" className="w-24 border border-sand-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-maritime-400 flex-shrink-0" value={packageCount} onChange={e => setPackageCount(e.target.value)} />
                    <select className="flex-1 border border-sand-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-maritime-400 bg-white cursor-pointer" value={packagingType} onChange={e => setPackagingType(e.target.value)}>
                      {PACKAGING_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5"><Weight className="w-3.5 h-3.5 text-maritime-400" /> Total Gross Weight</label>
                  <div className="flex gap-2">
                    <input type="number" min="0" step="0.01" placeholder="0000" className="flex-1 border border-sand-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-maritime-400" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} />
                    <div className="flex gap-1">
                      {(['KG', 'LBS'] as const).map(unit => (
                        <button key={unit} type="button" onClick={() => setWeightUnit(unit)}
                          className={`px-3 py-2 rounded-lg text-xs font-black border-2 transition-all cursor-pointer ${weightUnit === unit ? 'border-maritime-400 bg-maritime-50 text-maritime-400' : 'border-sand-200 text-gray-400 hover:border-maritime-200'}`}>
                          {unit}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pb-4">
              <button onClick={nextStep} className="flex items-center gap-2 bg-maritime-400 hover:bg-maritime-900 text-white font-black py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all shadow-sm">
                Next: Documents <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* AI Sidebar */}
          <div className="lg:col-span-2">
            <div className="bg-maritime-900 text-white p-6 rounded-2xl space-y-4 sticky top-6">
              <h3 className="font-extrabold text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-ocean-400" /> AI Invoice Autofill</h3>
              <p className="text-[11px] text-maritime-200 leading-normal">Paste your commercial invoice text and Gemini AI will extract cargo details, port codes, and values automatically.</p>
              <textarea rows={7} placeholder={"CONSIGNOR: Osaka Ltd\nITEM: 90 Cartons Solar Inverters\nVALUATION: USD 14,350\nPORT OF ENTRY: Cebu PH"} className="w-full bg-maritime-800 text-white border border-maritime-700 rounded-lg p-2.5 text-[11px] outline-none focus:ring-1 focus:ring-ocean-400 font-mono resize-none" value={aiText} onChange={e => setAiText(e.target.value)} />
              <button type="button" onClick={handleAutofill} disabled={aiLoading} className="bg-ocean-400 hover:bg-ocean-600 text-maritime-900 w-full font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer disabled:opacity-60">
                {aiLoading ? 'Analysing…' : 'Extract Invoice Parameters'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2 — Documents & Vault Setup
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">

            {/* DOCUMENT UPLOAD */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl space-y-5">
              <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
                <FileText className="w-5 h-5 text-maritime-400" /> Upload Shipping Documents
              </h3>
              <p className="text-xs text-gray-500">
                Upload bills of lading, commercial invoices, packing lists, or any BOC-relevant files.
                All uploads will be grouped inside the vault folder you configure below.
              </p>

              <label className="block border-2 border-dashed border-sand-200 hover:border-maritime-400 rounded-xl p-10 text-center cursor-pointer transition-all group">
                <Upload className="w-9 h-9 text-gray-300 group-hover:text-maritime-400 mx-auto mb-2 transition-all" />
                <p className="text-xs font-bold text-gray-500 group-hover:text-maritime-400">Click to upload or drag &amp; drop</p>
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
                  <span>No documents uploaded. You can continue, but documents must be added before customs clearance. <strong>Click Next again to skip.</strong></span>
                </div>
              )}
            </div>

            {/* BOC DOCUMENT VAULT SETUP */}
            <div className="bg-white border-2 border-maritime-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-maritime-900 px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 bg-maritime-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FolderLock className="w-5 h-5 text-maritime-200" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">BOC Document Vault — Folder Setup</h3>
                  <p className="text-[10px] text-maritime-300">Configure the vault folder that will hold all documents for this shipment.</p>
                </div>
                <span className="ml-auto text-[9px] font-black bg-ocean-400/20 text-ocean-400 border border-ocean-400/30 px-2 py-1 rounded-lg tracking-widest uppercase">Required</span>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-start gap-3 bg-maritime-50 border border-maritime-100 rounded-xl p-4 text-xs text-maritime-700">
                  <ShieldCheck className="w-4 h-4 text-maritime-400 flex-shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="font-bold">How Vault Folders work:</strong> A password-protected folder is created in the BOC Document Vault for this shipment. All authorized users can <em>see</em> the folder, but must enter the correct vault password to open it and access the documents inside.
                    <span className="block mt-1 text-maritime-400">Share the password only with those who need direct document access.</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-maritime-900 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-maritime-400" />
                    Vault Folder Name <span className="text-coral-400">*</span>
                    <span className="text-[10px] font-normal text-gray-400 ml-1">— visible to all authorized users</span>
                  </label>
                  <div className="relative">
                    <input type="text" placeholder="e.g. JPN-MNL_STEEL_COILS_2026"
                      className="w-full border border-sand-200 rounded-xl px-4 py-3 pr-10 text-sm font-mono outline-none focus:border-maritime-400 bg-sand-50 text-maritime-900 tracking-wide"
                      value={vaultFolderName} onChange={e => setVaultFolderName(e.target.value.toUpperCase().replace(/\s+/g, '_'))} />
                    <button type="button" onClick={handleCopyName} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-maritime-400 transition-colors" title="Copy folder name">
                      {nameCopied ? <CheckCircle2 className="w-4 h-4 text-ocean-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setVaultFolderName(deriveFolderName(description, originCountry, destinationPort))}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-maritime-400 hover:text-maritime-900 transition-colors border border-maritime-100 bg-maritime-50 px-2.5 py-1 rounded-lg">
                      <Shuffle className="w-3 h-3" /> Re-suggest from cargo details
                    </button>
                    <p className="text-[10px] text-gray-400">Letters, numbers, hyphens and underscores only.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-maritime-900 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-maritime-400" />
                    Vault Password <span className="text-coral-400">*</span>
                    <span className="text-[10px] font-normal text-gray-400 ml-1">— required to open this folder in the BOC Vault</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input type={showVaultPw ? 'text' : 'password'} placeholder="Type a custom password or generate one →"
                        className={`w-full border rounded-xl px-4 py-3 pr-20 text-sm font-mono tracking-widest outline-none transition-colors ${vaultPassword ? 'border-ocean-400 bg-ocean-50/40 text-maritime-900 focus:border-ocean-400' : 'border-sand-200 bg-sand-50 focus:border-maritime-400 text-maritime-900'}`}
                        value={vaultPassword} onChange={e => setVaultPassword(e.target.value)} />
                      <button type="button" onClick={() => setShowVaultPw(v => !v)} className="absolute right-9 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" title={showVaultPw ? 'Hide' : 'Show'}>
                        {showVaultPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button type="button" onClick={handleCopyPassword} disabled={!vaultPassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-maritime-400 disabled:opacity-30 transition-colors" title="Copy password">
                        {pwCopied ? <CheckCircle2 className="w-4 h-4 text-ocean-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <button type="button" onClick={handleGeneratePassword} className="flex items-center gap-1.5 bg-maritime-400 hover:bg-maritime-900 text-white font-bold px-4 py-3 rounded-xl text-xs transition-all whitespace-nowrap flex-shrink-0">
                      <Shuffle className="w-3.5 h-3.5" /> Generate
                    </button>
                  </div>
                  {vaultPassword && (
                    <div className="flex items-center gap-2">
                      {(() => {
                        const len = vaultPassword.length;
                        const score = [len >= 8, /[A-Z]/.test(vaultPassword), /[0-9]/.test(vaultPassword), /[^A-Za-z0-9]/.test(vaultPassword)].filter(Boolean).length;
                        const configs = [
                          { label: 'Too short', color: 'bg-coral-400', text: 'text-coral-400' },
                          { label: 'Weak',      color: 'bg-coral-400', text: 'text-coral-400' },
                          { label: 'Fair',      color: 'bg-amber-400', text: 'text-amber-600' },
                          { label: 'Good',      color: 'bg-ocean-400', text: 'text-ocean-600' },
                          { label: 'Strong',    color: 'bg-ocean-400', text: 'text-ocean-600' },
                        ];
                        const cfg = len < 6 ? configs[0] : configs[score];
                        return (
                          <>
                            <div className="flex gap-1">{[0,1,2,3].map(i => <div key={i} className={`h-1 w-8 rounded-full transition-colors ${i < score ? cfg.color : 'bg-sand-200'}`} />)}</div>
                            <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.label}</span>
                            <span className="text-[10px] text-gray-400">{vaultPassword.length} characters</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {(vaultFolderName || vaultPassword) && (
                  <div className="bg-sand-50 border border-sand-200 rounded-xl p-4 space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vault Folder Preview</p>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-maritime-100 rounded-xl flex items-center justify-center flex-shrink-0"><FolderLock className="w-5 h-5 text-maritime-400" /></div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-black text-maritime-900 font-mono truncate">{vaultFolderName || <span className="text-gray-300 font-normal">Folder name not set</span>}</p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={`flex items-center gap-1 font-bold ${vaultPassword ? 'text-ocean-600' : 'text-coral-400'}`}>
                            {vaultPassword ? <><Lock className="w-3 h-3" /> Password set</> : <><AlertTriangle className="w-3 h-3" /> No password</>}
                          </span>
                          {documents.length > 0 && <><span className="text-gray-300">·</span><span className="text-gray-500">{documents.length} document{documents.length > 1 ? 's' : ''} will be added</span></>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pb-4">
              <button onClick={prevStep} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-maritime-900 font-bold cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={nextStep} className="flex items-center gap-2 bg-maritime-400 hover:bg-maritime-900 text-white font-black py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all">
                Next: Assign Logistics <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Vault sidebar guide */}
          <div className="lg:col-span-2">
            <div className="bg-maritime-900 text-white p-6 rounded-2xl space-y-5 sticky top-6">
              <h3 className="font-extrabold text-sm flex items-center gap-2"><FolderLock className="w-4 h-4 text-ocean-400" /> Vault Setup Guide</h3>
              <div className="space-y-4 text-[11px] text-maritime-200 leading-relaxed">
                {[
                  { icon: FolderOpen, color: 'text-maritime-400', title: 'Folder Name', desc: "A human-readable identifier for this shipment's document folder. Visible to all authorized BOC Vault users." },
                  { icon: Key, color: 'text-ocean-400', title: 'Vault Password', desc: 'Required to open the folder and access its documents. Use Generate for a cryptographically random password.' },
                  { icon: ShieldCheck, color: 'text-coral-400', title: 'Security Note', desc: 'MariTrade does not store vault passwords in plain text. Once created, this password cannot be retrieved — only reset by the shipment owner.' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 border-b border-maritime-700 pb-4 last:border-0 last:pb-0">
                    <div className="w-7 h-7 rounded-lg bg-maritime-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                    </div>
                    <div>
                      <p className="font-black text-white text-xs mb-0.5">{item.title}</p>
                      <p>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
              <p className="text-xs text-gray-500">Assigned users can log milestone events. Customs Brokers also gain BOC vault access.</p>
              <input type="text" placeholder="Search by name, company, or role..." className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-maritime-400" value={logisticsSearch} onChange={e => setLogisticsSearch(e.target.value)} />
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {networkLoading ? (
                  <div className="py-8 text-center"><div className="w-6 h-6 border-2 border-maritime-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-xs text-gray-400">Loading your Trusted Network…</p></div>
                ) : logisticsUsers.length === 0 ? (
                  <div className="py-6 px-3 text-center space-y-2 border border-dashed border-sand-200 rounded-xl bg-sand-50">
                    <Users className="w-8 h-8 text-gray-200 mx-auto" />
                    <p className="text-xs font-bold text-gray-500">No trusted vendors yet</p>
                    <Link href="/network" target="_blank" className="inline-flex items-center gap-1 text-[11px] font-black text-maritime-400 hover:text-maritime-900 transition-colors">Build your network →</Link>
                  </div>
                ) : logisticsUsers.map(user => {
                  const assigned = assignedUserIds.includes(user.id);
                  return (
                    <button key={user.id} onClick={() => toggleUser(user.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${assigned ? 'border-ocean-400 bg-ocean-50' : 'border-sand-200 hover:border-maritime-200'}`}>
                      <div>
                        <p className="text-xs font-bold text-maritime-900">{user.fullName}</p>
                        <p className="text-[10px] text-gray-500">{user.companyName} · {JOB_ROLE_LABELS[user.jobRole]}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${assigned ? 'bg-ocean-400 text-white' : 'bg-sand-100 text-gray-400'}`}>
                        {assigned ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-sand-200 p-6 rounded-2xl space-y-4">
              <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
                <Lock className="w-5 h-5 text-maritime-400" /> Priority Milestones for Escrow Release
              </h3>
              <p className="text-xs text-gray-500">The <strong>Release Funds</strong> button stays locked until <strong>all</strong> selected milestones are confirmed.</p>
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {Object.entries(MILESTONE_BY_JOB).map(([group, types]) => (
                  <div key={group}>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">{group}</p>
                    <div className="space-y-1">
                      {types.map(type => {
                        const selected = priorityMilestones.includes(type);
                        return (
                          <button key={type} onClick={() => toggleMilestone(type)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer text-xs ${selected ? 'border-maritime-400 bg-maritime-50 text-maritime-900 font-semibold' : 'border-sand-200 text-gray-500 hover:border-maritime-200'}`}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${selected ? 'bg-maritime-400' : 'bg-sand-100'}`}>
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
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={prevStep} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-maritime-900 font-bold cursor-pointer">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={nextStep} className="flex items-center gap-2 bg-maritime-400 hover:bg-maritime-900 text-white font-black py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all">
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
                  <span className={`font-black px-2 py-0.5 rounded text-[10px] ${shipmentScope === 'OVERSEAS' ? 'bg-maritime-100 text-maritime-700' : 'bg-ocean-50 text-ocean-600'}`}>{shipmentScope}</span>
                )],
                ['Cargo',         description],
                ['Importer',      importerContact || currentUser.fullName],
                ['Exporter',      exporterContact || 'Not specified'],
                ['Route',         `${originCountry}${originPort ? ` (${originPort})` : ''} → ${destinationPort}${destCountry ? `, ${destCountry}` : ''}`],
                ['ETA',           estimatedArrival || 'Not specified'],
                ['Invoice',       `${invoiceValue} ${invoiceCurrency}${totalValueUSD ? ` ≈ ${Number(totalValueUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC` : ''}`],
                ['HS Code',       hsCode || 'Not specified'],
                ['HazMat',        isDangerousGoods ? '⚠️ YES — Dangerous Goods declared' : 'No'],
                ['Packaging',     packageCount && packagingType ? `${packageCount} ${packagingType}` : 'Not specified'],
                ['Gross Weight',  grossWeight ? `${grossWeight} ${weightUnit}` : 'Not specified'],
                ['Documents',     documents.length > 0 ? `${documents.length} file${documents.length > 1 ? 's' : ''} uploaded` : 'None — add later in Vault'],
                ['Logistics',     assignedUserIds.length > 0 ? `${assignedUserIds.length} user${assignedUserIds.length > 1 ? 's' : ''} assigned` : 'None assigned'],
                ['Priority Milestones', `${priorityMilestones.length} required for release`],
              ] as [string, React.ReactNode][]).map(([label, value], i) => (
                <div key={i} className="flex items-start justify-between py-2.5 gap-4">
                  <dt className="text-gray-400 font-semibold flex-shrink-0">{label}</dt>
                  <dd className="text-right font-semibold text-maritime-900">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Vault summary */}
            <div className="border border-maritime-100 bg-maritime-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FolderLock className="w-4 h-4 text-maritime-400" />
                <p className="text-xs font-extrabold text-maritime-900">BOC Vault Folder</p>
                <span className="ml-auto text-[9px] font-black bg-ocean-100 text-ocean-600 px-1.5 py-0.5 rounded uppercase">Will be created on submit</span>
              </div>
              <dl className="divide-y divide-maritime-100 text-xs">
                <div className="flex items-center justify-between py-2">
                  <dt className="text-maritime-500 font-semibold">Folder Name</dt>
                  <dd className="font-black text-maritime-900 font-mono text-right truncate max-w-[200px]">{vaultFolderName}</dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-maritime-500 font-semibold">Vault Password</dt>
                  <dd className="flex items-center gap-2">
                    <span className="font-mono font-black text-maritime-900 tracking-widest">{'•'.repeat(Math.min(vaultPassword.length, 12))}</span>
                    <button type="button" onClick={handleCopyPassword} className="text-maritime-400 hover:text-maritime-900 transition-colors" title="Copy password">
                      {pwCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-ocean-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-maritime-500 font-semibold">Initial Documents</dt>
                  <dd className="font-semibold text-maritime-900">{documents.length > 0 ? `${documents.length} file${documents.length > 1 ? 's' : ''}` : 'None'}</dd>
                </div>
              </dl>
              <div className="flex items-start gap-2 text-[10px] text-maritime-600 bg-white border border-maritime-100 rounded-lg p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>Save your vault password before submitting. It cannot be retrieved from MariTrade after the folder is created.</span>
              </div>
            </div>

            <div className="pt-2">
              <button onClick={prevStep} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-maritime-900 font-bold cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </div>
          </div>

          {/* ── Escrow panel ── */}
          <div className="lg:col-span-2">
            <div className="bg-maritime-900 text-white p-6 rounded-2xl space-y-5">
              <h3 className="font-extrabold text-sm flex items-center gap-2"><Wallet className="w-5 h-5 text-ocean-400" /> Stellar Escrow</h3>

              {/* Amount */}
              <div className="bg-maritime-800 rounded-xl p-4 space-y-1">
                <p className="text-[10px] text-maritime-300 font-semibold uppercase tracking-wider">Escrow Amount</p>
                <p className="text-3xl font-black text-white font-mono">{Number(totalValueUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-ocean-400 font-bold">USDC · Stellar {STELLAR_NETWORK}</p>
                {invoiceCurrency !== 'USD' && invoiceValue && <p className="text-[10px] text-maritime-300 pt-1">Invoice: {invoiceValue} {invoiceCurrency}</p>}
              </div>

              {shipmentScope === 'NATIONWIDE' && (
                <div className="bg-maritime-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-maritime-300 font-semibold uppercase tracking-wider">PHP Equivalent</p>
                    <button onClick={fetchPhpRate} disabled={rateLoading} className="text-ocean-400 hover:text-ocean-300 cursor-pointer disabled:opacity-40"><RefreshCw className={`w-3 h-3 ${rateLoading ? 'animate-spin' : ''}`} /></button>
                  </div>
                  {rateLoading && <p className="text-sm text-maritime-400 animate-pulse">Fetching live rate…</p>}
                  {!rateLoading && phpEquivalent && (
                    <><p className="text-2xl font-black text-white font-mono">₱ {phpEquivalent}</p><p className="text-[10px] text-maritime-400">Live rate: 1 USD = ₱{phpRate?.toFixed(4)}</p></>
                  )}
                </div>
              )}

              {/* Freighter wallet status */}
              <div className="bg-maritime-800 rounded-xl p-3 space-y-2">
                <p className="text-[10px] text-maritime-300 font-semibold uppercase tracking-wider">Freighter Wallet</p>
                {freighter.publicKey ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-ocean-400 flex-shrink-0" />
                    <span className="font-mono text-[10px] text-white truncate">{freighter.publicKey}</span>
                  </div>
                ) : (
                  <button onClick={freighter.connect} disabled={freighter.connecting}
                    className="w-full flex items-center justify-center gap-1.5 bg-maritime-700 hover:bg-maritime-600 text-white border border-maritime-600 font-bold py-2 rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50">
                    <Wallet className="w-3.5 h-3.5" />
                    {freighter.connecting ? 'Connecting…' : 'Connect Freighter Wallet'}
                  </button>
                )}
                {freighter.error && <p className="text-[10px] text-coral-400">{freighter.error}</p>}
              </div>

              {/* Stellar step progress */}
              {escrowLoading && currentStellarLabel && (
                <div className="bg-maritime-800 rounded-xl p-3 flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-ocean-400 animate-spin flex-shrink-0" />
                  <p className="text-[11px] text-maritime-200 leading-snug">{currentStellarLabel}</p>
                </div>
              )}

              {/* Tx hash on success */}
              {txHash && (
                <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-[10px] text-ocean-400 hover:text-ocean-300 font-mono break-all">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  {txHash.substring(0, 16)}…{txHash.substring(txHash.length - 8)} ↗
                </a>
              )}

              {/* CTA */}
              {escrowSuccess ? (
                <div className="bg-ocean-400 rounded-xl p-4 flex items-center gap-3">
                  <Check className="w-6 h-6 text-white flex-shrink-0" />
                  <div>
                    <p className="text-sm font-black text-white">Escrow Funded on Stellar!</p>
                    <p className="text-[10px] text-white/80">Redirecting to shipment record…</p>
                  </div>
                </div>
              ) : (
                <button onClick={handleFundEscrow} disabled={escrowLoading}
                  className="w-full bg-ocean-400 hover:bg-ocean-600 text-maritime-900 font-black py-3 rounded-xl text-sm uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  {escrowLoading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                    : <><Ship className="w-4 h-4" /> Fund Escrow via Stellar</>}
                </button>
              )}

              <p className="text-[10px] text-maritime-400 text-center leading-relaxed">
                You will be prompted to sign <strong className="text-maritime-300">up to 3 transactions</strong> in Freighter: create vault, assign team, and deposit USDC.
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
