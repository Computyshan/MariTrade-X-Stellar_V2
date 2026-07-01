'use client';

import React from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import {
  User,
  ShieldCheck,
  Cpu,
  KeyRound,
  Globe,
  Lock,
  BadgeCheck,
  ChevronRight,
  Anchor,
  Zap,
  BookOpen,
  Link2,
  Palette,
  CheckCircle2,
} from 'lucide-react';
import { TrackingTier, TRACKING_TIER_LABELS } from '@/types';
import { authFetch } from '@/hooks/use-user-session';

const TIER_OPTIONS: { value: TrackingTier; description: string }[] = [
  { value: 'BRANDED', description: 'Public link shows shipment status only, under the MariTrade brand.' },
  { value: 'TIMELINE', description: 'Adds the full milestone-by-milestone handoff timeline to the public link.' },
  { value: 'WHITELABEL', description: 'Timeline plus your own logo, accent color, and company label — no MariTrade branding.' },
];

export default function SettingsPage() {
  const { currentUser, loading, setCurrentUser } = useUserSession();

  const [tier, setTier] = React.useState<TrackingTier>('BRANDED');
  const [logoUrl, setLogoUrl] = React.useState('');
  const [primaryColor, setPrimaryColor] = React.useState('');
  const [companyLabel, setCompanyLabel] = React.useState('');
  const [savingTier, setSavingTier] = React.useState(false);
  const [tierSaved, setTierSaved] = React.useState(false);

  // Sync local form state from currentUser once it loads (or changes user),
  // without a useEffect — adjusting state during render per React's guidance
  // for "resetting state when a prop changes" avoids an extra render pass.
  const [syncedUserId, setSyncedUserId] = React.useState<string | undefined>(undefined);
  if (currentUser && currentUser.id !== syncedUserId) {
    setSyncedUserId(currentUser.id);
    setTier(currentUser.trackingTier ?? 'BRANDED');
    setLogoUrl(currentUser.brandingLogoUrl ?? '');
    setPrimaryColor(currentUser.brandingPrimaryColor ?? '');
    setCompanyLabel(currentUser.brandingCompanyLabel ?? '');
  }

  const handleSaveTier = async () => {
    if (!currentUser) return;
    setSavingTier(true);
    setTierSaved(false);
    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          trackingTier: tier,
          brandingLogoUrl: logoUrl,
          brandingPrimaryColor: primaryColor,
          brandingCompanyLabel: companyLabel,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCurrentUser(json.data);
        setTierSaved(true);
        setTimeout(() => setTierSaved(false), 2500);
      }
    } catch (err) {
      console.error('Failed to save tracking tier:', err);
    } finally {
      setSavingTier(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div
            className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--theme-accent)', borderTopColor: 'transparent' }}
          />
        </div>
      </DashboardLayout>
    );
  }

  const isTradeParty = currentUser.userType === 'TRADE_PARTY';
  const stellarNet   = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
  const geminiModel  = process.env.NEXT_PUBLIC_GEMINI_MODEL    ?? 'gemini-2.0-flash';

  return (
    <DashboardLayout tradeParty={isTradeParty}>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ── PAGE HEADER ── */}
        <div className="border-b border-mist pb-5">
          <h1 className="text-3xl font-display font-medium text-ink tracking-tight flex items-center gap-2.5">
            <Cpu className="w-7 h-7" style={{ color: 'var(--theme-accent)' }} />
            System Settings
          </h1>
          <p className="text-sm text-ink-faint mt-1">
            Portal configuration, ledger diagnostics, and usage guidelines.
          </p>
        </div>

        {/* ── THREE-COLUMN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── CARD 1: Active Merchant Persona ── */}
          <div className="bg-white border border-mist rounded-2xl shadow-sm overflow-hidden">
            {/* Card header bar */}
            <div className="px-5 py-3.5 border-b border-mist flex items-center gap-2"
              style={{ background: 'var(--theme-accent-muted)' }}>
              <User className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
              <h3 className="text-[11px] font-black uppercase tracking-widest"
                style={{ color: 'var(--theme-accent)' }}>
                Active Merchant Persona
              </h3>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-ink-faint uppercase font-mono tracking-wider block">Full Name</span>
                <strong className="text-ink font-bold block">{currentUser.fullName}</strong>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-ink-faint uppercase font-mono tracking-wider block">Email Address</span>
                <strong className="text-ink font-mono block text-[11px]">{currentUser.email}</strong>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-ink-faint uppercase font-mono tracking-wider block">KYC Verification ID</span>
                <strong className="text-ink font-mono block">MT-KYC-{currentUser.id.substring(0, 10).toUpperCase()}</strong>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-ink-faint uppercase font-mono tracking-wider block">Job Category Role</span>
                <strong className="font-bold block uppercase" style={{ color: 'var(--theme-accent)' }}>
                  {currentUser.jobRole.replace(/_/g, ' ')}
                </strong>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-ink-faint uppercase font-mono tracking-wider block">Registered Company</span>
                <strong className="text-ink font-bold block">
                  {currentUser.companyName || 'Individual Trader'}
                </strong>
              </div>

              {/* KYC status badge */}
              <div className="pt-1">
                <div className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                  currentUser.kycStatus === 'VERIFIED'
                    ? 'bg-teal-light text-teal'
                    : currentUser.kycStatus === 'SUBMITTED'
                    ? 'bg-steel-light text-steel'
                    : 'bg-amber-light text-amber'
                }`}>
                  <BadgeCheck className="w-3 h-3" />
                  KYC: {currentUser.kycStatus}
                </div>
              </div>

              <div className="border-t border-mist pt-3 space-y-2">
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 text-[11px] font-bold hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--theme-accent)' }}
                >
                  Edit profile details <ChevronRight className="w-3 h-3" />
                </Link>
                <Link
                  href="/team"
                  className="flex items-center gap-1.5 text-[11px] font-bold text-ink-faint hover:opacity-70 transition-opacity"
                >
                  Manage team seats <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* ── CARD 2: Digital Ledger Diagnostics ── */}
          <div className="bg-white border border-mist rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-mist flex items-center gap-2 bg-mist-light">
              <Anchor className="w-4 h-4 text-ink-faint" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-ink-faint">
                Ledger Diagnostics
              </h3>
            </div>

            <div className="p-5 space-y-3 text-xs">
              {/* Network status */}
              <div className="flex items-center justify-between border-b border-mist pb-3">
                <div className="flex items-center gap-1.5 text-ink-faint">
                  <Globe className="w-3.5 h-3.5" />
                  <span className="font-mono uppercase">Stellar Network</span>
                </div>
                <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-full ${
                  stellarNet === 'mainnet'
                    ? 'bg-teal-light text-teal'
                    : 'bg-amber-light text-amber'
                }`}>
                  {stellarNet}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-mist pb-3">
                <div className="flex items-center gap-1.5 text-ink-faint">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="font-mono uppercase">BOC Encryption</span>
                </div>
                <strong className="text-ink font-mono text-[10px]">AES-GCM-256</strong>
              </div>

              <div className="flex items-center justify-between border-b border-mist pb-3">
                <div className="flex items-center gap-1.5 text-ink-faint">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="font-mono uppercase">Stablecoin</span>
                </div>
                <strong className="text-ink font-mono text-[10px]">USDC</strong>
              </div>

              <div className="flex items-center justify-between border-b border-mist pb-3">
                <div className="flex items-center gap-1.5 text-ink-faint">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="font-mono uppercase">AI Model</span>
                </div>
                <strong className="text-ink font-mono text-[10px]">{geminiModel}</strong>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-ink-faint">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="font-mono uppercase">User Type</span>
                </div>
                <strong className="font-black text-[10px] uppercase" style={{ color: 'var(--theme-accent)' }}>
                  {currentUser.userType.replace(/_/g, ' ')}
                </strong>
              </div>

              {/* Stellar wallet display */}
              {currentUser.stellarWallet && (
                <div className="mt-3 pt-3 border-t border-mist space-y-1">
                  <span className="text-[10px] text-ink-faint uppercase font-mono tracking-wider block">Stellar Wallet (Public)</span>
                  <span className="font-mono text-[10px] text-ink break-all leading-relaxed block">
                    {currentUser.stellarWallet}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── CARD 3: Usage Guidelines ── */}
          <div className="bg-white border border-mist rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-mist flex items-center gap-2 bg-mist-light">
              <BookOpen className="w-4 h-4 text-ink-faint" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-ink-faint">
                Usage Guidelines
              </h3>
            </div>

            <div className="p-5 space-y-4 text-xs text-ink-faint leading-relaxed">
              <div className="space-y-1.5">
                <p className="font-black text-ink text-[11px] uppercase tracking-wide">Counter-Offer Rule</p>
                <p>
                  Importers and Exporters negotiate terms inside the Trade Negotiations tab.
                  Countering updates the temporary price. Accepting generates an immutable
                  Stellar escrow contract.
                </p>
              </div>

              <div className="space-y-1.5 border-t border-mist pt-4">
                <p className="font-black text-ink text-[11px] uppercase tracking-wide">Cargo Proof Validation</p>
                <p>
                  To release escrow funds, importers must confirm that logistics partners have
                  logged all priority milestones. Each milestone requires a reference number,
                  document upload, or photo as evidence before it can be committed to the ledger.
                </p>
              </div>

              <div className="space-y-1.5 border-t border-mist pt-4">
                <p className="font-black text-ink text-[11px] uppercase tracking-wide">BOC Document Access</p>
                <p>
                  Trade Party users and Customs Brokers have full document read/download access.
                  All other logistics roles see a restricted placeholder in the Documents section.
                </p>
              </div>

              <div className="border-t border-mist pt-4">
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 text-[11px] font-bold hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--theme-accent)' }}
                >
                  Update your profile <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── CARD 4: Public Tracking Page Tier (Importers only) ── */}
        {currentUser.jobRole === 'IMPORTER' && (
        <div className="bg-white border border-mist rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-mist flex items-center gap-2"
            style={{ background: 'var(--theme-accent-muted)' }}>
            <Link2 className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
            <h3 className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: 'var(--theme-accent)' }}>
              Public Tracking Page Tier
            </h3>
          </div>

          <div className="p-5 space-y-5">
            <p className="text-xs text-ink-faint leading-relaxed">
              Choose what counterparties and customers see when they open a public{' '}
              <code className="bg-mist-light px-1.5 py-0.5 rounded text-ink font-mono text-[11px]">/track/&lt;code&gt;</code>{' '}
              link for your shipments.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTier(opt.value)}
                  className={`text-left border rounded-xl p-4 space-y-2 transition-all cursor-pointer ${
                    tier === opt.value
                      ? 'ring-2 bg-mist-light'
                      : 'border-mist hover:border-mist-dark bg-white'
                  }`}
                  style={tier === opt.value ? { borderColor: 'var(--theme-accent)', boxShadow: '0 0 0 2px var(--theme-accent-muted)' } as React.CSSProperties : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wide text-ink">
                      {TRACKING_TIER_LABELS[opt.value]}
                    </span>
                    {tier === opt.value && <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-accent)' }} />}
                  </div>
                  <p className="text-[11px] text-ink-faint leading-relaxed">{opt.description}</p>
                </button>
              ))}
            </div>

            {tier === 'WHITELABEL' && (
              <div className="border-t border-mist pt-4 space-y-3">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-ink-faint">
                  <Palette className="w-3.5 h-3.5" />
                  White-Label Branding
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-[10px] text-ink-faint uppercase font-mono tracking-wider">Logo URL</label>
                    <input
                      type="text"
                      placeholder="https://yourcompany.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full bg-white border border-mist rounded-lg px-3 py-2 text-xs outline-none focus:border-amber"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] text-ink-faint uppercase font-mono tracking-wider">Accent Color</label>
                    <input
                      type="text"
                      placeholder="#1f6f54"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full bg-white border border-mist rounded-lg px-3 py-2 text-xs outline-none focus:border-amber"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] text-ink-faint uppercase font-mono tracking-wider">Company Label</label>
                    <input
                      type="text"
                      placeholder="Your Company Logistics"
                      value={companyLabel}
                      onChange={(e) => setCompanyLabel(e.target.value)}
                      className="w-full bg-white border border-mist rounded-lg px-3 py-2 text-xs outline-none focus:border-amber"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-mist pt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveTier}
                disabled={savingTier}
                className="bg-amber hover:bg-amber-hover disabled:opacity-60 text-white text-[11px] font-bold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {savingTier ? 'Saving…' : 'Save Tracking Tier'}
              </button>
              {tierSaved && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-teal">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>
          </div>
        </div>
        )}

        {/* ── BOTTOM PANEL: Session info ── */}
        <div className="bg-ink rounded-2xl p-5 text-white flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-[10px] text-white/40 uppercase font-mono tracking-wider">Active Session</p>
            <p className="text-sm font-bold">{currentUser.fullName}</p>
            <p className="text-[11px] text-white/50 font-mono">{currentUser.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-teal">Secure Connection</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
