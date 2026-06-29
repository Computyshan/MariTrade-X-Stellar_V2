'use client';
/* eslint-disable */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserSession } from '@/hooks/use-user-session';
import { authFetch } from '@/hooks/use-user-session';
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
  User,
  Users,
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
  Plus,
  ExternalLink,
  Building2,
  Phone,
  MapPin,
  Receipt,
  Globe,
  Package,
  Weight,
  Calendar,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Ship,
} from 'lucide-react';
import {
  ChatThread,
  Message,
  User as UserType,
  JobRole,
  Currency,
  SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS,
  ShipmentReceipt,
  ShipmentScope,
} from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ThreadWithMeta = ChatThread & {
  otherParticipant?: {
    id: string;
    fullName: string;
    companyName?: string;
    jobRole?: string;
  } | null;
  groupParticipants?: {
    id: string;
    fullName: string;
    jobRole?: string;
    companyName?: string;
  }[] | null;
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

// Currency-aware money formatter — falls back to USD if the thread has no currency set yet
function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  const cur = (currency as Currency) || 'USD';
  const symbol = CURRENCY_SYMBOLS[cur] ?? '$';
  if (amount == null) return '—';
  return `${symbol}${amount.toLocaleString()} ${cur}`;
}

// Sanitize free-typed price input: digits + at most one decimal point, no other characters.
// This replaces the native number-spinner input so there's no scroll-to-change, no 'e'/'+'/'-'
// characters, and full control over what the field accepts.
function sanitizePriceInput(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return cleaned;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatNegotiationCenter() {
  const { currentUser, allUsers, refreshAllUsers, loading: sessionLoading } = useUserSession();

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
  const [receipt, setReceipt]               = useState<ShipmentReceipt | null>(null);

  // BUG FIX — background polling (fetchMessagesOfThread) used to overwrite the
  // receipt form fields every 4s from the server's last-saved values, wiping out
  // whatever the user was mid-typing in the receipt panel. This ref tracks whether
  // the user has touched the receipt fields since the panel opened, so the poll can
  // skip re-seeding them while there are unsaved local edits.
  const receiptDirtyRef = useRef(false);

  const [submittingMsg, setSubmittingMsg]   = useState(false);
  const [savingReceipt, setSavingReceipt]   = useState(false);
  const [finalizingReceipt, setFinalizingReceipt] = useState(false);
  const [receiptError, setReceiptError]     = useState<string | null>(null);
  const [showChecklistPopover, setShowChecklistPopover] = useState(false);
  const [showImagePicker, setShowImagePicker]   = useState(false);
  const [selectedImage, setSelectedImage]   = useState<string | null>(null);
  const [showReceiptPanel, setShowReceiptPanel] = useState(false);

  // Toast for network-gate errors
  const [toast, setToast] = useState<{ type: 'error' | 'info'; msg: string } | null>(null);

  // Group chat creation modal
  const [showGroupModal, setShowGroupModal]     = useState(false);
  const [groupName, setGroupName]               = useState('');
  const [groupMemberIds, setGroupMemberIds]     = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup]       = useState(false);

  // Profile popover
  const [showProfilePopover, setShowProfilePopover] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  // ── Auth guard — render nothing until the session resolves ──────────────
  if (sessionLoading) {
    return (
      <DashboardLayout flush={true}>
        <div className="flex h-screen w-full items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-6 h-6 border-2 border-[#0058be] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[11px] text-gray-400 font-mono">Loading session...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!currentUser) {
    return (
      <DashboardLayout flush={true}>
        <div className="flex h-screen w-full items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-sm font-bold text-gray-700">Session expired</p>
            <p className="text-[11px] text-gray-400">Please sign in again to continue.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const showToast = (type: 'error' | 'info', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch threads ──────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async (selectFirst = false, silent = false) => {
    if (!currentUser?.id) return;
    try {
      if (!silent) setLoading(true);
      const res  = await authFetch(`/api/messages/threads?userId=${currentUser.id}`);
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
      const res  = await authFetch(`/api/network/directory?requesterId=${currentUser.id}`);
      const json = await res.json();
      if (json.success) setNetworkMembers(json.data);
    } catch {}
    finally { setNetworkLoading(false); }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      fetchThreads(false);
      fetchNetwork();
      // FIX #9 — Populate allUsers so sender names and group modal work correctly
      refreshAllUsers();
    }
  }, [currentUser?.id]);

  // ── Fetch messages for selected thread ────────────────────────────────────

  const fetchMessagesOfThread = useCallback(async (id: string, silent = false) => {
    if (!id) return;
    try {
      if (!silent) setLoadingMessages(true);
      const res  = await authFetch(`/api/messages/threads/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMessages(json.data.messages || []);

        // BUG FIX — only re-seed the receipt panel from the server when the user
        // hasn't started editing it locally. Without this guard, the 4s background poll
        // would stomp on in-progress typing in the receipt panel every few seconds.
        if (!receiptDirtyRef.current) {
          setReceipt(json.data.receipt || null);
        }

        setThreads(prev => prev.map(t => t.id === id ? {
          ...t,
          // Only spread fields that exist on ChatThread itself — do NOT
          // overwrite otherParticipant / lastMessage which come from fetchThreads
          status: json.data.thread.status,
          cargoDescription: json.data.thread.cargoDescription,
          updatedAt: json.data.thread.updatedAt,
        } : t));
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

  // Reset the "dirty" guard whenever the user switches threads or closes the panel,
  // so the next thread/open starts from a clean, server-synced state.
  useEffect(() => {
    receiptDirtyRef.current = false;
  }, [selectedThreadId, showReceiptPanel]);

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
    if (!isTradePartyThread) setShowReceiptPanel(false);
  }, [selectedThreadId, isTradePartyThread]);

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [messages]);

  // ── Filtered lists ─────────────────────────────────────────────────────────

  // FIX #6 — Include group threads in search results
  const filteredThreads = threads.filter(t => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return true;
    if ((t as any).isGroup) {
      const gName = (t.groupName || '').toLowerCase();
      const members = ((t as any).groupParticipants ?? []) as { fullName: string }[];
      const memberNames = members.map(m => m.fullName.toLowerCase()).join(' ');
      return gName.includes(q) || memberNames.includes(q);
    }
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

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Please select an image smaller than 2MB.'); return; }
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await authFetch('/api/upload?bucket=chat-images', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.success) {
        setSelectedImage(json.url);
        setShowImagePicker(false);
      } else {
        alert(json.error ?? 'Image upload failed.');
      }
    } catch {
      alert('Network error — image upload failed.');
    }
  };

  const handleUnsendMessage = async (msgId: string) => {
    if (!confirm('Unsend this message? It will be retracted for all participants.')) return;
    // #12 — Optimistic update: flip isUnsent immediately in local state
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isUnsent: true, content: 'This message was unsent.' } : m));
    const res  = await authFetch(`/api/messages/threads/${selectedThreadId}?messageId=${msgId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) {
      // Roll back on failure
      fetchMessagesOfThread(selectedThreadId);
      alert(json.error || 'Failed to unsend');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId) return;
    if (!replyText.trim() && !selectedImage) return;
    try {
      setSubmittingMsg(true);
      const res  = await authFetch(`/api/messages/threads/${selectedThreadId}`, {
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

  const handleUpdateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId || !isTradePartyThread || !receipt) return;
    setReceiptError(null);

    try {
      setSavingReceipt(true);
      const res  = await authFetch(`/api/messages/threads/${selectedThreadId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action: 'UPDATE_RECEIPT',
          senderId: currentUser.id,
          cargoDescription: receipt.cargoDescription,
          shipmentScope: receipt.shipmentScope,
          estimatedArrival: receipt.estimatedArrival,
          importerContact: receipt.importerContact,
          exporterContact: receipt.exporterContact,
          originCountry: receipt.originCountry,
          originAddress: receipt.originAddress,
          originPort: receipt.originPort,
          destCountry: receipt.destCountry,
          destAddress: receipt.destAddress,
          destinationPort: receipt.destinationPort,
          currency: receipt.invoiceCurrency,
          invoiceValue: receipt.invoiceValue,
          totalValueUSD: receipt.totalValueUSD,
          hsCode: receipt.hsCode,
          isDangerousGoods: receipt.isDangerousGoods,
          packageCount: receipt.packageCount,
          packagingType: receipt.packagingType,
          grossWeight: receipt.grossWeight,
          weightUnit: receipt.weightUnit,
        }),
      });
      const json = await res.json();
      if (json.success) {
        receiptDirtyRef.current = false;
        setReceipt(json.data.receipt);
        fetchThreads(false, true);
      } else {
        setReceiptError(json.error || 'Failed to save the receipt.');
      }
    } catch { setReceiptError('Network error — please try again.'); }
    finally { setSavingReceipt(false); }
  };

  const handleFinalizeReceipt = async () => {
    if (!selectedThreadId || !isTradePartyThread) return;
    if (!confirm('Finalize this Shipment Receipt? It will become read-only and appear on the Create Shipment page for both parties.')) return;
    setFinalizingReceipt(true);
    try {
      const res  = await authFetch(`/api/messages/threads/${selectedThreadId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'FINALIZE_RECEIPT', senderId: currentUser.id }),
      });
      const json = await res.json();
      if (json.success) {
        setReceipt(json.data.receipt);
        fetchThreads();
        fetchMessagesOfThread(selectedThreadId);
      } else {
        setReceiptError(json.error || 'Failed to finalize the receipt.');
      }
    } catch { setReceiptError('Network error — please try again.'); }
    finally { setFinalizingReceipt(false); }
  };

  // Updates a single receipt field locally (marks the draft dirty so polling
  // won't stomp on it), initializing an empty draft receipt if one doesn't exist yet.
  const updateReceiptField = (field: keyof ShipmentReceipt, value: any) => {
    receiptDirtyRef.current = true;
    setReceipt(prev => {
      const base: ShipmentReceipt = prev ?? {
        id: '',
        threadId: selectedThreadId,
        status: 'DRAFT',
        invoiceCurrency: 'USD',
        weightUnit: 'KG',
        isDangerousGoods: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { ...base, [field]: value };
    });
  };

  // Only allow messaging trusted network members
  const handleStartChat = async (receiverId: string) => {
    const member = networkMembers.find(m => m.id === receiverId);
    if (!member || member.connectionStatus !== 'ACCEPTED') {
      showToast('error', 'You can only message vendors in your Trusted Network.');
      return;
    }
    try {
      const res  = await authFetch('/api/messages/threads', {
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

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { showToast('error', 'Please enter a group name.'); return; }
    if (groupMemberIds.length === 0) { showToast('error', 'Add at least one member.'); return; }
    try {
      setCreatingGroup(true);
      const res  = await authFetch('/api/messages/threads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          isGroup: true,
          groupName: groupName.trim(),
          senderId: currentUser.id,
          memberIds: groupMemberIds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowGroupModal(false);
        setGroupName('');
        setGroupMemberIds([]);
        setSidebarTab('chats');
        await fetchThreads();
        setSelectedThreadId(json.data.threadId);
      } else {
        showToast('error', json.error || 'Failed to create group.');
      }
    } catch { showToast('error', 'Network error — please try again.'); }
    finally { setCreatingGroup(false); }
  };

  const getThreadDisplayName = (t: ThreadWithMeta) => {
    if (t.isGroup) return t.groupName || 'Group Chat';
    const partner = (t as any).otherParticipant;
    return partner?.fullName || 'Contact';
  };

  const getThreadSubtitle = (t: ThreadWithMeta) => {
    if (t.isGroup) {
      const members = (t as any).groupParticipants ?? [];
      return `${members.length} member${members.length !== 1 ? 's' : ''}`;
    }
    const partner = (t as any).otherParticipant;
    return partner?.companyName || partner?.jobRole?.replace(/_/g, ' ') || '';
  };

  const getThreadInitials = (t: ThreadWithMeta) => {
    if (t.isGroup) return <Users className="w-3.5 h-3.5" />;
    const partner = (t as any).otherParticipant;
    return partner ? getInitials(partner.fullName) : '??';
  };

  const formatMessageTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // FIX #7 — For group threads, resolve sender name from groupParticipants first, then allUsers
  const getLastMessagePreview = (thread: ThreadWithMeta) => {
    const m = thread.lastMessage;
    if (!m) return 'No messages yet';
    if (m.isUnsent) return 'Message unsent';
    if (m.imageUrl && !m.content) return '📷 Attachment';
    if (m.senderId === currentUser.id) return `You: ${m.content || '📷 Attachment'}`;
    // Try groupParticipants cache first (always populated), then fall back to allUsers
    const groupParticipants = (thread as any).groupParticipants as { id: string; fullName: string }[] | null;
    const senderFromGroup = groupParticipants?.find(p => p.id === m.senderId);
    const senderFromAllUsers = allUsers.find(u => u.id === m.senderId);
    const senderName = senderFromGroup?.fullName?.split(' ')[0] ||
      senderFromAllUsers?.fullName?.split(' ')[0] ||
      'Contact';
    return `${senderName}: ${m.content || '📷 Attachment'}`;
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
            {/* Receipt checklist — Trade Party threads only */}
            {isTradePartyThread && activeThread && (() => {
              const isFinalized   = activeThread.status === 'RECEIPT_FINALIZED';
              const isDraft       = activeThread.status === 'RECEIPT_DRAFT';
              const hasCargo      = !!(receipt?.cargoDescription?.trim());
              const hasRoute      = !!(receipt?.originCountry?.trim() && receipt?.destinationPort?.trim());
              const hasValue      = receipt?.invoiceValue != null;

              // STRICT SEQUENTIAL GATING — each step requires the previous step too.
              const step1Done = true;
              const step2Done = step1Done && hasCargo;
              const step3Done = step2Done && hasRoute && hasValue;
              const step4Done = step3Done && isFinalized;

              const stepsTotal      = 4;
              const stepsDone       = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;
              const pct             = Math.round((stepsDone / stepsTotal) * 100);
              const pendingCount    = isFinalized ? 0 : stepsTotal - stepsDone;

              const step = (done: boolean, label: string, sub: string) => (
                <div className="flex gap-2.5 items-start">
                  <div className={`shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center text-[9px] font-extrabold transition-all
                    ${done ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-300 text-transparent'}`}>
                    {done ? '✓' : ''}
                  </div>
                  <div>
                    <p className={`font-bold text-[11px] ${done ? 'text-gray-900' : 'text-gray-400'}`}>{label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>
                  </div>
                </div>
              );

              return (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowChecklistPopover(p => !p)}
                    className="relative bg-white border border-gray-200 hover:border-gray-300 p-1.5 rounded-lg flex items-center justify-center text-gray-600 cursor-pointer active:scale-95 transition-all"
                    title="View Receipt Checklist"
                  >
                    <ClipboardList className="w-4 h-4 text-gray-500" />
                    {pendingCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#ba1a1a] text-[9px] text-white flex items-center justify-center rounded-full font-bold">
                        {pendingCount}
                      </span>
                    )}
                  </button>

                  {showChecklistPopover && (
                    <div className="absolute right-0 mt-2.5 w-80 bg-white shadow-2xl rounded-xl border border-gray-200 z-50 overflow-hidden">
                      <div className="p-3 bg-[#111c30] flex items-center justify-between text-white">
                        <h5 className="font-extrabold flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono">
                          <ClipboardList className="w-3.5 h-3.5" /> Receipt Checklist
                        </h5>
                        <button onClick={() => setShowChecklistPopover(false)} className="text-white hover:text-red-400 cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Cargo summary if available */}
                      {(hasValue || hasCargo) && (
                        <div className="px-4 pt-3 pb-2 bg-slate-50 border-b border-gray-100">
                          {hasCargo && (
                            <p className="text-[10px] text-gray-600 font-semibold truncate">📦 {receipt?.cargoDescription}</p>
                          )}
                          {hasValue && (
                            <p className="text-[11px] font-black text-[#0058be] font-mono mt-0.5">
                              {formatMoney(receipt?.invoiceValue, receipt?.invoiceCurrency)}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="p-4 space-y-3">
                        {step(step1Done,
                          'Receipt Started',
                          'Conversation opened between Trade Parties')}
                        {step(step2Done,
                          'Cargo Described',
                          step2Done
                            ? `${receipt?.cargoDescription}`
                            : 'Add a cargo description to continue')}
                        {step(step3Done,
                          'Route & Value Set',
                          !step2Done
                            ? 'Complete "Cargo Described" first'
                            : step3Done
                              ? `${receipt?.originCountry} → ${receipt?.destinationPort} · ${formatMoney(receipt?.invoiceValue, receipt?.invoiceCurrency)}`
                              : 'Fill in route and invoice value in the Shipment Receipt panel')}
                        {step(step4Done,
                          'Receipt Finalized',
                          step4Done
                            ? 'Ready to prefill a new shipment record'
                            : 'Finalize the receipt to unlock it on Create Shipment')}

                        <div className="pt-2 border-t border-gray-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase font-mono">Progress</span>
                            <span className="text-[9px] font-black text-[#0058be] font-mono">{pct}%</span>
                          </div>
                          <div className="bg-gray-100 h-1.5 w-full rounded-full overflow-hidden">
                            <div
                              className="bg-[#0058be] h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {isFinalized && (
                            <p className="text-center text-[9px] font-extrabold mt-2 text-green-600 uppercase font-mono tracking-wider">
                              ✓ Receipt Finalized — Ready for Shipment
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* My Profile button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowProfilePopover(p => !p); setShowChecklistPopover(false); }}
                className="p-1.5 border border-gray-200 hover:border-[#0058be] rounded-lg text-gray-500 hover:text-[#0058be] bg-white transition-all cursor-pointer active:scale-95"
                title="My Profile"
              >
                <User className="w-4 h-4" />
              </button>

              {showProfilePopover && currentUser && (
                <div className="absolute right-0 mt-2.5 w-72 bg-white shadow-2xl rounded-xl border border-gray-200 z-50 overflow-hidden">
                  <div className="p-4 bg-[#111c30] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-sm text-white shrink-0">
                      {getInitials(currentUser.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-white text-xs truncate">{currentUser.fullName}</p>
                      <p className="text-[10px] text-[#818ea1] truncate">{currentUser.email}</p>
                    </div>
                    <button onClick={() => setShowProfilePopover(false)} className="ml-auto text-white/40 hover:text-white cursor-pointer shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-3 space-y-2">
                    {/* Role badge */}
                    <div className="flex items-center gap-2 px-1">
                      <span className={`text-[9px] px-2 py-0.5 font-extrabold rounded border uppercase tracking-wide ${getRoleColor(currentUser.jobRole)}`}>
                        {JOB_ROLE_LABELS[currentUser.jobRole] ?? currentUser.jobRole.replace(/_/g, ' ')}
                      </span>
                      {currentUser.kycStatus === 'VERIFIED' && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                          <ShieldCheck className="w-2.5 h-2.5" /> KYC Verified
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 px-1">
                      {currentUser.companyName && (
                        <div className="flex items-center gap-2 text-[10px] text-gray-600">
                          <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate">{currentUser.companyName}</span>
                        </div>
                      )}
                      {currentUser.contactNumber && (
                        <div className="flex items-center gap-2 text-[10px] text-gray-600">
                          <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{currentUser.contactNumber}</span>
                        </div>
                      )}
                      {currentUser.fullAddress && (
                        <div className="flex items-center gap-2 text-[10px] text-gray-600">
                          <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate">{currentUser.fullAddress}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-2">
                      <Link
                        href="/profile"
                        onClick={() => setShowProfilePopover(false)}
                        className="flex items-center justify-center gap-1.5 w-full bg-[#0058be] hover:bg-[#004395] text-white font-bold py-2 rounded-lg text-[11px] transition-all"
                      >
                        <ExternalLink className="w-3 h-3" /> View Full Profile
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                  <div className="flex items-center justify-between px-1 mb-1">
                    <p className="text-[9px] font-extrabold text-[#76777d] uppercase tracking-wider font-mono">
                      Secure Channels
                    </p>
                    <button
                      type="button"
                      onClick={() => { setShowGroupModal(true); setGroupName(''); setGroupMemberIds([]); }}
                      className="flex items-center gap-1 text-[9px] font-bold text-[#0058be] hover:text-[#004395] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Group
                    </button>
                  </div>
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
                      const isTradeOnly     = isTradePartyOnlyConversation(partner?.id);
                      const partnerTrusted  = !t.isGroup && networkMembers.some(m => m.id === partner?.id && m.connectionStatus === 'ACCEPTED');
                      const displayName     = getThreadDisplayName(t as ThreadWithMeta);
                      const subtitle        = getThreadSubtitle(t as ThreadWithMeta);
                      const initials        = getThreadInitials(t as ThreadWithMeta);

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
                                  <h4 className="font-bold text-white truncate text-xs">{displayName}</h4>
                                  <span className="text-[9px] text-[#818ea1]">{getThreadTimestamp(t as ThreadWithMeta)}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{subtitle}</p>
                                {t.isGroup && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[8px] font-bold text-blue-400">
                                    <Users className="w-2.5 h-2.5" /> Group Chat
                                  </span>
                                )}
                                {!t.isGroup && partnerTrusted && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[8px] font-bold text-ocean-400">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Trusted Network
                                  </span>
                                )}
                                {isTradeOnly && t.status === 'RECEIPT_DRAFT' && receipt?.invoiceValue != null && t.id === selectedThreadId && (
                                  <div className="mt-2 bg-[#0d1524] rounded-lg p-2 border border-[#1f2d47]">
                                    <div className="flex justify-between items-center text-[8px] font-extrabold text-[#818ea1] uppercase">
                                      <span>Receipt Draft</span>
                                      <span className="text-[#a4ccff]">
                                        {formatMoney(receipt?.invoiceValue, receipt?.invoiceCurrency)}
                                      </span>
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
                                <h4 className="font-bold text-gray-900 truncate text-xs">{displayName}</h4>
                                <span className="text-[9px] text-gray-400 shrink-0">{getThreadTimestamp(t as ThreadWithMeta)}</span>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5 truncate">{subtitle}</p>
                              <div className="mt-1.5 flex items-center gap-2">
                                {t.isGroup && (
                                  <span className="inline-flex items-center gap-1 text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">
                                    <Users className="w-2 h-2" /> Group
                                  </span>
                                )}
                                {!t.isGroup && partnerTrusted && (
                                  <span className="inline-flex items-center gap-1 text-[8px] font-bold text-ocean-600 bg-ocean-50 border border-ocean-100 px-1.5 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-2 h-2" /> Trusted
                                  </span>
                                )}
                                {isTradeOnly && (
                                  <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded uppercase tracking-wide
                                    ${t.status === 'RECEIPT_FINALIZED'   ? 'bg-green-50 text-green-700'
                                    : t.status === 'RECEIPT_DRAFT' ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'}`}>
                                    {t.status === 'RECEIPT_FINALIZED' ? 'Receipt Finalized' : t.status === 'RECEIPT_DRAFT' ? 'Receipt Draft' : 'Open'}
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

            {/* Shipment Receipt button — Trade Party threads only */}
            {isTradePartyThread && activeThread && (
              <div className="p-3 bg-white border-t border-gray-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowReceiptPanel(p => !p)}
                  className="w-full bg-[#0058be] hover:bg-[#004395] text-white font-black py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-[10px] cursor-pointer active:scale-[0.98]"
                >
                  <Receipt className="w-4 h-4" /> SHIPMENT RECEIPT
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
                        {activeThread?.isGroup
                          ? <Users className="w-4 h-4" />
                          : getInitials((activeThread as any)?.otherParticipant?.fullName || '??')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-xs text-gray-900 truncate">
                            {activeThread?.isGroup
                              ? (activeThread.groupName || 'Group Chat')
                              : ((activeThread as any)?.otherParticipant?.fullName || 'Representative')}
                          </h3>
                          {activeThread?.isGroup ? (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 text-[8px] font-extrabold rounded-full flex items-center gap-0.5 uppercase shrink-0">
                              <Users className="w-2.5 h-2.5" /> Group
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[8px] font-extrabold rounded-full flex items-center gap-0.5 uppercase shrink-0">
                              <ShieldCheck className="w-2.5 h-2.5 text-green-600" /> KYC
                            </span>
                          )}
                          {/* Trusted network badge — DMs only */}
                          {!activeThread?.isGroup && activePartnerIsTrusted && (
                            <span className="px-1.5 py-0.5 bg-ocean-50 text-ocean-600 border border-ocean-100 text-[8px] font-extrabold rounded-full flex items-center gap-0.5 uppercase shrink-0">
                              <CheckCircle2 className="w-2 h-2" /> Trusted Network
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-medium truncate">
                          {activeThread?.isGroup
                            ? (() => {
                                const members = (activeThread as any)?.groupParticipants ?? [];
                                return members.map((m: any) => m.fullName.split(' ')[0]).join(', ') || 'Group members';
                              })()
                            : ((activeThread as any)?.otherParticipant?.companyName || 'Stellar Authorized counterparty')}
                        </p>
                      </div>
                    </div>
                    <p className="text-[9px] font-mono font-bold text-gray-400 shrink-0">ID: {activeThread?.id}</p>
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
                        // FIX #15 — resolve sender from groupParticipants first, then allUsers
                        const groupParticipants = (activeThread as any)?.groupParticipants as { id: string; fullName: string }[] | null;
                        const sender  = groupParticipants?.find(p => p.id === msg.senderId)
                          ?? allUsers.find(u => u.id === msg.senderId);
                        const sName   = isMe ? 'You' : (sender?.fullName?.split(' ')[0] || 'Contact');
                        const sInits  = getInitials(sender?.fullName || 'Contact');
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
                                  {isMe && !msg.isUnsent && <span className="text-[10px] text-sky-200 font-bold opacity-40">✓✓</span>}
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
                        <button key={label} type="button" onClick={() => setReplyText(prev => prev ? prev : text)}
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
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (replyText.trim() || selectedImage) {
                                handleSendMessage(e as any);
                              }
                            }
                          }}
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

                {/* Shipment Receipt panel — Trade Party only */}
                {showReceiptPanel && isTradePartyThread && (
                  <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full shrink-0 overflow-y-auto">
                    <div className="p-4 border-b border-gray-150 bg-white flex items-center justify-between shrink-0 sticky top-0 z-10">
                      <h4 className="font-extrabold text-gray-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono">
                        <Receipt className="w-4 h-4 text-[#0058be]" /> Shipment Receipt
                      </h4>
                      <button onClick={() => setShowReceiptPanel(false)} className="text-gray-400 hover:text-gray-900 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {(() => {
                      const isFinalized = receipt?.status === 'FINALIZED';
                      const r = receipt;
                      const field = (key: keyof ShipmentReceipt, value: any) => updateReceiptField(key, value);
                      const inputCls = `w-full border rounded-lg px-2.5 py-1.5 text-[11px] outline-none transition-colors
                        ${isFinalized ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-white border-gray-200 focus:border-[#0058be]'}`;

                      return (
                        <form onSubmit={handleUpdateReceipt} className="p-4 space-y-4">
                          <p className="text-[10px] text-gray-400 leading-relaxed">
                            A shared planner both of you can fill in while you chat. Once finalized, it
                            shows up on the <strong>Create Shipment</strong> page and can prefill a new record.
                          </p>

                          {isFinalized && (
                            <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-center space-y-1">
                              <span className="block text-[10px] uppercase font-extrabold text-green-800 tracking-wider flex items-center justify-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Receipt Finalized
                              </span>
                              <p className="text-[9.5px] text-green-600 leading-normal">
                                Read-only — visible on the Create Shipment page for both parties.
                              </p>
                            </div>
                          )}

                          {receiptError && (
                            <p className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                              {receiptError}
                            </p>
                          )}

                          {/* Cargo */}
                          <div className="space-y-2.5">
                            <h5 className="text-[9.5px] text-[#76777d] font-bold uppercase tracking-widest font-mono flex items-center gap-1">
                              <Package className="w-3 h-3" /> Cargo
                            </h5>
                            <div>
                              <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Cargo Description</label>
                              <textarea rows={2} disabled={isFinalized} className={inputCls + ' resize-none'}
                                placeholder="e.g. 40ft container of high-precision automobile spares"
                                value={r?.cargoDescription || ''} onChange={e => field('cargoDescription', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Scope</label>
                                <select disabled={isFinalized} className={inputCls} value={r?.shipmentScope || ''}
                                  onChange={e => {
                                    const scope = e.target.value as ShipmentScope;
                                    field('shipmentScope', scope);
                                    // Nationwide shipments are always within the Philippines —
                                    // auto-fill both origin and destination country.
                                    if (scope === 'NATIONWIDE') {
                                      updateReceiptField('originCountry', 'Philippines');
                                      updateReceiptField('destCountry', 'Philippines');
                                    }
                                  }}>
                                  <option value="">—</option>
                                  <option value="OVERSEAS">Overseas</option>
                                  <option value="NATIONWIDE">Nationwide</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">ETA</label>
                                <input type="date" disabled={isFinalized} className={inputCls}
                                  value={r?.estimatedArrival ? r.estimatedArrival.substring(0, 10) : ''}
                                  onChange={e => field('estimatedArrival', e.target.value)} />
                              </div>
                            </div>
                          </div>

                          {/* Parties */}
                          <div className="space-y-2.5">
                            <h5 className="text-[9.5px] text-[#76777d] font-bold uppercase tracking-widest font-mono flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> Parties
                            </h5>
                            <div>
                              <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Importer Contact</label>
                              <input type="text" disabled={isFinalized} className={inputCls} placeholder="e.g. Binondo Metals Importing Inc."
                                value={r?.importerContact || ''} onChange={e => field('importerContact', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Exporter Contact</label>
                              <input type="text" disabled={isFinalized} className={inputCls} placeholder="e.g. Osaka Trading Ltd."
                                value={r?.exporterContact || ''} onChange={e => field('exporterContact', e.target.value)} />
                            </div>
                          </div>

                          {/* Route */}
                          <div className="space-y-2.5">
                            <h5 className="text-[9.5px] text-[#76777d] font-bold uppercase tracking-widest font-mono flex items-center gap-1">
                              <Globe className="w-3 h-3" /> Route
                            </h5>
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-maritime-400 shrink-0" />
                              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Origin</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" disabled={isFinalized} className={inputCls} placeholder="Country"
                                value={r?.originCountry || ''} onChange={e => field('originCountry', e.target.value)} />
                              <input type="text" disabled={isFinalized} className={inputCls} placeholder="Port"
                                value={r?.originPort || ''} onChange={e => field('originPort', e.target.value)} />
                            </div>
                            <input type="text" disabled={isFinalized} className={inputCls} placeholder="Origin address"
                              value={r?.originAddress || ''} onChange={e => field('originAddress', e.target.value)} />

                            <div className="flex items-center gap-1.5 mb-1 mt-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-ocean-400 shrink-0" />
                              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Destination</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" disabled={isFinalized} className={inputCls} placeholder="Country"
                                value={r?.destCountry || ''} onChange={e => field('destCountry', e.target.value)} />
                              <input type="text" disabled={isFinalized} className={inputCls} placeholder="Port"
                                value={r?.destinationPort || ''} onChange={e => field('destinationPort', e.target.value)} />
                            </div>
                            <input type="text" disabled={isFinalized} className={inputCls} placeholder="Destination address"
                              value={r?.destAddress || ''} onChange={e => field('destAddress', e.target.value)} />
                          </div>

                          {/* Commercial value */}
                          <div className="space-y-2.5">
                            <h5 className="text-[9.5px] text-[#76777d] font-bold uppercase tracking-widest font-mono flex items-center gap-1">
                              <Coins className="w-3 h-3" /> Commercial Value
                            </h5>
                            <div>
                              <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Invoice Value</label>
                              <div className="flex gap-1.5">
                                <select disabled={isFinalized} className={inputCls + ' shrink-0 w-20'} value={r?.invoiceCurrency || 'USD'}
                                  onChange={e => field('invoiceCurrency', e.target.value as Currency)}>
                                  {SUPPORTED_CURRENCIES.map(cur => <option key={cur} value={cur}>{cur}</option>)}
                                </select>
                                <input type="text" inputMode="decimal" disabled={isFinalized} className={inputCls} placeholder="0.00"
                                  value={r?.invoiceValue ?? ''} onChange={e => field('invoiceValue', sanitizePriceInput(e.target.value))} />
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">HS Code</label>
                              <input type="text" disabled={isFinalized} className={inputCls} placeholder="e.g. 8517.12"
                                value={r?.hsCode || ''} onChange={e => field('hsCode', e.target.value)} />
                            </div>
                          </div>

                          {/* Physical specifications */}
                          <div className="space-y-2.5">
                            <h5 className="text-[9.5px] text-[#76777d] font-bold uppercase tracking-widest font-mono flex items-center gap-1">
                              <Weight className="w-3 h-3" /> Physical Specs
                            </h5>
                            <button type="button" disabled={isFinalized}
                              onClick={() => field('isDangerousGoods', !r?.isDangerousGoods)}
                              className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all
                                ${isFinalized ? 'cursor-not-allowed bg-slate-50 border-slate-200' : 'cursor-pointer'}
                                ${r?.isDangerousGoods ? 'border-coral-400 bg-coral-50' : 'border-gray-200'}`}>
                              <span className="text-[10px] font-bold text-gray-700 flex items-center gap-1.5">
                                <AlertTriangle className={`w-3.5 h-3.5 ${r?.isDangerousGoods ? 'text-coral-400' : 'text-gray-300'}`} /> Dangerous Goods
                              </span>
                              {r?.isDangerousGoods ? <ToggleRight className="w-4 h-4 text-coral-400" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Packages</label>
                                <input type="text" inputMode="numeric" disabled={isFinalized} className={inputCls} placeholder="0"
                                  value={r?.packageCount ?? ''} onChange={e => field('packageCount', e.target.value.replace(/\D/g, ''))} />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Type</label>
                                <input type="text" disabled={isFinalized} className={inputCls} placeholder="Cartons"
                                  value={r?.packagingType || ''} onChange={e => field('packagingType', e.target.value)} />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Gross Weight</label>
                                <input type="text" inputMode="decimal" disabled={isFinalized} className={inputCls} placeholder="0"
                                  value={r?.grossWeight ?? ''} onChange={e => field('grossWeight', sanitizePriceInput(e.target.value))} />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Unit</label>
                                <select disabled={isFinalized} className={inputCls} value={r?.weightUnit || 'KG'}
                                  onChange={e => field('weightUnit', e.target.value as 'KG' | 'LBS')}>
                                  <option value="KG">KG</option>
                                  <option value="LBS">LBS</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {!isFinalized && (
                            <div className="space-y-2 pt-1">
                              <button
                                type="submit"
                                disabled={savingReceipt}
                                className="w-full bg-[#111c30] hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider disabled:opacity-60"
                              >
                                {savingReceipt ? 'Saving...' : 'SAVE RECEIPT'}
                                <RefreshCw className={`w-3 h-3 ${savingReceipt ? 'animate-spin' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={handleFinalizeReceipt}
                                disabled={finalizingReceipt || !receipt}
                                className="w-full bg-[#00A651] hover:bg-green-700 text-white font-extrabold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-black">{finalizingReceipt ? 'FINALIZING...' : 'FINALIZE RECEIPT'}</span>
                              </button>
                            </div>
                          )}
                        </form>
                      );
                    })()}
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

        {/* ── GROUP CREATION MODAL ──────────────────────────────────────── */}
        {showGroupModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowGroupModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-[#111c30] px-5 py-4 flex items-center justify-between">
                <h3 className="font-extrabold text-white flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4" /> Create Group Chat
                </h3>
                <button onClick={() => setShowGroupModal(false)} className="text-white/60 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Group name */}
                <div>
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block mb-1.5">Group Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Manila Shipment Team"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#0058be] transition-all"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    maxLength={60}
                    autoFocus
                  />
                </div>

                {/* Member picker */}
                <div>
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Add Members
                    {groupMemberIds.length > 0 && (
                      <span className="ml-1.5 text-[#0058be]">({groupMemberIds.length} selected)</span>
                    )}
                  </label>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    {networkMembers.length === 0 && allUsers.filter(u => u.id !== currentUser?.id && (u.kycStatus === 'VERIFIED' || u.kycStatus === 'SUBMITTED')).length === 0 ? (
                      <p className="text-[11px] text-gray-400 text-center py-6">No verified members found.</p>
                    ) : (
                      allUsers
                        .filter(u => u.id !== currentUser?.id && (u.kycStatus === 'VERIFIED' || u.kycStatus === 'SUBMITTED'))
                        .map(member => {
                          const checked = groupMemberIds.includes(member.id);
                          const isTrusted = networkMembers.some(m => m.id === member.id && m.connectionStatus === 'ACCEPTED');
                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => setGroupMemberIds(prev =>
                                prev.includes(member.id)
                                  ? prev.filter(id => id !== member.id)
                                  : [...prev, member.id]
                              )}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer
                                ${ checked ? 'bg-blue-50' : 'hover:bg-gray-50' }
                                border-b border-gray-100 last:border-b-0`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
                                ${ checked ? 'bg-[#0058be] border-[#0058be]' : 'border-gray-300' }`}>
                                {checked && <span className="text-white text-[9px] font-black">✓</span>}
                              </div>
                              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700 shrink-0">
                                {getInitials(member.fullName)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{member.fullName}</p>
                                <p className="text-[10px] text-gray-400 truncate">{member.companyName || member.jobRole.replace(/_/g, ' ')}</p>
                              </div>
                              {isTrusted && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-ocean-400 shrink-0" />
                              )}
                            </button>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Selected chips — FIX #5: resolve from allUsers when member not in networkMembers */}
                {groupMemberIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {groupMemberIds.map(id => {
                      const m = networkMembers.find(nm => nm.id === id)
                        ?? allUsers.find(u => u.id === id);
                      if (!m) return null;
                      return (
                        <span key={id} className="flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full">
                          {m.fullName.split(' ')[0]}
                          <button type="button" onClick={() => setGroupMemberIds(prev => prev.filter(i => i !== id))} className="text-blue-400 hover:text-blue-700 cursor-pointer">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowGroupModal(false)}
                    className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={creatingGroup || !groupName.trim() || groupMemberIds.length === 0}
                    className="flex-1 bg-[#0058be] hover:bg-[#004395] disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {creatingGroup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                    {creatingGroup ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
