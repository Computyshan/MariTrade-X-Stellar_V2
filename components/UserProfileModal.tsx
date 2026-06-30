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
} from 'lucide-react';
import { authFetch } from '@/hooks/use-user-session';

// ─── Public profile shape (mirrors server-side PublicProfile) ─────────────────

export interface PublicProfile {
  id: string;
  email: string;
  fullName: string;
  fullAddress?: string;
  contactNumber?: string;
  userType: string;
  jobRole: string;
  companyName?: string;
  kycStatus: string;
  createdAt: string;
  updatedAt: string;
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

// ─── Component ────────────────────────────────────────────────────────────────

interface UserProfileModalProps {
  /** ID of the user to show. Pass null to close the drawer. */
  userId: string | null;
  onClose: () => void;
}

export default function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Fetch whenever userId changes. When userId becomes null (drawer closing),
  // there's nothing to fetch — skip the effect body entirely rather than
  // synchronously resetting state in the effect (avoids the cascading-render
  // lint warning, and AnimatePresence keeps prior content mounted during exit).
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setProfile(null);

    authFetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.success) setProfile(json.data);
        else setError(json.error ?? 'Could not load profile.');
      })
      .catch(() => { if (!cancelled) setError('Network error — please try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

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
  const roleColor = profile ? (JOB_ROLE_COLOR[profile.jobRole] ?? 'bg-mist text-ink-faint border-mist-dark') : '';
  const roleIcon  = profile ? (JOB_ROLE_ICON[profile.jobRole]  ?? <User className="w-3.5 h-3.5" />)         : null;
  const roleLabel = profile ? (JOB_ROLE_LABELS[profile.jobRole] ?? profile.jobRole.replace(/_/g, ' '))       : '';
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

                        {/* Role badge + KYC badge */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleColor}`}>
                            {roleIcon}
                            {roleLabel}
                          </span>

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
