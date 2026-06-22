'use client';
/* eslint-disable */

import React, { useState, useEffect, useRef } from 'react';
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
  Handshake
} from 'lucide-react';
import { ChatThread, Message } from '@/types';

type ThreadWithMeta = ChatThread & {
  otherParticipant?: {
    id: string;
    fullName: string;
    companyName?: string;
    jobRole?: string;
  };
  lastMessage?: Message;
};

export default function ChatNegotiationCenter() {
  const { currentUser, allUsers } = useUserSession();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [sidebarTab, setSidebarTab] = useState<'negotiations' | 'directory'>('negotiations');
  const [searchQuery, setSearchQuery] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const [replyText, setReplyText] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [proposedDesc, setProposedDesc] = useState('');
  
  const [submittingMsg, setSubmittingMsg] = useState(false);
  const [proposingCounter, setProposingCounter] = useState(false);
  const [showChecklistPopover, setShowChecklistPopover] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showNegotiationPanel, setShowNegotiationPanel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchThreads = async (selectFirst = false, silent = false) => {
    if (!currentUser?.id) return;
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/messages/threads?userId=${currentUser.id}`);
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
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchThreads(false);
    }
  }, [currentUser]);

  const fetchMessagesOfThread = async (id: string, silent = false) => {
    if (!id) return;
    try {
      if (!silent) setLoadingMessages(true);
      const res = await fetch(`/api/messages/threads/${id}`);
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
  };

  useEffect(() => {
    if (selectedThreadId) {
      fetchMessagesOfThread(selectedThreadId);
    } else {
      setMessages([]);
    }
  }, [selectedThreadId]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const interval = setInterval(() => fetchThreads(false, true), 8000);
    return () => clearInterval(interval);
  }, [currentUser?.id, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    const interval = setInterval(() => fetchMessagesOfThread(selectedThreadId, true), 4000);
    return () => clearInterval(interval);
  }, [selectedThreadId]);

  const isTradePartyOnlyConversation = (partnerId?: string | null) => {
    if (currentUser?.userType === 'LOGISTICS_CHAIN' || !partnerId) return false;
    const partner = allUsers.find(u => u.id === partnerId);
    return partner?.userType === 'TRADE_PARTY';
  };

  const activeThread = threads.find(t => t.id === selectedThreadId);
  const isTradePartyThread = isTradePartyOnlyConversation((activeThread as any)?.otherParticipant?.id);

  useEffect(() => {
    if (!isTradePartyThread) {
      setShowNegotiationPanel(false);
    }
  }, [selectedThreadId, isTradePartyThread]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Please select an image smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImage(event.target.result as string);
          setShowImagePicker(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUnsendMessage = async (msgId: string) => {
    if (!confirm('Are you sure you want to unsend this message? This will retract it for all participants.')) return;
    try {
      const res = await fetch(`/api/messages/threads/${selectedThreadId}?messageId=${msgId}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        fetchMessagesOfThread(selectedThreadId);
      } else {
        alert(json.error || 'Failed to unsend message');
      }
    } catch (err) {
      console.error('Unsend error:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId) return;
    if (!replyText.trim() && !selectedImage) return;

    try {
      setSubmittingMsg(true);
      const res = await fetch(`/api/messages/threads/${selectedThreadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          content: replyText,
          imageUrl: selectedImage || undefined
        })
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
    } catch {
      console.warn('Post message failed');
    } finally {
      setSubmittingMsg(false);
    }
  };

  const handleProposeCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId) return;
    if (!isTradePartyThread) {
      alert('Counter offers are only available between Trade Party users.');
      return;
    }

    try {
      setProposingCounter(true);
      const res = await fetch(`/api/messages/threads/${selectedThreadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'COUNTER_TERMS',
          senderId: currentUser.id,
          counterTerms: `Value: $${proposedPrice} - Description: ${proposedDesc}`,
          currentCounterPriceUSD: Number(proposedPrice),
          cargoDescription: proposedDesc
        })
      });
      const json = await res.json();
      if (json.success) {
        fetchThreads();
        fetchMessagesOfThread(selectedThreadId);
      }
    } catch {
      console.warn('Counter offer failed');
    } finally {
      setProposingCounter(false);
    }
  };

  const handleAcceptFinalTerms = async () => {
    if (!selectedThreadId) return;
    if (!isTradePartyThread) {
      alert('Escrow agreements are only available between Trade Party users.');
      return;
    }
    if (!confirm('Are you ready to lock these terms and automatically generate the Stellar multi-sign Escrow contract?')) return;

    try {
      const res = await fetch(`/api/messages/threads/${selectedThreadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CONVERT_TO_SHIPMENT',
          senderId: currentUser.id
        })
      });
      const json = await res.json();
      if (json.success) {
        alert('Offer details accepted! Cargo Shipment contract and public reference successfully generated.');
        fetchThreads();
        fetchMessagesOfThread(selectedThreadId);
      }
    } catch {
      console.warn('Accept failed');
    }
  };

  const handleStartNegotiation = async (receiverId: string) => {
    try {
      const res = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          receiverId,
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSidebarTab('negotiations');
        setSearchQuery('');
        await fetchThreads();
        setSelectedThreadId(json.data.threadId);
      }
    } catch (err) {
      console.error('Error starting negotiation', err);
    }
  };

  const getUserById = (userId: string) => allUsers.find(u => u.id === userId);

  const formatMessageTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getLastMessagePreview = (thread: ThreadWithMeta) => {
    const lastMessage = thread.lastMessage;
    if (!lastMessage) return 'No messages yet';
    if (lastMessage.isUnsent) return 'Message unsent';
    if (lastMessage.imageUrl && !lastMessage.content) return '📷 Attachment';
    const prefix = lastMessage.senderId === currentUser.id ? 'You: ' : '';
    return `${prefix}${lastMessage.content || '📷 Attachment'}`;
  };

  const getThreadTimestamp = (thread: ThreadWithMeta) => {
    const iso = thread.lastMessage?.createdAt || thread.updatedAt || thread.createdAt;
    return iso ? formatMessageTime(iso) : '';
  };

  const filteredUsers = allUsers.filter(u => {
    if (u.id === currentUser.id) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return u.fullName.toLowerCase().includes(q) || u.jobRole.toLowerCase().includes(q) || (u.companyName || '').toLowerCase().includes(q);
  });

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'IMPORTER': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'EXPORTER': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CUSTOMS_BROKER': return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'FREIGHT_FORWARDER': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-150 text-gray-700 border-gray-200';
    }
  };

  const filteredThreads = threads.filter(t => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return true;
    const partner = (t as any).otherParticipant;
    if (!partner) return false;
    return partner.fullName.toLowerCase().includes(q) || (partner.companyName || '').toLowerCase().includes(q) || (t.cargoDescription || '').toLowerCase().includes(q);
  });

  return (
    <DashboardLayout flush={true}>
      <div className="flex flex-col h-screen w-full bg-white text-slate-800 overflow-hidden">
        {/* Top Header Row exactly like screen.png */}
        <header className="h-14 bg-white border-b border-gray-200 px-4 md:px-5 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center">
            <MessageSquare className="w-5 h-5 text-[#0058be]" style={{ strokeWidth: 2.2 }} />
            <span className="font-extrabold text-[13px] tracking-tight ml-2 text-gray-900">
              Messages &amp; Chat
            </span>
            <div className="h-4 w-px bg-gray-200 mx-3"></div>
            <span className="text-[11px] text-gray-400 font-bold font-sans">
              Live messaging
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Popover controller — Trade Party negotiations only */}
            {isTradePartyThread && (
            <div className="relative">
              <button
                type="button"
                id="checklist-btn"
                onClick={() => setShowChecklistPopover(prev => !prev)}
                className="relative bg-white border border-gray-200 hover:border-gray-300 p-1.5 rounded-lg flex items-center justify-center text-gray-600 cursor-pointer shadow-3xs active:scale-95 transition-all text-xs"
                title="View Deal Checklist"
              >
                <ClipboardList className="w-4 h-4 text-gray-500" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#ba1a1a] text-[9px] text-white flex items-center justify-center rounded-full font-bold">
                  {activeThread?.status === 'DEAL_AGREED' ? '0' : '2'}
                </span>
              </button>

              {/* Redesigned Checklist popover */}
              {showChecklistPopover && (
                <div id="checklist-popover" className="absolute right-0 mt-2.5 w-80 bg-white shadow-2xl rounded-xl border border-gray-200 z-50 overflow-hidden text-left animate-fade-in">
                  <div className="p-3 bg-[#111c30] flex items-center justify-between text-white">
                    <h5 className="font-extrabold flex items-center gap-1.5 text-[10px] text-white uppercase tracking-wider font-mono">
                      <ClipboardList className="w-3.5 h-3.5 text-white" /> Deal Checklist
                    </h5>
                    <button type="button" className="text-white hover:text-red-400 cursor-pointer" onClick={() => setShowChecklistPopover(false)}>
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <div className="p-4 space-y-3 text-xs font-sans">
                    <div className="flex gap-2">
                      <div className="shrink-0 w-4 h-4 rounded border-2 border-green-500 bg-green-50 flex items-center justify-center text-[9px] text-green-600 font-extrabold">✓</div>
                      <div>
                        <p className="font-bold text-gray-950 text-[11px]">Bill of Lading Draft</p>
                        <p className="text-[10px] text-gray-500">Confirmed by Exporter</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <div className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center text-[9px] font-extrabold ${activeThread?.status === 'DEAL_AGREED' ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-300 text-transparent'}`}>
                        {activeThread?.status === 'DEAL_AGREED' ? '✓' : ''}
                      </div>
                      <div>
                        <p className="font-bold text-gray-950 text-[11px]">Escrow Account Allocation</p>
                        <p className="text-[10px] text-gray-500">{activeThread?.status === 'DEAL_AGREED' ? 'Secured and Synced' : 'Pending Importer Approval'}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <div className="bg-gray-100 h-1.5 w-full rounded-full overflow-hidden">
                        <div className="bg-[#0058be] h-full" style={{ width: activeThread?.status === 'DEAL_AGREED' ? '100%' : '50%' }} />
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

            <button type="button" className="p-1.5 border border-gray-200 hover:border-gray-300 rounded-lg text-gray-500 bg-white">
              <Bell className="w-4 h-4" />
            </button>

            <button type="button" className="p-1.5 border border-gray-200 hover:border-gray-300 rounded-lg text-gray-500 bg-white">
              <User className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Multi Column Workspace */}
        <div className="flex-1 flex overflow-hidden w-full">
          
          {/* Active channels sidebar */}
          <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col h-full bg-slate-50/20 select-none overflow-hidden shrink-0">
            
            {/* Header tab switcher */}
            <div className="p-3 pb-2 select-none border-b border-gray-200 bg-white">
              <div className="flex bg-[#eceef0] p-0.5 rounded-lg w-full select-none shadow-inner">
                <button
                  type="button"
                  onClick={() => setSidebarTab('negotiations')}
                  className={`flex-1 text-center py-1.5 text-[10px] sm:text-[10.5px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                    sidebarTab === 'negotiations'
                      ? 'bg-white text-gray-950 shadow-sm'
                      : 'text-gray-500 hover:text-gray-950'
                  }`}
                >
                  Active Chats ({threads.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('directory')}
                  className={`flex-1 text-center py-1.5 text-[10px] sm:text-[10.5px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                    sidebarTab === 'directory'
                      ? 'bg-white text-gray-950 shadow-sm'
                      : 'text-gray-500 hover:text-gray-950'
                  }`}
                >
                  Directory
                </button>
              </div>
            </div>

            {/* Filter / Search section */}
            <div className="p-3 bg-white border-b border-gray-150 shrink-0">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input 
                  className="w-full bg-white border border-gray-205 rounded-lg py-1.5 pl-8 pr-3 text-[11px] font-sans font-medium outline-none focus:border-[#0058be] transition-all" 
                  placeholder={sidebarTab === 'negotiations' ? "Filter active channels..." : "Search name, role, company..."} 
                  type="text"
                  value={sidebarTab === 'negotiations' ? channelSearch : searchQuery}
                  onChange={(e) => sidebarTab === 'negotiations' ? setChannelSearch(e.target.value) : setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Sub content scroll area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/30">
              {sidebarTab === 'negotiations' ? (
                <div className="space-y-2">
                  <p className="px-1 text-[9px] font-extrabold text-[#76777d] uppercase tracking-wider font-mono">Bilateral Channels</p>
                  
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="w-4 h-4 border-2 border-[#0058be] border-t-transparent rounded-full animate-spin mx-auto inline-block" />
                      <span className="text-[11px] text-gray-400 block mt-2 font-mono">Syncing...</span>
                    </div>
                  ) : filteredThreads.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-gray-400 border border-gray-100 bg-white rounded-lg p-3 font-mono">
                      {threads.length === 0
                        ? 'No conversations yet. Use the Directory tab to start a chat.'
                        : 'No matching channels'}
                    </div>
                  ) : (
                    filteredThreads.map((t) => {
                      const isSelected = t.id === selectedThreadId;
                      const partner = (t as any).otherParticipant;
                      const initials = partner ? getInitials(partner.fullName) : '??';
                      const threadIsTradePartyOnly = isTradePartyOnlyConversation(partner?.id);

                      if (isSelected) {
                        return (
                          <div 
                            key={t.id}
                            onClick={() => setSelectedThreadId(t.id)}
                            className="p-3 bg-[#111c30] text-white rounded-xl border border-[#111c30] shadow-md transition-all cursor-pointer text-left select-none relative"
                          >
                            <div className="flex gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-white/10 select-none border border-white/20 flex items-center justify-center font-bold text-[11px] shrink-0 text-white">
                                {initials}
                              </div>
                              <div className="flex-1 overflow-hidden min-w-0">
                                <div className="flex justify-between items-start leading-none">
                                  <h4 className="font-bold text-white truncate text-xs">{partner?.fullName || 'Contact'}</h4>
                                  <span className="text-[9px] text-[#818ea1]">{getThreadTimestamp(t as ThreadWithMeta)}</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 truncate">{partner?.companyName || partner?.jobRole?.replace(/_/g, ' ') || 'MariTrade user'}</p>
                                
                                {threadIsTradePartyOnly && t.status === 'COUNTER_OFFER' && t.currentCounterPriceUSD != null && (
                                <div className="mt-2.5 bg-[#0d1524] rounded-lg p-2 border border-[#1f2d47]">
                                  <div className="flex justify-between items-center text-[8px] font-extrabold text-[#818ea1] uppercase leading-none">
                                    <span>Counter Offer</span>
                                    <span className="text-[#a4ccff] font-bold">${t.currentCounterPriceUSD.toLocaleString()} USDC</span>
                                  </div>
                                  {t.cargoDescription && (
                                    <p className="text-[10.5px] text-white mt-1.5 italic font-medium leading-tight line-clamp-2">
                                      &ldquo;{t.cargoDescription}&rdquo;
                                    </p>
                                  )}
                                </div>
                                )}
                                <p className="text-[10px] text-gray-400 mt-2 truncate font-medium">
                                  {getLastMessagePreview(t as ThreadWithMeta)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={t.id}
                          onClick={() => setSelectedThreadId(t.id)}
                          className="p-3 bg-white border border-gray-250 hover:border-gray-300 rounded-xl transition-all cursor-pointer text-left select-none animate-fade-in"
                        >
                          <div className="flex gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-205 flex items-center justify-center font-bold text-[11px] shrink-0 text-slate-700">
                              {initials}
                            </div>
                            <div className="flex-1 overflow-hidden min-w-0">
                              <div className="flex justify-between items-start leading-none">
                                <h4 className="font-bold text-gray-900 truncate text-xs">{partner?.fullName || 'Contact'}</h4>
                                <span className="text-[9px] text-gray-400 shrink-0">{getThreadTimestamp(t as ThreadWithMeta)}</span>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-1 truncate">{partner?.companyName || partner?.jobRole?.replace(/_/g, ' ') || 'MariTrade user'}</p>
                              
                              {threadIsTradePartyOnly ? (
                              <div className="mt-2 flex items-center justify-between leading-none">
                                <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[8px] font-extrabold rounded uppercase tracking-wide">
                                  {t.status === 'DEAL_AGREED' ? 'Deal Agreed' : t.status === 'COUNTER_OFFER' ? 'Counter Offer' : 'Open'}
                                </span>
                                {t.currentCounterPriceUSD != null && (
                                  <span className="text-[11px] font-extrabold font-mono text-gray-700">${t.currentCounterPriceUSD.toLocaleString()}</span>
                                )}
                              </div>
                              ) : (
                              <div className="mt-2">
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-extrabold rounded uppercase tracking-wide">
                                  Logistics Channel
                                </span>
                              </div>
                              )}
                              <p className="text-[10px] text-gray-400 mt-2 truncate font-medium">
                                {getLastMessagePreview(t as ThreadWithMeta)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-2 animate-fade-in">
                  <p className="px-1 text-[9px] font-extrabold text-[#76777d] uppercase tracking-wider font-mono">User Directory</p>
                  
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-3 hover:border-gray-300 transition-all space-y-2.5 text-left">
                      <div className="flex justify-between items-start gap-1 leading-none">
                        <div className="flex gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-sm flex items-center justify-center font-bold text-[10px] border shrink-0 ${getRoleColor(u.jobRole)}`}>
                            {getInitials(u.fullName)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-slate-900 leading-tight truncate">{u.fullName}</h4>
                            <span className="text-[9px] text-gray-400 mt-0.5 block truncate max-w-[120px] font-sans font-semibold">{u.companyName}</span>
                          </div>
                        </div>
                        <span className="text-[7.5px] px-1.5 py-0.5 font-bold bg-slate-100 text-[#45464d] border border-gray-200 rounded tracking-tight shrink-0 uppercase">
                          {u.jobRole.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartNegotiation(u.id)}
                        className="w-full bg-[#0058be] hover:bg-[#004395] text-white font-bold py-1.5 rounded-lg text-xs leading-none transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                      >
                        Message {u.fullName.split(' ')[0]}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom persistent wide blue button exactly like screen.png */}
            {isTradePartyThread && activeThread && (
              <div className="p-3 bg-white border-t border-gray-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNegotiationPanel(!showNegotiationPanel)}
                  className="w-full bg-[#0058be] hover:bg-[#004395] text-white font-black py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-[10px] shadow-xs cursor-pointer active:scale-[0.98]"
                >
                  <Handshake className="w-4 h-4 text-white" />
                  <span>NEGOTIATE</span>
                </button>
              </div>
            )}
          </div>

          {/* Active Negotiation Chat feed detail */}
          <div className="flex-1 flex overflow-hidden min-w-0 h-full bg-[#f8fafc]">
            {activeThread ? (
              <div className="flex-1 flex h-full overflow-hidden">
                
                {/* Chat Column */}
                <div className="flex-1 flex flex-col h-full bg-white overflow-hidden min-w-0">
                  
                  {/* Chat Header */}
                  <div className="h-14 border-b border-gray-150 px-5 flex items-center justify-between bg-white shrink-0 select-none">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#0058be] text-white flex items-center justify-center font-bold text-xs shrink-0 select-none shadow-3xs">
                        {getInitials((activeThread as any).otherParticipant?.fullName || 'Representative')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 leading-none">
                          <h3 className="font-bold text-xs text-gray-905 truncate">
                            {(activeThread as any).otherParticipant?.fullName || 'Representative'}
                          </h3>
                          <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[8px] font-extrabold rounded-full flex items-center gap-0.5 uppercase select-none shrink-0 scale-95 origin-left">
                            <ShieldCheck className="w-2.5 h-2.5 text-green-600" /> KYC
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 font-sans font-medium truncate">
                          {(activeThread as any).otherParticipant?.companyName || 'Stellar Authorized counterparty'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[9px] font-mono font-bold text-gray-400 select-none">ID: {activeThread.id}</p>
                    </div>
                  </div>

                  {/* Message Stream Scroll Area */}
                  <div className="flex-1 p-4 md:p-5 overflow-y-auto space-y-4 flex flex-col bg-slate-50/20">
                    {loadingMessages && messages.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-12">
                        <div className="text-center">
                          <div className="w-4 h-4 border-2 border-[#0058be] border-t-transparent rounded-full animate-spin mx-auto inline-block" />
                          <span className="text-[11px] text-gray-400 block mt-2 font-mono">Loading messages...</span>
                        </div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-12">
                        <div className="text-center max-w-xs">
                          <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm font-bold text-gray-700">Start the conversation</p>
                          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                            Send a message below. Both parties will see it here in real time.
                          </p>
                        </div>
                      </div>
                    ) : (
                      messages.map((msg) => {
                      const isMe = msg.senderId === currentUser.id;
                      const sender = getUserById(msg.senderId);
                      const senderName = isMe ? 'You' : (sender?.fullName?.split(' ')[0] || 'Partner');
                      const senderInitials = getInitials(sender?.fullName || 'Partner');

                      return (
                        <div key={msg.id} className={`flex gap-2.5 max-w-xl ${isMe ? 'self-end justify-end' : 'self-start'}`}>
                          {!isMe && (
                            <div className="flex flex-col items-center shrink-0 select-none">
                              <span className="text-[8px] font-bold uppercase text-gray-400 mb-0.5 font-mono">{senderName}</span>
                              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-205 flex items-center justify-center font-bold text-[9px] text-slate-700">{senderInitials}</div>
                            </div>
                          )}
                          
                          <div className="text-left">
                            <div className={`p-3 rounded-2xl shadow-3xs ${
                              msg.isUnsent
                                ? 'bg-gray-50 text-gray-400 border border-gray-100 italic font-sans text-[11px]'
                                : isMe
                                  ? 'bg-[#0058be] text-white rounded-tr-none'
                                  : 'bg-white text-slate-900 border border-gray-150 rounded-tl-none'
                            }`}>
                              {isMe && !msg.isUnsent && (
                                <div className="flex justify-between items-center mb-0.5 select-none leading-none">
                                  <button
                                    type="button"
                                    className="text-[8px] font-mono font-bold text-white/50 hover:text-white cursor-pointer uppercase tracking-wider"
                                    onClick={() => handleUnsendMessage(msg.id)}
                                  >
                                    UNSEND
                                  </button>
                                </div>
                              )}
                              
                              {msg.isUnsent ? (
                                <span>This message has been retracted</span>
                              ) : (
                                <>
                                  {msg.imageUrl && (
                                    <div className="relative rounded-lg overflow-hidden max-w-xs mb-1.5 border border-gray-200 bg-black/5">
                                      <img 
                                        src={msg.imageUrl} 
                                        alt="Message attachment" 
                                        className="object-cover max-h-32 w-full hover:brightness-95 transition-all cursor-zoom-in"
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

                              <div className="flex justify-end items-center gap-1 mt-1 select-none leading-none">
                                <span className={`text-[8px] font-mono ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                                  {formatMessageTime(msg.createdAt)}
                                </span>
                                {isMe && !msg.isUnsent && (
                                  <span className="text-[10px] text-sky-200 font-bold select-none">✓✓</span>
                                )}
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

                  {/* Message Input Section */}
                  <div className="p-3 border-t border-gray-200 bg-white shrink-0 space-y-3">
                    
                    {/* Quick Replies Row */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none scrollbar-none">
                      <span className="text-[8.5px] text-[#76777d] font-bold uppercase font-mono tracking-wider shrink-0 mr-1">
                        ⚡ QUICK REPLIES:
                      </span>
                      <button type="button" onClick={() => setReplyText('Vessel space booked. Port load slot secured, cargo ready to dispatch.')} className="px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-205 rounded-full text-[10px] font-bold text-slate-705 transition-all whitespace-nowrap cursor-pointer">🚢 Ready Load</button>
                      <button type="button" onClick={() => setReplyText('BOC single administrative document (SAD) successfully filed for clearing.')} className="px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-205 rounded-full text-[10px] font-bold text-slate-705 transition-all whitespace-nowrap cursor-pointer">📑 SAD Filed</button>
                      <button type="button" onClick={() => setReplyText('All criteria satisfied. Settle on immediate escrow release via Stellar counter.')} className="px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-205 rounded-full text-[10px] font-bold text-slate-705 transition-all whitespace-nowrap cursor-pointer">🔒 Escrow release</button>
                      <button type="button" onClick={() => setReplyText('Uploaded the latest required trade credentials. Please verify and sign.')} className="px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-205 rounded-full text-[10px] font-bold text-slate-705 transition-all whitespace-nowrap cursor-pointer">📝 Verify Docs</button>
                    </div>

                    {selectedImage && (
                      <div className="p-2 border border-dashed border-gray-200 bg-gray-50 rounded-lg flex items-center justify-between gap-3 max-w-xs text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={selectedImage} alt="Preview Attachment" className="w-8 h-8 object-cover rounded border border-gray-200 shrink-0" referrerPolicy="no-referrer" />
                          <div className="min-w-0">
                            <span className="text-[8px] text-gray-400 font-extrabold font-mono tracking-wide uppercase block leading-none">PRELOADED</span>
                            <span className="text-[10px] text-green-700 font-bold block truncate mt-0.5">Ready to send</span>
                          </div>
                        </div>
                        <button type="button" className="text-gray-400 hover:text-red-500 cursor-pointer p-0.5" onClick={() => setSelectedImage(null)}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Input field + actions */}
                    <form onSubmit={handleSendMessage} className="flex gap-2.5 items-center">
                      <button 
                        type="button" 
                        onClick={() => setShowImagePicker(prev => !prev)}
                        className={`p-2 rounded-lg transition-all shrink-0 cursor-pointer ${
                          showImagePicker 
                            ? 'bg-blue-50 text-[#0058be]' 
                            : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                        }`}
                        title="Upload Attachment File"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      <div className="flex-1 bg-slate-50 border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#0058be] transition-all focus-within:ring-1 focus-within:ring-[#0058be]/10">
                        <textarea 
                          rows={1}
                          className="w-full bg-transparent border-none px-3 py-2 text-xs text-slate-900 placeholder-slate-400 resize-none outline-none focus:outline-none"
                          placeholder="Type your message..." 
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={submittingMsg}
                        className="px-4 py-2 bg-[#0058be] hover:bg-[#004395] text-white font-black rounded-lg flex items-center gap-1 transition-all shrink-0 uppercase tracking-wider text-[10px] cursor-pointer"
                      >
                        <span>{submittingMsg ? 'Sending...' : 'SEND'}</span>
                        <Send className="w-3 h-3 text-white" />
                      </button>
                    </form>

                    {/* Image Attachment Picker Overlay */}
                    {showImagePicker && (
                      <div className="relative">
                        <div className="absolute bottom-12 left-0 bg-white border border-gray-200 shadow-xl rounded-xl p-3 z-40 max-w-sm w-72 space-y-2.5 text-left animate-fade-in">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
                            <span className="font-bold text-[9px] text-[#76777d] uppercase tracking-wider font-mono">Attach Image</span>
                            <button type="button" onClick={() => setShowImagePicker(false)} className="text-gray-400 hover:text-gray-950 cursor-pointer">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-lg py-2 text-[9.5px] font-bold text-slate-650 flex items-center justify-center gap-1 cursor-pointer transition-all"
                          >
                            <FileUp className="w-3.5 h-3.5 text-slate-400" />
                            <span>Select image from device</span>
                          </button>
                          <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleCustomImageUpload} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right hand Panel Escrow & Counter Proposal Form — Trade Party to Trade Party only */}
                {showNegotiationPanel && isTradePartyThread && (
                  <div className="w-76 border-l border-gray-205 bg-white flex flex-col h-full shrink-0 overflow-y-auto animate-slide-in select-none">
                    <div className="p-4 border-b border-gray-150 bg-white flex items-center justify-between shrink-0 animate-fade-in">
                      <h4 className="font-extrabold text-gray-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono">
                        <Coins className="w-4 h-4 text-[#0058be] shrink-0" />
                        Escrow &amp; Offer
                      </h4>
                      <button type="button" className="text-gray-400 hover:text-gray-900" onClick={() => setShowNegotiationPanel(false)}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-4 space-y-4">
                      
                      {/* Status display from screen.png */}
                      <div className="bg-white border-2 border-gray-950 p-4 rounded-xl text-left select-none relative overflow-hidden">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[8.5px] text-[#76777d] font-mono font-black uppercase tracking-wider">Current Target Cost</span>
                          <Lock className="w-3 h-3 text-gray-400" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-955 font-mono tracking-tight leading-none mb-1">
                          {activeThread.currentCounterPriceUSD != null
                            ? `$${activeThread.currentCounterPriceUSD.toLocaleString()}`
                            : '—'}{' '}
                          <span className="text-[10px] font-extrabold text-gray-400">USDC</span>
                        </h2>
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3 h-3 text-green-500 fill-green-50" />
                          <span className="text-[8.5px] font-bold uppercase tracking-wider font-mono">Synced on Stellar Chain</span>
                        </div>
                      </div>

                      {activeThread.status === 'DEAL_AGREED' ? (
                        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl font-bold text-center space-y-1 text-[11px]">
                          <span className="block text-[10px] uppercase font-extrabold text-green-800 tracking-wider">✓ Secured In Escrow</span>
                          <p className="text-[9.5px] text-green-600 font-normal leading-normal">
                            Stablecoin collateral of ${activeThread.currentCounterPriceUSD?.toLocaleString() ?? '0'} USDC is successfully locked in Stellar Multi-Sign Vault and verified.
                          </p>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={handleAcceptFinalTerms}
                          className="w-full bg-[#00A651] hover:bg-green-700 text-white font-extrabold p-3 rounded-lg flex flex-col items-center gap-0.5 active:translate-y-[0.5px] transition-all cursor-pointer text-center leading-tight shadow-xs"
                        >
                          <span className="text-[11px] font-black tracking-tight">ACCEPT &amp; SECURE ESCROW</span>
                          <span className="text-[7.5px] opacity-80 uppercase font-mono font-bold tracking-widest">Stellar contract swap</span>
                        </button>
                      )}

                      <div className="h-px bg-gray-100" />

                      {/* Propose Counter Box */}
                      <form onSubmit={handleProposeCounter} className="space-y-3.5 text-left">
                        <h5 className="text-[9.5px] text-[#76777d] font-bold uppercase tracking-widest font-mono">Propose Counter_Offer</h5>
                        
                        <div className="space-y-2.5">
                          <div>
                            <label className="text-[9px] font-bold text-gray-550 uppercase block mb-1">Target Value USD</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[11px] font-mono">$</span>
                              <input 
                                type="number" 
                                className="w-full bg-white border border-gray-205 rounded-xl py-2 pl-6 pr-3 text-[11px] font-mono font-bold focus:border-gray-400 focus:outline-none shadow-3xs"
                                value={proposedPrice}
                                onChange={(e) => setProposedPrice(e.target.value)}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-gray-550 uppercase block mb-1">Negotiation Message</label>
                            <textarea 
                              rows={2}
                              className="w-full bg-white border border-gray-205 rounded-xl p-2.5 text-[11px] text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none shadow-3xs resize-none"
                              placeholder="e.g. Can we settle on intermediate port clearance standard terms..."
                              value={proposedDesc}
                              onChange={(e) => setProposedDesc(e.target.value)}
                            />
                          </div>
                        </div>

                        <button 
                          type="submit"
                          disabled={proposingCounter}
                          className="w-full bg-[#111c30] hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg text-[10px] leading-none transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-[0.99] uppercase tracking-wider"
                        >
                          {proposingCounter ? 'Syncing...' : 'TRANSMIT COUNTER'}
                          <RefreshCw className={`w-3 h-3 text-white ${proposingCounter ? 'animate-spin' : ''}`} />
                        </button>
                      </form>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-white p-12 text-center text-gray-400 text-xs shadow-none space-y-3 min-h-[480px] flex flex-col justify-center items-center w-full select-none">
                <MessageSquare className="w-10 h-10 text-gray-300" />
                <div className="font-bold text-gray-700 text-sm">No conversation selected</div>
                <p className="text-gray-400 max-w-sm leading-relaxed text-[11px]">
                  Select a chat from Active Chats, or open the Directory tab to message another MariTrade user.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Unified Lightbox widget overlay popup */}
        {lightboxImage && (
          <div 
            className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 animate-fade-in cursor-zoom-out"
            onClick={() => setLightboxImage(null)}
          >
            <div className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-white/10 shadow-2xl bg-[#131b2e] flex flex-col justify-center items-center">
              <button 
                type="button"
                className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white hover:text-red-400 hover:scale-105 p-1.5 rounded-full cursor-pointer transition-all border border-white/15 z-10"
                onClick={() => setLightboxImage(null)}
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <img 
                src={lightboxImage} 
                alt="Cargo Evidence Viewer" 
                className="max-w-full max-h-[75vh] object-contain rounded-lg select-none pointer-events-auto"
                referrerPolicy="no-referrer"
              />
              <div className="text-center pt-3 pb-2 text-[10px] font-mono text-white/60 tracking-wider font-semibold">
                CARGO CONTAINER EVIDENCE FILE &bull; CLICK ANYWHERE TO DISMISS
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
