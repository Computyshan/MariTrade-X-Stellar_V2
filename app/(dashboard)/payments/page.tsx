'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { 
  CreditCard, 
  Coins, 
  Lock, 
  HelpCircle, 
  ArrowRight, 
  CheckCircle2, 
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Shipment } from '@/types';

export default function EscrowLedger() {
  const { currentUser } = useUserSession();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/shipments');
        const json = await res.json();
        if (json.success && json.data) {
          setShipments(json.data);
        }
      } catch {
        console.warn('Escrow load fallback');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [currentUser]);

  // Totals
  const totalLocked = shipments
    .filter(s => s.escrowStatus === 'FUNDED')
    .reduce((accum, s) => accum + s.totalValueUSD, 0);

  const totalReleased = shipments
    .filter(s => s.escrowStatus === 'RELEASED')
    .reduce((accum, s) => accum + s.totalValueUSD, 0);

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight">Escrow Ledger Status</h1>
          <p className="text-sm text-gray-500 mt-1">Audit multi-signature contract vaults and track historical merchant settlements on Stellar.</p>
        </div>
      </div>

      {/* Numerical values cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-2">
          <Coins className="w-8 h-8 text-maritime-400 block mb-1" />
          <span className="text-[10px] text-gray-400 font-mono tracking-wider font-bold uppercase block">ACTIVE CONTRACTS LOCKED</span>
          <strong className="text-3xl text-maritime-900 font-extrabold font-monoblock">${totalLocked?.toLocaleString()} USDC</strong>
          <span className="text-[9px] text-ocean-600 block italic">₱{(totalLocked * 58.7).toLocaleString()} PHP local equivalent</span>
        </div>

        <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-2">
          <CheckCircle2 className="w-8 h-8 text-green-400 block mb-1" />
          <span className="text-[10px] text-gray-400 font-mono tracking-wider font-bold uppercase block">CUMULATIVE SETTLED PAYOUTS</span>
          <strong className="text-3xl text-maritime-900 font-extrabold font-mono block">${totalReleased?.toLocaleString()} USDC</strong>
          <span className="text-[9px] text-ocean-600 block italic">₱{(totalReleased * 58.7).toLocaleString()} PHP local equivalent</span>
        </div>

        <div className="bg-maritime-900 text-white p-6 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-maritime-800 opacity-50"></div>
          <div className="relative space-y-3">
            <Lock className="w-7 h-7 text-ocean-400 block" />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-ocean-400">Security Architecture</h4>
            <p className="text-[11px] text-maritime-100 leading-normal">
              MariTrade custody complies with high-grade Stellar transaction protocol specifications, ensuring funds never disperse without multi-party handoff consents.
            </p>
          </div>
        </div>
      </div>

      {/* List detailed contract transactions */}
      <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm text-maritime-900">Customs Broker & Vendor Escrow Audit</h3>

        {loading ? (
          <div className="text-center py-6">
            <div className="w-6 h-6 border-2 border-maritime-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs font-mono">
            NO SHIPMENT RECORDS LODGED FOR PAYOUT AUDITING.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-sand-50 text-gray-500 font-bold uppercase font-mono text-[10px] border-b border-sand-200">
                <tr>
                  <th className="px-4 py-3">Shipment Ref</th>
                  <th className="px-4 py-3">Scope Type</th>
                  <th className="px-4 py-3">Valuation (USD)</th>
                  <th className="px-4 py-3">Escrow Status</th>
                  <th className="px-4 py-3 text-right">Ledger hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-sand-50/50">
                    <td className="px-4 py-3.5 font-bold font-mono text-maritime-900">{s.referenceCode}</td>
                    <td className="px-4 py-3.5 text-gray-500 uppercase font-bold text-[10px]">{s.shipmentScope.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3.5 font-bold font-mono text-maritime-900">${s.totalValueUSD?.toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        s.escrowStatus === 'RELEASED' 
                          ? 'bg-green-100 text-green-700' 
                          : s.escrowStatus === 'FUNDED'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-sand-100 text-gray-650'
                      }`}>
                        {s.escrowStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-[10px] text-gray-400">
                      {s.stellarEscrowId ? (
                        <span className="flex items-center justify-end gap-1 font-semibold text-ocean-600">
                          <span>{s.stellarEscrowId.substring(0, 8)}...</span>
                          <ExternalLink className="w-3 h-3 text-ocean-400" />
                        </span>
                      ) : (
                        <span>tx_pending_ledger</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
