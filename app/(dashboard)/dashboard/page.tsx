'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
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
  Lock
} from 'lucide-react';
import { MilestoneType, JobRole, Shipment, MilestoneEvent } from '@/types';

// MILESTONE FILTER DICTIONARY FROM STARTER SPEC
const MILESTONE_BY_JOB: Record<JobRole, MilestoneType[]> = {
  IMPORTER: ['DELIVERED_AND_SIGNED_OFF'],
  EXPORTER: ['BILL_OF_LADING_ISSUED'],
  FREIGHT_FORWARDER: [
    'BOOKING_CONFIRMED',
    'DOCUMENTS_SUBMITTED_TO_CARRIER',
    'CARGO_READY_FOR_COLLECTION',
    'SPACE_ON_VESSEL_SECURED',
  ],
  CUSTOMS_BROKER: [
    'BOC_ENTRY_FILED',
    'DUTIES_AND_TAXES_PAID',
    'CUSTOMS_EXAMINATION_REQUESTED',
    'CUSTOMS_CLEARANCE_APPROVED',
    'CARGO_RELEASED_FOR_PICKUP',
  ],
  WAREHOUSE_OPERATOR: [
    'CARGO_RECEIVED_AT_WAREHOUSE',
    'CARGO_INSPECTED_AND_PACKED',
    'CARGO_STAGED_FOR_PICKUP',
    'CARGO_HANDED_OFF_TO_CARRIER',
    'INCOMING_CARGO_STORED',
  ],
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

  // AI freight cost helper state
  const [aiCargoWeight, setAiCargoWeight] = useState('5000');
  const [aiCargoType, setAiCargoType] = useState('Electronics');
  const [aiResult, setAiResult] = useState<{estimatedUSD: number, confidence: string, breakdown: string} | null>(null);
  const [estimating, setEstimating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch shipments
      const shipRes = await fetch('/api/shipments');
      const shipResult = await shipRes.json();
      if (shipResult.success) {
        setShipments(shipResult.data);
      }

      // Fetch recent milestones feed from real API
      const msRes = await fetch('/api/milestones/feed');
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
    try {
      setEstimating(true);
      const res = await fetch('/api/gemini/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originCountry: 'Japan',
          destinationPort: 'Port of Manila',
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
      const res = await fetch(`/api/shipments/${selectedShipmentLogId}`, {
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
          <h1 className="text-[28px] font-black text-[#111c30] tracking-tight leading-tight">
            Kamusta, {currentUser.fullName.split(' ')[0]}.
          </h1>
          <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-3 font-medium tracking-wide">
            <span>ROLE: <span className="text-[#111c30] font-bold">{currentUser.jobRole.replace(/_/g, ' ')}</span></span>
            <span className="text-gray-300">|</span>
            <span>SYSTEM STATUS: <span className="text-green-500 font-bold">SECURE</span></span>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-sand-200">
          <div className="w-10 h-10 border-4 border-maritime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-gray-400 font-mono tracking-wide">FETCHING SECURED TRADEPORTS CORRESPONDENCE...</p>
        </div>
      ) : (
        <>
          {/* USER SPECIFIC PORTAL: TRADE PARTY (IMPORTER / EXPORTER) */}
          {currentUser.userType === 'TRADE_PARTY' ? (
            <div className="space-y-5">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1 — Active Cargoes */}
                <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] text-gray-400 uppercase font-medium tracking-widest mb-2">Active Cargoes</span>
                    <strong className="text-[28px] text-[#111c30] font-black leading-none">
                      {String(shipments.filter(s => s.status !== 'DELIVERED' && s.status !== 'CANCELLED').length).padStart(2, '0')}
                    </strong>
                  </div>
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                    <Ship className="w-5 h-5" />
                  </div>
                </div>

                {/* Card 2 — Escrow Holdings (DARK) */}
                <div className="bg-[#111c30] border border-[#1e3a5f] p-5 rounded-xl shadow-sm col-span-1">
                  <span className="block text-[10px] text-white/40 uppercase font-medium tracking-widest mb-2">Escrow Holdings</span>
                  <strong className="text-[28px] text-white font-black leading-none">
                    45,000 <span className="text-sm font-semibold text-white/60">USDC</span>
                  </strong>
                  <span className="block text-[11px] text-white/40 mt-1.5 font-mono">₱2,641,500.00 EQV</span>
                </div>

                {/* Card 3 — Completed (MO) */}
                <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] text-gray-400 uppercase font-medium tracking-widest mb-2">Completed (MO)</span>
                    <strong className="text-[28px] text-[#111c30] font-black leading-none">
                      {String(shipments.filter(s => s.status === 'DELIVERED').length).padStart(2, '0')}
                    </strong>
                  </div>
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                </div>

                {/* Card 4 — Smart Locks */}
                <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] text-gray-400 uppercase font-medium tracking-widest mb-2">Smart Locks</span>
                    <strong className="text-[28px] text-[#111c30] font-black leading-none">2/2</strong>
                  </div>
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Grid: Active Shipments (left) + Port Activity (right) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Shipments Table */}
                <div className="lg:col-span-2">
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    {/* Table header */}
                    <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                      <h2 className="text-sm font-bold text-[#111c30]">Active Shipments</h2>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search reference..."
                          className="bg-gray-50 border border-gray-200 pl-8 pr-3 py-1.5 rounded-lg text-[11px] outline-none focus:border-gray-400 w-44"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>

                    {filteredShipments.length === 0 ? (
                      <div className="text-center py-14 text-gray-400 text-xs">
                        No cargoes found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Reference</th>
                              <th className="px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Origin &amp; Route</th>
                              <th className="px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Status</th>
                              <th className="px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Escrow</th>
                              <th className="px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {filteredShipments.map((ship) => (
                              <tr key={ship.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-5 py-4">
                                  <Link href={`/shipments/${ship.id}`} className="text-[12px] font-bold text-[#111c30] hover:text-blue-600 block">
                                    {ship.referenceCode}
                                  </Link>
                                  <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{ship.description.slice(0, 25)}</span>
                                </td>
                                <td className="px-5 py-4">
                                  <span className="text-[12px] font-semibold text-gray-700 block">{ship.originCountry}</span>
                                  <span className="text-[10px] text-gray-400">TO {ship.destinationPort?.toUpperCase()}</span>
                                </td>
                                <td className="px-5 py-4">
                                  {ship.status === 'DELIVERED' ? (
                                    <span className="inline-flex items-center gap-1.5 bg-green-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white/70 inline-block" />
                                      DELIVERED
                                    </span>
                                  ) : ship.status === 'IN_TRANSIT' ? (
                                    <span className="inline-flex items-center gap-1.5 bg-[#111c30] text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white/70 inline-block" />
                                      IN TRANSIT
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      {ship.status?.replace(/_/g, ' ')}
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-4">
                                  <span className="text-[12px] font-bold text-[#111c30] block">${ship.totalValueUSD?.toLocaleString()}</span>
                                  <span className={`text-[10px] font-semibold ${
                                    ship.escrowStatus === 'FUNDED' ? 'text-green-500' : 'text-gray-400'
                                  }`}>{ship.escrowStatus}</span>
                                </td>
                                <td className="px-5 py-4">
                                  <Link
                                    href={`/shipments/${ship.id}`}
                                    className="inline-block border border-gray-200 hover:bg-gray-50 text-[#111c30] text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
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
                </div>

                {/* Right column: Port Activity + Support */}
                <div className="space-y-4">
                  {/* Port Activity — driven by real milestones from Supabase */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                      <h3 className="text-sm font-bold text-[#111c30]">Port Activity</h3>
                      <button className="text-[11px] font-semibold text-blue-500 hover:text-blue-700">VIEW ALL</button>
                    </div>
                    <div className="px-5 py-4 space-y-0 relative">
                      {milestones.length === 0 ? (
                        <div className="py-8 text-center">
                          <CircleDot className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                          <p className="text-[11px] text-gray-400 font-mono">NO RECENT PORT ACTIVITY</p>
                        </div>
                      ) : (
                        <>
                          {/* Timeline line */}
                          <div className="absolute left-[26px] top-6 bottom-6 w-px bg-gray-100" />
                          {milestones.slice(0, 3).map((me, idx) => (
                            <div key={me.id} className={`flex gap-4 ${idx < milestones.slice(0, 3).length - 1 ? 'pb-5' : ''}`}>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 z-10 ${
                                idx === 0 ? 'bg-[#111c30]' : idx === 1 ? 'bg-gray-300' : 'bg-gray-100 border border-gray-200'
                              }`}>
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              </div>
                              <div className={idx === 2 ? 'opacity-40' : ''}>
                                <p className="text-[11px] font-bold text-[#111c30] uppercase tracking-wide">
                                  {me.type.replace(/_/g, ' ')}
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{me.description}</p>
                                {me.shipmentId && (
                                  <p className="text-[10px] text-blue-500 mt-1 font-medium">
                                    REF: {me.shipmentId.slice(-10).toUpperCase()}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               LOGISTICS CHAIN PORTAL — milestone logging as the hero
            ───────────────────────────────────────────────────────────── */
            <div className="space-y-6">

              {/* ROLE SCOPE BANNER */}
              <LogisticsScopeBanner jobRole={currentUser.jobRole} />

              {/* HERO: MILESTONE LOGGER — full width, 4-step wizard feel */}
              <div className="bg-white border border-sand-200 rounded-3xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="bg-maritime-900 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-ocean-400/20 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-ocean-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-black text-base tracking-tight">Log a Milestone</h2>
                      <p className="text-maritime-300 text-[11px] mt-0.5">
                        Every log is committed to the Stellar trade ledger and cannot be undone.
                      </p>
                    </div>
                  </div>
                  {/* live ready indicator */}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    selectedShipmentLogId
                      ? 'bg-ocean-400/10 border-ocean-400/30 text-ocean-400'
                      : 'bg-maritime-700 border-maritime-600 text-maritime-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedShipmentLogId ? 'bg-ocean-400 animate-pulse' : 'bg-maritime-500'
                    }`} />
                    {selectedShipmentLogId ? 'Ready to Log' : 'Awaiting Cargo Select'}
                  </div>
                </div>

                {/* Step form */}
                <form onSubmit={handleQuickLogMilestone} className="p-6 space-y-0">

                  {/* Status alerts */}
                  {logStatusError && (
                    <div className="mb-5 bg-coral-50 border border-coral-200 text-coral-700 text-xs p-3.5 rounded-xl leading-normal flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-coral-400 flex-shrink-0 mt-0.5" />
                      <span>{logStatusError}</span>
                    </div>
                  )}
                  {logStatusSuccess && (
                    <div className="mb-5 bg-ocean-50 border border-ocean-100 text-ocean-700 text-xs p-3.5 rounded-xl font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-ocean-400" />
                      <span>{logStatusSuccess}</span>
                    </div>
                  )}

                  {/* 4-step grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0 md:gap-px bg-sand-100 rounded-2xl overflow-hidden border border-sand-200">

                    {/* Step 1 — Pick Cargo */}
                    <MilestoneStep
                      step={1}
                      label="Cargo Reference"
                      hint="Which shipment are you handling?"
                      active={true}
                      done={!!selectedShipmentLogId}
                    >
                      <select
                        className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-xs text-gray-800 outline-none focus:border-maritime-400 font-mono"
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
                          <div className="mt-2 text-[10px] text-gray-500 leading-relaxed">
                            <span className="font-medium text-gray-700">{s.description.substring(0, 40)}{s.description.length > 40 ? '…' : ''}</span>
                            <br />
                            <span className="flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-maritime-400" />
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
                        className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-xs text-gray-800 outline-none focus:border-maritime-400 disabled:opacity-40 disabled:cursor-not-allowed"
                        value={logMilestoneType}
                        disabled={!selectedShipmentLogId}
                        onChange={(e) => setLogMilestoneType(e.target.value as MilestoneType)}
                      >
                        {MILESTONE_BY_JOB[currentUser.jobRole]?.map((mType) => (
                          <option key={mType} value={mType}>
                            {mType.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-[10px] text-gray-400">
                        {MILESTONE_BY_JOB[currentUser.jobRole]?.length ?? 0} milestones available for your role.
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
                      <textarea
                        rows={3}
                        placeholder="e.g. Container gated through Pier 14 at 14:30 PHT. Seal intact."
                        className="w-full border border-sand-200 rounded-lg p-2.5 text-xs outline-none focus:border-maritime-400 resize-none disabled:opacity-40 disabled:cursor-not-allowed leading-relaxed"
                        disabled={!selectedShipmentLogId}
                        value={logMessage}
                        onChange={(e) => setLogMessage(e.target.value)}
                      />
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
                        <div className="flex items-center gap-2 bg-ocean-50 border border-ocean-100 rounded-lg px-3 py-2">
                          <CheckCircle2 className="w-4 h-4 text-ocean-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-ocean-700 truncate">{logEvidence}</p>
                            <button
                              type="button"
                              onClick={() => setLogEvidence('')}
                              className="text-[9px] text-coral-500 hover:underline mt-0.5"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!selectedShipmentLogId}
                          onClick={() => setLogEvidence('evidence_' + Date.now() + '.jpg')}
                          className="w-full border-2 border-dashed border-sand-200 hover:border-maritime-400 rounded-lg px-3 py-4 text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                        >
                          <Upload className="w-5 h-5 text-gray-300 group-hover:text-maritime-400 mx-auto mb-1 transition-colors" />
                          <p className="text-[10px] font-bold text-gray-400 group-hover:text-maritime-600">Attach proof photo or PDF</p>
                          <p className="text-[9px] text-gray-300 mt-0.5">JPG, PNG, PDF — max 10 MB</p>
                        </button>
                      )}
                    </MilestoneStep>
                  </div>

                  {/* Submit row */}
                  <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="submit"
                      disabled={isLogging || !selectedShipmentLogId}
                      className="bg-maritime-900 hover:bg-maritime-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black px-8 py-3 rounded-xl text-sm tracking-wide transition-all cursor-pointer shadow-sm flex items-center gap-2"
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
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      This action is <strong className="text-gray-600">irreversible</strong>. Ensure all details are correct before submitting.
                      Stellar transaction fees apply.
                    </p>
                  </div>

                </form>
              </div>

              {/* LOWER SECTION — assigned shipments + recent logs side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* Assigned Shipments — wider */}
                <div className="lg:col-span-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-sm text-maritime-900 tracking-tight flex items-center gap-2">
                      <Ship className="w-4 h-4 text-maritime-400" />
                      Assigned Shipments
                    </h3>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Search ref…"
                        className="bg-white border border-sand-200 pl-7 pr-3 py-1.5 rounded-lg text-xs outline-none focus:border-maritime-400 w-36"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="bg-white border border-sand-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-sand-100">
                    {filteredShipments.length === 0 ? (
                      <div className="py-12 text-center text-xs text-gray-400 font-mono">NO ASSIGNED SHIPMENTS FOUND</div>
                    ) : filteredShipments.map((ship) => (
                      <div
                        key={ship.id}
                        className={`p-4 flex items-center gap-4 hover:bg-sand-50/40 transition-colors cursor-pointer ${
                          selectedShipmentLogId === ship.id ? 'bg-maritime-50 border-l-2 border-l-maritime-400' : ''
                        }`}
                        onClick={() => {
                          setSelectedShipmentLogId(ship.id);
                          setLogStatusError('');
                          setLogStatusSuccess('');
                        }}
                      >
                        {/* Status dot */}
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${
                          ship.status === 'DELIVERED' ? 'bg-green-400'
                          : ship.status === 'IN_TRANSIT' ? 'bg-ocean-400 animate-pulse'
                          : ship.status === 'CUSTOMS_CLEARANCE' ? 'bg-amber-400'
                          : 'bg-sand-300'
                        }`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold font-mono text-xs text-maritime-900">{ship.referenceCode}</span>
                            <span className="bg-sand-100 text-gray-500 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">{ship.shipmentScope}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              ship.status === 'DELIVERED' ? 'bg-green-100 text-green-700'
                              : ship.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                            }`}>
                              {ship.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">{ship.description}</p>
                          <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />{ship.originCountry} → {ship.destinationPort}
                            </span>
                            {ship.estimatedArrival && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3 text-coral-400" />
                                ETA {new Date(ship.estimatedArrival).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {selectedShipmentLogId === ship.id && (
                            <span className="text-[9px] bg-maritime-900 text-white px-2 py-0.5 rounded-full font-bold">SELECTED</span>
                          )}
                          <Link
                            href={`/shipments/${ship.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] bg-sand-100 hover:bg-sand-200 text-gray-600 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                          >
                            Timeline <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Milestones Feed */}
                <div className="lg:col-span-2 space-y-3">
                  <h3 className="font-extrabold text-sm text-maritime-900 tracking-tight flex items-center gap-2">
                    <Activity className="w-4 h-4 text-ocean-400" />
                    Recent Logs
                  </h3>

                  <div className="bg-white border border-sand-200 rounded-2xl overflow-hidden shadow-sm">
                    {milestones.length === 0 ? (
                      <div className="py-12 text-center">
                        <CircleDot className="w-8 h-8 text-sand-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-400 font-mono">NO RECENT LOGS</p>
                        <p className="text-[10px] text-gray-300 mt-1">Your submitted milestones will appear here.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-sand-100">
                        {milestones.map((me, idx) => (
                          <div key={idx} className="px-4 py-3.5 flex gap-3">
                            <div className="w-7 h-7 rounded-lg bg-ocean-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <PackageCheck className="w-3.5 h-3.5 text-ocean-500" />
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-[10px] font-black text-maritime-900 uppercase tracking-tight leading-tight">
                                {me.type.replace(/_/g, ' ')}
                              </p>
                              <p className="text-[10px] text-gray-500 leading-relaxed truncate">{me.description}</p>
                              <div className="flex items-center gap-2 pt-0.5">
                                <span className="text-[9px] font-mono text-gray-300">
                                  {new Date(me.occurredAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {me.verified && (
                                  <span className="text-[9px] bg-green-100 text-green-600 font-bold px-1 rounded">VERIFIED</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
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
              ? 'bg-ocean-400 text-white'
              : 'bg-sand-100 text-gray-400 border border-sand-200'
          }`}>
            {done ? '✓' : step}
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-700 uppercase tracking-wider leading-none">{label}</p>
            <p className="text-[9px] text-gray-400 mt-0.5 leading-none">{hint}</p>
          </div>
        </div>
        {required && !done && (
          <span className="text-[8px] bg-coral-400 text-white font-bold px-1 py-0.5 rounded flex-shrink-0 mt-0.5">REQ</span>
        )}
      </div>
      {/* Step content */}
      <div>{children}</div>
    </div>
  );
}

/** Banner showing which milestones the current role can log */
const ROLE_META: Record<JobRole, { label: string; color: string; icon: React.ReactNode }> = {
  FREIGHT_FORWARDER: { label: 'Freight Forwarder', color: 'bg-blue-50 border-blue-100 text-blue-700', icon: <Truck className="w-4 h-4" /> },
  CUSTOMS_BROKER: { label: 'Customs Broker', color: 'bg-amber-50 border-amber-100 text-amber-700', icon: <FileCheck className="w-4 h-4" /> },
  WAREHOUSE_OPERATOR: { label: 'Warehouse Operator', color: 'bg-purple-50 border-purple-100 text-purple-700', icon: <Warehouse className="w-4 h-4" /> },
  IMPORTER: { label: 'Importer', color: 'bg-sand-50 border-sand-100 text-sand-700', icon: <Shield className="w-4 h-4" /> },
  EXPORTER: { label: 'Exporter', color: 'bg-sand-50 border-sand-100 text-sand-700', icon: <Shield className="w-4 h-4" /> },
};

function LogisticsScopeBanner({ jobRole }: { jobRole: JobRole }) {
  const milestones = MILESTONE_BY_JOB[jobRole] ?? [];
  const meta = ROLE_META[jobRole];

  return (
    <div className={`border rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 ${meta.color}`}>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {meta.icon}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Active Role</p>
          <p className="text-sm font-extrabold leading-tight">{meta.label}</p>
        </div>
      </div>
      <div className="hidden sm:block w-px h-8 bg-current opacity-10" />
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1.5">Your Loggable Milestones</p>
        <div className="flex flex-wrap gap-1.5">
          {milestones.map((m) => (
            <span
              key={m}
              className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/60 border border-current/10 tracking-wide"
            >
              {m.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold opacity-60 flex-shrink-0">
        <Lock className="w-3 h-3" />
        {milestones.length} milestones
      </div>
    </div>
  );
}
