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
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '@/hooks/use-notifications';
import { getUserJobRoles } from '@/types';

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

  const adminNavItems = [
    { name: 'Dashboard',  href: '/dashboard',       icon: LayoutDashboard },
    { name: 'Disputes',   href: '/admin/disputes',  icon: ShieldAlert },
    { name: 'Shipments',  href: '/shipments',       icon: Ship },
    { name: 'Settings',   href: '/settings',        icon: Settings },
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

  // Three-way portal theme, computed straight from the account's userType so
  // every DashboardLayout consumer stays in sync automatically — no caller
  // needs to know about the ADMIN variant. The legacy `tradeParty` prop is
  // still accepted for backwards compatibility but only matters when the
  // account is Trade Party vs Logistics Chain; ADMIN always wins.
  const isAdmin      = currentUser.userType === 'ADMIN';
  const isTradeParty = !isAdmin && (tradeParty || currentUser.userType === 'TRADE_PARTY');
  const themeAttr    = isAdmin ? 'admin' : isTradeParty ? 'trade-party' : 'logistics-chain';
  const items        = isAdmin ? adminNavItems : navItems;

  // Per-portal style tokens — Trade Party (wine/amber) and Logistics Chain
  // (ink/teal) as before, plus a third Admin (ink/steel, monochrome and
  // deliberately un-colorful) so an admin account never looks like either
  // self-service portal.
  const sidebarBg = isAdmin
    ? 'linear-gradient(175deg, #0A1220 0%, var(--color-ink) 45%, var(--color-ink-soft) 160%)'
    : isTradeParty
    ? 'linear-gradient(175deg, #5C0A2E 0%, #8B1646 45%, #6E1138 160%)'
    : 'linear-gradient(175deg, var(--color-ink) 0%, var(--color-ink-soft) 45%, var(--color-teal-hover) 160%)';
  const sidebarGlow = isAdmin
    ? 'radial-gradient(ellipse at 110% 5%, rgba(129,151,198,0.22) 0%, transparent 45%), radial-gradient(ellipse at -10% 95%, rgba(129,151,198,0.10) 0%, transparent 50%)'
    : isTradeParty
    ? 'radial-gradient(ellipse at 110% 5%, rgba(254,153,0,0.22) 0%, transparent 45%), radial-gradient(ellipse at -10% 95%, rgba(254,153,0,0.10) 0%, transparent 50%)'
    : 'radial-gradient(ellipse at 110% 5%, rgba(207,226,230,0.18) 0%, transparent 45%), radial-gradient(ellipse at -10% 95%, rgba(207,226,230,0.12) 0%, transparent 50%)';
  const avatarBg = isAdmin ? 'rgba(129,151,198,0.25)' : isTradeParty ? 'rgba(254,153,0,0.25)' : 'var(--color-ink-soft)';
  const avatarSubColor = isAdmin ? 'rgba(129,151,198,0.75)' : isTradeParty ? 'rgba(254,153,0,0.55)' : 'rgba(255,255,255,0.4)';
  const navHoverBg = isAdmin
    ? 'linear-gradient(90deg, rgba(129,151,198,0.14) 0%, rgba(129,151,198,0.06) 100%)'
    : isTradeParty
    ? 'linear-gradient(90deg, rgba(254,153,0,0.10) 0%, rgba(254,153,0,0.05) 100%)'
    : 'linear-gradient(90deg, rgba(207,226,230,0.07) 0%, rgba(129,151,198,0.10) 100%)';
  const footerBg = isAdmin
    ? 'linear-gradient(90deg, rgba(129,151,198,0.10) 0%, rgba(129,151,198,0.05) 100%)'
    : isTradeParty
    ? 'linear-gradient(90deg, rgba(254,153,0,0.08) 0%, rgba(254,153,0,0.04) 100%)'
    : 'linear-gradient(90deg, rgba(207,226,230,0.05) 0%, rgba(129,151,198,0.10) 100%)';
  const footerBorder = isAdmin ? 'rgba(129,151,198,0.5)' : isTradeParty ? 'rgba(254,153,0,0.45)' : 'var(--theme-accent-border)';
  const footerText = isAdmin ? 'rgba(129,151,198,0.9)' : isTradeParty ? 'rgba(254,153,0,0.85)' : 'rgba(255,255,255,0.8)';
  const headerBg = isAdmin
    ? 'linear-gradient(90deg, #fffaf0 0%, var(--color-amber-light) 60%, var(--color-mist-light) 100%)'
    : isTradeParty
    ? 'linear-gradient(160deg, #fff0f5 0%, #fdf6f9 40%, var(--color-mist-light) 100%)'
    : 'linear-gradient(90deg, #ffffff 0%, var(--color-mist-light) 60%, var(--color-mist) 100%)';
  const mainBg = isAdmin
    ? 'linear-gradient(160deg, #fffaf0 0%, var(--color-amber-light) 40%, var(--color-mist-light) 100%)'
    : isTradeParty
    ? 'linear-gradient(160deg, #fff0f5 0%, #fdf6f9 40%, var(--color-mist-light) 100%)'
    : 'linear-gradient(160deg, #f4f7fb 0%, #eef2f8 40%, var(--color-mist-light) 100%)';
  const iconHoverClasses = isAdmin
    ? 'text-[color:var(--color-steel)] hover:bg-steel-light'
    : isTradeParty
    ? 'text-wine/70 hover:bg-wine-light'
    : 'text-ink-faint hover:bg-mist-light';
  const portalLabel = isAdmin ? 'Platform Admin Portal' : isTradeParty ? 'Trade Party Portal' : 'Logistics Chain Portal';
  const portalLabelColor = isAdmin ? 'var(--color-steel)' : isTradeParty ? 'var(--color-amber)' : 'var(--color-teal)';
  const mobileHeaderBg = isAdmin
    ? 'var(--color-ink)'
    : isTradeParty
    ? 'linear-gradient(175deg, #5C0A2E 0%, #8B1646 50%, #6E1138 100%)'
    : 'var(--color-ink)';
  const mobileBadge = isAdmin
    ? { label: 'Admin', bg: 'rgba(129,151,198,0.25)', color: 'var(--color-mist)' }
    : isTradeParty
    ? { label: 'Trade Party', bg: 'rgba(254,153,0,0.2)', color: 'var(--color-amber)' }
    : null;
  const mobileActiveBg = isAdmin
    ? 'rgba(129,151,198,0.2)'
    : isTradeParty
    ? 'linear-gradient(90deg, rgba(254,153,0,0.18) 0%, rgba(254,153,0,0.08) 100%)'
    : 'rgba(255,255,255,0.1)';
  const mobileActiveBorder = isAdmin ? '2px solid var(--color-steel)' : isTradeParty ? '2px solid var(--color-amber)' : 'none';

  return (
    <div data-theme={themeAttr} className="min-h-screen bg-mist-light text-ink font-sans flex">

      {/* ── SIDEBAR ── */}
      <aside
        className="hidden md:flex flex-col w-[220px] text-white flex-shrink-0 select-none h-screen sticky top-0 relative"
        style={{ background: sidebarBg }}
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: sidebarGlow }} />

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
            style={{ background: avatarBg }}
          >
            {userInitials}
          </div>
          <div className="overflow-hidden flex-1">
            <h4 className="text-[11px] font-bold truncate text-white leading-tight">{currentUser.fullName}</h4>
            <p className="text-[10px] font-medium tracking-wider uppercase truncate mt-0.5" style={{ color: avatarSubColor }}>{isAdmin ? 'MariTrade Platform' : currentUser.companyName}</p>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto relative z-10">
          {items.map((item) => {
            const IconComp = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/'));
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
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = navHoverBg; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = ''; }}
              >
                <IconComp className="w-[15px] h-[15px] shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* NEW SHIPMENT — not applicable for admin accounts */}
        {!isAdmin && (
          <div
            className="px-4 py-4 border-t border-white/10 relative z-10"
            style={{ background: footerBg }}
          >
            <Link
              href="/shipments/new"
              className="w-full font-bold py-2.5 rounded-lg text-[11px] tracking-wider transition-all flex items-center justify-center gap-1.5 uppercase border hover:bg-white/10"
              style={{ borderColor: footerBorder, color: footerText }}
            >
              + NEW SHIPMENT
            </Link>
          </div>
        )}
        {isAdmin && (
          <div className="px-4 py-4 border-t border-white/10 relative z-10 flex items-center gap-2" style={{ background: footerBg }}>
            <ShieldAlert className="w-3.5 h-3.5" style={{ color: 'var(--color-steel)' }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-mist)' }}>Internal Staff Access</span>
          </div>
        )}
      </aside>

      {/* ── RIGHT COLUMN (topbar + main) ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* TOP BAR */}
        <header
          className="border-b px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0"
          style={{ background: headerBg, borderBottomColor: 'var(--color-mist)' }}
        >
          <div className="flex items-center gap-3">
            <button
              className={`md:hidden p-1.5 rounded-lg transition-colors ${iconHoverClasses}`}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Portal identity tag — Tungsten display type, themed per user type */}
            <span className="hidden sm:block font-display uppercase tracking-wide" style={{ fontSize: '24px', color: portalLabelColor }}>
              {portalLabel}
            </span>
          </div>

          {/* Right: user info + sign out */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-ink-faint">
              {getUserJobRoles(currentUser).map(r => r.replace(/_/g, ' ')).join(' + ')}
            </span>

            {/* ── Notification Bell ── */}
            <div className="relative">
              <button
                onClick={() => setShowNotifPanel(v => !v)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors relative ${iconHoverClasses}`}
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
                      className="absolute right-0 top-10 w-[calc(100vw-2rem)] max-w-80 bg-white border border-mist rounded-2xl shadow-2xl z-40 overflow-hidden"
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
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${iconHoverClasses}`}
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
                style={{ background: mobileHeaderBg }}
              >
                <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={isTradeParty ? { background: 'rgba(254,153,0,0.2)' } : isAdmin ? { background: 'rgba(129,151,198,0.2)' } : { background: 'rgba(255,255,255,0.1)' }}>
                      <Ship className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold tracking-widest text-white">MARITRADE</span>
                    {mobileBadge && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: mobileBadge.bg, color: mobileBadge.color }}>{mobileBadge.label}</span>}
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                  {items.map((item) => {
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
                          background: mobileActiveBg,
                          borderLeft: mobileActiveBorder,
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
          style={{ background: mainBg }}
        >
          {flush ? (
            <div className="h-full w-full flex flex-col">{children}</div>
          ) : (
            <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6 pb-10">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
