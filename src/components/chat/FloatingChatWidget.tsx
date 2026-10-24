import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Hash, Minimize2, Maximize2, Users, DollarSign, Smile } from 'lucide-react';
import { ERPState, ChatMessage, ChatChannel } from '../../types';
import { triggerHaptic } from '../../lib/haptics';
import { UserChatAvatar } from './ChatView';
import { EmojiPickerPopup } from './EmojiPickerPopup';

interface FloatingChatWidgetProps {
  state: ERPState;
  onSendMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  onNavigateToFullChat?: () => void;
  onMarkRead?: () => void;
}

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
  state,
  onSendMessage,
  onNavigateToFullChat,
  onMarkRead
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const currentUser = state.currentUser;
  const chatMessages = state.chatMessages || [];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [lastSeenTime, setLastSeenTime] = useState<number>(() => {
    const saved = localStorage.getItem('pgz_last_read_chat_time');
    return saved ? parseInt(saved, 10) : Date.now();
  });

  // Unread messages count (messages from other users since last seen)
  const unreadCount = isOpen
    ? 0
    : chatMessages.filter(m => m.senderId !== currentUser.id && new Date(m.timestamp).getTime() > lastSeenTime).length;

  useEffect(() => {
    if (isOpen) {
      const now = Date.now();
      setLastSeenTime(now);
      try {
        localStorage.setItem('pgz_last_read_chat_time', now.toString());
      } catch (e) {}
      if (onMarkRead) onMarkRead();
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, chatMessages.length, onMarkRead]);

  const channelMessages = chatMessages;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    triggerHaptic('medium');
    onSendMessage({
      channelId: 'general',
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatarUrl,
      text: inputText.trim()
    });

    setInputText('');
    const now = Date.now();
    setLastSeenTime(now);
    try {
      localStorage.setItem('pgz_last_read_chat_time', now.toString());
    } catch (e) {}
    if (onMarkRead) onMarkRead();
  };

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {/* FLOATING ACTION BUTTON */}
      {!isOpen && (
        <button
          onClick={() => {
            triggerHaptic('heavy');
            setIsOpen(true);
          }}
          className="relative group p-3.5 rounded-full bg-gradient-to-tr from-[#00D4AA] to-[#3B82F6] text-slate-950 shadow-2xl shadow-[#00D4AA]/40 hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-white dark:border-[#0A0E1A]"
          title="Open Team Live Chat"
        >
          <MessageSquare className="w-6 h-6 stroke-[2.5]" />

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-mono font-extrabold text-[10px] flex items-center justify-center border-2 border-white dark:border-[#0A0E1A] animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* FLOATING CHAT WINDOW POPOVER */}
      {isOpen && (
        <div className="w-80 sm:w-96 bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[480px] animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* HEADER */}
          <div className="p-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-extrabold truncate flex items-center gap-1.5">
                  Team Chat
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </h4>
                <p className="text-[10px] text-slate-400 truncate">Real-time collaboration</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onNavigateToFullChat && (
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setIsOpen(false);
                    onNavigateToFullChat();
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Expand Full Chat"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MESSAGES FEED */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-[#0D121F] text-xs">
            {channelMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-[11px]">
                No messages yet in Team Chat
              </div>
            ) : (
              channelMessages.map(msg => {
                const isMe = msg.senderId === currentUser.id;

                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <UserChatAvatar
                      senderId={msg.senderId}
                      senderName={msg.senderName}
                      senderRole={msg.senderRole}
                      senderAvatar={msg.senderAvatar}
                      users={state.users}
                      size="sm"
                    />

                    <div className={`max-w-[85%] space-y-0.5 ${isMe ? 'items-end text-right' : 'items-start'}`}>
                      <div className={`text-[9px] text-slate-400 flex items-center gap-1 ${isMe ? 'justify-end' : ''}`}>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{msg.senderName}</span>
                        {msg.senderRole && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {msg.senderRole}
                          </span>
                        )}
                        <span>•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div className={`p-2.5 rounded-xl text-xs ${
                        isMe
                          ? 'bg-emerald-600 text-white dark:bg-[#00D4AA] dark:text-slate-950 font-medium rounded-tr-none'
                          : 'bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-900 dark:text-slate-100 rounded-tl-none'
                      }`}>
                        <p className="break-words">{msg.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FORM */}
          <form onSubmit={handleSend} className="p-2.5 bg-white dark:bg-[#131926] border-t border-slate-200 dark:border-[#1E2D40] flex items-center gap-1.5 relative">
            {/* Quick Emojis Dropdown Toggle */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2333] transition-colors cursor-pointer"
              title="Add Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            <input
              type="text"
              placeholder="Send message..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="flex-1 py-2 px-3 text-xs rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold disabled:opacity-40 transition-all cursor-pointer"
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
      )}
    </div>
  );
};
