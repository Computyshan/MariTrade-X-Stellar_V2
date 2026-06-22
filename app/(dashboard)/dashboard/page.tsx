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
  FileText, 
  Activity, 
  MapPin, 
  Clock, 
  ChevronRight, 
  Search, 
  Upload, 
  AlertCircle,
  Truck,
  Anchor,
  Sparkles
} from 'lucide-react';
import { MilestoneType, JobRole, Shipment, MilestoneEvent } from '@/types';

// MILESTONE FILTER DICTIONARY FROM STARTER SPEC
const MILESTONE_BY_JOB: Record<JobRole, MilestoneType[]> = {
  IMPORTER: ['DELIVERED_AND_SIGNED_OFF'],
  EXPORTER: ['BILL_OF_LADING_ISSUED'],
  COMPANY_OWNER: ['DELIVERED_AND_SIGNED_OFF'],
  TRADER: ['BILL_OF_LADING_ISSUED'],
  FREIGHT_FORWARDER: [
    'BOOKING_CONFIRMED',
    'DOCUMENTS_SUBMITTED_TO_CARRIER',
    'CARGO_READY_FOR_COLLECTION',
    'SPACE_ON_VESSEL_SECURED',
  ],
  SHIPPING_LINE_CAPTAIN: [
    'BILL_OF_LADING_ISSUED',
    'CONTAINER_LOADED_ON_VESSEL',
    'VESSEL_DEPARTED_ORIGIN',
    'VESSEL_ARRIVED_DESTINATION',
    'CONTAINER_OFFLOADED',
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
  PORT_AUTHORITY_OFFICER: [
    'VESSEL_CLEARED_TO_DEPART',
    'CONTAINER_GATED_OUT_ORIGIN',
    'VESSEL_ARRIVED_AT_BERTH',
    'CONTAINER_GATED_IN_DESTINATION',
    'PORT_HOLD_PLACED_OR_LIFTED',
  ],
  TRUCKER: [
    'CARGO_PICKED_UP_FROM_PORT',
    'IN_TRANSIT_TO_DESTINATION',
    'ARRIVED_AT_DELIVERY_ADDRESS',
    'DELIVERED_AND_SIGNED_OFF',
    'FAILED_DELIVERY_ATTEMPT',
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

      // Fetch all milestones for feed
      const msRes = await fetch('/app/api/shipments/milestones-feed', {
        headers: { 'mock': 'true' }
      });
      // We can also query default milestones via simulated endpoint fallback
      const m1: MilestoneEvent[] = [
        {
          id: 'me-feed-1',
          shipmentId: 'shipment-tokyo-manila-1',
          loggedById: 'emily-forwarder-id',
          type: 'BOC_ENTRY_FILED',
          description: 'Customs declaration successfully registered under cargo MT-2026-00341.',
          evidenceUrl: '/evidence_boc.jpg',
          occurredAt: new Date(Date.now() - 4 * 3600000).toISOString(),
          verified: true
        },
        {
          id: 'me-feed-2',
          shipmentId: 'shipment-tokyo-manila-1',
          loggedById: 'carlos-broker-id',
          type: 'SPACE_ON_VESSEL_SECURED',
          description: 'Maersk container vessel depart clearance approved.',
          evidenceUrl: '/evidence_vessel.png',
          occurredAt: new Date(Date.now() - 12 * 3600000).toISOString(),
          verified: true
        }
      ];
      setMilestones(m1);
    } catch (err) {
      console.warn('Dashboard fetch failed, loading fallback stores:', err);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight">
            Kamusta, {currentUser.fullName}!
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Running secure portal. Your role is configured as <span className="text-maritime-400 font-bold uppercase">{currentUser.jobRole.replace(/_/g, ' ')}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-sand-200 shadow-sm text-xs text-gray-500">
          <Clock className="w-4 h-4 text-maritime-400" />
          <span className="font-mono">LEDGER ACTIVE (UTC)</span>
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
            <div className="space-y-8">
              {/* Stat Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Stat 1 */}
                <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-maritime-50 rounded-xl flex items-center justify-center text-maritime-400">
                    <Ship className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-400 uppercase font-mono tracking-wider font-bold">Active Cargoes</span>
                    <strong className="text-2xl text-maritime-900 font-black font-mono">
                      {shipments.filter(s => s.status !== 'DELIVERED' && s.status !== 'CANCELLED').length}
                    </strong>
                  </div>
                </div>

                {/* Stat 2 */}
                <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-ocean-50 rounded-xl flex items-center justify-center text-ocean-600">
                    <Coins className="w-6 h-6 text-ocean-400" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-400 uppercase font-mono tracking-wider font-bold">Funds In Escrow</span>
                    <strong className="text-2xl text-maritime-900 font-black font-mono">
                      $45,000 <span className="text-xs text-gray-400">USDC</span>
                    </strong>
                    <span className="block text-[10px] text-ocean-600 italic mt-0.5">₱2,641,500 equivalent</span>
                  </div>
                </div>

                {/* Stat 3 */}
                <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                    <CheckSquare className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-400 uppercase font-mono tracking-wider font-bold">Delivered Month</span>
                    <strong className="text-2xl text-maritime-900 font-black font-mono">
                      {shipments.filter(s => s.status === 'DELIVERED').length}
                    </strong>
                  </div>
                </div>

                {/* Stat 4 */}
                <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-coral-50 rounded-xl flex items-center justify-center text-coral-400">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-400 uppercase font-mono tracking-wider font-bold">Locks Confirmed</span>
                    <strong className="text-2xl text-maritime-900 font-black font-mono">2 / 2</strong>
                  </div>
                </div>
              </div>

              {/* Grid 2 Column: Ships list + Activity Log */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Shipments Table */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-maritime-900 tracking-tight">Active Shipments</h2>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search ref or cargo..."
                        className="bg-white border border-sand-200 pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none focus:border-maritime-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="bg-white border border-sand-200 rounded-2xl overflow-hidden shadow-sm">
                    {filteredShipments.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-xs font-mono">
                        NO CARGOES FOUND MATCHING SEARCH.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-sand-50 border-b border-sand-200 text-gray-500 font-bold uppercase font-mono text-[10px]">
                            <tr>
                              <th className="px-4 py-3">Reference</th>
                              <th className="px-4 py-3">Origin</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Escrow</th>
                              <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sand-200">
                            {filteredShipments.map((ship) => (
                              <tr key={ship.id} className="hover:bg-sand-50/50">
                                <td className="px-4 py-3.5">
                                  <Link href={`/shipments/${ship.id}`} className="font-bold font-mono text-maritime-400 hover:underline">
                                    {ship.referenceCode}
                                  </Link>
                                  <span className="block text-[10px] text-gray-400 font-normal truncate max-w-[150px]">{ship.description}</span>
                                </td>
                                <td className="px-4 py-3.5 text-gray-600 font-medium">
                                  {ship.originCountry}
                                  <span className="block text-[10px] text-gray-400 font-normal">To {ship.destinationPort}</span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                    ship.status === 'DELIVERED' 
                                      ? 'bg-green-100 text-green-700'
                                      : ship.status === 'IN_TRANSIT'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {ship.status?.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 font-bold font-mono text-maritime-900">
                                  ${ship.totalValueUSD?.toLocaleString()}
                                  <span className="block text-[9px] text-ocean-600 font-medium">{ship.escrowStatus}</span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <Link 
                                    href={`/shipments/${ship.id}`}
                                    className="bg-maritime-50 hover:bg-maritime-100 text-maritime-900 font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition-all"
                                  >
                                    <span>Manage</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
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

                {/* Right col: Live Updates feed */}
                <div className="space-y-6">
                  {/* Realtime feed */}
                  <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-ocean-400" />
                      <span>Live Port Activity Feed</span>
                    </h3>
                    
                    <div className="space-y-4">
                      {milestones.map((me, idx) => (
                        <div key={idx} className="flex gap-3 border-b border-sand-100 pb-3 last:border-0 last:pb-0">
                          <div className="w-8 h-8 rounded-full bg-ocean-50 flex items-center justify-center text-ocean-600 flex-shrink-0 text-xs font-bold">
                            ⚓
                          </div>
                          <div className="text-xs space-y-1">
                            <p className="font-bold text-gray-800 uppercase tracking-tight">{me.type.replace(/_/g, ' ')}</p>
                            <p className="text-gray-500 leading-normal">{me.description}</p>
                            <span className="text-[10px] text-gray-400 font-mono block">cargo ref: MT-2026-00341</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Cost Estimation widget */}
                  <div className="bg-maritime-900 text-white p-6 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-extrabold text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-ocean-400" />
                      <span>AI Freight Fee Estimator</span>
                    </h3>
                    <p className="text-[11px] text-maritime-200 leading-normal">
                      Use Gemini smart predictions to estimate regional container freight costs before shipping.
                    </p>

                    <form onSubmit={handleAIEstimate} className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-maritime-200 font-bold uppercase tracking-wider">Weight (kg)</label>
                          <input 
                            type="number" 
                            className="bg-maritime-700 text-white rounded p-1.5 w-full text-xs outline-none focus:ring-1 focus:ring-ocean-400"
                            value={aiCargoWeight}
                            onChange={(e)=>setAiCargoWeight(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-maritime-200 font-bold uppercase tracking-wider">Cargo Type</label>
                          <input 
                            type="text" 
                            className="bg-maritime-700 text-white rounded p-1.5 w-full text-xs outline-none focus:ring-1 focus:ring-ocean-400"
                            value={aiCargoType}
                            onChange={(e)=>setAiCargoType(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="bg-ocean-400 hover:bg-ocean-600 text-maritime-900 w-full rounded py-1.5 text-xs font-bold transition-all cursor-pointer"
                        disabled={estimating}
                      >
                        {estimating ? 'Calculating ocean currents...' : 'Predict Shipping Payout'}
                      </button>
                    </form>

                    {aiResult && (
                      <div className="p-3 bg-maritime-800 rounded-lg text-[11px] space-y-2 border border-maritime-700">
                        <div className="flex justify-between items-center text-xs font-black text-ocean-400">
                          <span>ESTIMATED: ${aiResult.estimatedUSD?.toLocaleString()}</span>
                          <span className="text-[10px] bg-maritime-900 px-1.5 py-0.5 rounded uppercase">{aiResult.confidence} CONFIDENCE</span>
                        </div>
                        <p className="text-maritime-200 leading-normal">{aiResult.breakdown}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* USER SPECIFIC PORTAL: LOGISTICS FLEET (FREIGHT FORWARDER / DRIVER / BROKER...) */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left col: Assigned cargos */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-maritime-900 tracking-tight">Active Handoff Logs</h2>
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider bg-white rounded-full px-3 py-1 border border-sand-200">
                    My assignments
                  </span>
                </div>

                <div className="bg-white border border-sand-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-sand-200">
                  {shipments.map((ship) => (
                    <div key={ship.id} className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-sand-50/20">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-sm text-maritime-900">{ship.referenceCode}</span>
                          <span className="bg-sand-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            {ship.shipmentScope}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 max-w-md">{ship.description}</p>
                        <div className="flex items-center gap-4 text-[10px] text-gray-400 pt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-maritime-400" />
                            {ship.originCountry} → {ship.destinationPort}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-coral-400" />
                            ETA: {new Date(ship.estimatedArrival || '').toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedShipmentLogId(ship.id);
                            setLogStatusError('');
                            setLogStatusSuccess('');
                          }}
                          className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                            selectedShipmentLogId === ship.id
                              ? 'bg-maritime-900 text-white'
                              : 'bg-maritime-50 hover:bg-maritime-100 text-maritime-900'
                          }`}
                        >
                          Select Cargo
                        </button>
                        <Link
                          href={`/shipments/${ship.id}`}
                          className="bg-sand-100 hover:bg-sand-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg"
                        >
                          Timeline
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column: Log Milestone Box */}
              <div className="space-y-6">
                <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-sand-100 pb-3">
                    <Anchor className="w-5 h-5 text-maritime-400" />
                    <div>
                      <h3 className="font-extrabold text-sm text-maritime-900">Asynchronous Milestone Logger</h3>
                      <p className="text-[10px] text-gray-400">Restricted to: {currentUser.jobRole}</p>
                    </div>
                  </div>

                  {logStatusError && (
                    <div className="bg-coral-50 border border-coral-400/20 text-coral-600 text-[11px] p-3 rounded-lg leading-normal flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-coral-400 flex-shrink-0 mt-0.5" />
                      <span>{logStatusError}</span>
                    </div>
                  )}

                  {logStatusSuccess && (
                    <div className="bg-ocean-50 border border-ocean-100 text-ocean-600 text-[11px] p-3 rounded-lg font-bold">
                      {logStatusSuccess}
                    </div>
                  )}

                  <form onSubmit={handleQuickLogMilestone} className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700">Target Cargo Reference</label>
                      <select
                        className="w-full bg-sand-50 border border-sand-200 rounded px-2.5 py-1.5 text-xs text-gray-800 outline-none"
                        value={selectedShipmentLogId}
                        onChange={(e) => setSelectedShipmentLogId(e.target.value)}
                      >
                        <option value="">-- Choose Assigned Shipment --</option>
                        {shipments.map(s => (
                          <option key={s.id} value={s.id}>{s.referenceCode} ({s.description.substring(0, 20)}...)</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700">Available Milestones for Job</label>
                      <select
                        className="w-full bg-sand-50 border border-sand-200 rounded px-2.5 py-1.5 text-xs text-gray-800 outline-none"
                        value={logMilestoneType}
                        onChange={(e) => setLogMilestoneType(e.target.value as MilestoneType)}
                      >
                        {MILESTONE_BY_JOB[currentUser.jobRole]?.map((mType) => (
                          <option key={mType} value={mType}>{mType.replace(/_/g, ' ')}</option>
                        ))}
                        {(!MILESTONE_BY_JOB[currentUser.jobRole] || MILESTONE_BY_JOB[currentUser.jobRole].length === 0) && (
                          <option value="">No milestones configured for role</option>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700">Logs Detail Description</label>
                      <textarea
                        rows={3}
                        placeholder="e.g. Container gated through Pier 14 successfully."
                        className="w-full border border-sand-200 rounded p-2 text-xs outline-none focus:border-maritime-400"
                        value={logMessage}
                        onChange={(e) => setLogMessage(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-gray-700">File Evidence Proof (Required)</label>
                        <span className="text-[9px] bg-coral-400 text-white font-bold p-0.5 rounded">REQUIRED API LOCK</span>
                      </div>
                      
                      <div className="border border-dashed border-sand-200 rounded p-3 text-center space-y-1">
                        {logEvidence ? (
                          <p className="font-bold text-ocean-600 text-[10px]">✓ Attached: {logEvidence}</p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setLogEvidence('proof_doc_' + Math.floor(Math.random() * 10000) + '.pdf')}
                            className="bg-sand-50 hover:bg-sand-100 border border-sand-200 rounded px-3 py-1 font-bold text-[10px] text-gray-700 inline-flex items-center gap-1 cursor-pointer mx-auto"
                          >
                            <Upload className="w-3.5 h-3.5 text-gray-400" />
                            <span>Select Proof Photo</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLogging}
                      className="bg-maritime-400 hover:bg-maritime-900 text-white font-black w-full py-2.5 rounded-lg text-xs tracking-wider transition-all cursor-pointer uppercase shadow-sm"
                    >
                      {isLogging ? 'Updating Stellar Ledger...' : 'Log Compliance Milestone'}
                    </button>
                  </form>
                </div>
              </div>

            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
