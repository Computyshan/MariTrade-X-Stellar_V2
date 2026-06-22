'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { 
  Ship, 
  MapPin, 
  Clock, 
  Coins, 
  FileText, 
  Lock, 
  Unlock, 
  ChevronLeft, 
  Upload, 
  Download, 
  AlertTriangle, 
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { Shipment, MilestoneEvent, PriorityMilestone, ShipmentDocument } from '@/types';

type PageParams = {
  id: string;
};

interface ShipmentDetailProps {
  params: Promise<PageParams>;
}

export default function ShipmentDetail({ params }: ShipmentDetailProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { currentUser } = useUserSession();
  const shipmentId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    shipment: Shipment;
    milestones: MilestoneEvent[];
    priorityMilestones: PriorityMilestone[];
    documents: ShipmentDocument[];
    assignments: any[];
  } | null>(null);

  const [errorText, setErrorText] = useState('');
  
  // Document upload form
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileUrl, setUploadFileUrl] = useState('');

  // Escrow release form
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseProofUrl, setReleaseProofUrl] = useState('');

  // Stellar Simulation Status
  const [stellarWorking, setStellarWorking] = useState(false);
  const [stellarHash, setStellarHash] = useState('');

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setErrorText('');
      const res = await fetch(`/api/shipments/${shipmentId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setErrorText(json.error || 'Failed to fetch shipment details');
      }
    } catch {
      setErrorText('Error connecting to central tradeport ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shipmentId) {
      fetchDetails();
    }
  }, [shipmentId]);

  // Is all priority milestones completed?
  const allPriorityCompleted = data?.priorityMilestones?.every(pm => pm.isCompleted) ?? false;

  const handleFundEscrow = async () => {
    if (!data) return;
    try {
      setStellarWorking(true);
      // Simulate multi-sig Stellar trust fund loading
      setTimeout(async () => {
        const res = await fetch(`/api/shipments/${data.shipment.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'EXPORTER_ACCEPT' }) // Confirms it
        });
        await res.json();
        setStellarHash('tx_lock_active_' + Math.random().toString(36).substring(2, 9));
        setStellarWorking(false);
        fetchDetails();
      }, 1500);
    } catch {
      setStellarWorking(false);
    }
  };

  const handleDocumentUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !uploadFileName || !uploadFileUrl) return;

    try {
      const res = await fetch(`/api/shipments/${data.shipment.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPLOAD_DOCUMENT',
          fileName: uploadFileName,
          fileUrl: uploadFileUrl,
          uploadedById: currentUser.id
        })
      });
      const resJson = await res.json();
      if (resJson.success) {
        setUploadOpen(false);
        setUploadFileName('');
        setUploadFileUrl('');
        fetchDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEscrowReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !releaseProofUrl) return;

    try {
      setStellarWorking(true);
      const res = await fetch(`/api/shipments/${data.shipment.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RELEASE_ESCROW',
          evidenceUrl: releaseProofUrl
        })
      });
      const resJson = await res.json();
      if (resJson.success) {
        setReleaseOpen(false);
        setReleaseProofUrl('');
        fetchDetails();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStellarWorking(false);
    }
  };

  const handleCancelShipment = async () => {
    if (!data) return;
    if (!confirm('Are you sure you want to cancel the cargo shipment and request a Stellar escrow refund?')) return;
    try {
      const res = await fetch(`/api/shipments/${data.shipment.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CANCEL_SHIPMENT' })
      });
      const resJson = await res.json();
      if (resJson.success) {
        fetchDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-24 bg-white rounded-3xl border border-sand-200">
          <div className="w-10 h-10 border-4 border-maritime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-gray-400 font-mono">LOADING TRUST ENGINE METRICS FOR CARGO {shipmentId}...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (errorText || !data) {
    return (
      <DashboardLayout>
        <div className="bg-white border border-sand-200 p-8 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-coral-400 mx-auto" />
          <h2 className="text-lg font-bold text-maritime-900">Shipment Details Unreachable</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">{errorText || 'Unknown error occurred.'}</p>
          <div className="pt-2">
            <button onClick={() => router.push('/shipments')} className="bg-maritime-400 text-white text-xs font-bold px-4 py-2 rounded-lg">
              Return to Catalog
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const { shipment, milestones, priorityMilestones, documents, assignments } = data;

  return (
    <DashboardLayout>
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <button
            onClick={() => router.push('/shipments')}
            className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-medium cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Shipments</span>
          </button>
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight font-mono">{shipment.referenceCode}</h1>
          <p className="text-xs text-gray-400">Cargo Item: <strong className="text-gray-700 font-semibold">{shipment.description}</strong></p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-maritime-900 text-white font-bold px-3 py-1 rounded-full uppercase">
            {shipment.shipmentScope}
          </span>
          <span className={`px-3 py-1 rounded-full uppercase font-bold ${
            shipment.status === 'DELIVERED' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-amber-100 text-amber-700'
          }`}>
            {shipment.status?.replace(/_/g, ' ')}
          </span>
          {shipment.stellarEscrowId && (
            <a
              href="https://stellar.expert"
              target="_blank"
              rel="noreferrer"
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-bold flex items-center gap-1 transiton-all"
            >
              <span>View On Stellar</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Main Grid: Escrow Controls + Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Milestone Timeline Column (60% equivalent) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-maritime-900 tracking-tight flex items-center gap-2">
              <Ship className="w-5 h-5 text-maritime-400" />
              <span>Milestone Tracking & Signoffs</span>
            </h3>

            {/* List Priorities */}
            <div className="bg-sand-50 p-4 rounded-xl border border-sand-200 space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider font-mono">Stellar Release Requirements</h4>
              <div className="space-y-2">
                {priorityMilestones.map((pm) => (
                  <div key={pm.id} className="flex items-center gap-2.5 text-xs text-gray-700">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      pm.isCompleted 
                        ? 'bg-ocean-400 text-maritime-900' 
                        : 'bg-maritime-100 text-maritime-400 pulsing animate-pulse'
                    }`}>
                      {pm.isCompleted ? '✓' : '●'}
                    </span>
                    <span className="font-bold uppercase tracking-tight">{pm.type.replace(/_/g, ' ')}</span>
                    <span className="text-gray-400">({pm.isCompleted ? 'CONFIRMED' : 'AWAITING SIGNOFF'})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            {milestones.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs font-mono">
                AWAITING INITIAL FORWARDING AND BOOKING MILESTONES.
              </div>
            ) : (
              <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-sand-200">
                {milestones.map((me) => {
                  const isPriority = priorityMilestones.some(pm => pm.type === me.type);
                  return (
                    <div key={me.id} className="relative space-y-1 text-xs">
                      {/* Circle indicator */}
                      <span className={`absolute -left-[22.5px] top-1 w-4 h-4 rounded-full border-2 border-white ring-4 inline-block ${
                        isPriority 
                          ? 'bg-ocean-400 ring-ocean-50' 
                          : 'bg-sand-200 ring-sand-100'
                      }`}></span>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <strong className="font-bold text-maritime-900 text-xs font-sans uppercase">
                          {me.type.replace(/_/g, ' ')}
                        </strong>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(me.occurredAt).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-gray-600 leading-normal pl-1">{me.description || 'No custom notes logged.'}</p>
                      
                      <div className="flex items-center gap-3 pt-1 text-[10px] pl-1 text-gray-400 font-medium">
                        <span>Logged by user ID: <strong className="text-gray-600">{me.loggedById}</strong></span>
                        <span>•</span>
                        <a 
                          href={me.evidenceUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-ocean-600 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-ocean-400" />
                          <span>View Evidence Proof</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Escrow Ledger Column (40% equivalent) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Stellar Payout status */}
          <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
              <Coins className="w-5 h-5 text-ocean-400" />
              <span>Multi-Signature Escrow Locker</span>
            </h3>

            <div className="text-center py-4 bg-sand-50 rounded-xl border border-sand-200 space-y-1">
              <span className="text-[10px] text-gray-400 font-mono font-bold block uppercase tracking-wide">SECURED FUNDS</span>
              <strong className="text-3xl text-maritime-900 font-black font-mono block">${shipment.totalValueUSD?.toLocaleString()} USDC</strong>
              {shipment.shipmentScope === 'NATIONWIDE' && (
                <span className="text-[10px] text-ocean-600 block italic font-medium">₱{(shipment.totalValueUSD * 58.7).toLocaleString()} PHP indicative rate</span>
              )}
            </div>

            <div className="text-xs space-y-4">
              <div className="flex justify-between items-center bg-sand-100 p-2.5 rounded border border-sand-200 font-mono text-[11px]">
                <span className="text-gray-400">LEDGER STATUS:</span>
                <strong className={`font-bold ${
                  shipment.escrowStatus === 'RELEASED' 
                    ? 'text-ocean-600' 
                    : 'text-maritime-900'
                }`}>
                  {shipment.escrowStatus}
                </strong>
              </div>

              {/* ACTION PANELS BASED ON ESCROW STATE */}
              {shipment.escrowStatus === 'UNFUNDED' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-500 leading-normal">
                    The exporter has counter-signed terms. Authorize the funds transfer from your Stellar account to open container assignments.
                  </p>
                  <button
                    onClick={handleFundEscrow}
                    disabled={stellarWorking}
                    className="w-full bg-maritime-400 hover:bg-maritime-900 text-white font-bold py-2.5 rounded-lg text-xs leading-none cursor-pointer uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>{stellarWorking ? 'Locking multisig hashes...' : 'Authorize Escrow Lock'}</span>
                  </button>
                </div>
              )}

              {shipment.escrowStatus === 'FUNDED' && (
                <div className="space-y-4">
                  <div className="bg-ocean-50 border border-ocean-100 text-ocean-600 p-3 rounded-lg leading-normal flex items-start gap-1.5 text-[11px]">
                    <Lock className="w-4 h-4 text-ocean-400 flex-shrink-0 mt-0.5" />
                    <span>USDC stablecoin is securely locked on the public Stellar ledger under Multi-sign custody.</span>
                  </div>

                  {/* Release trigger */}
                  <div className="pt-2">
                    {allPriorityCompleted ? (
                      <div className="space-y-2">
                        <div className="p-3 bg-ocean-50 border border-ocean-100 rounded text-ocean-600 font-bold block text-center">
                          ✓ All Priority Milestone Signoffs Met!
                        </div>
                        <button
                          onClick={() => setReleaseOpen(true)}
                          className="w-full bg-ocean-600 hover:bg-ocean-400 text-white font-black py-2.5 rounded-lg text-xs cursor-pointer shadow-sm uppercase tracking-widest transition-all"
                        >
                          Execute Escrow Payout
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center bg-sand-100 p-3 rounded border border-sand-200">
                        <Clock className="w-4 h-4 text-coral-400 mx-auto mb-1 animate-pulse" />
                        <span className="font-semibold block text-[11px] text-gray-700">payout lock active</span>
                        <span className="text-[10px] text-gray-400 block leading-normal">Release button triggers automatically once all priority milestones (Customs Entries & Signoffs) are verified.</span>
                      </div>
                    )}
                  </div>

                  {/* Dispute/Cancel available prep */}
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={handleCancelShipment}
                      className="flex-1 border border-sand-300 hover:border-coral-400 text-gray-500 hover:text-coral-600 py-1.5 rounded text-center font-bold text-[10px] uppercase transition-all"
                    >
                      Request Refund
                    </button>
                  </div>
                </div>
              )}

              {shipment.escrowStatus === 'RELEASED' && (
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl leading-normal space-y-2 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="font-bold">Stellar Multi-sign Escrow Finalized!</p>
                  <p>The contract has completed successfully. $ {shipment.totalValueUSD?.toLocaleString()} USDC has been securely routed directly to the Exporter&apos;s wallet account.</p>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>

      {/* Bureau of Customs Shipments Document Grid */}
      <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-sand-100 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-coral-400" />
              <span>BOC Vault Documents Centre</span>
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Encrypted compliance files. Only authentic Trade Parties & Customs Brokers hold decryption keys.</p>
          </div>

          <button
            onClick={() => setUploadOpen(true)}
            className="bg-maritime-50 hover:bg-maritime-900 border border-maritime-200 text-maritime-900 hover:text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload BOC Document</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs font-mono">
            NO ENCRYPTED CARGO FILES IN THE BOC HUB.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {documents.map((doc) => (
              <div key={doc.id} className="border border-sand-200 p-4 rounded-xl space-y-4 bg-sand-50/50 flex flex-col justify-between">
                <div className="space-y-1 text-xs">
                  <FileText className="w-8 h-8 text-maritime-400 block mb-1" />
                  <strong className="font-bold text-maritime-900 block truncate" title={doc.fileName}>{doc.fileName}</strong>
                  <span className="text-[10px] text-gray-400 block font-mono">UPLOADED: {new Date(doc.createdAt).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2 pt-1 text-[10px]">
                    <span className="bg-sand-200 text-gray-600 px-1.5 rounded font-mono">v{doc.version}</span>
                    {doc.version > 1 && (
                      <span className="bg-amber-100 text-amber-700 font-bold px-1.5 rounded uppercase text-[8px]">Amended</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-sand-200 flex justify-between items-center text-[10px] font-bold">
                  <span className="text-gray-400">ID: {doc.uploadedById.substring(0,6)}</span>
                  <a
                    href={doc.fileUrl}
                    download
                    className="text-maritime-400 hover:text-maritime-900 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* POPUP DOCUMENT UPLOAD MODAL */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-sand-200 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-extrabold text-sm text-maritime-900 uppercase tracking-tight">Upload Entry Declaration</h3>
            
            <form onSubmit={handleDocumentUploadSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Document File Name</label>
                <input
                  type="text"
                  required
                  placeholder="BOC_Single_Admin_Declaration.pdf"
                  className="w-full border border-sand-200 rounded p-2 text-xs outline-none"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">File Path / URL</label>
                <input
                  type="text"
                  required
                  placeholder="https://mock_doc_bucket_maritrade.lh/sad_signed.pdf"
                  className="w-full border border-sand-200 rounded p-2 text-xs outline-none font-mono"
                  value={uploadFileUrl}
                  onChange={(e) => setUploadFileUrl(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setUploadFileUrl('https://picsum.photos/seed/dockyc/800/600')}
                  className="text-[10px] text-ocean-600 underline"
                >
                  Generate Mock File URL
                </button>
              </div>

              <div className="flex gap-2 justify-end pt-2 text-xs">
                <button
                  type="button"
                  className="px-3 py-1.5 border border-sand-200 rounded-lg text-gray-500 hover:text-gray-900"
                  onClick={() => setUploadOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-maritime-400 hover:bg-maritime-900 text-white rounded-lg font-bold"
                >
                  Submit Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP ESCROW RELEASE MODAL WITH RECEIPT VERIFIER */}
      {releaseOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-sand-200 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-extrabold text-sm text-maritime-900 uppercase tracking-tight">Stellar Escrow Release Consent</h3>
            <p className="text-[11px] text-gray-500 leading-normal">
              You are authorizing the immediate release of locked USDC. Importers must upload a signed terminal loading receipt before final settlement.
            </p>

            <form onSubmit={handleEscrowReleaseSubmit} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="block font-bold text-gray-700">Signed Handoff Receipt Receipt (URL)</label>
                <input
                  type="text"
                  required
                  placeholder="https://signoffs.ph/juan_delacruz_released_signature_p74b.png"
                  className="w-full border border-sand-200 rounded p-2 text-xs outline-none font-mono"
                  value={releaseProofUrl}
                  onChange={(e) => setReleaseProofUrl(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setReleaseProofUrl('https://picsum.photos/seed/release_sc/800/600')}
                  className="text-[10px] text-ocean-600 underline block"
                >
                  Quick attach handoff photo proof
                </button>
              </div>

              <div className="flex gap-2 justify-end pt-2 text-xs">
                <button
                  type="button"
                  className="px-3 py-1.5 border border-sand-200 rounded-lg text-gray-500"
                  onClick={() => setReleaseOpen(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={stellarWorking}
                  className="px-4 py-1.5 bg-ocean-600 hover:bg-ocean-400 text-white rounded-lg font-black"
                >
                  {stellarWorking ? 'Signing Ledger Keys...' : 'Sign & Authorize Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
