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
  Activity, 
  FileLock2, 
  Coins, 
  TrendingUp, 
  Bell, 
  User, 
  CheckCircle,
  FileText,
  Truck,
  Layers,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';

export default function LandingPage() {
  const router = useRouter();
  const [trackCode, setTrackCode] = useState('');
  const [errorSearch, setErrorSearch] = useState('');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Mouse trajectory tracker for fluid interactive background blobs
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 40;
      const y = (e.clientY / window.innerHeight - 0.5) * 40;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackCode.trim()) return;

    const formatted = trackCode.trim().toUpperCase();
    if (formatted === 'MT-2026-00341' || formatted === 'MT-2026-00122' || formatted.startsWith('MT-')) {
      router.push(`/track/${formatted}`);
    } else {
      setErrorSearch('Reference code must match format MT-YYYY-NNNNN');
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] flex flex-col font-sans select-none selection:bg-secondary/20 scroll-smooth">
      
      {/* Top Professional Navigation Bar */}
      <nav className="sticky top-0 z-50 flex justify-between items-center w-full px-8 py-4 h-16 bg-white border-b border-[#e0e3e5] shadow-xs">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8.5 h-8.5 bg-secondary rounded flex items-center justify-center transition-transform group-hover:scale-102">
              <Ship className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-display font-black text-black leading-none block tracking-tight">MariTrade</span>
              <span className="text-[9px] text-gray-500 font-mono tracking-widest leading-none mt-0.5 block uppercase">Stellar Escrow Trust</span>
            </div>
          </Link>
          <div className="hidden md:flex gap-6">
            <span className="text-xs font-label-caps font-bold text-secondary border-b-2 border-secondary py-1 cursor-pointer">Platform</span>
            <span className="text-xs font-label-caps font-semibold text-[#45464d] hover:text-secondary py-1 cursor-pointer transition-colors">Resources</span>
            <span className="text-xs font-label-caps font-semibold text-[#45464d] hover:text-secondary py-1 cursor-pointer transition-colors">Pricing</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard" 
            className="hidden lg:flex items-center gap-2 px-6 py-2 bg-secondary text-white text-xs font-label-caps font-semibold tracking-wide rounded border border-secondary hover:opacity-90 transition-all cursor-pointer shadow-sm active:translate-y-[0.5px]"
          >
            Enter Dashboard Portal
          </Link>
          <div className="flex gap-2.5 items-center mr-1">
            <button className="text-[#45464d] hover:text-black p-1 rounded-md transition-colors cursor-pointer relative" title="Notifications">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-secondary-container" />
            </button>
            <button className="text-[#45464d] hover:text-black p-1 rounded-md transition-colors cursor-pointer" title="Account">
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        
        {/* Hero Section with Cinematic Depth and Interactive Lighting */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#131b2e] to-black min-h-[750px] flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8">
          
          {/* Atmospheric Layer - Glow Blobs reactive to mouse coordinates */}
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <div 
              className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-secondary rounded-full blur-[130px] transition-transform duration-500 ease-out"
              style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
            />
            <div 
              className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary-container rounded-full blur-[130px] transition-transform duration-500 ease-out"
              style={{ transform: `translate(${-mousePos.x}px, ${-mousePos.y}px)` }}
            />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto space-y-7">
            
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-secondary/30 bg-secondary/10 text-secondary text-[11px] font-label-caps font-bold">
              <ShieldCheck className="w-4 h-4 text-secondary-container animate-pulse" />
              <span className="tracking-wide">Secured via Stellar Blockchain Multi-Signature Trust Contracts</span>
            </div>

            {/* Display Header */}
            <h1 className="text-3xl sm:text-5xl md:text-display-lg font-display font-black text-white leading-tight tracking-tight">
              Smart Milestone-Based Escrows <br className="hidden md:block" /> for <span className="text-[#adc6ff] underline decoration-secondary decoration-wavy underline-offset-8">Filipino SME Importers</span>
            </h1>

            {/* Detailed descriptor */}
            <p className="text-sm sm:text-body-lg text-[#7c839b] max-w-2xl mx-auto font-sans leading-relaxed">
              Connect importers, global exporters, customs brokers, and dry logistics fleets in an unified trust chain. Escrows are automatically released on Bureau of Customs clearance and signed trucker receipts.
            </p>

            {/* Public Interactive Tracker Control Panel */}
            <div className="mt-8 bg-white/5 backdrop-blur-xl p-4 sm:p-5 rounded-xl border border-white/10 max-w-2xl mx-auto w-full transition-all hover:bg-white/8 hover:border-white/15 shadow-2xl">
              <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7c839b]" />
                  <input
                    type="text"
                    placeholder="Enter Shipping Ref (e.g. MT-2026-00341)"
                    className="w-full bg-white text-black rounded px-3 py-3 pl-11 outline-none text-sm transition-all focus:ring-2 focus:ring-secondary border-none"
                    value={trackCode}
                    onChange={(e) => {
                      setTrackCode(e.target.value);
                      setErrorSearch('');
                    }}
                  />
                </div>
                <button 
                  type="submit" 
                  className="bg-[#14b8a6] hover:bg-[#0d9488] text-white px-8 py-3 rounded text-sm font-bold tracking-wider font-sans transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:translate-y-[0.5px]"
                >
                  <span>Track</span>
                  <ArrowRight className="w-4.5 h-4.5" />
                </button>
              </form>
              
              {errorSearch && (
                <p className="text-rose-400 text-xs text-left mt-2 pl-3 font-semibold font-mono flex items-center gap-1.5">
                  <span>⚠️</span> {errorSearch}
                </p>
              )}

              {/* Instant click to autofill references */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs font-label-caps font-semibold justify-center md:justify-start items-center">
                <span className="text-[#7c839b]">Try real verification codes:</span>
                <div className="flex flex-wrap gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setTrackCode('MT-2026-00341');
                      setErrorSearch('');
                    }} 
                    className="text-white hover:text-secondary underline underline-offset-4 decoration-secondary/40 transition-colors uppercase cursor-pointer"
                  >
                    MT-2026-00341 (In Transit)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setTrackCode('MT-2026-00122');
                      setErrorSearch('');
                    }} 
                    className="text-white hover:text-secondary underline underline-offset-4 decoration-secondary/40 transition-colors uppercase cursor-pointer"
                  >
                    MT-2026-00122 (Delivered)
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Bento Grid Ecosystem Layout representation */}
        <section className="py-20 px-6 sm:px-8 max-w-7xl mx-auto space-y-12">
          
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#0058be] font-bold">Comprehensive Trust Ecosystem</span>
            <h2 className="text-2xl sm:text-headline-md font-display font-bold text-black tracking-tight mt-1">Multi-Sovereign Digital Logistics</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-2 font-sans">
              Combining on-chain stablecoin multi-signatures, strict Bureau of Customs authorization guidelines, and continuous freight carrier ledger records.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Large Card: Core Technology flow (8/12 cols) */}
            <div className="md:col-span-8 bg-white rounded-xl border border-[#e0e3e5] p-7 sm:p-8 flex flex-col justify-between overflow-hidden relative shadow-sm group hover:border-secondary/40 transition-all">
              <div>
                <span className="text-[10px] font-mono text-secondary tracking-widest uppercase font-bold block mb-1">Core Technology</span>
                <h3 className="text-lg sm:text-headline-sm font-display font-extrabold text-black mb-3">Milestone-Verified Asset Release</h3>
                <p className="text-xs sm:text-sm text-[#45464d] leading-relaxed max-w-lg">
                  Funds held in cryptographic ledger escrows are programmatically released only when physical benchmarks are satisfied. Verified instantly by BOC database entries and authorized logistics operators.
                </p>
              </div>

              {/* Progress Milestones timeline component */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4 overflow-x-auto pb-2 select-none">
                <div className="flex-1 min-w-[170px] p-4 bg-[#f8fafc] rounded border border-[#eceef0] relative hover:border-secondary/30 transition-all">
                  <FileText className="w-5 h-5 text-secondary mb-2.5" />
                  <h4 className="font-bold text-xs text-black">1. BOC Lodgement</h4>
                  <p className="text-[10px] text-[#45464d] mt-1 leading-snug">SAD registered & validated on-chain in real-time.</p>
                </div>
                <div className="flex-1 min-w-[170px] p-4 bg-[#f8fafc] rounded border border-[#eceef0] relative hover:border-secondary/30 transition-all">
                  <CheckCircle className="w-5 h-5 text-secondary mb-2.5" />
                  <h4 className="font-bold text-xs text-black">2. Gate Pass Issued</h4>
                  <p className="text-[10px] text-[#45464d] mt-1 leading-snug">Clearance signal automates multi-sig triggers.</p>
                </div>
                <div className="flex-1 min-w-[170px] p-4 bg-[#f8fafc] rounded border border-[#eceef0] relative hover:border-secondary/30 transition-all">
                  <Truck className="w-5 h-5 text-secondary mb-2.5" />
                  <h4 className="font-bold text-xs text-black">3. Final Delivery</h4>
                  <p className="text-[10px] text-[#45464d] mt-1 leading-snug">Trucker POD signature releases collateral funds.</p>
                </div>
              </div>

              <div className="absolute -right-6 -bottom-6 opacity-3 group-hover:opacity-6 transition-opacity pointer-events-none">
                <Layers className="w-40 h-40 text-black" />
              </div>
            </div>

            {/* Small Card: Stellar Blockchain highlights (4/12 cols) */}
            <div className="md:col-span-4 bg-[#131b2e] text-white rounded-xl p-7 flex flex-col justify-between items-center text-center shadow-md relative overflow-hidden hover:scale-[1.01] transition-transform">
              <div className="w-14 h-14 rounded-full bg-secondary-container/10 border border-secondary-container/40 flex items-center justify-center mb-4 mt-2">
                <Coins className="w-6 h-6 text-[#adc6ff]" />
              </div>
              <h3 className="text-base sm:text-headline-sm font-display font-extrabold text-white mb-2">Stellar Protocol Integration</h3>
              <p className="text-[11.5px] text-[#7c839b] leading-relaxed px-2">
                Near-zero transaction fees and instant finality settlements over digital USD stablecoins. No banking intermediaries or manual wire delays.
              </p>
              <div className="mt-6 flex items-center gap-1.5 text-[9.5px] font-mono tracking-wider text-[#adc6ff] uppercase font-bold cursor-pointer hover:text-white transition-colors">
                <span>View On-Chain Ledger Nodes</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Columns section: Trust metrics (4/12 cols) */}
            <div className="md:col-span-4 bg-[#eceef0] rounded-xl p-7 flex flex-col justify-between border border-[#e0e3e5] shadow-xs">
              <h3 className="text-xs font-mono font-bold text-black uppercase tracking-wider mb-6">Verified Ecosystem Stats</h3>
              <div className="space-y-6 flex-1 flex flex-col justify-around">
                <div className="border-b border-gray-300 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 font-mono block">CLIENT NETWORK</span>
                    <strong className="text-xl font-display font-bold text-black">500+ SME Importers</strong>
                  </div>
                  <CheckCircle className="w-4.5 h-4.5 text-secondary" />
                </div>
                <div className="border-b border-gray-300 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 font-mono block">COVERAGE NODES</span>
                    <strong className="text-xl font-display font-bold text-black">15 Shipping Hubs</strong>
                  </div>
                  <Globe className="w-4.5 h-4.5 text-secondary" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 font-mono block">SECURED VALUES</span>
                    <strong className="text-xl font-display font-bold text-black">$20M+ Deposited</strong>
                  </div>
                  <Coins className="w-4.5 h-4.5 text-secondary" />
                </div>
              </div>
            </div>

            {/* Columns section: Rich visual backdrop representation (8/12 cols) */}
            <div className="md:col-span-8 h-80 rounded-xl overflow-hidden relative group shadow-sm border border-[#e0e3e5]">
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent z-10" />
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1cruobfxTUCKuEOmfY7l-Jkw17fFQG9uc2e6H2Z1b1cuMImE0-TjeCh5wE-V4ljQwN9LTIcbIxqX5Ar2DMNU0favO1opfL38EJeeSQiZX4RvrTTraRVe3Z9j1qOZkxH-51iQ8Ec-gnP9x4BsVeqVVNW1uwV5adueIBijHlNxrCchMsUnW9pGt2gVaTOlZvrgndTMV6dE5WI8xmGTKrW83S3roeVTlpdvLCWjHlKXtZRsHb758clFkU4RYrn0KlmzJOQfzwTG_asN5" 
                alt="Container ship navigating Manila sunset"
                className="object-cover h-full w-full group-hover:scale-101 transition-transform duration-700 pointer-events-none"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-6 left-6 right-6 z-20 text-white space-y-1">
                <span className="text-[9px] font-mono text-secondary-container bg-white/10 px-2 py-0.5 rounded backdrop-blur-xs font-bold uppercase tracking-wider">MARITIME VISIBILITY</span>
                <h4 className="text-lg font-display font-bold text-white tracking-tight pt-1">Philippines&apos; Port Gateway to Global Trade</h4>
                <p className="text-[11px] text-[#7c839b] max-w-sm font-sans leading-relaxed">
                  Connecting importer enterprises through transparent, role-authorized smart contract frameworks.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Immersive Testimonial Quote */}
        <section className="bg-white border-t border-b border-[#e0e3e5] py-16 text-center select-none">
          <div className="max-w-4xl mx-auto px-6 lg:px-8 space-y-6">
            <Anchor className="w-10 h-10 text-secondary mx-auto transform hover:rotate-45 transition-transform duration-500" />
            <p className="text-base sm:text-lg italic text-[#2d3133] font-serif leading-relaxed max-w-2xl mx-auto">
              &ldquo;MariTrade has reduced payment dispute resolution times for our shipping logistics routes across Subic and Manila Ports by over 85%, creating instant trust.&rdquo;
            </p>
            <div className="text-xs space-y-0.5">
              <h4 className="font-extrabold text-black">Emilio Lacson</h4>
              <p className="text-gray-500 font-mono uppercase tracking-wider text-[10px]">BINONDO METALS IMPORTING INC.</p>
            </div>
          </div>
        </section>

        {/* Ready to start CTA Section */}
        <section className="py-20 bg-[#eceef0] text-center">
          <div className="max-w-3xl mx-auto px-6 space-y-6">
            <h2 className="text-2xl sm:text-headline-md font-display font-extrabold text-[#191c1e] tracking-tight">
              Ready to Secure Your Next Cargo shipment?
            </h2>
            <p className="text-xs sm:text-sm text-[#45464d] max-w-lg mx-auto leading-relaxed">
              Join the 500+ Filipino businesses leveraging MariTrade for friction-less, trust-less international trade.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-3">
              <Link 
                href="/dashboard" 
                className="px-8 py-3 bg-black text-white rounded text-xs font-label-caps font-bold hover:bg-black/90 tracking-wide transition-all uppercase cursor-pointer"
              >
                Get Started for Free
              </Link>
              <button 
                type="button"
                className="px-8 py-3 border border-outline text-[#191c1e] rounded text-xs font-label-caps font-semibold hover:bg-white transition-all uppercase cursor-pointer"
              >
                Talk to an Expert
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* Structured Footer */}
      <footer className="w-full bg-[#e0e3e5] border-t border-[#c6c6cd] py-14 px-8 text-[#191c1e]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12 pb-10 border-b border-[#c6c6cd]">
          <div className="space-y-4 max-w-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
                <Ship className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-display font-black tracking-tight text-black">MariTrade Global</span>
            </div>
            <p className="text-xs text-[#45464d] leading-relaxed">
              Reimagining logistics trust for Filipino importing merchants via instant, decentralized stellar currency settlement systems.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="space-y-2">
              <h4 className="text-[10px] font-label-caps font-bold text-black uppercase tracking-widest">Platform</h4>
              <ul className="space-y-2 text-xs text-[#45464d]">
                <li className="hover:underline cursor-pointer">Multisig Escrow</li>
                <li className="hover:underline cursor-pointer">Live Tracking</li>
                <li className="hover:underline cursor-pointer">Broker Integration</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-label-caps font-bold text-black uppercase tracking-widest">Company</h4>
              <ul className="space-y-2 text-xs text-[#45464d]">
                <li className="hover:underline cursor-pointer">About Us</li>
                <li className="hover:underline cursor-pointer">Sovereign Compliance</li>
                <li className="hover:underline cursor-pointer">Contact</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-label-caps font-bold text-black uppercase tracking-widest">Legal</h4>
              <ul className="space-y-2 text-xs text-[#45464d]">
                <li className="hover:underline cursor-pointer">Privacy Charter</li>
                <li className="hover:underline cursor-pointer">Stellar Smart Terms</li>
                <li className="hover:underline cursor-pointer">BOC Security Protocols</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-label-caps font-bold text-black uppercase tracking-widest">Support</h4>
              <ul className="space-y-2 text-xs text-[#45464d]">
                <li className="hover:underline cursor-pointer">System Status</li>
                <li className="hover:underline cursor-pointer">API Integration</li>
                <li className="hover:underline cursor-pointer">Helpdesk</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-gray-500 font-mono">
          <span>© 2026 MariTrade Global Logistics. Secured via Stellar Blockchain. All rights reserved.</span>
          <span>Created with Google AI Studio</span>
        </div>
      </footer>

    </div>
  );
}

