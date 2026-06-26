'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { User } from '@/types';
import { 
  User as UserIcon, 
  MapPin, 
  Phone, 
  Building2, 
  CreditCard, 
  Wallet, 
  CheckCircle2, 
  AlertCircle,
  Save
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
      const res = await fetch('/api/auth/profile', {
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Feedback Alerts */}
      {saveSuccess && (
        <div className="bg-ocean-50 border border-ocean-200 text-ocean-700 px-4 py-3.5 rounded-xl flex items-center gap-3 text-xs font-bold shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-ocean-400 flex-shrink-0" />
          <div>
            <span>Successfully updated! Your changes have been securely synchronized across the MariTrade ledger network.</span>
          </div>
        </div>
      )}

      {saveError && (
        <div className="bg-coral-50 border border-coral-200 text-coral-700 px-4 py-3.5 rounded-xl flex items-center gap-3 text-xs font-bold shadow-sm">
          <AlertCircle className="w-5 h-5 text-coral-400 flex-shrink-0" />
          <div>
            <span>Error: {saveError}</span>
          </div>
        </div>
      )}

      {/* Profile Card Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-sand-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header Status Bar */}
        <div className="bg-maritime-900 px-6 py-4 text-white flex justify-between items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-bold text-white uppercase">
              {currentUser?.fullName?.split(' ').map(n => n[0]).join('') || 'U'}
            </div>
            <div>
              <strong className="block text-sm leading-tight">{currentUser?.fullName}</strong>
              <span className="text-maritime-200 tracking-wider font-mono uppercase text-[9px]">ID: {currentUser?.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span className="bg-white/15 text-[10px] uppercase font-bold px-2 py-0.5 rounded text-white tracking-widest">
              {currentUser?.userType?.replace(/_/g, ' ')}
            </span>
            <span className="bg-ocean-400/25 text-ocean-300 font-bold px-2 py-0.5 rounded text-xs">
              KYC: {currentUser?.kycStatus}
            </span>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          
          {/* Split Row: Name and Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-extrabold text-gray-500 uppercase tracking-wider font-mono text-[10px] block">
                Full Account Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-sand-50 border border-sand-200 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-maritime-400 text-gray-800 font-medium transition-all"
                  placeholder="Enter your registered name"
                />
                <div className="absolute left-3 top-3.5 text-gray-400">
                  <UserIcon className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-gray-500 uppercase tracking-wider font-mono text-[10px] block">
                System Registered Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={currentUser?.email}
                  disabled
                  className="w-full bg-sand-100 border border-sand-200 rounded-xl pl-9 pr-4 py-3 text-gray-400 font-mono text-xs cursor-not-allowed select-none outline-none"
                />
                <div className="absolute left-3 top-3.5 text-gray-400">
                  <span className="text-xs font-mono font-bold">@</span>
                </div>
              </div>
              <span className="text-[10px] text-gray-400 block italic">Email identifiers are hardlocked after merchant validation keys are computed.</span>
            </div>
          </div>

          {/* Split Row: Contact Number and Company */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-extrabold text-gray-500 uppercase tracking-wider font-mono text-[10px] block">
                Contact Number (PH format +63)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full bg-sand-50 border border-sand-200 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-maritime-400 text-gray-800 font-medium transition-all"
                  placeholder="+63 9XX XXX XXXX"
                />
                <div className="absolute left-3 top-3.5 text-gray-400">
                  <Phone className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-gray-500 uppercase tracking-wider font-mono text-[10px] block">
                Company / Organization Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-sand-50 border border-sand-200 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-maritime-400 text-gray-800 font-medium transition-all"
                  placeholder="E.g., Manila Logistics Corporation"
                />
                <div className="absolute left-3 top-3.5 text-gray-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Address Field */}
          <div className="space-y-1.5 text-xs">
            <label className="font-extrabold text-gray-500 uppercase tracking-wider font-mono text-[10px] block">
              Primary Registered Address
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                className="w-full bg-sand-50 border border-sand-200 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-maritime-400 text-gray-800 font-medium transition-all"
                placeholder="Enter business building, street address, region, etc."
              />
              <div className="absolute left-3 top-3.5 text-gray-400">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Split Row: Bank Details & Stellar Wallet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs border-t border-dashed border-sand-200 pt-5">
            
            {/* Private Bank Details */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-extrabold text-gray-500 uppercase tracking-wider font-mono text-[10px] block">
                  {isTradeParty ? 'BDO / PH Bank Account (Encrypted)' : 'Internal Remittance Bank (Optional)'}
                </label>
                {!isTradeParty && (
                  <span className="text-[9px] bg-sand-100 text-gray-500 font-bold px-1 py-0.5 rounded uppercase font-sans">
                    Logistics Profile
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={bankDetails}
                  onChange={(e) => setBankDetails(e.target.value)}
                  className="w-full bg-sand-50 border border-sand-200 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-maritime-400 text-gray-800 font-medium transition-all"
                  placeholder={isTradeParty ? "Acct #: XXXX-XXXX-XXXX / Bank: BDO" : "E.g., Commercial Remittance details"}
                />
                <div className="absolute left-3 top-3.5 text-gray-400">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[10px] text-gray-405 leading-normal text-gray-400 mt-1">
                {isTradeParty 
                  ? 'Sensitive financial info is stored securely and decrypted only for escrow settlement operations.'
                  : 'Logistics partners do not transact through bank settlement, but can list details for direct billings.'}
              </p>
            </div>

            {/* Stellar Ledger Wallet */}
            <div className="space-y-1.5">
              <label className="font-extrabold text-gray-500 uppercase tracking-wider font-mono text-[10px] block">
                Stellar Public Wallet Key (USDC Settlement)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={stellarWallet}
                  onChange={(e) => setStellarWallet(e.target.value)}
                  className="w-full bg-sand-50 border border-sand-200 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-maritime-400 text-gray-800 font-mono text-xs transition-all"
                  placeholder="E.g., GCB1...Z9AC"
                />
                <div className="absolute left-3 top-3.5 text-gray-400">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[10px] text-gray-405 leading-normal text-gray-400 mt-1">
                Enter your public Stellar address beginning with &quot;G&quot;. Never share your secret key!
              </p>
            </div>

          </div>

          {/* Job Category Read-Only Badge */}
          <div className="bg-sand-50 border border-sand-200 rounded-xl p-4 flex justify-between items-center flex-wrap gap-2 text-xs">
            <div className="space-y-0.5">
              <span className="font-extrabold text-gray-400 uppercase font-mono text-[9px] tracking-wider block">Assigned Job Category Role</span>
              <strong className="text-gray-700 font-bold uppercase">{currentUser?.jobRole?.replace(/_/g, ' ')}</strong>
            </div>
            <span className="text-[10px] text-gray-400 italic text-right md:max-w-xs leading-normal">
              Job role is set during onboarding and requires admin review to change.
            </span>
          </div>

        </div>

        {/* Form Actions footer */}
        <div className="bg-sand-50 border-t border-sand-200 px-6 py-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-maritime-400 hover:bg-maritime-900 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving changes...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  const { currentUser, setCurrentUser, allUsers } = useUserSession();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Title Section */}
        <div className="space-y-2 border-b border-sand-200 pb-4">
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight flex items-center gap-2">
            <UserIcon className="w-8 h-8 text-maritime-400" />
            <span>My Merchant Profile</span>
          </h1>
          <p className="text-sm text-gray-500">
            View and update your personal information, local PH bank accounts, company credentials, and Stellar escrow wallet.
          </p>
        </div>

        {currentUser?.id ? (
          <ProfileForm 
            key={currentUser.id} 
            currentUser={currentUser} 
            setCurrentUser={setCurrentUser} 
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            No active profile session detected.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
