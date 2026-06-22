'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { 
  Ship, 
  ArrowLeft, 
  ChevronLeft, 
  Globe, 
  MapPin, 
  Coins, 
  ClipboardCheck,
  Zap
} from 'lucide-react';
import { ShipmentScope } from '@/types';

export default function NewShipmentPage() {
  const router = useRouter();
  const { currentUser } = useUserSession();

  const [description, setDescription] = useState('');
  const [totalValueUSD, setTotalValueUSD] = useState('15000');
  const [originCountry, setOriginCountry] = useState('Japan');
  const [destinationPort, setDestinationPort] = useState('Port of Cebu');
  const [shipmentScope, setShipmentScope] = useState<ShipmentScope>('OVERSEAS');
  const [exporterId, setExporterId] = useState('exporter-osaka-id');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [aiAutofillText, setAiAutofillText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleAutofill = async () => {
    if (!aiAutofillText.trim()) return;
    try {
      setAiLoading(true);
      setErrorText('');
      const res = await fetch('/api/gemini/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceText: aiAutofillText })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDescription(data.data.cargoDescription || '');
        setTotalValueUSD(String(data.data.invoiceValueUSD || '12000'));
        setOriginCountry(data.data.originCountry || 'Japan');
        setDestinationPort(data.data.destinationPort || 'Port of Manila');
        setShipmentScope(data.data.shipmentScope || 'INTERNATIONAL_TRANSIT');
      } else {
        setErrorText('Failed to autofill. Please refine the text.');
      }
    } catch {
      setErrorText('Error communicating with Gemini autofill intelligence.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !totalValueUSD) {
      setErrorText('Please provide a cargo description and invoice value.');
      return;
    }

    try {
      setLoading(true);
      setErrorText('');
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importerId: currentUser.id,
          exporterId,
          description,
          totalValueUSD: Number(totalValueUSD),
          originCountry,
          destinationPort,
          shipmentScope
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        router.push(`/shipments/${json.data.id}`);
      } else {
        setErrorText(json.error || 'Failed to lodge the shipment.');
      }
    } catch {
      setErrorText('Network timeout. Please test again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <button
          onClick={() => router.push('/shipments')}
          className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-bold cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Shipments</span>
        </button>
        <h1 className="text-3xl font-black text-maritime-900 tracking-tight">Book Shipping Record</h1>
        <p className="text-xs text-gray-500">Formally initialize Stellar multi-signature contract tokens for incoming merchandise.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Core creation form (3/5 width) */}
        <div className="lg:col-span-3 bg-white border border-sand-200 p-6 sm:p-8 rounded-2xl shadow-sm space-y-6">
          <h3 className="font-extrabold text-sm text-maritime-900 flex items-center gap-2 border-b border-sand-100 pb-3">
            <ClipboardCheck className="w-5 h-5 text-maritime-400" />
            <span>Shipping Declaration Checklist</span>
          </h3>

          {errorText && (
            <p className="bg-coral-50 border border-coral-400/20 text-coral-600 font-semibold text-xs py-2 px-3 rounded-lg text-center">
              {errorText}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            <div className="space-y-1">
              <label className="block font-bold text-gray-700">Detailed Cargo Description</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. 40ft container containing high-precision automobile spares (Model RX-9)."
                className="w-full border border-sand-200 rounded p-2 text-xs outline-none focus:border-maritime-400"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Invoice Valuation (USDC / USD)</label>
                <div className="relative">
                  <Coins className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="number"
                    required
                    className="w-full border border-sand-200 rounded pl-8 pr-2.5 py-2 text-xs font-mono outline-none focus:border-maritime-400"
                    value={totalValueUSD}
                    onChange={(e) => setTotalValueUSD(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Shipping Transit Scope</label>
                <select
                  className="w-full border border-sand-200 rounded p-2 text-xs outline-none bg-white font-medium"
                  value={shipmentScope}
                  onChange={(e) => setShipmentScope(e.target.value as ShipmentScope)}
                >
                  <option value="OVERSEAS">OVERSEAS TRANSIT (USD Payout)</option>
                  <option value="NATIONWIDE">NATIONWIDE FLEET (USD + PHP Indicative conversion)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Origin Location</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    className="w-full border border-sand-200 rounded pl-8 pr-2 py-2 text-xs outline-none focus:border-maritime-400"
                    value={originCountry}
                    onChange={(e) => setOriginCountry(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Target Destination Port</label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    className="w-full border border-sand-200 rounded pl-8 pr-2 py-2 text-xs outline-none focus:border-maritime-400"
                    value={destinationPort}
                    onChange={(e) => setDestinationPort(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-maritime-400 hover:bg-maritime-900 text-white font-black py-2.5 rounded-lg text-xs leading-none transition-all uppercase tracking-wider cursor-pointer shadow-sm"
            >
              {loading ? 'Submitting to Bureau of Customs...' : 'Formally Lodge Cargo Shipment'}
            </button>
          </form>
        </div>

        {/* AI smart autofill text box (2/5 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-maritime-900 text-white p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-ocean-400" />
              <span>AI Invoice Autofill Tool</span>
            </h3>
            <p className="text-[11px] text-maritime-200 leading-normal">
              Paste details from your overseas commercial invoice text below. Gemini AI will automatically extract cargo descriptions, port codes, and stablecoin values instantly.
            </p>

            <div className="space-y-3 text-xs">
              <textarea
                rows={5}
                placeholder="CONSIGNOR: OSaka Ltd Tokyo&#10;ITEM: 90 Cartons of Solar Inverters&#10;VALUATION: USD 14,350&#10;PORT OF ENTRY: Cebu PH"
                className="w-full bg-maritime-800 text-white border border-maritime-700 rounded p-2 text-[11px] outline-none focus:ring-1 focus:ring-ocean-400 font-mono"
                value={aiAutofillText}
                onChange={(e) => setAiAutofillText(e.target.value)}
              />
              <button
                type="button"
                className="bg-ocean-400 hover:bg-ocean-600 text-maritime-900 w-full font-bold py-1.5 rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                onClick={handleAutofill}
                disabled={aiLoading}
              >
                {aiLoading ? 'Analysing Invoice...' : 'Extract Invoice Parameters'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
