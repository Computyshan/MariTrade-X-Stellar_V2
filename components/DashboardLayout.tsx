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
  Menu,
  X,
  LayoutDashboard,
  Bell,
  UserCircle,
  ChevronDown,
  Bot,
  Network
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
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Shipments', href: '/shipments', icon: Ship },
    { name: 'Network',   href: '/network',   icon: Network },
    { name: 'Messages',  href: '/messages',  icon: MessageSquare },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Escrow',    href: '/payments',  icon: CreditCard },
    { name: 'Settings',  href: '/settings',  icon: Settings },
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

  const userInitials = currentUser.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-gray-900 font-sans flex">

      {/* ── SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-[220px] bg-[#111c30] text-white flex-shrink-0 select-none h-screen sticky top-0">

        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/5">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
            <Ship className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-[13px] font-black tracking-widest text-white block leading-none">MARITRADE</span>
            <span className="text-[9px] text-white/30 tracking-widest font-mono uppercase mt-1 block">GLOBAL SYSTEMS V2.0</span>
          </div>
        </div>

        {/* User block */}
        <Link href="/profile" className="px-4 py-4 flex items-center gap-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group">
          <div className="w-9 h-9 rounded-lg bg-[#1e3a5f] flex items-center justify-center font-black text-xs text-white shrink-0 tracking-wide">
            {userInitials}
          </div>
          <div className="overflow-hidden flex-1">
            <h4 className="text-[11px] font-bold truncate text-white leading-tight">{currentUser.fullName}</h4>
            <p className="text-[10px] text-white/40 font-medium tracking-wider uppercase truncate mt-0.5">{currentUser.companyName || 'SHAUN TRADING'}</p>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const IconComp = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/'));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <IconComp className="w-[15px] h-[15px] shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* NEW SHIPMENT */}
        <div className="px-4 py-4 border-t border-white/5">
          <Link
            href="/shipments/new"
            className="w-full border border-white/20 text-white/80 hover:bg-white/10 hover:text-white font-bold py-2.5 rounded-lg text-[11px] tracking-wider transition-all flex items-center justify-center gap-1.5 uppercase"
          >
            + NEW SHIPMENT
          </Link>
        </div>
      </aside>

      {/* ── RIGHT COLUMN (topbar + main) ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* TOP BAR */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          {/* Left: Demo workspace pill + mobile menu */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              DEMO WORKSPACE
            </span>
          </div>

          {/* Right: profile switcher + icons */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
              PROFILE:
              <select
                className="bg-transparent text-[#111c30] font-bold text-[11px] outline-none cursor-pointer pr-1 appearance-none"
                value={currentUser.id}
                onChange={(e) => {
                  const selected = allUsers.find(u => u.id === e.target.value);
                  if (selected) { setCurrentUser(selected); router.push('/dashboard'); }
                }}
              >
                {allUsers.map((usr) => (
                  <option key={usr.id} value={usr.id}>{usr.jobRole.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </span>
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <Link href="/profile" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
              <UserCircle className="w-5 h-5" />
            </Link>
          </div>
        </header>

        {/* MOBILE SIDEBAR OVERLAY */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.2 }}
                className="fixed top-0 left-0 bottom-0 w-72 bg-[#111c30] text-white z-50 flex flex-col shadow-2xl md:hidden"
              >
                <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                      <Ship className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-black tracking-widest text-white">MARITRADE</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                  {navItems.map((item) => {
                    const IconComp = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-colors ${
                          isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
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

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto bg-[#f0f2f5]">
          {flush ? (
            <div className="h-full w-full flex flex-col">{children}</div>
          ) : (
            <div className="p-6 max-w-7xl mx-auto w-full space-y-6 pb-10">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* MARIBOT FLOAT BUTTON */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowBot(prev => !prev)}
          className="bg-[#111c30] hover:bg-[#1e3a5f] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105"
        >
          {showBot ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
        </button>
        <AnimatePresence>
          {showBot && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-14 right-0 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[440px]"
            >
              <div className="bg-[#111c30] text-white p-4 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <div>
                  <h3 className="font-bold text-xs">MariBot</h3>
                  <p className="text-[10px] text-white/50">Tagalog Trade AI Expert</p>
                </div>
              </div>
              <div className="flex-1 p-3 space-y-2 overflow-y-auto h-60 text-xs bg-gray-50">
                {botHistory.map((item, index) => (
                  <div key={index} className={`flex ${item.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                      item.sender === 'user'
                        ? 'bg-[#111c30] text-white'
                        : 'bg-white text-gray-700 border border-gray-200'
                    }`}>{item.text}</div>
                  </div>
                ))}
                {botLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-400 text-xs italic animate-pulse">MariBot is typing...</div>
                  </div>
                )}
              </div>
              <form onSubmit={handleBotSubmit} className="p-3 border-t border-gray-200 bg-white flex gap-2">
                <input
                  type="text"
                  placeholder="Ask anything..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-gray-400"
                  value={botMessage}
                  onChange={(e) => setBotMessage(e.target.value)}
                />
                <button type="submit" className="bg-[#111c30] text-white px-3 py-1.5 rounded-lg text-xs font-medium">
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
