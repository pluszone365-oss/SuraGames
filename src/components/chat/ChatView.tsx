import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Smile,
  Hash,
  Users,
  Search,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Building,
  CheckCheck,
  X,
  FileText,
  Image as ImageIcon,
  DollarSign,
  TrendingUp,
  Wallet,
  CornerDownRight,
  Sparkles,
  Pin,
  Flame,
  UserCheck,
  Check,
  HelpCircle,
  Trash2,
  UserPlus
} from 'lucide-react';
import { ERPState, ChatMessage, ChatChannel, UserProfile, UserRole, Transaction, Wallet as WalletType, Equb } from '../../types';
import { triggerHaptic } from '../../lib/haptics';
import { DEFAULT_ROLE_PERMISSIONS } from '../../lib/auth';
import { EmojiPickerPopup } from './EmojiPickerPopup';
import { QUICK_REACTION_EMOJIS } from './emojiData';
import { compressImageForChat } from '../../lib/realtimeChat';

interface ChatViewProps {
  state: ERPState;
  onSendMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onCreateChannel?: (channel: Omit<ChatChannel, 'id' | 'createdDate'>) => void;
  onNavigateTab?: (tab: any) => void;
  onApproveRequest?: (reqId: string, note?: string) => void;
  onRejectRequest?: (reqId: string, note?: string) => void;
  onMarkRead?: () => void;
  onOpenHelp?: () => void;
  onSwitchUser?: (user: UserProfile) => void;
  onDeleteMessage?: (messageId: string) => void;
  onRegisterUser?: (newUser: UserProfile) => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '🚀', '💡', '💰', '✅', '🔥', '🙏', '👏', '🎯'];

export const UserChatAvatar: React.FC<{
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  users: UserProfile[];
  size?: 'sm' | 'md';
}> = ({ senderId, senderName, senderRole, senderAvatar, users, size = 'md' }) => {
  const matchedUser = users?.find(
    u => u.id === senderId ||
         (u.name && senderName && u.name.toLowerCase() === senderName.toLowerCase()) ||
         (u.email && senderId && senderId.toLowerCase().includes(u.email.toLowerCase()))
  );
  const avatarUrl = senderAvatar || matchedUser?.avatarUrl;
  const [imgFailed, setImgFailed] = useState(false);

  const initial = (senderName || matchedUser?.name || 'U').charAt(0).toUpperCase();

  const getAvatarGradient = (name?: string) => {
    const gradients = [
      'from-emerald-600 to-teal-700 text-white',
      'from-indigo-600 to-blue-700 text-white',
      'from-teal-600 to-cyan-700 text-white',
      'from-blue-600 to-indigo-700 text-white'
    ];
    if (!name) return gradients[0];
    const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
    return gradients[code % gradients.length];
  };

  const dimClasses = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';

  if (avatarUrl && !imgFailed) {
    return (
      <div className={`${dimClasses} rounded-full overflow-hidden shrink-0 border-2 border-emerald-500/40 dark:border-[#00D4AA]/40 shadow-sm relative bg-[#0A0E1A]`}>
        <img
          src={avatarUrl}
          alt={senderName}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover rounded-full"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dimClasses} rounded-full bg-gradient-to-tr ${getAvatarGradient(senderName || matchedUser?.name)} flex items-center justify-center font-black shrink-0 border border-white/20 dark:border-slate-700 shadow-sm select-none`}
    >
      {initial}
    </div>
  );
};

export const ChatView: React.FC<ChatViewProps> = ({
  state,
  onSendMessage,
  onAddReaction,
  onApproveRequest,
  onRejectRequest,
  onMarkRead,
  onOpenHelp,
  onSwitchUser,
  onDeleteMessage,
  onRegisterUser
}) => {
  const currentUser = state.currentUser;
  const chatMessages = state.chatMessages || [];

  const [inputText, setInputText] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [showQuickRegisterUser, setShowQuickRegisterUser] = useState(false);
  const [newUserNameInput, setNewUserNameInput] = useState('');
  const [newUserRoleInput, setNewUserRoleInput] = useState<UserRole>('Partner');

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  // Attachment state
  const [attachedFile, setAttachedFile] = useState<{ url: string; name: string; type: 'IMAGE' | 'DOCUMENT' } | null>(null);

  // Financial Reference picker modal
  const [showRefPicker, setShowRefPicker] = useState(false);
  const [selectedRef, setSelectedRef] = useState<ChatMessage['reference'] | undefined>(undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mark chat as read on mount and on new message
  useEffect(() => {
    if (onMarkRead) {
      onMarkRead();
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length, onMarkRead]);

  // Filter messages for main chat
  const filteredMessages = chatMessages.filter(m => {
    if (messageSearchQuery.trim()) {
      return (m.text || '').toLowerCase().includes(messageSearchQuery.toLowerCase()) ||
        (m.senderName || '').toLowerCase().includes(messageSearchQuery.toLowerCase());
    }
    return true;
  });

  // Handle File Upload with automatic image compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    if (isImage) {
      try {
        const compressedUrl = await compressImageForChat(file);
        setAttachedFile({
          url: compressedUrl,
          name: file.name,
          type: 'IMAGE'
        });
        triggerHaptic('light');
        return;
      } catch (_) {}
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedFile({
        url: reader.result as string,
        name: file.name,
        type: isImage ? 'IMAGE' : 'DOCUMENT'
      });
      triggerHaptic('light');
    };
    reader.readAsDataURL(file);
  };

  // Handle Submit
  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !attachedFile && !selectedRef) return;

    triggerHaptic('medium');

    onSendMessage({
      channelId: 'general',
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatarUrl,
      text: inputText.trim(),
      fileUrl: attachedFile?.url,
      fileName: attachedFile?.name,
      fileType: attachedFile?.type,
      replyToId: replyingTo?.id,
      replyToText: replyingTo?.text ? replyingTo.text.substring(0, 60) : '',
      replyToSenderName: replyingTo?.senderName,
      reference: selectedRef,
      isAnnouncement: Boolean(isAnnouncement)
    });

    setInputText('');
    setAttachedFile(null);
    setSelectedRef(undefined);
    setReplyingTo(null);
    setIsAnnouncement(false);
    setShowEmojiPicker(false);
    if (onMarkRead) onMarkRead();
  };

  return (
    <div className="space-y-4 pb-24 max-w-5xl mx-auto">
      {/* HEADER TITLE BANNER */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0A0E1A] rounded-2xl p-5 border border-slate-700/50 shadow-lg text-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 shrink-0">
            <MessageSquare className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              Team Chat
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                REAL-TIME
              </span>
            </h2>
            <p className="text-xs text-slate-300">
              Collaborate across cashiers, managers & admins. Share financial references instantly.
            </p>
          </div>
        </div>
      </div>

      {/* MAIN CHAT CONVERSATION AREA */}
      <div id="tour-chat-header" data-tour="chat-header" className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl flex flex-col h-[640px] shadow-sm overflow-hidden">
        {/* CHAT HEADER */}
        <div id="tour-chat-channels" data-tour="chat-channels" className="px-5 py-3.5 border-b border-slate-200 dark:border-[#1E2D40] bg-slate-50/50 dark:bg-[#131926] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-[#00D4AA]/20 text-emerald-600 dark:text-[#00D4AA] flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Team Chat Room
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#8899BB] truncate">
                Real-time instant communication across all active team members
              </p>
            </div>
          </div>

          {/* Chat search & controls */}
          <div className="flex items-center gap-2">
            {/* Quick Profile Switcher for Effortless Multi-User Testing */}
            {onSwitchUser && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserSwitcher(!showUserSwitcher)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1C2333] dark:hover:bg-[#252F44] text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  title="Switch profile to test multi-user real-time chat"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">User:</span>
                  <span className="text-emerald-600 dark:text-[#00D4AA] truncate max-w-[80px]">{currentUser.name.split(' ')[0]}</span>
                </button>

                {showUserSwitcher && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#1A2333] border border-slate-200 dark:border-[#2A374D] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-[#252F44] mb-1">
                      <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">Test Multi-User Chat</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Switch profile to test 0ms instant messaging</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {(state.users || []).map((u) => {
                        const isCurrent = u.id === currentUser.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              onSwitchUser(u);
                              setShowUserSwitcher(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-[#00D4AA] font-bold border border-emerald-500/20'
                                : 'hover:bg-slate-100 dark:hover:bg-[#252F44] text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <UserChatAvatar
                                senderId={u.id}
                                senderName={u.name}
                                senderRole={u.role}
                                senderAvatar={u.avatarUrl}
                                users={state.users}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="font-bold truncate text-[11px]">{u.name}</p>
                                <p className="text-[10px] text-slate-400">{u.role}</p>
                              </div>
                            </div>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Register User in Chat */}
                    {onRegisterUser && (
                      <div className="pt-2 mt-1 border-t border-slate-100 dark:border-[#252F44]">
                        {!showQuickRegisterUser ? (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setShowQuickRegisterUser(true);
                            }}
                            className="w-full py-1.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-[#00D4AA] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ Register New Chat User</span>
                          </button>
                        ) : (
                          <div className="space-y-2 p-1.5 bg-slate-50 dark:bg-[#121824] rounded-xl border border-slate-200 dark:border-slate-800">
                            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Quick Register &amp; Switch</p>
                            <input
                              type="text"
                              value={newUserNameInput}
                              onChange={(e) => setNewUserNameInput(e.target.value)}
                              placeholder="Full Name (e.g. Dawit)"
                              className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none"
                            />
                            <div className="flex gap-1.5">
                              <select
                                value={newUserRoleInput}
                                onChange={(e) => setNewUserRoleInput(e.target.value as UserRole)}
                                className="flex-1 text-[11px] px-2 py-1.5 rounded-lg bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none cursor-pointer"
                              >
                                <option value="Partner">Partner</option>
                                <option value="Admin">Admin</option>
                                <option value="Viewer">Viewer</option>
                                <option value="SuperAdmin">SuperAdmin</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!newUserNameInput.trim()) return;
                                  triggerHaptic('medium');
                                  const clean = newUserNameInput.trim();
                                  const usernameVal = clean.toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${Date.now().toString().slice(-4)}`;
                                  const newUser: UserProfile = {
                                    id: `u-${Date.now()}`,
                                    name: clean,
                                    email: `${usernameVal}@pluszone.com`,
                                    username: usernameVal,
                                    role: newUserRoleInput,
                                    active: true,
                                    isApproved: true,
                                    hasSetPassword: true,
                                    permissions: DEFAULT_ROLE_PERMISSIONS[newUserRoleInput],
                                    branch: 'Addis Ababa HQ',
                                    lastActive: 'Just now'
                                  };
                                  onRegisterUser(newUser);
                                  onSwitchUser?.(newUser);
                                  setNewUserNameInput('');
                                  setShowQuickRegisterUser(false);
                                  setShowUserSwitcher(false);
                                }}
                                disabled={!newUserNameInput.trim()}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isSearchOpen ? 'bg-emerald-500/20 text-emerald-600 dark:text-[#00D4AA]' : 'hover:bg-slate-100 dark:hover:bg-[#1C2333] text-slate-500'
              }`}
              title="Search messages"
            >
              <Search className="w-4 h-4" />
            </button>
            {onOpenHelp && (
              <button
                type="button"
                id="btn-page-help-chat"
                onClick={() => {
                  triggerHaptic('light');
                  onOpenHelp();
                }}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1C2333] text-slate-500 dark:text-[#8899BB] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                title="Chat & Communications Help (?)"
                aria-label="Help"
              >
                <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </button>
            )}
          </div>
        </div>

        {/* IN-CHANNEL MESSAGE SEARCH BAR (IF TOGGLED) */}
        {isSearchOpen && (
          <div className="px-4 py-2 bg-slate-100 dark:bg-[#1C2333] border-b border-slate-200 dark:border-[#1E2D40] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Filter messages..."
              value={messageSearchQuery}
              onChange={e => setMessageSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
            {messageSearchQuery && (
              <button
                onClick={() => setMessageSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

          {/* MESSAGES LIST CONTAINER */}
          <div id="tour-chat-messages" data-tour="chat-messages" className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-[#0D121F]">
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <MessageSquare className="w-12 h-12 stroke-[1.5] text-slate-300 dark:text-slate-700 mb-2 animate-bounce" />
                <p className="text-sm font-extrabold text-slate-700 dark:text-slate-300">No messages yet</p>
                <p className="text-xs max-w-xs mt-1 text-slate-500">
                  Be the first to start the conversation in <span className="font-bold">Team Chat</span>!
                </p>
              </div>
            ) : (
              filteredMessages.map(msg => {
                const isMe = msg.senderId === currentUser.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* User Avatar with Profile Picture */}
                    <UserChatAvatar
                      senderId={msg.senderId}
                      senderName={msg.senderName}
                      senderRole={msg.senderRole}
                      senderAvatar={msg.senderAvatar}
                      users={state.users}
                      size="md"
                    />

                    {/* Message Bubble Column */}
                    <div className={`max-w-[80%] space-y-1 ${isMe ? 'items-end text-right' : 'items-start'}`}>
                      {/* Meta header */}
                      <div className={`flex items-center gap-1.5 text-[10px] text-slate-400 ${isMe ? 'justify-end' : ''}`}>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{msg.senderName}</span>
                        {msg.senderRole && (
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                            msg.senderRole === 'SuperAdmin'
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                              : msg.senderRole === 'Admin'
                              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                              : msg.senderRole === 'Partner'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {msg.senderRole}
                          </span>
                        )}
                        <span>•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {/* Replying Context Banner if reply */}
                      {msg.replyToText && (
                        <div className={`p-2 rounded-lg text-xs bg-slate-100 dark:bg-[#1A2333] border-l-2 border-emerald-500 text-slate-600 dark:text-slate-300 italic mb-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          <span className="font-bold non-italic text-emerald-600 dark:text-[#00D4AA]">{msg.replyToSenderName || 'Reply'}:</span> {msg.replyToText}
                        </div>
                      )}

                      {/* Main Message Content */}
                      <div className={`relative p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                        msg.isAnnouncement
                          ? 'bg-amber-500/15 border-2 border-amber-500/40 text-slate-900 dark:text-amber-100 rounded-tl-none font-medium'
                          : isMe
                          ? 'bg-emerald-600 text-white dark:bg-[#00D4AA] dark:text-slate-950 rounded-tr-none font-medium'
                          : 'bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-900 dark:text-slate-100 rounded-tl-none'
                      }`}>
                        {/* Announcement Badge */}
                        {msg.isAnnouncement && (
                          <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 mb-1 text-[11px] uppercase tracking-wider">
                            <Pin className="w-3.5 h-3.5" />
                            <span>Official Announcement</span>
                          </div>
                        )}

                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                        {/* Financial or Approval Reference Card if attached */}
                        {msg.reference && (
                          <div className={`mt-2.5 p-3 rounded-xl border text-left flex flex-col gap-2 ${
                            msg.reference.type === 'APPROVAL'
                              ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/30 text-slate-900 dark:text-slate-100'
                              : 'bg-slate-950/10 dark:bg-slate-950/30 border-slate-200/30 dark:border-slate-800'
                          }`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  msg.reference.type === 'APPROVAL'
                                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                    : 'bg-emerald-500/20 text-emerald-500'
                                }`}>
                                  {msg.reference.type === 'APPROVAL' ? <ShieldCheck className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-[11px] truncate">{msg.reference.title}</p>
                                  <p className="text-[10px] opacity-80 truncate">{msg.reference.subtitle}</p>
                                </div>
                              </div>

                              {msg.reference.type === 'APPROVAL' && msg.reference.status && (
                                <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold uppercase shrink-0 ${
                                  msg.reference.status === 'APPROVED'
                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : msg.reference.status === 'REJECTED'
                                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                }`}>
                                  {msg.reference.status}
                                </span>
                              )}

                              {msg.reference.amount !== undefined && (
                                <span className="font-mono font-extrabold text-[11px] shrink-0">
                                  ETB {msg.reference.amount.toLocaleString()}
                                </span>
                              )}
                            </div>

                            {/* Reason Display Block */}
                            {msg.reference.reason && (
                              <div className="text-[11px] font-medium bg-amber-500/10 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-500/20 text-amber-950 dark:text-amber-200">
                                <span className="font-extrabold text-amber-700 dark:text-amber-300">💬 Reason: </span>
                                <span>{msg.reference.reason}</span>
                              </div>
                            )}

                            {/* Quick Approve / Reject action inside Chat if request is pending - Equal privilege for ALL team roles */}
                            {msg.reference.type === 'APPROVAL' && msg.reference.status === 'PENDING' && onApproveRequest && onRejectRequest && (
                              <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('success');
                                    onApproveRequest(msg.reference!.id);
                                  }}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-sm"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve Request</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('warning');
                                    onRejectRequest(msg.reference!.id);
                                  }}
                                  className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-sm"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject Request</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* File / Image Attachment */}
                        {msg.fileUrl && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-slate-200/20 max-w-sm">
                            {msg.fileType === 'IMAGE' ? (
                              <img src={msg.fileUrl} alt={msg.fileName || 'Attachment'} className="max-h-52 w-full object-cover" />
                            ) : (
                              <a
                                href={msg.fileUrl}
                                download={msg.fileName || 'attachment'}
                                className="p-3 bg-slate-800/20 flex items-center gap-2 text-xs font-bold hover:underline"
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="truncate">{msg.fileName || 'Download Attached Document'}</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Reactions Pills Bar */}
                      <div className={`flex flex-wrap gap-1 items-center pt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {msg.reactions && msg.reactions.map((react, i) => {
                          const hasReacted = react.users.includes(currentUser.id);

                          return (
                            <button
                              key={i}
                              onClick={() => {
                                triggerHaptic('light');
                                onAddReaction(msg.id, react.emoji);
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 transition-all cursor-pointer ${
                                hasReacted
                                  ? 'bg-emerald-500/20 border border-emerald-500/40 font-bold text-emerald-700 dark:text-[#00D4AA]'
                                  : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                              }`}
                            >
                              <span>{react.emoji}</span>
                              <span className="font-mono">{react.count}</span>
                            </button>
                          );
                        })}

                        {/* Action buttons (Reply & Quick React) */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button
                            onClick={() => {
                              triggerHaptic('light');
                              setReplyingTo(msg);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                            title="Reply to message"
                          >
                            <CornerDownRight className="w-3.5 h-3.5" />
                          </button>

                          {COMMON_EMOJIS.slice(0, 3).map(e => (
                            <button
                              key={e}
                              onClick={() => {
                                triggerHaptic('light');
                                onAddReaction(msg.id, e);
                              }}
                              className="p-0.5 hover:scale-125 transition-transform text-xs cursor-pointer"
                            >
                              {e}
                            </button>
                          ))}

                          {onDeleteMessage && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('warning');
                                onDeleteMessage(msg.id);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                              title="Delete message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* REPLYING CONTEXT BAR */}
          {replyingTo && (
            <div className="px-4 py-2 bg-slate-100 dark:bg-[#1A2333] border-t border-slate-200 dark:border-[#1E2D40] flex items-center justify-between text-xs text-slate-700 dark:text-slate-200">
              <div className="flex items-center gap-2 truncate">
                <CornerDownRight className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Replying to <strong className="text-emerald-600 dark:text-[#00D4AA]">{replyingTo.senderName}</strong>:</span>
                <span className="truncate italic text-slate-500 dark:text-slate-400">"{replyingTo.text}"</span>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* FINANCIAL REFERENCE PREVIEW BAR */}
          {selectedRef && (
            <div className="px-4 py-2 bg-emerald-500/10 border-t border-emerald-500/20 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Referencing: <strong className="font-bold">{selectedRef.title}</strong> ({selectedRef.subtitle})</span>
              </div>
              <button onClick={() => setSelectedRef(undefined)} className="p-1 text-emerald-600 dark:text-emerald-400 hover:opacity-80">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* FILE ATTACHMENT PREVIEW BAR */}
          {attachedFile && (
            <div className="px-4 py-2 bg-slate-100 dark:bg-[#1A2333] border-t border-slate-200 dark:border-[#1E2D40] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-bold truncate">{attachedFile.name}</span>
                <span className="text-[10px] font-mono text-slate-500">({attachedFile.type})</span>
              </div>
              <button onClick={() => setAttachedFile(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Identity & 0ms Cloud Sync Strip */}
          <div className="px-4 py-1.5 bg-slate-50/80 dark:bg-[#0E1524] border-t border-slate-200/60 dark:border-[#1E2D40] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 flex-wrap">
              <span>Posting as:</span>
              <strong className="text-slate-800 dark:text-white font-bold">{currentUser.name}</strong>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {currentUser.role}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-[#00D4AA] font-bold">
                • Equal Privilege Chat
              </span>
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-[#00D4AA] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              0ms Cloud Sync
            </span>
          </div>

          {/* INPUT FORM */}
          <form id="tour-chat-composer" data-tour="chat-composer" onSubmit={handleSend} className="p-3 bg-white dark:bg-[#131926] border-t border-slate-200 dark:border-[#1E2D40] flex items-center gap-2 shrink-0 relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
            />

            {/* Attach file button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2333] transition-colors cursor-pointer"
              title="Attach File or Image"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Attach Financial Reference button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowRefPicker(true);
              }}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                selectedRef ? 'bg-emerald-500/20 text-emerald-600 dark:text-[#00D4AA]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2333]'
              }`}
              title="Reference Transaction, Wallet, or Equb"
            >
              <DollarSign className="w-5 h-5" />
            </button>

            {/* Quick Emojis Dropdown Toggle */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2333] transition-colors cursor-pointer"
              title="Add Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="flex-1 py-2.5 px-3.5 text-xs rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {/* Announcement / Pin Toggle - Equal privilege for all team members */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsAnnouncement(!isAnnouncement);
              }}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isAnnouncement ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="Pin / Send as Official Announcement (Equal privilege for all users)"
            >
              <Pin className="w-4 h-4" />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() && !attachedFile && !selectedRef}
              className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Send className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Comprehensive Phone Emoji Picker Popover */}
            <EmojiPickerPopup
              isOpen={showEmojiPicker}
              onClose={() => setShowEmojiPicker(false)}
              onSelectEmoji={(emoji) => {
                setInputText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + emoji);
              }}
              anchorPosition="bottom-left"
            />
          </form>
        </div>

      {/* FINANCIAL REFERENCE PICKER MODAL */}
      {showRefPicker && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E2D40] pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Attach Financial Reference
              </h3>
              <button onClick={() => setShowRefPicker(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#8899BB]">
              Select a recent transaction or wallet to link directly into your message for team review.
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              <p className="text-[11px] font-extrabold uppercase text-slate-400">Recent Transactions</p>
              {state.transactions
                .slice(0, 8)
                .map(tx => (
                <button
                  key={tx.id}
                  onClick={() => {
                    setSelectedRef({
                      type: 'TRANSACTION',
                      id: tx.id,
                      title: `${tx.type === 'INCOME' ? 'Income' : 'Expense'}: ${tx.category}`,
                      subtitle: tx.description || tx.branch,
                      amount: tx.amount
                    });
                    setShowRefPicker(false);
                  }}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-[#1C2333] hover:border-emerald-500 border border-slate-200 dark:border-[#1E2D40] flex items-center justify-between transition-all cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{tx.category} - {tx.description || tx.branch}</p>
                    <p className="text-[10px] text-slate-400">{new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`font-mono font-bold text-xs ${tx.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ETB {tx.amount.toLocaleString()}
                  </span>
                </button>
              ))}

              <p className="text-[11px] font-extrabold uppercase text-slate-400 pt-2">Wallets & Vaults</p>
              {state.wallets.map(w => (
                <button
                  key={w.id}
                  onClick={() => {
                    setSelectedRef({
                      type: 'WALLET',
                      id: w.id,
                      title: w.name,
                      subtitle: w.accountNumber || w.type
                    });
                    setShowRefPicker(false);
                  }}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-[#1C2333] hover:border-emerald-500 border border-slate-200 dark:border-[#1E2D40] flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-indigo-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{w.name}</p>
                      <p className="text-[10px] text-slate-400">{w.accountNumber || w.type}</p>
                    </div>
                  </div>
                </button>
              ))}

              {(state.approvalRequests || []).length > 0 && (
                <>
                  <p className="text-[11px] font-extrabold uppercase text-amber-500 pt-2">Approval Requests</p>
                  {(state.approvalRequests || []).map(req => (
                    <button
                      key={req.id}
                      onClick={() => {
                        setSelectedRef({
                          type: 'APPROVAL',
                          id: req.id,
                          title: req.targetTitle,
                          subtitle: `Action: ${req.actionType.replace(/_/g, ' ')}`,
                          reason: req.reason || 'Co-admin authorization requested',
                          status: req.status
                        });
                        setShowRefPicker(false);
                      }}
                      className="w-full text-left p-3 rounded-xl bg-amber-500/10 hover:border-amber-500 border border-amber-500/30 flex items-center justify-between transition-all cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{req.targetTitle}</p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                          {req.actionType.replace(/_/g, ' ')} • Reason: {req.reason || 'Verification requested'}
                        </p>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded font-extrabold uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        {req.status}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
