'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUserSession } from '@/hooks/use-user-session';
import { 
  Ship, 
  MessageSquare, 
  FileText, 
  CreditCard, 
  Settings, 
  User as UserIcon, 
  CheckCircle,
  Clock,
  LogOut,
  Menu,
  X,
  Compass,
  AlertTriangle,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  flush?: boolean;
}

export default function DashboardLayout({ children, flush = false }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, allUsers, setCurrentUser } = useUserSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBot, setShowBot] = useState(false);
  const [botMessage, setBotMessage] = useState('');
  const [botHistory, setBotHistory] = useState<{sender: 'user' | 'bot', text: string}[]>([
    { sender: 'bot', text: 'Mabuhay! Siga po kayo sa MariTrade. Ako si MariBot, gusto niyo po ba malaman ang tungkol sa Stellar escrow release?' }
  ]);
  const [botLoading, setBotLoading] = useState(false);

  const navItems = [
    { name: 'Dashboard Home', href: '/dashboard', icon: Compass },
    { name: 'My Shipments', href: '/shipments', icon: Ship },
    { name: 'Messages & Chat', href: '/messages', icon: MessageSquare },
    { name: 'BOC Documents', href: '/documents', icon: FileText },
    { name: 'Escrow Payouts', href: '/payments', icon: CreditCard },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleBotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botMessage.trim()) return;

    const userText = botMessage;
    setBotHistory(prev => [...prev, { sender: 'user', text: userText }]);
    setBotMessage('');
    setBotLoading(true);

    try {
      const res = await fetch('/api/gemini/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      const data = await res.json();
      if (data.success) {
        setBotHistory(prev => [...prev, { sender: 'bot', text: data.text }]);
      } else {
        setBotHistory(prev => [...prev, { sender: 'bot', text: 'Pasensya na, may kaunting technical issue. Subukan nating muli mamaya.' }]);
      }
    } catch {
      setBotHistory(prev => [...prev, { sender: 'bot', text: 'Error connecting to MariBot server.' }]);
    } finally {
      setBotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-50 text-gray-900 font-sans flex flex-col">
      {/* QUICK TESTING TOOLBAR */}
      <div className="bg-maritime-900 border-b border-maritime-700 text-white text-xs px-4 py-2 flex flex-wrap justify-between items-center gap-2 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <span className="bg-coral-400 text-transparent bg-clip-text text-white font-bold tracking-wider px-2 py-0.5 rounded text-[10px]">
            DEMO WORKSPACE
          </span>
          <span className="text-maritime-100 hidden sm:inline">⚠️ Swap identities instantly to test role-aware milestones, dashboards, and BOC encryption.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Active Profile:</span>
          <select 
            className="bg-maritime-700 text-white border border-maritime-200 rounded px-2 py-1 text-xs outline-none cursor-pointer focus:ring-1 focus:ring-maritime-200"
            value={currentUser.id}
            onChange={(e) => {
              const selected = allUsers.find(u => u.id === e.target.value);
              if (selected) {
                setCurrentUser(selected);
                router.push('/dashboard');
              }
            }}
          >
            {allUsers.map((usr) => (
              <option key={usr.id} value={usr.id}>
                {usr.fullName} ({usr.jobRole})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-1 relative">
        {/* SIDEBAR FOR DESKTOP */}
        <aside className="hidden md:flex flex-col w-56 bg-[#111c30] text-white flex-shrink-0 border-r border-[#15233c] select-none">
          {/* LOGO */}
          <div className="p-4 border-b border-[#1f2e4a] flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0058be] rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs">
              <Ship className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-extrabold tracking-tight text-white block leading-none">MariTrade</span>
              <span className="text-[10px] text-gray-400 tracking-widest font-mono uppercase mt-1 block">VERSION 2.0</span>
            </div>
          </div>

          {/* ACTIVE USER BRIEF */}
          <Link href="/profile" className="p-3 bg-[#0d1524] border-b border-[#1f2e4a] hover:bg-opacity-80 transition-all flex items-center gap-2.5 cursor-pointer group">
            <div className="w-9 h-9 bg-gray-700 rounded-md overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 border border-gray-650">
              <img src="https://picsum.photos/seed/tyshaun/100/100" alt="Tyshaun" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
            </div>
            <div className="overflow-hidden flex-1">
              <h4 className="text-[12px] font-bold truncate text-white leading-tight">{currentUser.fullName}</h4>
              <p className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase truncate leading-none mt-1">SHAUN TRADING</p>
              <div className="flex items-center gap-1 mt-1 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                <span className="text-[8.5px] text-green-400 font-extrabold tracking-wide uppercase">KYC: VERIFIED</span>
              </div>
            </div>
          </Link>

          {/* NAVIGATION ITEMS */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const IconComp = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${
                    isActive
                      ? 'bg-[#0058be] text-white shadow-xs'
                      : 'text-gray-300 hover:bg-[#1a2944] hover:text-white'
                  }`}
                >
                  <IconComp className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* SUB_INFO */}
          <div className="p-3 border-t border-[#1f2e4a] bg-[#0d1524] space-y-3">
            <div className="text-[9px] text-gray-400 space-y-0.5 leading-tight font-mono">
              <p>SYS-STATUS: CONNECTED</p>
              <p>STELLAR HUB: GCB1...Z9AC</p>
            </div>
            <Link 
              href="/shipments" 
              className="w-full bg-[#0058be] hover:bg-[#004395] text-white font-bold py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 text-center"
            >
              + New Shipment
            </Link>
          </div>
        </aside>

        {/* MOBILE UPPER ACCESS HEADER */}
        <div className="md:hidden flex items-center justify-between bg-maritime-900 border-b border-maritime-700 text-white p-4 h-16 w-full absolute top-0 left-0 z-40">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-1 hover:bg-maritime-700 rounded text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-bold text-base tracking-tight">MariTrade V2</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-ocean-400 text-maritime-900 font-bold px-2 py-0.5 rounded-full">
              {currentUser.jobRole}
            </span>
          </div>
        </div>

        {/* MOBILE SIDEBAR PANEL OVERLAY */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <div 
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.aside 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.2 }}
                className="fixed top-0 left-0 bottom-0 w-72 bg-maritime-900 text-white z-50 flex flex-col shadow-2xl md:hidden"
              >
                <div className="p-6 border-b border-maritime-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ship className="w-6 h-6 text-maritime-400" />
                    <span className="font-bold text-lg text-white">MariTrade v2</span>
                  </div>
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 hover:bg-maritime-700 rounded text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="p-4 bg-maritime-950 border-b border-maritime-700 hover:bg-maritime-800/60 transition-all flex items-center gap-3 cursor-pointer group">
                  <div className="w-10 h-10 bg-maritime-100 text-maritime-900 rounded-full flex items-center justify-center font-bold text-sm group-hover:scale-105 transition-transform shrink-0">
                    {currentUser.fullName.split(' ').map(n=>n[0]).join('')}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <h4 className="text-sm font-semibold truncate text-white group-hover:text-ocean-400 transition-colors">{currentUser.fullName}</h4>
                    <p className="text-xs text-ocean-400 capitalize truncate">{currentUser?.companyName || currentUser.jobRole.replace('_', ' ')}</p>
                  </div>
                </Link>

                <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                  {navItems.map((item) => {
                    const IconComp = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                          pathname === item.href
                            ? 'bg-maritime-700 text-white'
                            : 'text-maritime-100 hover:bg-maritime-700/40 hover:text-white'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* MAIN BODY WINDOW */}
        <main className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16 h-screen bg-sand-50 overflow-hidden">
          {flush ? (
            <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
              {children}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6 pb-20">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* FLOAT TAGALOG AI HELP SYSTEM BUTTON */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowBot(prev => !prev)}
          className="bg-ocean-600 hover:bg-ocean-400 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        >
          {showBot ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6 animate-pulse" />}
        </button>

        {/* CHAT AI POPUP DIALOG */}
        <AnimatePresence>
          {showBot && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white border border-sand-200 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[500px]"
            >
              {/* Header */}
              <div className="bg-ocean-600 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="font-semibold text-sm">MariBot — Assist</h3>
                    <p className="text-[10px] text-ocean-100">Tagalog Trade AI Expert</p>
                  </div>
                </div>
                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-mono">GEMINI API</span>
              </div>

              {/* Chat flow */}
              <div className="flex-1 p-4 space-y-3 overflow-y-auto h-72 text-sm bg-sand-50">
                {botHistory.map((item, index) => (
                  <div key={index} className={`flex ${item.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      item.sender === 'user' 
                        ? 'bg-maritime-400 text-white' 
                        : 'bg-white text-gray-800 border border-sand-200'
                    }`}>
                      {item.text}
                    </div>
                  </div>
                ))}
                {botLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-sand-200 rounded-lg px-3 py-2 text-gray-500 italic animate-pulse">
                      MariBot is writing pinakaunang sagot...
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleBotSubmit} className="p-3 border-t border-sand-200 bg-white flex gap-2">
                <input
                  type="text"
                  placeholder="Magtanong dito (e.g. escrow status)..."
                  className="flex-1 border border-sand-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-ocean-400"
                  value={botMessage}
                  onChange={(e) => setBotMessage(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-ocean-600 hover:bg-ocean-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Send
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
