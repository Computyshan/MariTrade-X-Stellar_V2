'use client';

import React from 'react';
import {
  Coins, Clock, RefreshCw, ExternalLink, Lock, Unlock, Wallet, XCircle, ShieldAlert, Scale, CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import type { Shipment } from '@/types';
import { formatAsset } from '@/lib/stellar/assets';
import PhpEquivLabel from '@/components/PhpEquivLabel';

interface FreighterLike {
  publicKey: string | null;
  connecting: boolean;
  connect: () => Promise<string>;
}

interface ShipmentEscrowLedgerProps {
  shipment: Shipment;
  network: 'testnet' | 'mainnet';
  stellarWorking: boolean;
  stellarStep: string;
  stellarHash: string;
  freighter: FreighterLike;
  releaseEligible: boolean;
  isImporter: boolean;
  onFundEscrow: () => void;
  onOpenReleaseModal: () => void;
  onOpenCancelModal: () => void;
}

export default function ShipmentEscrowLedger({
  shipment, network, stellarWorking, stellarStep, stellarHash, freighter,
  releaseEligible, isImporter, onFundEscrow, onOpenReleaseModal, onOpenCancelModal,
}: ShipmentEscrowLedgerProps) {
  const escrowAsset = (shipment.escrowAsset ?? 'USDC') as 'USDC' | 'PPHP';

  return (
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
        <a href={`https://stellar.expert/explorer/${network}/tx/${stellarHash}`}
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
            <button onClick={onFundEscrow} disabled={stellarWorking}
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
                  <button onClick={onOpenReleaseModal} disabled={stellarWorking}
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
                  onClick={onOpenCancelModal}
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
              <a href={`https://stellar.expert/explorer/${network}/tx/${stellarHash}`}
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
            {shipment.stellarEscrowId && /^[0-9a-fA-F]{64}$/.test(shipment.stellarEscrowId) && (
              <a href={`https://stellar.expert/explorer/${network}/tx/${shipment.stellarEscrowId}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-steel font-sans hover:underline">
                <ExternalLink className="w-3 h-3" /> View on Stellar Explorer
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
