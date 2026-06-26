'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Ship, 
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
} from 'lucide-react';
import { motion } from 'motion/react';

export default function LandingPage() {
  const router = useRouter();
  const [trackCode, setTrackCode] = useState('');
  const [errorSearch, setErrorSearch] = useState('');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] flex flex-col font-sans select-none scroll-smooth">

      {/* Navigation */}
      <nav className="sticky top-0 z-50 flex justify-between items-center w-full px-8 py-0 h-16 bg-white border-b border-[#e0e3e5]">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-secondary rounded-md flex items-center justify-center">
              <Ship className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="leading-none">
              <span className="text-[17px] font-display font-black text-black tracking-tight block">MariTrade</span>
              <span className="text-[9px] text-gray-400 font-mono tracking-widest uppercase block mt-0.5">Logistics Tracking Platform</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <span className="text-[13px] font-semibold text-secondary border-b-2 border-secondary px-3 py-[18px] cursor-pointer">Platform</span>
            <span className="text-[13px] font-semibold text-[#45464d] hover:text-black px-3 py-[18px] cursor-pointer transition-colors">How it works</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-[13px] font-semibold text-[#45464d] hover:text-black rounded-md hover:bg-gray-100 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="flex items-center gap-1.5 px-5 py-2 bg-secondary text-white text-[13px] font-semibold rounded-md hover:bg-[#0047a3] transition-colors shadow-sm"
          >
            Register
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      <main className="flex-1">

        {/* Hero */}
        <section className="relative overflow-hidden bg-[#0a1628] min-h-[680px] flex flex-col items-center justify-center text-center px-6">

          {/* Subtle ambient glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute top-[20%] left-[30%] w-[500px] h-[500px] rounded-full opacity-[0.07]"
              style={{
                background: 'radial-gradient(circle, #0058be 0%, transparent 70%)',
                transform: `translate(${mousePos.x}px, ${mousePos.y}px)`,
                transition: 'transform 0.6s ease-out',
              }}
            />
            <div
              className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] rounded-full opacity-[0.05]"
              style={{
                background: 'radial-gradient(circle, #0BAFB0 0%, transparent 70%)',
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

          <div className="relative z-10 max-w-3xl mx-auto space-y-6">

            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-[#7c9cbf] text-[11px] font-semibold tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5 text-ocean-400" />
              <span>Secured by Stellar Blockchain Multi-Signature Contracts</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-[56px] font-display font-black text-white leading-[1.1] tracking-tight">
              Track your Shipments.<br className="hidden sm:block" />
              <span>Digitize the Process.</span><br className="hidden sm:block" />
              Made for{' '}
              <span className="text-[#adc6ff]">Filipino Importers/Exporters/Freight Forwarders/Custom Brokers/Warehouse Operators</span>
            </h1>

            {/* Subtext */}
            <p className="text-[15px] text-[#7c839b] max-w-xl mx-auto leading-relaxed">
             Digitize the shipping process with MariTrade, a blockchain-powered escrow platform for Filipino's who are in the freight shipping business. Track shipments, secure payments, communicate internally, and streamline logistics with ease.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/register"
                className="px-7 py-3 bg-secondary text-white text-[13px] font-bold rounded-md hover:bg-[#0047a3] transition-colors shadow-lg shadow-secondary/20 flex items-center justify-center gap-2"
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

            {/* Subtext */}
            <p className="text-[13px] text-[#7c839b] max-w-xl mx-auto leading-relaxed">
              Got a shipment to track? Enter your reference code below to see it publicly.
            </p>
            {/* Public shipment tracker */}
            <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4 max-w-xl mx-auto w-full">
              <p className="text-[11px] font-mono text-[#7c839b] uppercase tracking-widest mb-3 text-left">Public Shipment Tracker</p>
              <form onSubmit={handleTrackSubmit} className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7c839b]" />
                  <input
                    type="text"
                    placeholder="Enter reference code  (e.g. MT-2026-00341)"
                    className="w-full bg-white text-black rounded-md px-3 py-2.5 pl-9 outline-none text-[13px] focus:ring-2 focus:ring-secondary border border-transparent"
                    value={trackCode}
                    onChange={(e) => { setTrackCode(e.target.value); setErrorSearch(''); }}
                  />
                </div>
                <button
                  type="submit"
                  className="bg-ocean-400 hover:bg-ocean-600 text-white px-5 py-2.5 rounded-md text-[13px] font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  Track
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
              {errorSearch && (
                <p className="text-rose-400 text-[11px] text-left mt-2 pl-1 font-mono">⚠ {errorSearch}</p>
              )}
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#7c839b]">
                <span>Sample codes:</span>
                <button type="button" onClick={() => { setTrackCode('MT-2026-00341'); setErrorSearch(''); }} className="text-[#adc6ff] hover:text-white transition-colors underline underline-offset-2">MT-2026-00341</button>
                <button type="button" onClick={() => { setTrackCode('MT-2026-00122'); setErrorSearch(''); }} className="text-[#adc6ff] hover:text-white transition-colors underline underline-offset-2">MT-2026-00122</button>
              </div>
            </div>

          </div>
        </section>

        {/* Trusted by bar — HARDCODED FIX: changed label to "Built for businesses like" 
             since these are placeholder names, not real verified partners */}
        <section className="bg-white border-b border-[#e0e3e5] py-5 px-8">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            <span className="text-[11px] font-mono text-[#76777d] uppercase tracking-widest whitespace-nowrap">Built for businesses like</span>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-8 text-[12px] font-bold text-[#45464d] tracking-tight">
              <span className="opacity-60">BINONDO METALS</span>
              <span className="opacity-60">MANILA CARGO CO.</span>
              <span className="opacity-60">CEBU TRADERS GUILD</span>
              <span className="opacity-60">SUBIC FREIGHT INTL.</span>
              <span className="opacity-60">DAVAO IMPORTS INC.</span>
            </div>
          </div>
        </section>

        {/* How it works*/}
        <section className="py-20 px-6 sm:px-8 max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-[10px] font-Inter uppercase tracking-widest text-secondary font-bold">How Does MariTrade Work?</span>
            <h2 className="text-2xl sm:text-[32px] font-display font-black text-black tracking-tight mt-2 leading-tight">
              MariTrade Introduces a payment-secured, organized, digitized platform for freight shipping nationwide and overseas.
            </h2>
            <p className="text-[13px] text-[#45464d] mt-3 leading-relaxed">
              Where every peso stays protected in a cryptographic escrow until verified events are confirmed by your logistics chain network.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: <FileLock2 className="w-5 h-5 text-secondary" />,
                title: 'Create a Shipment Record and Fund Escrow',
                desc: 'Importers create a shipment record with all relevant details, including assigned personnel from your trusted network, shipping documents, and expected milestones.',
              },
              {
                step: '02',
                icon: <Truck className="w-5 h-5 text-ocean-400" />,
                title: 'Logistics Milestone Logging',
                desc: 'Trusted Freight forwarders, Customs brokers, and Warehouse operators who belong to your network log verified milestones with photo proof as the cargo moves.',
              },
              {
                step: '03',
                icon: <CheckCircle className="w-5 h-5 text-green-500" />,
                title: 'Release Funds Upon Verified Delivery',
                desc: 'Once all milestones are confirmed, and with authorization from you, the escrowed funds are released to the exporter in seconds via Stellar USDC. No delays, no disputes.',
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-xl border border-[#e0e3e5] p-7 relative group hover:border-secondary/30 transition-colors">
                <span className="absolute top-6 right-6 text-[11px] font-mono text-[#c6c6cd] font-bold">{item.step}</span>
                <div className="w-10 h-10 rounded-lg bg-[#f2f4f6] flex items-center justify-center mb-5">
                  {item.icon}
                </div>
                <h3 className="font-display font-bold text-[15px] text-black mb-2">{item.title}</h3>
                <p className="text-[13px] text-[#45464d] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities strip */}
        <section className="bg-white border-t border-b border-[#e0e3e5] py-14 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-[15px] font-Inter uppercase tracking-widest text-secondary font-bold">Built for the Whole Chain</span>
              <h2 className="text-[24px] font-display font-black text-black mt-2 tracking-tight">Everything the trade chain needs</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: <Lock className="w-5 h-5 text-secondary" />, title: 'Multi-Sig Escrow', desc: 'USDC held in Stellar 3-of-3 multi-signature accounts. No single party can move funds alone.' },
                { icon: <BarChart3 className="w-5 h-5 text-secondary" />, title: 'Real-Time Tracking', desc: 'Live milestone feed from every logistics role — freight, customs, warehouse, — in one view.' },
                { icon: <Globe className="w-5 h-5 text-secondary" />, title: 'Native Communications', desc: 'Communicate and network with partners internally, No more lost emails or jumping from other messaging apps.' },
                { icon: <FileText className="w-5 h-5 text-secondary" />, title: 'Secured BOC Document Center', desc: 'All shipping and customs documents can be stored on an authorized folder per shipment. Customs brokers get dedicated read access.' },
                { icon: <Zap className="w-5 h-5 text-secondary" />, title: 'Instant Settlement', desc: 'Priority milestones confirmed? Funds move to the exporter in seconds. No forms. No delays.' },
              ].map((cap, i) => (
                <div key={i} className="p-5 rounded-xl border border-[#e0e3e5] hover:border-secondary/30 transition-colors bg-[#f7f9fb]">
                  <div className="w-9 h-9 bg-[#eef4ff] rounded-lg flex items-center justify-center mb-4">
                    {cap.icon}
                  </div>
                  <h3 className="font-display font-bold text-[14px] text-black mb-1.5">{cap.title}</h3>
                  <p className="text-[12px] text-[#45464d] leading-relaxed">{cap.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-[#0a1628] text-center px-6">
          <div className="max-w-2xl mx-auto space-y-5">
            <h2 className="text-[32px] font-display font-black text-white tracking-tight leading-tight">
              Ready to protect your next<br />cargo shipment?
            </h2>
            <p className="text-[14px] text-[#7c839b] max-w-md mx-auto leading-relaxed">
              {/* HARDCODED FIX: removed unverified "500+ businesses" and "SEC-registered" claims */}
              MariTrade digitizes freight shipping with full payment protection and supply chain transparency for Filipino importers, exporters, and logistics operators.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Link
                href="/register"
                className="px-8 py-3 bg-secondary text-white rounded-md text-[13px] font-bold hover:bg-[#0047a3] transition-colors shadow-lg shadow-secondary/25 flex items-center justify-center gap-2"
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
            <p className="text-[11px] text-[#76777d] font-mono">No credit card required · Currently in Early Access</p>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-[#e0e3e5] py-14 px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12 pb-10 border-b border-[#e0e3e5]">
          <div className="space-y-3 max-w-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-secondary rounded-md flex items-center justify-center">
                <Ship className="w-4 h-4 text-white" />
              </div>
              <span className="text-[16px] font-display font-black text-black tracking-tight">MariTrade</span>
            </div>
            <p className="text-[12px] text-[#45464d] leading-relaxed">
              Blockchain-powered escrow and logistics for Filipino MSME Owners. Built on Stellar. Verified by the Bureau of Customs.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {[
              { title: 'Platform', links: ['Terms of Use', 'Privacy Policy',] },
            ].map((col) => (
              <div key={col.title} className="space-y-3">
                <h4 className="text-[10px] font-mono font-bold text-black uppercase tracking-widest">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link} className="text-[12px] text-[#45464d] hover:text-black cursor-pointer transition-colors">{link}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-[#76777d] font-Inter">
          <span>© 2026 MariTrade Logistics. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
          </span>
        </div>
      </footer>

    </div>
  );
}
