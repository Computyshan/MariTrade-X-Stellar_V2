import { useState } from 'react';
import { authFetch } from '@/hooks/use-user-session';
import { signXdrWithFreighter } from '@/lib/stellar/freighter';
import { NETWORKS } from '@/lib/stellar/escrow-contract';

// ═══════════════════════════════════════════════════════════════════════════
//  CANCEL / DISPUTE FLOW
//  Extracted from app/(dashboard)/shipments/[id]/page.tsx. Mirrors the
//  server-side stage machine in /api/shipments/[id]/escrow-cancel:
//    UNFUNDED      → full refund, DB-only or on-chain cancel
//    PRE_DEPARTURE → partial refund, on-chain cancel
//    IN_TRANSIT    → requires a formal dispute (raise_dispute) instead
// ═══════════════════════════════════════════════════════════════════════════

export type CancelStep =
  | 'idle'
  | 'preparing'       // fetching stage + building XDR
  | 'awaiting_sign'   // waiting for Freighter signing popup
  | 'submitting'      // broadcasting to Stellar
  | 'confirming_db'   // writing result to DB
  | 'done'
  | 'error';

export interface CancelState {
  step: CancelStep;
  stage: string;       // UNFUNDED | PRE_DEPARTURE | IN_TRANSIT | DELIVERED
  refundBps: number;
  refundAmount: number;
  requiresDispute: boolean;
  dbOnly: boolean;
  txHash: string;
  error: string;
}

export const CANCEL_INITIAL: CancelState = {
  step: 'idle',
  stage: '',
  refundBps: 0,
  refundAmount: 0,
  requiresDispute: false,
  dbOnly: false,
  txHash: '',
  error: '',
};

interface FreighterLike {
  publicKey: string | null;
  connect: () => Promise<string>;
}

interface UseCancelFlowArgs {
  shipmentId: string | undefined;
  networkKey: 'testnet' | 'mainnet';
  freighter: FreighterLike;
  onSettled: () => void; // re-fetch shipment details after a successful mutation
}

export function useCancelFlow({ shipmentId, networkKey, freighter, onSettled }: UseCancelFlowArgs) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelState, setCancelState] = useState<CancelState>(CANCEL_INITIAL);
  const [disputeReasonInput, setDisputeReasonInput] = useState('');

  const openCancelModal = () => {
    setCancelState(CANCEL_INITIAL);
    setDisputeReasonInput('');
    setCancelOpen(true);
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
        onSettled();
      } else {
        setCancelState(s => ({ ...s, step: 'error', error: json.error || 'DB update failed.' }));
      }
    } catch (err: any) {
      setCancelState(s => ({ ...s, step: 'error', error: err?.message ?? 'Failed to update shipment record.' }));
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
        onSettled();
      } else {
        setCancelState(s => ({ ...s, step: 'error', error: json.error || 'DB update failed.' }));
      }
    } catch (err: any) {
      setCancelState(s => ({ ...s, step: 'error', error: err?.message ?? 'Failed to update shipment record.' }));
    }
  };

  /** Step 1: call prepare_cancel to learn the stage and get the XDR. */
  const handlePrepareCancel = async () => {
    if (!shipmentId) return;

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
      const res = await authFetch(`/api/shipments/${shipmentId}/escrow-cancel`, {
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
        await handleConfirmCancelDB(shipmentId, undefined);
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
          NETWORKS[networkKey].networkPassphrase,
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
      const submitRes = await authFetch(`/api/shipments/${shipmentId}/escrow-cancel`, {
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
      await handleConfirmCancelDB(shipmentId, confirmedHash);

    } catch (err: any) {
      setCancelState(s => ({
        ...s, step: 'error',
        error: err?.message ?? 'An unexpected error occurred during cancellation.',
      }));
    }
  };

  /** Raise dispute (IN_TRANSIT path). Mirrors the cancel flow: prepare → sign → submit → confirm. */
  const handleRaiseDispute = async () => {
    if (!shipmentId) return;

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
      const res = await authFetch(`/api/shipments/${shipmentId}/escrow-cancel`, {
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
        await handleConfirmRaiseDisputeDB(shipmentId, undefined);
        return;
      }

      // Step 2: sign with Freighter (importer-only — no platform co-sign needed)
      setCancelState(s => ({ ...s, step: 'awaiting_sign' }));
      let disputeSignedXdr: string;
      try {
        disputeSignedXdr = await signXdrWithFreighter(
          disputeXdr,
          NETWORKS[networkKey].networkPassphrase,
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
      const submitRes = await authFetch(`/api/shipments/${shipmentId}/escrow-cancel`, {
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
      await handleConfirmRaiseDisputeDB(shipmentId, confirmedHash);

    } catch (err: any) {
      setCancelState(s => ({ ...s, step: 'error', error: err?.message ?? 'Failed to raise dispute.' }));
    }
  };

  return {
    cancelOpen,
    setCancelOpen,
    cancelState,
    setCancelState,
    disputeReasonInput,
    setDisputeReasonInput,
    openCancelModal,
    handlePrepareCancel,
    handleRaiseDispute,
  };
}
