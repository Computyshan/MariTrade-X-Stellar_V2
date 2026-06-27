'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { 
  Settings, 
  User, 
  ShieldCheck, 
  FileText, 
  Activity, 
  HelpCircle,
  Cpu
} from 'lucide-react';

export default function SettingsPage() {
  const { currentUser, loading } = useUserSession();

  if (loading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-maritime-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-3xl font-black text-maritime-900 tracking-tight">System Settings & Portal Profiles</h1>
        <p className="text-sm text-gray-500">Configure trade partner nodes, manage key signatures, and verify Stellar network endpoints.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Profile Card */}
        <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm text-xs space-y-4">
          <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
            <User className="w-5 h-5 text-maritime-400" />
            <span>Active Merchant Persona</span>
          </h3>

          <div className="space-y-3 font-medium text-gray-600">
            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-mono tracking-wider">FULL NAME</span>
              <strong className="text-maritime-900 font-bold block">{currentUser.fullName}</strong>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-mono tracking-wider">KYC VERIFICATION ID</span>
              <strong className="text-maritime-900 font-mono block">MT-KYC-{currentUser.id.substring(0, 10).toUpperCase()}</strong>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-mono tracking-wider">JOB CATEGORY ROLE</span>
              <strong className="text-ocean-600 font-bold block uppercase">{currentUser.jobRole.replace(/_/g, ' ')}</strong>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 block uppercase font-mono tracking-wider">REGISTERED SME / COMPANY</span>
              <strong className="text-maritime-900 font-bold block">{currentUser.companyName || 'Persona (Individual Trader)'}</strong>
            </div>

            <div className="border-t border-sand-200 pt-3">
              <span className="text-[10px] text-gray-400 block leading-normal">
                To update your profile details, visit the <strong>My Profile</strong> page from the sidebar.
              </span>
            </div>
          </div>
        </div>

        {/* Blockchain Config diagnostics */}
        <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm text-xs space-y-4">
          <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
            <Cpu className="w-5 h-5 text-ocean-400" />
            <span>Digital Ledger Diagnostics</span>
          </h3>

          <div className="space-y-3 font-mono text-[11px] text-gray-600">
            <div className="flex justify-between border-b border-sand-100 pb-1.5">
              <span>STABLECOIN ID:</span>
              <strong className="text-maritime-900 font-bold">USDC</strong>
            </div>
            <div className="flex justify-between border-b border-sand-100 pb-1.5">
              <span>BOC ENCRYPTION:</span>
              <strong className="text-maritime-900 font-bold">AES-GCM-256</strong>
            </div>
            <div className="flex justify-between border-b border-sand-100 pb-1.5">
              <span>GEMINI INSTANCE:</span>
              {/* HARDCODED FIX: derived from env var, not a static string */}
              <strong className="text-maritime-900 font-bold">
                {process.env.NEXT_PUBLIC_GEMINI_MODEL ?? 'gemini-2.0-flash'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>STELLAR NETWORK:</span>
              {/* HARDCODED FIX: derived from env var */}
              <strong className="text-ocean-600 font-bold uppercase">
                {process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet'}
              </strong>
            </div>
          </div>
        </div>

        {/* Portal Information FAQs */}
        <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm text-xs space-y-4">
          <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-coral-400" />
            <span>Usage Guidelines</span>
          </h3>

          <div className="space-y-3 text-gray-600 leading-relaxed font-sans">
            <p>
              <strong>What is the counter-offer rule?</strong> Importers and Exporters negotiate terms inside the Trade Negotiations tab. Countering updates the temporary price. Accepting the offer generates an immutable escrow.
            </p>
            <p>
              <strong>How is the cargo proof validated?</strong> To release escrow funds, importers must log signed handoffs or attach port-verified clearance logs to trigger payout releases.
            </p>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
