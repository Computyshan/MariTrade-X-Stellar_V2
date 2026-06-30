'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { authFetch } from '@/hooks/use-user-session';
import { User, Shipment, ShipmentStatus } from '@/types';
import { 
  User as UserIcon, 
  MapPin, 
  Phone, 
  Building2, 
  CreditCard, 
  Wallet, 
  CheckCircle2, 
  AlertCircle,
  Save,
  Ship,
  Package,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Globe,
  Anchor,
} from 'lucide-react';

interface ProfileFormProps {
  currentUser: User;
  setCurrentUser: (user: User) => void;
}

function ProfileForm({ currentUser, setCurrentUser }: ProfileFormProps) {
  // Form states initialized directly from current user
  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [contactNumber, setContactNumber] = useState(currentUser.contactNumber || '');
  const [fullAddress, setFullAddress] = useState(currentUser.fullAddress || '');
  const [companyName, setCompanyName] = useState(currentUser.companyName || '');
  const [bankDetails, setBankDetails] = useState(currentUser.bankDetails || '');
  const [stellarWallet, setStellarWallet] = useState(currentUser.stellarWallet || '');

  // Status indicators
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSaveSuccess(false);
    setSaveError('');

    if (!fullName.trim()) {
      setSaveError('Full Name is a required field.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await authFetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          fullName,
          fullAddress,
          contactNumber,
          companyName,
          bankDetails,
          stellarWallet
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        setSaveSuccess(true);
        // BROKEN FIX: use setCurrentUser (returns new object) instead of directly
        // mutating the object in the allUsers array, which bypasses Zustand and React.
        setCurrentUser(json.data);
      } else {
        setSaveError(json.error || 'Failed to update user profile details.');
      }
    } catch (err: any) {
      setSaveError('An unexpected networking error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTradeParty = currentUser?.userType === 'TRADE_PARTY';

  // ── Shipment stats section ───────────────────────────────────────────────
  // Rendered as a separate component below; ProfileForm only handles the form.

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Feedback Alerts */}
      {saveSuccess && (
        <div className="bg-teal-light border border-teal/20 text-teal px-4 py-3.5 rounded-xl flex items-center gap-3 text-xs font-bold shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-teal flex-shrink-0" />
          <span>Successfully updated! Your changes have been securely synchronized across the MariTrade ledger network.</span>
        </div>
      )}

      {saveError && (
        <div className="bg-wine-light border border-wine/20 text-wine px-4 py-3.5 rounded-xl flex items-center gap-3 text-xs font-bold shadow-sm">
          <AlertCircle className="w-5 h-5 text-wine flex-shrink-0" />
          <span>Error: {saveError}</span>
        </div>
      )}

      {/* Profile Card Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-mist rounded-2xl shadow-sm overflow-hidden">
        {/* Header Status Bar */}
        <div className="bg-ink px-6 py-4 text-white flex justify-between items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-bold text-white uppercase">
              {currentUser?.fullName?.split(' ').map(n => n[0]).join('') || 'U'}
            </div>
            <div>
              <strong className="block text-sm leading-tight">{currentUser?.fullName}</strong>
              <span className="text-white/40 tracking-wider font-mono uppercase text-[9px]">ID: {currentUser?.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span className="bg-white/15 text-[10px] uppercase font-bold px-2 py-0.5 rounded text-white tracking-widest">
              {currentUser?.userType?.replace(/_/g, ' ')}
            </span>
            <span className="font-bold px-2 py-0.5 rounded text-xs" style={{ background: 'var(--theme-accent-muted)', color: 'var(--theme-sidebar-active-text)' }}>
              KYC: {currentUser?.kycStatus}
            </span>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          
          {/* Split Row: Name and Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-extrabold text-ink-faint uppercase tracking-wider font-mono text-[10px] block">
                Full Account Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-mist-light border border-mist rounded-xl pl-9 pr-4 py-3 outline-none focus:border-ink-faint text-ink font-medium transition-all"
                  placeholder="Enter your registered name"
                />
                <div className="absolute left-3 top-3.5 text-ink-faint">
                  <UserIcon className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-ink-faint uppercase tracking-wider font-mono text-[10px] block">
                System Registered Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={currentUser?.email}
                  disabled
                  className="w-full bg-mist border border-mist rounded-xl pl-9 pr-4 py-3 text-ink-faint font-mono text-xs cursor-not-allowed select-none outline-none"
                />
                <div className="absolute left-3 top-3.5 text-ink-faint">
                  <span className="text-xs font-mono font-bold">@</span>
                </div>
              </div>
              <span className="text-[10px] text-ink-faint block italic">Email identifiers are hardlocked after merchant validation keys are computed.</span>
            </div>
          </div>

          {/* Split Row: Contact Number and Company */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-extrabold text-ink-faint uppercase tracking-wider font-mono text-[10px] block">
                Contact Number (PH format +63)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full bg-mist-light border border-mist rounded-xl pl-9 pr-4 py-3 outline-none focus:border-ink-faint text-ink font-medium transition-all"
                  placeholder="+63 9XX XXX XXXX"
                />
                <div className="absolute left-3 top-3.5 text-ink-faint">
                  <Phone className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-ink-faint uppercase tracking-wider font-mono text-[10px] block">
                Company / Organization Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-mist-light border border-mist rounded-xl pl-9 pr-4 py-3 outline-none focus:border-ink-faint text-ink font-medium transition-all"
                  placeholder="E.g., Manila Logistics Corporation"
                />
                <div className="absolute left-3 top-3.5 text-ink-faint">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Address Field */}
          <div className="space-y-1.5 text-xs">
            <label className="font-extrabold text-ink-faint uppercase tracking-wider font-mono text-[10px] block">
              Primary Registered Address
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                className="w-full bg-mist-light border border-mist rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-ink-faint text-ink font-medium transition-all"
                placeholder="Enter business building, street address, region, etc."
              />
              <div className="absolute left-3 top-3.5 text-ink-faint">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Split Row: Bank Details & Stellar Wallet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs border-t border-dashed border-mist pt-5">
            
            {/* Private Bank Details */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-extrabold text-ink-faint uppercase tracking-wider font-mono text-[10px] block">
                  {isTradeParty ? 'BDO / PH Bank Account (Encrypted)' : 'Internal Remittance Bank (Optional)'}
                </label>
                {!isTradeParty && (
                  <span className="text-[9px] bg-mist text-ink-faint font-bold px-1 py-0.5 rounded uppercase font-sans">
                    Logistics Profile
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={bankDetails}
                  onChange={(e) => setBankDetails(e.target.value)}
                  className="w-full bg-mist-light border border-mist rounded-xl pl-9 pr-4 py-3 outline-none focus:border-ink-faint text-ink font-medium transition-all"
                  placeholder={isTradeParty ? "Acct #: XXXX-XXXX-XXXX / Bank: BDO" : "E.g., Commercial Remittance details"}
                />
                <div className="absolute left-3 top-3.5 text-ink-faint">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[10px] text-ink-faint leading-normal mt-1">
                {isTradeParty 
                  ? 'Sensitive financial info is stored securely and decrypted only for escrow settlement operations.'
                  : 'Logistics partners do not transact through bank settlement, but can list details for direct billings.'}
              </p>
            </div>

            {/* Stellar Ledger Wallet */}
            <div className="space-y-1.5">
              <label className="font-extrabold text-ink-faint uppercase tracking-wider font-mono text-[10px] block">
                Stellar Public Wallet Key (USDC Settlement)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={stellarWallet}
                  onChange={(e) => setStellarWallet(e.target.value)}
                  className="w-full bg-mist-light border border-mist rounded-xl pl-9 pr-4 py-3 outline-none focus:border-ink-faint text-ink font-mono text-xs transition-all"
                  placeholder="E.g., GCB1...Z9AC"
                />
                <div className="absolute left-3 top-3.5 text-ink-faint">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[10px] text-ink-faint leading-normal mt-1">
                Enter your public Stellar address beginning with &quot;G&quot;. Never share your secret key!
              </p>
            </div>

          </div>

          {/* Job Category Read-Only Badge */}
          <div className="bg-mist-light border border-mist rounded-xl p-4 flex justify-between items-center flex-wrap gap-2 text-xs">
            <div className="space-y-0.5">
              <span className="font-extrabold text-ink-faint uppercase font-mono text-[9px] tracking-wider block">Assigned Job Category Role</span>
              <strong className="text-ink font-bold uppercase">{currentUser?.jobRole?.replace(/_/g, ' ')}</strong>
            </div>
            <span className="text-[10px] text-ink-faint italic text-right md:max-w-xs leading-normal">
              Job role is set during onboarding and requires admin review to change.
            </span>
          </div>

        </div>

        {/* Form Actions footer */}
        <div className="bg-mist-light border-t border-mist px-6 py-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--theme-accent)' }}
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving changes...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Status config for the recent shipments list ─────────────────────────────

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string; bg: string }> = {
  PENDING_EXPORTER:  { label: 'Pending',          color: 'text-ink-faint',  bg: 'bg-mist' },
  COUNTER_OFFER:     { label: 'Counter Offer',    color: 'text-amber',      bg: 'bg-amber-light' },
  CONFIRMED:         { label: 'Confirmed',         color: 'text-teal',       bg: 'bg-teal-light' },
  ESCROW_FUNDED:     { label: 'Escrow Funded',     color: 'text-steel',      bg: 'bg-steel-light' },
  IN_TRANSIT:        { label: 'In Transit',         color: 'text-steel',      bg: 'bg-steel-light' },
  AT_PORT:           { label: 'At Port',            color: 'text-ink-faint',  bg: 'bg-mist' },
  CUSTOMS_CLEARANCE: { label: 'Customs',            color: 'text-teal',       bg: 'bg-teal-light' },
  OUT_FOR_DELIVERY:  { label: 'Out for Delivery',  color: 'text-amber',      bg: 'bg-amber-light' },
  DELIVERED:         { label: 'Delivered',          color: 'text-teal',       bg: 'bg-teal-light' },
  DISPUTED:          { label: 'Disputed',           color: 'text-wine',       bg: 'bg-wine-light' },
  CANCELLED:         { label: 'Cancelled',          color: 'text-ink-faint',  bg: 'bg-mist' },
};

// ─── Shipment Activity Section ───────────────────────────────────────────────

function ShipmentActivity({ userId, isTradeParty }: { userId: string; isTradeParty: boolean }) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading]     = useState(true);

  const fetchShipments = useCallback(async () => {
    try {
      const res  = await authFetch('/api/shipments');
      const json = await res.json();
      if (json.success && json.data) setShipments(json.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch-on-mount, setState occurs after await
  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  // ── Derived counts ──
  const total     = shipments.length;
  const active    = shipments.filter(s => !['DELIVERED', 'CANCELLED', 'DISPUTED'].includes(s.status)).length;
  const delivered = shipments.filter(s => s.status === 'DELIVERED').length;
  const disputed  = shipments.filter(s => s.status === 'DISPUTED').length;

  // ── Recent 4 shipments, newest first ──
  const recent = [...shipments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-4">

      {/* ── SECTION HEADER ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ship className="w-5 h-5" style={{ color: 'var(--theme-accent)' }} />
          <h2 className="text-lg font-display font-medium text-ink tracking-tight">Shipment Activity</h2>
        </div>
        <Link
          href="/shipments"
          className="flex items-center gap-1 text-[11px] font-bold transition-opacity hover:opacity-70"
          style={{ color: 'var(--theme-accent)' }}
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* ── STAT COUNTERS ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-mist rounded-2xl p-4 animate-pulse space-y-2">
              <div className="h-3 bg-mist rounded w-1/2" />
              <div className="h-7 bg-mist rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Total */}
          <div className="bg-white border border-mist rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-ink-faint">
              <Package className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Total</span>
            </div>
            <p className="text-3xl font-display font-medium text-ink">{String(total).padStart(2, '0')}</p>
            <p className="text-[10px] text-ink-faint">{isTradeParty ? 'shipments lodged' : 'assigned shipments'}</p>
          </div>

          {/* Active */}
          <div className="bg-white border border-mist rounded-2xl p-4 space-y-1" style={{ borderColor: 'var(--theme-accent-border)' }}>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--theme-accent)' }}>
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Active</span>
            </div>
            <p className="text-3xl font-display font-medium" style={{ color: 'var(--theme-accent)' }}>{String(active).padStart(2, '0')}</p>
            <p className="text-[10px] text-ink-faint">in progress now</p>
          </div>

          {/* Delivered */}
          <div className="bg-teal-light border border-teal/20 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-teal">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Delivered</span>
            </div>
            <p className="text-3xl font-display font-medium text-teal">{String(delivered).padStart(2, '0')}</p>
            <p className="text-[10px] text-teal/70">successfully completed</p>
          </div>

          {/* Disputed */}
          <div className={`rounded-2xl p-4 space-y-1 border ${
            disputed > 0 ? 'bg-wine-light border-wine/20' : 'bg-mist-light border-mist'
          }`}>
            <div className={`flex items-center gap-1.5 ${ disputed > 0 ? 'text-wine' : 'text-ink-faint' }`}>
              <XCircle className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Disputed</span>
            </div>
            <p className={`text-3xl font-display font-medium ${ disputed > 0 ? 'text-wine' : 'text-ink-faint' }`}>
              {String(disputed).padStart(2, '0')}
            </p>
            <p className={`text-[10px] ${ disputed > 0 ? 'text-wine/70' : 'text-ink-faint' }`}>under review</p>
          </div>
        </div>
      )}

      {/* ── RECENT SHIPMENTS ── */}
      <div className="bg-white border border-mist rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-mist flex items-center justify-between">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-ink-faint" /> Recent Shipments
          </h3>
          {!loading && total > 4 && (
            <span className="text-[10px] text-ink-faint">{total - 4} more</span>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-mist">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-8 h-8 bg-mist rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-mist rounded w-1/3" />
                  <div className="h-2.5 bg-mist rounded w-1/2" />
                </div>
                <div className="h-5 bg-mist rounded w-16" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Anchor className="w-8 h-8 text-mist-dark mx-auto" />
            <p className="text-xs font-bold text-ink-faint">No shipments yet</p>
            <p className="text-[10px] text-ink-faint/70">
              {isTradeParty ? 'Create your first shipment to get started.' : 'You haven\'t been assigned to any shipments yet.'}
            </p>
            {isTradeParty && (
              <Link
                href="/shipments/new"
                className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold hover:opacity-70 transition-opacity"
                style={{ color: 'var(--theme-accent)' }}
              >
                + New Shipment
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-mist">
            {recent.map(s => {
              const cfg = STATUS_CONFIG[s.status];
              return (
                <Link
                  key={s.id}
                  href="/shipments"
                  className="flex items-center gap-4 px-5 py-4 hover:bg-mist-light transition-colors group"
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--theme-accent-muted)' }}>
                    <Globe className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink truncate">{s.referenceCode}</span>
                      <span className="text-[9px] text-ink-faint font-mono shrink-0">
                        {s.shipmentScope === 'OVERSEAS' ? '🌐' : '🇵🇭'}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-faint truncate mt-0.5">
                      {s.description || `${s.originCountry} → ${s.destinationPort}`}
                    </p>
                  </div>

                  {/* Status pill + chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <ArrowRight className="w-3 h-3 text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { currentUser, setCurrentUser, loading } = useUserSession();

  if (loading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-accent)', borderTopColor: 'transparent' }} />
        </div>
      </DashboardLayout>
    );
  }

  const isTradeParty = currentUser.userType === 'TRADE_PARTY';

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ── PAGE HEADER ── */}
        <div className="space-y-1 border-b border-mist pb-5">
          <h1 className="text-3xl font-display font-medium text-ink tracking-tight flex items-center gap-2.5">
            <UserIcon className="w-7 h-7" style={{ color: 'var(--theme-accent)' }} />
            My Merchant Profile
          </h1>
          <p className="text-sm text-ink-faint">
            View and update your personal information, local PH bank accounts, company credentials, and Stellar escrow wallet.
          </p>
        </div>

        {/* ── SHIPMENT ACTIVITY ── */}
        <ShipmentActivity userId={currentUser.id} isTradeParty={isTradeParty} />

        {/* ── PROFILE FORM ── */}
        {currentUser?.id ? (
          <ProfileForm 
            key={currentUser.id} 
            currentUser={currentUser} 
            setCurrentUser={setCurrentUser} 
          />
        ) : (
          <div className="text-center py-12 text-ink-faint text-sm">
            No active profile session detected.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
