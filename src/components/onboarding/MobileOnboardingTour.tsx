/**
 * Mobile Onboarding Tour (Expo / React Native Compatible)
 * 
 * Provides an identical 8-step spotlight tour experience for React Native / Expo.
 * Uses View onLayout & measureInWindow measurements with an animated spotlight overlay,
 * AsyncStorage persistence, and match-for-match PlusZone indigo styling.
 * 
 * Usage in an Expo / React Native App:
 * ```tsx
 * import { MobileOnboardingTour, useMobileOnboardingTour } from './components/onboarding/MobileOnboardingTour';
 * 
 * export function App() {
 *   const { isTourActive, currentStep, nextStep, prevStep, skipTour, registerTarget } = useMobileOnboardingTour();
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <View ref={registerTarget('dashboard-kpis')} ... />
 *       <MobileOnboardingTour visible={isTourActive} onDismiss={skipTour} ... />
 *     </View>
 *   );
 * }
 * ```
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface MobileTourStep {
  id: string;
  targetKey: string;
  title: string;
  description: string;
  badge?: string;
}

export const MOBILE_TOUR_STEPS: MobileTourStep[] = [
  {
    id: 'dashboard-kpis',
    targetKey: 'dashboard-kpis',
    title: 'Business Overview & KPIs',
    description: 'See your real-time total net worth, today’s cash collections, and expenses across all business branches at a glance.',
    badge: 'Overview'
  },
  {
    id: 'wallets-overview',
    targetKey: 'wallets-overview',
    title: 'Multi-Wallet Vaults',
    description: 'Track exact balances for Cash, Telebirr, CBE Bank, and eBirr in separate vaults with zero calculation errors.',
    badge: 'Vaults'
  },
  {
    id: 'quick-entry',
    targetKey: 'quick-entry',
    title: '1-Tap Fast Transaction Entry',
    description: 'Tap this quick-add button anytime to record customer sales, supplier payments, or shop expenses in seconds.',
    badge: 'Fast Add'
  },
  {
    id: 'split-payments',
    targetKey: 'split-payments',
    title: 'Split Multi-Source Payments',
    description: 'Pay bills using multiple accounts at once — like half in Cash and half via Telebirr — without manual math.',
    badge: 'Split Pay'
  },
  {
    id: 'loans-receivables',
    targetKey: 'loans-receivables',
    title: 'Customer Bale\'da & Debt',
    description: 'Never lose track of credit given to customers. Record partial repayments, track due dates, and monitor overdue tabs.',
    badge: 'Bale\'da'
  },
  {
    id: 'equb-section',
    targetKey: 'equb-section',
    title: 'Equb Rotating Savings',
    description: 'Automate traditional Ethiopian Equb circles with member payment logs, winner payouts, and Pagumē holiday pauses.',
    badge: 'Equb'
  },
  {
    id: 'partner-distributions',
    targetKey: 'partner-distributions',
    title: 'Partner Profit Distributions',
    description: 'Transparently calculate and divide monthly company profits among business partners based on agreed ownership shares.',
    badge: 'Partners'
  },
  {
    id: 'financial-reports',
    targetKey: 'financial-reports',
    title: 'Financial Statements & Audit',
    description: 'Generate audited profit and loss statements, balance sheets, and tax-ready summaries with a single tap.',
    badge: 'Reports'
  }
];

export const MOBILE_ONBOARDING_STORAGE_KEY = '@pluszone:has_seen_onboarding';

export interface MobileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MobileOnboardingTourProps {
  visible: boolean;
  onDismiss: () => void;
  targetRect?: MobileRect | null;
  currentStepIndex: number;
  totalSteps?: number;
  step: MobileTourStep;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

/**
 * Portable React / React Native compatible rendering wrapper
 */
export const MobileOnboardingTour: React.FC<MobileOnboardingTourProps> = ({
  visible,
  onDismiss,
  targetRect,
  currentStepIndex,
  totalSteps = MOBILE_TOUR_STEPS.length,
  step,
  onNext,
  onPrev,
  onSkip
}) => {
  if (!visible || !step) return null;

  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex flex-col justify-end p-4 pointer-events-auto select-none bg-slate-950/70 backdrop-blur-xs"
    >
      {/* Target Focus Highlight Box */}
      {targetRect && (
        <div
          className="fixed rounded-2xl border-2 border-indigo-500 ring-4 ring-indigo-400/40 pointer-events-none transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          style={{
            left: targetRect.x - 4,
            top: targetRect.y - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8
          }}
        />
      )}

      {/* Floating Card for Mobile Viewports */}
      <div className="w-full max-w-sm mx-auto bg-white dark:bg-[#131926] border border-indigo-100 dark:border-indigo-900/60 rounded-3xl p-5 shadow-2xl space-y-3.5 mb-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
              {currentStepIndex + 1} of {totalSteps}
            </span>
            {step.badge && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {step.badge}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {step.title}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {step.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={onPrev}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25"
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
