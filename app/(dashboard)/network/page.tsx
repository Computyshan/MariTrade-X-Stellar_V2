'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { authFetch } from '@/hooks/use-user-session';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  UserPlus,
  UserCheck,
  UserMinus,
  XCircle,
  Shield,
  Building2,
  Anchor,
  Truck,
  Warehouse,
  FileCheck,
  ChevronRight,
  BadgeCheck,
  Network,
  AlertCircle,
  RefreshCw,
  X,
  Eye,
  Star,
} from 'lucide-react';
import { JobRole, User } from '@/types';
import UserProfileModal from '@/components/UserProfileModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | null;

interface MemberEntry extends User {
  connectionId: string | null;
  connectionStatus: ConnectionStatus;
  isSender: boolean;
}

interface ConnectionEntry {
  id: string;
  requesterId: string;
  receiverId: string;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
  direction: 'SENT' | 'RECEIVED';
  otherParty: User | null;
  favoritedBy?: string[];
}

type Tab = 'directory' | 'pending' | 'network';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOB_ROLE_LABELS: Record<JobRole, string> = {
  IMPORTER:            'Importer',
  EXPORTER:            'Exporter',
  FREIGHT_FORWARDER:   'Freight Forwarder',
  WAREHOUSE_OPERATOR:  'Warehouse Operator',
  CUSTOMS_BROKER:      'Customs Broker',
};

const JOB_ROLE_ICON: Record<string, React.ReactNode> = {
  FREIGHT_FORWARDER:  <Anchor className="w-4 h-4" />,
  CUSTOMS_BROKER:     <FileCheck className="w-4 h-4" />,
  WAREHOUSE_OPERATOR: <Warehouse className="w-4 h-4" />,
  TRUCKER:            <Truck className="w-4 h-4" />,
};

const JOB_ROLE_COLOR: Record<string, string> = {
  IMPORTER:           'bg-wine-light text-wine border-wine/20',
  EXPORTER:           'bg-teal-light text-teal border-teal/20',
  FREIGHT_FORWARDER:  'bg-steel-light text-steel border-steel/20',
  CUSTOMS_BROKER:     'bg-amber-light text-amber border-amber/20',
  WAREHOUSE_OPERATOR: 'bg-mist text-ink-faint border-mist-dark',
  TRUCKER:            'bg-mist text-ink-faint border-mist-dark',
};

function RoleBadge({ role }: { role: string }) {
  const color = JOB_ROLE_COLOR[role] || 'bg-mist text-ink-faint border-mist-dark';
  const icon = JOB_ROLE_ICON[role] || <Shield className="w-3.5 h-3.5" />;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${color}`}>
      {icon}
      {JOB_ROLE_LABELS[role as JobRole] ?? role.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NetworkPage() {
  const { currentUser } = useUserSession();
  const [activeTab, setActiveTab] = useState<Tab>('directory');
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [totalMemberCount, setTotalMemberCount] = useState(0);
  const [connections, setConnections] = useState<ConnectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  // Profile drawer
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const currentUserId = currentUser?.id;

  const fetchDirectory = useCallback(async () => {
    if (!currentUserId) return;
    const res = await authFetch(
      `/api/network/directory?requesterId=${currentUserId}&search=${encodeURIComponent(search)}`
    );
    const json = await res.json();
    if (json.success) {
      setMembers(json.data);
      if (search === '') setTotalMemberCount(json.data.length);
    }
  }, [currentUserId, search]);

  const fetchConnections = useCallback(async () => {
    if (!currentUserId) return;
    const res = await authFetch(`/api/network/connections?userId=${currentUserId}`);
    const json = await res.json();
    if (json.success) setConnections(json.data);
  }, [currentUserId]);

  const refresh = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    await Promise.all([fetchDirectory(), fetchConnections()]);
    setLoading(false);
  }, [fetchDirectory, fetchConnections, currentUserId]);

  useEffect(() => {
    if (currentUserId) refresh();
  }, [currentUserId]);

  // Background poll every 30s
  useEffect(() => {
    if (!currentUserId) return;
    const interval = setInterval(() => {
      if (!actionLoading) {
        fetchConnections();
        fetchDirectory();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [currentUserId, actionLoading, fetchConnections, fetchDirectory]);

  // Search debounce — skip on mount (refresh already ran), only fire on search changes
  const isMounted = React.useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    const t = setTimeout(fetchDirectory, 350);
    return () => clearTimeout(t);
  }, [search]);

  const sendRequest = async (receiverId: string) => {
    if (!currentUser?.id) return;
    // Immediately mark as pending in local state to block re-clicks
    setMembers(prev =>
      prev.map(m =>
        m.id === receiverId
          ? { ...m, connectionStatus: 'PENDING' as const, connectionId: 'optimistic', isSender: true }
          : m
      )
    );
    setActionLoading(receiverId);
    try {
      const res = await authFetch('/api/network/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: currentUser.id, receiverId }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Connection request sent!');
        await refresh();
      } else {
        // Revert optimistic update on failure
        setMembers(prev =>
          prev.map(m =>
            m.id === receiverId
              ? { ...m, connectionStatus: null, connectionId: null, isSender: false }
              : m
          )
        );
        showToast('error', json.error || 'Failed to send request.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const respondToRequest = async (connId: string, status: 'ACCEPTED' | 'REJECTED') => {
    if (!currentUser?.id) return;
    setActionLoading(connId);
    try {
      const res = await authFetch(`/api/network/connections/${connId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, actorId: currentUser.id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', status === 'ACCEPTED' ? 'Member added to your MariNet!' : 'Request declined.');
        await refresh();
      } else {
        showToast('error', json.error || 'Action failed.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const toggleFavorite = async (connId: string) => {
    if (!currentUser?.id) return;
    // Optimistic toggle
    setConnections(prev =>
      prev.map(c => {
        if (c.id !== connId) return c;
        const current = c.favoritedBy ?? [];
        const isFav = current.includes(currentUser.id);
        return {
          ...c,
          favoritedBy: isFav ? current.filter(id => id !== currentUser.id) : [...current, currentUser.id],
        };
      })
    );
    try {
      const res = await authFetch(`/api/network/connections/${connId}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: currentUser.id }),
      });
      const json = await res.json();
      if (!json.success) {
        showToast('error', json.error || 'Could not update favorite.');
        await fetchConnections(); // re-sync on failure
      }
    } catch {
      await fetchConnections();
    }
  };

  const removeConnection = async (connId: string, memberId: string, mode: 'cancel' | 'remove') => {
    if (!currentUser?.id || !connId) return;
    // Optimistically clear local state immediately
    if (memberId) {
      setMembers(prev =>
        prev.map(m =>
          m.id === memberId
            ? { ...m, connectionStatus: null, connectionId: null, isSender: false }
            : m
        )
      );
    }
    setActionLoading(connId);
    try {
      const res = await authFetch(`/api/network/connections/${connId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: currentUser.id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', mode === 'cancel' ? 'Request cancelled.' : 'Removed from your MariNet.');
        await refresh();
      } else {
        showToast('error', json.error || 'Action failed.');
        await refresh(); // re-sync on failure
      }
    } finally {
      setActionLoading(null);
    }
  };

  const pendingReceived = connections.filter(c => c.direction === 'RECEIVED' && c.status === 'PENDING');
  const pendingSent     = connections.filter(c => c.direction === 'SENT'     && c.status === 'PENDING');
  const trustedNetworkAll = connections
    .filter(c => c.status === 'ACCEPTED')
    .sort((a, b) => {
      const aFav = (a.favoritedBy ?? []).includes(currentUserId ?? '');
      const bFav = (b.favoritedBy ?? []).includes(currentUserId ?? '');
      if (aFav !== bFav) return aFav ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  const favoritedCount = trustedNetworkAll.filter(c => (c.favoritedBy ?? []).includes(currentUserId ?? '')).length;
  const trustedNetwork = favoritesOnly
    ? trustedNetworkAll.filter(c => (c.favoritedBy ?? []).includes(currentUserId ?? ''))
    : trustedNetworkAll;

  // Guard: currentUser may be null briefly during sign-out redirect
  if (!currentUser) return null;

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'directory', label: 'Member Directory' },
    { id: 'pending',   label: 'Pending', count: pendingReceived.length + pendingSent.length },
    { id: 'network',   label: 'My MariNet', count: trustedNetworkAll.length },
  ];

  return (
    <DashboardLayout>
      {/* ── Public Profile Drawer ── */}
      <UserProfileModal
        userId={viewProfileId}
        onClose={() => setViewProfileId(null)}
      />
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-bold border
          ${toast.type === 'success' ? 'bg-teal-light border-teal/20 text-teal' : 'bg-wine-light border-wine/20 text-wine'}`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 text-teal" />
            : <AlertCircle className="w-4 h-4 text-wine" />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-medium text-ink tracking-tight flex items-center gap-3">
            <Network className="w-8 h-8" style={{ color: 'var(--theme-accent)' }} />
            B2B MariNet
          </h1>
          <p className="text-xs text-ink-faint mt-1.5 max-w-lg">
            Discover and connect with KYC-verified members across all roles — importers, exporters, freight forwarders, customs brokers, and warehouse operators.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink font-bold cursor-pointer transition-colors flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Connections',   value: trustedNetworkAll.length,    colorClass: 'text-teal',     bg: 'bg-teal-light border-teal/15' },
          { label: 'Pending',       value: pendingSent.length + pendingReceived.length, colorClass: 'text-amber', bg: 'bg-amber-light border-amber/15' },
          { label: 'Total Members', value: totalMemberCount,          colorClass: 'text-ink',      bg: 'bg-white border-mist' },
        ].map(stat => (
          <div key={stat.label} className={`border rounded-xl p-4 ${stat.bg}`}>
            <p className="text-[10px] font-bold text-ink-faint uppercase tracking-widest">{stat.label}</p>
            <p className={`text-3xl font-display font-medium mt-1 ${stat.colorClass}`}>{String(stat.value).padStart(2, '0')}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-mist-light border border-mist rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
              ${activeTab === tab.id ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink'}`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-black
                ${activeTab === tab.id ? 'text-white' : 'bg-mist text-ink-faint'}`}
                style={activeTab === tab.id ? { background: 'var(--theme-accent)' } : {}}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ TAB: MEMBER DIRECTORY ══════════════════════════════════════════════ */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, company, or role..."
              className="w-full border border-mist rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:border-mist-dark bg-white"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-mist rounded-2xl p-5 animate-pulse space-y-3">
                  <div className="h-4 bg-mist rounded w-2/3" />
                  <div className="h-3 bg-mist rounded w-1/2" />
                  <div className="h-8 bg-mist rounded-lg mt-4" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-16 bg-white border border-mist rounded-2xl">
              <Users className="w-10 h-10 text-mist-dark mx-auto mb-3" />
              <p className="text-sm font-bold text-ink-faint">No verified members found</p>
              <p className="text-xs text-ink-faint/60 mt-1">Try a different search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map(member => {
                const connStatus = member.connectionStatus;
                const isLoadingThis = actionLoading === member.id;
                const isSelf = member.id === currentUser.id;
                return (
                  <div
                    key={member.id}
                    className={`bg-white border rounded-2xl p-5 flex flex-col gap-4 transition-all
                      ${connStatus === 'ACCEPTED' ? 'border-teal/25 shadow-sm' : 'border-mist hover:border-mist-dark'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-ink text-white flex items-center justify-center font-black text-sm flex-shrink-0">
                          {member.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-ink leading-tight">{member.fullName}</p>
                          <p className="text-[10px] text-ink-faint mt-0.5 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {member.companyName || '—'}
                          </p>
                        </div>
                      </div>
                      <BadgeCheck className="w-5 h-5 text-teal flex-shrink-0 mt-0.5" aria-label="KYC Verified" />
                    </div>

                    <div className="space-y-2">
                      <RoleBadge role={member.jobRole} />
                      {member.fullAddress && (
                        <p className="text-[10px] text-ink-faint">{member.fullAddress}</p>
                      )}
                    </div>

                    <div className="mt-auto pt-3 border-t border-mist space-y-2">
                      {/* View profile — always shown except for yourself */}
                      {!isSelf && (
                        <button
                          onClick={() => setViewProfileId(member.id)}
                          className="w-full flex items-center justify-center gap-1.5 border border-mist hover:bg-mist-light text-ink-faint hover:text-ink text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> View Profile
                        </button>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        {isSelf && (
                          <span className="text-[10px] text-ink-faint font-bold">You</span>
                        )}
                        {!connStatus && !isSelf && (
                          <button
                            onClick={() => sendRequest(member.id)}
                            disabled={isLoadingThis}
                            className="flex-1 flex items-center justify-center gap-1.5 text-white text-[11px] font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-60"
                            style={{ background: 'var(--theme-accent)' }}
                          >
                            {isLoadingThis ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                            Connect
                          </button>
                        )}
                        {connStatus === 'REJECTED' && !isSelf && (
                          <button
                            onClick={() => sendRequest(member.id)}
                            disabled={isLoadingThis}
                            className="flex-1 flex items-center justify-center gap-1.5 text-white text-[11px] font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-60"
                            style={{ background: 'var(--theme-accent)' }}
                          >
                            {isLoadingThis ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                            Connect
                          </button>
                        )}
                        {connStatus === 'ACCEPTED' && !isSelf && (
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-[10px] text-teal font-bold flex items-center gap-1 flex-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> In your MariNet
                            </span>
                            <button
                              onClick={() => removeConnection(member.connectionId!, member.id, 'remove')}
                              disabled={actionLoading === member.connectionId}
                              className="flex items-center gap-1 border border-mist hover:bg-wine-light hover:border-wine/20 text-ink-faint hover:text-wine text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer disabled:opacity-60"
                            >
                              <UserMinus className="w-3 h-3" /> Remove
                            </button>
                          </div>
                        )}
                        {connStatus === 'PENDING' && member.isSender && (
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-[10px] text-amber font-bold flex items-center gap-1 flex-1">
                              <Clock className="w-3.5 h-3.5" /> Awaiting response
                            </span>
                            <button
                              onClick={() => removeConnection(member.connectionId!, member.id, 'cancel')}
                              disabled={actionLoading === member.connectionId}
                              className="flex items-center gap-1 border border-mist hover:bg-wine-light hover:border-wine/20 text-ink-faint hover:text-wine text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer disabled:opacity-60"
                            >
                              <X className="w-3 h-3" /> Cancel
                            </button>
                          </div>
                        )}
                        {connStatus === 'PENDING' && !member.isSender && !isSelf && (
                          <span className="text-[10px] text-ink-faint font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Wants to connect
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: PENDING REQUESTS ══════════════════════════════════════════════ */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          {/* Incoming */}
          {pendingReceived.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
                Incoming Requests
              </h3>
              <div className="space-y-3">
                {pendingReceived.map(conn => (
                <div key={conn.id} className="bg-white border border-mist rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-ink text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {conn.otherParty?.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                <p className="text-xs font-bold text-ink">{conn.otherParty?.fullName}</p>
                <p className="text-[10px] text-ink-faint">{conn.otherParty?.companyName} · {JOB_ROLE_LABELS[conn.otherParty?.jobRole as JobRole] ?? ''}</p>
                <p className="text-[10px] text-ink-faint/60 mt-0.5">
                Requested {new Date(conn.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </p>
                </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                {conn.otherParty && (
                <button
                  onClick={() => setViewProfileId(conn.otherParty!.id)}
                  className="flex items-center gap-1.5 border border-mist hover:bg-mist-light text-ink-faint text-[11px] font-bold px-3 py-2 rounded-lg transition-all cursor-pointer"
                >
                    <Eye className="w-3.5 h-3.5" />
                </button>
                )}
                <button
                onClick={() => respondToRequest(conn.id, 'ACCEPTED')}
                disabled={actionLoading === conn.id}
                className="flex items-center gap-1.5 text-white text-[11px] font-black px-4 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-60"
                    style={{ background: 'var(--theme-accent)' }}
                >
                  <UserCheck className="w-3.5 h-3.5" /> Accept
                  </button>
                    <button
                        onClick={() => respondToRequest(conn.id, 'REJECTED')}
                          disabled={actionLoading === conn.id}
                          className="flex items-center gap-1.5 border border-mist hover:bg-wine-light hover:border-wine/20 text-ink-faint hover:text-wine text-[11px] font-bold px-4 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-60"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {pendingSent.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber" />
                Awaiting Response
              </h3>
              <div className="space-y-3">
                {pendingSent.map(conn => (
                  <div key={conn.id} className="bg-amber-light border border-amber/20 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-light border border-amber/20 text-amber flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {conn.otherParty?.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-ink">{conn.otherParty?.fullName}</p>
                      <p className="text-[10px] text-ink-faint">{conn.otherParty?.companyName} · {JOB_ROLE_LABELS[conn.otherParty?.jobRole as JobRole] ?? ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-amber font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Pending
                      </span>
                      <button
                        onClick={() => removeConnection(conn.id, conn.otherParty?.id ?? '', 'cancel')}
                        disabled={actionLoading === conn.id}
                        className="flex items-center gap-1 border border-amber/25 hover:bg-wine-light hover:border-wine/20 text-amber hover:text-wine text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-60"
                      >
                        {actionLoading === conn.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingReceived.length === 0 && pendingSent.length === 0 && (
            <div className="text-center py-16 bg-white border border-mist rounded-2xl">
              <Clock className="w-10 h-10 text-mist-dark mx-auto mb-3" />
              <p className="text-sm font-bold text-ink-faint">No pending requests</p>
              <p className="text-xs text-ink-faint/60 mt-1">Browse the Member Directory to connect with others.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: MY MARINET ════════════════════════════════════════════════════ */}
      {activeTab === 'network' && (
        <div className="space-y-4">
          {trustedNetworkAll.length > 0 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setFavoritesOnly(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer
                  ${favoritesOnly ? 'bg-amber-light border-amber/30 text-amber' : 'border-mist text-ink-faint hover:text-ink hover:bg-mist-light'}`}
              >
                <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-amber' : ''}`} />
                {favoritesOnly ? `Favorites (${favoritedCount})` : `Show Favorites Only${favoritedCount ? ` (${favoritedCount})` : ''}`}
              </button>
            </div>
          )}
          {trustedNetwork.length === 0 ? (
            favoritesOnly ? (
              <div className="text-center py-16 bg-white border border-mist rounded-2xl">
                <Star className="w-10 h-10 text-mist-dark mx-auto mb-3" />
                <p className="text-sm font-bold text-ink-faint">No favorited counterparties yet</p>
                <p className="text-xs text-ink-faint/60 mt-1 max-w-xs mx-auto">
                  Star a connection below to pin it here for quick access.
                </p>
                <button
                  onClick={() => setFavoritesOnly(false)}
                  className="mt-4 flex items-center gap-1.5 mx-auto text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer"
                  style={{ background: 'var(--theme-accent)' }}
                >
                  View All Connections <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
            <div className="text-center py-16 bg-white border border-mist rounded-2xl">
              <Users className="w-10 h-10 text-mist-dark mx-auto mb-3" />
              <p className="text-sm font-bold text-ink-faint">Your MariNet is empty</p>
              <p className="text-xs text-ink-faint/60 mt-1 max-w-xs mx-auto">
                Browse the Member Directory and send connection requests to get started.
              </p>
              <button
                onClick={() => setActiveTab('directory')}
                className="mt-4 flex items-center gap-1.5 mx-auto text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer"
                style={{ background: 'var(--theme-accent)' }}
              >
                Browse Directory <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trustedNetwork.map(conn => {
              const member = conn.otherParty;
              if (!member) return null;
              const isFavorited = (conn.favoritedBy ?? []).includes(currentUserId ?? '');
              return (
              <div key={conn.id} className={`bg-white border rounded-2xl p-5 flex flex-col gap-4 shadow-sm ${isFavorited ? 'border-amber/30 ring-1 ring-amber/15' : 'border-mist'}`}>
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" /> MariNet Member
              </div>
              <div className="flex items-center gap-1.5">
              <button
                onClick={() => toggleFavorite(conn.id)}
                title={isFavorited ? 'Remove from favorites' : 'Save as favorite'}
                className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-all cursor-pointer
                  ${isFavorited ? 'bg-amber-light border-amber/30 text-amber' : 'border-mist text-ink-faint hover:text-amber hover:border-amber/30'}`}
              >
                <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-amber' : ''}`} />
              </button>
              <button
                onClick={() => setViewProfileId(member.id)}
                className="flex items-center gap-1 border border-mist hover:bg-mist-light text-ink-faint hover:text-ink text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                <Eye className="w-3 h-3" /> Profile
              </button>
                <button
                    onClick={() => removeConnection(conn.id, member.id, 'remove')}
                    disabled={actionLoading === conn.id}
                  className="flex items-center gap-1 border border-mist hover:bg-wine-light hover:border-wine/20 text-ink-faint hover:text-wine text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-60"
              >
                  {actionLoading === conn.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3 h-3" />}
                  Remove
              </button>
              </div>
              </div>
              <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-ink text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {member.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                <p className="text-xs font-bold text-ink">{member.fullName}</p>
                <p className="text-[10px] text-ink-faint flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3" /> {member.companyName}
                    </p>
                    </div>
                    </div>
                        <RoleBadge role={member.jobRole} />
                        <div className="pt-2 border-t border-mist text-[10px] text-ink-faint flex items-center gap-1">
                          <BadgeCheck className="w-3.5 h-3.5 text-teal" />
                          KYC Verified · Connected {new Date(conn.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
