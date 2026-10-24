import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Wallet,
  Receipt,
  Users,
  Calendar,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Coins
} from 'lucide-react';
import { triggerHaptic } from '../../lib/haptics';

export const TUTORIAL_STORAGE_KEY = 'pluszone_tutorial_dismissed_v1';

export interface TutorialStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  keyPoints: string[];
  actionLabel?: string;
  actionType?: 'NAVIGATE' | 'QUICK_ENTRY';
  targetTab?: string;
  targetSubView?: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  gradient: string;
  borderAccent: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'step-wallets',
    badge: '1 of 4 • Account Vaults',
    title: 'Multi-Wallet Vaults & Live Balances',
    subtitle: 'Real-Time Financial Integrity',
    description:
      'Manage Cash in Hand, Telebirr, CBE Bank, and eBirr in dedicated vaults. Each transaction computes live running balances with zero discrepancies and full transfer tracking.',
    keyPoints: [
      'Instant breakdown of Cash, Telebirr, CBE Bank & eBirr',
      'Lossless inter-wallet transfers with running balance audit logs',
      'Toggle balance visibility with one click for privacy'
    ],
    actionLabel: 'View Account Wallets',
    actionType: 'NAVIGATE',
    targetTab: 'wallets',
    icon: Wallet,
    accentColor: 'text-emerald-500 dark:text-emerald-400',
    gradient: 'from-emerald-500/15 via-teal-500/5 to-transparent',
    borderAccent: 'border-emerald-500/30 dark:border-emerald-500/30'
  },
  {
    id: 'step-transactions',
    badge: '2 of 4 • Fast Entry',
    title: 'Instant Recording & Multi-Wallet Splits',
    subtitle: 'Streamlined Daily Operations',
    description:
      'Log daily income collections and business expenses in seconds. When an expense is paid from multiple sources (e.g. partly Cash, partly Telebirr), split allocation does the accounting automatically.',
    keyPoints: [
      'Fast 1-tap "New Transaction" modal with smart categories',
      'Split payment support across multiple wallets in a single entry',
      'Auto-classification of operating vs owner withdrawals'
    ],
    actionLabel: 'Try New Transaction',
    actionType: 'QUICK_ENTRY',
    icon: Receipt,
    accentColor: 'text-blue-500 dark:text-blue-400',
    gradient: 'from-blue-500/15 via-indigo-500/5 to-transparent',
    borderAccent: 'border-blue-500/30 dark:border-blue-500/30'
  },
  {
    id: 'step-receivables',
    badge: '3 of 4 • Customer Bale\'da',
    title: 'Customer Bale\'da & Debt Collection',
    subtitle: 'Eliminate Unpaid Customer Tabs',
    description:
      'Keep tight control over customer credit sales without physical ledger books. Log partial cash or digital repayments, track due dates, and monitor overdue receivables with automatic alerts.',
    keyPoints: [
      'Log customer credit sales with customer names and phone numbers',
      'Record partial or full repayments directly into your chosen wallet',
      'Automated overdue agenda & collection progress indicators'
    ],
    actionLabel: 'Open Receivables Ledger',
    actionType: 'NAVIGATE',
    targetTab: 'more',
    targetSubView: 'RECEIVABLES',
    icon: Users,
    accentColor: 'text-amber-500 dark:text-amber-400',
    gradient: 'from-amber-500/15 via-orange-500/5 to-transparent',
    borderAccent: 'border-amber-500/30 dark:border-amber-500/30'
  },
  {
    id: 'step-equb',
    badge: '4 of 4 • Local Finance',
    title: 'Equb Engine & Ethiopian Calendar',
    subtitle: 'Traditional Finance Meets Modern Ledger',
    description:
      'Seamlessly manage rotating Equb circles, member payments, and payout schedules. Native dual Ethiopian (Ge\'ez) and Gregorian calendar support with built-in Pagumē holiday pause handling.',
    keyPoints: [
      'Track active Equb rounds, winners, and contribution schedules',
      'Automatic Pagumē (13th month) pause rules for payment cycles',
      'Toggle between Ethiopian (ዓ.ም) and Gregorian calendars instantly'
    ],
    actionLabel: 'Explore Equb Circles',
    actionType: 'NAVIGATE',
    targetTab: 'equb',
    icon: Calendar,
    accentColor: 'text-purple-500 dark:text-purple-400',
    gradient: 'from-purple-500/15 via-pink-500/5 to-transparent',
    borderAccent: 'border-purple-500/30 dark:border-purple-500/30'
  }
];

interface OnboardingTutorialCardProps {
  onNavigateTab?: (tab: string, subView?: string) => void;
  onOpenQuickEntry?: () => void;
  forceShow?: boolean;
  onClose?: () => void;
}

export const OnboardingTutorialCard: React.FC<OnboardingTutorialCardProps> = ({
  onNavigateTab,
  onOpenQuickEntry,
  forceShow = false,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      return;
    }
    const dismissed = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, [forceShow]);

  const handleDismiss = () => {
    triggerHaptic('light');
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setIsVisible(false);
    if (onClose) onClose();
  };

  const handleNext = () => {
    triggerHaptic('light');
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    triggerHaptic('light');
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const currentStep = TUTORIAL_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;
  const isLastStep = currentStepIndex === TUTORIAL_STEPS.length - 1;

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        id="onboarding-tutorial-disposable-card"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-[#111622] ${currentStep.borderAccent} shadow-md transition-colors duration-300`}
      >
        {/* Soft decorative background ambient gradient */}
        <div
          className={`absolute inset-0 bg-gradient-to-r ${currentStep.gradient} pointer-events-none transition-all duration-500`}
        />

        <div className="relative p-4 sm:p-5">
          {/* Card Top Navigation & Progress Bar */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1E2638] pb-3.5 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-[#00D4AA] border border-emerald-200 dark:border-emerald-800/60">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-[#8899BB]">
                    {currentStep.badge}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-[#1A2232] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#28354D]">
                    First-Time Guide
                  </span>
                </div>
              </div>
            </div>

            {/* Quick action buttons on top right: Step indicators & Dismiss button */}
            <div className="flex items-center gap-2">
              {/* Step indicator dots */}
              <div className="hidden sm:flex items-center gap-1.5 mr-2">
                {TUTORIAL_STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      triggerHaptic('light');
                      setCurrentStepIndex(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === currentStepIndex
                        ? 'w-6 bg-emerald-500 dark:bg-[#00D4AA]'
                        : 'w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'
                    }`}
                    title={`Go to step ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                id="btn-skip-tutorial-x"
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-[#1A2232] dark:hover:bg-[#253046] transition-colors cursor-pointer"
                title="Skip and close tutorial"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Card Content */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Step Icon & Title Area */}
            <div className="md:col-span-4 flex md:flex-col items-center md:items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-[#161D2B] border border-slate-200/80 dark:border-[#243046] shadow-inner ${currentStep.accentColor}`}
              >
                <StepIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                  {currentStep.title}
                </h3>
                <p className="text-xs font-semibold text-slate-500 dark:text-[#8899BB] mt-0.5">
                  {currentStep.subtitle}
                </p>
              </div>
            </div>

            {/* Description and Key Highlights */}
            <div className="md:col-span-8 flex flex-col justify-between space-y-3">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {currentStep.description}
              </p>

              <div className="space-y-1.5 pt-1">
                {currentStep.keyPoints.map((point, pIdx) => (
                  <div key={pIdx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${currentStep.accentColor}`} />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card Footer: Skip option & Navigation controls */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-[#1E2638]">
            <button
              id="btn-skip-tutorial-link"
              onClick={handleDismiss}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 py-1.5 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1A2232] transition-colors cursor-pointer"
            >
              Skip Tutorial (Don't show again)
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {/* Optional feature jump button */}
              {currentStep.actionLabel && (
                <button
                  id={`btn-tutorial-action-${currentStep.id}`}
                  onClick={() => {
                    triggerHaptic('medium');
                    if (currentStep.actionType === 'QUICK_ENTRY' && onOpenQuickEntry) {
                      onOpenQuickEntry();
                    } else if (currentStep.actionType === 'NAVIGATE' && onNavigateTab && currentStep.targetTab) {
                      onNavigateTab(currentStep.targetTab, currentStep.targetSubView);
                    }
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-[#1A2232] dark:hover:bg-[#253046] border border-slate-200 dark:border-[#28354D] cursor-pointer transition-all active:scale-95"
                >
                  <span>{currentStep.actionLabel}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </button>
              )}

              {/* Prev Button */}
              {currentStepIndex > 0 && (
                <button
                  id="btn-tutorial-prev"
                  onClick={handlePrev}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#1A2232] dark:hover:bg-[#253046] border border-slate-200 dark:border-[#28354D] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              {/* Next / Finish Button */}
              <button
                id="btn-tutorial-next"
                onClick={handleNext}
                className="px-4 py-1.5 rounded-xl text-xs font-black text-slate-950 bg-[#00D4AA] hover:bg-[#00E5B8] shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <span>{isLastStep ? 'Got it, Start Using App' : 'Next Feature'}</span>
                {!isLastStep ? <ChevronRight className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
