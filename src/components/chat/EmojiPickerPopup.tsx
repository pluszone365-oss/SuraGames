import React, { useState } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { PHONE_EMOJI_CATEGORIES, QUICK_REACTION_EMOJIS } from './emojiData';
import { triggerHaptic } from '../../lib/haptics';

interface EmojiPickerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  anchorPosition?: 'bottom-left' | 'bottom-right' | 'top';
}

export const EmojiPickerPopup: React.FC<EmojiPickerPopupProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  anchorPosition = 'bottom-left'
}) => {
  const [activeCategory, setActiveCategory] = useState<string>(PHONE_EMOJI_CATEGORIES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const currentCategoryObj = PHONE_EMOJI_CATEGORIES.find(c => c.id === activeCategory) || PHONE_EMOJI_CATEGORIES[0];

  const filteredEmojis = searchQuery.trim()
    ? PHONE_EMOJI_CATEGORIES.flatMap(c => c.emojis).filter((emoji, index, self) => self.indexOf(emoji) === index)
    : currentCategoryObj.emojis;

  const handleEmojiClick = (emoji: string) => {
    triggerHaptic('light');
    onSelectEmoji(emoji);
  };

  return (
    <>
      {/* Backdrop for closing on outside tap */}
      <div
        className="fixed inset-0 z-40 bg-black/20 md:bg-transparent"
        onClick={onClose}
      />

      <div
        className={`absolute z-50 w-72 sm:w-80 bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 ${
          anchorPosition === 'bottom-left'
            ? 'bottom-14 left-2 sm:left-4'
            : anchorPosition === 'bottom-right'
            ? 'bottom-14 right-2 sm:right-4'
            : 'bottom-full mb-2 left-2'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header & Quick Emojis Bar */}
        <div className="p-2.5 bg-slate-50 dark:bg-[#0D121F] border-b border-slate-200 dark:border-[#1E2D40] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 font-mono">
              <span>😀 Phone Emojis</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Reaction Row */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {QUICK_REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-sm transition-transform active:scale-125 cursor-pointer shrink-0"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        {!searchQuery && (
          <div className="flex items-center justify-around bg-slate-100/70 dark:bg-[#172033] border-b border-slate-200 dark:border-[#1E2D40] px-1 py-1">
            {PHONE_EMOJI_CATEGORIES.map(cat => {
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveCategory(cat.id);
                  }}
                  title={cat.name}
                  className={`p-1.5 text-base rounded-xl transition-all ${
                    isActive
                      ? 'bg-emerald-500/20 dark:bg-[#00D4AA]/20 border border-emerald-500/30 scale-110 shadow-xs'
                      : 'opacity-60 hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat.icon}
                </button>
              );
            })}
          </div>
        )}

        {/* Emoji Grid with high-fidelity native font rendering */}
        <div className="p-2.5 max-h-56 overflow-y-auto grid grid-cols-7 sm:grid-cols-8 gap-1.5 bg-white dark:bg-[#131926] select-none">
          {filteredEmojis.map((emoji, idx) => (
            <button
              key={`${emoji}-${idx}`}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg sm:text-xl hover:bg-slate-100 dark:hover:bg-[#1C2333] active:scale-125 transition-transform cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Category Title Footer */}
        <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#0D121F] border-t border-slate-200 dark:border-[#1E2D40] text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-between">
          <span>{currentCategoryObj.name}</span>
          <span className="text-[9px] text-[#00D4AA]">Tap to insert</span>
        </div>
      </div>
    </>
  );
};
