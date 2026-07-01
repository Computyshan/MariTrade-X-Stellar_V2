'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
  Network,
  CheckCheck,
  ExternalLink,
  BarChart3,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '@/hooks/use-notifications';

interface DashboardLayoutProps {
  children: React.ReactNode;
  flush?: boolean;
  /** Set to true for Trade Party users to apply the wine-toned page background */
  tradeParty?: boolean;
}

export default function DashboardLayout({ children, flush = false, tradeParty = false }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, allUsers, setCurrentUser, signOut } = useUserSession();
  const notif = useNotifications(currentUser?.id);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard',  href: '/dashboard',  icon: LayoutDashboard },
    { name: 'Shipments',  href: '/shipments',  icon: Ship },
    { name: 'Network',    href: '/network',    icon: Network },
    { name: 'Team',       href: '/team',       icon: Users },
    { name: 'Messages',   href: '/messages',   icon: MessageSquare },
    { name: 'Documents',  href: '/documents',  icon: FileText },
    { name: 'Escrow',     href: '/payments',   icon: CreditCard },
    { name: 'Analytics',  href: '/analytics',  icon: BarChart3 },
    { name: 'Settings',   href: '/settings',   icon: Settings },
  ];

  const userInitials = currentUser?.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';

  // Session not yet resolved or user logged out — AuthProvider will redirect,
  // but we still need to avoid crashing while the redirect is in flight.
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mist-light">
        <div className="w-8 h-8 border-4 border-amber border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isTradeParty = currentUser.userType === 'TRADE_PARTY';
  const themeAttr   = isTradeParty ? 'trade-party' : 'logistics-chain';

  return (
    <div data-theme={themeAttr} className="min-h-screen bg-mist-light text-ink font-sans flex">

      {/* ── SIDEBAR ── */}
      <aside
        className="hidden md:flex flex-col w-[220px] text-white flex-shrink-0 select-none h-screen sticky top-0 relative"
        style={isTradeParty
          ? { background: 'linear-gradient(175deg, #5C0A2E 0%, #8B1646 45%, #6E1138 160%)' }
          : { background: 'linear-gradient(175deg, var(--color-ink) 0%, var(--color-ink-soft) 45%, var(--color-teal-hover) 160%)' }
        }
      >
        {/* Shimmer overlay — amber warmth for Trade Party, cool mist for Logistics */}
        <div className="absolute inset-0 pointer-events-none" style={isTradeParty
          ? { background: 'radial-gradient(ellipse at 110% 5%, rgba(254,153,0,0.22) 0%, transparent 45%), radial-gradient(ellipse at -10% 95%, rgba(254,153,0,0.10) 0%, transparent 50%)' }
          : { background: 'radial-gradient(ellipse at 110% 5%, rgba(207,226,230,0.18) 0%, transparent 45%), radial-gradient(ellipse at -10% 95%, rgba(207,226,230,0.12) 0%, transparent 50%)' }
        } />

        {/* Main MariTrade logo — always shown, always the master brand */}
        <div className="px-4 py-4 border-b border-white/10 relative z-10">
          <Image
            src="/Logo-No-Text.png"
            alt="MariTrade"
            width={140}
            height={52}
            className="h-10 w-auto object-contain brightness-0 invert"
            priority
          />
        </div>

        {/* User block */}
        <Link href="/profile" className="px-4 py-4 flex items-center gap-3 border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer group relative z-10">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 tracking-wide"
            style={isTradeParty ? { background: 'rgba(254,153,0,0.25)' } : { background: 'var(--color-ink-soft)' }}
          >
            {userInitials}
          </div>
          <div className="overflow-hidden flex-1">
            <h4 className="text-[11px] font-bold truncate text-white leading-tight">{currentUser.fullName}</h4>
            <p className="text-[10px] font-medium tracking-wider uppercase truncate mt-0.5" style={{ color: isTradeParty ? 'rgba(254,153,0,0.55)' : 'rgba(255,255,255,0.4)' }}>{currentUser.companyName}</p>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto relative z-10">
          {navItems.map((item) => {
            const IconComp = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/'));
            const hoverBg = isTradeParty
              ? 'linear-gradient(90deg, rgba(254,153,0,0.10) 0%, rgba(254,153,0,0.05) 100%)'
              : 'linear-gradient(90deg, rgba(207,226,230,0.07) 0%, rgba(129,151,198,0.10) 100%)';
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
                  isActive ? '' : 'text-white/55 hover:text-white/90'
                }`}
                style={isActive ? {
                  background: 'linear-gradient(90deg, var(--theme-sidebar-active-bg) 0%, rgba(207,226,230,0.10) 100%)',
                  color: 'var(--theme-sidebar-active-text)',
                  borderLeft: '2px solid var(--theme-sidebar-active-text)',
                } : { transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = ''; }}
              >
                <IconComp className="w-[15px] h-[15px] shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* NEW SHIPMENT */}
        <div
          className="px-4 py-4 border-t border-white/10 relative z-10"
          style={isTradeParty
            ? { background: 'linear-gradient(90deg, rgba(254,153,0,0.08) 0%, rgba(254,153,0,0.04) 100%)' }
            : { background: 'linear-gradient(90deg, rgba(207,226,230,0.05) 0%, rgba(129,151,198,0.10) 100%)' }
          }
        >
          <Link
            href="/shipments/new"
            className="w-full font-bold py-2.5 rounded-lg text-[11px] tracking-wider transition-all flex items-center justify-center gap-1.5 uppercase border hover:bg-white/10"
            style={isTradeParty
              ? { borderColor: 'rgba(254,153,0,0.45)', color: 'rgba(254,153,0,0.85)' }
              : { borderColor: 'var(--theme-accent-border)', color: 'rgba(255,255,255,0.8)' }
            }
          >
            + NEW SHIPMENT
          </Link>
        </div>
      </aside>

      {/* ── RIGHT COLUMN (topbar + main) ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* TOP BAR */}
        <header
          className="border-b px-6 py-3 flex items-center justify-between flex-shrink-0"
          style={isTradeParty
            ? { background: 'linear-gradient(160deg, #fff0f5 0%, #fdf6f9 40%, var(--color-mist-light) 100%)', borderBottomColor: 'var(--color-mist)' }
            : { background: 'linear-gradient(90deg, #ffffff 0%, var(--color-mist-light) 60%, var(--color-mist) 100%)', borderBottomColor: 'var(--color-mist)' }
          }
        >
          <div className="flex items-center gap-3">
            <button
              className={`md:hidden p-1.5 rounded-lg transition-colors ${isTradeParty ? 'text-wine/70 hover:bg-wine-light' : 'text-ink-faint hover:bg-mist-light'}`}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Portal identity tag — Tungsten display type, themed per user type */}
            {isTradeParty ? (
              <span className="hidden sm:block font-display uppercase tracking-wide" style={{ fontSize: '24px', color: 'var(--color-amber)' }}>
                Trade Party Portal
              </span>
            ) : (
              <span className="hidden sm:block font-display uppercase tracking-wide" style={{ fontSize: '24px', color: 'var(--color-teal)' }}>
                Logistics Chain Portal
              </span>
            )}
          </div>

          {/* Right: user info + sign out */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-ink-faint">
              {currentUser?.jobRole.replace(/_/g, ' ')}
            </span>

            {/* ── Notification Bell ── */}
            <div className="relative">
              <button
                onClick={() => setShowNotifPanel(v => !v)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors relative ${isTradeParty ? 'text-wine/70 hover:bg-wine-light' : 'text-ink-faint hover:bg-mist-light'}`}
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {notif.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-amber text-white text-[9px] font-bold rounded-full px-1">
                    {notif.unreadCount > 9 ? '9+' : notif.unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown panel */}
              <AnimatePresence>
                {showNotifPanel && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowNotifPanel(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-10 w-80 bg-white border border-mist rounded-2xl shadow-2xl z-40 overflow-hidden"
                    >
                      {/* Panel header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-mist-light">
                        <h3 className="text-xs font-bold text-ink">Notifications</h3>
                        {notif.unreadCount > 0 && (
                          <button
                            onClick={() => notif.markAllRead()}
                            className="flex items-center gap-1 text-[10px] font-bold hover:opacity-70 transition-opacity"
                            style={{ color: 'var(--theme-accent)' }}
                          >
                            <CheckCheck className="w-3 h-3" /> Mark all read
                          </button>
                        )}
                      </div>

                      {/* List */}
                      <div className="max-h-[360px] overflow-y-auto divide-y divide-mist-light">
                        {notif.loading && notif.notifications.length === 0 ? (
                          <div className="py-8 text-center text-xs text-ink-faint">Loading…</div>
                        ) : notif.notifications.length === 0 ? (
                          <div className="py-10 text-center">
                            <Bell className="w-7 h-7 text-mist mx-auto mb-2" />
                            <p className="text-xs font-bold text-ink-faint">You&apos;re all caught up</p>
                            <p className="text-[10px] text-ink-faint mt-0.5">Milestones, messages, and network updates appear here.</p>
                          </div>
                        ) : (
                          notif.notifications.map(n => (
                            <div
                              key={n.id}
                              onClick={() => {
                                notif.markRead(n.id);
                                if (n.linkHref) router.push(n.linkHref);
                                setShowNotifPanel(false);
                              }}
                              className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-mist-light transition-colors ${
                                !n.isRead ? 'bg-steel-light' : ''
                              }`}
                            >
                              {/* Unread dot */}
                              <div className="flex-shrink-0 mt-1">
                                {!n.isRead
                                  ? <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--theme-accent)' }} />
                                  : <div className="w-2 h-2" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[11px] leading-snug ${!n.isRead ? 'font-bold text-ink' : 'font-semibold text-ink-faint'}`}>
                                  {n.title}
                                </p>
                                <p className="text-[10px] text-ink-faint mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                                <p className="text-[9px] text-ink-faint mt-1">
                                  {new Date(n.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {n.linkHref && <ExternalLink className="w-3 h-3 text-mist flex-shrink-0 mt-1" />}
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <Link
              href="/profile"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isTradeParty ? 'text-wine/70 hover:bg-wine-light' : 'text-ink-faint hover:bg-mist-light'}`}
            >
              <UserCircle className="w-5 h-5" />
            </Link>
            <button
              onClick={handleSignOut}
              className="text-[11px] font-bold transition-colors cursor-pointer px-2 py-1 rounded-lg text-ink-faint hover:text-wine hover:bg-wine-light"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* MOBILE SIDEBAR OVERLAY */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <div className="fixed inset-0 bg-ink/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.2 }}
                className="fixed top-0 left-0 bottom-0 w-72 text-white z-50 flex flex-col shadow-2xl md:hidden"
                style={isTradeParty
                  ? { background: 'linear-gradient(175deg, #5C0A2E 0%, #8B1646 50%, #6E1138 100%)' }
                  : { background: 'var(--color-ink)' }
                }
              >
                <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={isTradeParty ? { background: 'rgba(254,153,0,0.2)' } : { background: 'rgba(255,255,255,0.1)' }}>
                      <Ship className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold tracking-widest text-white">MARITRADE</span>
                    {isTradeParty && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: 'rgba(254,153,0,0.2)', color: 'var(--color-amber)' }}>Trade Party</span>}
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
                          isActive
                            ? 'text-white'
                            : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                        }`}
                        style={isActive ? {
                          background: isTradeParty
                            ? 'linear-gradient(90deg, rgba(254,153,0,0.18) 0%, rgba(254,153,0,0.08) 100%)'
                            : 'rgba(255,255,255,0.1)',
                          borderLeft: isTradeParty ? '2px solid var(--color-amber)' : 'none',
                        } : {}}
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
        <main
          className="flex-1 overflow-y-auto"
          style={isTradeParty
            ? { background: 'linear-gradient(160deg, #fff0f5 0%, #fdf6f9 40%, var(--color-mist-light) 100%)' }
            : { background: 'linear-gradient(160deg, #f4f7fb 0%, #eef2f8 40%, var(--color-mist-light) 100%)' }
          }
        >
          {flush ? (
            <div className="h-full w-full flex flex-col">{children}</div>
          ) : (
            <div className="p-6 max-w-7xl mx-auto w-full space-y-6 pb-10">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
