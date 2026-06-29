'use client';
/**
 * components/PphpWalletPanel.tsx
 *
 * Self-contained widget that covers PPHP onboarding end-to-end:
 *
 *   1. Trustline detection — checks if the connected wallet already trusts
 *      PPHP. If not, shows an "Enable Philippine Peso payments" prompt that
 *      builds + signs + submits a changeTrust transaction via Freighter.
 *   2. "Fund Your Wallet" — once trusted, lets the user simulate a PHP
 *      deposit (amount + fake bank reference) which calls the backend mint
 *      API and credits PPHP to their wallet.
 *   5. Balance display — shows live XLM / USDC / PPHP balances side by side.
 *
 * Drop this anywhere a wallet-aware page wants PPHP onboarding, e.g. the
 * dashboard or payments page:
 *
 *   <PphpWalletPanel publicKey={freighter.publicKey} onConnect={freighter.connect} />
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Wallet, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle,
  Banknote, ArrowRight, Coins, ExternalLink, Landmark,
} from 'lucide-react';
import { getAllTrustlineBalances, buildTrustlineXdr } from '@/lib/stellar/trustline';
import { signAndSubmit } from '@/lib/stellar/freighter';
import { getAccountBalance } from '@/lib/stellar/escrow';
import { formatAsset, SUPPORTED_ASSETS } from '@/lib/stellar/assets';
import { authFetch } from '@/hooks/use-user-session';
import type { NetworkName } from '@/lib/stellar/escrow-contract';

const STELLAR_NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as NetworkName;

interface PphpWalletPanelProps {
  /** Connected Freighter public key, or null if not yet connected. */
  publicKey: string | null;
  /** Triggers the Freighter connect-wallet popup. Resolves with the public key. */
  onConnect: () => Promise<string>;
  /** Optional: called after a successful mint so parent pages can refresh other balance displays. */
  onMinted?: (amount: number) => void;
}

type Step = 'idle' | 'connecting' | 'checking' | 'trusting' | 'funding' | 'minting';

export default function PphpWalletPanel({ publicKey, onConnect, onMinted }: PphpWalletPanelProps) {
  const [hasTrustline, setHasTrustline] = useState<boolean | null>(null); // null = not checked yet
  const [balances, setBalances] = useState<{ xlm: string; usdc: string; pphp: string } | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);

  // ── Fund Wallet form state ──────────────────────────────────────────────
  const [showFundForm, setShowFundForm] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [mintResult, setMintResult] = useState<{ hash: string; explorerUrl: string; amount: number } | null>(null);

  const refreshBalances = useCallback(async (pk: string) => {
    const bal = await getAccountBalance(pk);
    setBalances(bal);
  }, []);

  const checkTrustline = useCallback(async (pk: string) => {
    setStep('checking');
    setError(null);
    try {
      const result = await getAllTrustlineBalances(pk, STELLAR_NETWORK);
      setHasTrustline(result.PPHP !== null && result.PPHP !== undefined);
      await refreshBalances(pk);
    } catch {
      setError('Could not check PPHP trustline status. Try refreshing.');
    } finally {
      setStep('idle');
    }
  }, [refreshBalances]);

  // Re-check whenever the wallet connects / changes
  useEffect(() => {
    if (publicKey) checkTrustline(publicKey);
    else { setHasTrustline(null); setBalances(null); }
  }, [publicKey, checkTrustline]);

  // ── 1. Trustline prompt ──────────────────────────────────────────────────

  const handleEnablePphp = async () => {
    setError(null);
    try {
      let pk = publicKey;
      if (!pk) {
        setStep('connecting');
        pk = await onConnect();
      }
      setStep('trusting');
      const xdr = await buildTrustlineXdr(pk, 'PPHP', STELLAR_NETWORK);
      if (xdr) {
        await signAndSubmit(xdr, STELLAR_NETWORK);
      }
      setHasTrustline(true);
      await refreshBalances(pk);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable PPHP. Try again.');
    } finally {
      setStep('idle');
    }
  };

  // ── 2. Fund Your Wallet (simulated anchor deposit → mint API) ──────────

  const handleConfirmFunding = async () => {
    if (!publicKey) return;
    const amountNum = Number(fundAmount);
    if (!amountNum || amountNum <= 0) {
      setError('Enter a valid PHP amount.');
      return;
    }
    if (!bankRef.trim()) {
      setError('Enter a bank reference number — simulates the anchor matching your deposit.');
      return;
    }
    setError(null);
    setStep('minting');
    try {
      const res = await authFetch('/api/stellar/mint-pphp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientAddress: publicKey, amount: amountNum }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Minting failed.');
        return;
      }
      setMintResult(json.data);
      await refreshBalances(publicKey);
      onMinted?.(amountNum);
      setShowFundForm(false);
      setFundAmount('');
      setBankRef('');
    } catch {
      setError('Could not reach the minting service. Try again.');
    } finally {
      setStep('idle');
    }
  };

  const busy = step !== 'idle';

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border border-sand-200 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Landmark className="w-5 h-5 text-yellow-500" />
        <h3 className="font-extrabold text-sm text-maritime-900">Philippine Peso (PPHP) Wallet</h3>
        <span className="ml-auto text-[9px] bg-yellow-100 text-yellow-700 font-black px-2 py-0.5 rounded uppercase tracking-wider">
          Simulated Anchor
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-coral-50 border border-coral-400/20 text-coral-600 text-xs p-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {!publicKey ? (
        <button
          onClick={handleEnablePphp}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-maritime-400 hover:bg-maritime-900 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
        >
          {step === 'connecting'
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Connecting Freighter…</>
            : <><Wallet className="w-4 h-4" /> Connect Wallet to Continue</>}
        </button>
      ) : hasTrustline === null ? (
        <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking trustline status…
        </div>
      ) : hasTrustline === false ? (
        // ── Trustline prompt (item 1) ──────────────────────────────────────
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800 leading-relaxed">
              <strong>Enable Philippine Peso payments — powered by Stellar.</strong> You&apos;ll be asked to
              sign a one-time trustline transaction in Freighter so your wallet can hold PPHP.
            </p>
          </div>
          <button
            onClick={handleEnablePphp}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {step === 'trusting'
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Signing in Freighter…</>
              : <><Coins className="w-4 h-4" /> Enable Philippine Peso Payments</>}
          </button>
        </div>
      ) : (
        // ── Trusted: balances + fund wallet (items 2 & 5) ──────────────────
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <BalanceCell label="XLM" value={balances?.xlm} />
            <BalanceCell label="USDC" value={balances?.usdc} prefix="$" />
            <BalanceCell label="PPHP" value={balances?.pphp} prefix="₱" highlight />
          </div>

          {!showFundForm ? (
            <button
              onClick={() => setShowFundForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-ocean-400 hover:bg-ocean-600 text-maritime-900 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
            >
              <Banknote className="w-4 h-4" /> Fund Your Wallet
            </button>
          ) : (
            <div className="border border-sand-200 rounded-xl p-4 space-y-3 bg-sand-50">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Simulates the anchor layer: enter a PHP amount and a bank reference as if you
                just deposited cash at a partner bank. In production a licensed PHP anchor
                confirms the deposit and credits your wallet automatically.
              </p>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Amount (PHP)</label>
                <input
                  type="number" min="0" placeholder="500000"
                  className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-ocean-400"
                  value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">Bank Reference Number</label>
                <input
                  type="text" placeholder="e.g. BPI-DEP-009123"
                  className="w-full border border-sand-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-ocean-400"
                  value={bankRef} onChange={e => setBankRef(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFundForm(false)}
                  className="flex-1 text-xs font-bold text-gray-500 hover:text-maritime-900 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmFunding}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-ocean-400 hover:bg-ocean-600 text-maritime-900 font-black py-2 rounded-lg text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {step === 'minting'
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Confirming…</>
                    : <>Confirm <ArrowRight className="w-3.5 h-3.5" /></>}
                </button>
              </div>
            </div>
          )}

          {mintResult && (
            <div className="bg-ocean-50 border border-ocean-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-ocean-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-black text-ocean-700">
                  {formatAsset(mintResult.amount, 'PPHP')} has been credited to your Stellar wallet.
                </p>
                <a
                  href={mintResult.explorerUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-ocean-500 hover:text-ocean-700 font-mono mt-1"
                >
                  {mintResult.hash.substring(0, 12)}… <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-400 leading-relaxed border-t border-sand-100 pt-3">
        In production, MariTrade integrates with a licensed PHP anchor — a regulated institution
        that issues PPHP 1:1 against real peso deposits. This demo simulates that anchor using a
        testnet issuer account ({SUPPORTED_ASSETS.PPHP.issuer ? `${SUPPORTED_ASSETS.PPHP.issuer.slice(0, 6)}…` : 'not configured'}).
      </p>
    </div>
  );
}

function BalanceCell({ label, value, prefix = '', highlight = false }: {
  label: string; value?: string; prefix?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? 'border-yellow-200 bg-yellow-50' : 'border-sand-200 bg-sand-50'}`}>
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-mono font-black ${highlight ? 'text-yellow-700' : 'text-maritime-900'}`}>
        {value !== undefined
          ? `${prefix}${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '…'}
      </p>
    </div>
  );
}
