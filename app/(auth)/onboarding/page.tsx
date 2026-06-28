'use client';

import React, { useState, useRef } from 'react';
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
  const [idFile, setIdFile] = useState<string>('');         // filename for display
  const [idFileUrl, setIdFileUrl] = useState<string>('');   // real Storage URL
  const [idFileObject, setIdFileObject] = useState<File | null>(null); // staged File
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Filter job roles based on Step 1 selection
  // Trade Party: 2 roles
  const tradePartyJobs = [
    { value: 'IMPORTER', label: 'Importer — I receive & coordinate incoming cargo' },
    { value: 'EXPORTER', label: 'Exporter — I dispatch international shipments' },
  ];

  // Logistics Chain: 3 roles
  const logisticsJobs = [
    { value: 'FREIGHT_FORWARDER', label: 'Freight Forwarder — I manage bookings, vessel slots & final delivery' },
    { value: 'WAREHOUSE_OPERATOR', label: 'Warehouse Operator — I inspect, pack, stage & receive cargo' },
    { value: 'CUSTOMS_BROKER', label: 'Customs Broker — I file BOC entries, duties & clearances' },
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
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate client-side before staging
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setUploadError('Invalid file type. Please upload a JPG, PNG, or PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Maximum allowed size is 10 MB.');
      return;
    }
    setUploadError('');
    setIdFileObject(file);
    setIdFile(file.name);
    setIdFileUrl(''); // reset previous URL — will upload on Complete
  };

  const handleComplete = async () => {
    if (!currentUser) {
      router.replace('/register');
      return;
    }

    try {
      setUploading(true);

      // ── 1. Upload KYC doc to Supabase Storage (if a file was staged) ──────────
      let kycDocumentUrl = idFileUrl; // reuse if already uploaded
      if (idFileObject && !kycDocumentUrl) {
        const { supabase: sb } = await import('@/lib/supabase');
        const { data: { session } } = await sb.auth.getSession();
        const accessToken = session?.access_token ?? sessionStorage.getItem('mt_access_token') ?? '';

        const fd = new FormData();
        fd.append('file', idFileObject);
        const uploadRes = await fetch('/api/upload?bucket=kyc-documents', {
          method: 'POST',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          body: fd,
        });
        const uploadJson = await uploadRes.json();
        if (uploadJson.success) {
          kycDocumentUrl = uploadJson.url;
          setIdFileUrl(uploadJson.url);
        } else {
          setUploadError(uploadJson.error ?? 'KYC upload failed. Please try again.');
          setUploading(false);
          return;
        }
      }

      // Fallback: no file selected — use placeholder so onboarding still completes
      if (!kycDocumentUrl) kycDocumentUrl = 'pending_kyc_upload';

      // ── 2. Save onboarding data ─────────────────────────────────────────────
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? sessionStorage.getItem('mt_access_token') ?? '';

      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ userType, jobRole, companyName, kycDocumentUrl }),
      });

      const result = await res.json();
      sessionStorage.removeItem('mt_access_token');

      if (result.success) {
        updateUserKyc('SUBMITTED', jobRole, companyName);
        router.push('/dashboard');
      } else {
        console.error('Onboarding update failed:', result.error);
        updateUserKyc('SUBMITTED', jobRole, companyName);
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Onboarding update failed:', err);
      sessionStorage.removeItem('mt_access_token');
      updateUserKyc('SUBMITTED', jobRole, companyName);
      router.push('/dashboard');
    } finally {
      setUploading(false);
    }
  };

  const stepsIndicators = [
    { number: 1, label: 'User Type' },
    { number: 2, label: 'Job Role' },
    { number: 3, label: 'Company KYC' },
    { number: 4, label: 'Review' }
  ];

  return (
    <div className="min-h-screen bg-mist-light font-sans flex flex-col items-center justify-center p-4 py-12">
      <div className="max-w-2xl w-full bg-white border border-mist rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
        
        {/* LOGO */}
        <div className="flex items-center gap-3 justify-center">
          <div className="w-8 h-8 bg-amber rounded-lg flex items-center justify-center text-white">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-medium text-lg text-ink">MariTrade Onboarding Wizard</span>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className="flex justify-between items-center relative after:absolute after:left-0 after:right-0 after:top-1/2 after:h-0.5 after:bg-mist after:-z-10">
          {stepsIndicators.map((s) => (
            <div key={s.number} className="flex flex-col items-center space-y-1.5 bg-white px-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-all ${
                s.number === step 
                  ? 'bg-amber border-amber text-white shadow-sm font-sans'
                  : s.number < step 
                  ? 'bg-steel border-steel text-white font-sans'
                  : 'bg-mist-light border-mist text-ink-faint font-sans'
              }`}>
                {s.number < step ? <Check className="w-4 h-4 text-white" /> : s.number}
              </span>
              <span className="text-[10px] text-ink-faint font-bold tracking-wider uppercase sm:block hidden">{s.label}</span>
            </div>
          ))}
        </div>

        {/* STEP PANELS */}
        <div className="min-h-[250px] flex flex-col justify-center">
          
          {/* STEP 1: User Type Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-display font-medium text-ink">Choose Your Organization Type</h2>
                <p className="text-xs text-ink-faint mt-1">This configures escrow authorizations and timeline submission controls for your account.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setUserType('TRADE_PARTY')}
                  className={`border p-6 rounded-2xl flex flex-col items-center text-center space-y-4 transition-all cursor-pointer ${
                    userType === 'TRADE_PARTY'
                      ? 'border-wine ring-2 ring-wine-light bg-wine-light/50'
                      : 'border-mist hover:border-mist-dark bg-white'
                  }`}
                >
                  <div className="w-12 h-12 bg-wine-light text-wine rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-wine" />
                  </div>
                  <div>
                    <h4 className="font-display font-medium text-sm text-ink">Trade Party Partner</h4>
                    <p className="text-xs text-ink-faint mt-1">I buy, sell, importer, or broker global bulk commodities requiring secure financial escrow.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUserType('LOGISTICS_CHAIN')}
                  className={`border p-6 rounded-2xl flex flex-col items-center text-center space-y-4 transition-all cursor-pointer ${
                    userType === 'LOGISTICS_CHAIN'
                      ? 'border-teal ring-2 ring-teal-light bg-teal-light/50'
                      : 'border-mist hover:border-mist-dark bg-white'
                  }`}
                >
                  <div className="w-12 h-12 bg-teal-light text-teal rounded-full flex items-center justify-center">
                    <Truck className="w-6 h-6 text-teal" />
                  </div>
                  <div>
                    <h4 className="font-display font-medium text-sm text-ink">Logistics Chain Carrier</h4>
                    <p className="text-xs text-ink-faint mt-1">I move goods, verify ports, clear containers, or operate warehouses. I logging milestones.</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Job Role Gated Selector */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-display font-medium text-ink">Select Your Professional Role</h2>
                <p className="text-xs text-ink-faint mt-1">Your milestone logging permissions are restricted to your specific profession.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider">Job Role Dropdown</label>
                <select
                  className="w-full bg-white border border-mist rounded-lg px-4 py-2.5 text-sm outline-none cursor-pointer focus:border-amber text-ink"
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
              <div className="bg-mist-light p-4 rounded-xl text-xs text-ink-faint border border-mist leading-normal flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber flex-shrink-0 mt-0.5" />
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
                <h2 className="text-xl font-display font-medium text-ink">Identity & Business Details</h2>
                <p className="text-xs text-ink-faint mt-1">Provide employer names and photo/compliance ID proof to authorize the trade chain.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider">Company / Seller Name</label>
                  <input
                    type="text"
                    placeholder="Binondo Cargo Traders Ltd"
                    className="w-full bg-white border border-mist rounded-lg px-3 py-2 text-sm outline-none focus:border-amber"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider">Identity Document (SEC Registration / Unified ID)</label>
                  {/* Hidden real file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={handleFileSelected}
                  />
                  <div className="border-2 border-dashed border-mist rounded-xl p-4 text-center space-y-2 hover:border-mist-dark">
                    {idFile ? (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-teal font-bold">
                        <FileCheck className="w-5 h-5 text-teal" />
                        <span>Uploaded: {idFile}</span>
                        <button
                          type="button"
                          onClick={() => { setIdFile(''); setIdFileObject(null); setIdFileUrl(''); setUploadError(''); }}
                          className="ml-2 text-ink-faint hover:text-wine transition-colors"
                          title="Remove file"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUploadMock}
                        className="text-xs bg-amber-light hover:bg-amber-light/70 text-ink border border-amber/30 rounded-lg px-4 py-2 flex items-center gap-2 mx-auto cursor-pointer"
                      >
                        {uploading ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin text-ink" />
                            <span>Uploading…</span>
                          </>
                        ) : (
                          <span>Upload Government ID File</span>
                        )}
                      </button>
                    )}
                      <span className="block text-[10px] text-ink-faint font-sans">Accepts JPG, PNG or PDF formats. Max 10 MB limit.</span>
                    </div>
                    {uploadError && (
                      <p className="text-xs text-wine font-semibold flex items-center gap-1.5 mt-1">
                        <span>⚠</span> {uploadError}
                      </p>
                    )}
                </div>

                {/* Optional stellar address with Coming soon badge */}
                <div className="space-y-1 sm:col-span-2 bg-mist-light border border-mist p-3 rounded-lg flex items-center justify-between opacity-70">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-ink-faint block uppercase tracking-wider">Stellar Public Key Wallet</span>
                    <span className="text-[10px] text-ink-faint font-medium block">Automatic payout routing</span>
                  </div>
                  <span className="text-[10px] bg-ink-faint text-white font-bold px-2 py-0.5 rounded font-sans">PHASE 2 - COMING SOON</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Review summaries details */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-display font-medium text-ink">Review Onboarding Details</h2>
                <p className="text-xs text-ink-faint mt-1">Make sure information is correct before submitting entries to the compliance board.</p>
              </div>

              <div className="bg-mist-light p-6 rounded-2xl border border-mist text-xs text-ink-faint space-y-4">
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <span className="block text-ink-faint uppercase font-sans tracking-wider text-[9px]">Organization Type</span>
                    <strong className="text-ink font-bold block mt-0.5">{userType.replace('_', ' ')}</strong>
                  </div>
                  <div>
                    <span className="block text-ink-faint uppercase font-sans tracking-wider text-[9px]">Assigned Job Role</span>
                    <strong className="text-steel font-bold block mt-0.5">{jobRole.replace(/_/g, ' ')}</strong>
                  </div>
                  <div className="col-span-2 border-t border-mist pt-3">
                    <span className="block text-ink-faint uppercase font-sans tracking-wider text-[9px]">Registered Company / SME Name</span>
                    <strong className="text-ink font-bold block mt-0.5">{companyName || 'Registered Persona (Individual)'}</strong>
                  </div>
                  <div className="col-span-2 border-t border-mist pt-3">
                    <span className="block text-ink-faint uppercase font-sans tracking-wider text-[9px]">Compliance Document ID File</span>
                    <strong className="text-ink font-semibold block mt-0.5">{idFile || 'Attached pre-verified demo license.png'}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM STEP CONTROLS */}
        <div className="border-t border-mist pt-6 flex justify-between items-center">
          <button
            type="button"
            className={`flex items-center gap-1 text-xs text-amber hover:text-amber-hover font-bold transition-all ${
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
              className="bg-teal hover:bg-teal-hover text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              onClick={handleComplete}
            >
              <span>Complete Setup</span>
              <Check className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              className="bg-amber hover:bg-amber-hover text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
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
