'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserSession } from '@/hooks/use-user-session';
import { 
  Building2, 
  Truck, 
  MapPin, 
  FileCheck, 
  Coins, 
  Users, 
  ArrowRight, 
  ArrowLeft,
  Check,
  CreditCard,
  Lock,
  Loader
} from 'lucide-react';
import { UserType, JobRole } from '@/types';

export default function OnboardingPage() {
  const router = useRouter();
  const { currentUser, updateUserKyc } = useUserSession();

  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<UserType>('TRADE_PARTY');
  const [jobRole, setJobRole] = useState<JobRole>('IMPORTER');
  const [companyName, setCompanyName] = useState('');
  const [idFile, setIdFile] = useState<string>(''); // Mock upload path
  const [bankDetails, setBankDetails] = useState('');
  const [uploading, setUploading] = useState(false);

  // Filter job roles based on Step 1 selection
  const tradePartyJobs = [
    { value: 'IMPORTER', label: 'Importer (I coordinate incoming local containers)' },
    { value: 'EXPORTER', label: 'Exporter (I dispatch international shipments)' },
    { value: 'COMPANY_OWNER', label: 'Company Owner (Filipino SME Director)' },
    { value: 'TRADER', label: 'Trader (Intermediate Trade Agent)' }
  ];

  const logisticsJobs = [
    { value: 'FREIGHT_FORWARDER', label: 'Freight Forwarder (I coordinate vessel slots)' },
    { value: 'SHIPPING_LINE_CAPTAIN', label: 'Shipping Line / Captain (I verify water milestones)' },
    { value: 'CUSTOMS_BROKER', label: 'Customs Broker (I submit entries & duties)' },
    { value: 'WAREHOUSE_OPERATOR', label: 'Warehouse Operator (I pack, stage & unbox)' },
    { value: 'PORT_AUTHORITY_OFFICER', label: 'Port Authority Officer (I gate containers)' },
    { value: 'TRUCKER', label: 'Trucker (I deliver last mile toAddress)' }
  ];

  const handleNext = () => {
    if (step < 4) {
      // Auto-set starting default job role if user swapped type
      if (step === 1) {
        setJobRole(userType === 'TRADE_PARTY' ? 'IMPORTER' : 'FREIGHT_FORWARDER');
      }
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  const handleUploadMock = () => {
    setUploading(true);
    setTimeout(() => {
      setIdFile('boc_kyc_verify_' + Math.floor(Math.random() * 10000) + '.jpg');
      setUploading(false);
    }, 1000);
  };

  const handleComplete = async () => {
    try {
      // Call onboarding API
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userType,
          jobRole,
          companyName,
          kycDocumentUrl: idFile || 'https://picsum.photos/seed/kyc/800/600',
          bankDetails: bankDetails || null
        })
      });

      const result = await res.json();
      if (result.success) {
        // Update client-side session store
        updateUserKyc('SUBMITTED', jobRole, companyName);
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Onboarding update failed:', err);
      // Fallback
      updateUserKyc('SUBMITTED', jobRole, companyName);
      router.push('/dashboard');
    }
  };

  const stepsIndicators = [
    { number: 1, label: 'User Type' },
    { number: 2, label: 'Job Role' },
    { number: 3, label: 'Company KYC' },
    { number: 4, label: 'Review' }
  ];

  return (
    <div className="min-h-screen bg-sand-50 font-sans flex flex-col items-center justify-center p-4 py-12">
      <div className="max-w-2xl w-full bg-white border border-sand-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
        
        {/* LOGO */}
        <div className="flex items-center gap-3 justify-center">
          <div className="w-8 h-8 bg-maritime-400 rounded-lg flex items-center justify-center text-white">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-maritime-900">MariTrade Onboarding Wizard</span>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className="flex justify-between items-center relative after:absolute after:left-0 after:right-0 after:top-1/2 after:h-0.5 after:bg-sand-100 after:-z-10">
          {stepsIndicators.map((s) => (
            <div key={s.number} className="flex flex-col items-center space-y-1.5 bg-white px-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-all ${
                s.number === step 
                  ? 'bg-maritime-400 border-maritime-400 text-white shadow-sm font-mono'
                  : s.number < step 
                  ? 'bg-ocean-400 border-ocean-400 text-maritime-900 font-mono'
                  : 'bg-sand-100 border-sand-200 text-gray-400 font-mono'
              }`}>
                {s.number < step ? <Check className="w-4 h-4 text-maritime-900" /> : s.number}
              </span>
              <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase sm:block hidden">{s.label}</span>
            </div>
          ))}
        </div>

        {/* STEP PANELS */}
        <div className="min-h-[250px] flex flex-col justify-center">
          
          {/* STEP 1: User Type Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-extrabold text-maritime-900">Choose Your Organization Type</h2>
                <p className="text-xs text-gray-500 mt-1">This configures escrow authorizations and timeline submission controls for your account.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setUserType('TRADE_PARTY')}
                  className={`border p-6 rounded-2xl flex flex-col items-center text-center space-y-4 transition-all cursor-pointer ${
                    userType === 'TRADE_PARTY'
                      ? 'border-maritime-400 ring-2 ring-maritime-100 bg-maritime-50/50'
                      : 'border-sand-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="w-12 h-12 bg-maritime-100 text-maritime-900 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-maritime-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-maritime-900">Trade Party Partner</h4>
                    <p className="text-xs text-gray-500 mt-1">I buy, sell, importer, or broker global bulk commodities requiring secure financial escrow.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUserType('LOGISTICS_CHAIN')}
                  className={`border p-6 rounded-2xl flex flex-col items-center text-center space-y-4 transition-all cursor-pointer ${
                    userType === 'LOGISTICS_CHAIN'
                      ? 'border-maritime-400 ring-2 ring-maritime-100 bg-maritime-50/50'
                      : 'border-sand-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="w-12 h-12 bg-ocean-50 text-ocean-600 rounded-full flex items-center justify-center">
                    <Truck className="w-6 h-6 text-ocean-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-maritime-900">Logistics Chain Carrier</h4>
                    <p className="text-xs text-gray-500 mt-1">I move goods, verify ports, clear containers, or operate warehouses. I logging milestones.</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Job Role Gated Selector */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-extrabold text-maritime-900">Select Your Professional Role</h2>
                <p className="text-xs text-gray-500 mt-1">Your milestone logging permissions are restricted to your specific profession.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Job Role Dropdown</label>
                <select
                  className="w-full bg-sand-50 border border-sand-200 rounded-lg px-4 py-2.5 text-sm outline-none cursor-pointer focus:border-maritime-400 bg-white text-gray-800"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value as JobRole)}
                >
                  {userType === 'TRADE_PARTY' ? (
                    tradePartyJobs.map(job => (
                      <option key={job.value} value={job.value}>{job.label}</option>
                    ))
                  ) : (
                    logisticsJobs.map(job => (
                      <option key={job.value} value={job.value}>{job.label}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Security note badge */}
              <div className="bg-sand-100 p-4 rounded-xl text-xs text-gray-500 border border-sand-200 leading-normal flex items-start gap-2">
                <Lock className="w-4 h-4 text-maritime-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Permission Enforced:</strong> Milestone events can only be logged by carriers matching their respective role (e.g. Customs entries are locked with Customs Brokers).
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Identification Proof & Account detail */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-extrabold text-maritime-900">Identity & Business Details</h2>
                <p className="text-xs text-gray-500 mt-1">Provide employer names and photo/compliance ID proof to authorize the trade chain.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Company / Seller Name</label>
                  <input
                    type="text"
                    placeholder="Binondo Cargo Traders Ltd"
                    className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-maritime-400"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Identity Document (SEC Registration / Unified ID)</label>
                  <div className="border-2 border-dashed border-sand-200 rounded-xl p-4 text-center space-y-2 hover:border-gray-300">
                    {idFile ? (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-ocean-600 font-bold">
                        <FileCheck className="w-5 h-5 text-ocean-400" />
                        <span>Uploaded successfully: {idFile}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUploadMock}
                        className="text-xs bg-maritime-50 hover:bg-maritime-100 text-maritime-900 border border-maritime-200 rounded-lg px-4 py-2 flex items-center gap-2 mx-auto cursor-pointer"
                      >
                        {uploading ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin text-maritime-900" />
                            <span>Uploading compliance proof...</span>
                          </>
                        ) : (
                          <span>Upload Government ID File</span>
                        )}
                      </button>
                    )}
                    <span className="block text-[10px] text-gray-400 font-mono">Accepts JPG, PNG or PDF formats. Max 10MB limit.</span>
                  </div>
                </div>

                {/* TRADE PARTY ONLY: Encrypted bank details */}
                {userType === 'TRADE_PARTY' && (
                  <div className="space-y-1 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Bank Details (Trade Settlement)</label>
                      <span className="text-[9px] bg-coral-400 text-white font-bold tracking-wider px-1.5 rounded">ENCRYPTED AT REST</span>
                    </div>
                    <input
                      type="text"
                      placeholder="BDO Unibank Account • Juan Dela Cruz • 1024-5678-9012"
                      className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-maritime-400 focus:ring-1 focus:ring-coral-400/20"
                      value={bankDetails}
                      onChange={(e) => setBankDetails(e.target.value)}
                    />
                  </div>
                )}

                {/* Optional stellar address with Coming soon badge */}
                <div className="space-y-1 sm:col-span-2 bg-sand-100 border border-sand-200 p-3 rounded-lg flex items-center justify-between opacity-70">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-gray-500 block uppercase tracking-wider">Stellar Public Key Wallet</span>
                    <span className="text-[10px] text-gray-400 font-medium block">Automatic payout routing</span>
                  </div>
                  <span className="text-[10px] bg-gray-400 text-white font-bold px-2 py-0.5 rounded font-mono">PHASE 2 - COMING SOON</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Review summaries details */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-extrabold text-maritime-900">Review Onboarding Details</h2>
                <p className="text-xs text-gray-500 mt-1">Make sure information is correct before submitting entries to the compliance board.</p>
              </div>

              <div className="bg-sand-50 p-6 rounded-2xl border border-sand-200 text-xs text-gray-700 space-y-4">
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <span className="block text-gray-400 uppercase font-mono tracking-wider text-[9px]">Organization Type</span>
                    <strong className="text-maritime-900 font-bold block mt-0.5">{userType.replace('_', ' ')}</strong>
                  </div>
                  <div>
                    <span className="block text-gray-400 uppercase font-mono tracking-wider text-[9px]">Assigned Job Role</span>
                    <strong className="text-ocean-600 font-bold block mt-0.5">{jobRole.replace(/_/g, ' ')}</strong>
                  </div>
                  <div className="col-span-2 border-t border-sand-200 pt-3">
                    <span className="block text-gray-400 uppercase font-mono tracking-wider text-[9px]">Registered Company / SME Name</span>
                    <strong className="text-maritime-900 font-bold block mt-0.5">{companyName || 'Registered Persona (Individual)'}</strong>
                  </div>
                  <div className="col-span-2 border-t border-sand-200 pt-3">
                    <span className="block text-gray-400 uppercase font-mono tracking-wider text-[9px]">Compliance Document ID File</span>
                    <strong className="text-maritime-900 font-semibold block mt-0.5">{idFile || 'Attached pre-verified demo license.png'}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM STEP CONTROLS */}
        <div className="border-t border-sand-200 pt-6 flex justify-between items-center">
          <button
            type="button"
            className={`flex items-center gap-1 text-xs text-maritime-400 hover:text-maritime-900 font-bold transition-all ${
              step === 1 ? 'opacity-0 pointer-events-none' : ''
            }`}
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {step === 4 ? (
            <button
              type="button"
              className="bg-ocean-400 hover:bg-ocean-600 text-maritime-900 font-black px-6 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              onClick={handleComplete}
            >
              <span>Complete Setup</span>
              <Check className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              className="bg-maritime-400 hover:bg-maritime-900 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              onClick={handleNext}
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
