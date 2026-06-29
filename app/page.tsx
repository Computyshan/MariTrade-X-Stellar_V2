'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Anchor, 
  ShieldCheck, 
  Search, 
  ArrowRight, 
  FileLock2, 
  Coins, 
  TrendingUp, 
  Bell, 
  User, 
  CheckCircle,
  FileText,
  Truck,
  Globe,
  Lock,
  Zap,
  BarChart3,
  ChevronRight,
  Package,
  PackageCheck,
  ClipboardCheck,
  Building2,
  Users,
  Stamp,
} from 'lucide-react';
import { motion } from 'motion/react';
import RotatingText from '@/components/RotatingText';

export default function LandingPage() {
  const router = useRouter();
  const [trackCode, setTrackCode] = useState('');
  const [errorSearch, setErrorSearch] = useState('');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeGroup, setActiveGroup] = useState<'trade' | 'logistics' | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 30;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackCode.trim()) return;
    const formatted = trackCode.trim().toUpperCase();
    // HARDCODED FIX: removed hardcoded reference code whitelist.
    // Any MT-format code is valid to attempt; the /track/[code] page will show
    // a not-found state if the shipment doesn't exist in the DB.
    if (/^MT-\d{4}-\d{5}$/.test(formatted)) {
      router.push(`/track/${formatted}`);
    } else {
      setErrorSearch('Reference code must match format MT-YYYY-NNNNN');
    }
  };

  return (
    <div className="min-h-screen bg-mist-light text-ink flex flex-col font-sans select-none scroll-smooth">

      {/* Navigation */}
      <nav className="sticky top-0 z-50 flex justify-between items-center w-full px-8 py-0 h-16 bg-white border-b border-mist">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/MariTrade logo.png"
              alt="MariTrade"
              width={120}
              height={48}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <span className="text-[13px] font-semibold text-amber border-b-2 border-amber px-3 py-[18px] cursor-pointer">Platform</span>
            <span className="text-[13px] font-semibold text-ink-faint hover:text-ink px-3 py-[18px] cursor-pointer transition-colors">How it works</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-[13px] font-semibold text-ink-faint hover:text-ink rounded-md hover:bg-mist-light transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="flex items-center gap-1.5 px-5 py-2 bg-amber text-white text-[13px] font-semibold rounded-md hover:bg-amber-hover transition-colors shadow-sm"
          >
            Register
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      <main className="flex-1">

        {/* Hero */}
        <section className="relative overflow-hidden bg-ink min-h-[680px] flex flex-col items-center justify-center text-center px-6">

          {/* Subtle ambient glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute top-[20%] left-[30%] w-[500px] h-[500px] rounded-full opacity-[0.07]"
              style={{
                background: 'radial-gradient(circle, var(--color-steel) 0%, transparent 70%)',
                transform: `translate(${mousePos.x}px, ${mousePos.y}px)`,
                transition: 'transform 0.6s ease-out',
              }}
            />
            <div
              className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] rounded-full opacity-[0.05]"
              style={{
                background: 'radial-gradient(circle, var(--color-amber) 0%, transparent 70%)',
                transform: `translate(${-mousePos.x}px, ${-mousePos.y}px)`,
                transition: 'transform 0.6s ease-out',
              }}
            />
            {/* Subtle grid lines */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }}
            />
          </div>

          <div className="relative z-20 max-w-3xl mx-auto space-y-6">


            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-[80px] font-display font-medium text-white leading-[1.1] tracking-tight">
              Track your Shipments.<br className="hidden sm:block" />
              <span>Digitize the Process.</span><br className="hidden sm:block" />
              <span className="inline whitespace-nowrap">Made for Filipino{' '}
              <RotatingText
                texts={['Importers', 'Exporters', 'Freight Forwarders', 'Custom Brokers', 'Warehouse Operators', 'Businesses.']}
                splitBy="words"
                staggerFrom="last"
                staggerDuration={0.04}
                rotationInterval={2200}
                transition={{ type: 'spring', damping: 30, stiffness: 380 }}
                initial={{ y: '110%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '-110%', opacity: 0 }}
                mainClassName="text-mist !inline-flex"
                splitLevelClassName="overflow-hidden"
                style={{ display: 'inline-flex', verticalAlign: 'baseline', minWidth: '10ch' }}
              /></span>
            </h1>

            {/* Subtext */}
            <p className="text-[15px] text-mist max-w-xl mx-auto leading-relaxed">
             Digitize freight shipping with MariTrade — a blockchain-powered escrow platform built for Filipino importers, exporters, and the logistics chain that connects them.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/register"
                className="px-7 py-3 bg-amber text-white text-[13px] font-bold rounded-md hover:bg-amber-hover transition-colors shadow-lg shadow-amber/30 flex items-center justify-center gap-2"
              >
                Start for Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => window.open('mailto:hello@maritrade.ph?subject=Watch Demo Request', '_blank')}
                className="px-7 py-3 border border-white/15 text-white text-[13px] font-semibold rounded-md hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
              >
                Watch Demo
              </button>
            </div>

            {/* Public shipment tracker */}
            <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4 max-w-xl mx-auto w-full">
              <p className="text-[11px] font-sans text-mist uppercase tracking-widest mb-3 text-left">Public Shipment Tracker</p>
              <form onSubmit={handleTrackSubmit} className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input
                    type="text"
                    placeholder="Enter reference code  (e.g. MT-2026-00341)"
                    className="w-full bg-white text-ink rounded-md px-3 py-2.5 pl-9 outline-none text-[13px] focus:ring-2 focus:ring-amber border border-transparent"
                    value={trackCode}
                    onChange={(e) => { setTrackCode(e.target.value); setErrorSearch(''); }}
                  />
                </div>
                <button
                  type="submit"
                  className="bg-amber hover:bg-amber-hover text-white px-5 py-2.5 rounded-md text-[13px] font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  Track
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
              {errorSearch && (
                <p className="text-wine-light text-[11px] text-left mt-2 pl-1 font-sans">⚠ {errorSearch}</p>
              )}
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mist">
                <span>Sample codes:</span>
                <button type="button" onClick={() => { setTrackCode('MT-2026-00341'); setErrorSearch(''); }} className="text-steel hover:text-white transition-colors underline underline-offset-2">MT-2026-00341</button>
                <button type="button" onClick={() => { setTrackCode('MT-2026-00122'); setErrorSearch(''); }} className="text-steel hover:text-white transition-colors underline underline-offset-2">MT-2026-00122</button>
              </div>
            </div>

          </div>
        </section>

        {/* How it works*/}
        <section className="py-20 px-6 sm:px-8 max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-[26px] font-sans uppercase tracking-widest text-amber font-bold">The MariTrade Flow</span>
            <h2 className="text-2xl sm:text-[55px] font-display font-medium text-ink tracking-tight mt-2 leading-tight">
              Payment-secured. Milestone-verified. Settled instantly.
            </h2>
            <p className="text-[13px] text-ink-faint mt-3 leading-relaxed">
              Every peso in escrow moves only when verified events are confirmed by each member of your logistics chain.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 relative">
            {/* Connector line */}
            <div className="hidden sm:block absolute top-[52px] left-[calc(16.66%+20px)] right-[calc(16.66%+20px)] h-px bg-mist z-0" />
            {[
              {
                icon: <FileLock2 className="w-5 h-5 text-amber" />,
                iconBg: 'bg-amber-light',
                dot: 'bg-amber',
                title: 'Create & Fund',
                desc: 'Importer creates a shipment record, assigns the logistics team, uploads documents, and locks USDC payment into multi-signature escrow.',
              },
              {
                icon: <Truck className="w-5 h-5 text-steel" />,
                iconBg: 'bg-steel-light',
                dot: 'bg-steel',
                title: 'Milestone Logging',
                desc: 'Each logistics role — freight forwarder, customs broker, warehouse — logs verified checkpoints with timestamped photo proof as cargo moves.',
              },
              {
                icon: <CheckCircle className="w-5 h-5 text-teal" />,
                iconBg: 'bg-teal-light',
                dot: 'bg-teal',
                title: 'Verify & Release',
                desc: 'Importer reviews all milestones and authorizes escrow release. Exporter receives USDC in seconds — no forms, no bank delays.',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: i * 0.12, ease: 'easeOut' }}
                className="relative z-10 flex flex-col items-center text-center px-6 py-8"
              >
                <div className={`w-[52px] h-[52px] rounded-full ${item.iconBg} border-4 border-mist-light flex items-center justify-center mb-5 shadow-sm`}>
                  {item.icon}
                </div>
                <h3 className="font-display font-medium text-[15px] text-ink mb-2">{item.title}</h3>
                <p className="text-[13px] text-ink-faint leading-relaxed max-w-[220px]">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How to Use MariTrade — Role Guide */}
        <section className="py-20 px-6 sm:px-8 bg-white border-t border-mist">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="text-[10px] font-sans uppercase tracking-widest text-amber font-bold">Role-Based Guide</span>
              <h2 className="text-2xl sm:text-[32px] font-display font-medium text-ink tracking-tight mt-2 leading-tight">
                How to use MariTrade — by role
              </h2>
              <p className="text-[13px] text-ink-faint mt-3 leading-relaxed">
                Select your role in the trade chain to see your workflow.
              </p>
            </div>

            {/* Group selector */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">

              {/* ── Trade Party selector ── amber border + wine icon */}
              <button
                type="button"
                onClick={() => setActiveGroup(activeGroup === 'trade' ? null : 'trade')}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all text-left ${
                  activeGroup === 'trade'
                    ? 'border-amber bg-amber-light shadow-md shadow-amber/15'
                    : 'border-mist bg-mist-light hover:border-amber/50'
                }`}
              >
                {/* Mini portal logo + icon stacked */}
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    activeGroup === 'trade' ? 'bg-wine' : 'bg-mist'
                  }`}>
                    <Users className={`w-4 h-4 ${activeGroup === 'trade' ? 'text-white' : 'text-ink-faint'}`} />
                  </div>
                  {activeGroup === 'trade' && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber flex items-center justify-center">
                      <Image src="/MariTrade-Trade-Party-Logo.png" alt="" width={14} height={14} className="w-3.5 h-3.5 object-contain" />
                    </div>
                  )}
                </div>
                <div>
                  <p className={`text-[13px] font-medium leading-tight ${
                    activeGroup === 'trade' ? 'text-wine' : 'text-ink'
                  }`}>Trade Party</p>
                  <p className="text-[11px] text-ink-faint mt-0.5">Importer · Exporter</p>
                </div>
                <ChevronRight className={`w-4 h-4 ml-6 transition-all ${
                  activeGroup === 'trade' ? 'text-wine rotate-90' : 'text-ink-faint'
                }`} />
              </button>

              {/* ── Logistics Chain selector ── teal border + steel icon */}
              <button
                type="button"
                onClick={() => setActiveGroup(activeGroup === 'logistics' ? null : 'logistics')}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all text-left ${
                  activeGroup === 'logistics'
                    ? 'border-teal bg-teal-light shadow-md shadow-teal/15'
                    : 'border-mist bg-mist-light hover:border-teal/50'
                }`}
              >
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    activeGroup === 'logistics' ? 'bg-steel' : 'bg-mist'
                  }`}>
                    <Truck className={`w-4 h-4 ${activeGroup === 'logistics' ? 'text-white' : 'text-ink-faint'}`} />
                  </div>
                  {activeGroup === 'logistics' && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-teal flex items-center justify-center">
                      <Image src="/MariTrade-Logistic-Chain-Logo.png" alt="" width={14} height={14} className="w-3.5 h-3.5 object-contain" />
                    </div>
                  )}
                </div>
                <div>
                  <p className={`text-[13px] font-medium leading-tight ${
                    activeGroup === 'logistics' ? 'text-steel' : 'text-ink'
                  }`}>Logistics Chain</p>
                  <p className="text-[11px] text-ink-faint mt-0.5">Freight · Customs · Warehouse</p>
                </div>
                <ChevronRight className={`w-4 h-4 ml-6 transition-all ${
                  activeGroup === 'logistics' ? 'text-steel rotate-90' : 'text-ink-faint'
                }`} />
              </button>
            </div>

            {/* Trade Party cards — Amber + Wine */}
            {activeGroup === 'trade' && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-5"
              >
                {[
                  {
                    role: 'Importer',
                    icon: <Package className="w-5 h-5 text-wine" />,
                    tagline: 'You initiate and fund the shipment. MariTrade keeps your payment safe until delivery is verified.',
                    stepBg: 'bg-wine',
                    steps: [
                      'Create a shipment record — enter cargo details, route, and expected milestones.',
                      'Assign your logistics partners (freight forwarder, customs broker, warehouse operator) from your network.',
                      'Fund the escrow with USDC — your payment is cryptographically locked until verified.',
                      'Monitor real-time milestone updates, then authorize escrow release once all stages are confirmed.',
                    ],
                  },
                  {
                    role: 'Exporter',
                    icon: <PackageCheck className="w-5 h-5 text-wine" />,
                    tagline: 'You prepare and dispatch the goods. MariTrade guarantees you get paid once the importer confirms delivery.',
                    stepBg: 'bg-amber',
                    steps: [
                      'Accept a shipment invitation from the importer through your MariTrade dashboard.',
                      'Confirm cargo readiness and coordinate pickup with the assigned freight forwarder.',
                      'Track milestone confirmations as your cargo is verified through each logistics stage.',
                      'Receive your USDC payment instantly once the importer authorizes escrow release.',
                    ],
                  },
                ].map((card, i) => (
                  <motion.div
                    key={card.role}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.08, ease: 'easeOut' }}
                    className="rounded-xl border border-wine/20 overflow-hidden shadow-sm"
                    style={{ background: 'linear-gradient(160deg, var(--color-amber-light) 0%, var(--color-wine-light) 100%)' }}
                  >
                    {/* Dual-colour top bar: amber → wine */}
                    <div className="h-[3px] w-full" style={{ background: 'linear-gradient(to right, var(--color-amber), var(--color-wine))' }} />
                    <div className="p-7">
                      <div className="flex items-start gap-4 mb-5">
                        {/* Icon backed by a faint wine wash */}
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--theme-feature-muted)' }}>
                          {card.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-display font-medium text-[16px] text-wine leading-tight">{card.role}</h3>
                            <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full text-white bg-amber">TRADE PARTY</span>
                          </div>
                          <p className="text-[12px] text-ink-faint leading-relaxed">{card.tagline}</p>
                        </div>
                      </div>
                      <ol className="space-y-3">
                        {card.steps.map((step, si) => (
                          <li key={si} className="flex items-start gap-3">
                            <span className={`shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5 text-white ${card.stepBg}`}>
                              {si + 1}
                            </span>
                            <span className="text-[13px] text-ink-faint leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Logistics Chain cards — Teal + Steel */}
            {activeGroup === 'logistics' && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-5"
              >
                {[
                  {
                    role: 'Freight Forwarder',
                    icon: <Truck className="w-5 h-5 text-steel" />,
                    tagline: 'You move the cargo. Log every checkpoint with proof and keep the whole chain informed in real time.',
                    stepBg: 'bg-teal',
                    steps: [
                      "Accept your assignment from the importer's shipment dashboard.",
                      'Log origin departure with timestamped photos and vessel details.',
                      'Update transit checkpoints as cargo moves toward the destination port.',
                      'Confirm vessel arrival and hand off to the assigned customs broker.',
                    ],
                  },
                  {
                    role: 'Customs Broker',
                    icon: <ClipboardCheck className="w-5 h-5 text-steel" />,
                    tagline: 'You clear the cargo. Access the document center and log every BOC milestone with reference numbers.',
                    stepBg: 'bg-steel',
                    steps: [
                      'Access the BOC Document Center for your assigned shipment — read-only, secured.',
                      'Review uploaded shipping documents, packing lists, and import permits.',
                      'Log customs clearance milestones with BOC reference numbers and scan copies.',
                      'Confirm cargo release from BOC and hand off to the warehouse operator.',
                    ],
                  },
                  {
                    role: 'Warehouse Operator',
                    icon: <Building2 className="w-5 h-5 text-steel" />,
                    tagline: 'You receive and store the cargo. Log the final leg of the shipment to trigger escrow release.',
                    stepBg: 'bg-teal',
                    steps: [
                      'Accept the cargo handover from the customs broker once BOC clearance is confirmed.',
                      'Log receiving milestone — include cargo condition notes and photo documentation.',
                      'Update storage status and bay location within your warehouse.',
                      'Log final dispatch to the importer or designated consignee to close the shipment.',
                    ],
                  },
                ].map((card, i) => (
                  <motion.div
                    key={card.role}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.08, ease: 'easeOut' }}
                    className="rounded-xl border border-steel/20 overflow-hidden shadow-sm"
                    style={{ background: 'linear-gradient(160deg, var(--color-teal-light) 0%, var(--color-steel-light) 100%)' }}
                  >
                    {/* Dual-colour top bar: teal → steel */}
                    <div className="h-[3px] w-full" style={{ background: 'linear-gradient(to right, var(--color-teal), var(--color-steel))' }} />
                    <div className="p-6">
                      <div className="flex items-start gap-3 mb-5">
                        {/* Icon backed by a faint steel wash */}
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-steel-light)' }}>
                          {card.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-display font-medium text-[14px] text-steel leading-tight">{card.role}</h3>
                          </div>
                          <p className="text-[11px] text-ink-faint leading-snug">{card.tagline}</p>
                        </div>
                      </div>
                      <ol className="space-y-2.5">
                        {card.steps.map((step, si) => (
                          <li key={si} className="flex items-start gap-2.5">
                            <span className={`shrink-0 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center mt-0.5 text-white ${card.stepBg}`}>
                              {si + 1}
                            </span>
                            <span className="text-[12px] text-ink-faint leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>

        {/* Capabilities strip */}
        <section className="bg-white border-t border-b border-mist py-14 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-[15px] font-sans uppercase tracking-widest text-amber font-bold">Built for the Whole Chain</span>
              <h2 className="text-[24px] font-display font-medium text-ink mt-2 tracking-tight">Everything the trade chain needs</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: <Lock className="w-5 h-5 text-amber" />, title: 'Multi-Sig Escrow', desc: 'USDC held in Stellar 3-of-3 multi-signature accounts. No single party can unilaterally move funds.' },
                { icon: <BarChart3 className="w-5 h-5 text-amber" />, title: 'Real-Time Milestone Feed', desc: 'Live updates from every logistics role — freight, customs, warehouse — consolidated in one view.' },
                { icon: <Globe className="w-5 h-5 text-amber" />, title: 'Built-In Messaging', desc: 'Communicate with your logistics network inside MariTrade. No more scattered emails or messaging apps.' },
                { icon: <FileText className="w-5 h-5 text-amber" />, title: 'BOC Document Center', desc: 'Shipping and customs documents stored in an authorized folder per shipment — customs brokers get dedicated read access.' },
                { icon: <Zap className="w-5 h-5 text-amber" />, title: 'Instant Settlement', desc: 'All milestones confirmed? Escrow releases to the exporter in seconds. No bank forms, no delays.' },
                { icon: <ShieldCheck className="w-5 h-5 text-amber" />, title: 'Dispute-Proof Trail', desc: 'Every milestone is timestamped and photo-verified on-chain — a full audit trail that speaks for itself.' },
              ].map((cap, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, delay: i * 0.07, ease: 'easeOut' }}
                  className="p-5 rounded-xl border border-mist hover:border-amber/30 hover:shadow-sm transition-all bg-mist-light"
                >
                  <div className="w-9 h-9 bg-amber-light rounded-lg flex items-center justify-center mb-4">
                    {cap.icon}
                  </div>
                  <h3 className="font-display font-medium text-[14px] text-ink mb-1.5">{cap.title}</h3>
                  <p className="text-[12px] text-ink-faint leading-relaxed">{cap.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-ink text-center px-6">
          <div className="max-w-2xl mx-auto space-y-5">
            <h2 className="text-[32px] font-display font-medium text-white tracking-tight leading-tight">
              Ready to protect your next<br />cargo shipment?
            </h2>
            <p className="text-[14px] text-mist max-w-md mx-auto leading-relaxed">
            
              MariTrade digitizes freight shipping with full payment protection and supply chain transparency for Filipino importers, exporters, and logistics operators.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Link
                href="/register"
                className="px-8 py-3 bg-amber text-white rounded-md text-[13px] font-bold hover:bg-amber-hover transition-colors shadow-lg shadow-amber/30 flex items-center justify-center gap-2"
              >
                Get Started — Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => window.open('mailto:hello@maritrade.ph?subject=Talk to Team Request', '_blank')}
                className="px-8 py-3 border border-white/15 text-white rounded-md text-[13px] font-semibold hover:bg-white/5 transition-colors"
              >
                Talk to Our Team
              </button>
            </div>
            <p className="text-[11px] text-ink-faint font-sans">No credit card required · Currently in Early Access</p>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-mist py-14 px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12 pb-10 border-b border-mist">
          <div className="space-y-3 max-w-xs">
            <div className="flex items-center">
              <Image
                src="/MariTrade logo.png"
                alt="MariTrade"
                width={100}
                height={40}
                className="h-8 w-auto object-contain"
              />
            </div>
            <p className="text-[12px] text-ink-faint leading-relaxed">
              Blockchain-powered escrow and logistics for Filipino MSME Owners. Built on Stellar. Verified by the Bureau of Customs.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {[
              { title: 'Platform', links: ['Terms of Use', 'Privacy Policy',] },
            ].map((col) => (
              <div key={col.title} className="space-y-3">
                <h4 className="text-[10px] font-sans font-bold text-ink uppercase tracking-widest">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link} className="text-[12px] text-ink-faint hover:text-ink cursor-pointer transition-colors">{link}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-ink-faint font-sans">
          <span>© 2026 MariTrade Logistics. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
          </span>
        </div>
      </footer>

    </div>
  );
}
