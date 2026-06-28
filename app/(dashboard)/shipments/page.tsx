'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
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
  const { currentUser, loading: sessionLoading } = useUserSession();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await authFetch('/api/shipments');
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

  if (sessionLoading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const filtered = shipments.filter(s => 
    s.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.originCountry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-medium text-ink tracking-tight">Cargo Shipments</h1>
          <p className="text-sm text-ink-faint mt-1">Monitor, assign logistics crews, and verify Stellar multisig escrow contract locks.</p>
        </div>

        {/* Create Shipment button only for Trade Parties */}
        {currentUser.userType === 'TRADE_PARTY' && (
          <Link
            href="/shipments/new"
            className="bg-amber hover:bg-amber-hover text-white font-bold text-xs sm:text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>New Shipment Booking</span>
          </Link>
        )}
      </div>

      {/* Search and filters */}
      <div className="bg-white p-4 rounded-2xl border border-mist flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-ink-faint absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search cargo, reference MT-XXXX, or origin country..."
            className="w-full bg-mist-light border border-mist rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-amber"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-xs text-ink-faint">
          Showing <strong className="text-ink font-bold">{filtered.length}</strong> matching entries
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-mist">
          <div className="w-10 h-10 border-4 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-ink-faint font-sans">LOADING CENTRAL LEDGER INDEX...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-mist rounded-3xl space-y-4">
          <Ship className="w-12 h-12 text-mist-dark mx-auto" />
          <h3 className="text-base font-display font-medium text-ink">No Active Shipments Found</h3>
          <p className="text-xs text-ink-faint max-w-sm mx-auto">There are no cargoes assigned to your profile in this segment. Let&apos;s negotiate or configure one in the messaging center!</p>
          {currentUser.userType === 'TRADE_PARTY' && (
            <div className="pt-2">
              <Link
                href="/shipments/new"
                className="bg-amber text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                Book Shipping Record
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((ship) => (
            <div key={ship.id} className="bg-white border border-mist rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                {/* Ref header */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="block text-[9px] text-ink-faint font-sans tracking-wider">REF CODE</span>
                    <strong className="text-base font-bold font-sans text-ink">{ship.referenceCode}</strong>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    ship.status === 'DELIVERED' 
                      ? 'bg-teal-light text-teal' 
                      : ship.status === 'IN_TRANSIT'
                      ? 'bg-steel-light text-steel'
                      : 'bg-amber-light text-amber'
                  }`}>
                    {ship.status?.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Scope & Description */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="bg-ink text-white text-[9px] font-bold font-sans uppercase px-2 py-0.5 rounded">
                      {ship.shipmentScope}
                    </span>
                    <span className="bg-steel-light text-steel text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                      {ship.escrowStatus}
                    </span>
                  </div>
                  <p className="text-xs text-ink-faint font-medium leading-relaxed line-clamp-2">{ship.description}</p>
                </div>

                {/* Destination & Departure details */}
                <div className="border-t border-mist pt-4 space-y-2 text-[11px] text-ink-faint">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber" />
                    <span>{ship.originCountry} → {ship.destinationPort}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-wine" />
                    <span>ETA: {new Date(ship.estimatedArrival || '').toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Card details */}
              <div className="border-t border-mist pt-4 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-ink-faint font-sans block">ESCROW AMOUNT</span>
                  <strong className="text-ink font-bold font-sans text-sm">${ship.totalValueUSD?.toLocaleString()} USDC</strong>
                </div>
                
                <Link
                  href={`/shipments/${ship.id}`}
                  className="bg-amber-light hover:bg-amber border border-amber/30 text-ink hover:text-white px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
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
