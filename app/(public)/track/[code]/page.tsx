'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin,
  Clock,
  Calendar,
  Globe,
  AlertCircle,
  ChevronLeft,
  CheckCircle2,
  Lock,
  ArrowRight,
  Building2,
  Users,
  Truck,
  ClipboardCheck,
  Warehouse,
} from 'lucide-react';
import { MilestoneEvent, Shipment, JobRole, TrackingTier } from '@/types';

interface TrackingBranding {
  logoUrl?: string;
  primaryColor?: string;
  companyLabel?: string;
}

interface LogisticsChainMember {
  fullName: string;
  jobRole: JobRole;
  companyName?: string;
}

interface InvolvedParties {
  importerCompany: string;
  exporterCompany?: string;
  logisticsChain: LogisticsChainMember[];
}

const ROLE_ICON: Record<string, React.ReactNode> = {
  FREIGHT_FORWARDER: <Truck className="w-4 h-4 text-steel" />,
  CUSTOMS_BROKER: <ClipboardCheck className="w-4 h-4 text-steel" />,
  WAREHOUSE_OPERATOR: <Warehouse className="w-4 h-4 text-steel" />,
};

const ROLE_LABEL: Record<string, string> = {
  FREIGHT_FORWARDER: 'Freight Forwarder',
  CUSTOMS_BROKER: 'Customs Broker',
  WAREHOUSE_OPERATOR: 'Warehouse Operator',
};

export default function PublicTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [shipment, setShipment] = useState<Partial<Shipment> | null>(null);
  const [milestones, setMilestones] = useState<MilestoneEvent[]>([]);
  const [involvedParties, setInvolvedParties] = useState<InvolvedParties | null>(null);
  const [tier, setTier] = useState<TrackingTier>('TIMELINE');
  const [branding, setBranding] = useState<TrackingBranding | undefined>(undefined);
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
          setInvolvedParties(result.data.involvedParties || null);
          setTier(result.data.tier || 'BRANDED');
          setBranding(result.data.branding || undefined);
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
    <div className="min-h-screen bg-mist-light font-sans flex flex-col text-ink">
      {/* Header */}
      <header className="bg-white border-b border-mist sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {tier === 'WHITELABEL' && branding?.logoUrl ? (
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={branding.logoUrl} alt={branding.companyLabel || 'Tracking'} className="h-9 w-auto object-contain" />
              {branding.companyLabel && (
                <span className="text-sm font-bold text-ink">{branding.companyLabel}</span>
              )}
            </div>
          ) : (
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/MariTrade logo.png"
                alt="MariTrade"
                width={110}
                height={44}
                className="h-9 w-auto object-contain"
              />
            </Link>
          )}
          <Link
            href="/login"
            className="text-[12px] bg-amber hover:bg-amber-hover text-white font-semibold px-4 py-2 rounded-md transition-colors"
            style={tier === 'WHITELABEL' && branding?.primaryColor ? { background: branding.primaryColor } : undefined}
          >
            Dashboard Portal
          </Link>
        </div>
      </header>

      {/* Main Panel */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-[12px] text-ink-faint hover:text-ink font-semibold cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        {loading ? (
          <div className="bg-white border border-mist p-10 rounded-xl flex flex-col items-center justify-center gap-4">
            <div className="w-9 h-9 border-4 border-amber border-t-transparent rounded-full animate-spin" />
            <p className="text-[12px] text-ink-faint">Retrieving tracking records&hellip;</p>
          </div>
        ) : errorText ? (
          <div className="bg-white border border-mist p-10 rounded-xl text-center space-y-4">
            <div className="w-12 h-12 bg-wine-light text-wine rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-display font-medium text-[22px] text-ink">Tracking Code Not Found</h3>
            <p className="text-[13px] text-ink-faint max-w-md mx-auto leading-relaxed">
              The reference code{' '}
              <code className="bg-mist-light px-1.5 py-0.5 rounded text-wine font-mono text-[12px]">{code}</code>{' '}
              does not match any active shipments in our records.
            </p>
            <div className="pt-1">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 bg-amber hover:bg-amber-hover text-white text-[12px] font-semibold px-5 py-2.5 rounded-md transition-colors"
              >
                Try Another Search
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Top row: Shipment Status + Shipment Parties side by side on larger screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

            {/* Shipment Status Header Card */}
            <div className="bg-white border border-mist p-5 rounded-xl shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] text-ink-faint font-sans uppercase tracking-widest">MariTrade Reference</span>
                  <h1 className="text-[30px] font-display font-medium tracking-tight text-ink mt-0.5 leading-none">{shipment?.referenceCode}</h1>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide ${
                      shipment?.status === 'DELIVERED'
                        ? 'bg-teal-light text-teal'
                        : shipment?.status === 'IN_TRANSIT'
                        ? 'bg-steel-light text-steel'
                        : 'bg-mist-light text-ink-faint'
                    }`}
                  >
                    {shipment?.status?.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] font-bold bg-ink text-white px-3 py-1 rounded-full uppercase tracking-wide">
                    {shipment?.shipmentScope}
                  </span>
                </div>
              </div>

              <div className="border-t border-mist pt-3.5 space-y-2">
                <h3 className="font-display font-medium text-[17px] text-ink">Cargo &amp; Freight Description</h3>
                <p className="text-[13px] text-ink-faint leading-relaxed bg-mist-light p-3 rounded-md border border-mist">
                  {shipment?.description}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-mist pt-3.5 text-[12px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-light flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-amber" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-ink-faint">Cargo Origin</span>
                    <span className="font-semibold text-ink">{shipment?.originCountry}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-steel-light flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-steel" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-ink-faint">Destination Port</span>
                    <span className="font-semibold text-ink">{shipment?.destinationPort}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 pt-2.5 border-t border-dashed border-mist">
                  <div className="w-8 h-8 rounded-lg bg-teal-light flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-teal" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-ink-faint">Estimated Arrival (ETA)</span>
                    <span className="font-semibold text-ink">
                      {shipment?.estimatedArrival ? new Date(shipment.estimatedArrival).toLocaleString() : 'Pending Confirmation'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipment Parties Card */}
            <div className="bg-white border border-mist p-5 rounded-xl shadow-sm space-y-4">
              <h2 className="font-display font-medium text-[19px] text-ink flex items-center gap-2">
                <Users className="w-4 h-4 text-ink-faint" />
                <span>Users Involved</span>
              </h2>

              <div className="grid grid-cols-1 gap-3">
                {/* Trade Party — company names only */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-wine-light flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-wine" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-ink-faint">Importer (Company)</span>
                    <span className="font-semibold text-ink text-[13px]">{involvedParties?.importerCompany}</span>
                  </div>
                </div>
                {involvedParties?.exporterCompany && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-wine-light flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-wine" />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-widest text-ink-faint">Exporter (Company)</span>
                      <span className="font-semibold text-ink text-[13px]">{involvedParties.exporterCompany}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Logistics Chain — individual name + role */}
              {involvedParties && involvedParties.logisticsChain.length > 0 && (
                <div className="border-t border-mist pt-3.5 space-y-3">
                  <span className="block text-[10px] uppercase tracking-widest text-ink-faint">Logistics Chain</span>
                  <div className="grid grid-cols-1 gap-3">
                    {involvedParties.logisticsChain.map((member, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-steel-light flex items-center justify-center shrink-0">
                          {ROLE_ICON[member.jobRole] ?? <Truck className="w-4 h-4 text-steel" />}
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase tracking-widest text-ink-faint">
                            {ROLE_LABEL[member.jobRole] ?? member.jobRole.replace(/_/g, ' ')}
                          </span>
                          <span className="font-semibold text-ink text-[13px]">{member.fullName}</span>
                          {member.companyName && (
                            <span className="block text-[11px] text-ink-faint">{member.companyName}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            </div>
            <div className="bg-amber-light border border-amber/25 p-4 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-amber" />
              </div>
              <div className="text-[12px] text-ink-faint leading-relaxed">
                <span className="font-bold uppercase tracking-wide text-ink block mb-0.5 text-[11px]">Stellar Escrow Protection Active</span>
                Payment for this shipment is secured in on-chain escrow. Financial details, documents, and duty receipts stay private and are not shown on this public page.
              </div>
            </div>

            {/* Milestone Timeline Card — gated by tracking tier */}
            {tier === 'BRANDED' ? (
              <div className="bg-white border border-mist p-6 rounded-xl shadow-sm space-y-3 text-center">
                <Clock className="w-8 h-8 text-mist-dark mx-auto" />
                <p className="text-[13px] font-bold text-ink">Live milestone-by-milestone tracking is not enabled for this shipment</p>
                <p className="text-[11px] text-ink-faint max-w-md mx-auto leading-relaxed">
                  This sender is on the Branded Link tier, which shows status updates only.
                  Current status: <strong className="text-ink">{shipment?.status?.replace(/_/g, ' ')}</strong>
                </p>
              </div>
            ) : (
            <div className="bg-white border border-mist p-6 rounded-xl shadow-sm space-y-5">
              <h2 className="font-display font-medium text-[19px] text-ink flex items-center gap-2">
                <Clock className="w-4 h-4 text-ink-faint" />
                <span>Cargo Handoff &amp; Verification Timeline</span>
              </h2>

              {milestones.length === 0 ? (
                <div className="text-center py-8 text-ink-faint text-[12px] space-y-1">
                  <p className="font-semibold">No handoff events reported yet</p>
                  <p className="text-[11px]">Awaiting confirmation from the assigned logistics chain&hellip;</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-7 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-mist">
                  {milestones.map((me) => (
                    <div key={me.id} className="relative space-y-1.5">
                      <span
                        className="absolute -left-[21.5px] top-1 w-3.5 h-3.5 rounded-full bg-teal border-2 border-white ring-4 ring-teal-light inline-block"
                        style={tier === 'WHITELABEL' && branding?.primaryColor ? { background: branding.primaryColor } : undefined}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[11px] font-bold tracking-tight text-ink bg-mist-light px-2 py-0.5 rounded border border-mist">
                          {me.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-ink-faint">{new Date(me.occurredAt).toLocaleString()}</span>
                      </div>

                      {me.description && <p className="text-[12px] text-ink-faint pl-0.5 leading-relaxed">{me.description}</p>}

                      <div className="flex items-center gap-1 text-[10px] text-teal pl-0.5 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Milestone logged with photo proof verification</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Signup Banner — suppressed on white-label pages to keep the embed clean */}
            {tier !== 'WHITELABEL' && (
            <div className="bg-ink p-6 sm:p-8 text-white rounded-xl text-center space-y-4 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle at center, var(--color-amber) 0%, transparent 70%)' }}
              />
              <h3 className="font-display font-medium text-[24px] relative z-10">Are you a Filipino Importer or Logistics Provider?</h3>
              <p className="text-[12px] text-mist max-w-md mx-auto relative z-10 leading-relaxed">
                Get full payment protection and end-to-end shipment transparency on MariTrade.
              </p>
              <div className="relative z-10">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 bg-amber hover:bg-amber-hover text-white text-[12px] font-bold px-5 py-2.5 rounded-md transition-colors"
                >
                  Create Free Account
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-mist py-6 text-center text-[11px] text-ink-faint mt-auto">
        <p>MariTrade Public Shipment Tracker &mdash; Verified by the Bureau of Customs</p>
      </footer>
    </div>
  );
}
