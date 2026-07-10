'use client';

import React, { useEffect, useState, use, useRef } from 'react';
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
  XCircle,
  Scale,
  ShieldAlert,
  Link2,
  Copy,
  Bot,
  TrendingUp,
} from 'lucide-react';
import { Shipment, MilestoneEvent, PriorityMilestone, ShipmentDocument, PHASE_MILESTONE_SEQUENCE, MILESTONE_EVIDENCE_MODE, userHasJobRole } from '@/types';
import { formatAsset } from '@/lib/stellar/assets';
import { getUsdToPhpRate } from '@/lib/stellar/fx';
import { canAccessBOCDocuments } from '@/lib/permissions/documents';
import { getMariTradeEscrowClient, NETWORKS } from '@/lib/stellar/escrow-contract';
import { signXdrWithFreighter } from '@/lib/stellar/freighter';
import PphpWalletPanel from '@/components/PphpWalletPanel';

type PageParams = { id: string };

interface ShipmentDetailProps {
  params: Promise<PageParams>;
}

const STELLAR_NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

// ─── Cancel modal state ──────────────────────────────────────────────────────
type CancelStep =
  | 'idle'
  | 'preparing'       // fetching stage + building XDR
  | 'awaiting_sign'   // waiting for Freighter signing popup
  | 'submitting'      // broadcasting to Stellar
  | 'confirming_db'   // writing result to DB
  | 'done'
  | 'error';

interface CancelState {
  step: CancelStep;
  stage: string;       // UNFUNDED | PRE_DEPARTURE | IN_TRANSIT | DELIVERED
  refundBps: number;
  refundAmount: number;
  requiresDispute: boolean;
  dbOnly: boolean;
  txHash: string;
  error: string;
}

const CANCEL_INITIAL: CancelState = {
  step: 'idle',
  stage: '',
  refundBps: 0,
  refundAmount: 0,
  requiresDispute: false,
  dbOnly: false,
  txHash: '',
  error: '',
};

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

  const [uploadFile,     setUploadFile]     = useState<File | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState('');
  const bocFileInputRef = useRef<HTMLInputElement>(null);

  // ── Cancel modal ────────────────────────────────────────────────────────────
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelState, setCancelState] = useState<CancelState>(CANCEL_INITIAL);
  const [linkCopied, setLinkCopied] = useState(false);
  // Importer's stated reason for a dispute — feeds the AI dispute-evidence
  // summarizer shown on the Admin Dispute Panel.
  const [disputeReasonInput, setDisputeReasonInput] = useState('');

  // ── Phase 2 · AI Delay-Risk Prediction (Logistics Chain only) ───────────
  const [delayRisk, setDelayRisk] = useState<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    reasoning: string;
    recommendedActions: string[];
    historicalStats: { sampleSize: number; holdRate: number | null; disputeRate: number | null; avgClearanceHours: number | null };
  } | null>(null);
  const [delayRiskLoading, setDelayRiskLoading] = useState(false);

  // ── Phase 2 · AI Rate Benchmarking (Freight Forwarders only) ──────────
  const [rateBenchmark, setRateBenchmark] = useState<{
    suggestedFloorUSD: number | null;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    reasoning: string;
    stats: { sampleSize: number; avgFreightCostUSD: number | null; minFreightCostUSD: number | null; maxFreightCostUSD: number | null };
  } | null>(null);
  const [rateBenchmarkLoading, setRateBenchmarkLoading] = useState(false);

  const handleCopyTrackingLink = async () => {
    if (!shipment) return;
    const url = `${window.location.origin}/track/${shipment.referenceCode}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers without clipboard API permission
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const fetchDetails = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    try {
      if (!silent) setLoading(true);
      if (!silent) setErrorText('');
      const res  = await authFetch(`/api/shipments/${shipmentId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        if (silent) setErrorText(''); // clear any earlier error once a poll succeeds
      } else if (!silent) {
        setErrorText(json.error || 'Failed to fetch shipment details');
      }
    } catch {
      // Background polls fail silently — the page just keeps showing the
      // last good data rather than flashing an error banner every 10s.
      if (!silent) setErrorText('Error connecting to central tradeport ledger');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (shipmentId) fetchDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  // ── Phase 2 · AI Delay-Risk Prediction ─────────────────────────────────
  // Logistics Chain-only heads-up: combines platform-wide historical stats
  // for this route with a Gemini read on the cargo. Fetched once the
  // shipment loads, not gated behind a button, since this is meant to
  // surface risk proactively rather than wait for someone to ask.
  useEffect(() => {
    if (!data?.shipment || currentUser?.userType !== 'LOGISTICS_CHAIN') return;
    setDelayRiskLoading(true);
    authFetch('/api/gemini/delay-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId: data.shipment.id }),
    })
      .then(r => r.json())
      .then(json => { if (json.success) setDelayRisk(json.data); })
      .catch(() => {})
      .finally(() => setDelayRiskLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.shipment?.id, currentUser?.userType]);

  // ── Phase 2 · AI Rate Benchmarking ───────────────────────────
  // Freight-Forwarder-only heads-up: combines platform-wide historical
  // freight-cost stats for this route with Gemini's general market read, so
  // a forwarder has a data-backed floor before negotiating with a carrier.
  // Scoped to FREIGHT_FORWARDER specifically (not all Logistics Chain roles)
  // since rate negotiation is that role's job, unlike delay-risk which is
  // useful to brokers and warehouse operators too.
  useEffect(() => {
    if (!data?.shipment || !currentUser) return;
    if (!userHasJobRole(currentUser, 'FREIGHT_FORWARDER')) return;
    setRateBenchmarkLoading(true);
    authFetch('/api/gemini/rate-benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId: data.shipment.id, cargoType: data.shipment.description }),
    })
      .then(r => r.json())
      .then(json => { if (json.success) setRateBenchmark(json.data); })
      .catch(() => {})
      .finally(() => setRateBenchmarkLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.shipment?.id, currentUser?.jobRole, currentUser?.jobRoles]);

  // ── Live milestone log polling ──────────────────────────────────────────
  // Milestones can be logged by other assigned parties (forwarder, broker,
  // warehouse operator) in their own sessions, so this page background-
  // refreshes on an interval to pick those up without needing a manual
  // reload. Paused while the tab is hidden to avoid pointless requests.
  useEffect(() => {
    if (!shipmentId) return;
    const POLL_INTERVAL_MS = 10_000; // 10s
    const tick = () => {
      if (document.visibilityState === 'visible') fetchDetails({ silent: true });
    };
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  const allPriorityCompleted = data?.priorityMilestones?.every(pm => pm.isCompleted) ?? false;

  const hasRealEscrowId = !!data?.shipment?.stellarEscrowId &&
    /^[0-9a-fA-F]{64}$/.test(data.shipment.stellarEscrowId);

  useEffect(() => {
    if (!data?.shipment || data.shipment.escrowStatus !== 'FUNDED') return;
    if (!data.shipment.referenceCode) return;
    if (!hasRealEscrowId) return;

    const walletKey = freighter.publicKey
      ?? process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS
      ?? '';
    if (!walletKey) return;

    setCheckingRelease(true);
    const client = getMariTradeEscrowClient(STELLAR_NETWORK, walletKey);
    client.can_release({ reference_code: data.shipment.referenceCode })
      .then(tx => {
        if (tx.result?.isOk()) setChainCanRelease(tx.result.unwrap());
        else setChainCanRelease(null);
      })
      .catch(() => setChainCanRelease(null))
      .finally(() => setCheckingRelease(false));
    // Intentionally depend on the specific fields we read (not the whole
    // `data.shipment` object) so this doesn't re-fire on every unrelated
    // field update — only when escrow status, ref code, or wallet change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.shipment?.escrowStatus, data?.shipment?.referenceCode, hasRealEscrowId, freighter.publicKey]);

  // ── Fund escrow (mock) ───────────────────────────────────────────────────
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

  // ── Release escrow ───────────────────────────────────────────────────────
  const handleEscrowReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !releaseProofUrl) return;

    setStellarWorking(true);
    setStellarStep('');
    setStellarError('');

    try {
      let importerAddress = freighter.publicKey;
      if (!importerAddress) {
        setStellarStep('Connecting Freighter wallet…');
        try { importerAddress = await freighter.connect(); }
        catch (connErr) {
          setStellarError(`Freighter connection failed: ${connErr instanceof Error ? connErr.message : String(connErr)}`);
          return;
        }
      }
      if (!importerAddress) { setStellarError('No wallet address available. Connect Freighter and try again.'); return; }
      if (!allPriorityCompleted) { setStellarError('Not all required milestones are confirmed yet.'); return; }

      let txHash: string;

      if (hasRealEscrowId) {
        setStellarStep('Building logistics authorization transaction…');
        const platformAddress = process.env.NEXT_PUBLIC_PLATFORM_STELLAR_ADDRESS ?? '';
        const escrowClient = getMariTradeEscrowClient(STELLAR_NETWORK, importerAddress);

        const assignments = data.assignments ?? [];
        const dbWallets: string[] = assignments
          .map((a: any) => a.stellarWallet ?? a.user?.stellarWallet ?? null)
          .filter((w: string | null): w is string => !!w && w.startsWith('G'));
        const users = Array.from(new Set<string>([platformAddress, ...dbWallets])).filter(Boolean);

        let assignLogisticsSignedXdr: string;
        try {
          const assignTx = await escrowClient.assign_logistics_users({
            reference_code: data.shipment.referenceCode,
            importer: importerAddress,
            users,
          });
          setStellarStep('Approve logistics authorization in Freighter…');
          assignLogisticsSignedXdr = await signXdrWithFreighter(
            assignTx.toXDR(),
            NETWORKS[STELLAR_NETWORK].networkPassphrase,
          );
        } catch (assignErr) {
          setStellarError(`Logistics authorization signing failed: ${assignErr instanceof Error ? assignErr.message : String(assignErr)}`);
          return;
        }

        setStellarStep('Executing milestone confirmations on Stellar…');
        const prepRes = await authFetch(`/api/shipments/${data.shipment.id}/escrow-release-prep`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'execute_release', importerAddress, assignLogisticsSignedXdr }),
        });
        const prepJson = await prepRes.json();
        if (!prepJson.success) { setStellarError(prepJson.error || 'Release preparation failed.'); return; }

        const { releaseXdr } = prepJson.data;
        if (!releaseXdr) { setStellarError('Server did not return a release transaction to sign.'); return; }

        setStellarStep('Approve escrow release in Freighter…');
        let releaseSignedXdr: string;
        try {
          releaseSignedXdr = await signXdrWithFreighter(releaseXdr, NETWORKS[STELLAR_NETWORK].networkPassphrase);
        } catch (signErr) {
          setStellarError(`Release signing failed: ${signErr instanceof Error ? signErr.message : String(signErr)}`);
          return;
        }

        setStellarStep('Broadcasting release to Stellar…');
        const releaseRes = await authFetch(`/api/shipments/${data.shipment.id}/escrow-release-prep`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'submit_release', importerAddress, releaseSignedXdr }),
        });
        const releaseJson = await releaseRes.json();
        if (!releaseJson.success) { setStellarError(releaseJson.error || 'Release transaction failed.'); return; }
        txHash = releaseJson.data.txHash;
      } else {
        setStellarStep('Processing escrow release…');
        await new Promise(r => setTimeout(r, 1200));
        txHash = 'db_release_' + Math.random().toString(36).substring(2, 11);
      }

      setStellarHash(txHash);
      setStellarStep('Updating shipment record…');
      const res = await authFetch(`/api/shipments/${data.shipment.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RELEASE_ESCROW', evidenceUrl: releaseProofUrl, txHash }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setReleaseOpen(false);
        setReleaseProofUrl('');
        fetchDetails();
      } else {
        setStellarError(resJson.error || 'DB update failed after release.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Release transaction failed.';
      setStellarError(
        msg.includes('#3') || msg.includes('NotImporter') ? 'Wrong wallet connected. Connect the importer Freighter wallet and try again.' :
        msg.includes('#16') || msg.includes('PriorityMilestonesIncomplete') ? 'On-chain milestone gate not satisfied yet.' :
        msg.includes('#9') || msg.includes('NotFunded') ? 'Escrow is not in a funded state on-chain.' :
        msg.includes('#17') || msg.includes('AlreadySettled') ? 'Escrow has already been released or refunded on-chain.' :
        msg
      );
    } finally {
      setStellarWorking(false);
      setStellarStep('');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  CANCEL FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  const openCancelModal = () => {
    setCancelState(CANCEL_INITIAL);
    setDisputeReasonInput('');
    setCancelOpen(true);
  };

  /** Step 1: call prepare_cancel to learn the stage and get the XDR. */
  const handlePrepareCancel = async () => {
    if (!data) return;

    let importerAddress = freighter.publicKey;
    if (!importerAddress) {
      setCancelState(s => ({ ...s, step: 'preparing', error: '' }));
      try { importerAddress = await freighter.connect(); }
      catch (err) {
        setCancelState(s => ({
          ...s, step: 'error',
          error: `Wallet connection failed: ${err instanceof Error ? err.message : String(err)}`,
        }));
        return;
      }
    }

    setCancelState(s => ({ ...s, step: 'preparing', error: '' }));

    try {
      const res = await authFetch(`/api/shipments/${data.shipment.id}/escrow-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prepare_cancel', importerAddress }),
      });
      const json = await res.json();
      if (!json.success) {
        setCancelState(s => ({ ...s, step: 'error', error: json.error || 'Preparation failed.' }));
        return;
      }

      const { cancelXdr, stage, refundBps, refundAmount, requiresDispute, dbOnly } = json.data;

      if (requiresDispute) {
        // IN_TRANSIT: redirect to dispute flow inside the modal
        setCancelState(s => ({ ...s, step: 'idle', stage, requiresDispute: true, refundBps: 0, refundAmount: 0 }));
        return;
      }

      if (dbOnly) {
        // No Stellar config or chain unreachable — confirm immediately in DB
        setCancelState(s => ({ ...s, step: 'confirming_db', stage, refundBps, refundAmount, dbOnly: true }));
        await handleConfirmCancelDB(data.shipment.id, undefined);
        return;
      }

      // Have XDR — need Freighter signature
      setCancelState(s => ({ ...s, step: 'awaiting_sign', stage, refundBps, refundAmount, dbOnly: false }));

      // Sign with Freighter
      let cancelSignedXdr: string;
      try {
        setCancelState(s => ({ ...s, step: 'awaiting_sign' }));
        cancelSignedXdr = await signXdrWithFreighter(
          cancelXdr,
          NETWORKS[STELLAR_NETWORK].networkPassphrase,
        );
      } catch (signErr) {
        const msg = signErr instanceof Error ? signErr.message : String(signErr);
        if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('reject')) {
          setCancelState(s => ({ ...s, step: 'idle', error: '' })); // user dismissed
        } else {
          setCancelState(s => ({ ...s, step: 'error', error: `Signing failed: ${msg}` }));
        }
        return;
      }

      // Submit signed XDR to server
      setCancelState(s => ({ ...s, step: 'submitting' }));
      const submitRes = await authFetch(`/api/shipments/${data.shipment.id}/escrow-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_cancel', cancelSignedXdr }),
      });
      const submitJson = await submitRes.json();
      if (!submitJson.success) {
        setCancelState(s => ({ ...s, step: 'error', error: submitJson.error || 'Submission failed.' }));
        return;
      }

      const confirmedHash = submitJson.data.txHash;
      await handleConfirmCancelDB(data.shipment.id, confirmedHash);

    } catch (err: any) {
      setCancelState(s => ({
        ...s, step: 'error',
        error: err?.message ?? 'An unexpected error occurred during cancellation.',
      }));
    }
  };

  /** Sync DB after on-chain cancel is confirmed. */
  const handleConfirmCancelDB = async (shipId: string, confirmedHash: string | undefined) => {
    setCancelState(s => ({ ...s, step: 'confirming_db' }));
    try {
      const res = await authFetch(`/api/shipments/${shipId}/escrow-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_cancel', txHash: confirmedHash }),
      });
      const json = await res.json();
      if (json.success) {
        setCancelState(s => ({ ...s, step: 'done', txHash: confirmedHash ?? '' }));
        fetchDetails();
      } else {
        setCancelState(s => ({ ...s, step: 'error', error: json.error || 'DB update failed.' }));
      }
    } catch (err: any) {
      setCancelState(s => ({ ...s, step: 'error', error: err?.message ?? 'Failed to update shipment record.' }));
    }
  };

  /** Raise dispute (IN_TRANSIT path). Mirrors the cancel flow: prepare → sign → submit → confirm. */
  const handleRaiseDispute = async () => {
    if (!data) return;

    let importerAddress = freighter.publicKey;
    if (!importerAddress) {
      setCancelState(s => ({ ...s, step: 'preparing', error: '' }));
      try { importerAddress = await freighter.connect(); }
      catch (err) {
        setCancelState(s => ({
          ...s, step: 'error',
          error: `Wallet connection failed: ${err instanceof Error ? err.message : String(err)}`,
        }));
        return;
      }
    }

    setCancelState(s => ({ ...s, step: 'preparing', error: '' }));

    try {
      // Step 1: prepare — get the raise_dispute() XDR (or a dbOnly fallback)
      const res = await authFetch(`/api/shipments/${data.shipment.id}/escrow-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'raise_dispute', importerAddress }),
      });
      const json = await res.json();
      if (!json.success) {
        setCancelState(s => ({ ...s, step: 'error', error: json.error || 'Failed to raise dispute.' }));
        return;
      }

      const { disputeXdr, dbOnly } = json.data;

      if (dbOnly) {
        setCancelState(s => ({ ...s, step: 'confirming_db' }));
        await handleConfirmRaiseDisputeDB(data.shipment.id, undefined);
        return;
      }

      // Step 2: sign with Freighter (importer-only — no platform co-sign needed)
      setCancelState(s => ({ ...s, step: 'awaiting_sign' }));
      let disputeSignedXdr: string;
      try {
        disputeSignedXdr = await signXdrWithFreighter(
          disputeXdr,
          NETWORKS[STELLAR_NETWORK].networkPassphrase,
        );
      } catch (signErr) {
        const msg = signErr instanceof Error ? signErr.message : String(signErr);
        if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('reject')) {
          setCancelState(s => ({ ...s, step: 'idle', error: '' })); // user dismissed
        } else {
          setCancelState(s => ({ ...s, step: 'error', error: `Signing failed: ${msg}` }));
        }
        return;
      }

      // Step 3: submit the signed XDR
      setCancelState(s => ({ ...s, step: 'submitting' }));
      const submitRes = await authFetch(`/api/shipments/${data.shipment.id}/escrow-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_raise_dispute', disputeSignedXdr }),
      });
      const submitJson = await submitRes.json();
      if (!submitJson.success) {
        setCancelState(s => ({ ...s, step: 'error', error: submitJson.error || 'Submission failed.' }));
        return;
      }

      // Step 4: confirm — sync DB + notify
      const confirmedHash = submitJson.data.txHash;
      await handleConfirmRaiseDisputeDB(data.shipment.id, confirmedHash);

    } catch (err: any) {
      setCancelState(s => ({ ...s, step: 'error', error: err?.message ?? 'Failed to raise dispute.' }));
    }
  };

  /** Sync DB after on-chain raise_dispute is confirmed (or for DB-only). */
  const handleConfirmRaiseDisputeDB = async (shipId: string, confirmedHash: string | undefined) => {
    setCancelState(s => ({ ...s, step: 'confirming_db' }));
    try {
      const res = await authFetch(`/api/shipments/${shipId}/escrow-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_raise_dispute', txHash: confirmedHash, disputeReason: disputeReasonInput }),
      });
      const json = await res.json();
      if (json.success) {
        setCancelState(s => ({ ...s, step: 'done', txHash: confirmedHash ?? '' }));
        fetchDetails();
      } else {
        setCancelState(s => ({ ...s, step: 'error', error: json.error || 'DB update failed.' }));
      }
    } catch (err: any) {
      setCancelState(s => ({ ...s, step: 'error', error: err?.message ?? 'Failed to update shipment record.' }));
    }
  };

  // ── Upload document handlers ─────────────────────────────────────────────
  const handleUploadBOCClick = () => {
    if (!currentUser) return;
    const hasAccess = canAccessBOCDocuments(currentUser.jobRole);
    if (!hasAccess) { setBocAuthOpen(true); return; }
    setUploadOpen(true);
  };

  const handleOpenVaultFolder = () => {
    if (data?.vaultFolderId) router.push(`/documents/${data.vaultFolderId}`);
    else router.push('/documents');
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !uploadFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      // 1. Upload file to vault-documents bucket via the vault folder API
      if (!data.vaultFolderId) {
        setUploadError('No vault folder found for this shipment.');
        return;
      }
      const res = await authFetch(`/api/vault/folders/${data.vaultFolderId}/documents`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (json.success) {
        setUploadOpen(false);
        setUploadFile(null);
        if (bocFileInputRef.current) bocFileInputRef.current.value = '';
        fetchDetails();
      } else {
        setUploadError(json.error || 'Upload failed.');
      }
    } catch {
      setUploadError('Network error — please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Render guards ────────────────────────────────────────────────────────
  if (sessionLoading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-24 bg-white rounded-3xl border border-mist">
          <div className="w-10 h-10 border-4 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs text-ink-faint font-sans">LOADING TRUST ENGINE METRICS FOR CARGO {shipmentId}...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (errorText || !data) {
    return (
      <DashboardLayout>
        <div className="bg-white border border-mist p-8 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-wine mx-auto" />
          <h2 className="text-lg font-bold text-ink">Shipment Details Unreachable</h2>
          <p className="text-xs text-ink-faint max-w-sm mx-auto">{errorText || 'Unknown error occurred.'}</p>
          <div className="pt-2">
            <button onClick={() => router.push('/shipments')} className="bg-amber text-white text-xs font-bold px-4 py-2 rounded-lg">
              Return to Catalog
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const { shipment, milestones, priorityMilestones: rawPriorityMilestones, documents, assignments, vaultFolderId } = data;

  const MILESTONE_ORDER = Object.values(PHASE_MILESTONE_SEQUENCE).flat();
  const priorityMilestones = [...rawPriorityMilestones].sort((a, b) => {
    const ai = MILESTONE_ORDER.indexOf(a.type);
    const bi = MILESTONE_ORDER.indexOf(b.type);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });

  const releaseEligible = allPriorityCompleted ? true : (chainCanRelease === true);

  const isImporter = currentUser.id === shipment.importerId;

  // Stage label for the cancel banner — uses the shipment's actual escrow asset
  const escrowAsset = (shipment.escrowAsset ?? 'USDC') as 'USDC' | 'PPHP';
  const cancelStageLabel: Record<string, string> = {
    UNFUNDED: 'Full refund — escrow not yet funded',
    PRE_DEPARTURE: `Partial refund (${cancelState.refundBps / 100}% = ${formatAsset(cancelState.refundAmount, escrowAsset)})`,
    IN_TRANSIT: 'Disputed — arbitration required',
  };

  return (
    <DashboardLayout>
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <button onClick={() => router.push('/shipments')} className="flex items-center gap-1.5 text-xs text-amber hover:text-ink font-medium cursor-pointer">
            <ChevronLeft className="w-4 h-4" /><span>Back to Shipments</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight font-sans break-words">{shipment.referenceCode}</h1>
          <p className="text-xs text-ink-faint">Cargo Item: <strong className="text-ink-faint font-semibold">{shipment.description}</strong></p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-ink text-white font-bold px-3 py-1 rounded-full uppercase">{shipment.shipmentScope}</span>
          {currentUser.userType === 'LOGISTICS_CHAIN' && (
            <button onClick={() => router.push(`/shipments/${shipmentId}/log-milestone`)}
              className="bg-teal hover:bg-steel text-ink font-black px-3 py-1 rounded-full uppercase text-xs flex items-center gap-1 transition-all">
              + Log Milestone
            </button>
          )}
          <span className={`px-3 py-1 rounded-full uppercase font-bold ${
            shipment.status === 'DELIVERED' ? 'bg-teal-light text-teal' :
            shipment.status === 'CANCELLED' ? 'bg-wine-light text-wine' :
            shipment.status === 'DISPUTED'  ? 'bg-wine-light text-wine' :
            'bg-amber-light text-amber'
          }`}>
            {shipment.status?.replace(/_/g, ' ')}
          </span>
          {shipment.stellarEscrowId && hasRealEscrowId && (
            <a href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${shipment.stellarEscrowId}`}
              target="_blank" rel="noreferrer"
              className="bg-steel-light hover:bg-steel-light/70 text-steel-hover border border-steel-light px-3 py-1 rounded-full font-bold flex items-center gap-1 transition-all">
              <span>View On Stellar</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={handleCopyTrackingLink}
            title="Copy the public tracking link for this shipment"
            className="bg-mist-light hover:bg-mist text-ink border border-mist px-3 py-1 rounded-full font-bold flex items-center gap-1 transition-all cursor-pointer">
            {linkCopied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal" />
                <span className="text-teal">Link Copied</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5" />
                <span>Copy Tracking Link</span>
                <Copy className="w-3 h-3 text-ink-faint" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Disputed banner */}
      {shipment.escrowStatus === 'DISPUTED' && (
        <div className="bg-wine-light border border-wine/20 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-wine flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-ink-soft">Escrow Under Dispute</p>
            <p className="text-xs text-wine leading-relaxed">
              This shipment is in arbitration. MariTrade will review the case and contact both parties within 3–5 business days.
              Platform admins can resolve disputes from the{' '}
              <Link href="/admin/disputes" className="underline font-bold">Admin Dispute Panel</Link>.
            </p>
          </div>
        </div>
      )}

      {/* Stellar error banner */}
      {stellarError && (
        <div className="bg-wine-light border border-wine/20 text-wine text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {stellarError}
          <button onClick={() => setStellarError('')} className="ml-auto text-wine hover:text-wine/70">✕</button>
        </div>
      )}

      {/* Phase 2 · AI Delay-Risk Prediction — Logistics Chain only */}
      {currentUser.userType === 'LOGISTICS_CHAIN' && (delayRiskLoading || delayRisk) && (
        <div className={`border rounded-xl p-4 flex items-start gap-3 ${
          delayRisk?.riskLevel === 'HIGH' ? 'bg-wine-light border-wine/20' :
          delayRisk?.riskLevel === 'MEDIUM' ? 'bg-amber-light border-amber/30' :
          'bg-teal-light border-steel-light'
        }`}>
          <Bot className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            delayRisk?.riskLevel === 'HIGH' ? 'text-wine' : delayRisk?.riskLevel === 'MEDIUM' ? 'text-amber' : 'text-steel'
          }`} />
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-ink-soft flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> AI Delay-Risk Prediction
              </p>
              {delayRisk && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide ${
                  delayRisk.riskLevel === 'HIGH' ? 'bg-wine text-white' : delayRisk.riskLevel === 'MEDIUM' ? 'bg-amber text-white' : 'bg-teal text-ink'
                }`}>{delayRisk.riskLevel} RISK</span>
              )}
            </div>
            {delayRiskLoading ? (
              <p className="text-xs text-ink-faint italic flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Checking route history and customs risk…</p>
            ) : delayRisk ? (
              <>
                <p className="text-xs text-ink-faint leading-relaxed">{delayRisk.reasoning}</p>
                {delayRisk.recommendedActions.length > 0 && (
                  <ul className="text-[11px] text-ink-faint space-y-0.5 pl-4 list-disc">
                    {delayRisk.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                )}
                <p className="text-[9px] text-ink-faint/70">
                  Based on {delayRisk.historicalStats.sampleSize} prior MariTrade shipment{delayRisk.historicalStats.sampleSize === 1 ? '' : 's'} on this exact route.
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Phase 2 · AI Rate Benchmarking — Freight Forwarders only */}
      {currentUser && userHasJobRole(currentUser, 'FREIGHT_FORWARDER') && (rateBenchmarkLoading || rateBenchmark) && (
        <div className="border rounded-xl p-4 flex items-start gap-3 bg-steel-light border-steel-light">
          <Bot className="w-5 h-5 flex-shrink-0 mt-0.5 text-steel" />
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-ink-soft flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" /> AI Rate Benchmark
              </p>
              {rateBenchmark && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide bg-steel text-white">
                  {rateBenchmark.confidence} CONFIDENCE
                </span>
              )}
            </div>
            {rateBenchmarkLoading ? (
              <p className="text-xs text-ink-faint italic flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Checking route freight history and market rates…</p>
            ) : rateBenchmark ? (
              <>
                {rateBenchmark.suggestedFloorUSD != null && (
                  <p className="text-lg font-black text-ink font-sans">
                    ${rateBenchmark.suggestedFloorUSD.toLocaleString()} <span className="text-xs font-bold text-ink-faint">suggested negotiating floor</span>
                  </p>
                )}
                <p className="text-xs text-ink-faint leading-relaxed">{rateBenchmark.reasoning}</p>
                <p className="text-[9px] text-ink-faint/70">
                  Based on {rateBenchmark.stats.sampleSize} prior MariTrade shipment{rateBenchmark.stats.sampleSize === 1 ? '' : 's'} with a recorded freight cost on this exact route.
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* Milestone Timeline */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-6">
            <h3 className="font-extrabold text-sm text-ink tracking-tight flex items-center gap-2">
              <Ship className="w-5 h-5 text-amber" /><span>Milestone Tracking &amp; Signoffs</span>
            </h3>

            <div className="bg-mist-light p-4 rounded-xl border border-mist space-y-3">
              <h4 className="text-xs font-bold text-ink-faint uppercase tracking-wider font-sans">Escrow Release Requirements</h4>
              <div className="space-y-2">
                {priorityMilestones.map((pm) => (
                  <div key={pm.id} className="flex items-center gap-2.5 text-xs text-ink-faint">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${pm.isCompleted ? 'bg-teal text-ink' : 'bg-amber-light text-amber animate-pulse'}`}>
                      {pm.isCompleted ? '✓' : '●'}
                    </span>
                    <span className="font-bold uppercase tracking-tight">{pm.type.replace(/_/g, ' ')}</span>
                    <span className="text-ink-faint">({pm.isCompleted ? 'CONFIRMED' : 'AWAITING SIGNOFF'})</span>
                  </div>
                ))}
              </div>
              {checkingRelease && (
                <div className="flex items-center gap-1.5 text-[10px] text-steel pt-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Checking on-chain release status…
                </div>
              )}
              {hasRealEscrowId && chainCanRelease !== null && !checkingRelease && (
                <div className={`text-[10px] font-bold pt-1 flex items-center gap-1 ${allPriorityCompleted || chainCanRelease ? 'text-steel' : 'text-wine'}`}>
                  {allPriorityCompleted || chainCanRelease
                    ? '✓ All priority milestones confirmed — payout unlocked'
                    : '⊘ On-chain gate: pending milestone confirmations'}
                </div>
              )}
              {!hasRealEscrowId && !checkingRelease && (
                <div className={`text-[10px] font-bold pt-1 flex items-center gap-1 ${allPriorityCompleted ? 'text-steel' : 'text-wine'}`}>
                  {allPriorityCompleted ? '✓ All priority milestones confirmed — payout unlocked' : '⊘ Awaiting milestone confirmations — payout locked'}
                </div>
              )}
            </div>

            {milestones.length === 0 ? (
              <div className="text-center py-12 text-ink-faint text-xs font-sans">AWAITING INITIAL FORWARDING AND BOOKING MILESTONES.</div>
            ) : (
              <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-mist">
                {milestones.map((me) => {
                  const isPriority = priorityMilestones.some(pm => pm.type === me.type);
                  return (
                    <div key={me.id} className="relative space-y-1 text-xs">
                      <span className={`absolute -left-[22.5px] top-1 w-4 h-4 rounded-full border-2 border-white ring-4 inline-block ${isPriority ? 'bg-teal ring-teal-light' : 'bg-mist ring-mist-light'}`} />
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <strong className="font-bold text-ink text-xs font-sans uppercase">{me.type.replace(/_/g, ' ')}</strong>
                        <span className="text-[10px] text-ink-faint font-sans">{new Date(me.occurredAt).toLocaleString()}</span>
                      </div>
                      <p className="text-ink-faint leading-normal pl-1">{me.description || 'No custom notes logged.'}</p>
                      <div className="flex items-center gap-3 pt-1 text-[10px] pl-1 text-ink-faint font-medium">
                        <span>Logged by user ID: <strong className="text-ink-faint">{me.loggedById}</strong></span>
                        <span>•</span>
                        {me.evidenceUrl ? (
                          <a href={me.evidenceUrl} target="_blank" rel="noreferrer" className="text-steel hover:underline flex items-center gap-0.5 font-bold cursor-pointer">
                            <Download className="w-3 h-3 text-teal" /><span>View Evidence</span>
                          </a>
                        ) : me.evidenceRef ? (
                          <span className="flex items-center gap-1 font-sans text-ink-soft bg-amber-light border border-amber-light px-2 py-0.5 rounded">
                            <span className="text-amber">#</span>{me.evidenceRef}
                          </span>
                        ) : null}
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
          <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-ink flex items-center gap-2 border-b border-mist-light pb-3">
              <Coins className="w-5 h-5 text-teal" /><span>Multi-Signature Escrow Locker</span>
            </h3>

            <div className="text-center py-4 bg-mist-light rounded-xl border border-mist space-y-1">
              <span className="text-[10px] text-ink-faint font-sans font-bold block uppercase tracking-wide">SECURED FUNDS</span>
              <strong className="text-3xl text-ink font-black font-sans block">{formatAsset(shipment.totalValueUSD ?? 0, 'USDC')}</strong>
              {shipment.shipmentScope === 'NATIONWIDE' && (
                <PhpEquivLabel usdcAmount={shipment.totalValueUSD ?? 0} />
              )}
            </div>

            {stellarWorking && stellarStep && (
              <div className="bg-amber-light border border-amber-light rounded-xl p-3 flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-amber animate-spin flex-shrink-0" />
                <p className="text-[11px] text-ink-soft leading-snug">{stellarStep}</p>
              </div>
            )}

            {stellarHash && stellarHash.length > 20 && (
              <a href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${stellarHash}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-steel font-sans hover:underline break-all">
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                {stellarHash.substring(0, 16)}…{stellarHash.substring(stellarHash.length - 8)}
              </a>
            )}

            <div className="text-xs space-y-4">
              <div className="flex justify-between items-center bg-mist-light p-2.5 rounded border border-mist font-sans text-[11px]">
                <span className="text-ink-faint">LEDGER STATUS:</span>
                <strong className={`font-bold ${
                  shipment.escrowStatus === 'RELEASED'  ? 'text-teal' :
                  shipment.escrowStatus === 'REFUNDED'  ? 'text-steel' :
                  shipment.escrowStatus === 'DISPUTED'  ? 'text-wine' :
                  'text-ink'
                }`}>
                  {shipment.escrowStatus}
                </strong>
              </div>

              {/* UNFUNDED */}
              {shipment.escrowStatus === 'UNFUNDED' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-ink-faint leading-normal">
                    The exporter has counter-signed terms. Authorize the funds transfer from your Stellar account to open container assignments.
                  </p>
                  <button onClick={handleFundEscrow} disabled={stellarWorking}
                    className="w-full bg-amber hover:bg-ink text-white font-bold py-2.5 rounded-lg text-xs leading-none cursor-pointer uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5">
                    <Unlock className="w-4 h-4" />
                    <span>{stellarWorking ? 'Locking multisig hashes...' : 'Authorize Escrow Lock'}</span>
                  </button>
                </div>
              )}

              {/* FUNDED */}
              {shipment.escrowStatus === 'FUNDED' && (
                <div className="space-y-4">
                  <div className="bg-teal-light border border-steel-light text-steel p-3 rounded-lg leading-normal flex items-start gap-1.5 text-[11px]">
                    <Lock className="w-4 h-4 text-teal flex-shrink-0 mt-0.5" />
                    <span>USDC stablecoin is securely locked on the public Stellar ledger under Multi-sign custody.</span>
                  </div>

                  {!freighter.publicKey && (
                    <button onClick={freighter.connect} disabled={freighter.connecting}
                      className="w-full flex items-center justify-center gap-1.5 border border-amber/30 bg-amber-light hover:bg-amber-light/70 text-ink font-bold py-2 rounded-lg text-xs transition-all">
                      <Wallet className="w-3.5 h-3.5" />
                      {freighter.connecting ? 'Connecting…' : 'Connect Freighter to Release Funds'}
                    </button>
                  )}

                  <div className="pt-2">
                    {releaseEligible ? (
                      <div className="space-y-2">
                        <div className="p-3 bg-teal-light border border-steel-light rounded text-steel font-bold block text-center text-xs">
                          ✓ All Priority Milestone Signoffs Met!
                        </div>
                        <button onClick={() => setReleaseOpen(true)} disabled={stellarWorking}
                          className="w-full bg-steel hover:bg-teal text-white font-black py-2.5 rounded-lg text-xs cursor-pointer shadow-sm uppercase tracking-widest transition-all disabled:opacity-50">
                          Execute Escrow Payout
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center bg-mist-light p-3 rounded border border-mist">
                        <Clock className="w-4 h-4 text-wine mx-auto mb-1 animate-pulse" />
                        <span className="font-semibold block text-[11px] text-ink-faint">payout lock active</span>
                        <span className="text-[10px] text-ink-faint block leading-normal">Release button triggers once all priority milestones are verified.</span>
                      </div>
                    )}
                  </div>

                  {/* Cancel / Request Refund button — importer only */}
                  {isImporter && (
                    <div className="pt-2 border-t border-mist-light">
                      <button
                        onClick={openCancelModal}
                        className="w-full flex items-center justify-center gap-1.5 border border-mist-dark hover:border-wine text-ink-faint hover:text-wine py-1.5 rounded text-center font-bold text-[10px] uppercase transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Request Refund / Cancel Shipment
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* DISPUTED */}
              {shipment.escrowStatus === 'DISPUTED' && (
                <div className="bg-wine-light border border-wine/20 text-wine p-4 rounded-xl space-y-2 text-xs">
                  <ShieldAlert className="w-5 h-5 text-wine" />
                  <p className="font-bold">Escrow Under Arbitration</p>
                  <p className="leading-normal">MariTrade is reviewing this dispute. Funds remain locked until a resolution is issued. You will be notified by email once resolved.</p>
                  <Link href="/admin/disputes" className="text-[10px] underline font-bold text-wine flex items-center gap-1">
                    <Scale className="w-3 h-3" /> View Admin Dispute Panel
                  </Link>
                </div>
              )}

              {/* RELEASED */}
              {shipment.escrowStatus === 'RELEASED' && (
                <div className="bg-teal-light border border-teal-light text-teal p-4 rounded-xl space-y-2 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-teal" />
                  <p className="font-bold">Stellar Multi-sign Escrow Finalized!</p>
                  <p>The contract has completed successfully. {formatAsset(shipment.totalValueUSD ?? 0, escrowAsset)} has been routed to the Exporter’s wallet.</p>
                  {stellarHash && stellarHash.length > 20 && (
                    <a href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${stellarHash}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] text-teal font-sans hover:underline">
                      <ExternalLink className="w-3 h-3" /> View on Stellar Explorer
                    </a>
                  )}
                </div>
              )}

              {/* REFUNDED */}
              {shipment.escrowStatus === 'REFUNDED' && (
                <div className="bg-steel-light border border-steel-light text-steel-hover p-4 rounded-xl space-y-2 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-steel" />
                  <p className="font-bold">Escrow Refunded</p>
                  <p className="leading-normal">The cancellation has been processed and {escrowAsset === 'PPHP' ? 'PPHP (PHP-denominated funds)' : 'USDC'} has been returned to the importer per the agreed refund policy.</p>
                  {shipment.stellarEscrowId && hasRealEscrowId && (
                    <a href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${shipment.stellarEscrowId}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] text-steel font-sans hover:underline">
                      <ExternalLink className="w-3 h-3" /> View on Stellar Explorer
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PPHP Wallet Panel — importers only, collapsible */}
      {isImporter && (
        <PphpWalletPanel
          publicKey={freighter.publicKey}
          onConnect={freighter.connect}
        />
      )}

      {/* BOC Vault Documents Centre */}
      <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-mist-light pb-3">
          <h3 className="font-extrabold text-sm text-ink flex items-center gap-2">
            <FileText className="w-5 h-5 text-wine" /><span>BOC Vault Documents Centre</span>
          </h3>
          <p className="text-[10px] text-ink-faint mt-0.5">Encrypted compliance files attached to this shipment.</p>
        </div>
        <button onClick={handleUploadBOCClick}
          className="bg-amber-light hover:bg-ink border border-amber/30 text-ink hover:text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shrink-0">
          <FolderLock className="w-4 h-4" /><span>Upload BOC Document</span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </button>

        {documents.length === 0 ? (
          <div className="text-center py-12 text-ink-faint text-xs font-sans">NO ENCRYPTED CARGO FILES IN THE BOC HUB.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {documents.map((doc) => {
              const ext = doc.fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
              const extColorMap: Record<string, string> = {
                PDF: 'bg-wine-light text-wine', XLSX: 'bg-teal-light text-teal',
                XLS: 'bg-teal-light text-teal', DOCX: 'bg-steel-light text-steel-hover',
              };
              const extClass = extColorMap[ext] ?? 'bg-mist-light text-ink-faint';
              return (
                <div key={doc.id} className="border border-mist p-4 rounded-xl space-y-3 bg-mist-light/50 flex flex-col justify-between">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <FileText className="w-7 h-7 text-amber-light shrink-0 mt-0.5" />
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-sans ${extClass}`}>{ext}</span>
                    </div>
                    <strong className="font-bold text-ink block truncate text-[11px]" title={doc.fileName}>{doc.fileName}</strong>
                    <span className="text-[10px] text-ink-faint block font-sans">{new Date(doc.createdAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="bg-mist text-ink-faint px-1.5 rounded font-sans">v{doc.version}</span>
                      {doc.version > 1 && <span className="bg-amber-light text-amber font-bold px-1.5 rounded uppercase text-[8px]">Amended</span>}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-mist">
                    <button onClick={handleOpenVaultFolder} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-amber hover:text-ink transition-colors">
                      <Eye className="w-3 h-3" /><span>View in Vault</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {documents.length > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-mist-light">
            <p className="text-[10px] text-ink-faint flex items-center gap-1"><Lock className="w-3 h-3" /> Downloads require BOC Vault authorization.</p>
            <button onClick={handleOpenVaultFolder} className="text-[10px] text-amber hover:text-ink font-bold flex items-center gap-1 transition-colors">
              <FolderLock className="w-3 h-3" /> Open Vault Folder
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  CANCEL / REFUND MODAL                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {cancelOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-mist rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-mist-light pb-3">
              <div className="w-10 h-10 bg-wine-light rounded-xl flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 text-wine" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-ink">Cancel Shipment &amp; Request Refund</h3>
                <p className="text-[10px] text-ink-faint font-sans">{shipment.referenceCode}</p>
              </div>
              <button
                onClick={() => setCancelOpen(false)}
                className="ml-auto text-ink-faint hover:text-ink text-lg leading-none"
                disabled={cancelState.step === 'preparing' || cancelState.step === 'submitting' || cancelState.step === 'confirming_db'}
              >✕</button>
            </div>

            {/* ── IDLE / pre-action ──────────────────────────────────────── */}
            {(cancelState.step === 'idle' && !cancelState.requiresDispute) && (
              <div className="space-y-4">
                <div className="bg-amber-light border border-amber/30 rounded-xl p-4 text-xs text-amber space-y-2">
                  <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Cancellation Policy</p>
                  <ul className="space-y-1.5 pl-2 text-[11px] leading-relaxed">
                    <li><strong>Unfunded:</strong> Full refund — escrow has no USDC deposited yet.</li>
                    <li><strong>Pre-Departure:</strong> Partial refund per agreed terms; platform fee applies.</li>
                    <li><strong>In-Transit:</strong> Requires dispute arbitration — MariTrade reviews and splits funds.</li>
                    <li><strong>Delivered:</strong> No cancellation allowed after delivery confirmation.</li>
                  </ul>
                </div>

                {!freighter.publicKey ? (
                  <button
                    onClick={freighter.connect}
                    disabled={freighter.connecting}
                    className="w-full flex items-center justify-center gap-1.5 border border-amber/30 bg-amber-light hover:bg-amber-light/70 text-ink font-bold py-2 rounded-lg text-xs"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    {freighter.connecting ? 'Connecting…' : 'Connect Freighter Wallet First'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-teal-light border border-steel-light rounded-lg px-3 py-2">
                    <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                    <span className="font-sans text-[10px] text-ink truncate">{freighter.publicKey}</span>
                  </div>
                )}

                <p className="text-[10px] text-ink-faint leading-relaxed">
                  Clicking <strong>Proceed with Cancellation</strong> will check the current escrow stage on Stellar,
                  then open a Freighter signing popup. The platform co-signature for PRE_DEPARTURE cancellations
                  is added server-side automatically.
                </p>

                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setCancelOpen(false)} className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold text-xs">
                    Keep Shipment
                  </button>
                  <button
                    onClick={handlePrepareCancel}
                    className="px-4 py-1.5 bg-wine hover:bg-wine/85 text-white rounded-lg font-black text-xs"
                  >
                    Proceed with Cancellation
                  </button>
                </div>
              </div>
            )}

            {/* ── IN_TRANSIT → dispute required ─────────────────────────── */}
            {cancelState.requiresDispute && cancelState.step === 'idle' && (
              <div className="space-y-4">
                <div className="bg-wine-light border border-wine/20 rounded-xl p-4 text-xs text-ink-soft space-y-2">
                  <p className="font-bold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> In-Transit — Dispute Required</p>
                  <p className="text-[11px] leading-relaxed">
                    Your shipment is currently <strong>In Transit</strong>. Direct cancellation is not permitted once
                    the vessel has departed. You must raise a formal dispute which MariTrade will arbitrate.
                    Funds remain locked until a resolution is issued.
                  </p>
                  <p className="text-[10px] text-wine">Resolution typically takes 3–5 business days.</p>
                </div>

                {!freighter.publicKey ? (
                  <button onClick={freighter.connect} disabled={freighter.connecting}
                    className="w-full flex items-center justify-center gap-1.5 border border-amber/30 bg-amber-light hover:bg-amber-light/70 text-ink font-bold py-2 rounded-lg text-xs">
                    <Wallet className="w-3.5 h-3.5" />{freighter.connecting ? 'Connecting…' : 'Connect Freighter Wallet'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-teal-light border border-steel-light rounded-lg px-3 py-2">
                    <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                    <span className="font-sans text-[10px] text-ink truncate">{freighter.publicKey}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-ink-faint uppercase tracking-wide">
                    Reason for dispute (optional, but helps arbitration)
                  </label>
                  <textarea
                    value={disputeReasonInput}
                    onChange={e => setDisputeReasonInput(e.target.value)}
                    rows={3}
                    placeholder="e.g. Cargo arrived with visible water damage on 3 pallets; photos attached to Delivered milestone."
                    className="w-full border border-mist rounded-lg p-2.5 text-xs outline-none font-sans resize-none"
                  />
                  <p className="text-[9px] text-ink-faint">
                    This is shown to MariTrade&apos;s arbitrators and summarized by AI alongside the milestone log — it doesn&apos;t affect the outcome on its own.
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setCancelOpen(false)} className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold text-xs">
                    Cancel
                  </button>
                  <button
                    onClick={handleRaiseDispute}
                    className="px-4 py-1.5 bg-wine hover:bg-wine/85 text-white rounded-lg font-black text-xs flex items-center gap-1.5"
                  >
                    <Scale className="w-3.5 h-3.5" /> File Dispute with MariTrade
                  </button>
                </div>
              </div>
            )}

            {/* ── In-progress steps ──────────────────────────────────────── */}
            {(cancelState.step === 'preparing' || cancelState.step === 'awaiting_sign' || cancelState.step === 'submitting' || cancelState.step === 'confirming_db') && (
              <div className="space-y-4 py-2">
                <div className="space-y-3">
                  {[
                    { key: 'preparing',    label: 'Checking escrow stage on Stellar…' },
                    { key: 'awaiting_sign', label: 'Waiting for Freighter signature…' },
                    { key: 'submitting',   label: 'Broadcasting cancellation to Stellar…' },
                    { key: 'confirming_db', label: 'Updating shipment record…' },
                  ].map(({ key, label }) => {
                    const steps = ['preparing', 'awaiting_sign', 'submitting', 'confirming_db'];
                    const currentIdx = steps.indexOf(cancelState.step);
                    const thisIdx    = steps.indexOf(key);
                    const isDone    = thisIdx < currentIdx;
                    const isCurrent = thisIdx === currentIdx;
                    return (
                      <div key={key} className={`flex items-center gap-3 text-xs ${isDone ? 'text-steel' : isCurrent ? 'text-ink' : 'text-mist-dark'}`}>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] flex-shrink-0 ${
                          isDone    ? 'border-teal bg-teal text-white' :
                          isCurrent ? 'border-amber bg-amber-light' :
                          'border-mist bg-white'
                        }`}>
                          {isDone ? '✓' : isCurrent ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : '·'}
                        </span>
                        <span className={`font-medium ${isCurrent ? 'font-bold' : ''}`}>{label}</span>
                      </div>
                    );
                  })}
                </div>

                {cancelState.stage && (
                  <div className="bg-mist-light border border-mist rounded-lg p-3 text-[11px]">
                    <span className="text-ink-faint">Stage: </span>
                    <strong className="text-ink">{cancelState.stage}</strong>
                    {cancelStageLabel[cancelState.stage] && (
                      <span className="text-ink-faint block mt-0.5">{cancelStageLabel[cancelState.stage]}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Done ──────────────────────────────────────────────────── */}
            {cancelState.step === 'done' && (
              <div className="space-y-4">
                <div className="bg-steel-light border border-steel-light rounded-xl p-5 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-steel mx-auto" />
                  <p className="font-extrabold text-sm text-ink">
                    {cancelState.requiresDispute ? 'Dispute Filed Successfully' : 'Cancellation Complete'}
                  </p>
                  <p className="text-xs text-ink-faint leading-relaxed">
                    {cancelState.requiresDispute
                      ? 'Your dispute has been submitted. MariTrade will review the case and notify you within 3–5 business days.'
                      : `Your ${escrowAsset === 'PPHP' ? 'PPHP' : 'USDC'} refund has been processed on the Stellar ledger. ${cancelState.stage === 'PRE_DEPARTURE' ? `${formatAsset(cancelState.refundAmount, escrowAsset)} has been returned to your wallet.` : 'Full refund confirmed.'}`
                    }
                  </p>
                  {cancelState.txHash && cancelState.txHash.length === 64 && (
                    <a
                      href={`https://stellar.expert/explorer/${STELLAR_NETWORK}/tx/${cancelState.txHash}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-1 text-[10px] text-steel font-sans hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {cancelState.txHash.substring(0, 16)}…{cancelState.txHash.substring(cancelState.txHash.length - 8)}
                    </a>
                  )}
                </div>
                <button onClick={() => setCancelOpen(false)} className="w-full px-4 py-2 bg-amber hover:bg-ink text-white rounded-lg font-black text-xs">
                  Close
                </button>
              </div>
            )}

            {/* ── Error ─────────────────────────────────────────────────── */}
            {cancelState.step === 'error' && (
              <div className="space-y-4">
                <div className="bg-wine-light border border-wine/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-wine flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-xs text-wine">Cancellation Failed</p>
                    <p className="text-[11px] text-wine leading-relaxed">{cancelState.error}</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setCancelOpen(false)} className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold text-xs">
                    Close
                  </button>
                  <button
                    onClick={() => setCancelState(s => ({ ...s, step: 'idle', error: '' }))}
                    className="px-4 py-1.5 bg-wine hover:bg-wine/85 text-white rounded-lg font-black text-xs"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  BOC AUTHORIZATION GATE MODAL                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {bocAuthOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-mist rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-wine-light rounded-xl flex items-center justify-center shrink-0"><Lock className="w-5 h-5 text-wine" /></div>
              <div>
                <h3 className="font-extrabold text-sm text-ink">BOC Vault Access Denied</h3>
                <p className="text-[10px] text-ink-faint font-sans uppercase">{currentUser.jobRole}</p>
              </div>
            </div>
            <p className="text-xs text-ink-faint leading-relaxed">
              Your current role (<strong className="uppercase text-ink">{currentUser.jobRole}</strong>) does not have clearance to access the Bureau of Customs Document Vault. Only Trade Party members and Customs Brokers may upload or view vault documents.
            </p>
            <div className="flex justify-end pt-1">
              <button onClick={() => setBocAuthOpen(false)} className="px-4 py-2 bg-amber hover:bg-ink text-white rounded-lg font-bold text-xs transition-all">Understood</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  ESCROW RELEASE MODAL                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {releaseOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-mist rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-sm text-ink uppercase tracking-tight">Stellar Escrow Release Consent</h3>
            <p className="text-[11px] text-ink-faint leading-normal">
              You are authorizing the immediate release of locked USDC via the Soroban escrow contract. Freighter will prompt you to sign the release transaction. Upload a signed handoff receipt first.
            </p>

            {freighter.publicKey ? (
              <div className="flex items-center gap-2 bg-teal-light border border-steel-light rounded-lg px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                <span className="font-sans text-[10px] text-ink truncate">{freighter.publicKey}</span>
              </div>
            ) : (
              <button onClick={freighter.connect} disabled={freighter.connecting}
                className="w-full flex items-center justify-center gap-1.5 bg-amber-light border border-amber/30 text-ink font-bold py-2 rounded-lg text-xs">
                <Wallet className="w-3.5 h-3.5" />{freighter.connecting ? 'Connecting…' : 'Connect Freighter'}
              </button>
            )}

            {stellarError && (
              <div className="bg-wine-light border border-wine/20 text-wine text-xs p-2.5 rounded-lg">{stellarError}</div>
            )}
            {stellarWorking && stellarStep && (
              <div className="flex items-center gap-2 text-[11px] text-ink-soft bg-amber-light border border-amber-light rounded-lg p-2.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber" />{stellarStep}
              </div>
            )}

            <form onSubmit={handleEscrowReleaseSubmit} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="block font-bold text-ink-faint">Signed Handoff Receipt (URL)</label>
                <input type="text" required placeholder="https://signoffs.ph/receipt.png"
                  className="w-full border border-mist rounded p-2 text-xs outline-none font-sans"
                  value={releaseProofUrl} onChange={(e) => setReleaseProofUrl(e.target.value)} />
                <button type="button" onClick={() => setReleaseProofUrl('https://picsum.photos/seed/release_sc/800/600')}
                  className="text-[10px] text-steel underline block">
                  Quick attach handoff photo proof
                </button>
              </div>

              <div className="flex gap-2 justify-end pt-2 text-xs">
                <button type="button" className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint"
                  onClick={() => { setReleaseOpen(false); setStellarError(''); }}>
                  Close
                </button>
                <button type="submit" disabled={stellarWorking || !releaseProofUrl}
                  className="px-4 py-1.5 bg-steel hover:bg-teal text-white rounded-lg font-black disabled:opacity-50">
                  {stellarWorking ? 'Processing…' : 'Sign & Authorize Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  UPLOAD DOCUMENT MODAL                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-mist rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-light rounded-xl flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-amber" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-ink">Upload BOC Document</h3>
                <p className="text-[10px] text-ink-faint font-sans uppercase">{shipment.referenceCode}</p>
              </div>
            </div>

            {uploadError && (
              <div className="bg-wine-light border border-wine/20 text-wine text-xs p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />{uploadError}
              </div>
            )}

            <form onSubmit={handleUploadDocument} className="space-y-4 text-xs">
              <div
                onClick={() => bocFileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) { setUploadFile(f); setUploadError(''); }
                }}
                className="border-2 border-dashed border-mist-dark hover:border-amber-light hover:bg-amber-light/30 rounded-xl p-6 text-center cursor-pointer transition-colors space-y-2"
              >
                <FileText className="w-8 h-8 text-mist-dark mx-auto" />
                <p className="text-xs font-semibold text-ink-faint">
                  {uploadFile ? uploadFile.name : 'Click or drag & drop a file here'}
                </p>
                {uploadFile && <p className="text-[10px] text-ink-faint">{(uploadFile.size / 1024).toFixed(1)} KB</p>}
                <p className="text-[10px] text-ink-faint">PDF, JPG or PNG · Max 50MB</p>
              </div>
              <input
                ref={bocFileInputRef}
                type="file"
                className="hidden"
                onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadError(''); }}
              />
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="px-3 py-1.5 border border-mist rounded-lg text-ink-faint font-bold"
                  onClick={() => { setUploadOpen(false); setUploadError(''); setUploadFile(null); if (bocFileInputRef.current) bocFileInputRef.current.value = ''; }}>
                  Cancel
                </button>
                <button type="submit" disabled={uploading || !uploadFile}
                  className="px-4 py-1.5 bg-amber hover:bg-ink text-white rounded-lg font-black disabled:opacity-50 flex items-center gap-1.5">
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

// ─── PhpEquivLabel (async PHP equivalent using live FX rate) ─────────────────

function PhpEquivLabel({ usdcAmount }: { usdcAmount: number }) {
  const [label, setLabel] = React.useState<string | null>(null);
  const [live, setLive] = React.useState(false);
  React.useEffect(() => {
    getUsdToPhpRate().then(({ rate, isLive }) => {
      setLabel((usdcAmount * rate).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
      setLive(isLive);
    });
  }, [usdcAmount]);
  if (!label) return null;
  return (
    <span className="text-[10px] text-steel block italic font-medium">
      ₱{label} PHP{!live && ' (est.)'}
    </span>
  );
}
