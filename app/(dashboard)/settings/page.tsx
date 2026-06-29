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
} from 'lucide-react';

export default function SettingsPage() {
  const { currentUser, loading } = useUserSession();

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

              <div className="border-t border-mist pt-3">
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 text-[11px] font-bold hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--theme-accent)' }}
                >
                  Edit profile details <ChevronRight className="w-3 h-3" />
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
