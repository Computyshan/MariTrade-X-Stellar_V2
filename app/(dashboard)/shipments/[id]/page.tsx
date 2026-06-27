'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
import { useFreighter } from '@/hooks/use-freighter';
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
  AlertCircle,
  FolderLock,
  Eye,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { Shipment, MilestoneEvent, PriorityMilestone, ShipmentDocument } from '@/types';
import { canAccessBOCDocuments } from '@/lib/permissions/documents';
import { getMariTradeEscrowClient, NETWORKS } from '@/lib/stellar/escrow-contract';
import { signAndSubmitWithRetry } from '@/lib/stellar/freighter';

type PageParams = { id: string };

interface ShipmentDetailProps {
  params: Promise<PageParams>;
}

const STELLAR_NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

export default function ShipmentDetail({ params }: ShipmentDetailProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { currentUser, loading: sessionLoading } = useUserSession();
  const freighter = useFreighter();
  const shipmentId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    shipment: Shipment;
    milestones: MilestoneEvent[];
    priorityMilestones: PriorityMilestone[];
    documents: ShipmentDocument[];
    assignments: any[];
    vaultFolderId: string | null;
  } | null>(null);

  const [errorText, setErrorText] = useState('');
  const [releaseOpen,    setReleaseOpen]    = useState(false);
  const [releaseProofUrl, setReleaseProofUrl] = useState('');
  const [stellarWorking, setStellarWorking] = useState(false);
  const [stellarStep,    setStellarStep]    = useState('');
  const [stellarHash,    setStellarHash]    = useState('');
  const [stellarError,   setStellarError]   = useState('');
  const [chainCanRelease, setChainCanRelease] = useState<boolean | null>(null);
  const [checkingRelease, setCheckingRelease] = useState(false);
  const [bocAuthOpen, setBocAuthOpen] = useState(false);
  const [uploadOpen,    setUploadOpen]    = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileUrl,  setUploadFileUrl]  = useState('');
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState('');

  if (sessionLoading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-maritime-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setErrorText('');
      const res  = await authFetch(`/api/shipments/${shipmentId}`);
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
    if (shipmentId) fetchDetails();
  }, [shipmentId]);

  // DB-level check (fast fallback)
  const allPriorityCompleted = data?.priorityMilestones?.every(pm => pm.isCompleted) ?? false;

  // ── Query canRelease from the contract when shipment is FUNDED ─────────────
  useEffect(() => {
    if (!data?.shipment || data.shipment.escrowStatus !== 'FUNDED') return;
    if (!data.shipment.referenceCode) return;
    // Only query the chain if the escrow ID is a real tx hash (64 hex chars),
    // not the placeholder value set during DB record creation.
    if (!data.shipment.stellarEscrowId) return;
    if (data.shipment.stellarEscrowId.length !== 64) return;

    const walletKey = freighter.publicKey
      ?? process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS
      ?? '';
    if (!walletKey) return;

    setCheckingRelease(true);
    const client = getMariTradeEscrowClient(STELLAR_NETWORK, walletKey);
    client.can_release({ reference_code: data.shipment.referenceCode })
      .then(tx => tx.result?.isOk() ? setChainCanRelease(tx.result.unwrap()) : setChainCanRelease(null))
      .catch(() => setChainCanRelease(null))
      .finally(() => setCheckingRelease(false));
  }, [data?.shipment?.escrowStatus, data?.shipment?.referenceCode, freighter.publicKey]);

  // ── Authorise escrow lock (UNFUNDED → FUNDED mock; kept for UI compatibility)
  const handleFundEscrow = async () => {
    if (!data) return;
    try {
      setStellarWorking(true);
      setStellarStep('Locking multisig hashes…');
      setTimeout(async () => {
        const res = await authFetch(`/api/shipments/${data.shipment.id}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'EXPORTER_ACCEPT' }),
        });
        await res.json();
        setStellarHash('tx_lock_active_' + Math.random().toString(36).substring(2, 9));
        setStellarWorking(false);
        setStellarStep('');
        fetchDetails();
      }, 1500);
    } catch {
      setStellarWorking(false);
      setStellarStep('');
    }
  };

  // ── Release escrow — calls the Soroban contract then updates DB ───────────
  const handleEscrowReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !releaseProofUrl) return;

    setStellarWorking(true);
    setStellarStep('');
    setStellarError('');

    try {
      // Resolve signer address
      const importerAddress = freighter.publicKey ?? await freighter.connect();

      // Gate: confirm on-chain that all milestones are done
      setStellarStep('Verifying milestone gate on Stellar…');
      const client = getMariTradeEscrowClient(STELLAR_NETWORK, importerAddress);
      const canReleaseTx = await client.can_release({ reference_code: data.shipment.referenceCode });
      const canRelease = canReleaseTx.result?.isOk() ? canReleaseTx.result.unwrap() : false;

      if (!canRelease) {
        setStellarError('Not all required milestones are confirmed on-chain yet. Release is still locked.');
        return;
      }

      // Build and sign the release transaction
      setStellarStep('Sign the release transaction in Freighter…');
      const txHash = await signAndSubmitWithRetry(
        () => client.release({
          reference_code: data.shipment.referenceCode,
          importer:       importerAddress,
        }),
        STELLAR_NETWORK,
      );
      setStellarHash(txHash);

      // Sync the DB record
      setStellarStep('Updating shipment record…');
      const res     = await authFetch(`/api/shipments/${data.shipment.id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:      'RELEASE_ESCROW',
          evidenceUrl: releaseProofUrl,
          txHash,
        }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setReleaseOpen(false);
        setReleaseProofUrl('');
        fetchDetails();
      } else {
        setStellarError(resJson.error || 'DB update failed after on-chain release.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Release transaction failed.';
      setStellarError(msg);
    } finally {
      setStellarWorking(false);
      setStellarStep('');
    }
  };

  const handleCancelShipment = async () => {
    if (!data) return;
    if (!confirm('Are you sure you want to cancel the cargo shipment and request a Stellar escrow refund?')) return;
    try {
      const res     = await authFetch(`/api/shipments/${data.shipment.id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'CANCEL_SHIPMENT' }),
      });
      const resJson = await res.json();
      if (resJson.success) fetchDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadBOCClick = () => {
    const hasAccess = canAccessBOCDocuments(currentUser.jobRole);
    if (!hasAccess) { setBocAuthOpen(true); return; }
    setUploadOpen(true);
  };

  const handleOpenVaultFolder = () => {
    if (data?.vaultFolderId) {
      router.push(`/documents/${data.vaultFolderId}`);
    } else {
      router.push('/documents');
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !uploadFileName.trim() || !uploadFileUrl.trim()) return;
    setUploading(true);
    setUploadError('');
    try {
      const res = await authFetch(`/api/shipments/${data.shipment.id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:       'UPLOAD_DOCUMENT',
          fileName:     uploadFileName.trim(),
          fileUrl:      uploadFileUrl.trim(),
          uploadedById: currentUser.id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setUploadOpen(false);
        setUploadFileName('');
        setUploadFileUrl('');
        fetchDetails(); // refresh the document list
      } else {
        setUploadError(json.error || 'Upload failed.');
      }
    } catch {
      setUploadError('Network error — please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-24 bg-white rounded-3xl border border-sand-200">
          <div className="w-10 h-10 border-4 border-maritime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
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

  const { shipment, milestones, priorityMilestones, documents, assignments, vaultFolderId } = data;

  // Decide release eligibility: prefer on-chain result, fall back to DB
  const releaseEligible = chainCanRelease !== null ? chainCanRelease : allPriorityCompleted;

  return (
    <DashboardLayout>
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <button onClick={() => router.push('/shipments')} className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-medium cursor-pointer">
            <ChevronLeft className="w-4 h-4" /><span>Back to Shipments</span>
          </button>
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight font-mono">{shipment.referenceCode}</h1>
          <p className="text-xs text-gray-400">Cargo Item: <strong className="text-gray-700 font-semibold">{shipment.description}</strong></p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-maritime-900 text-white font-bold px-3 py-1 rounded-full uppercase">{shipment.shipmentScope}</span>
          {currentUser.userType === 'LOGISTICS_CHAIN' && (
            <button onClick={() => router.push(`/shipments/${shipmentId}/log-milestone`)}
              className="bg-ocean-400 hover:bg-ocean-600 text-maritime-900 font-black px-3 py-1 rounded-full uppercase text-xs flex items-center gap-1 transition-all">
              + Log Milestone
            </button>
          )}
          <span className={`px-3 py-1 rounded-full uppercase font-bold ${shipment.status === 'DELIVERED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {shipment.status?.replace(/_/g, ' ')}
          </span>
          {shipment.stellarEscrowId && (
            <a href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${shipment.stellarEscrowId}`}
              target="_blank" rel="noreferrer"
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-bold flex items-center gap-1 transition-all">
              <span>View On Stellar</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Stellar error banner */}
      {stellarError && (
        <div className="bg-coral-50 border border-coral-200 text-coral-700 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {stellarError}
          <button onClick={() => setStellarError('')} className="ml-auto text-coral-400 hover:text-coral-700">✕</button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* Milestone Timeline */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-maritime-900 tracking-tight flex items-center gap-2">
              <Ship className="w-5 h-5 text-maritime-400" /><span>Milestone Tracking &amp; Signoffs</span>
            </h3>

            <div className="bg-sand-50 p-4 rounded-xl border border-sand-200 space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider font-mono">Stellar Release Requirements</h4>
              <div className="space-y-2">
                {priorityMilestones.map((pm) => (
                  <div key={pm.id} className="flex items-center gap-2.5 text-xs text-gray-700">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${pm.isCompleted ? 'bg-ocean-400 text-maritime-900' : 'bg-maritime-100 text-maritime-400 animate-pulse'}`}>
                      {pm.isCompleted ? '✓' : '●'}
                    </span>
                    <span className="font-bold uppercase tracking-tight">{pm.type.replace(/_/g, ' ')}</span>
                    <span className="text-gray-400">({pm.isCompleted ? 'CONFIRMED' : 'AWAITING SIGNOFF'})</span>
                  </div>
                ))}
              </div>
              {checkingRelease && (
                <div className="flex items-center gap-1.5 text-[10px] text-ocean-600 pt-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Checking on-chain release status…
                </div>
              )}
              {chainCanRelease !== null && !checkingRelease && (
                <div className={`text-[10px] font-bold pt-1 flex items-center gap-1 ${chainCanRelease ? 'text-ocean-600' : 'text-coral-500'}`}>
                  {chainCanRelease ? '✓ On-chain gate: OPEN — all milestones confirmed on Stellar' : '⊘ On-chain gate: LOCKED — pending milestone confirmations'}
                </div>
              )}
            </div>

            {milestones.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs font-mono">AWAITING INITIAL FORWARDING AND BOOKING MILESTONES.</div>
            ) : (
              <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-sand-200">
                {milestones.map((me) => {
                  const isPriority = priorityMilestones.some(pm => pm.type === me.type);
                  return (
                    <div key={me.id} className="relative space-y-1 text-xs">
                      <span className={`absolute -left-[22.5px] top-1 w-4 h-4 rounded-full border-2 border-white ring-4 inline-block ${isPriority ? 'bg-ocean-400 ring-ocean-50' : 'bg-sand-200 ring-sand-100'}`} />
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <strong className="font-bold text-maritime-900 text-xs font-sans uppercase">{me.type.replace(/_/g, ' ')}</strong>
                        <span className="text-[10px] text-gray-400 font-mono">{new Date(me.occurredAt).toLocaleString()}</span>
                      </div>
                      <p className="text-gray-600 leading-normal pl-1">{me.description || 'No custom notes logged.'}</p>
                      <div className="flex items-center gap-3 pt-1 text-[10px] pl-1 text-gray-400 font-medium">
                        <span>Logged by user ID: <strong className="text-gray-600">{me.loggedById}</strong></span>
                        <span>•</span>
                        <a href={me.evidenceUrl} target="_blank" rel="noreferrer" className="text-ocean-600 hover:underline flex items-center gap-0.5 font-bold cursor-pointer">
                          <Download className="w-3 h-3 text-ocean-400" /><span>View Evidence Proof</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Escrow Ledger Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
              <Coins className="w-5 h-5 text-ocean-400" /><span>Multi-Signature Escrow Locker</span>
            </h3>

            <div className="text-center py-4 bg-sand-50 rounded-xl border border-sand-200 space-y-1">
              <span className="text-[10px] text-gray-400 font-mono font-bold block uppercase tracking-wide">SECURED FUNDS</span>
              <strong className="text-3xl text-maritime-900 font-black font-mono block">${shipment.totalValueUSD?.toLocaleString()} USDC</strong>
              {shipment.shipmentScope === 'NATIONWIDE' && (
                <span className="text-[10px] text-ocean-600 block italic font-medium">₱{(shipment.totalValueUSD * 58.7).toLocaleString()} PHP indicative rate</span>
              )}
            </div>

            {/* Stellar progress indicator */}
            {stellarWorking && stellarStep && (
              <div className="bg-maritime-50 border border-maritime-100 rounded-xl p-3 flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-maritime-400 animate-spin flex-shrink-0" />
                <p className="text-[11px] text-maritime-700 leading-snug">{stellarStep}</p>
              </div>
            )}

            {/* Tx hash link */}
            {stellarHash && stellarHash.length > 20 && (
              <a href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${stellarHash}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-ocean-600 font-mono hover:underline break-all">
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                {stellarHash.substring(0, 16)}…{stellarHash.substring(stellarHash.length - 8)}
              </a>
            )}

            <div className="text-xs space-y-4">
              <div className="flex justify-between items-center bg-sand-100 p-2.5 rounded border border-sand-200 font-mono text-[11px]">
                <span className="text-gray-400">LEDGER STATUS:</span>
                <strong className={`font-bold ${shipment.escrowStatus === 'RELEASED' ? 'text-ocean-600' : 'text-maritime-900'}`}>
                  {shipment.escrowStatus}
                </strong>
              </div>

              {/* UNFUNDED */}
              {shipment.escrowStatus === 'UNFUNDED' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-500 leading-normal">
                    The exporter has counter-signed terms. Authorize the funds transfer from your Stellar account to open container assignments.
                  </p>
                  <button onClick={handleFundEscrow} disabled={stellarWorking}
                    className="w-full bg-maritime-400 hover:bg-maritime-900 text-white font-bold py-2.5 rounded-lg text-xs leading-none cursor-pointer uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5">
                    <Unlock className="w-4 h-4" />
                    <span>{stellarWorking ? 'Locking multisig hashes...' : 'Authorize Escrow Lock'}</span>
                  </button>
                </div>
              )}

              {/* FUNDED */}
              {shipment.escrowStatus === 'FUNDED' && (
                <div className="space-y-4">
                  <div className="bg-ocean-50 border border-ocean-100 text-ocean-600 p-3 rounded-lg leading-normal flex items-start gap-1.5 text-[11px]">
                    <Lock className="w-4 h-4 text-ocean-400 flex-shrink-0 mt-0.5" />
                    <span>USDC stablecoin is securely locked on the public Stellar ledger under Multi-sign custody.</span>
                  </div>

                  {/* Freighter wallet connect (needed to sign release) */}
                  {!freighter.publicKey && (
                    <button onClick={freighter.connect} disabled={freighter.connecting}
                      className="w-full flex items-center justify-center gap-1.5 border border-maritime-200 bg-maritime-50 hover:bg-maritime-100 text-maritime-900 font-bold py-2 rounded-lg text-xs transition-all">
                      <Wallet className="w-3.5 h-3.5" />
                      {freighter.connecting ? 'Connecting…' : 'Connect Freighter to Release Funds'}
                    </button>
                  )}

                  {/* Release trigger */}
                  <div className="pt-2">
                    {releaseEligible ? (
                      <div className="space-y-2">
                        <div className="p-3 bg-ocean-50 border border-ocean-100 rounded text-ocean-600 font-bold block text-center">
                          ✓ All Priority Milestone Signoffs Met!
                        </div>
                        <button onClick={() => setReleaseOpen(true)} disabled={stellarWorking}
                          className="w-full bg-ocean-600 hover:bg-ocean-400 text-white font-black py-2.5 rounded-lg text-xs cursor-pointer shadow-sm uppercase tracking-widest transition-all disabled:opacity-50">
                          Execute Escrow Payout
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center bg-sand-100 p-3 rounded border border-sand-200">
                        <Clock className="w-4 h-4 text-coral-400 mx-auto mb-1 animate-pulse" />
                        <span className="font-semibold block text-[11px] text-gray-700">payout lock active</span>
                        <span className="text-[10px] text-gray-400 block leading-normal">Release button triggers automatically once all priority milestones (Customs Entries &amp; Signoffs) are verified on-chain.</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button onClick={handleCancelShipment}
                      className="flex-1 border border-sand-300 hover:border-coral-400 text-gray-500 hover:text-coral-600 py-1.5 rounded text-center font-bold text-[10px] uppercase transition-all">
                      Request Refund
                    </button>
                  </div>
                </div>
              )}

              {/* RELEASED */}
              {shipment.escrowStatus === 'RELEASED' && (
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl leading-normal space-y-2 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="font-bold">Stellar Multi-sign Escrow Finalized!</p>
                  <p>The contract has completed successfully. ${shipment.totalValueUSD?.toLocaleString()} USDC has been securely routed directly to the Exporter&apos;s wallet account.</p>
                  {stellarHash && stellarHash.length > 20 && (
                    <a href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${stellarHash}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] text-green-600 font-mono hover:underline">
                      <ExternalLink className="w-3 h-3" /> View on Stellar Explorer
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOC Vault Documents Centre */}
      <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-sand-100 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-coral-400" /><span>BOC Vault Documents Centre</span>
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Encrypted compliance files attached to this shipment.</p>
          </div>
          <button onClick={handleUploadBOCClick}
            className="bg-maritime-50 hover:bg-maritime-900 border border-maritime-200 text-maritime-900 hover:text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shrink-0">
            <FolderLock className="w-4 h-4" /><span>Upload BOC Document</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs font-mono">NO ENCRYPTED CARGO FILES IN THE BOC HUB.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {documents.map((doc) => {
              const ext = doc.fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
              const extColorMap: Record<string, string> = {
                PDF: 'bg-red-100 text-red-600', XLSX: 'bg-green-100 text-green-700',
                XLS: 'bg-green-100 text-green-700', DOCX: 'bg-blue-100 text-blue-700',
              };
              const extClass = extColorMap[ext] ?? 'bg-gray-100 text-gray-500';
              return (
                <div key={doc.id} className="border border-sand-200 p-4 rounded-xl space-y-3 bg-sand-50/50 flex flex-col justify-between">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <FileText className="w-7 h-7 text-maritime-300 shrink-0 mt-0.5" />
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${extClass}`}>{ext}</span>
                    </div>
                    <strong className="font-bold text-maritime-900 block truncate text-[11px]" title={doc.fileName}>{doc.fileName}</strong>
                    <span className="text-[10px] text-gray-400 block font-mono">{new Date(doc.createdAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="bg-sand-200 text-gray-600 px-1.5 rounded font-mono">v{doc.version}</span>
                      {doc.version > 1 && <span className="bg-amber-100 text-amber-700 font-bold px-1.5 rounded uppercase text-[8px]">Amended</span>}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-sand-200">
                    <button onClick={handleOpenVaultFolder} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-maritime-400 hover:text-maritime-900 transition-colors">
                      <Eye className="w-3 h-3" /><span>View in Vault</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {documents.length > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-sand-100">
            <p className="text-[10px] text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3" /> Downloads require BOC Vault authorization.</p>
            <button onClick={handleOpenVaultFolder} className="text-[10px] text-maritime-400 hover:text-maritime-900 font-bold flex items-center gap-1 transition-colors">
              <FolderLock className="w-3 h-3" /> Open Vault Folder
            </button>
          </div>
        )}
      </div>

      {/* BOC AUTHORIZATION GATE MODAL */}
      {bocAuthOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-sand-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0"><Lock className="w-5 h-5 text-red-500" /></div>
              <div>
                <h3 className="font-extrabold text-sm text-maritime-900">BOC Vault Access Denied</h3>
                <p className="text-[10px] text-gray-400 font-mono uppercase">{currentUser.jobRole}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Your current role (<strong className="uppercase text-maritime-900">{currentUser.jobRole}</strong>) does not have clearance to access the Bureau of Customs Document Vault. Only Trade Party members and Customs Brokers may upload or view vault documents.
            </p>
            <div className="text-[11px] bg-sand-50 border border-sand-100 rounded-lg p-3 text-gray-500 leading-relaxed">
              💡 Switch to an <strong>Importer</strong>, <strong>Exporter</strong>, or <strong>Customs Broker</strong> profile via the toolbar to access the vault.
            </div>
            <div className="flex justify-end pt-1">
              <button onClick={() => setBocAuthOpen(false)} className="px-4 py-2 bg-maritime-400 hover:bg-maritime-900 text-white rounded-lg font-bold text-xs transition-all">Understood</button>
            </div>
          </div>
        </div>
      )}

      {/* ESCROW RELEASE MODAL */}
      {releaseOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-sand-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-sm text-maritime-900 uppercase tracking-tight">Stellar Escrow Release Consent</h3>
            <p className="text-[11px] text-gray-500 leading-normal">
              You are authorizing the immediate release of locked USDC via the Soroban escrow contract. Freighter will prompt you to sign the release transaction. Upload a signed handoff receipt first.
            </p>

            {/* Freighter status in modal */}
            {freighter.publicKey ? (
              <div className="flex items-center gap-2 bg-ocean-50 border border-ocean-100 rounded-lg px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-ocean-400 flex-shrink-0" />
                <span className="font-mono text-[10px] text-maritime-900 truncate">{freighter.publicKey}</span>
              </div>
            ) : (
              <button onClick={freighter.connect} disabled={freighter.connecting}
                className="w-full flex items-center justify-center gap-1.5 bg-maritime-50 border border-maritime-200 text-maritime-900 font-bold py-2 rounded-lg text-xs">
                <Wallet className="w-3.5 h-3.5" />{freighter.connecting ? 'Connecting…' : 'Connect Freighter'}
              </button>
            )}

            {stellarError && (
              <div className="bg-coral-50 border border-coral-200 text-coral-700 text-xs p-2.5 rounded-lg">{stellarError}</div>
            )}
            {stellarWorking && stellarStep && (
              <div className="flex items-center gap-2 text-[11px] text-maritime-700 bg-maritime-50 border border-maritime-100 rounded-lg p-2.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-maritime-400" />{stellarStep}
              </div>
            )}

            <form onSubmit={handleEscrowReleaseSubmit} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="block font-bold text-gray-700">Signed Handoff Receipt (URL)</label>
                <input type="text" required placeholder="https://signoffs.ph/receipt.png"
                  className="w-full border border-sand-200 rounded p-2 text-xs outline-none font-mono"
                  value={releaseProofUrl} onChange={(e) => setReleaseProofUrl(e.target.value)} />
                <button type="button" onClick={() => setReleaseProofUrl('https://picsum.photos/seed/release_sc/800/600')}
                  className="text-[10px] text-ocean-600 underline block">
                  Quick attach handoff photo proof
                </button>
              </div>

              <div className="flex gap-2 justify-end pt-2 text-xs">
                <button type="button" className="px-3 py-1.5 border border-sand-200 rounded-lg text-gray-500"
                  onClick={() => { setReleaseOpen(false); setStellarError(''); }}>
                  Close
                </button>
                <button type="submit" disabled={stellarWorking || !releaseProofUrl}
                  className="px-4 py-1.5 bg-ocean-600 hover:bg-ocean-400 text-white rounded-lg font-black disabled:opacity-50">
                  {stellarWorking ? 'Processing…' : 'Sign & Authorize Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-sand-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-maritime-50 rounded-xl flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-maritime-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-maritime-900">Upload BOC Document</h3>
                <p className="text-[10px] text-gray-400 font-mono uppercase">{shipment.referenceCode}</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 leading-normal">
              Add a compliance document to this shipment&#39;s BOC vault folder. The file will appear in the vault and on this page.
            </p>

            {uploadError && (
              <div className="bg-coral-50 border border-coral-200 text-coral-700 text-xs p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />{uploadError}
              </div>
            )}

            <form onSubmit={handleUploadDocument} className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-gray-700">File Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BOC_Import_Declaration.pdf"
                  className="w-full border border-sand-200 rounded-lg p-2 text-xs outline-none font-mono focus:border-maritime-400"
                  value={uploadFileName}
                  onChange={e => setUploadFileName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block font-bold text-gray-700">File URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://storage.example.com/file.pdf"
                  className="w-full border border-sand-200 rounded-lg p-2 text-xs outline-none font-mono focus:border-maritime-400"
                  value={uploadFileUrl}
                  onChange={e => setUploadFileUrl(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setUploadFileUrl('https://picsum.photos/seed/boc_doc/800/600')}
                  className="text-[10px] text-ocean-600 underline"
                >
                  Quick-attach sample document URL
                </button>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  className="px-3 py-1.5 border border-sand-200 rounded-lg text-gray-500 font-bold"
                  onClick={() => { setUploadOpen(false); setUploadError(''); setUploadFileName(''); setUploadFileUrl(''); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFileName.trim() || !uploadFileUrl.trim()}
                  className="px-4 py-1.5 bg-maritime-400 hover:bg-maritime-900 text-white rounded-lg font-black disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading…</> : <><Upload className="w-3.5 h-3.5" /> Upload</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

