'use client';

/**
 * UserProfileModal
 * ────────────────
 * A slide-in drawer that shows the *public* profile of any MariTrade user.
 * Sensitive fields (bankDetails, stellarWallet) are stripped server-side at
 * GET /api/users/[id] and are never present in the response here.
 *
 * Usage:
 *   <UserProfileModal userId={someId} onClose={() => setProfileId(null)} />
 *
 * Pass userId={null} to hide/close the drawer.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Building2,
  Phone,
  MapPin,
  BadgeCheck,
  ShieldCheck,
  Clock,
  Anchor,
  FileCheck,
  Warehouse,
  Truck,
  Shield,
  User,
  Mail,
  Award,
  Link2,
  Image as ImageIcon,
  FileText,
  ExternalLink,
  Sparkles,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { authFetch } from '@/hooks/use-user-session';
import { ExternalCredential, ExternalCredentialType } from '@/types';
import { AnyScorecard, PERFORMANCE_BADGE_LABELS, PerformanceBadgeTier } from '@/lib/reputation';

// ─── Public profile shape (mirrors server-side PublicProfile) ─────────────────

export interface PublicProfile {
  id: string;
  email: string;
  fullName: string;
  fullAddress?: string;
  contactNumber?: string;
  userType: string;
  jobRole: string;
  jobRoles?: string[];
  companyName?: string;
  kycStatus: string;
  createdAt: string;
  updatedAt: string;
  externalCredentials?: ExternalCredential[];
  preVerified?: boolean;
  scorecard?: AnyScorecard | null;
  // bankDetails  — intentionally absent (stripped server-side)
  // stellarWallet — intentionally absent (stripped server-side)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOB_ROLE_LABELS: Record<string, string> = {
  IMPORTER:           'Importer',
  EXPORTER:           'Exporter',
  FREIGHT_FORWARDER:  'Freight Forwarder',
  WAREHOUSE_OPERATOR: 'Warehouse Operator',
  CUSTOMS_BROKER:     'Customs Broker',
};

const JOB_ROLE_COLOR: Record<string, string> = {
  IMPORTER:           'bg-wine-light text-wine border-wine/20',
  EXPORTER:           'bg-amber-light text-amber border-amber/20',
  FREIGHT_FORWARDER:  'bg-teal-light text-teal border-teal/20',
  CUSTOMS_BROKER:     'bg-steel-light text-steel border-steel/20',
  WAREHOUSE_OPERATOR: 'bg-mist text-ink-faint border-mist-dark',
};

const JOB_ROLE_ICON: Record<string, React.ReactNode> = {
  IMPORTER:           <Shield className="w-3.5 h-3.5" />,
  EXPORTER:           <Shield className="w-3.5 h-3.5" />,
  FREIGHT_FORWARDER:  <Anchor className="w-3.5 h-3.5" />,
  CUSTOMS_BROKER:     <FileCheck className="w-3.5 h-3.5" />,
  WAREHOUSE_OPERATOR: <Warehouse className="w-3.5 h-3.5" />,
  TRUCKER:            <Truck className="w-3.5 h-3.5" />,
};

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0][0].toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'long',
    day:   'numeric',
    year:  'numeric',
  });
}

const CREDENTIAL_TYPE_META: Record<ExternalCredentialType, { label: string; icon: React.ReactNode }> = {
  CERTIFICATE_URL:   { label: 'Link',   icon: <Link2 className="w-3.5 h-3.5" /> },
  CERTIFICATE_IMAGE: { label: 'Image',  icon: <ImageIcon className="w-3.5 h-3.5" /> },
  RESUME_PDF:        { label: 'Résumé', icon: <FileText className="w-3.5 h-3.5" /> },
};

const BADGE_TIER_STYLE: Record<PerformanceBadgeTier, string> = {
  GOLD:   'bg-amber-light text-amber border-amber/25',
  SILVER: 'bg-mist text-ink-faint border-mist-dark',
  BRONZE: 'bg-steel-light text-steel border-steel/20',
};

function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'wine' | 'teal' }) {
  return (
    <div className="bg-mist-light rounded-lg px-3 py-2.5">
      <p className="text-[9px] text-ink-faint uppercase font-mono tracking-wider font-bold">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${tone === 'wine' ? 'text-wine' : tone === 'teal' ? 'text-teal' : 'text-ink'}`}>{value}</p>
    </div>
  );
}

/**
 * Phase 1 (Reputation & Marketplace Pressure) scorecard panel — shown on
 * any member's public profile so counterparties can see a computed track
 * record, not just a self-reported one. Renders nothing until there's at
 * least one scoreable shipment, so brand-new accounts don't show a wall of
 * empty stats.
 */
function ScorecardPanel({ scorecard }: { scorecard?: AnyScorecard | null }) {
  if (!scorecard) return null;

  if (scorecard.kind === 'LOGISTICS_CHAIN') {
    const s = scorecard.scorecard;
    if (s.shipmentsHandled === 0) return null;
    return (
      <div className="px-5 py-4 border-t border-mist space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--color-teal)' }} />
            <p className="text-[9px] text-ink-faint uppercase font-mono tracking-wider font-bold">Performance Track Record</p>
          </div>
          {s.badgeTier && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${BADGE_TIER_STYLE[s.badgeTier]}`}>
              <Award className="w-3 h-3" /> {PERFORMANCE_BADGE_LABELS[s.badgeTier]}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Shipments Handled" value={String(s.shipmentsHandled)} />
          <StatTile label="Completed" value={String(s.shipmentsCompleted)} />
          <StatTile label="On-Time Delivery" value={s.onTimeDeliveryRate !== null ? `${s.onTimeDeliveryRate}%` : '—'} tone="teal" />
          <StatTile label="Dispute Rate" value={s.disputeRate !== null ? `${s.disputeRate}%` : '—'} tone={s.disputeRate ? 'wine' : undefined} />
          {s.avgCustomsClearanceHours !== null && (
            <StatTile label="Avg. Clearance Time" value={`${s.avgCustomsClearanceHours} hrs`} />
          )}
          <StatTile label="Evidence Completeness" value={s.evidenceCompletenessRate !== null ? `${s.evidenceCompletenessRate}%` : '—'} />
        </div>
        <p className="text-[9px] text-ink-faint/70 leading-relaxed flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          Computed from in-platform milestone and escrow history — not self-reported.
        </p>
      </div>
    );
  }

  const s = scorecard.scorecard;
  if (s.shipmentsInvolved === 0) return null;
  return (
    <div className="px-5 py-4 border-t border-mist space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--color-teal)' }} />
          <p className="text-[9px] text-ink-faint uppercase font-mono tracking-wider font-bold">Reliability Score</p>
        </div>
        {s.badgeTier && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${BADGE_TIER_STYLE[s.badgeTier]}`}>
            <Award className="w-3 h-3" /> {PERFORMANCE_BADGE_LABELS[s.badgeTier]}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Shipments Involved" value={String(s.shipmentsInvolved)} />
        <StatTile label="Funding Completion" value={s.fundingCompletionRate !== null ? `${s.fundingCompletionRate}%` : '—'} tone="teal" />
        <StatTile label="Dispute Rate" value={s.disputeInvolvementRate !== null ? `${s.disputeInvolvementRate}%` : '—'} tone={s.disputeInvolvementRate ? 'wine' : undefined} />
      </div>
      <p className="text-[9px] text-ink-faint/70 leading-relaxed flex items-start gap-1.5">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
        Computed from in-platform shipment and escrow history — not self-reported.
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface UserProfileModalProps {
  /** ID of the user to show. Pass null to close the drawer. */
  userId: string | null;
  onClose: () => void;
}

export default function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  // Single state object keeps every transition (idle → loading → success/error)
  // inside the async callback chain instead of synchronous setState calls at
  // the top of the effect body, which is what react-hooks/set-state-in-effect
  // flags. The effect itself only kicks off the fetch; nothing is set on the
  // same tick the effect runs.
  type FetchState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; profile: PublicProfile }
    | { status: 'error'; message: string };

  const [state, setState] = useState<FetchState>({ status: 'idle' });

  // Fetch whenever userId changes. When userId becomes null (drawer closing),
  // there's nothing to fetch — skip the effect body entirely.
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    authFetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.success) setState({ status: 'success', profile: json.data });
        else setState({ status: 'error', message: json.error ?? 'Could not load profile.' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: 'Network error — please try again.' });
      });

    // Mark this fetch as loading via a microtask so it never runs synchronously
    // inside the effect body itself.
    queueMicrotask(() => { if (!cancelled) setState({ status: 'loading' }); });

    return () => { cancelled = true; };
  }, [userId]);

  // Close on Escape key
  useEffect(() => {
    if (!userId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [userId, onClose]);

  const isOpen    = !!userId;
  const loading   = state.status === 'idle' || state.status === 'loading';
  const error     = state.status === 'error' ? state.message : '';
  const profile   = state.status === 'success' ? state.profile : null;
  const profileRoles = profile ? ((profile.jobRoles && profile.jobRoles.length > 0) ? profile.jobRoles : [profile.jobRole]) : [];
  const roleColor = profile ? (JOB_ROLE_COLOR[profile.jobRole] ?? 'bg-mist text-ink-faint border-mist-dark') : '';
  const roleIcon  = profile ? (JOB_ROLE_ICON[profile.jobRole]  ?? <User className="w-3.5 h-3.5" />)         : null;
  const initials  = profile ? getInitials(profile.fullName) : '??';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] z-50"
            onClick={onClose}
          />

          {/* Slide-in drawer */}
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center justify-between shrink-0"
              style={{ background: 'linear-gradient(110deg, var(--color-ink) 0%, var(--color-ink-soft) 100%)' }}
            >
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-white/60" />
                <p className="text-white font-bold text-[11px] uppercase tracking-widest">Member Profile</p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Close profile"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Loading skeleton ── */}
              {loading && (
                <div className="p-5 space-y-5 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-mist shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-mist rounded w-2/3" />
                      <div className="h-3 bg-mist rounded w-1/2" />
                    </div>
                  </div>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-mist rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5 pt-1">
                        <div className="h-2.5 bg-mist rounded w-1/4" />
                        <div className="h-3.5 bg-mist rounded w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Error state ── */}
              {!loading && error && (
                <div className="p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-wine-light flex items-center justify-center mx-auto">
                    <User className="w-6 h-6 text-wine" />
                  </div>
                  <p className="text-sm font-bold text-ink">Profile unavailable</p>
                  <p className="text-xs text-ink-faint">{error}</p>
                </div>
              )}

              {/* ── Profile content ── */}
              {!loading && profile && (
                <>
                  {/* Hero card */}
                  <div className="p-5 border-b border-mist">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0 border-2 ${roleColor}`}>
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-ink leading-tight truncate">
                          {profile.fullName}
                        </h2>
                        {profile.companyName && (
                          <p className="text-xs text-ink-faint flex items-center gap-1.5 mt-0.5 truncate">
                            <Building2 className="w-3 h-3 shrink-0" />
                            {profile.companyName}
                          </p>
                        )}

                        {/* Role badge(s) + KYC badge */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {profileRoles.map(role => (
                            <span key={role} className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${JOB_ROLE_COLOR[role] ?? 'bg-mist text-ink-faint border-mist-dark'}`}>
                              {JOB_ROLE_ICON[role] ?? <User className="w-3.5 h-3.5" />}
                              {JOB_ROLE_LABELS[role] ?? role.replace(/_/g, ' ')}
                            </span>
                          ))}

                          {profile.kycStatus === 'VERIFIED' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-light text-teal border border-teal/20">
                              <BadgeCheck className="w-3 h-3" /> KYC Verified
                            </span>
                          )}
                          {profile.kycStatus === 'SUBMITTED' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-steel-light text-steel border border-steel/20">
                              <ShieldCheck className="w-3 h-3" /> KYC Submitted
                            </span>
                          )}
                          {profile.preVerified && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(254,153,0,0.15)', color: 'var(--color-amber)', border: '1px solid rgba(254,153,0,0.3)' }}>
                              <Sparkles className="w-3 h-3" /> Pre-Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="divide-y divide-mist">

                    {/* Email */}
                    <div className="px-5 py-4 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-mist-light flex items-center justify-center shrink-0 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-ink-faint" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] text-ink-faint uppercase font-mono tracking-wider font-bold">Email</p>
                        <p className="text-xs text-ink font-mono mt-0.5 break-all">{profile.email}</p>
                      </div>
                    </div>

                    {/* Contact number */}
                    {profile.contactNumber && (
                      <div className="px-5 py-4 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-mist-light flex items-center justify-center shrink-0 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-ink-faint" />
                        </div>
                        <div>
                          <p className="text-[9px] text-ink-faint uppercase font-mono tracking-wider font-bold">Contact Number</p>
                          <p className="text-xs text-ink mt-0.5">{profile.contactNumber}</p>
                        </div>
                      </div>
                    )}

                    {/* Address */}
                    {profile.fullAddress && (
                      <div className="px-5 py-4 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-mist-light flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-ink-faint" />
                        </div>
                        <div>
                          <p className="text-[9px] text-ink-faint uppercase font-mono tracking-wider font-bold">Address</p>
                          <p className="text-xs text-ink mt-0.5 leading-relaxed">{profile.fullAddress}</p>
                        </div>
                      </div>
                    )}

                    {/* Portal type */}
                    <div className="px-5 py-4 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-mist-light flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-ink-faint" />
                      </div>
                      <div>
                        <p className="text-[9px] text-ink-faint uppercase font-mono tracking-wider font-bold">Portal Type</p>
                        <p className="text-xs text-ink mt-0.5 font-semibold">
                          {profile.userType === 'TRADE_PARTY' ? 'Trade Party' : 'Logistics Chain'}
                        </p>
                      </div>
                    </div>

                    {/* Member since */}
                    <div className="px-5 py-4 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-mist-light flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-ink-faint" />
                      </div>
                      <div>
                        <p className="text-[9px] text-ink-faint uppercase font-mono tracking-wider font-bold">Member Since</p>
                        <p className="text-xs text-ink mt-0.5">{formatDate(profile.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  <ScorecardPanel scorecard={profile.scorecard} />

                  {/* External Credentials */}
                  {(profile.externalCredentials?.length ?? 0) > 0 && (
                    <div className="px-5 py-4 border-t border-mist space-y-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-3.5 h-3.5" style={{ color: 'var(--color-amber)' }} />
                        <p className="text-[9px] text-ink-faint uppercase font-mono tracking-wider font-bold">External Credentials</p>
                      </div>
                      <div className="space-y-2">
                        {profile.externalCredentials!.map(c => {
                          const m = CREDENTIAL_TYPE_META[c.type];
                          return (
                            <a
                              key={c.id}
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2.5 border border-mist hover:border-mist-dark bg-mist-light/40 hover:bg-mist-light rounded-lg px-3 py-2.5 transition-all group"
                            >
                              <div className="w-7 h-7 rounded-lg bg-white border border-mist flex items-center justify-center text-ink-faint flex-shrink-0">
                                {m.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-ink truncate">{c.title}</p>
                                <p className="text-[9.5px] text-ink-faint truncate">
                                  {m.label}{c.issuer ? ` · ${c.issuer}` : ''}
                                </p>
                              </div>
                              <ExternalLink className="w-3 h-3 text-ink-faint/50 group-hover:text-ink-faint flex-shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Privacy notice */}
                  <div className="px-5 py-4 border-t border-mist">
                    <div className="bg-mist-light rounded-xl p-3 flex items-start gap-2.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-ink-faint/60 shrink-0 mt-0.5" />
                      <p className="text-[9.5px] text-ink-faint leading-relaxed">
                        Bank account and Stellar wallet details are private to this member
                        and are never shared with other users.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
