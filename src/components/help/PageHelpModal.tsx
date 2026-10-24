import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  HelpCircle,
  LayoutDashboard,
  ReceiptText,
  Wallet,
  PiggyBank,
  MessageSquare,
  BarChart3,
  FileCheck,
  Calendar,
  Sliders,
  ChevronRight,
  ChevronDown,
  Compass,
  Lightbulb,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { NavTab } from '../../types';
import { PageHelpItem, PAGE_HELP_DATA, getPageHelp } from './pageHelpContent';
import { triggerHaptic } from '../../lib/haptics';

interface PageHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: NavTab;
  currentSubView?: string;
  onStartPageTour: (tab: NavTab, subView?: string) => void;
  onStartFullAppTour: () => void;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboard,
  ReceiptText,
  Wallet,
  PiggyBank,
  MessageSquare,
  BarChart3,
  FileCheck,
  Calendar,
  Sliders
};

export const PageHelpModal: React.FC<PageHelpModalProps> = ({
  isOpen,
  onClose,
  currentTab,
  currentSubView,
  onStartPageTour,
  onStartFullAppTour
}) => {
  // Allow user to switch between help topics within the modal
  const [selectedHelpId, setSelectedHelpId] = useState<string>('dashboard');
  const [activeTabSection, setActiveTabSection] = useState<'OVERVIEW' | 'GUIDES' | 'FAQ'>('OVERVIEW');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Sync selected help topic when currentTab or currentSubView changes
  useEffect(() => {
    if (isOpen) {
      const defaultHelp = getPageHelp(currentTab, currentSubView);
      setSelectedHelpId(defaultHelp.id);
      setActiveTabSection('OVERVIEW');
      setOpenFaqIndex(null);
    }
  }, [isOpen, currentTab, currentSubView]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentHelp = PAGE_HELP_DATA.find(h => h.id === selectedHelpId) || PAGE_HELP_DATA[0];
  const IconComponent = ICON_MAP[currentHelp.iconName] || HelpCircle;

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center p-3 sm:p-5 select-none animate-fadeIn">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Modal Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-help-modal-title"
        className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#111726] border border-slate-200 dark:border-[#1E2D40] rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 transition-all text-slate-900 dark:text-slate-100"
      >
        {/* HEADER BAR */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1E2D40] flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#131926]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="page-help-modal-title" className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  {currentHelp.title}
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                  {currentHelp.badge}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#8899BB]">
                Help, interactive page tour, and operational guides
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-[#1E2D40] transition-colors cursor-pointer shrink-0"
            aria-label="Close help modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PAGE SELECTOR PILLS */}
        <div className="px-4 py-2 bg-slate-100/70 dark:bg-[#0E1420] border-b border-slate-200/70 dark:border-[#1E2D40]/80 overflow-x-auto flex items-center gap-1.5 scrollbar-thin">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 shrink-0">
            Pages:
          </span>
          {PAGE_HELP_DATA.map(item => {
            const isSelected = item.id === selectedHelpId;
            const PageIcon = ICON_MAP[item.iconName] || HelpCircle;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedHelpId(item.id);
                  setOpenFaqIndex(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-[#8899BB] hover:bg-white dark:hover:bg-[#182030] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PageIcon className="w-3.5 h-3.5" />
                <span>{item.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* INTERACTIVE TOUR LAUNCHER BANNER */}
          <div className="bg-gradient-to-r from-indigo-900/90 via-indigo-950 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-indigo-500/30 text-indigo-300">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-black">
                  Interactive Page Spotlight Tour
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  {currentHelp.tourStepCount} Steps
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-lg">
                Follow an automated, visual step-by-step walkthrough directly on this page with live element highlighting.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onClose();
                  onStartPageTour(currentHelp.tab, currentHelp.subView);
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-500/30 transition-all cursor-pointer whitespace-nowrap active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Start Page Tour</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                  onStartFullAppTour();
                }}
                className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border border-white/20"
                title="Walk through the entire application from start to finish"
              >
                <Compass className="w-3.5 h-3.5 text-indigo-300" />
                <span className="hidden sm:inline">Full App Tour</span>
              </button>
            </div>
          </div>

          {/* PAGE SUMMARY */}
          <div className="bg-slate-50 dark:bg-[#131926] border border-slate-200/80 dark:border-[#1E2D40] rounded-2xl p-4">
            <h5 className="text-xs font-bold text-slate-500 dark:text-[#8899BB] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>Page Overview</span>
            </h5>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {currentHelp.summary}
            </p>
          </div>

          {/* SECTION NAVIGATION PILLS */}
          <div className="flex items-center border-b border-slate-200 dark:border-[#1E2D40] gap-4">
            <button
              type="button"
              onClick={() => setActiveTabSection('OVERVIEW')}
              className={`pb-2.5 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                activeTabSection === 'OVERVIEW'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>Key Features ({currentHelp.highlights.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTabSection('GUIDES')}
              className={`pb-2.5 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                activeTabSection === 'GUIDES'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>How-To Guides ({currentHelp.howToGuides.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTabSection('FAQ')}
              className={`pb-2.5 text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                activeTabSection === 'FAQ'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>Pro Tips & FAQ ({currentHelp.faq.length + currentHelp.proTips.length})</span>
            </button>
          </div>

          {/* TAB 1: KEY FEATURES */}
          {activeTabSection === 'OVERVIEW' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentHelp.highlights.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-[#1E2D40] hover:border-indigo-500/40 transition-all space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <h6 className="text-xs font-bold text-slate-900 dark:text-white">
                        {h.label}
                      </h6>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-7">
                      {h.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: HOW-TO GUIDES */}
          {activeTabSection === 'GUIDES' && (
            <div className="space-y-4 animate-fadeIn">
              {currentHelp.howToGuides.map((guide, gIdx) => (
                <div
                  key={gIdx}
                  className="bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-[#1E2D40] rounded-2xl p-4 space-y-3"
                >
                  <h6 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                      {gIdx + 1}
                    </span>
                    <span>{guide.title}</span>
                  </h6>

                  <ol className="space-y-2 pl-7 list-decimal list-outside text-xs text-slate-600 dark:text-slate-300">
                    {guide.steps.map((step, sIdx) => (
                      <li key={sIdx} className="leading-relaxed pl-1">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: PRO TIPS & FAQ */}
          {activeTabSection === 'FAQ' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Pro Tips Section */}
              {currentHelp.proTips.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                  <h6 className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-2 uppercase tracking-wider">
                    <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Business Best Practices & Pro Tips</span>
                  </h6>
                  <ul className="space-y-1.5 pl-5 list-disc text-xs text-amber-900/90 dark:text-amber-200 leading-relaxed">
                    {currentHelp.proTips.map((tip, tIdx) => (
                      <li key={tIdx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* FAQ Accordion */}
              <div className="space-y-2">
                <h6 className="text-xs font-bold text-slate-500 dark:text-[#8899BB] uppercase tracking-wider px-1">
                  Frequently Asked Questions
                </h6>
                {currentHelp.faq.map((item, fIdx) => {
                  const isOpen = openFaqIndex === fIdx;
                  return (
                    <div
                      key={fIdx}
                      className="bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-[#1E2D40] rounded-2xl overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : fIdx)}
                        className="w-full p-3.5 text-left text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#182030] transition-colors"
                      >
                        <span>{item.q}</span>
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-indigo-500 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-[#1E2D40] pt-2.5">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER BAR */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-[#1E2D40] bg-slate-50/70 dark:bg-[#131926]/90 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Press</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
              Esc
            </kbd>
            <span className="hidden sm:inline">to close anytime</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                onClose();
                onStartPageTour(currentHelp.tab, currentHelp.subView);
              }}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/25 cursor-pointer transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start Page Tour</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
