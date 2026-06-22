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
  const { currentUser } = useUserSession();

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
                Need to preview a separate scenario? Use the <strong>Demo Workspace Dropdown bar</strong> at the top of the screen to instantaneously exchange profiles.
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
              <span>STELLAR NETWORK:</span>
              <strong className="text-ocean-600 font-bold">TESTNET (horizon)</strong>
            </div>
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
              <strong className="text-maritime-900 font-bold">gemini-3.5-flash</strong>
            </div>
            <div className="flex justify-between">
              <span>LEDGER PING:</span>
              <strong className="text-green-600 font-bold">ACTIVE (12ms)</strong>
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
