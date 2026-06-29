'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
import { 
  Ship, 
  Coins, 
  CheckSquare, 
  TrendingUp, 
  Activity, 
  MapPin, 
  Clock, 
  ChevronRight, 
  Search, 
  Upload, 
  AlertCircle,
  Anchor,
  ClipboardList,
  CheckCircle2,
  CircleDot,
  PackageCheck,
  Truck,
  FileCheck,
  Shield,
  Warehouse,
  Lock,
  X,
  History,
  Maximize2,
  PenLine
} from 'lucide-react';
import { MilestoneType, JobRole, Shipment, MilestoneEvent, ROLE_MILESTONES } from '@/types';

const MILESTONE_BY_JOB = ROLE_MILESTONES;

// Human-readable labels matching the create-shipment priority milestone checklist.
const MILESTONE_LABELS: Partial<Record<MilestoneType, string>> = {
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

export default function DashboardHome() {
  const { currentUser } = useUserSession();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [milestones, setMilestones] = useState<MilestoneEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Logistics quick log state
  const [selectedShipmentLogId, setSelectedShipmentLogId] = useState('');
  const [logMilestoneType, setLogMilestoneType] = useState<MilestoneType>('BOOKING_CONFIRMED');
  const [logMessage, setLogMessage] = useState('');
  const [logEvidence, setLogEvidence] = useState(''); // File path representation
  const [logStatusError, setLogStatusError] = useState('');
  const [logStatusSuccess, setLogStatusSuccess] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Recent logs drawer
  const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);

  // Port Activity drawer (Trade Party) — mirrors Logistics' Recent Logs drawer
  const [portActivityDrawerOpen, setPortActivityDrawerOpen] = useState(false);

  // Description modal (Step 3 expanded input)
  const [descriptionModalOpen, setDescriptionModalOpen] = useState(false);

  // AI freight cost helper state
  const [aiOriginCountry, setAiOriginCountry] = useState('');
  const [aiDestinationPort, setAiDestinationPort] = useState('');
  const [aiCargoWeight, setAiCargoWeight] = useState('5000');
  const [aiCargoType, setAiCargoType] = useState('Electronics');
  const [aiResult, setAiResult] = useState<{estimatedUSD: number, confidence: string, breakdown: string} | null>(null);
  const [estimating, setEstimating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch shipments
      const shipRes = await authFetch('/api/shipments');
      const shipResult = await shipRes.json();
      if (shipResult.success) {
        setShipments(shipResult.data);
      }

      // Fetch recent milestones feed from real API
      const msRes = await authFetch('/api/milestones/feed');
      const msResult = await msRes.json();
      if (msResult.success) {
        setMilestones(msResult.data);
      } else {
        setMilestones([]);
      }
    } catch (err) {
      console.warn('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  // Set first valid milestone type when user logs in and chooses logistics
  useEffect(() => {
    const list = MILESTONE_BY_JOB[currentUser.jobRole];
    if (list && list.length > 0) {
      setLogMilestoneType(list[0]);
    }
  }, [currentUser]);

  const handleAIEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    // HARDCODED FIX: use values from the selected shipment or user-entered fields
    const selectedShip = shipments.find(s => s.id === selectedShipmentLogId);
    const origin = aiOriginCountry || selectedShip?.originCountry || 'Philippines';
    const destination = aiDestinationPort || selectedShip?.destinationPort || 'Port of Manila';
    try {
      setEstimating(true);
      const res = await fetch('/api/gemini/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originCountry: origin,
          destinationPort: destination,
          cargoWeightKg: aiCargoWeight,
          cargoType: aiCargoType
        })
      });
      const resJson = await res.json();
      if (resJson.success) {
        setAiResult(resJson.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEstimating(false);
    }
  };

  const handleQuickLogMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogStatusError('');  
    setLogStatusSuccess('');

    if (!selectedShipmentLogId) {
      setLogStatusError('Please select an assigned cargo shipment first.');
      return;
    }

    if (!logEvidence) {
      setLogStatusError('Proof Upload is strictly REQUIRED. You must attach photo/document proof before logging handoffs.');
      return;
    }

    try {
      setIsLogging(true);
      const res = await authFetch(`/api/shipments/${selectedShipmentLogId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LOG_MILESTONE',
          loggedById: currentUser.id,
          type: logMilestoneType,
          description: logMessage,
          evidenceUrl: logEvidence
        })
      });

      const json = await res.json();
      if (json.success) {
        setLogStatusSuccess('Milestone logged successfully and Stellar escrow status updated!');
        setLogMessage('');
        setLogEvidence('');
        fetchData(); // Reload stats
      } else {
        setLogStatusError(json.error || 'Submit failed.');
      }
    } catch {
      setLogStatusError('Failed to communicate with trade ledger.');
    } finally {
      setIsLogging(false);
    }
  };

  // Filter shipments based on search
  const filteredShipments = shipments.filter(s => 
    s.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      {/* Dynamic Welcome Heading */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-[28px] font-display font-medium text-ink tracking-tight leading-tight">
            Kamusta, {currentUser.fullName.split(' ')[0]}.
          </h1>
          <p className="text-[11px] text-ink-faint mt-1.5 flex items-center gap-3 font-medium tracking-wide">
            <span>ROLE: <span className="text-ink font-bold">{currentUser.jobRole.replace(/_/g, ' ')}</span></span>
            <span className="text-mist-dark">|</span>
            <span>SYSTEM STATUS: <span className="text-teal font-bold">SECURE</span></span>
          </p>
        </div>
        {/* Recent Logs button — Logistics Chain only */}
        {currentUser.userType === 'LOGISTICS_CHAIN' && (
          <button
            onClick={() => setLogsDrawerOpen(true)}
            className="flex items-center gap-2 bg-white border border-[color:var(--color-mist-dark)] hover:border-[color:var(--color-teal)] hover:text-[color:var(--color-teal)] text-[color:var(--color-ink-faint)] text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm flex-shrink-0"
          >
            <History className="w-3.5 h-3.5" />
            Recent Logs
            {milestones.length > 0 && (
              <span className="bg-[color:var(--color-teal)] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                {milestones.length}
              </span>
            )}
          </button>
        )}

        {/* Port Activity button — Trade Party only */}
        {currentUser.userType === 'TRADE_PARTY' && (
          <button
            onClick={() => setPortActivityDrawerOpen(true)}
            className="flex items-center gap-2 bg-white border border-[color:var(--color-mist-dark)] hover:border-[color:var(--color-teal)] hover:text-[color:var(--color-teal)] text-[color:var(--color-ink-faint)] text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm flex-shrink-0"
          >
            <Activity className="w-3.5 h-3.5" />
            Port Activity
            {milestones.length > 0 && (
              <span className="bg-[color:var(--color-teal)] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                {milestones.length}
              </span>
            )}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-mist">
          <div className="w-10 h-10 border-4 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-ink-faint font-sans tracking-wide">FETCHING SECURED TRADEPORTS CORRESPONDENCE...</p>
        </div>
      ) : (
        <>
          {/* USER SPECIFIC PORTAL: TRADE PARTY (IMPORTER / EXPORTER) */}
          {currentUser.userType === 'TRADE_PARTY' ? (
            <div className="space-y-5">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1 — Active Cargoes */}
                <div className="bg-white border border-mist p-5 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] text-ink-faint uppercase font-medium tracking-widest mb-2">Active Cargoes</span>
                    <strong className="text-[28px] text-ink font-display font-medium leading-none">
                      {String(shipments.filter(s => s.status !== 'DELIVERED' && s.status !== 'CANCELLED').length).padStart(2, '0')}
                    </strong>
                  </div>
                  <div className="w-10 h-10 bg-mist-light rounded-lg flex items-center justify-center text-ink-faint">
                    <Ship className="w-5 h-5" />
                  </div>
                </div>

                {/* Card 2 — Escrow Holdings (DARK) — HARDCODED FIX: computed from live shipments */}
                {(() => {
                  const totalEscrow = shipments
                    .filter(s => s.escrowStatus === 'FUNDED')
                    .reduce((acc, s) => acc + (s.escrowAmountUSD ?? s.totalValueUSD ?? 0), 0);
                  const phpEquiv = (totalEscrow * 58.7).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  return (
                    <div className="bg-ink border border-ink-soft p-5 rounded-xl shadow-sm col-span-1">
                      <span className="block text-[10px] text-white/40 uppercase font-medium tracking-widest mb-2">Escrow Holdings</span>
                      <strong className="text-[28px] text-white font-display font-medium leading-none">
                        {totalEscrow.toLocaleString()} <span className="text-sm font-semibold text-white/60">USDC</span>
                      </strong>
                      <span className="block text-[11px] text-white/40 mt-1.5 font-sans">₱{phpEquiv} EQV</span>
                    </div>
                  );
                })()}

                {/* Card 3 — Completed (MO) */}
                <div className="bg-white border border-mist p-5 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] text-ink-faint uppercase font-medium tracking-widest mb-2">Completed (MO)</span>
                    <strong className="text-[28px] text-ink font-display font-medium leading-none">
                      {String(shipments.filter(s => s.status === 'DELIVERED').length).padStart(2, '0')}
                    </strong>
                  </div>
                  <div className="w-10 h-10 bg-mist-light rounded-lg flex items-center justify-center text-ink-faint">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                </div>

                {/* Card 4 — Smart Locks — HARDCODED FIX: derived from live shipment escrow data */}
                {(() => {
                  const funded = shipments.filter(s => s.escrowStatus === 'FUNDED').length;
                  const total = shipments.length;
                  return (
                    <div className="bg-white border border-mist p-5 rounded-xl shadow-sm flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] text-ink-faint uppercase font-medium tracking-widest mb-2">Smart Locks</span>
                        <strong className="text-[28px] text-ink font-display font-medium leading-none">{funded}/{total}</strong>
                      </div>
                      <div className="w-10 h-10 bg-mist-light rounded-lg flex items-center justify-center text-ink-faint">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Active Shipments — full width since Port Activity moved to header button + drawer */}
              <div className="bg-white border border-mist rounded-xl shadow-sm overflow-hidden">
                    {/* Table header */}
                    <div className="px-5 py-4 flex items-center justify-between border-b border-mist-light">
                      <h2 className="text-sm font-display font-medium text-ink">Active Shipments</h2>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-mist-dark absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search reference..."
                          className="bg-mist-light border border-mist pl-8 pr-3 py-1.5 rounded-lg text-[11px] outline-none focus:border-mist-dark w-44"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>

                    {filteredShipments.length === 0 ? (
                      <div className="text-center py-14 text-ink-faint text-xs">
                        No cargoes found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-mist-light">
                              <th className="px-5 py-3 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">Reference</th>
                              <th className="px-5 py-3 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">Origin &amp; Route</th>
                              <th className="px-5 py-3 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">Status</th>
                              <th className="px-5 py-3 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">Escrow</th>
                              <th className="px-5 py-3 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-mist-light">
                            {filteredShipments.map((ship) => (
                              <tr key={ship.id} className="hover:bg-mist-light/50 transition-colors">
                                <td className="px-5 py-4">
                                  <Link href={`/shipments/${ship.id}`} className="text-[12px] font-bold text-ink hover:text-steel block">
                                    {ship.referenceCode}
                                  </Link>
                                  <span className="text-[10px] text-ink-faint uppercase tracking-wide font-medium">{ship.description.slice(0, 25)}</span>
                                </td>
                                <td className="px-5 py-4">
                                  <span className="text-[12px] font-semibold text-ink-faint block">{ship.originCountry}</span>
                                  <span className="text-[10px] text-ink-faint">TO {ship.destinationPort?.toUpperCase()}</span>
                                </td>
                                <td className="px-5 py-4">
                                  {ship.status === 'DELIVERED' ? (
                                    <span className="inline-flex items-center gap-1.5 bg-teal text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white/70 inline-block" />
                                      DELIVERED
                                    </span>
                                  ) : ship.status === 'IN_TRANSIT' ? (
                                    <span className="inline-flex items-center gap-1.5 bg-ink text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white/70 inline-block" />
                                      IN TRANSIT
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 bg-amber-light text-amber text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      {ship.status?.replace(/_/g, ' ')}
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-4">
                                  <span className="text-[12px] font-bold text-ink block">${ship.totalValueUSD?.toLocaleString()}</span>
                                  <span className={`text-[10px] font-semibold ${
                                    ship.escrowStatus === 'FUNDED' ? 'text-teal' : 'text-ink-faint'
                                  }`}>{ship.escrowStatus}</span>
                                </td>
                                <td className="px-5 py-4">
                                  <Link
                                    href={`/shipments/${ship.id}`}
                                    className="inline-block border border-mist hover:bg-mist-light text-ink text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    {ship.status === 'DELIVERED' ? 'DETAILS' : 'MANAGE'}
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
              </div>

              {/* PORT ACTIVITY SLIDE-OVER DRAWER — mirrors Logistics' Recent Logs drawer */}
              {portActivityDrawerOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[2px]"
                    onClick={() => setPortActivityDrawerOpen(false)}
                  />
                  {/* Panel */}
                  <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col">
                    {/* Drawer header */}
                    <div className="bg-[color:var(--color-ink)] px-5 py-4 flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-[color:var(--color-teal)]" />
                        </div>
                        <div>
                          <p className="text-white font-black text-sm">Port Activity</p>
                          <p className="text-white/40 text-[10px]">{milestones.length} milestone{milestones.length !== 1 ? 's' : ''} on record</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPortActivityDrawerOpen(false)}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>

                    {/* Drawer body — scrollable */}
                    <div className="flex-1 overflow-y-auto">
                      {milestones.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-16 px-6 text-center">
                          <CircleDot className="w-10 h-10 text-[color:var(--color-mist-dark)] mb-3" />
                          <p className="text-xs text-[color:var(--color-ink-faint)] font-mono font-bold">NO RECENT PORT ACTIVITY</p>
                          <p className="text-[11px] text-[color:var(--color-ink-faint)] opacity-60 mt-1 leading-relaxed">Milestones logged by your logistics partners will appear here.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[color:var(--color-mist)]">
                          {milestones.map((me, idx) => (
                            <div key={idx} className="px-5 py-4 flex gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[color:var(--color-teal-light)] flex items-center justify-center flex-shrink-0 mt-0.5">
                                <PackageCheck className="w-4 h-4 text-[color:var(--color-teal)]" />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <p className="text-[11px] font-black text-[color:var(--color-ink)] uppercase tracking-tight leading-tight">
                                  {me.type.replace(/_/g, ' ')}
                                </p>
                                <p className="text-[11px] text-[color:var(--color-ink-faint)] leading-relaxed">{me.description || '—'}</p>
                                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                  <span className="text-[9px] font-mono text-[color:var(--color-ink-faint)] opacity-60">
                                    {new Date(me.occurredAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {me.verified && (
                                    <span className="text-[9px] bg-[color:var(--color-teal-light)] text-[color:var(--color-teal)] font-black px-1.5 py-0.5 rounded">VERIFIED</span>
                                  )}
                                  {me.shipmentId && (
                                    <span className="text-[9px] font-mono text-[color:var(--color-steel)] opacity-80">
                                      REF: {me.shipmentId.slice(-10).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               LOGISTICS CHAIN PORTAL — milestone logging as the hero
            ───────────────────────────────────────────────────────────── */
            <div className="space-y-6">

              {/* ROLE SCOPE BANNER */}
              <LogisticsScopeBanner jobRole={currentUser.jobRole} shipments={shipments} milestones={milestones} />

              {/* HERO: MILESTONE LOGGER — full width, 4-step wizard feel */}
              <div className="bg-white border border-[color:var(--color-mist-dark)] rounded-3xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="bg-[color:var(--color-ink)] px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-[color:var(--color-teal)]" />
                    </div>
                    <div>
                      <h2 className="text-white font-black text-base tracking-tight">Log a Milestone</h2>
                      <p className="text-white/50 text-[11px] mt-0.5">
                        Every log is committed to the Stellar trade ledger and cannot be undone.
                      </p>
                    </div>
                  </div>
                  {/* live ready indicator */}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    selectedShipmentLogId
                      ? 'bg-[color:var(--color-teal-light)] border-[color:var(--color-teal)] text-[color:var(--color-teal)]'
                      : 'bg-white/5 border-white/10 text-white/40'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedShipmentLogId ? 'bg-[color:var(--color-teal)] animate-pulse' : 'bg-white/20'
                    }`} />
                    {selectedShipmentLogId ? 'Ready to Log' : 'Awaiting Cargo Select'}
                  </div>
                </div>

                {/* Step form */}
                <form onSubmit={handleQuickLogMilestone} className="p-6 space-y-0">

                  {/* Status alerts */}
                  {logStatusError && (
                    <div className="mb-5 bg-[color:var(--color-wine-light)] border border-[color:var(--color-wine)] text-[color:var(--color-wine)] text-xs p-3.5 rounded-xl leading-normal flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{logStatusError}</span>
                    </div>
                  )}
                  {logStatusSuccess && (
                    <div className="mb-5 bg-[color:var(--color-teal-light)] border border-[color:var(--color-teal)] text-[color:var(--color-teal)] text-xs p-3.5 rounded-xl font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{logStatusSuccess}</span>
                    </div>
                  )}

                  {/* 4-step grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0 md:gap-px bg-[color:var(--color-mist)] rounded-2xl overflow-hidden border border-[color:var(--color-mist-dark)]">

                    {/* Step 1 — Pick Cargo */}
                    <MilestoneStep
                      step={1}
                      label="Cargo Reference"
                      hint="Which shipment are you handling?"
                      active={true}
                      done={!!selectedShipmentLogId}
                    >
                      <select
                        className="w-full bg-white border border-mist rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-amber font-sans"
                        value={selectedShipmentLogId}
                        onChange={(e) => {
                          setSelectedShipmentLogId(e.target.value);
                          setLogStatusError('');
                          setLogStatusSuccess('');
                        }}
                      >
                        <option value="">— Select assigned cargo —</option>
                        {shipments.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.referenceCode}
                          </option>
                        ))}
                      </select>
                      {selectedShipmentLogId && (() => {
                        const s = shipments.find(x => x.id === selectedShipmentLogId);
                        return s ? (
                          <div className="mt-2 text-[10px] text-ink-faint leading-relaxed">
                            <span className="font-medium text-ink-faint">{s.description.substring(0, 40)}{s.description.length > 40 ? '…' : ''}</span>
                            <br />
                            <span className="flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-amber" />
                              {s.originCountry} → {s.destinationPort}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </MilestoneStep>

                    {/* Step 2 — Pick Milestone */}
                    <MilestoneStep
                      step={2}
                      label="Milestone Type"
                      hint="Restricted to your job role."
                      active={!!selectedShipmentLogId}
                      done={!!logMilestoneType && !!selectedShipmentLogId}
                    >
                      <select
                        className="w-full bg-white border border-mist rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-amber disabled:opacity-40 disabled:cursor-not-allowed"
                        value={logMilestoneType}
                        disabled={!selectedShipmentLogId}
                        onChange={(e) => setLogMilestoneType(e.target.value as MilestoneType)}
                      >
                        {(MILESTONE_BY_JOB[currentUser.jobRole] ?? []).map((mType) => (
                          <option key={mType} value={mType}>
                            {MILESTONE_LABELS[mType] ?? mType.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-[10px] text-ink-faint">
                        {(MILESTONE_BY_JOB[currentUser.jobRole] ?? []).length} milestones for your role.
                      </p>
                    </MilestoneStep>

                    {/* Step 3 — Description */}
                    <MilestoneStep
                      step={3}
                      label="What Happened"
                      hint="Describe this handoff event."
                      active={!!selectedShipmentLogId}
                      done={logMessage.trim().length > 5}
                    >
                      {/* Collapsed trigger — shows preview or prompt to open modal */}
                      <button
                        type="button"
                        disabled={!selectedShipmentLogId}
                        onClick={() => setDescriptionModalOpen(true)}
                        className={`w-full text-left border rounded-lg px-3 py-2.5 transition-all group ${
                          !selectedShipmentLogId
                            ? 'opacity-40 cursor-not-allowed border-[color:var(--color-mist-dark)] bg-[color:var(--color-mist-light)]'
                            : logMessage.trim().length > 5
                            ? 'border-[color:var(--color-teal)] bg-[color:var(--color-teal-light)] hover:border-[color:var(--color-teal-hover,var(--color-teal))]'
                            : 'border-[color:var(--color-mist-dark)] bg-white hover:border-[color:var(--color-teal)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs leading-relaxed line-clamp-2 flex-1 min-w-0 ${
                            logMessage.trim().length > 5
                              ? 'text-[color:var(--color-ink)]'
                              : 'text-[color:var(--color-ink-faint)]'
                          }`}>
                            {logMessage.trim().length > 5
                              ? logMessage
                              : 'Click to add a description…'}
                          </span>
                          <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                            logMessage.trim().length > 5
                              ? 'bg-[color:var(--color-teal)] text-white'
                              : 'bg-[color:var(--color-mist)] text-[color:var(--color-ink-faint)] group-hover:bg-[color:var(--color-teal)] group-hover:text-white'
                          }`}>
                            {logMessage.trim().length > 5
                              ? <PenLine className="w-3 h-3" />
                              : <Maximize2 className="w-3 h-3" />}
                          </div>
                        </div>
                        {logMessage.trim().length > 5 && (
                          <p className="text-[9px] text-[color:var(--color-teal)] mt-1.5 font-bold uppercase tracking-widest">
                            {logMessage.trim().length} chars · tap to edit
                          </p>
                        )}
                      </button>
                    </MilestoneStep>

                    {/* Step 4 — Evidence */}
                    <MilestoneStep
                      step={4}
                      label="Proof of Event"
                      hint="Photo or document. Required."
                      active={!!selectedShipmentLogId}
                      done={!!logEvidence}
                      required
                    >
                      {logEvidence ? (
                        <div className="flex items-center gap-2 bg-[color:var(--color-teal-light)] border border-[color:var(--color-teal)] rounded-lg px-3 py-2">
                          <CheckCircle2 className="w-4 h-4 text-[color:var(--color-teal)] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-[color:var(--color-teal)] truncate">{logEvidence}</p>
                            <button
                              type="button"
                              onClick={() => setLogEvidence('')}
                              className="text-[9px] text-[color:var(--color-wine)] hover:underline mt-0.5"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* CRITICAL FIX: real file picker — no longer generates a fake filename */
                        <label
                          className={`block w-full border-2 border-dashed rounded-lg px-3 py-5 text-center transition-all group cursor-pointer border-[color:var(--color-mist-dark)] hover:border-[color:var(--color-teal)] ${!selectedShipmentLogId ? 'opacity-40 pointer-events-none' : ''}`}
                        >
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="sr-only"
                            disabled={!selectedShipmentLogId}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setLogEvidence(file.name);
                              }
                            }}
                          />
                          <Upload className="w-5 h-5 text-[color:var(--color-mist-dark)] group-hover:text-[color:var(--color-teal)] mx-auto mb-2 transition-colors" />
                          <p className="text-[10px] font-bold text-[color:var(--color-ink-faint)] group-hover:text-[color:var(--color-teal)] transition-colors">Attach proof photo or PDF</p>
                          <p className="text-[9px] text-[color:var(--color-ink-faint)] opacity-50 mt-0.5">JPG, PNG, PDF — max 10 MB</p>
                        </label>
                      )}
                    </MilestoneStep>
                  </div>

                  {/* Submit row */}
                  <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="submit"
                      disabled={isLogging || !selectedShipmentLogId}
                      className="bg-[color:var(--color-ink)] hover:bg-[color:var(--color-ink-soft)] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black px-8 py-3 rounded-xl text-sm tracking-wide transition-all cursor-pointer shadow-sm flex items-center gap-2"
                    >
                      {isLogging ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Committing to Ledger…
                        </>
                      ) : (
                        <>
                          <Anchor className="w-4 h-4" />
                          Submit Milestone Log
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-ink-faint leading-relaxed">
                      This action is <strong className="text-ink-faint">irreversible</strong>. Ensure all details are correct before submitting.
                      Stellar transaction fees apply.
                    </p>
                  </div>

                </form>
              </div>

              {/* LOWER SECTION — full-width assigned shipments + slide-over logs drawer */}
              <div className="space-y-3">

                {/* Section header with search + open-drawer button */}
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-[color:var(--color-ink)] tracking-tight flex items-center gap-2">
                    <Ship className="w-4 h-4 text-[color:var(--color-teal)]" />
                    Assigned Shipments
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-ink-faint absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Search ref…"
                        className="bg-white border border-[color:var(--color-mist-dark)] pl-7 pr-3 py-1.5 rounded-lg text-xs outline-none focus:border-[color:var(--color-teal)] w-36"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Shipments list — fixed height, scrollable */}
                <div className="bg-white border border-[color:var(--color-mist-dark)] rounded-2xl overflow-hidden shadow-sm">
                  <div className="divide-y divide-[color:var(--color-mist)] max-h-[420px] overflow-y-auto">
                    {filteredShipments.length === 0 ? (
                      <div className="py-12 text-center text-xs text-[color:var(--color-ink-faint)] font-mono">NO ASSIGNED SHIPMENTS FOUND</div>
                    ) : filteredShipments.map((ship) => (
                      <div
                        key={ship.id}
                        className={`p-4 flex items-center gap-4 hover:bg-[color:var(--color-mist-light)] transition-colors cursor-pointer ${
                          selectedShipmentLogId === ship.id ? 'bg-[color:var(--color-teal-light)] border-l-2 border-l-[color:var(--color-teal)]' : ''
                        }`}
                        onClick={() => {
                          setSelectedShipmentLogId(ship.id);
                          setLogStatusError('');
                          setLogStatusSuccess('');
                        }}
                      >
                        {/* Status dot */}
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${
                          ship.status === 'DELIVERED' ? 'bg-teal'
                          : ship.status === 'IN_TRANSIT' ? 'bg-[color:var(--color-teal)] animate-pulse'
                          : ship.status === 'CUSTOMS_CLEARANCE' ? 'bg-amber'
                          : 'bg-[color:var(--color-mist-dark)]'
                        }`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold font-sans text-xs text-[color:var(--color-ink)]">{ship.referenceCode}</span>
                            <span className="bg-[color:var(--color-mist-light)] text-[color:var(--color-ink-faint)] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">{ship.shipmentScope}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              ship.status === 'DELIVERED' ? 'bg-teal-light text-teal'
                              : ship.status === 'IN_TRANSIT' ? 'bg-[color:var(--color-teal-light)] text-[color:var(--color-teal)]'
                              : 'bg-amber-light text-amber'
                            }`}>
                              {ship.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-[10px] text-[color:var(--color-ink-faint)] truncate mt-0.5">{ship.description}</p>
                          <div className="flex items-center gap-3 text-[10px] text-[color:var(--color-ink-faint)] mt-1">
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />{ship.originCountry} → {ship.destinationPort}
                            </span>
                            {ship.estimatedArrival && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3 text-[color:var(--color-wine)]" />
                                ETA {new Date(ship.estimatedArrival).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {selectedShipmentLogId === ship.id && (
                            <span className="text-[9px] bg-[color:var(--color-teal)] text-white px-2 py-0.5 rounded-full font-bold">SELECTED</span>
                          )}
                          <Link
                            href={`/shipments/${ship.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] bg-[color:var(--color-mist-light)] hover:bg-[color:var(--color-mist)] text-[color:var(--color-ink)] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                          >
                            Timeline <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* DESCRIPTION EXPANDED MODAL */}
              {descriptionModalOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
                    onClick={() => setDescriptionModalOpen(false)}
                  />
                  {/* Modal */}
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto flex flex-col overflow-hidden">
                      {/* Modal header */}
                      <div className="bg-[color:var(--color-ink)] px-5 py-4 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <PenLine className="w-4 h-4 text-[color:var(--color-teal)]" />
                          </div>
                          <div>
                            <p className="text-white font-black text-sm">What Happened</p>
                            <p className="text-white/40 text-[10px]">Describe the handoff event in detail</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setDescriptionModalOpen(false)}
                          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      {/* Textarea */}
                      <div className="p-5 flex flex-col gap-3">
                        <textarea
                          autoFocus
                          rows={10}
                          placeholder="e.g. Container MTG-2241 gated through Pier 14 at 14:30 PHT. Seal no. PH-994412 intact and photographed. Driver ID verified. Handoff signed by port stevedore on record."
                          className="w-full border border-[color:var(--color-mist-dark)] focus:border-[color:var(--color-teal)] rounded-xl p-4 text-sm text-[color:var(--color-ink)] outline-none resize-none leading-relaxed placeholder:text-[color:var(--color-ink-faint)] placeholder:opacity-50"
                          value={logMessage}
                          onChange={(e) => setLogMessage(e.target.value)}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[color:var(--color-ink-faint)] font-mono">
                            {logMessage.trim().length} characters
                            {logMessage.trim().length > 0 && logMessage.trim().length <= 5 && (
                              <span className="text-[color:var(--color-wine)] ml-1">· add more detail</span>
                            )}
                            {logMessage.trim().length > 5 && (
                              <span className="text-[color:var(--color-teal)] ml-1">· looks good</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDescriptionModalOpen(false)}
                            className="bg-[color:var(--color-ink)] hover:bg-[color:var(--color-ink-soft)] text-white text-xs font-black px-5 py-2 rounded-xl transition-colors"
                          >
                            Save Description
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* RECENT LOGS SLIDE-OVER DRAWER */}
              {logsDrawerOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[2px]"
                    onClick={() => setLogsDrawerOpen(false)}
                  />
                  {/* Panel */}
                  <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col">
                    {/* Drawer header */}
                    <div className="bg-[color:var(--color-ink)] px-5 py-4 flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-[color:var(--color-teal)]" />
                        </div>
                        <div>
                          <p className="text-white font-black text-sm">Recent Logs</p>
                          <p className="text-white/40 text-[10px]">{milestones.length} milestone{milestones.length !== 1 ? 's' : ''} on record</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setLogsDrawerOpen(false)}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>

                    {/* Drawer body — scrollable */}
                    <div className="flex-1 overflow-y-auto">
                      {milestones.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-16 px-6 text-center">
                          <CircleDot className="w-10 h-10 text-[color:var(--color-mist-dark)] mb-3" />
                          <p className="text-xs text-[color:var(--color-ink-faint)] font-mono font-bold">NO RECENT LOGS</p>
                          <p className="text-[11px] text-[color:var(--color-ink-faint)] opacity-60 mt-1 leading-relaxed">Submitted milestones will appear here after logging.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[color:var(--color-mist)]">
                          {milestones.map((me, idx) => (
                            <div key={idx} className="px-5 py-4 flex gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[color:var(--color-teal-light)] flex items-center justify-center flex-shrink-0 mt-0.5">
                                <PackageCheck className="w-4 h-4 text-[color:var(--color-teal)]" />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <p className="text-[11px] font-black text-[color:var(--color-ink)] uppercase tracking-tight leading-tight">
                                  {me.type.replace(/_/g, ' ')}
                                </p>
                                <p className="text-[11px] text-[color:var(--color-ink-faint)] leading-relaxed">{me.description || '—'}</p>
                                <div className="flex items-center gap-2 pt-0.5">
                                  <span className="text-[9px] font-mono text-[color:var(--color-ink-faint)] opacity-60">
                                    {new Date(me.occurredAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {me.verified && (
                                    <span className="text-[9px] bg-[color:var(--color-teal-light)] text-[color:var(--color-teal)] font-black px-1.5 py-0.5 rounded">VERIFIED</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Step card used inside the 4-column milestone wizard */
function MilestoneStep({
  step,
  label,
  hint,
  active,
  done,
  required,
  children,
}: {
  step: number;
  label: string;
  hint: string;
  active: boolean;
  done: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-white p-5 space-y-3 transition-opacity ${
      active ? 'opacity-100' : 'opacity-50'
    }`}>
      {/* Step header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${
            done
              ? 'bg-[color:var(--color-teal)] text-white'
              : 'bg-[color:var(--color-mist)] text-[color:var(--color-ink-faint)] border border-[color:var(--color-mist-dark)]'
          }`}>
            {done ? '✓' : step}
          </div>
          <div>
            <p className="text-[10px] font-black text-[color:var(--color-ink)] uppercase tracking-wider leading-none">{label}</p>
            <p className="text-[9px] text-[color:var(--color-ink-faint)] mt-0.5 leading-none">{hint}</p>
          </div>
        </div>
        {required && !done && (
          <span className="text-[8px] bg-[color:var(--color-wine)] text-white font-bold px-1 py-0.5 rounded flex-shrink-0 mt-0.5">REQ</span>
        )}
      </div>
      {/* Step content */}
      <div>{children}</div>
    </div>
  );
}

/** Role metadata for Logistics Chain portal */
const ROLE_META: Record<JobRole, {
  label: string;
  description: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  badgeBg: string;
  icon: React.ReactNode;
}> = {
  FREIGHT_FORWARDER: {
    label: 'Freight Forwarder',
    description: 'Vessel bookings, container movements, and B/L issuance.',
    accentBg: 'bg-[color:var(--color-teal-light)]',
    accentText: 'text-[color:var(--color-teal)]',
    accentBorder: 'border-[color:var(--color-teal)]',
    badgeBg: 'bg-[color:var(--color-teal)] text-white',
    icon: <Truck className="w-5 h-5" />,
  },
  CUSTOMS_BROKER: {
    label: 'Customs Broker',
    description: 'BOC filings, duty payments, and customs clearance.',
    accentBg: 'bg-[color:var(--color-steel-light)]',
    accentText: 'text-[color:var(--color-steel)]',
    accentBorder: 'border-[color:var(--color-steel)]',
    badgeBg: 'bg-[color:var(--color-steel)] text-white',
    icon: <FileCheck className="w-5 h-5" />,
  },
  WAREHOUSE_OPERATOR: {
    label: 'Warehouse Operator',
    description: 'Cargo inspection, storage, and last-mile handoffs.',
    accentBg: 'bg-[color:var(--color-mist-light)]',
    accentText: 'text-[color:var(--color-ink-soft)]',
    accentBorder: 'border-[color:var(--color-mist-dark)]',
    badgeBg: 'bg-[color:var(--color-ink-soft)] text-white',
    icon: <Warehouse className="w-5 h-5" />,
  },
  IMPORTER: {
    label: 'Importer',
    description: '',
    accentBg: 'bg-mist-light',
    accentText: 'text-ink-faint',
    accentBorder: 'border-mist',
    badgeBg: 'bg-ink-faint text-white',
    icon: <Shield className="w-5 h-5" />,
  },
  EXPORTER: {
    label: 'Exporter',
    description: '',
    accentBg: 'bg-mist-light',
    accentText: 'text-ink-faint',
    accentBorder: 'border-mist',
    badgeBg: 'bg-ink-faint text-white',
    icon: <Shield className="w-5 h-5" />,
  },
};

function LogisticsScopeBanner({
  jobRole,
  shipments,
  milestones,
}: {
  jobRole: JobRole;
  shipments: Shipment[];
  milestones: MilestoneEvent[];
}) {
  const meta = ROLE_META[jobRole];
  const roleMillestones = MILESTONE_BY_JOB[jobRole] ?? [];

  // Derive quick stats from live data
  const activeCount = shipments.filter(s => s.status !== 'DELIVERED' && s.status !== 'CANCELLED').length;
  const inTransitCount = shipments.filter(s => s.status === 'IN_TRANSIT').length;
  const loggedToday = milestones.filter(m => {
    const d = new Date(m.occurredAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  }).length;
  const verifiedCount = milestones.filter(m => m.verified).length;

  const stats = [
    { label: 'Active Shipments', value: String(activeCount).padStart(2, '0'), sub: `${inTransitCount} in transit` },
    { label: 'Logs Today', value: String(loggedToday).padStart(2, '0'), sub: 'milestones submitted' },
    { label: 'Verified Events', value: String(verifiedCount).padStart(2, '0'), sub: 'on the ledger' },
    { label: 'Role Scope', value: String(roleMillestones.length).padStart(2, '0'), sub: 'loggable milestones' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Role identity card — spans 1 col, dark ink bg */}
      <div className={`lg:col-span-1 rounded-2xl border-2 ${meta.accentBorder} ${meta.accentBg} p-5 flex flex-col justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.badgeBg} flex-shrink-0`}>
            {meta.icon}
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[color:var(--color-ink-faint)]">Active Role</p>
            <p className={`text-sm font-extrabold leading-snug ${meta.accentText}`}>{meta.label}</p>
          </div>
        </div>
        <p className="text-[11px] text-[color:var(--color-ink-faint)] leading-relaxed">{meta.description}</p>
        <div className="flex items-center gap-1.5">
          <Lock className={`w-3 h-3 ${meta.accentText} opacity-60`} />
          <span className={`text-[9px] font-black uppercase tracking-widest ${meta.accentText} opacity-70`}>
            {roleMillestones.length} milestones in scope
          </span>
        </div>
      </div>

      {/* Stat cards — 3 remaining cols */}
      {stats.slice(0, 3).map((stat) => (
        <div key={stat.label} className="bg-white border border-[color:var(--color-mist-dark)] rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--color-ink-faint)]">{stat.label}</span>
          <div>
            <strong className="text-[32px] font-black text-[color:var(--color-ink)] leading-none tracking-tight">{stat.value}</strong>
            <p className="text-[11px] text-[color:var(--color-ink-faint)] mt-1">{stat.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
