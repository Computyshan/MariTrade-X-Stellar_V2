'use client';

import React, { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
import { useFreighter } from '@/hooks/use-freighter';
import { useCancelFlow } from '@/hooks/use-cancel-flow';
import { formatEtaCountdown } from '@/lib/eta';
import {
  Clock,
  FileText,
  Lock,
  ChevronLeft,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FolderLock,
  Eye,
  ShieldAlert,
  Link2,
  Copy,
  UserCheck,
  Send,
} from 'lucide-react';
import {
  Shipment, MilestoneEvent, PriorityMilestone, ShipmentDocument, PHASE_MILESTONE_SEQUENCE, userHasJobRole,
  DeliverySignature, SignerRelation, RecipientConfirmation,
} from '@/types';
import Link from 'next/link';
import { canAccessBOCDocuments } from '@/lib/permissions/documents';
import { getMariTradeEscrowClient, NETWORKS } from '@/lib/stellar/escrow-contract';
import { signXdrWithFreighter } from '@/lib/stellar/freighter';
import VesselPositionCard from '@/components/VesselPositionCard';
import IoTReadingsPanel from '@/components/IoTReadingsPanel';
import Phase5IntegrationsPanel from '@/components/Phase5IntegrationsPanel';
import PphpWalletPanel from '@/components/PphpWalletPanel';
import { SignaturePadHandle } from '@/components/SignaturePad';
import { DelayRiskPanel, RateBenchmarkPanel, DelayRisk, RateBenchmark } from '@/components/ShipmentAIInsightPanels';
import ShipmentMilestoneTimeline from '@/components/ShipmentMilestoneTimeline';
import ShipmentEscrowLedger from '@/components/ShipmentEscrowLedger';
import ShipmentCancelModal from '@/components/ShipmentCancelModal';
import { BocAuthDeniedModal, BocUploadModal } from '@/components/BocDocumentModals';
import EscrowReleaseModal from '@/components/EscrowReleaseModal';
import DeliverySignatureModal from '@/components/DeliverySignatureModal';
import RecipientConfirmModal from '@/components/RecipientConfirmModal';

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

  const [uploadFile,     setUploadFile]     = useState<File | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState('');
  const bocFileInputRef = useRef<HTMLInputElement>(null);

  const [linkCopied, setLinkCopied] = useState(false);

  // ── Phase 4 · SLA / ETA countdown surfacing ─────────────────────
  // NOTE: this counts down to `shipment.estimatedArrival`, the only real
  // deadline field on the schema today — the plan doc's "SLA countdown"
  // language ties to a per-milestone bonus deadline from the Phase 2/5
  // escrow-incentive work, which hasn't been built (no such field exists
  // yet). Labeling this as an ETA countdown rather than an "SLA deadline"
  // is deliberate — it shows real data instead of implying a guarantee
  // nothing in the system currently enforces.
  const [etaTick, setEtaTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setEtaTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Phase 2 · AI Delay-Risk Prediction (Logistics Chain only) ───────────
  const [delayRisk, setDelayRisk] = useState<DelayRisk | null>(null);
  const [delayRiskLoading, setDelayRiskLoading] = useState(false);

  // ── Phase 2 · AI Rate Benchmarking (Freight Forwarders only) ──────────
  const [rateBenchmark, setRateBenchmark] = useState<RateBenchmark | null>(null);
  const [rateBenchmarkLoading, setRateBenchmarkLoading] = useState(false);

  // ── Phase 3 · Digital signature capture at delivery ─────────────────────
  const [deliverySignature, setDeliverySignature] = useState<DeliverySignature | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerRelation, setSignerRelation] = useState<SignerRelation>('CONSIGNEE');
  const [signerContact, setSignerContact] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState('');
  const [signatureSubmitting, setSignatureSubmitting] = useState(false);
  const [signatureError, setSignatureError] = useState('');
  const signaturePadRef = useRef<SignaturePadHandle>(null);

  // ── Phase 3 · Recipient-side confirmation flow ───────────────────────────
  const [recipientConfirmations, setRecipientConfirmations] = useState<RecipientConfirmation[]>([]);
  const [recipientConfirmOpen, setRecipientConfirmOpen] = useState(false);
  const [consigneeContact, setConsigneeContact] = useState('');
  const [consigneeName, setConsigneeName] = useState('');
  const [rcSubmitting, setRcSubmitting] = useState(false);
  const [rcError, setRcError] = useState('');
  const [rcJustSentUrl, setRcJustSentUrl] = useState('');

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

  // ── Cancel / dispute flow (escrow-cancel) ───────────────────────────────
  const {
    cancelOpen, setCancelOpen, cancelState, setCancelState,
    disputeReasonInput, setDisputeReasonInput,
    openCancelModal, handlePrepareCancel, handleRaiseDispute,
  } = useCancelFlow({
    shipmentId: data?.shipment?.id,
    networkKey: STELLAR_NETWORK,
    freighter,
    onSettled: fetchDetails,
  });

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchDetails triggers the initial load; loading state is intentional here
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the AI fetch; loading flag is intentional
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the AI fetch; loading flag is intentional
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

  // ── Phase 3 · Load existing delivery signature (if DELIVERED_AND_SIGNED_OFF
  // has already been logged) ──────────────────────────────────────────────
  useEffect(() => {
    const deliveredMilestone = data?.milestones?.find(m => m.type === 'DELIVERED_AND_SIGNED_OFF');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets stale signature when the milestone disappears (e.g. shipment switch)
    if (!deliveredMilestone) { setDeliverySignature(null); return; }
    authFetch(`/api/shipments/${shipmentId}/delivery-signature?milestoneEventId=${deliveredMilestone.id}`)
      .then(r => r.json())
      .then(json => { if (json.success) setDeliverySignature(json.data ?? null); })
      .catch(() => {});
  }, [data?.milestones, shipmentId]);

  // ── Phase 3 · Load recipient confirmation requests for this shipment ────
  useEffect(() => {
    if (!data?.shipment) return;
    authFetch(`/api/shipments/${shipmentId}/recipient-confirmation`)
      .then(r => r.json())
      .then(json => { if (json.success) setRecipientConfirmations(json.data ?? []); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.shipment?.id, shipmentId]);

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

    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the on-chain check; loading flag is intentional
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

  const closeUploadModal = () => {
    setUploadOpen(false);
    setUploadError('');
    setUploadFile(null);
    if (bocFileInputRef.current) bocFileInputRef.current.value = '';
  };

  const handleUploadFileChange = (file: File | null) => {
    setUploadFile(file);
    setUploadError('');
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 3 · DIGITAL SIGNATURE CAPTURE AT DELIVERY
  // ═══════════════════════════════════════════════════════════════════════════

  const openSignatureModal = () => {
    setSignerName('');
    setSignerRelation('CONSIGNEE');
    setSignerContact('');
    setOtpCode('');
    setOtpSent(false);
    setOtpExpiresAt('');
    setSignatureError('');
    signaturePadRef.current?.clear();
    setSignatureOpen(true);
  };

  const handleSignerContactChange = (v: string) => {
    setSignerContact(v);
    setOtpSent(false);
  };

  const handleSendSignatureOtp = async () => {
    if (!data || !currentUser || !signerContact.trim()) return;
    setOtpSending(true);
    setSignatureError('');
    try {
      const res = await authFetch(`/api/shipments/${data.shipment.id}/delivery-signature/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedById: currentUser.id, contact: signerContact.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setOtpSent(true);
        setOtpExpiresAt(json.data.expiresAt);
      } else {
        setSignatureError(json.error || 'Failed to send verification code.');
      }
    } catch {
      setSignatureError('Network error — please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleSubmitSignature = async () => {
    if (!data || !currentUser) return;
    const deliveredMilestone = data.milestones.find(m => m.type === 'DELIVERED_AND_SIGNED_OFF');
    if (!deliveredMilestone) {
      setSignatureError('Log the "Delivered and Signed Off" milestone first, then capture the signature.');
      return;
    }
    if (!signerName.trim()) { setSignatureError('Enter the signer\'s name.'); return; }
    const dataUrl = signaturePadRef.current?.getDataUrl();
    if (!dataUrl) { setSignatureError('Please capture a signature before submitting.'); return; }

    setSignatureSubmitting(true);
    setSignatureError('');
    try {
      const res = await authFetch(`/api/shipments/${data.shipment.id}/delivery-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loggedById: currentUser.id,
          milestoneEventId: deliveredMilestone.id,
          signerName: signerName.trim(),
          signerRelation,
          signatureImageDataUrl: dataUrl,
          contact: signerContact.trim() || undefined,
          otpCode: otpCode.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDeliverySignature(json.data);
        setSignatureOpen(false);
      } else {
        setSignatureError(json.error || 'Failed to save signature.');
      }
    } catch {
      setSignatureError('Network error — please try again.');
    } finally {
      setSignatureSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  PHASE 3 · RECIPIENT-SIDE CONFIRMATION FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  const openRecipientConfirmModal = () => {
    setConsigneeContact('');
    setConsigneeName('');
    setRcError('');
    setRcJustSentUrl('');
    setRecipientConfirmOpen(true);
  };

  const handleRequestRecipientConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !currentUser || !consigneeContact.trim()) return;
    setRcSubmitting(true);
    setRcError('');
    try {
      const res = await authFetch(`/api/shipments/${data.shipment.id}/recipient-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedById: currentUser.id,
          consigneeContact: consigneeContact.trim(),
          consigneeName: consigneeName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRecipientConfirmations(prev => [json.data, ...prev]);
        setRcJustSentUrl(json.data.confirmUrl || '');
        setConsigneeContact('');
        setConsigneeName('');
      } else {
        setRcError(json.error || 'Failed to send confirmation request.');
      }
    } catch {
      setRcError('Network error — please try again.');
    } finally {
      setRcSubmitting(false);
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

  // Mirrors the /api/shipments/[id]/iot-devices POST authorization check —
  // only an assigned logistics chain member or the importer may register a
  // sensor tag against this shipment.
  const canRegisterIoTDevice = isImporter || assignments.some((a: any) => a.userId === currentUser.id);

  const escrowAsset = (shipment.escrowAsset ?? 'USDC') as 'USDC' | 'PPHP';

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
          {/* Phase 4 · SLA/ETA countdown surfacing — live, not a static list */}
          {shipment.estimatedArrival && !['DELIVERED', 'CANCELLED'].includes(shipment.status) && (() => {
            const eta = formatEtaCountdown(shipment.estimatedArrival, etaTick);
            return (
              <p className={`text-[10px] font-bold flex items-center gap-1 ${eta.overdue ? 'text-wine' : 'text-steel'}`}>
                <Clock className="w-3 h-3" />
                {eta.label}
                <span className="text-ink-faint font-normal">
                  · ETA {new Date(shipment.estimatedArrival).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </p>
            );
          })()}
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
      {currentUser.userType === 'LOGISTICS_CHAIN' && (
        <DelayRiskPanel loading={delayRiskLoading} data={delayRisk} />
      )}

      {/* Phase 2 · AI Rate Benchmarking — Freight Forwarders only */}
      {currentUser && userHasJobRole(currentUser, 'FREIGHT_FORWARDER') && (
        <RateBenchmarkPanel loading={rateBenchmarkLoading} data={rateBenchmark} />
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* Milestone Timeline */}
        <div className="lg:col-span-3 space-y-6">
          {/* Phase 3 · Live Vessel Position — only once a Freight Forwarder
              has captured the vessel MMSI (alongside SPACE_ON_VESSEL_SECURED) */}
          {shipment.vesselMmsi && (
            <VesselPositionCard mmsi={shipment.vesselMmsi} vesselName={shipment.vesselName} />
          )}

          <ShipmentMilestoneTimeline
            priorityMilestones={priorityMilestones}
            milestones={milestones}
            checkingRelease={checkingRelease}
            hasRealEscrowId={hasRealEscrowId}
            chainCanRelease={chainCanRelease}
            allPriorityCompleted={allPriorityCompleted}
            deliverySignature={deliverySignature}
            isLogisticsChainUser={currentUser.userType === 'LOGISTICS_CHAIN'}
            onOpenSignatureModal={openSignatureModal}
          />

          {/* Phase 3 · IoT sensor readings (temperature/humidity/shock/GPS/door) */}
          <IoTReadingsPanel
            shipmentId={shipment.id}
            currentUserId={currentUser.id}
            canRegisterDevice={canRegisterIoTDevice}
          />

          {/* Phase 5 · Direct System Integrations (carrier booking, BOC e2m,
              duty pre-funding, trade finance) — sections self-hide by role */}
          <Phase5IntegrationsPanel shipment={shipment} currentUser={currentUser} />

          {/* Phase 3 · Recipient-side confirmation flow */}
          {(isImporter || currentUser.userType === 'LOGISTICS_CHAIN') && (
            <div className="bg-white border border-mist p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-extrabold text-sm text-ink tracking-tight flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber" /><span>Recipient-Side Delivery Confirmation</span>
                </h3>
                <button
                  type="button"
                  onClick={openRecipientConfirmModal}
                  className="bg-amber-light hover:bg-ink border border-amber/30 text-ink hover:text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" /> Request Confirmation
                </button>
              </div>
              <p className="text-[10px] text-ink-faint leading-relaxed">
                Send the named consignee a one-time link to confirm (or dispute) receipt independently —
                so proof of arrival isn&apos;t solely supplied by the logistics side.
              </p>

              {recipientConfirmations.length === 0 ? (
                <div className="text-center py-6 text-ink-faint text-[10px] font-sans">NO CONFIRMATION REQUESTS SENT YET.</div>
              ) : (
                <div className="space-y-2">
                  {recipientConfirmations.map(rc => {
                    const statusStyle: Record<string, string> = {
                      PENDING:   'bg-amber-light text-amber border-amber-light',
                      CONFIRMED: 'bg-teal-light text-teal border-steel-light',
                      DISPUTED:  'bg-wine-light text-wine border-wine/20',
                      EXPIRED:   'bg-mist-light text-ink-faint border-mist',
                    };
                    return (
                      <div key={rc.id} className="flex items-center justify-between gap-2 text-[11px] border border-mist rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-bold text-ink truncate">{rc.consigneeName || rc.consigneeContact}</p>
                          <p className="text-[10px] text-ink-faint truncate">{rc.consigneeContact} · requested {new Date(rc.requestedAt).toLocaleDateString()}</p>
                          {rc.disputeNote && <p className="text-[10px] text-wine mt-0.5">&ldquo;{rc.disputeNote}&rdquo;</p>}
                        </div>
                        <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide border ${statusStyle[rc.status] ?? statusStyle.PENDING}`}>
                          {rc.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Escrow Ledger Column */}
        <div className="lg:col-span-2 space-y-6">
          <ShipmentEscrowLedger
            shipment={shipment}
            network={STELLAR_NETWORK}
            stellarWorking={stellarWorking}
            stellarStep={stellarStep}
            stellarHash={stellarHash}
            freighter={freighter}
            releaseEligible={releaseEligible}
            isImporter={isImporter}
            onFundEscrow={handleFundEscrow}
            onOpenReleaseModal={() => setReleaseOpen(true)}
            onOpenCancelModal={openCancelModal}
          />
        </div>
      </div>

      {/* PPHP Wallet Panel — importers only, collapsible */}
      {isImporter && (
        <PphpWalletPanel publicKey={freighter.publicKey} onConnect={freighter.connect} />
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
      {/*  MODALS                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <ShipmentCancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        referenceCode={shipment.referenceCode}
        escrowAsset={escrowAsset}
        network={STELLAR_NETWORK}
        freighter={freighter}
        cancelState={cancelState}
        setCancelState={setCancelState}
        disputeReasonInput={disputeReasonInput}
        setDisputeReasonInput={setDisputeReasonInput}
        onPrepareCancel={handlePrepareCancel}
        onRaiseDispute={handleRaiseDispute}
      />

      <BocAuthDeniedModal
        open={bocAuthOpen}
        onClose={() => setBocAuthOpen(false)}
        jobRole={currentUser.jobRole}
      />

      <EscrowReleaseModal
        open={releaseOpen}
        onClose={() => { setReleaseOpen(false); setStellarError(''); }}
        freighter={freighter}
        stellarError={stellarError}
        stellarWorking={stellarWorking}
        stellarStep={stellarStep}
        releaseProofUrl={releaseProofUrl}
        setReleaseProofUrl={setReleaseProofUrl}
        onSubmit={handleEscrowReleaseSubmit}
      />

      <BocUploadModal
        open={uploadOpen}
        onClose={closeUploadModal}
        referenceCode={shipment.referenceCode}
        uploadFile={uploadFile}
        uploading={uploading}
        uploadError={uploadError}
        fileInputRef={bocFileInputRef}
        onFileChange={handleUploadFileChange}
        onSubmit={handleUploadDocument}
      />

      <DeliverySignatureModal
        open={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        referenceCode={shipment.referenceCode}
        signatureError={signatureError}
        signatureSubmitting={signatureSubmitting}
        signerName={signerName}
        setSignerName={setSignerName}
        signerRelation={signerRelation}
        setSignerRelation={setSignerRelation}
        signerContact={signerContact}
        setSignerContact={setSignerContact}
        onContactChange={handleSignerContactChange}
        otpSent={otpSent}
        otpSending={otpSending}
        otpExpiresAt={otpExpiresAt}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        onSendOtp={handleSendSignatureOtp}
        signaturePadRef={signaturePadRef}
        onSubmit={handleSubmitSignature}
      />

      <RecipientConfirmModal
        open={recipientConfirmOpen}
        onClose={() => setRecipientConfirmOpen(false)}
        referenceCode={shipment.referenceCode}
        rcError={rcError}
        rcJustSentUrl={rcJustSentUrl}
        rcSubmitting={rcSubmitting}
        consigneeContact={consigneeContact}
        setConsigneeContact={setConsigneeContact}
        consigneeName={consigneeName}
        setConsigneeName={setConsigneeName}
        onSubmit={handleRequestRecipientConfirmation}
      />
    </DashboardLayout>
  );
}
