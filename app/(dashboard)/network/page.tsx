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
} from 'lucide-react';
import { JobRole, User } from '@/types';

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
  IMPORTER:           'bg-maritime-50 text-maritime-700 border-maritime-100',
  EXPORTER:           'bg-green-50 text-green-700 border-green-100',
  FREIGHT_FORWARDER:  'bg-blue-50 text-blue-700 border-blue-100',
  CUSTOMS_BROKER:     'bg-amber-50 text-amber-700 border-amber-100',
  WAREHOUSE_OPERATOR: 'bg-purple-50 text-purple-700 border-purple-100',
  TRUCKER:            'bg-orange-50 text-orange-700 border-orange-100',
};

function RoleBadge({ role }: { role: string }) {
  const color = JOB_ROLE_COLOR[role] || 'bg-sand-50 text-gray-600 border-sand-200';
  const icon = JOB_ROLE_ICON[role] || <Shield className="w-3.5 h-3.5" />;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${color}`}>
      {icon}
      {JOB_ROLE_LABELS[role as JobRole] ?? role.replace(/_/g, ' ')}
    </span>
  );
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (!status) return null;
  const cfg = {
    ACCEPTED: { label: 'Connected', icon: <CheckCircle2 className="w-3.5 h-3.5" />, className: 'text-ocean-600 bg-ocean-50 border-ocean-100' },
    PENDING:  { label: 'Pending',   icon: <Clock className="w-3.5 h-3.5" />,        className: 'text-amber-600 bg-amber-50 border-amber-100' },
    REJECTED: { label: 'Declined',  icon: <XCircle className="w-3.5 h-3.5" />,      className: 'text-coral-600 bg-coral-50 border-coral-100' },
  }[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.className}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NetworkPage() {
  const { currentUser } = useUserSession();
  const [activeTab, setActiveTab] = useState<Tab>('directory');
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [connections, setConnections] = useState<ConnectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDirectory = useCallback(async () => {
    if (!currentUser?.id) return;
    const res = await authFetch(
      `/api/network/directory?requesterId=${currentUser.id}&search=${encodeURIComponent(search)}`
    );
    const json = await res.json();
    if (json.success) setMembers(json.data);
  }, [currentUser?.id, search]);

  const fetchConnections = useCallback(async () => {
    if (!currentUser?.id) return;
    const res = await authFetch(`/api/network/connections?userId=${currentUser.id}`);
    const json = await res.json();
    if (json.success) setConnections(json.data);
  }, [currentUser?.id]);

  const refresh = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    await Promise.all([fetchDirectory(), fetchConnections()]);
    setLoading(false);
  }, [fetchDirectory, fetchConnections, currentUser?.id]);

  useEffect(() => { if (currentUser?.id) refresh(); }, [currentUser?.id]);

  useEffect(() => {
    const t = setTimeout(fetchDirectory, 350);
    return () => clearTimeout(t);
  }, [search, fetchDirectory]);

  const sendRequest = async (receiverId: string) => {
    if (!currentUser?.id) return;
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

  const pendingReceived = connections.filter(c => c.direction === 'RECEIVED' && c.status === 'PENDING');
  const pendingSent     = connections.filter(c => c.direction === 'SENT'     && c.status === 'PENDING');
  const trustedNetwork  = connections.filter(c => c.status === 'ACCEPTED');

  // Guard: currentUser may be null briefly during sign-out redirect
  if (!currentUser) return null;

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'directory', label: 'Member Directory' },
    { id: 'pending',   label: 'Pending', count: pendingReceived.length + pendingSent.length },
    { id: 'network',   label: 'My MariNet', count: trustedNetwork.length },
  ];

  return (
    <DashboardLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-bold border
          ${toast.type === 'success' ? 'bg-ocean-50 border-ocean-200 text-ocean-700' : 'bg-coral-50 border-coral-200 text-coral-700'}`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 text-ocean-400" />
            : <AlertCircle className="w-4 h-4 text-coral-400" />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-maritime-900 tracking-tight flex items-center gap-3">
            <Network className="w-8 h-8 text-maritime-400" />
            B2B MariNet
          </h1>
          <p className="text-xs text-gray-500 mt-1.5 max-w-lg">
            Discover and connect with KYC-verified members across all roles — importers, exporters, freight forwarders, customs brokers, and warehouse operators.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-maritime-400 hover:text-maritime-900 font-bold cursor-pointer transition-colors flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Connections',   value: trustedNetwork.length,                          color: 'text-ocean-600',    bg: 'bg-ocean-50 border-ocean-100' },
          { label: 'Pending',       value: pendingSent.length + pendingReceived.length,     color: 'text-amber-600',    bg: 'bg-amber-50 border-amber-100' },
          { label: 'Members Found', value: members.length,                                 color: 'text-maritime-600', bg: 'bg-maritime-50 border-maritime-100' },
        ].map(stat => (
          <div key={stat.label} className={`border rounded-xl p-4 ${stat.bg}`}>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{stat.label}</p>
            <p className={`text-3xl font-black mt-1 ${stat.color}`}>{String(stat.value).padStart(2, '0')}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-sand-100 border border-sand-200 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
              ${activeTab === tab.id ? 'bg-white text-maritime-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-black
                ${activeTab === tab.id ? 'bg-maritime-400 text-white' : 'bg-gray-200 text-gray-600'}`}>
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
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, company, or role..."
              className="w-full border border-sand-200 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:border-maritime-400 bg-white"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-sand-200 rounded-2xl p-5 animate-pulse space-y-3">
                  <div className="h-4 bg-sand-100 rounded w-2/3" />
                  <div className="h-3 bg-sand-100 rounded w-1/2" />
                  <div className="h-8 bg-sand-100 rounded-lg mt-4" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-16 bg-white border border-sand-200 rounded-2xl">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-400">No verified members found</p>
              <p className="text-xs text-gray-300 mt-1">Try a different search term.</p>
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
                      ${connStatus === 'ACCEPTED' ? 'border-ocean-200 shadow-sm' : 'border-sand-200 hover:border-maritime-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-maritime-900 text-white flex items-center justify-center font-black text-sm flex-shrink-0">
                          {member.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-black text-maritime-900 leading-tight">{member.fullName}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {member.companyName || '—'}
                          </p>
                        </div>
                      </div>
                      <BadgeCheck className="w-5 h-5 text-ocean-400 flex-shrink-0 mt-0.5" aria-label="KYC Verified" />
                    </div>

                    <div className="space-y-2">
                      <RoleBadge role={member.jobRole} />
                      {member.fullAddress && (
                        <p className="text-[10px] text-gray-400">{member.fullAddress}</p>
                      )}
                    </div>

                    <div className="mt-auto pt-3 border-t border-sand-100 flex items-center justify-between gap-3">
                      <ConnectionBadge status={connStatus} />
                      {isSelf && (
                        <span className="text-[10px] text-gray-400 font-bold">You</span>
                      )}
                      {!connStatus && !isSelf && (
                        <button
                          onClick={() => sendRequest(member.id)}
                          disabled={isLoadingThis}
                          className="flex items-center gap-1.5 bg-maritime-400 hover:bg-maritime-900 text-white text-[11px] font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-60"
                        >
                          {isLoadingThis ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                          Connect
                        </button>
                      )}
                      {connStatus === 'ACCEPTED' && (
                        <span className="text-[10px] text-ocean-500 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> In your MariNet
                        </span>
                      )}
                      {connStatus === 'PENDING' && member.isSender && (
                        <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Awaiting response
                        </span>
                      )}
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
          {pendingReceived.length > 0 && (
            <div>
              <h3 className="text-xs font-black text-maritime-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-maritime-400" />
                Incoming Requests
              </h3>
              <div className="space-y-3">
                {pendingReceived.map(conn => (
                  <div key={conn.id} className="bg-white border border-sand-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-maritime-900 text-white flex items-center justify-center font-black text-sm flex-shrink-0">
                        {conn.otherParty?.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-black text-maritime-900">{conn.otherParty?.fullName}</p>
                        <p className="text-[10px] text-gray-400">{conn.otherParty?.companyName} · {JOB_ROLE_LABELS[conn.otherParty?.jobRole as JobRole] ?? ''}</p>
                        <p className="text-[10px] text-gray-300 mt-0.5">
                          Requested {new Date(conn.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => respondToRequest(conn.id, 'ACCEPTED')}
                        disabled={actionLoading === conn.id}
                        className="flex items-center gap-1.5 bg-ocean-400 hover:bg-ocean-600 text-white text-[11px] font-black px-4 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-60"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => respondToRequest(conn.id, 'REJECTED')}
                        disabled={actionLoading === conn.id}
                        className="flex items-center gap-1.5 border border-sand-200 hover:bg-coral-50 hover:border-coral-200 text-gray-500 hover:text-coral-600 text-[11px] font-bold px-4 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-60"
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
              <h3 className="text-xs font-black text-maritime-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Awaiting Response
              </h3>
              <div className="space-y-3">
                {pendingSent.map(conn => (
                  <div key={conn.id} className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center font-black text-sm flex-shrink-0">
                      {conn.otherParty?.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-maritime-900">{conn.otherParty?.fullName}</p>
                      <p className="text-[10px] text-gray-500">{conn.otherParty?.companyName} · {JOB_ROLE_LABELS[conn.otherParty?.jobRole as JobRole] ?? ''}</p>
                    </div>
                    <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingReceived.length === 0 && pendingSent.length === 0 && (
            <div className="text-center py-16 bg-white border border-sand-200 rounded-2xl">
              <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-400">No pending requests</p>
              <p className="text-xs text-gray-300 mt-1">Browse the Member Directory to connect with others.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: MY MARINET ════════════════════════════════════════════════════ */}
      {activeTab === 'network' && (
        <div className="space-y-4">
          {trustedNetwork.length === 0 ? (
            <div className="text-center py-16 bg-white border border-sand-200 rounded-2xl">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-400">Your MariNet is empty</p>
              <p className="text-xs text-gray-300 mt-1 max-w-xs mx-auto">
                Browse the Member Directory and send connection requests to get started.
              </p>
              <button
                onClick={() => setActiveTab('directory')}
                className="mt-4 flex items-center gap-1.5 mx-auto bg-maritime-400 hover:bg-maritime-900 text-white text-xs font-black px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Browse Directory <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trustedNetwork.map(conn => {
                const member = conn.otherParty;
                if (!member) return null;
                return (
                  <div key={conn.id} className="bg-white border border-ocean-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-ocean-600 uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5" /> MariNet Member
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-maritime-900 text-white flex items-center justify-center font-black text-sm flex-shrink-0">
                        {member.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-black text-maritime-900">{member.fullName}</p>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" /> {member.companyName}
                        </p>
                      </div>
                    </div>
                    <RoleBadge role={member.jobRole} />
                    <div className="pt-2 border-t border-sand-100 text-[10px] text-gray-400 flex items-center gap-1">
                      <BadgeCheck className="w-3.5 h-3.5 text-ocean-400" />
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
