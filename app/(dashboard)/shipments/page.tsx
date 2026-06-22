'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { 
  Ship, 
  Plus, 
  MapPin, 
  Calendar, 
  Coins, 
  ArrowRight,
  ChevronRight,
  Search
} from 'lucide-react';
import { Shipment } from '@/types';

export default function ShipmentsList() {
  const { currentUser } = useUserSession();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/shipments');
        const json = await res.json();
        if (json.success) {
          setShipments(json.data);
        }
      } catch {
        console.warn('Fallback loading');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = shipments.filter(s => 
    s.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.originCountry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight">Cargo Shipments</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor, assign logistics crews, and verify Stellar multisig escrow contract locks.</p>
        </div>

        {/* Create Shipment button only for Trade Parties */}
        {currentUser.userType === 'TRADE_PARTY' && (
          <Link
            href="/shipments/new"
            className="bg-maritime-400 hover:bg-maritime-900 text-white font-bold text-xs sm:text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>New Shipment Booking</span>
          </Link>
        )}
      </div>

      {/* Search and filters */}
      <div className="bg-white p-4 rounded-2xl border border-sand-200 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search cargo, reference MT-XXXX, or origin country..."
            className="w-full bg-sand-50 border border-sand-200 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-maritime-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-xs text-gray-500">
          Showing <strong className="text-gray-900 font-bold">{filtered.length}</strong> matching entries
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-sand-200">
          <div className="w-10 h-10 border-4 border-maritime-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-gray-400 font-mono">LOADING CENTRAL LEDGER INDEX...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-sand-200 rounded-3xl space-y-4">
          <Ship className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-maritime-900">No Active Shipments Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">There are no cargoes assigned to your profile in this segment. Let&apos;s negotiate or configure one in the messaging center!</p>
          {currentUser.userType === 'TRADE_PARTY' && (
            <div className="pt-2">
              <Link
                href="/shipments/new"
                className="bg-maritime-400 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                Book Shipping Record
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((ship) => (
            <div key={ship.id} className="bg-white border border-sand-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                {/* Ref header */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="block text-[9px] text-gray-400 font-mono tracking-wider">REF CODE</span>
                    <strong className="text-base font-black font-mono text-maritime-900">{ship.referenceCode}</strong>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    ship.status === 'DELIVERED' 
                      ? 'bg-green-100 text-green-700' 
                      : ship.status === 'IN_TRANSIT'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {ship.status?.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Scope & Description */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="bg-maritime-900 text-white text-[9px] font-black font-sans uppercase px-2 py-0.5 rounded">
                      {ship.shipmentScope}
                    </span>
                    <span className="bg-ocean-100 text-ocean-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                      {ship.escrowStatus}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed line-clamp-2">{ship.description}</p>
                </div>

                {/* Destination & Departure details */}
                <div className="border-t border-sand-200 pt-4 space-y-2 text-[11px] text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-maritime-400" />
                    <span>{ship.originCountry} → {ship.destinationPort}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-coral-400" />
                    <span>ETA: {new Date(ship.estimatedArrival || '').toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Card details */}
              <div className="border-t border-sand-200 pt-4 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-gray-400 font-mono block">ESCROW AMOUNT</span>
                  <strong className="text-maritime-900 font-bold font-mono text-sm">${ship.totalValueUSD?.toLocaleString()} USDC</strong>
                </div>
                
                <Link
                  href={`/shipments/${ship.id}`}
                  className="bg-maritime-50 hover:bg-maritime-900 border border-maritime-200 text-maritime-900 hover:text-white px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>Mgt Board</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
