'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { authFetch } from '@/hooks/use-user-session';
import { useFreighter } from '@/hooks/use-freighter';
import {
  Ship, ChevronLeft, ChevronRight, Globe, MapPin, Coins,
  ClipboardCheck, Upload, X, Check, Users, Lock,
  Wallet, RefreshCw, FileText, AlertTriangle, Plus, Calendar,
  Building2, Package, Weight, Search, ToggleLeft, ToggleRight,
  DollarSign, Hash, FolderLock, Key, Eye, EyeOff, Copy, CheckCircle2,
  Shuffle, ShieldCheck, FolderOpen, ExternalLink, Receipt, Sparkles, MessageSquare,
} from 'lucide-react';
import { ShipmentScope, MilestoneType, JobRole, PHASE_MILESTONE_SEQUENCE, ShipmentPhase, ShipmentReceipt, CURRENCY_SYMBOLS, ROLE_MILESTONES } from '@/types';
import { getMariTradeEscrowClient, NETWORKS } from '@/lib/stellar/escrow-contract';
import { signAndSubmitWithRetry } from '@/lib/stellar/freighter';
import { dbMilestonesToContractEnums } from '@/lib/stellar/milestone-map';
import AssetSelector from '@/components/AssetSelector';
import { type AssetCode, formatAsset } from '@/lib/stellar/assets';
import { convertPphpToUsdc } from '@/lib/stellar/fx';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<ShipmentPhase, string> = {
  CARGO_PREPARATION:         '📦 Phase 1 — Cargo Preparation & Origin Warehouse',
  ORIGIN_PORT_EXPORT:        '⚓ Phase 2 — Origin Port & Export Clearance',
  OCEAN_TRANSIT_DESTINATION: '🌊 Phase 3 — Ocean Transit & Destination Port',
  LAST_MILE_DELIVERY:        '🚛 Phase 4 — Last-Mile Delivery & Final Receipt',
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
  { label: 'Logistics & Exporter', icon: Users },
  { label: 'Fund Escrow',   icon: Wallet },
];

const HS_CATEGORY_ORDER = [
  'Electronics & Electrical',
  'Vehicles & Transport',
  'Textiles & Apparel',
  'Food & Agriculture',
  'Chemicals, Plastics & Materials',
  'Machinery & Industrial',
  'Furniture & Household',
  'Metals & Raw Materials',
] as const;

const HS_CATEGORY_ICONS: Record<typeof HS_CATEGORY_ORDER[number], string> = {
  'Electronics & Electrical':         '🔌',
  'Vehicles & Transport':             '🚗',
  'Textiles & Apparel':               '👕',
  'Food & Agriculture':               '🌾',
  'Chemicals, Plastics & Materials':  '🧪',
  'Machinery & Industrial':           '⚙️',
  'Furniture & Household':            '🛋️',
  'Metals & Raw Materials':           '⛏️',
};

const HS_CODE_SUGGESTIONS: { code: string; description: string; category: typeof HS_CATEGORY_ORDER[number] }[] = [
  // Electronics & Electrical
  { code: '8471.30', description: 'Portable automatic data-processing machines (laptops)', category: 'Electronics & Electrical' },
  { code: '8471.41', description: 'Automatic data-processing machines, desktop units', category: 'Electronics & Electrical' },
  { code: '8517.12', description: 'Telephones for cellular networks (smartphones)', category: 'Electronics & Electrical' },
  { code: '8517.62', description: 'Machines for reception/transmission of data (routers, modems)', category: 'Electronics & Electrical' },
  { code: '8528.72', description: 'Television receivers, colour', category: 'Electronics & Electrical' },
  { code: '8544.42', description: 'Electric conductors, fitted with connectors', category: 'Electronics & Electrical' },
  { code: '8501.10', description: 'Electric motors of an output not exceeding 37.5W', category: 'Electronics & Electrical' },
  { code: '8507.60', description: 'Lithium-ion batteries', category: 'Electronics & Electrical' },
  { code: '8536.69', description: 'Plugs, sockets and other connectors, voltage ≤1000V', category: 'Electronics & Electrical' },
  { code: '8418.10', description: 'Combined refrigerator-freezers, fitted with separate doors', category: 'Electronics & Electrical' },
  // Vehicles & Transport
  { code: '8704.21', description: 'Motor vehicles for goods transport, diesel', category: 'Vehicles & Transport' },
  { code: '8703.23', description: 'Motor cars, spark-ignition engine, 1500–3000cc', category: 'Vehicles & Transport' },
  { code: '8711.20', description: 'Motorcycles, 50cc–250cc', category: 'Vehicles & Transport' },
  { code: '8708.29', description: 'Other parts and accessories of motor vehicle bodies', category: 'Vehicles & Transport' },
  { code: '4011.10', description: 'New pneumatic tyres, of rubber, for motor cars', category: 'Vehicles & Transport' },
  // Textiles & Apparel
  { code: '6109.10', description: 'T-shirts and singlets, knitted, cotton', category: 'Textiles & Apparel' },
  { code: '6203.42', description: "Men's trousers, of cotton", category: 'Textiles & Apparel' },
  { code: '6204.62', description: "Women's trousers, of cotton", category: 'Textiles & Apparel' },
  { code: '6402.99', description: 'Footwear with outer soles of rubber/plastics', category: 'Textiles & Apparel' },
  { code: '5208.52', description: 'Woven fabrics of cotton, printed, ≥85% cotton', category: 'Textiles & Apparel' },
  // Food & Agriculture
  { code: '0303.89', description: 'Frozen fish, excluding fillets', category: 'Food & Agriculture' },
  { code: '0306.17', description: 'Frozen shrimps and prawns', category: 'Food & Agriculture' },
  { code: '1006.30', description: 'Semi-milled or wholly milled rice', category: 'Food & Agriculture' },
  { code: '0901.21', description: 'Coffee, roasted, not decaffeinated', category: 'Food & Agriculture' },
  { code: '1801.00', description: 'Cocoa beans, whole or broken, raw or roasted', category: 'Food & Agriculture' },
  { code: '2009.89', description: 'Other fruit/vegetable juices, unfermented', category: 'Food & Agriculture' },
  // Chemicals, Plastics & Materials
  { code: '2709.00', description: 'Petroleum oils and oils from bituminous minerals, crude', category: 'Chemicals, Plastics & Materials' },
  { code: '3004.90', description: 'Other medicaments, mixed, for retail sale', category: 'Chemicals, Plastics & Materials' },
  { code: '3926.90', description: 'Other articles of plastics', category: 'Chemicals, Plastics & Materials' },
  { code: '3923.21', description: 'Sacks and bags, of polymers of ethylene', category: 'Chemicals, Plastics & Materials' },
  { code: '3208.90', description: 'Paints and varnishes based on synthetic polymers', category: 'Chemicals, Plastics & Materials' },
  // Machinery & Industrial
  { code: '8413.70', description: 'Other centrifugal pumps', category: 'Machinery & Industrial' },
  { code: '8429.51', description: 'Front-end shovel loaders, self-propelled', category: 'Machinery & Industrial' },
  { code: '8483.40', description: 'Gears and gearing; ball/roller screws; gear boxes', category: 'Machinery & Industrial' },
  { code: '7308.90', description: 'Other structures and parts of structures, of iron/steel', category: 'Machinery & Industrial' },
  // Furniture & Household
  { code: '9403.20', description: 'Metal furniture of a kind used in offices', category: 'Furniture & Household' },
  { code: '9403.60', description: 'Other wooden furniture', category: 'Furniture & Household' },
  { code: '7013.49', description: 'Glassware for table/kitchen use', category: 'Furniture & Household' },
  // Metals & Raw Materials
  { code: '7210.49', description: 'Flat-rolled iron/steel, plated or coated with zinc', category: 'Metals & Raw Materials' },
  { code: '7601.10', description: 'Unwrought aluminium, not alloyed', category: 'Metals & Raw Materials' },
  { code: '7404.00', description: 'Copper waste and scrap', category: 'Metals & Raw Materials' },
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

// Uploads a list of File objects to the vault folder via the Storage-backed
// API route POST /api/vault/folders/[folderId]/documents.
// Returns an array of { fileName, fileUrl } for each successfully-uploaded file.
async function uploadFilesToVault(
  folderId: string,
  files: File[],
  fetchFn: typeof authFetch,
): Promise<void> {
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    await fetchFn(`/api/vault/folders/${folderId}/documents`, {
      method: 'POST',
      body: fd,
    });
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubSectionHeader({ icon: Icon, title, description, accent }: {
  icon: React.ElementType; title: string; description: string; accent: string;
}) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border-l-4 ${accent} bg-opacity-40 mb-5`}>
      <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-amber" />
      </div>
      <div>
        <h4 className="text-sm font-extrabold text-ink">{title}</h4>
        <p className="text-[11px] text-ink-faint mt-0.5 leading-snug">{description}</p>
      </div>
    </div>
  );
}

function PhilippinesBadge() {
  return (
    <div className="flex items-center gap-2 bg-mist-light border border-mist rounded-lg px-3 py-2 text-xs cursor-not-allowed select-none">
      <span>🇵🇭</span>
      <span className="font-bold text-ink">Philippines</span>
      <span className="ml-auto text-[9px] bg-amber-light text-amber font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Auto-set</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewShipmentPage() {
  const router = useRouter();
  const { currentUser, allUsers, loading } = useUserSession();
  const freighter = useFreighter();
  const [step, setStep] = useState(1);
  const [errorText, setErrorText] = useState('');

  // ── Step 1 · SHIPMENT RECEIPT PICKER ────────────────────────────────
  const [receipts,         setReceipts]         = useState<(ShipmentReceipt & { counterparty?: { id: string; fullName: string; companyName?: string; jobRole?: string } | null })[]>([]);
  const [receiptsLoading,  setReceiptsLoading]  = useState(true);
  const [appliedReceiptId, setAppliedReceiptId] = useState<string | null>(null);

  // ── Step 1 · SCOPE ────────────────────────────────────────────────────────────
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
  const [invoiceCurrency,  setInvoiceCurrency]  = useState<'USD' | 'PHP'>('USD');
  const [invoiceValue,     setInvoiceValue]     = useState('');
  const [totalValueUSD,    setTotalValueUSD]    = useState('');
  const [hsCode,           setHsCode]           = useState('');
  const [hsSearch,         setHsSearch]         = useState('');
  const [hsDropOpen,       setHsDropOpen]       = useState(false);
  const [hsCategoryFilter, setHsCategoryFilter] = useState<typeof HS_CATEGORY_ORDER[number] | null>(null);
  const [oracleRate,       setOracleRate]       = useState<{ rate: number; label: string } | null>(null);
  const [oracleLoading,    setOracleLoading]    = useState(false);
  const hsRef = useRef<HTMLDivElement>(null);

  // ── Step 1 · PHYSICAL SPECIFICATIONS ──────────────────────────────────────
  const [isDangerousGoods, setIsDangerousGoods] = useState(false);
  const [packageCount,     setPackageCount]     = useState('');
  const [packagingType,    setPackagingType]    = useState('Cartons');
  const [grossWeight,      setGrossWeight]      = useState('');
  const [weightUnit,       setWeightUnit]       = useState<'KG' | 'LBS'>('KG');

  const [selectedExporterId, setSelectedExporterId] = useState<string | null>(null);
  const [exporterSearch,     setExporterSearch]     = useState('');


  // ── Step 2 · DOCUMENTS ──────────────────────────────────────────────────────
  const [documents,        setDocuments]        = useState<File[]>([]);
  const [skipDocWarning,   setSkipDocWarning]   = useState(false);

  // ── Step 2 · VAULT SETUP ────────────────────────────────────────────────────
  const [vaultFolderName,  setVaultFolderName]  = useState('');
  const [vaultPassword,    setVaultPassword]    = useState('');
  const [showVaultPw,      setShowVaultPw]      = useState(false);
  const [pwCopied,         setPwCopied]         = useState(false);
  const [nameCopied,       setNameCopied]       = useState(false);

  // ── Step 3 · EXPORTER + LOGISTICS ─────────────────────────────────────────
  const [assignedUserIds,    setAssignedUserIds]    = useState<string[]>([]);
  const [priorityMilestones, setPriorityMilestones] = useState<MilestoneType[]>(DEFAULT_PRIORITY_MILESTONES);
  const [logisticsSearch,    setLogisticsSearch]    = useState('');
  const [trustedNetworkIds,  setTrustedNetworkIds]  = useState<string[]>([]);
  const [networkLoading,     setNetworkLoading]     = useState(false);

  // ── Step 4 · ESCROW ─────────────────────────────────────────────────────────
  const [assetCode,    setAssetCode]    = useState<AssetCode>('USDC');
  const [pphpPreview,  setPphpPreview]  = useState<{ php: number; usdc: number; rate: number; isLive: boolean } | null>(null);
  const [pphpPreviewing, setPphpPreviewing] = useState(false);
  const [phpRate,       setPhpRate]       = useState<number | null>(null);
  const [rateLoading,   setRateLoading]   = useState(false);
  const [rateError,     setRateError]     = useState(false);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [escrowSuccess, setEscrowSuccess] = useState(false);
  const [stellarStep,   setStellarStep]   = useState(''); // current step label
  const [txHash,        setTxHash]        = useState('');

  // ── ALL HOOKS MUST BE BEFORE EARLY RETURNS (Rules of Hooks) ───────────────

  // ── Fetch finalized Shipment Receipts ───────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    setReceiptsLoading(true);
    authFetch(`/api/shipments/receipts?userId=${currentUser.id}`)
      .then(r => r.json())
      .then(json => { if (json.success) setReceipts(json.data || []); })
      .catch(() => {})
      .finally(() => setReceiptsLoading(false));
  }, [currentUser?.id]);

  // ── Auto-suggest vault folder name when Step 2 becomes active ─────────────
  useEffect(() => {
    if (step === 2 && !vaultFolderName) {
      const suggested = deriveFolderName(description, originCountry, destinationPort);
      setVaultFolderName(suggested);
    }
  }, [step, description, originCountry, destinationPort, vaultFolderName]);

  // ── Fetch Trusted Network when reaching Step 3 ────────────────────────
  useEffect(() => {
    if (step !== 3) return;
    setNetworkLoading(true);
    authFetch(`/api/network/connections?userId=${currentUser?.id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const acceptedIds: string[] = json.data
            .filter((c: { status: string }) => c.status === 'ACCEPTED')
            .map((c: { otherParty?: { id: string } }) => c.otherParty?.id)
            .filter(Boolean);
          setTrustedNetworkIds(acceptedIds);
        }
      })
      .catch(() => {})
      .finally(() => setNetworkLoading(false));
  }, [step, currentUser?.id]);

  // ── Auto-lock country fields when scope is NATIONWIDE ───────────────────
  useEffect(() => {
    if (shipmentScope === 'NATIONWIDE') {
      setOriginCountry('Philippines');
      setDestCountry('Philippines');
    }
  }, [shipmentScope]);

  // ── Oracle rate fetcher ────────────────────────────────────────────────────
  const fetchOracleRate = useCallback(async (currency: string) => {
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
  }, [invoiceValue]);

  // ── PHP rate fetcher ─────────────────────────────────────────────────────────
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

  // ── Fetch oracle rate ──────────────────────────────────────────────────
  useEffect(() => {
    if (!invoiceValue || Number(invoiceValue) <= 0) {
      setOracleRate(null);
      setTotalValueUSD('');
      return;
    }
    const timeout = setTimeout(() => fetchOracleRate(invoiceCurrency), 600);
    return () => clearTimeout(timeout);
  }, [invoiceCurrency, invoiceValue, fetchOracleRate]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (hsRef.current && !hsRef.current.contains(e.target as Node)) setHsDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (step === 4 && shipmentScope === 'NATIONWIDE') fetchPhpRate();
  }, [step, shipmentScope]);

  // ── Recalculate PPHP↔USDC preview ──────────────────────────────────────────
  useEffect(() => {
    if (step !== 4 || assetCode !== 'PPHP' || !totalValueUSD || Number(totalValueUSD) <= 0) {
      setPphpPreview(null);
      return;
    }
    setPphpPreviewing(true);
    convertPphpToUsdc(Number(totalValueUSD) * (phpRate ?? 58.8)).then(result => {
      const phpAmount = phpRate
        ? Number(totalValueUSD) * phpRate
        : Number(totalValueUSD) * result.rate;
      setPphpPreview({ php: phpAmount, usdc: Number(totalValueUSD), rate: result.rate, isLive: result.isLive });
    }).catch(() => setPphpPreview(null))
      .finally(() => setPphpPreviewing(false));
  }, [step, assetCode, totalValueUSD, phpRate]);

  if (loading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  // Prefills the Step 1 form fields from a finalized chat Shipment Receipt.
  // The person can still edit anything afterwards — this is just a head start.
  const applyReceipt = (r: ShipmentReceipt) => {
    setDescription(r.cargoDescription || '');
    if (r.shipmentScope) setShipmentScope(r.shipmentScope);
    setEstimatedArrival(r.estimatedArrival ? r.estimatedArrival.substring(0, 10) : '');
    setImporterContact(r.importerContact || '');
    setExporterContact(r.exporterContact || '');
    setOriginCountry(r.originCountry || '');
    setOriginAddress(r.originAddress || '');
    setOriginPort(r.originPort || '');
    setDestCountry(r.destCountry || '');
    setDestAddress(r.destAddress || '');
    setDestinationPort(r.destinationPort || '');
    if (r.invoiceCurrency && ['USD', 'PHP'].includes(r.invoiceCurrency)) {
      setInvoiceCurrency(r.invoiceCurrency as 'USD' | 'PHP');
    }
    if (r.invoiceValue != null) setInvoiceValue(String(r.invoiceValue));
    setHsCode(r.hsCode || '');
    setIsDangerousGoods(Boolean(r.isDangerousGoods));
    if (r.packageCount != null) setPackageCount(String(r.packageCount));
    setPackagingType(r.packagingType || 'Cartons');
    if (r.grossWeight != null) setGrossWeight(String(r.grossWeight));
    setWeightUnit(r.weightUnit || 'KG');
    setAppliedReceiptId(r.id);
  };

  const filteredHs = HS_CODE_SUGGESTIONS.filter(h =>
    (hsCategoryFilter === null || h.category === hsCategoryFilter) &&
    (h.code.includes(hsSearch) || h.description.toLowerCase().includes(hsSearch.toLowerCase()))
  );
  const filteredHsGrouped = HS_CATEGORY_ORDER
    .map(cat => ({ category: cat, items: filteredHs.filter(h => h.category === cat) }))
    .filter(g => g.items.length > 0);

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
    if (step === 3) {
      if (!selectedExporterId)
        { setErrorText('Please select an exporter for this shipment.'); return false; }
      if (priorityMilestones.length === 0)
        { setErrorText('Select at least one priority milestone for escrow release.'); return false; }
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
        exporterId: selectedExporterId,
        description,
        totalValueUSD:          Number(totalValueUSD),
        originCountry,
        destinationPort,
        shipmentScope,
        estimatedArrival:       estimatedArrival || undefined,
        selectedLogisticsUsers: assignedUserIds,
        requiredMilestones:     priorityMilestones,
        documents:              [], // files are uploaded to Storage after vault folder creation
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
          escrowAsset:            assetCode,
        }),
      });
      const json = await res.json();
      if (!json.success || !json.data) {
        setErrorText(json.error || 'Failed to create shipment record.');
        return;
      }
      shipmentId    = json.data.id;
      referenceCode = json.data.referenceCode;

      // ── Upload documents to Supabase Storage via the vault folder API ──────
      // The vault folder is created synchronously inside POST /api/shipments
      // before this point, so we can look it up by shipmentId now.
      if (documents.length > 0) {
        setStellarStep('connect'); // reuse progress state to show we're still working
        try {
          const vfRes  = await authFetch(`/api/vault/folders?shipmentId=${shipmentId}`);
          const vfJson = await vfRes.json();
          if (vfJson.success && vfJson.data?.id) {
            await uploadFilesToVault(vfJson.data.id, documents, authFetch);
          }
        } catch {
          // Non-fatal: shipment is created, documents can be uploaded later from the vault
          console.warn('[new-shipment] Document upload failed — files can be added via the vault folder.');
        }
      }

      // ── 2. Connect Freighter wallet ──────────────────────────────────────────
      setStellarStep('connect');
      const importerAddress = freighter.publicKey ?? await freighter.connect();

      // ── 3. Resolve on-chain addresses ───────────────────────────────────────
      const exporterUser    = allUsers.find(u => u.id === selectedExporterId);
      const exporterAddress = exporterUser?.stellarWallet ?? PLATFORM_ADDRESS;

      const logisticsAddresses = assignedUserIds
        .map(uid => allUsers.find(u => u.id === uid)?.stellarWallet)
        .filter((addr): addr is string => Boolean(addr));

      // ── 4. Build escrow client ────────────────────────────────────────────────
      const client             = getMariTradeEscrowClient(STELLAR_NETWORK, importerAddress);
      const required_milestones = dbMilestonesToContractEnums(priorityMilestones);

      // Convert USD amount to USDC strobes (1 USDC = 10,000,000 strobes)
      const amount = BigInt(Math.round(Number(totalValueUSD) * 10_000_000));

      // ── 5. createEscrow (Freighter signs tx #1) ───────────────────────────────
      setStellarStep('create');
      await signAndSubmitWithRetry(
        () => client.create_escrow({
          reference_code:      referenceCode,
          importer:            importerAddress,
          exporter:            exporterAddress,
          amount,
          required_milestones,
          partial_refund_bps:  8000, // 80% refund if cancelled pre-departure
        }),
        STELLAR_NETWORK,
      );

      // ── 6. assignLogisticsUsers (Freighter signs tx #2) ─────────────────────
      if (logisticsAddresses.length > 0) {
        // Brief settle delay before building the next tx — gives the RPC
        // node a moment to register the previous transaction's new sequence
        // number before we fetch the account again. Cuts down on first-try
        // txBadSeq errors (the retry logic in signAndSubmitWithRetry still
        // covers anything this doesn't catch).
        await new Promise(r => setTimeout(r, 1500));
        setStellarStep('assign');
        await signAndSubmitWithRetry(
          () => client.assign_logistics_users({
            reference_code: referenceCode,
            importer:       importerAddress,
            users:          logisticsAddresses,
          }),
          STELLAR_NETWORK,
        );
      }

      // ── 7. fund (Freighter signs tx #3 — transfers USDC into vault) ──────────
      await new Promise(r => setTimeout(r, 1500));
      setStellarStep('fund');
      const fundHash = await signAndSubmitWithRetry(
        () => client.fund({ reference_code: referenceCode, importer: importerAddress }),
        STELLAR_NETWORK,
      );
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
      router.push(`/shipments/${shipmentId}`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stellar transaction failed.';
      setErrorText(msg);
      // If the DB record was created but chain failed, show a link to the shipment
      // rather than auto-redirecting — the user needs to see the error first.
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
          className="flex items-center gap-1.5 text-xs text-amber hover:text-ink font-bold cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Shipments
        </button>
        <h1 className="text-3xl font-black text-ink tracking-tight">Book Shipping Record</h1>
        <p className="text-xs text-ink-faint">
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
                  ${completed ? 'bg-teal text-white' : active ? 'bg-amber text-white' : 'bg-mist text-ink-faint'}`}>
                  {completed ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-bold hidden sm:block
                  ${active ? 'text-ink' : completed ? 'text-teal' : 'text-ink-faint'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 transition-all ${step > n ? 'bg-teal' : 'bg-mist'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {errorText && (
        <div className="mb-4 bg-wine-light border border-wine/20 text-wine font-semibold text-xs py-2.5 px-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {errorText}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1 — Cargo Details
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-6">

            {/* IMPORT FROM CHAT — receipts selector, always visible */}
            <div className="bg-white border-2 border-steel-light p-6 rounded-2xl space-y-4">
              <SubSectionHeader
                icon={Receipt}
                title="Import from Chat"
                description={receipts.length > 0 ? "Pick a finalized receipt from your messages to prefill this form with terms you and your counterparty already agreed on." : "No finalized receipts yet. Head to Messages to agree on shipment terms with your counterparty first, or fill in the form below manually."}
                accent="border-teal bg-teal-light"
              />
              {receiptsLoading ? (
                <div className="flex items-center gap-2 py-4 text-xs text-ink-faint">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading receipts from your chats…
                </div>
              ) : receipts.length === 0 ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-mist-light border border-mist rounded-xl p-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-bold text-ink-faint">No finalized receipts yet</p>
                    <p className="text-[11px] text-ink-faint leading-relaxed">
                      Receipts are created when you and your counterparty agree on terms inside a chat thread. Go to Messages, open a thread, and use the &quot;Finalize Receipt&quot; action — then come back here to import it.
                    </p>
                  </div>
                  <Link
                    href="/messages"
                    className="flex-shrink-0 flex items-center gap-1.5 bg-teal hover:bg-steel text-white text-[11px] font-black px-4 py-2 rounded-lg transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Go to Messages
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {receipts.map(r => {
                      const isApplied = appliedReceiptId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => applyReceipt(r)}
                          className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer
                            ${isApplied ? 'border-teal bg-teal-light shadow-sm' : 'border-mist hover:border-teal-light'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-ink line-clamp-2">
                              {r.cargoDescription || 'Untitled cargo'}
                            </p>
                            {isApplied && <CheckCircle2 className="w-4 h-4 text-teal flex-shrink-0" />}
                          </div>
                          <p className="text-[10px] text-ink-faint mt-1">
                            {r.originCountry || '—'} → {r.destinationPort || '—'}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] font-black text-steel font-sans">
                              {r.invoiceValue != null ? `${CURRENCY_SYMBOLS[r.invoiceCurrency || 'USD']}${r.invoiceValue.toLocaleString()}` : '—'}
                            </span>
                            {r.counterparty && (
                              <span className="text-[9px] font-bold text-ink-faint truncate max-w-[120px]">
                                with {r.counterparty.fullName.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {appliedReceiptId && (
                    <p className="text-[10px] text-steel font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" /> Form prefilled from receipt — feel free to edit anything below before continuing.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* A · SCOPE */}
            <div className="bg-white border border-mist p-6 rounded-2xl">
              <SubSectionHeader
                icon={Globe}
                title="Scope"
                description="Define the shipment route, scope, and both parties' contact details."
                accent="border-amber bg-amber-light"
              />
              <div className="space-y-2 mb-5">
                <label className="block text-xs font-bold text-ink-faint">Shipment Scope</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['OVERSEAS', 'NATIONWIDE'] as ShipmentScope[]).map(scope => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setShipmentScope(scope)}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer
                        ${shipmentScope === scope ? 'border-amber bg-amber-light' : 'border-mist hover:border-amber/30'}`}
                    >
                      <div className={`text-xs font-black ${shipmentScope === scope ? 'text-amber' : 'text-ink-faint'}`}>
                        {scope === 'OVERSEAS' ? '🌏 OVERSEAS' : '🇵🇭 NATIONWIDE'}
                      </div>
                      <div className="text-[10px] text-ink-faint mt-0.5">
                        {scope === 'OVERSEAS' ? 'USD · International bank/wire transfer' : 'USDC escrow · PHP indicative rate shown'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-ink-faint flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-amber" /> Importer Company / Contact
                  </label>
                  <input type="text" placeholder="e.g. Binondo Metals Importing Inc." className="w-full border border-mist rounded-lg px-3 py-2 text-xs outline-none focus:border-amber" value={importerContact} onChange={e => setImporterContact(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-ink-faint flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-teal" /> Exporter Company / Contact
                  </label>
                  <input type="text" placeholder="e.g. Osaka Trading Ltd." className="w-full border border-mist rounded-lg px-3 py-2 text-xs outline-none focus:border-amber" value={exporterContact} onChange={e => setExporterContact(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1 mb-5">
                <label className="block text-xs font-bold text-ink-faint">Cargo Description <span className="text-wine">*</span></label>
                <textarea rows={3} placeholder="e.g. 40ft container of high-precision automobile spares (Model RX-9)" className="w-full border border-mist rounded-lg p-2.5 text-xs outline-none focus:border-amber resize-none" value={description} onChange={e => setDescription(e.target.value)} />
              </div>

              <div className="space-y-1 mb-5">
                <label className="block text-xs font-bold text-ink-faint">Estimated Arrival (ETA)</label>
                <div className="relative max-w-xs">
                  <Calendar className="w-4 h-4 text-ink-faint absolute left-2.5 top-2.5" />
                  <input type="date" className="w-full border border-mist rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-amber" value={estimatedArrival} onChange={e => setEstimatedArrival(e.target.value)} />
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-amber flex-shrink-0" />
                  <span className="text-[10px] font-black text-ink uppercase tracking-widest">Origin</span>
                  <div className="flex-1 h-px bg-mist" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-faint">Country <span className="text-wine">*</span></label>
                    {isNationwide ? <PhilippinesBadge /> : (
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-ink-faint absolute left-2.5 top-2.5" />
                        <input type="text" placeholder="e.g. Japan" className="w-full border border-mist rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-amber" value={originCountry} onChange={e => setOriginCountry(e.target.value)} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-faint">Address</label>
                    <input type="text" placeholder={isNationwide ? 'e.g. Binondo, Manila' : 'e.g. 1-2-3 Namba, Osaka'} className="w-full border border-mist rounded-lg px-3 py-2 text-xs outline-none focus:border-amber" value={originAddress} onChange={e => setOriginAddress(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-faint">Port</label>
                    <div className="relative">
                      <Ship className="w-4 h-4 text-ink-faint absolute left-2.5 top-2.5" />
                      <input type="text" placeholder={isNationwide ? 'e.g. Port of Manila' : 'e.g. Port of Osaka'} className="w-full border border-mist rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-amber" value={originPort} onChange={e => setOriginPort(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                  <span className="text-[10px] font-black text-steel uppercase tracking-widest">Destination</span>
                  <div className="flex-1 h-px bg-mist" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-faint">Country</label>
                    {isNationwide ? <PhilippinesBadge /> : (
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-ink-faint absolute left-2.5 top-2.5" />
                        <input type="text" placeholder="e.g. Philippines" className="w-full border border-mist rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-amber" value={destCountry} onChange={e => setDestCountry(e.target.value)} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-faint">Address</label>
                    <input type="text" placeholder="e.g. Binondo, Manila 1006" className="w-full border border-mist rounded-lg px-3 py-2 text-xs outline-none focus:border-amber" value={destAddress} onChange={e => setDestAddress(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-faint">Port <span className="text-wine">*</span></label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-ink-faint absolute left-2.5 top-2.5" />
                      <input type="text" placeholder="e.g. Port of Cebu" className="w-full border border-mist rounded-lg pl-8 pr-2.5 py-2 text-xs outline-none focus:border-amber" value={destinationPort} onChange={e => setDestinationPort(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* B · COMMERCIAL VALUE */}
            <div className="bg-white border border-mist p-6 rounded-2xl">
              <SubSectionHeader icon={Coins} title="Commercial Value" description="Invoice currency, value, live oracle conversion rate, and HS tariff code." accent="border-teal bg-teal-light" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-ink-faint">Invoice Currency <span className="text-wine">*</span></label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['USD', 'PHP'] as const).map(cur => (
                      <button key={cur} type="button" onClick={() => setInvoiceCurrency(cur)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all cursor-pointer ${invoiceCurrency === cur ? 'border-teal bg-teal-light text-steel' : 'border-mist text-ink-faint hover:border-amber/30'}`}>
                        {cur}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-ink-faint">Invoice Value <span className="text-wine">*</span></label>
                  <div className="relative">
                    {invoiceCurrency === 'PHP' ? (
                      <span className="w-4 h-4 text-ink-faint absolute left-2.5 top-2 text-xs font-black leading-none">₱</span>
                    ) : (
                      <DollarSign className="w-4 h-4 text-ink-faint absolute left-2.5 top-2.5" />
                    )}
                    <input type="number" min="0" placeholder="0.00" className="w-full border border-mist rounded-lg pl-8 pr-14 py-2 text-xs font-sans outline-none focus:border-amber" value={invoiceValue} onChange={e => setInvoiceValue(e.target.value)} />
                    <span className="absolute right-3 top-2 text-[10px] text-ink-faint font-bold">{invoiceCurrency}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl border border-mist bg-mist-light flex items-center gap-3 min-h-[46px]">
                <RefreshCw className={`w-4 h-4 text-teal flex-shrink-0 ${oracleLoading ? 'animate-spin' : ''}`} />
                {oracleLoading && <span className="text-[11px] text-ink-faint italic">Fetching live oracle rate…</span>}
                {!oracleLoading && oracleRate && (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[11px] text-steel font-bold font-sans">{oracleRate.label}</span>
                    {totalValueUSD && <span className="text-[11px] bg-teal-light text-steel border border-steel-light rounded px-2 py-0.5 font-black font-sans">≈ {Number(totalValueUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC</span>}
                  </div>
                )}
                {!oracleLoading && !oracleRate && <span className="text-[11px] text-ink-faint">{invoiceValue && Number(invoiceValue) > 0 ? 'Rate unavailable.' : 'Enter an invoice value to see live conversion rate.'}</span>}
              </div>
              <div className="mt-5 space-y-1" ref={hsRef}>
                <label className="block text-xs font-bold text-ink-faint flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-amber" /> HS Code / Tariff Code <span className="text-[10px] font-normal text-ink-faint">(6–10 digits)</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-ink-faint absolute left-2.5 top-2.5" />
                  <input type="text" placeholder="Type code or keyword…" className="w-full border border-mist rounded-lg pl-8 pr-2.5 py-2 text-xs font-sans outline-none focus:border-amber"
                    value={hsCode || hsSearch}
                    onChange={e => { setHsSearch(e.target.value); setHsCode(e.target.value); setHsDropOpen(true); }}
                    onFocus={() => setHsDropOpen(true)}
                  />
                  {hsDropOpen && filteredHs.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-mist rounded-xl shadow-lg overflow-hidden">
                      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-mist-light overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setHsCategoryFilter(null)}
                          className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black border transition-all ${hsCategoryFilter === null ? 'border-amber bg-amber-light text-amber' : 'border-mist text-ink-faint hover:border-amber/30'}`}
                        >
                          All
                        </button>
                        {HS_CATEGORY_ORDER.map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setHsCategoryFilter(prev => prev === cat ? null : cat)}
                            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black border transition-all whitespace-nowrap ${hsCategoryFilter === cat ? 'border-amber bg-amber-light text-amber' : 'border-mist text-ink-faint hover:border-amber/30'}`}
                          >
                            {HS_CATEGORY_ICONS[cat]} {cat}
                          </button>
                        ))}
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {filteredHsGrouped.map(group => (
                          <div key={group.category}>
                            <div className="sticky top-0 bg-mist-light px-4 py-1.5 text-[9px] font-black text-ink-faint uppercase tracking-widest border-b border-mist">
                              {HS_CATEGORY_ICONS[group.category]} {group.category}
                            </div>
                            {group.items.map(h => (
                              <button key={h.code} type="button" onClick={() => { setHsCode(h.code); setHsSearch(h.code); setHsDropOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-light text-left transition-all group">
                                <span className="font-sans text-xs font-black text-amber flex-shrink-0 group-hover:text-ink">{h.code}</span>
                                <span className="text-[11px] text-ink-faint truncate">{h.description}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* C · PHYSICAL SPECIFICATIONS */}
            <div className="bg-white border border-mist p-6 rounded-2xl">
              <SubSectionHeader icon={Package} title="Physical Specifications" description="Dangerous goods classification, package count, and gross weight details." accent="border-wine bg-wine-light" />
              <div className="flex items-center justify-between p-4 bg-mist-light rounded-xl border border-mist mb-5">
                <div>
                  <p className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <AlertTriangle className={`w-4 h-4 ${isDangerousGoods ? 'text-wine' : 'text-mist-dark'}`} /> Dangerous Goods / HazMat
                  </p>
                  <p className="text-[10px] text-ink-faint mt-0.5">IMDG-classified hazardous materials?</p>
                </div>
                <button type="button" onClick={() => setIsDangerousGoods(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all cursor-pointer ${isDangerousGoods ? 'border-wine bg-wine-light text-wine' : 'border-mist bg-white text-ink-faint hover:border-mist-dark'}`}>
                  {isDangerousGoods ? <><ToggleRight className="w-4 h-4" /> YES — HazMat</> : <><ToggleLeft className="w-4 h-4" /> NO</>}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-ink-faint flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-amber" /> Total Package / Piece Count</label>
                  <div className="flex gap-2">
                    <input type="number" min="1" placeholder="00" className="w-24 border border-mist rounded-lg px-3 py-2 text-xs font-sans outline-none focus:border-amber flex-shrink-0" value={packageCount} onChange={e => setPackageCount(e.target.value)} />
                    <select className="flex-1 border border-mist rounded-lg px-2.5 py-2 text-xs outline-none focus:border-amber bg-white cursor-pointer" value={packagingType} onChange={e => setPackagingType(e.target.value)}>
                      {PACKAGING_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-ink-faint flex items-center gap-1.5"><Weight className="w-3.5 h-3.5 text-amber" /> Total Gross Weight</label>
                  <div className="flex gap-2">
                    <input type="number" min="0" step="0.01" placeholder="0000" className="flex-1 border border-mist rounded-lg px-3 py-2 text-xs font-sans outline-none focus:border-amber" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} />
                    <div className="flex gap-1">
                      {(['KG', 'LBS'] as const).map(unit => (
                        <button key={unit} type="button" onClick={() => setWeightUnit(unit)}
                          className={`px-3 py-2 rounded-lg text-xs font-black border-2 transition-all cursor-pointer ${weightUnit === unit ? 'border-amber bg-amber-light text-amber' : 'border-mist text-ink-faint hover:border-amber/30'}`}>
                          {unit}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pb-4">
              <button onClick={nextStep} className="flex items-center gap-2 bg-amber hover:bg-ink text-white font-black py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all shadow-sm">
                Next: Documents <ChevronRight className="w-4 h-4" />
              </button>
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
            <div className="bg-white border border-mist p-6 rounded-2xl space-y-5">
              <h3 className="font-extrabold text-sm text-ink flex items-center gap-2 border-b border-mist-light pb-3">
                <FileText className="w-5 h-5 text-amber" /> Upload Shipping Documents
              </h3>
              <p className="text-xs text-ink-faint">
                Upload bills of lading, commercial invoices, packing lists, or any BOC-relevant files.
                All uploads will be grouped inside the vault folder you configure below.
              </p>

              <label className="block border-2 border-dashed border-mist hover:border-amber rounded-xl p-10 text-center cursor-pointer transition-all group">
                <Upload className="w-9 h-9 text-mist-dark group-hover:text-amber mx-auto mb-2 transition-all" />
                <p className="text-xs font-bold text-ink-faint group-hover:text-amber">Click to upload or drag &amp; drop</p>
                <p className="text-[10px] text-ink-faint mt-1">PDF, DOC, XLS, PNG, JPG — any file type accepted</p>
                <input type="file" multiple className="hidden" onChange={handleDocAdd} />
              </label>

              {documents.length > 0 && (
                <div className="space-y-2">
                  {documents.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between bg-mist-light border border-mist rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-ink-faint truncate max-w-sm">{doc.name}</p>
                          <p className="text-[10px] text-ink-faint">{(doc.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button onClick={() => handleDocRemove(i)} className="text-ink-faint hover:text-wine cursor-pointer transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {skipDocWarning && documents.length === 0 && (
                <div className="flex items-start gap-2 bg-amber-light border border-amber/30 text-amber text-xs p-3 rounded-lg">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>No documents uploaded. You can continue, but documents must be added before customs clearance. <strong>Click Next again to skip.</strong></span>
                </div>
              )}
            </div>

            {/* BOC DOCUMENT VAULT SETUP */}
            <div className="bg-white border-2 border-amber-light rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-ink px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 bg-ink-soft rounded-xl flex items-center justify-center flex-shrink-0">
                  <FolderLock className="w-5 h-5 text-amber" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">BOC Document Vault — Folder Setup</h3>
                  <p className="text-[10px] text-amber-light">Configure the vault folder that will hold all documents for this shipment.</p>
                </div>
                <span className="ml-auto text-[9px] font-black bg-teal/20 text-teal border border-teal/30 px-2 py-1 rounded-lg tracking-widest uppercase">Required</span>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-start gap-3 bg-amber-light border border-amber-light rounded-xl p-4 text-xs text-ink-soft">
                  <ShieldCheck className="w-4 h-4 text-amber flex-shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="font-bold">How Vault Folders work:</strong> A password-protected folder is created in the BOC Document Vault for this shipment. All authorized users can <em>see</em> the folder, but must enter the correct vault password to open it and access the documents inside.
                    <span className="block mt-1 text-amber">Share the password only with those who need direct document access.</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-ink flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-amber" />
                    Vault Folder Name <span className="text-wine">*</span>
                    <span className="text-[10px] font-normal text-ink-faint ml-1">— visible to all authorized users</span>
                  </label>
                  <div className="relative">
                    <input type="text" placeholder="e.g. JPN-MNL_STEEL_COILS_2026"
                      className="w-full border border-mist rounded-xl px-4 py-3 pr-10 text-sm font-sans outline-none focus:border-amber bg-mist-light text-ink tracking-wide"
                      value={vaultFolderName} onChange={e => setVaultFolderName(e.target.value.toUpperCase().replace(/\s+/g, '_'))} />
                    <button type="button" onClick={handleCopyName} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-amber transition-colors" title="Copy folder name">
                      {nameCopied ? <CheckCircle2 className="w-4 h-4 text-teal" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setVaultFolderName(deriveFolderName(description, originCountry, destinationPort))}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-amber hover:text-ink transition-colors border border-amber-light bg-amber-light px-2.5 py-1 rounded-lg">
                      <Shuffle className="w-3 h-3" /> Re-suggest from cargo details
                    </button>
                    <p className="text-[10px] text-ink-faint">Letters, numbers, hyphens and underscores only.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-ink flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-amber" />
                    Vault Password <span className="text-wine">*</span>
                    <span className="text-[10px] font-normal text-ink-faint ml-1">— required to open this folder in the BOC Vault</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input type={showVaultPw ? 'text' : 'password'} placeholder="Type a custom password or generate one →"
                        className={`w-full border rounded-xl px-4 py-3 pr-20 text-sm font-sans tracking-widest outline-none transition-colors ${vaultPassword ? 'border-teal bg-teal-light/40 text-ink focus:border-teal' : 'border-mist bg-mist-light focus:border-amber text-ink'}`}
                        value={vaultPassword} onChange={e => setVaultPassword(e.target.value)} />
                      <button type="button" onClick={() => setShowVaultPw(v => !v)} className="absolute right-9 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors" title={showVaultPw ? 'Hide' : 'Show'}>
                        {showVaultPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button type="button" onClick={handleCopyPassword} disabled={!vaultPassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-amber disabled:opacity-30 transition-colors" title="Copy password">
                        {pwCopied ? <CheckCircle2 className="w-4 h-4 text-teal" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <button type="button" onClick={handleGeneratePassword} className="flex items-center gap-1.5 bg-amber hover:bg-ink text-white font-bold px-4 py-3 rounded-xl text-xs transition-all whitespace-nowrap flex-shrink-0">
                      <Shuffle className="w-3.5 h-3.5" /> Generate
                    </button>
                  </div>
                  {vaultPassword && (
                    <div className="flex items-center gap-2">
                      {(() => {
                        const len = vaultPassword.length;
                        const score = [len >= 8, /[A-Z]/.test(vaultPassword), /[0-9]/.test(vaultPassword), /[^A-Za-z0-9]/.test(vaultPassword)].filter(Boolean).length;
                        const configs = [
                          { label: 'Too short', color: 'bg-wine', text: 'text-wine' },
                          { label: 'Weak',      color: 'bg-wine', text: 'text-wine' },
                          { label: 'Fair',      color: 'bg-amber', text: 'text-amber' },
                          { label: 'Good',      color: 'bg-teal', text: 'text-steel' },
                          { label: 'Strong',    color: 'bg-teal', text: 'text-steel' },
                        ];
                        const cfg = len < 6 ? configs[0] : configs[score];
                        return (
                          <>
                            <div className="flex gap-1">{[0,1,2,3].map(i => <div key={i} className={`h-1 w-8 rounded-full transition-colors ${i < score ? cfg.color : 'bg-mist'}`} />)}</div>
                            <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.label}</span>
                            <span className="text-[10px] text-ink-faint">{vaultPassword.length} characters</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {(vaultFolderName || vaultPassword) && (
                  <div className="bg-mist-light border border-mist rounded-xl p-4 space-y-3">
                    <p className="text-[10px] font-black text-ink-faint uppercase tracking-widest">Vault Folder Preview</p>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-light rounded-xl flex items-center justify-center flex-shrink-0"><FolderLock className="w-5 h-5 text-amber" /></div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-black text-ink font-sans truncate">{vaultFolderName || <span className="text-mist-dark font-normal">Folder name not set</span>}</p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={`flex items-center gap-1 font-bold ${vaultPassword ? 'text-steel' : 'text-wine'}`}>
                            {vaultPassword ? <><Lock className="w-3 h-3" /> Password set</> : <><AlertTriangle className="w-3 h-3" /> No password</>}
                          </span>
                          {documents.length > 0 && <><span className="text-mist-dark">·</span><span className="text-ink-faint">{documents.length} document{documents.length > 1 ? 's' : ''} will be added</span></>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pb-4">
              <button onClick={prevStep} className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink font-bold cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={nextStep} className="flex items-center gap-2 bg-amber hover:bg-ink text-white font-black py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all">
                Next: Assign Logistics <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Vault sidebar guide */}
          <div className="lg:col-span-2">
            <div className="bg-ink text-white p-6 rounded-2xl space-y-5 sticky top-6">
              <h3 className="font-extrabold text-sm flex items-center gap-2"><FolderLock className="w-4 h-4 text-teal" /> Vault Setup Guide</h3>
              <div className="space-y-4 text-[11px] text-mist leading-relaxed">
                {[
                  { icon: FolderOpen, color: 'text-amber', title: 'Folder Name', desc: "A human-readable identifier for this shipment's document folder. Visible to all authorized BOC Vault users." },
                  { icon: Key, color: 'text-teal', title: 'Vault Password', desc: 'Required to open the folder and access its documents. Use Generate for a cryptographically random password.' },
                  { icon: ShieldCheck, color: 'text-wine', title: 'Security Note', desc: 'MariTrade does not store vault passwords in plain text. Once created, this password cannot be retrieved — only reset by the shipment owner.' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 border-b border-ink-soft pb-4 last:border-0 last:pb-0">
                    <div className="w-7 h-7 rounded-lg bg-ink-soft flex items-center justify-center flex-shrink-0 mt-0.5">
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
          STEP 3 — Logistics, Exporter & Priority Milestones
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-6">

          {/* EXPORTER PICKER */}
          <div className="bg-white border-2 border-steel-light p-6 rounded-2xl space-y-4">
            <h3 className="font-extrabold text-sm text-ink flex items-center gap-2 border-b border-mist-light pb-3">
              <Building2 className="w-5 h-5 text-teal" /> Select Exporter <span className="text-wine">*</span>
            </h3>
            <p className="text-xs text-ink-faint">Search for a registered MariTrade user with the Exporter role. They will be the counterparty who receives USDC when funds are released.</p>
            <div className="flex items-start gap-2.5 bg-amber-light border border-amber/30 rounded-xl px-3 py-2.5 text-[11px] text-amber">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber" />
              <span>The exporter must have a <strong>Stellar wallet address</strong> saved in their MariTrade profile before they can be selected. Ask them to go to <strong>My Profile → Stellar Public Wallet Key</strong> and save their Freighter address (starts with G…).</span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-ink-faint absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, company, or email…"
                className="w-full border border-mist rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-teal"
                value={exporterSearch}
                onChange={e => setExporterSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(() => {
                const exporters = allUsers.filter(u =>
                  u.jobRole === 'EXPORTER' &&
                  u.id !== currentUser.id &&
                  (exporterSearch === '' ||
                    u.fullName.toLowerCase().includes(exporterSearch.toLowerCase()) ||
                    (u.companyName || '').toLowerCase().includes(exporterSearch.toLowerCase()) ||
                    (u.email || '').toLowerCase().includes(exporterSearch.toLowerCase()))
                );
                if (exporters.length === 0) return (
                  <div className="py-6 text-center border border-dashed border-mist rounded-xl bg-mist-light">
                    <Building2 className="w-8 h-8 text-mist mx-auto mb-2" />
                    <p className="text-xs font-bold text-ink-faint">{exporterSearch ? 'No exporters match your search' : 'No exporters registered yet'}</p>
                  </div>
                );
                return exporters.map(user => {
                  const selected = selectedExporterId === user.id;
                  const hasWallet = Boolean(user.stellarWallet);
                  return (
                    <button key={user.id}
                      onClick={() => hasWallet && setSelectedExporterId(selected ? null : user.id)}
                      disabled={!hasWallet}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all ${
                        !hasWallet
                          ? 'border-mist bg-mist-light opacity-60 cursor-not-allowed'
                          : selected
                          ? 'border-teal bg-teal-light cursor-pointer'
                          : 'border-mist hover:border-teal-light cursor-pointer'
                      }`}>
                      <div>
                        <p className="text-xs font-bold text-ink">{user.fullName}</p>
                        <p className={`text-[10px] ${hasWallet ? 'text-ink-faint' : 'text-wine font-semibold'}`}>
                          {user.companyName} · {hasWallet ? '🔗 Stellar wallet linked' : '⚠️ No Stellar wallet — cannot be selected'}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        selected ? 'bg-teal text-white' : 'bg-mist-light text-ink-faint'
                      }`}>
                        {selected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
            {selectedExporterId && (() => {
              const exp = allUsers.find(u => u.id === selectedExporterId);
              return exp ? (
                <div className="flex items-center gap-3 bg-teal-light border border-teal-light rounded-xl px-4 py-3">
                  <Check className="w-4 h-4 text-teal flex-shrink-0" />
                  <div>
                    <p className="text-xs font-black text-steel-hover">{exp.fullName}</p>
                    <p className="text-[10px] text-steel">{exp.companyName} — selected as exporter</p>
                  </div>
                  <button onClick={() => setSelectedExporterId(null)} className="ml-auto text-ink-faint hover:text-wine transition-colors"><X className="w-4 h-4" /></button>
                </div>
              ) : null;
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-mist p-6 rounded-2xl space-y-4">
              <h3 className="font-extrabold text-sm text-ink flex items-center gap-2 border-b border-mist-light pb-3">
                <Users className="w-5 h-5 text-amber" /> Assign Logistics Chain Users
              </h3>
              <p className="text-xs text-ink-faint">Assigned users can log milestone events. Customs Brokers also gain BOC vault access.</p>
              <input type="text" placeholder="Search by name, company, or role..." className="w-full border border-mist rounded-lg px-3 py-2 text-xs outline-none focus:border-amber" value={logisticsSearch} onChange={e => setLogisticsSearch(e.target.value)} />
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {networkLoading ? (
                  <div className="py-8 text-center"><div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-xs text-ink-faint">Loading your Trusted Network…</p></div>
                ) : logisticsUsers.length === 0 ? (
                  <div className="py-6 px-3 text-center space-y-2 border border-dashed border-mist rounded-xl bg-mist-light">
                    <Users className="w-8 h-8 text-mist mx-auto" />
                    <p className="text-xs font-bold text-ink-faint">No trusted vendors yet</p>
                    <Link href="/network" target="_blank" className="inline-flex items-center gap-1 text-[11px] font-black text-amber hover:text-ink transition-colors">Build your network →</Link>
                  </div>
                ) : logisticsUsers.map(user => {
                  const assigned = assignedUserIds.includes(user.id);
                  const roleConfig: Record<string, { label: string; color: string; phases: string }> = {
                    FREIGHT_FORWARDER:  { label: '🚢 Freight Forwarder',  color: 'bg-amber-light text-amber',       phases: 'Vessel booking, B/L, port ops' },
                    CUSTOMS_BROKER:     { label: '🛃 Customs Broker',     color: 'bg-wine-light text-wine',         phases: 'BOC filing, duties, clearance' },
                    WAREHOUSE_OPERATOR: { label: '🏬 Warehouse Operator', color: 'bg-steel-light text-steel-hover', phases: 'Packing, staging, handoff' },
                  };
                  const rc = roleConfig[user.jobRole] ?? { label: JOB_ROLE_LABELS[user.jobRole], color: 'bg-mist text-ink-faint', phases: '' };
                  const ownedCount = (ROLE_MILESTONES[user.jobRole as JobRole] ?? []).length;
                  return (
                    <button key={user.id} onClick={() => toggleUser(user.id)}
                      className={`w-full flex items-start justify-between p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        assigned ? 'border-teal bg-teal-light' : 'border-mist hover:border-amber/30'
                      }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-ink">{user.fullName}</p>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide ${rc.color}`}>
                            {rc.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-ink-faint mt-0.5">{user.companyName}</p>
                        {rc.phases && (
                          <p className="text-[10px] text-ink-faint mt-1 leading-tight">
                            <span className="font-semibold">Responsible for:</span> {rc.phases}
                            {ownedCount > 0 && <span className="ml-1 text-[9px] bg-mist text-ink-faint px-1 rounded">{ownedCount} milestones</span>}
                          </p>
                        )}
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ml-2 ${
                        assigned ? 'bg-teal text-white' : 'bg-mist-light text-ink-faint'
                      }`}>
                        {assigned ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-mist p-6 rounded-2xl space-y-4">
              <h3 className="font-extrabold text-sm text-ink flex items-center gap-2 border-b border-mist-light pb-3">
                <Lock className="w-5 h-5 text-amber" /> Priority Milestones for Escrow Release
              </h3>
              <p className="text-xs text-ink-faint">The <strong>Release Funds</strong> button stays locked until <strong>all</strong> selected milestones are confirmed.</p>
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {(Object.keys(PHASE_MILESTONE_SEQUENCE) as ShipmentPhase[]).map(phase => (
                  <div key={phase}>
                    <p className="text-[10px] font-black text-ink-faint uppercase tracking-wider mb-1.5">{PHASE_LABELS[phase]}</p>
                    <div className="space-y-1">
                      {PHASE_MILESTONE_SEQUENCE[phase].map(type => {
                        const selected = priorityMilestones.includes(type);
                        const responsibleRole =
                          (ROLE_MILESTONES.FREIGHT_FORWARDER  as MilestoneType[]).includes(type) ? { label: 'FF',  color: 'bg-amber-light text-amber',       title: 'Freight Forwarder' } :
                          (ROLE_MILESTONES.CUSTOMS_BROKER     as MilestoneType[]).includes(type) ? { label: 'CB',  color: 'bg-wine-light text-wine',         title: 'Customs Broker' } :
                          (ROLE_MILESTONES.WAREHOUSE_OPERATOR as MilestoneType[]).includes(type) ? { label: 'WO',  color: 'bg-steel-light text-steel-hover', title: 'Warehouse Operator' } :
                          null;
                        return (
                          <button key={type} onClick={() => toggleMilestone(type)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer text-xs ${
                              selected ? 'border-amber bg-amber-light text-ink font-semibold' : 'border-mist text-ink-faint hover:border-amber/30'
                            }`}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${selected ? 'bg-amber' : 'bg-mist-light'}`}>
                              {selected && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="flex-1">{MILESTONE_LABELS[type]}</span>
                            {responsibleRole && (
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${responsibleRole.color}`}
                                title={responsibleRole.title}
                              >
                                {responsibleRole.label}
                              </span>
                            )}
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
            <button onClick={prevStep} className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink font-bold cursor-pointer">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={nextStep} className="flex items-center gap-2 bg-amber hover:bg-ink text-white font-black py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider cursor-pointer transition-all">
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
          <div className="lg:col-span-3 bg-white border border-mist p-6 rounded-2xl space-y-5">
            <h3 className="font-extrabold text-sm text-ink flex items-center gap-2 border-b border-mist-light pb-3">
              <ClipboardCheck className="w-5 h-5 text-amber" /> Shipment Summary
            </h3>

            <dl className="text-xs divide-y divide-mist-light">
              {([
                ['Scope', (
                  <span key="scope" className={`font-black px-2 py-0.5 rounded text-[10px] ${shipmentScope === 'OVERSEAS' ? 'bg-amber-light text-ink-soft' : 'bg-teal-light text-steel'}`}>{shipmentScope}</span>
                )],
                ['Cargo',         description],
                ['Importer',      importerContact || currentUser.fullName],
                ['Exporter',      (() => { const exp = allUsers.find(u => u.id === selectedExporterId); return exp ? `${exp.fullName} (${exp.companyName})` : exporterContact || 'Not specified'; })()],
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
                  <dt className="text-ink-faint font-semibold flex-shrink-0">{label}</dt>
                  <dd className="text-right font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Vault summary */}
            <div className="border border-amber-light bg-amber-light rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FolderLock className="w-4 h-4 text-amber" />
                <p className="text-xs font-extrabold text-ink">BOC Vault Folder</p>
                <span className="ml-auto text-[9px] font-black bg-steel-light text-steel px-1.5 py-0.5 rounded uppercase">Will be created on submit</span>
              </div>
              <dl className="divide-y divide-amber-light text-xs">
                <div className="flex items-center justify-between py-2">
                  <dt className="text-amber font-semibold">Folder Name</dt>
                  <dd className="font-black text-ink font-sans text-right truncate max-w-[200px]">{vaultFolderName}</dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-amber font-semibold">Vault Password</dt>
                  <dd className="flex items-center gap-2">
                    <span className="font-sans font-black text-ink tracking-widest">{'•'.repeat(Math.min(vaultPassword.length, 12))}</span>
                    <button type="button" onClick={handleCopyPassword} className="text-amber hover:text-ink transition-colors" title="Copy password">
                      {pwCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-teal" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-amber font-semibold">Initial Documents</dt>
                  <dd className="font-semibold text-ink">{documents.length > 0 ? `${documents.length} file${documents.length > 1 ? 's' : ''}` : 'None'}</dd>
                </div>
              </dl>
              <div className="flex items-start gap-2 text-[10px] text-ink-soft bg-white border border-amber-light rounded-lg p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber flex-shrink-0 mt-0.5" />
                <span>Save your vault password before submitting. It cannot be retrieved from MariTrade after the folder is created.</span>
              </div>
            </div>

            <div className="pt-2">
              <button onClick={prevStep} className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink font-bold cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </div>
          </div>

          {/* ── Escrow panel ── */}
          <div className="lg:col-span-2">
            <div className="bg-ink text-white p-6 rounded-2xl space-y-5">
              <h3 className="font-extrabold text-sm flex items-center gap-2"><Wallet className="w-5 h-5 text-teal" /> Stellar Escrow</h3>

              {/* Asset selector */}
              <div className="space-y-2">
                <p className="text-[10px] text-amber-light font-semibold uppercase tracking-wider">Pay With</p>
                <AssetSelector
                  value={assetCode}
                  onChange={(code) => { setAssetCode(code); setPphpPreview(null); }}
                  className=""
                />
                {assetCode === 'PPHP' && (
                  <p className="text-[10px] text-amber leading-relaxed">
                    Your PPHP balance covers the peso equivalent. The Stellar escrow contract locks the USDC equivalent on-chain.
                  </p>
                )}
              </div>

              {/* Amount block */}
              <div className="bg-ink-soft rounded-xl p-4 space-y-1">
                <p className="text-[10px] text-amber-light font-semibold uppercase tracking-wider">Escrow Amount</p>
                <p className="text-3xl font-black text-white font-sans">{Number(totalValueUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-teal font-bold">USDC · Stellar {STELLAR_NETWORK}</p>
                {invoiceCurrency !== 'USD' && invoiceValue && <p className="text-[10px] text-amber-light pt-1">Invoice: {invoiceValue} {invoiceCurrency}</p>}
              </div>

              {/* PPHP conversion preview */}
              {assetCode === 'PPHP' && (
                <div className="bg-yellow-900/30 border border-yellow-600/30 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider">Philippine Peso Bridge</p>
                  {pphpPreviewing && (
                    <p className="text-sm text-yellow-300 animate-pulse">Fetching live rate…</p>
                  )}
                  {!pphpPreviewing && pphpPreview && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-yellow-200">You pay (PPHP)</span>
                        <span className="text-lg font-black text-yellow-300 font-sans">
                          ₱{pphpPreview.php.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-yellow-200">Escrow locks (USDC)</span>
                        <span className="text-lg font-black text-white font-sans">
                          ${pphpPreview.usdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="text-[10px] text-yellow-400 border-t border-yellow-600/30 pt-2">
                        Rate: 1 USD = ₱{pphpPreview.rate.toFixed(4)}{!pphpPreview.isLive && ' (est.)'}
                      </p>
                    </>
                  )}
                  {!pphpPreviewing && !pphpPreview && totalValueUSD && (
                    <p className="text-xs text-yellow-400">Rate unavailable — enter invoice value to calculate.</p>
                  )}
                </div>
              )}

              {/* PHP equivalent panel for NATIONWIDE + USDC (existing behaviour) */}
              {shipmentScope === 'NATIONWIDE' && assetCode === 'USDC' && (
                <div className="bg-ink-soft rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-amber-light font-semibold uppercase tracking-wider">PHP Equivalent</p>
                    <button onClick={fetchPhpRate} disabled={rateLoading} className="text-teal hover:text-teal-hover cursor-pointer disabled:opacity-40"><RefreshCw className={`w-3 h-3 ${rateLoading ? 'animate-spin' : ''}`} /></button>
                  </div>
                  {rateLoading && <p className="text-sm text-amber animate-pulse">Fetching live rate…</p>}
                  {!rateLoading && phpEquivalent && (
                    <><p className="text-2xl font-black text-white font-sans">₱ {phpEquivalent}</p><p className="text-[10px] text-amber">Live rate: 1 USD = ₱{phpRate?.toFixed(4)}</p></>
                  )}
                </div>
              )}

              {/* Freighter wallet status */}
              <div className="bg-ink-soft rounded-xl p-3 space-y-2">
                <p className="text-[10px] text-amber-light font-semibold uppercase tracking-wider">Freighter Wallet</p>
                {freighter.publicKey ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                    <span className="font-sans text-[10px] text-white truncate">{freighter.publicKey}</span>
                  </div>
                ) : (
                  <button onClick={freighter.connect} disabled={freighter.connecting}
                    className="w-full flex items-center justify-center gap-1.5 bg-ink-soft hover:bg-ink-soft/80 text-white border border-ink-soft font-bold py-2 rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50">
                    <Wallet className="w-3.5 h-3.5" />
                    {freighter.connecting ? 'Connecting…' : 'Connect Freighter Wallet'}
                  </button>
                )}
                {freighter.error && <p className="text-[10px] text-wine">{freighter.error}</p>}
              </div>

              {/* Stellar step progress */}
              {escrowLoading && currentStellarLabel && (
                <div className="bg-ink-soft rounded-xl p-3 flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-teal animate-spin flex-shrink-0" />
                  <p className="text-[11px] text-mist leading-snug">{currentStellarLabel}</p>
                </div>
              )}

              {/* Tx hash on success */}
              {txHash && (
                <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-[10px] text-teal hover:text-teal-hover font-sans break-all">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  {txHash.substring(0, 16)}…{txHash.substring(txHash.length - 8)} ↗
                </a>
              )}

              {/* CTA */}
              {escrowSuccess ? (
                <div className="bg-teal rounded-xl p-4 flex items-center gap-3">
                  <Check className="w-6 h-6 text-white flex-shrink-0" />
                  <div>
                    <p className="text-sm font-black text-white">Escrow Funded on Stellar!</p>
                    <p className="text-[10px] text-white/80">Redirecting to shipment record…</p>
                  </div>
                </div>
              ) : (
                <button onClick={handleFundEscrow} disabled={escrowLoading}
                  className="w-full bg-teal hover:bg-steel text-ink font-black py-3 rounded-xl text-sm uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  {escrowLoading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                    : <><Ship className="w-4 h-4" /> Fund Escrow via Stellar</>}
                </button>
              )}

              <p className="text-[10px] text-amber text-center leading-relaxed">
                {assetCode === 'PPHP'
                  ? <>You will be prompted to sign <strong className="text-amber-light">up to 3 transactions</strong> in Freighter. Your PPHP balance covers the peso cost; the contract locks the USDC equivalent.</>
                  : <>You will be prompted to sign <strong className="text-amber-light">up to 3 transactions</strong> in Freighter: create vault, assign team, and deposit USDC.</>
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
