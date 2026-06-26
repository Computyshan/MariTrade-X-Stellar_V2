'use client';
/* eslint-disable */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import {
  MessageSquare,
  Send,
  CheckCircle,
  RefreshCw,
  Coins,
  Search,
  X,
  FileUp,
  ClipboardList,
  Lock,
  ShieldCheck,
  Paperclip,
  Bell,
  User,
  Handshake,
  Network,
  CheckCircle2,
  UserPlus,
  BadgeCheck,
  Anchor,
  Warehouse,
  FileCheck,
  Truck,
  Shield,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { ChatThread, Message, User as UserType, JobRole } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ThreadWithMeta = ChatThread & {
  otherParticipant?: {
    id: string;
    fullName: string;
    companyName?: string;
    jobRole?: string;
  };
  lastMessage?: Message;
};

type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | null;

interface NetworkMember extends UserType {
  connectionId: string | null;
  connectionStatus: ConnectionStatus;
  isSender: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOB_ROLE_LABELS: Record<string, string> = {
  IMPORTER: 'Importer',
  EXPORTER: 'Exporter',
  FREIGHT_FORWARDER: 'Freight Forwarder',
  WAREHOUSE_OPERATOR: 'Warehouse Operator',
  CUSTOMS_BROKER: 'Customs Broker',
};

const JOB_ROLE_COLOR: Record<string, string> = {
  IMPORTER:           'bg-cyan-50 text-cyan-700 border-cyan-200',
  EXPORTER:           'bg-amber-50 text-amber-700 border-amber-200',
  CUSTOMS_BROKER:     'bg-violet-50 text-violet-700 border-violet-200',
  FREIGHT_FORWARDER:  'bg-blue-50 text-blue-700 border-blue-200',
  WAREHOUSE_OPERATOR: 'bg-purple-50 text-purple-700 border-purple-200',
};

const JOB_ROLE_ICON: Record<string, React.ReactNode> = {
  FREIGHT_FORWARDER:  <Anchor className="w-3.5 h-3.5" />,
  CUSTOMS_BROKER:     <FileCheck className="w-3.5 h-3.5" />,
  WAREHOUSE_OPERATOR: <Warehouse className="w-3.5 h-3.5" />,
  TRUCKER:            <Truck className="w-3.5 h-3.5" />,
};

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0][0].toUpperCase();
}

function getRoleColor(role: string): string {
  return JOB_ROLE_COLOR[role] || 'bg-gray-100 text-gray-700 border-gray-200';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatNegotiationCenter() {
  const { currentUser, allUsers } = useUserSession();

  const [threads, setThreads]               = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [messages, setMessages]             = useState<Message[]>([]);
  const [loading, setLoading]               = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Network members (trusted connections)
  const [networkMembers, setNetworkMembers] = useState<NetworkMember[]>([]);
  const [networkLoading, setNetworkLoading] = useState(true);

  const [sidebarTab, setSidebarTab] = useState<'chats' | 'network'>('chats');
  const [channelSearch, setChannelSearch]   = useState('');
  const [networkSearch, setNetworkSearch]   = useState('');
  const [lightboxImage, setLightboxImage]   = useState<string | null>(null);

  const [replyText, setReplyText]           = useState('');
  const [proposedPrice, setProposedPrice]   = useState('');
  const [proposedDesc, setProposedDesc]     = useState('');

  const [submittingMsg, setSubmittingMsg]   = useState(false);
  const [proposingCounter, setProposingCounter] = useState(false);
  const [showChecklistPopover, setShowChecklistPopover] = useState(false);
  const [showImagePicker, setShowImagePicker]   = useState(false);
  const [selectedImage, setSelectedImage]   = useState<string | null>(null);
  const [showNegotiationPanel, setShowNegotiationPanel] = useState(false);

  // Toast for network-gate errors
  const [toast, setToast] = useState<{ type: 'error' | 'info'; msg: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const showToast = (type: 'error' | 'info', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch threads ──────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async (selectFirst = false, silent = false) => {
    if (!currentUser?.id) return;
    try {
      if (!silent) setLoading(true);
      const res  = await fetch(`/api/messages/threads?userId=${currentUser.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setThreads(json.data);
        if (json.data.length === 0) {
          setSelectedThreadId('');
          setMessages([]);
        } else if (selectFirst) {
          setSelectedThreadId(json.data[0].id);
        } else if (selectedThreadId && !json.data.some((t: ThreadWithMeta) => t.id === selectedThreadId)) {
          setSelectedThreadId('');
          setMessages([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentUser?.id, selectedThreadId]);

  // ── Fetch trusted network ──────────────────────────────────────────────────

  const fetchNetwork = useCallback(async () => {
    if (!currentUser?.id) return;
    setNetworkLoading(true);
    try {
      const res  = await fetch(`/api/network/directory?requesterId=${currentUser.id}`);
      const json = await res.json();
      if (json.success) setNetworkMembers(json.data);
    } catch {}
    finally { setNetworkLoading(false); }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      fetchThreads(false);
      fetchNetwork();
    }
  }, [currentUser?.id]);

  // ── Fetch messages for selected thread ────────────────────────────────────

  const fetchMessagesOfThread = useCallback(async (id: string, silent = false) => {
    if (!id) return;
    try {
      if (!silent) setLoadingMessages(true);
      const res  = await fetch(`/api/messages/threads/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMessages(json.data.messages || []);
        setProposedPrice(
          json.data.thread.currentCounterPriceUSD != null
            ? String(json.data.thread.currentCounterPriceUSD)
            : ''
        );
        setProposedDesc(json.data.thread.cargoDescription || '');
        setThreads(prev => prev.map(t => t.id === id ? { ...t, ...json.data.thread } : t));
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedThreadId) fetchMessagesOfThread(selectedThreadId);
    else setMessages([]);
  }, [selectedThreadId]);

  // Polling
  useEffect(() => {
    if (!currentUser?.id) return;
    const i = setInterval(() => fetchThreads(false, true), 8000);
    return () => clearInterval(i);
  }, [currentUser?.id, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    const i = setInterval(() => fetchMessagesOfThread(selectedThreadId, true), 4000);
    return () => clearInterval(i);
  }, [selectedThreadId]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const isTradePartyOnlyConversation = (partnerId?: string | null) => {
    if (currentUser?.userType === 'LOGISTICS_CHAIN' || !partnerId) return false;
    const partner = allUsers.find(u => u.id === partnerId);
    return partner?.userType === 'TRADE_PARTY';
  };

  const activeThread       = threads.find(t => t.id === selectedThreadId);
  const isTradePartyThread = isTradePartyOnlyConversation((activeThread as any)?.otherParticipant?.id);

  useEffect(() => {
    if (!isTradePartyThread) setShowNegotiationPanel(false);
  }, [selectedThreadId, isTradePartyThread]);

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [messages]);

  // ── Filtered lists ─────────────────────────────────────────────────────────

  const filteredThreads = threads.filter(t => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return true;
    const partner = (t as any).otherParticipant;
    if (!partner) return false;
    return (
      partner.fullName.toLowerCase().includes(q) ||
      (partner.companyName || '').toLowerCase().includes(q) ||
      ((t as any).cargoDescription || '').toLowerCase().includes(q)
    );
  });

  // Network tab: show trusted (ACCEPTED) connections only
  const trustedMembers = networkMembers.filter(m => m.connectionStatus === 'ACCEPTED');
  const pendingMembers = networkMembers.filter(m => m.connectionStatus === 'PENDING');

  const filteredTrusted = trustedMembers.filter(m => {
    const q = networkSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      m.fullName.toLowerCase().includes(q) ||
      (m.companyName || '').toLowerCase().includes(q) ||
      m.jobRole.toLowerCase().includes(q)
    );
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Please select an image smaller than 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target?.result) { setSelectedImage(ev.target.result as string); setShowImagePicker(false); } };
    reader.readAsDataURL(file);
  };

  const handleUnsendMessage = async (msgId: string) => {
    if (!confirm('Unsend this message? It will be retracted for all participants.')) return;
    const res  = await fetch(`/api/messages/threads/${selectedThreadId}?messageId=${msgId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) fetchMessagesOfThread(selectedThreadId);
    else alert(json.error || 'Failed to unsend');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId) return;
    if (!replyText.trim() && !selectedImage) return;
    try {
      setSubmittingMsg(true);
      const res  = await fetch(`/api/messages/threads/${selectedThreadId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ senderId: currentUser.id, content: replyText, imageUrl: selectedImage || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setReplyText('');
        setSelectedImage(null);
        await fetchMessagesOfThread(selectedThreadId);
        fetchThreads(false, true);
      } else {
        alert(json.error || 'Failed to send message');
      }
    } catch { console.warn('Post message failed'); }
    finally { setSubmittingMsg(false); }
  };

  const handleProposeCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId || !isTradePartyThread) return;
    try {
      setProposingCounter(true);
      const res  = await fetch(`/api/messages/threads/${selectedThreadId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action: 'COUNTER_TERMS',
          senderId: currentUser.id,
          counterTerms: `Value: $${proposedPrice} - Description: ${proposedDesc}`,
          currentCounterPriceUSD: Number(proposedPrice),
          cargoDescription: proposedDesc,
        }),
      });
      const json = await res.json();
      if (json.success) { fetchThreads(); fetchMessagesOfThread(selectedThreadId); }
    } catch { console.warn('Counter offer failed'); }
    finally { setProposingCounter(false); }
  };

  const handleAcceptFinalTerms = async () => {
    if (!selectedThreadId || !isTradePartyThread) return;
    if (!confirm('Lock these terms and generate the Stellar multi-sign Escrow contract?')) return;
    const res  = await fetch(`/api/messages/threads/${selectedThreadId}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'CONVERT_TO_SHIPMENT', senderId: currentUser.id }),
    });
    const json = await res.json();
    if (json.success) {
      alert('Deal accepted! Shipment contract and reference generated.');
      fetchThreads();
      fetchMessagesOfThread(selectedThreadId);
    }
  };

  // Only allow messaging trusted network members
  const handleStartChat = async (receiverId: string) => {
    const member = networkMembers.find(m => m.id === receiverId);
    if (!member || member.connectionStatus !== 'ACCEPTED') {
      showToast('error', 'You can only message vendors in your Trusted Network.');
      return;
    }
    try {
      const res  = await fetch('/api/messages/threads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ senderId: currentUser.id, receiverId }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSidebarTab('chats');
        await fetchThreads();
        setSelectedThreadId(json.data.threadId);
      } else {
        showToast('error', json.error || 'Could not open conversation.');
      }
    } catch { showToast('error', 'Network error — please try again.'); }
  };

  const formatMessageTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getLastMessagePreview = (thread: ThreadWithMeta) => {
    const m = thread.lastMessage;
    if (!m) return 'No messages yet';
    if (m.isUnsent) return 'Message unsent';
    if (m.imageUrl && !m.content) return '📷 Attachment';
    return `${m.senderId === currentUser.id ? 'You: ' : ''}${m.content || '📷 Attachment'}`;
  };

  const getThreadTimestamp = (thread: ThreadWithMeta) =>
    thread.lastMessage?.createdAt || thread.updatedAt || thread.createdAt
      ? formatMessageTime(thread.lastMessage?.createdAt || thread.updatedAt || thread.createdAt)
      : '';

  // Whether the other party in the active thread is a trusted network member
  const activePartnerId = (activeThread as any)?.otherParticipant?.id;
  const activePartnerIsTrusted = networkMembers.some(
    m => m.id === activePartnerId && m.connectionStatus === 'ACCEPTED'
  );

  return (
    <DashboardLayout flush={true}>
      <div className="flex flex-col h-screen w-full bg-white text-slate-800 overflow-hidden">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-bold border
            ${toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{toast.msg}</span>
            {toast.type === 'error' && (
              <Link href="/network" className="underline ml-1 hover:no-underline">
                Go to Network →
              </Link>
            )}
            <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Top Header */}
        <header className="h-14 bg-white border-b border-gray-200 px-4 md:px-5 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-[#0058be]" style={{ strokeWidth: 2.2 }} />
            <span className="font-extrabold text-[13px] tracking-tight text-gray-900">
              Messages &amp; Chat
            </span>
            <div className="h-4 w-px bg-gray-200" />
            {/* Network size pill */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-ocean-600 bg-ocean-50 border border-ocean-100 px-2.5 py-1 rounded-full">
              <Network className="w-3 h-3" />
              {trustedMembers.length} trusted vendor{trustedMembers.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Deal checklist — Trade Party threads only */}
            {isTradePartyThread && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowChecklistPopover(p => !p)}
                  className="relative bg-white border border-gray-200 hover:border-gray-300 p-1.5 rounded-lg flex items-center justify-center text-gray-600 cursor-pointer active:scale-95 transition-all"
                  title="View Deal Checklist"
                >
                  <ClipboardList className="w-4 h-4 text-gray-500" />
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#ba1a1a] text-[9px] text-white flex items-center justify-center rounded-full font-bold">
                    {activeThread?.status === 'DEAL_AGREED' ? '0' : '2'}
                  </span>
                </button>
                {showChecklistPopover && (
                  <div className="absolute right-0 mt-2.5 w-80 bg-white shadow-2xl rounded-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="p-3 bg-[#111c30] flex items-center justify-between text-white">
                      <h5 className="font-extrabold flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono">
                        <ClipboardList className="w-3.5 h-3.5" /> Deal Checklist
                      </h5>
                      <button onClick={() => setShowChecklistPopover(false)} className="text-white hover:text-red-400 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4 space-y-3 text-xs">
                      <div className="flex gap-2">
                        <div className="shrink-0 w-4 h-4 rounded border-2 border-green-500 bg-green-50 flex items-center justify-center text-[9px] text-green-600 font-extrabold">✓</div>
                        <div>
                          <p className="font-bold text-gray-950 text-[11px]">Bill of Lading Draft</p>
                          <p className="text-[10px] text-gray-500">Confirmed by Exporter</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center text-[9px] font-extrabold
                          ${activeThread?.status === 'DEAL_AGREED' ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-300'}`}>
                          {activeThread?.status === 'DEAL_AGREED' ? '✓' : ''}
                        </div>
                        <div>
                          <p className="font-bold text-gray-950 text-[11px]">Escrow Account Allocation</p>
                          <p className="text-[10px] text-gray-500">
                            {activeThread?.status === 'DEAL_AGREED' ? 'Secured and Synced' : 'Pending Importer Approval'}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                        <div className="bg-gray-100 h-1.5 w-full rounded-full overflow-hidden">
                          <div className="bg-[#0058be] h-full transition-all" style={{ width: activeThread?.status === 'DEAL_AGREED' ? '100%' : '50%' }} />
                        </div>
                        <p className="text-right text-[9px] font-bold mt-1 text-[#0058be] uppercase font-mono">
                          {activeThread?.status === 'DEAL_AGREED' ? '100% Completed' : '50% Progress'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button className="p-1.5 border border-gray-200 hover:border-gray-300 rounded-lg text-gray-500 bg-white">
              <Bell className="w-4 h-4" />
            </button>
            <button className="p-1.5 border border-gray-200 hover:border-gray-300 rounded-lg text-gray-500 bg-white">
              <User className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main layout */}
        <div className="flex-1 flex overflow-hidden w-full">

          {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
          <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col h-full bg-slate-50/20 overflow-hidden">

            {/* Tab switcher */}
            <div className="p-3 pb-2 border-b border-gray-200 bg-white">
              <div className="flex bg-[#eceef0] p-0.5 rounded-lg w-full shadow-inner">
                <button
                  type="button"
                  onClick={() => setSidebarTab('chats')}
                  className={`flex-1 text-center py-1.5 text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer
                    ${sidebarTab === 'chats' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-950'}`}
                >
                  Chats ({threads.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSidebarTab('network'); fetchNetwork(); }}
                  className={`flex-1 text-center py-1.5 text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer flex items-center justify-center gap-1
                    ${sidebarTab === 'network' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-950'}`}
                >
                  <Network className="w-3 h-3" />
                  Network
                  {trustedMembers.length > 0 && (
                    <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black
                      ${sidebarTab === 'network' ? 'bg-ocean-400 text-white' : 'bg-gray-300 text-gray-600'}`}>
                      {trustedMembers.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-3 bg-white border-b border-gray-100 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full bg-white border border-gray-200 rounded-lg py-1.5 pl-8 pr-3 text-[11px] font-medium outline-none focus:border-[#0058be] transition-all"
                  placeholder={sidebarTab === 'chats' ? 'Filter chats...' : 'Search trusted vendors...'}
                  type="text"
                  value={sidebarTab === 'chats' ? channelSearch : networkSearch}
                  onChange={e => sidebarTab === 'chats' ? setChannelSearch(e.target.value) : setNetworkSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Scroll area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30">

              {/* ── CHATS TAB ──────────────────────────────────────────────── */}
              {sidebarTab === 'chats' && (
                <>
                  <p className="px-1 text-[9px] font-extrabold text-[#76777d] uppercase tracking-wider font-mono mb-1">
                    Secure Channels
                  </p>
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="w-4 h-4 border-2 border-[#0058be] border-t-transparent rounded-full animate-spin mx-auto" />
                      <span className="text-[11px] text-gray-400 block mt-2 font-mono">Syncing...</span>
                    </div>
                  ) : filteredThreads.length === 0 ? (
                    <div className="text-center py-8 bg-white border border-gray-100 rounded-xl p-4 space-y-2">
                      <MessageSquare className="w-7 h-7 text-gray-200 mx-auto" />
                      <p className="text-[11px] font-bold text-gray-500">
                        {threads.length === 0 ? 'No conversations yet' : 'No matching chats'}
                      </p>
                      {threads.length === 0 && (
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          Switch to the <strong>Network</strong> tab to message a trusted vendor.
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredThreads.map(t => {
                      const isSelected      = t.id === selectedThreadId;
                      const partner         = (t as any).otherParticipant;
                      const initials        = partner ? getInitials(partner.fullName) : '??';
                      const isTradeOnly     = isTradePartyOnlyConversation(partner?.id);
                      const partnerTrusted  = networkMembers.some(m => m.id === partner?.id && m.connectionStatus === 'ACCEPTED');

                      if (isSelected) {
                        return (
                          <div key={t.id} onClick={() => setSelectedThreadId(t.id)}
                            className="p-3 bg-[#111c30] text-white rounded-xl border border-[#111c30] shadow-md cursor-pointer">
                            <div className="flex gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-[11px] shrink-0 text-white">
                                {initials}
                              </div>
                              <div className="flex-1 overflow-hidden min-w-0">
                                <div className="flex justify-between items-start">
                                  <h4 className="font-bold text-white truncate text-xs">{partner?.fullName || 'Contact'}</h4>
                                  <span className="text-[9px] text-[#818ea1]">{getThreadTimestamp(t as ThreadWithMeta)}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{partner?.companyName || partner?.jobRole?.replace(/_/g, ' ')}</p>
                                {/* Trusted badge */}
                                {partnerTrusted && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[8px] font-bold text-ocean-400">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Trusted Network
                                  </span>
                                )}
                                {isTradeOnly && t.status === 'COUNTER_OFFER' && (t as any).currentCounterPriceUSD != null && (
                                  <div className="mt-2 bg-[#0d1524] rounded-lg p-2 border border-[#1f2d47]">
                                    <div className="flex justify-between items-center text-[8px] font-extrabold text-[#818ea1] uppercase">
                                      <span>Counter Offer</span>
                                      <span className="text-[#a4ccff]">${(t as any).currentCounterPriceUSD?.toLocaleString()} USDC</span>
                                    </div>
                                  </div>
                                )}
                                <p className="text-[10px] text-gray-400 mt-1.5 truncate font-medium">
                                  {getLastMessagePreview(t as ThreadWithMeta)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={t.id} onClick={() => setSelectedThreadId(t.id)}
                          className="p-3 bg-white border border-gray-200 hover:border-gray-300 rounded-xl transition-all cursor-pointer">
                          <div className="flex gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[11px] shrink-0 text-slate-700">
                              {initials}
                            </div>
                            <div className="flex-1 overflow-hidden min-w-0">
                              <div className="flex justify-between items-start">
                                <h4 className="font-bold text-gray-900 truncate text-xs">{partner?.fullName || 'Contact'}</h4>
                                <span className="text-[9px] text-gray-400 shrink-0">{getThreadTimestamp(t as ThreadWithMeta)}</span>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5 truncate">{partner?.companyName || partner?.jobRole?.replace(/_/g, ' ')}</p>
                              <div className="mt-1.5 flex items-center gap-2">
                                {partnerTrusted && (
                                  <span className="inline-flex items-center gap-1 text-[8px] font-bold text-ocean-600 bg-ocean-50 border border-ocean-100 px-1.5 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-2 h-2" /> Trusted
                                  </span>
                                )}
                                {isTradeOnly && (
                                  <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded uppercase tracking-wide
                                    ${t.status === 'DEAL_AGREED'   ? 'bg-green-50 text-green-700'
                                    : t.status === 'COUNTER_OFFER' ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'}`}>
                                    {t.status === 'DEAL_AGREED' ? 'Deal Agreed' : t.status === 'COUNTER_OFFER' ? 'Counter' : 'Open'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1 truncate font-medium">
                                {getLastMessagePreview(t as ThreadWithMeta)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* ── NETWORK TAB ────────────────────────────────────────────── */}
              {sidebarTab === 'network' && (
                <div className="space-y-3">
                  {networkLoading ? (
                    <div className="text-center py-10">
                      <div className="w-4 h-4 border-2 border-[#0058be] border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-[11px] text-gray-400 mt-2 font-mono">Loading network...</p>
                    </div>
                  ) : (
                    <>
                      {/* Trusted vendors — can message */}
                      {filteredTrusted.length > 0 && (
                        <div>
                          <p className="px-1 text-[9px] font-extrabold text-ocean-600 uppercase tracking-wider font-mono mb-2 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Trusted Vendors ({filteredTrusted.length})
                          </p>
                          <div className="space-y-2">
                            {filteredTrusted.map(member => {
                              const color    = getRoleColor(member.jobRole);
                              const initials = getInitials(member.fullName);
                              const hasThread = threads.some(t => (t as any).otherParticipant?.id === member.id);
                              return (
                                <div key={member.id}
                                  className="bg-white border border-ocean-100 rounded-xl p-3 space-y-2.5">
                                  <div className="flex items-start gap-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[11px] border shrink-0 ${color}`}>
                                      {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="font-bold text-xs text-slate-900 leading-tight truncate">{member.fullName}</h4>
                                        <BadgeCheck className="w-3 h-3 text-ocean-400 flex-shrink-0" aria-label="KYC Verified" />
                                      </div>
                                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{member.companyName}</p>
                                      <span className={`inline-block mt-1 text-[8px] px-1.5 py-0.5 font-bold rounded border uppercase tracking-wide ${color}`}>
                                        {JOB_ROLE_LABELS[member.jobRole] ?? member.jobRole.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleStartChat(member.id)}
                                    className="w-full bg-[#0058be] hover:bg-[#004395] text-white font-bold py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    {hasThread ? 'Open Chat' : `Message ${member.fullName.split(' ')[0]}`}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Pending connections */}
                      {pendingMembers.length > 0 && (
                        <div>
                          <p className="px-1 text-[9px] font-extrabold text-amber-600 uppercase tracking-wider font-mono mb-2 flex items-center gap-1">
                            ⏳ Pending ({pendingMembers.length})
                          </p>
                          <div className="space-y-2">
                            {pendingMembers.map(member => (
                              <div key={member.id}
                                className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2.5 opacity-70">
                                <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center font-bold text-[11px] shrink-0">
                                  {getInitials(member.fullName)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-xs text-slate-900 truncate">{member.fullName}</p>
                                  <p className="text-[10px] text-gray-500 truncate">{member.companyName}</p>
                                </div>
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                  Pending
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {trustedMembers.length === 0 && pendingMembers.length === 0 && (
                        <div className="text-center py-10 space-y-3">
                          <Network className="w-9 h-9 text-gray-200 mx-auto" />
                          <p className="text-xs font-bold text-gray-500">No vendors connected yet</p>
                          <p className="text-[10px] text-gray-400 leading-relaxed max-w-[200px] mx-auto">
                            Connect with verified vendors on the Network page to start messaging them.
                          </p>
                          <Link
                            href="/network"
                            className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#0058be] hover:underline"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Go to Vendor Network
                          </Link>
                        </div>
                      )}

                      {/* Always-visible link to full network page */}
                      {(trustedMembers.length > 0 || pendingMembers.length > 0) && (
                        <Link
                          href="/network"
                          className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-[#0058be] py-2 transition-colors"
                        >
                          Manage full network <ChevronRight className="w-3 h-3" />
                        </Link>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Negotiate button — Trade Party threads only */}
            {isTradePartyThread && activeThread && (
              <div className="p-3 bg-white border-t border-gray-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNegotiationPanel(p => !p)}
                  className="w-full bg-[#0058be] hover:bg-[#004395] text-white font-black py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-[10px] cursor-pointer active:scale-[0.98]"
                >
                  <Handshake className="w-4 h-4" /> NEGOTIATE
                </button>
              </div>
            )}
          </div>

          {/* ── CHAT AREA ──────────────────────────────────────────────────── */}
          <div className="flex-1 flex overflow-hidden min-w-0 h-full bg-[#f8fafc]">
            {activeThread ? (
              <div className="flex-1 flex h-full overflow-hidden">

                {/* Chat column */}
                <div className="flex-1 flex flex-col h-full bg-white overflow-hidden min-w-0">

                  {/* Chat header */}
                  <div className="h-14 border-b border-gray-150 px-5 flex items-center justify-between bg-white shrink-0 select-none">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#0058be] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                        {getInitials((activeThread as any).otherParticipant?.fullName || '??')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-xs text-gray-900 truncate">
                            {(activeThread as any).otherParticipant?.fullName || 'Representative'}
                          </h3>
                          <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[8px] font-extrabold rounded-full flex items-center gap-0.5 uppercase shrink-0">
                            <ShieldCheck className="w-2.5 h-2.5 text-green-600" /> KYC
                          </span>
                          {/* Trusted network badge */}
                          {activePartnerIsTrusted && (
                            <span className="px-1.5 py-0.5 bg-ocean-50 text-ocean-600 border border-ocean-100 text-[8px] font-extrabold rounded-full flex items-center gap-0.5 uppercase shrink-0">
                              <CheckCircle2 className="w-2 h-2" /> Trusted Network
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-medium truncate">
                          {(activeThread as any).otherParticipant?.companyName || 'Stellar Authorized counterparty'}
                        </p>
                      </div>
                    </div>
                    <p className="text-[9px] font-mono font-bold text-gray-400 shrink-0">ID: {activeThread.id}</p>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 p-4 md:p-5 overflow-y-auto space-y-4 flex flex-col bg-slate-50/20">
                    {loadingMessages && messages.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-4 h-4 border-2 border-[#0058be] border-t-transparent rounded-full animate-spin mx-auto" />
                          <span className="text-[11px] text-gray-400 block mt-2 font-mono">Loading messages...</span>
                        </div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-xs space-y-2">
                          <MessageSquare className="w-8 h-8 text-gray-300 mx-auto" />
                          <p className="text-sm font-bold text-gray-700">Start the conversation</p>
                          {activePartnerIsTrusted && (
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-ocean-600 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Trusted Network member — secure channel active
                            </div>
                          )}
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            Send a message below. Both parties will see it here in real time.
                          </p>
                        </div>
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isMe    = msg.senderId === currentUser.id;
                        const sender  = allUsers.find(u => u.id === msg.senderId);
                        const sName   = isMe ? 'You' : (sender?.fullName?.split(' ')[0] || 'Partner');
                        const sInits  = getInitials(sender?.fullName || 'Partner');
                        return (
                          <div key={msg.id} className={`flex gap-2.5 max-w-xl ${isMe ? 'self-end justify-end' : 'self-start'}`}>
                            {!isMe && (
                              <div className="flex flex-col items-center shrink-0 select-none">
                                <span className="text-[8px] font-bold uppercase text-gray-400 mb-0.5 font-mono">{sName}</span>
                                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[9px] text-slate-700">{sInits}</div>
                              </div>
                            )}
                            <div className="text-left">
                              <div className={`p-3 rounded-2xl shadow-sm ${
                                msg.isUnsent
                                  ? 'bg-gray-50 text-gray-400 border border-gray-100 italic text-[11px]'
                                  : isMe
                                    ? 'bg-[#0058be] text-white rounded-tr-none'
                                    : 'bg-white text-slate-900 border border-gray-150 rounded-tl-none'
                              }`}>
                                {isMe && !msg.isUnsent && (
                                  <button
                                    type="button"
                                    className="block text-[8px] font-mono font-bold text-white/50 hover:text-white cursor-pointer uppercase tracking-wider mb-0.5"
                                    onClick={() => handleUnsendMessage(msg.id)}
                                  >
                                    UNSEND
                                  </button>
                                )}
                                {msg.isUnsent ? (
                                  <span>This message has been retracted</span>
                                ) : (
                                  <>
                                    {msg.imageUrl && (
                                      <div className="relative rounded-lg overflow-hidden max-w-xs mb-1.5 border border-gray-200">
                                        <img
                                          src={msg.imageUrl}
                                          alt="Attachment"
                                          className="object-cover max-h-32 w-full cursor-zoom-in hover:brightness-95 transition-all"
                                          onClick={() => setLightboxImage(msg.imageUrl || null)}
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    )}
                                    {msg.content && (
                                      <p className="text-[11.5px] leading-relaxed font-sans whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                  </>
                                )}
                                <div className="flex justify-end items-center gap-1 mt-1 select-none">
                                  <span className={`text-[8px] font-mono ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {isMe && !msg.isUnsent && <span className="text-[10px] text-sky-200 font-bold">✓✓</span>}
                                </div>
                              </div>
                            </div>
                            {isMe && (
                              <div className="flex flex-col items-center shrink-0 select-none">
                                <span className="text-[8px] font-bold uppercase text-[#0058be] mb-0.5 font-mono">You</span>
                                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-[9px] text-[#0058be]">ME</div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input area */}
                  <div className="p-3 border-t border-gray-200 bg-white shrink-0 space-y-3">
                    {/* Quick replies */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
                      <span className="text-[8.5px] text-[#76777d] font-bold uppercase font-mono tracking-wider shrink-0 mr-1">⚡ QUICK:</span>
                      {[
                        ['🚢 Ready Load',   'Vessel space booked. Port load slot secured, cargo ready to dispatch.'],
                        ['📑 SAD Filed',    'BOC single administrative document (SAD) successfully filed for clearing.'],
                        ['🔒 Escrow',       'All criteria satisfied. Settle on immediate escrow release via Stellar counter.'],
                        ['📝 Verify Docs',  'Uploaded the latest required trade credentials. Please verify and sign.'],
                      ].map(([label, text]) => (
                        <button key={label} type="button" onClick={() => setReplyText(text)}
                          className="px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-[10px] font-bold text-slate-700 whitespace-nowrap cursor-pointer transition-all">
                          {label}
                        </button>
                      ))}
                    </div>

                    {selectedImage && (
                      <div className="flex items-center justify-between gap-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2 max-w-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={selectedImage} alt="Preview" className="w-8 h-8 object-cover rounded border border-gray-200 shrink-0" referrerPolicy="no-referrer" />
                          <span className="text-[10px] text-green-700 font-bold">Ready to send</span>
                        </div>
                        <button type="button" onClick={() => setSelectedImage(null)} className="text-gray-400 hover:text-red-500 cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleSendMessage} className="flex gap-2.5 items-center">
                      <button
                        type="button"
                        onClick={() => setShowImagePicker(p => !p)}
                        className={`p-2 rounded-lg transition-all shrink-0 cursor-pointer
                          ${showImagePicker ? 'bg-blue-50 text-[#0058be]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <div className="flex-1 bg-slate-50 border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#0058be] transition-all">
                        <textarea
                          rows={1}
                          className="w-full bg-transparent px-3 py-2 text-xs text-slate-900 placeholder-slate-400 resize-none outline-none"
                          placeholder="Type your message..."
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submittingMsg}
                        className="px-4 py-2 bg-[#0058be] hover:bg-[#004395] text-white font-black rounded-lg flex items-center gap-1 transition-all uppercase tracking-wider text-[10px] cursor-pointer disabled:opacity-60"
                      >
                        {submittingMsg ? 'Sending...' : 'SEND'}
                        <Send className="w-3 h-3" />
                      </button>
                    </form>

                    {showImagePicker && (
                      <div className="relative">
                        <div className="absolute bottom-12 left-0 bg-white border border-gray-200 shadow-xl rounded-xl p-3 z-40 w-64 space-y-2">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
                            <span className="font-bold text-[9px] text-[#76777d] uppercase tracking-wider font-mono">Attach Image</span>
                            <button onClick={() => setShowImagePicker(false)} className="text-gray-400 hover:text-gray-900 cursor-pointer">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-lg py-2 text-[9.5px] font-bold text-slate-600 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <FileUp className="w-3.5 h-3.5 text-slate-400" /> Select from device
                          </button>
                          <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleCustomImageUpload} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Negotiation panel — Trade Party only */}
                {showNegotiationPanel && isTradePartyThread && (
                  <div className="w-72 border-l border-gray-200 bg-white flex flex-col h-full shrink-0 overflow-y-auto">
                    <div className="p-4 border-b border-gray-150 bg-white flex items-center justify-between shrink-0">
                      <h4 className="font-extrabold text-gray-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono">
                        <Coins className="w-4 h-4 text-[#0058be]" /> Escrow &amp; Offer
                      </h4>
                      <button onClick={() => setShowNegotiationPanel(false)} className="text-gray-400 hover:text-gray-900 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="bg-white border-2 border-gray-950 p-4 rounded-xl relative">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[8.5px] text-[#76777d] font-mono font-black uppercase tracking-wider">Current Target Cost</span>
                          <Lock className="w-3 h-3 text-gray-400" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-950 font-mono leading-none mb-1">
                          {activeThread.currentCounterPriceUSD != null ? `$${activeThread.currentCounterPriceUSD.toLocaleString()}` : '—'}{' '}
                          <span className="text-[10px] font-extrabold text-gray-400">USDC</span>
                        </h2>
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3 h-3 text-green-500 fill-green-50" />
                          <span className="text-[8.5px] font-bold uppercase tracking-wider font-mono">Synced on Stellar Chain</span>
                        </div>
                      </div>

                      {activeThread.status === 'DEAL_AGREED' ? (
                        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-center space-y-1">
                          <span className="block text-[10px] uppercase font-extrabold text-green-800 tracking-wider">✓ Secured In Escrow</span>
                          <p className="text-[9.5px] text-green-600 leading-normal">
                            ${activeThread.currentCounterPriceUSD?.toLocaleString() ?? '0'} USDC locked in Stellar Multi-Sign Vault.
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleAcceptFinalTerms}
                          className="w-full bg-[#00A651] hover:bg-green-700 text-white font-extrabold p-3 rounded-lg flex flex-col items-center gap-0.5 transition-all cursor-pointer"
                        >
                          <span className="text-[11px] font-black">ACCEPT &amp; SECURE ESCROW</span>
                          <span className="text-[7.5px] opacity-80 uppercase font-mono tracking-widest">Stellar contract swap</span>
                        </button>
                      )}

                      <div className="h-px bg-gray-100" />

                      <form onSubmit={handleProposeCounter} className="space-y-3.5 text-left">
                        <h5 className="text-[9.5px] text-[#76777d] font-bold uppercase tracking-widest font-mono">Propose Counter_Offer</h5>
                        <div className="space-y-2.5">
                          <div>
                            <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Target Value USD</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[11px] font-mono">$</span>
                              <input
                                type="number"
                                className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-6 pr-3 text-[11px] font-mono font-bold focus:border-gray-400 focus:outline-none"
                                value={proposedPrice}
                                onChange={e => setProposedPrice(e.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Negotiation Message</label>
                            <textarea
                              rows={2}
                              className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-[11px] text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none resize-none"
                              placeholder="e.g. Can we settle on intermediate port clearance standard terms..."
                              value={proposedDesc}
                              onChange={e => setProposedDesc(e.target.value)}
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={proposingCounter}
                          className="w-full bg-[#111c30] hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider disabled:opacity-60"
                        >
                          {proposingCounter ? 'Syncing...' : 'TRANSMIT COUNTER'}
                          <RefreshCw className={`w-3 h-3 ${proposingCounter ? 'animate-spin' : ''}`} />
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* No thread selected */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white select-none space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-maritime-50 border border-maritime-100 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-7 h-7 text-[#0058be]" />
                </div>
                <div>
                  <p className="font-bold text-gray-700 text-sm">No conversation selected</p>
                  <p className="text-gray-400 text-[11px] mt-1 max-w-xs leading-relaxed">
                    Select a chat from the left, or switch to the{' '}
                    <button onClick={() => setSidebarTab('network')} className="text-[#0058be] font-bold hover:underline cursor-pointer">
                      Network tab
                    </button>{' '}
                    to message a trusted vendor.
                  </p>
                </div>
                {trustedMembers.length > 0 && (
                  <div className="mt-2 bg-ocean-50 border border-ocean-100 rounded-xl p-4 max-w-xs space-y-2">
                    <p className="text-[10px] font-black text-ocean-700 uppercase tracking-wider">
                      Trusted Network · {trustedMembers.length} vendor{trustedMembers.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex -space-x-2">
                      {trustedMembers.slice(0, 5).map(m => (
                        <div key={m.id}
                          className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-[10px] ${getRoleColor(m.jobRole)}`}
                          title={m.fullName}>
                          {getInitials(m.fullName)}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setSidebarTab('network')}
                      className="w-full text-[10px] font-bold text-ocean-600 hover:text-ocean-800 transition-colors cursor-pointer"
                    >
                      View network →
                    </button>
                  </div>
                )}
                {trustedMembers.length === 0 && (
                  <Link
                    href="/network"
                    className="inline-flex items-center gap-1.5 text-xs font-black text-[#0058be] hover:underline"
                  >
                    <Network className="w-4 h-4" /> Build your Vendor Network
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Lightbox */}
        {lightboxImage && (
          <div
            className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 cursor-zoom-out"
            onClick={() => setLightboxImage(null)}
          >
            <div className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-white/10 shadow-2xl bg-[#131b2e] flex flex-col items-center">
              <button
                type="button"
                className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white p-1.5 rounded-full cursor-pointer transition-all border border-white/15 z-10"
                onClick={() => setLightboxImage(null)}
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={lightboxImage}
                alt="Cargo Evidence Viewer"
                className="max-w-full max-h-[75vh] object-contain rounded-lg select-none"
                referrerPolicy="no-referrer"
              />
              <div className="text-center pt-3 pb-2 text-[10px] font-mono text-white/60 tracking-wider">
                CARGO EVIDENCE FILE · CLICK ANYWHERE TO DISMISS
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
