'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  Ship, 
  MapPin, 
  Clock, 
  Calendar, 
  Globe, 
  AlertCircle, 
  Search, 
  ChevronLeft,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { MilestoneEvent, Shipment } from '@/types';

export default function PublicTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [shipment, setShipment] = useState<Partial<Shipment> | null>(null);
  const [milestones, setMilestones] = useState<MilestoneEvent[]>([]);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!code) return;

    const fetchPublicTracking = async () => {
      try {
        setLoading(true);
        setErrorText('');
        const res = await fetch(`/api/track/${code}`);
        const result = await res.json();
        
        if (result.success && result.data) {
          setShipment(result.data.shipment);
          setMilestones(result.data.milestones || []);
        } else {
          setErrorText(result.error || 'Tracking code not found');
        }
      } catch (err) {
        setErrorText('Failed to reach tracking server. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicTracking();
  }, [code]);

  return (
    <div className="min-h-screen bg-sand-50 font-sans flex flex-col text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-sand-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-maritime-400" />
            <span className="font-extrabold text-lg text-maritime-900">MariTrade</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs bg-maritime-400 hover:bg-maritime-900 text-white font-bold px-3 py-1.5 rounded-lg transition-all"
          >
            Dashboard Portal
          </Link>
        </div>
      </header>

      {/* Main Panel */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 py-8 space-y-6">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-medium cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        {loading ? (
          <div className="bg-white border border-sand-200 p-8 rounded-2xl flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-ocean-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-mono text-gray-500">Retrieving tracking records from Stellar hub...</p>
          </div>
        ) : errorText ? (
          <div className="bg-white border border-sand-200 p-8 rounded-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-coral-50 text-coral-400 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-maritime-900">Tracking Code Not Found</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">The reference code <code className="bg-sand-100 px-1.5 py-0.5 rounded text-coral-600 font-mono text-xs">{code}</code> does not match any active cargo shipments in our secure database.</p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-block bg-maritime-400 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                Try Another Search
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Shipment Status Header Card */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 font-mono tracking-wider">MARITRADE ID</span>
                  <h1 className="text-2xl font-black font-mono tracking-wide text-maritime-900">{shipment?.referenceCode}</h1>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wide ${
                    shipment?.status === 'DELIVERED' 
                      ? 'bg-ocean-100 text-ocean-600' 
                      : shipment?.status === 'IN_TRANSIT'
                      ? 'bg-maritime-100 text-maritime-900'
                      : 'bg-sand-100 text-gray-600'
                  }`}>
                    {shipment?.status?.replace('_', ' ')}
                  </span>
                  <span className="text-[11px] font-bold bg-maritime-900 text-white px-3 py-1 rounded-full">
                    {shipment?.shipmentScope}
                  </span>
                </div>
              </div>

              <div className="border-t border-sand-200 pt-4 space-y-2">
                <h3 className="font-semibold text-sm text-gray-800">Cargos & Freight Items</h3>
                <p className="text-sm text-gray-600 font-medium leading-relaxed bg-sand-50 p-3 rounded-lg border border-sand-200">{shipment?.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-sand-201 pt-4 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-maritime-400" />
                  <div>
                    <span className="block text-[10px] uppercase font-mono tracking-wider">Cargo Origin</span>
                    <span className="font-semibold text-maritime-900">{shipment?.originCountry}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-ocean-400" />
                  <div>
                    <span className="block text-[10px] uppercase font-mono tracking-wider">Destination Port</span>
                    <span className="font-semibold text-maritime-900">{shipment?.destinationPort}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-1 sm:col-span-2 pt-2 border-t border-dashed border-sand-200">
                  <Calendar className="w-4 h-4 text-coral-400" />
                  <div>
                    <span className="block text-[10px] uppercase font-mono tracking-wider">Estimated Arrival (ETA)</span>
                    <span className="font-semibold text-maritime-900">{shipment?.estimatedArrival ? new Date(shipment.estimatedArrival).toLocaleString() : 'Pending Confirmation'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Public Secure Escrow Visual Shield */}
            <div className="bg-ocean-50 border border-ocean-100 p-4 rounded-xl flex items-center gap-3">
              <Lock className="w-5 h-5 text-ocean-600 flex-shrink-0" />
              <div className="text-xs text-ocean-600 leading-normal">
                <span className="font-bold uppercase tracking-wider block mb-0.5">Stellar Escrow Protection Active</span>
                Contract funds are secured on the distributed Stellar Ledger. Escrow balances, legal bill of lading PDFs, and duty receipts are hidden in compliance with BOC file permissions.
              </div>
            </div>

            {/* Milestone Timeline Card */}
            <div className="bg-white border border-sand-200 p-6 rounded-2xl shadow-sm space-y-6">
              <h2 className="font-extrabold text-base text-maritime-900 tracking-tight flex items-center gap-2">
                <Clock className="w-5 h-5 text-maritime-400" />
                <span>Cargo Handoff & Verification Timeline</span>
              </h2>

              {milestones.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs font-mono space-y-1">
                  <p>NO HANDOFF EVENTS REPORTED YET</p>
                  <p className="text-[10px]">Awaiting shipping lines and freight forwarders booking confirmations...</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-sand-200">
                  {milestones.map((me) => (
                    <div key={me.id} className="relative space-y-1">
                      {/* Circle indicator */}
                      <span className="absolute -left-[21.5px] top-1.5 w-3.5 h-3.5 rounded-full bg-ocean-400 border-2 border-white ring-4 ring-ocean-50 inline-block"></span>
                      
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                        <span className="text-xs font-bold font-mono tracking-tight text-maritime-900 bg-maritime-50 px-2 py-0.5 rounded border border-maritime-100">
                          {me.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(me.occurredAt).toLocaleString()}
                        </span>
                      </div>

                      {me.description && (
                        <p className="text-xs text-gray-600 pl-1 leading-normal">{me.description}</p>
                      )}

                      <div className="flex items-center gap-1 text-[10px] text-ocean-600 pl-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-ocean-400" />
                        <span>Milestone logged with photo proof verification</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MariTrade Signup Banner */}
            <div className="bg-maritime-900 p-6 sm:p-8 text-white rounded-2xl text-center space-y-4 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-ocean-400 to-transparent"></div>
              <h3 className="text-lg font-bold">Are you a Filipino Importer or Carrier?</h3>
              <p className="text-xs text-maritime-100 max-w-md mx-auto">Get absolute payment safety and end-to-end container logistics handoff transparency on MariTrade.</p>
              <div>
                <Link
                  href="/"
                  className="bg-ocean-400 hover:bg-ocean-600 text-maritime-900 text-xs font-extrabold px-5 py-2.5 rounded-lg inline-block transition-all"
                >
                  Create Free Account Now
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-sand-200 py-6 text-center text-xs text-gray-500 mt-auto">
        <p className="font-mono">MariTrade Secure Ledger Public Auditing. Verification ID: MARITRADE-PUBLIC-SECURE</p>
      </footer>
    </div>
  );
}
