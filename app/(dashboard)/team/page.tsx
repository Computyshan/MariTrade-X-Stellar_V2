'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession, authFetch } from '@/hooks/use-user-session';
import {
  Users,
  UserPlus,
  UserMinus,
  Mail,
  Crown,
  ShieldCheck,
  Building2,
  X,
  CheckCircle2,
  Clock,
  Trash2,
  ArrowRightLeft,
  AlertCircle,
  LogOut,
  Ship,
} from 'lucide-react';
import { Firm, FirmInvite, User, Shipment } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamData {
  firm: Firm | null;
  members: User[];
  invites: FirmInvite[];
  myPendingInvites: FirmInvite[];
}

export default function TeamPage() {
  const { currentUser } = useUserSession();
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Create-team form
  const [newFirmName, setNewFirmName] = useState('');
  const [creating, setCreating] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // Removal / reassignment flow
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);
  const [removeTargetShipments, setRemoveTargetShipments] = useState<Shipment[]>([]);
  const [reassignTo, setReassignTo] = useState('');
  const [removing, setRemoving] = useState(false);
  const [checkingShipments, setCheckingShipments] = useState(false);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTeam = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/firms?userId=${currentUser.id}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  // ── Create team ──────────────────────────────────────────────────────────
  const handleCreateFirm = async () => {
    if (!newFirmName.trim()) return;
    setCreating(true);
    try {
      const res = await authFetch('/api/firms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFirmName.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setNewFirmName('');
        showToast('success', 'Team created');
        await fetchTeam();
      } else {
        showToast('error', json.error || 'Failed to create team');
      }
    } finally {
      setCreating(false);
    }
  };

  // ── Invite ────────────────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !data?.firm) return;
    setInviting(true);
    try {
      const res = await authFetch('/api/firms/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId: data.firm.id, email: inviteEmail.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setInviteEmail('');
        showToast('success', `Invite sent to ${inviteEmail.trim()}`);
        await fetchTeam();
      } else {
        showToast('error', json.error || 'Failed to send invite');
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const res = await authFetch(`/api/firms/invites/${inviteId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('success', 'Invite revoked');
      await fetchTeam();
    } else {
      showToast('error', json.error || 'Failed to revoke invite');
    }
  };

  // ── Respond to an invite addressed to me ────────────────────────────────
  const respondToInvite = async (inviteId: string, action: 'ACCEPT' | 'DECLINE') => {
    const res = await authFetch(`/api/firms/invites/${inviteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (json.success) {
      showToast('success', action === 'ACCEPT' ? 'Joined the team' : 'Invite declined');
      await fetchTeam();
    } else {
      showToast('error', json.error || 'Failed to respond to invite');
    }
  };

  // ── Removal flow (with optional reassignment) ──────────────────────────
  const openRemoveFlow = async (member: User) => {
    setRemoveTarget(member);
    setReassignTo('');
    setCheckingShipments(true);
    try {
      const res = await authFetch(`/api/firms/members/${member.id}`);
      const json = await res.json();
      setRemoveTargetShipments(json.success ? json.data : []);
    } finally {
      setCheckingShipments(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await authFetch(`/api/firms/members/${removeTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reassignTo ? { reassignShipmentsTo: reassignTo } : {}),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', removeTarget.id === currentUser?.id ? 'You left the team' : `${removeTarget.fullName} removed`);
        setRemoveTarget(null);
        await fetchTeam();
      } else {
        showToast('error', json.error || 'Failed to remove member');
      }
    } finally {
      setRemoving(false);
    }
  };

  if (!currentUser) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-accent)', borderTopColor: 'transparent' }} />
        </div>
      </DashboardLayout>
    );
  }

  const isTradeParty = currentUser.userType === 'TRADE_PARTY';
  const isOwner = !!data?.firm && data.firm.ownerId === currentUser.id;
  const otherMembers = (data?.members ?? []).filter(m => m.id !== removeTarget?.id);

  return (
    <DashboardLayout tradeParty={isTradeParty}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── PAGE HEADER ── */}
        <div className="border-b border-mist pb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-medium text-ink tracking-tight flex items-center gap-2.5">
              <Users className="w-7 h-7" style={{ color: 'var(--theme-accent)' }} />
              Team Seats
            </h1>
            <p className="text-sm text-ink-faint mt-1">
              Give colleagues their own login under one company account and share shipment visibility.
            </p>
          </div>
        </div>

        {/* ── TOAST ── */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-teal text-white' : 'bg-wine text-white'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* ── Pending invites addressed to me ── */}
            {data && data.myPendingInvites.length > 0 && (
              <div className="bg-white border border-mist rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-mist flex items-center gap-2" style={{ background: 'var(--theme-accent-muted)' }}>
                  <Mail className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
                  <h3 className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--theme-accent)' }}>
                    Team Invites Waiting For You
                  </h3>
                </div>
                <div className="divide-y divide-mist">
                  {data.myPendingInvites.map(inv => (
                    <div key={inv.id} className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-ink">You&apos;ve been invited to join a team</p>
                        <p className="text-[11px] text-ink-faint mt-0.5">Invited {new Date(inv.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => respondToInvite(inv.id, 'ACCEPT')}
                          disabled={!!data.firm}
                          title={data.firm ? 'Leave your current team first' : undefined}
                          className="bg-teal hover:bg-teal-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => respondToInvite(inv.id, 'DECLINE')}
                          className="border border-mist text-ink-faint hover:bg-mist-light text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── No team yet: create one ── */}
            {!data?.firm && (
              <div className="bg-white border border-mist rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-mist flex items-center gap-2 bg-mist-light">
                  <Building2 className="w-4 h-4 text-ink-faint" />
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-ink-faint">Start a Team</h3>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-xs text-ink-faint leading-relaxed">
                    Create a multi-seat team account so colleagues can log in under their own credentials,
                    see the shipments your team is working on, and hand off work when someone&apos;s away.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="e.g. Domingo Global Forwarding"
                      value={newFirmName}
                      onChange={(e) => setNewFirmName(e.target.value)}
                      className="flex-1 bg-white border border-mist rounded-lg px-3 py-2.5 text-xs outline-none focus:border-amber"
                    />
                    <button
                      onClick={handleCreateFirm}
                      disabled={creating || !newFirmName.trim()}
                      className="bg-amber hover:bg-amber-hover disabled:opacity-60 text-white text-[11px] font-bold px-5 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {creating ? 'Creating…' : 'Create Team'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Team dashboard ── */}
            {data?.firm && (
              <>
                {/* Firm header card */}
                <div className="bg-white border border-mist rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-mist flex items-center justify-between gap-2" style={{ background: 'var(--theme-accent-muted)' }}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
                      <h3 className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--theme-accent)' }}>
                        {data.firm.name}
                      </h3>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint">
                      {data.members.length} / {data.firm.seatLimit} seats used
                    </span>
                  </div>

                  <div className="divide-y divide-mist">
                    {data.members.map(member => {
                      const isMemberOwner = member.firmRole === 'OWNER';
                      const canRemove = isOwner ? member.id !== currentUser.id : member.id === currentUser.id;
                      return (
                        <div key={member.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0"
                              style={{ background: 'var(--theme-accent)' }}
                            >
                              {member.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-ink truncate">{member.fullName}</p>
                                {isMemberOwner ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-light text-amber">
                                    <Crown className="w-2.5 h-2.5" /> Owner
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-steel-light text-steel">
                                    <ShieldCheck className="w-2.5 h-2.5" /> Member
                                  </span>
                                )}
                                {member.id === currentUser.id && (
                                  <span className="text-[9px] font-bold text-ink-faint">(you)</span>
                                )}
                              </div>
                              <p className="text-[11px] text-ink-faint truncate">{member.email} · {member.jobRole.replace(/_/g, ' ')}</p>
                            </div>
                          </div>

                          {canRemove && (
                            <button
                              onClick={() => openRemoveFlow(member)}
                              className="flex items-center gap-1.5 text-[11px] font-bold text-wine hover:bg-wine-light px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                              {member.id === currentUser.id ? (
                                <><LogOut className="w-3.5 h-3.5" /> Leave Team</>
                              ) : (
                                <><UserMinus className="w-3.5 h-3.5" /> Remove</>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Invite panel (owner only) */}
                {isOwner && (
                  <div className="bg-white border border-mist rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-mist flex items-center gap-2 bg-mist-light">
                      <UserPlus className="w-4 h-4 text-ink-faint" />
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-ink-faint">Invite a Seat</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="email"
                          placeholder="colleague@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="flex-1 bg-white border border-mist rounded-lg px-3 py-2.5 text-xs outline-none focus:border-amber"
                        />
                        <button
                          onClick={handleInvite}
                          disabled={inviting || !inviteEmail.trim() || data.members.length >= data.firm.seatLimit}
                          className="bg-amber hover:bg-amber-hover disabled:opacity-60 text-white text-[11px] font-bold px-5 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {inviting ? 'Sending…' : 'Send Invite'}
                        </button>
                      </div>
                      {data.members.length >= data.firm.seatLimit && (
                        <p className="text-[11px] text-wine font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" /> Seat limit reached ({data.firm.seatLimit}). Remove a member to free up a seat.
                        </p>
                      )}

                      {/* Pending invites list */}
                      {data.invites.filter(i => i.status === 'PENDING').length > 0 && (
                        <div className="pt-3 border-t border-mist space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-ink-faint">Pending</p>
                          {data.invites.filter(i => i.status === 'PENDING').map(inv => (
                            <div key={inv.id} className="flex items-center justify-between gap-3 bg-mist-light rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Clock className="w-3.5 h-3.5 text-ink-faint shrink-0" />
                                <span className="text-[11px] font-semibold text-ink truncate">{inv.invitedEmail}</span>
                              </div>
                              <button
                                onClick={() => handleRevokeInvite(inv.id)}
                                className="text-ink-faint hover:text-wine transition-colors cursor-pointer shrink-0"
                                title="Revoke invite"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── REMOVAL / REASSIGNMENT MODAL ── */}
      {removeTarget && (
        <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-mist flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">
                {removeTarget.id === currentUser.id ? 'Leave Team' : `Remove ${removeTarget.fullName}`}
              </h3>
              <button onClick={() => setRemoveTarget(null)} className="text-ink-faint hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {checkingShipments ? (
                <div className="py-6 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-accent)', borderTopColor: 'transparent' }} />
                </div>
              ) : removeTargetShipments.length > 0 ? (
                <>
                  <div className="flex items-start gap-2 bg-amber-light rounded-lg p-3">
                    <Ship className="w-4 h-4 text-amber shrink-0 mt-0.5" />
                    <p className="text-[11px] text-ink leading-relaxed">
                      {removeTarget.fullName} is on <strong>{removeTargetShipments.length}</strong> active
                      shipment{removeTargetShipments.length === 1 ? '' : 's'}. Hand these off to a teammate,
                      or leave them assigned as-is.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] text-ink-faint uppercase font-mono tracking-wider">
                      Reassign to (optional)
                    </label>
                    <select
                      value={reassignTo}
                      onChange={(e) => setReassignTo(e.target.value)}
                      className="w-full bg-white border border-mist rounded-lg px-3 py-2.5 text-xs outline-none focus:border-amber"
                    >
                      <option value="">Don&apos;t reassign — leave as-is</option>
                      {otherMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.fullName} ({m.jobRole.replace(/_/g, ' ')})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-ink-faint">
                    <ArrowRightLeft className="w-3 h-3" />
                    Reassignment preserves the shipment&apos;s history — only the responsible teammate changes.
                  </div>
                </>
              ) : (
                <p className="text-xs text-ink-faint">
                  {removeTarget.fullName} has no active shipment assignments to hand off.
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={confirmRemove}
                  disabled={removing || checkingShipments}
                  className="flex-1 bg-wine hover:bg-wine-hover disabled:opacity-60 text-white text-[11px] font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  {removing ? 'Removing…' : removeTarget.id === currentUser.id ? 'Leave Team' : 'Remove Member'}
                </button>
                <button
                  onClick={() => setRemoveTarget(null)}
                  className="border border-mist text-ink-faint hover:bg-mist-light text-[11px] font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
