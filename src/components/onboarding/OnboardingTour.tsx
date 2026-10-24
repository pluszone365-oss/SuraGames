import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, ChevronLeft, X, Sparkles, Check, HelpCircle } from 'lucide-react';
import { TourStep, ONBOARDING_TOUR_STEPS, ONBOARDING_STORAGE_KEY } from './onboardingSteps';
import { NavTab } from '../../types';
import { SubViewType } from '../more/MoreHubView';
import { triggerHaptic } from '../../lib/haptics';

export { ONBOARDING_STORAGE_KEY };

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  moreSubView?: SubViewType;
  onNavigateTab: (tab: NavTab, subView?: SubViewType | string) => void;
  userId?: string;
  onCompleted?: () => void;
  customSteps?: TourStep[];
  tourTitle?: string;
  initialStepIndex?: number;
}

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  activeTab,
  moreSubView,
  onNavigateTab,
  userId,
  onCompleted,
  customSteps,
  tourTitle,
  initialStepIndex = 0
}) => {
  const steps = customSteps || ONBOARDING_TOUR_STEPS;
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(initialStepIndex);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const retryTimeoutRef = useRef<any>(null);

  // Reset to initial step whenever tour is freshly opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(initialStepIndex);
    }
  }, [isOpen, initialStepIndex]);

  const currentStep = steps[currentStepIndex];

  // Save tour completion to localStorage and trigger callbacks
  const handleFinishOrDismiss = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      if (userId) {
        localStorage.setItem(`${ONBOARDING_STORAGE_KEY}_${userId}`, 'true');
      }
    } catch (e) {
      console.warn('Unable to persist tour state to localStorage', e);
    }
    triggerHaptic('light');
    onClose();
    if (onCompleted) {
      onCompleted();
    }
  }, [userId, onClose, onCompleted]);

  // Position and measure the current target element
  const measureTarget = useCallback(() => {
    if (!currentStep) return;

    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (el) {
      const rect = el.getBoundingClientRect();
      // Only set if element has actual dimensions
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        });
        return true;
      }
    }
    return false;
  }, [currentStep]);

  // Update target measurement and scroll into view
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    // Check if step requires tab or subview change
    const needsTabSwitch = currentStep.tab !== activeTab;
    const needsSubViewSwitch =
      currentStep.tab === 'more' &&
      currentStep.subView &&
      moreSubView !== currentStep.subView.toUpperCase();

    if (needsTabSwitch || needsSubViewSwitch) {
      setIsNavigating(true);
      onNavigateTab(currentStep.tab, currentStep.subView);
    }

    // Attempt to locate and scroll to target with retries
    let attempts = 0;
    const maxAttempts = 10;

    const attemptMeasurement = () => {
      const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
      if (el) {
        // Responsive scroll: position element to provide ample room for the tour card
        const rect = el.getBoundingClientRect();
        const currentScrollY = window.scrollY || document.documentElement.scrollTop;
        const vh = window.innerHeight;

        let targetScrollY = currentScrollY;
        if (currentStep.placement === 'top') {
          // Bottom portion of screen: leave space above for card
          targetScrollY = currentScrollY + rect.bottom - (vh - 200);
        } else {
          // Placement bottom: leave ~80px below the fixed top header, providing maximum space below for card
          targetScrollY = currentScrollY + rect.top - 80;
        }

        window.scrollTo({
          top: Math.max(0, targetScrollY),
          behavior: 'smooth'
        });

        // Allow scroll animation to settle before measuring
        setTimeout(() => {
          const success = measureTarget();
          setIsNavigating(false);
          if (!success && attempts < maxAttempts) {
            attempts++;
            retryTimeoutRef.current = setTimeout(attemptMeasurement, 150);
          }
        }, 180);
      } else if (attempts < maxAttempts) {
        attempts++;
        retryTimeoutRef.current = setTimeout(attemptMeasurement, 150);
      } else {
        // Fallback: If element not found in DOM, center spotlight in viewport
        setIsNavigating(false);
        setTargetRect(null);
      }
    };

    const timer = setTimeout(attemptMeasurement, needsTabSwitch ? 220 : 60);

    return () => {
      clearTimeout(timer);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [isOpen, currentStepIndex, currentStep, activeTab, moreSubView, onNavigateTab, measureTarget]);

  // Screen viewport dimensions state
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 400,
    h: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const [measuredCardHeight, setMeasuredCardHeight] = useState(210);

  // ResizeObserver to track exact card height across font scaling and devices
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 50) {
          setMeasuredCardHeight(Math.round(entry.contentRect.height) + 16);
        }
      }
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [isOpen, currentStepIndex]);

  // Track viewport dimensions on resize and orientation changes
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      setViewport({
        w: window.innerWidth,
        h: window.innerHeight
      });
      measureTarget();
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('orientationchange', handleUpdate, { passive: true });
    window.addEventListener('scroll', handleUpdate, { passive: true });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
    };
  }, [isOpen, measureTarget]);

  // Keyboard navigation (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleFinishOrDismiss();
      } else if (e.key === 'ArrowRight') {
        if (currentStepIndex < steps.length - 1) {
          triggerHaptic('light');
          setCurrentStepIndex(prev => prev + 1);
        } else {
          handleFinishOrDismiss();
        }
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        triggerHaptic('light');
        setCurrentStepIndex(prev => prev - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, steps.length, handleFinishOrDismiss]);

  if (!isOpen || !currentStep) return null;

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Spotlight Cutout coordinates with padding
  const pad = 6;
  const cutout = targetRect
    ? {
        x: Math.max(0, targetRect.x - pad),
        y: Math.max(0, targetRect.y - pad),
        width: targetRect.width + pad * 2,
        height: targetRect.height + pad * 2
      }
    : null;

  // Tooltip card positioning calculation
  const isSmallScreen = viewport.w < 480;
  const horizPadding = isSmallScreen ? 12 : 16;
  const cardWidth = Math.min(380, viewport.w - horizPadding * 2);
  const cardEstimatedHeight = measuredCardHeight || 210;

  let computedLeft = horizPadding;
  let computedTop = 16;
  let arrowPlacement: 'top' | 'bottom' | 'none' = 'none';
  let arrowLeft = 24;

  if (cutout) {
    const targetCenterX = cutout.x + cutout.width / 2;
    // Align card center with target center, strictly clamped to viewport bounds
    computedLeft = Math.max(
      horizPadding,
      Math.min(viewport.w - cardWidth - horizPadding, targetCenterX - cardWidth / 2)
    );

    // Compute pointer arrow beak position relative to the card's left edge
    arrowLeft = Math.max(20, Math.min(cardWidth - 28, targetCenterX - computedLeft - 8));

    const spaceBelow = viewport.h - (cutout.y + cutout.height);
    const spaceAbove = cutout.y;

    const fitsBelow = spaceBelow >= cardEstimatedHeight + 16;
    const fitsAbove = spaceAbove >= cardEstimatedHeight + 16;

    let placeBelow = true;
    if (currentStep.placement === 'top') {
      placeBelow = fitsAbove ? false : true;
    } else {
      placeBelow = fitsBelow || spaceBelow >= spaceAbove;
    }

    if (placeBelow) {
      computedTop = cutout.y + cutout.height + 12;
      arrowPlacement = 'top';
      // Safety clamp: ensure card bottom never overflows viewport bottom
      if (computedTop + cardEstimatedHeight > viewport.h - 12) {
        computedTop = Math.max(12, viewport.h - cardEstimatedHeight - 12);
      }
    } else {
      computedTop = cutout.y - cardEstimatedHeight - 12;
      arrowPlacement = 'bottom';
      // Safety clamp: ensure card top never overflows viewport top
      if (computedTop < 12) {
        computedTop = 12;
      }
    }
  } else {
    // Fallback: center in screen if target element is not found
    computedLeft = Math.max(horizPadding, (viewport.w - cardWidth) / 2);
    computedTop = Math.max(12, (viewport.h - cardEstimatedHeight) / 2);
    arrowPlacement = 'none';
  }

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    width: `${cardWidth}px`,
    left: `${computedLeft}px`,
    top: `${computedTop}px`,
    maxHeight: `calc(100vh - 24px)`
  };

  return (
    <div className="fixed inset-0 z-[9990] select-none">
      {/* SVG Spotlight Dimming Overlay */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto transition-opacity duration-300"
        style={{ zIndex: 9991 }}
      >
        <defs>
          <mask id="pluszone-spotlight-mask">
            {/* White background: full dim */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Cutout hole: transparent clear area over target */}
            {cutout && (
              <rect
                x={cutout.x}
                y={cutout.y}
                width={cutout.width}
                height={cutout.height}
                rx="14"
                ry="14"
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Dimmed backdrop using mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.72)"
          mask="url(#pluszone-spotlight-mask)"
        />
      </svg>

      {/* Target Element Focus Ring (Indigo Accent) */}
      {cutout && (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out rounded-2xl border-2 border-indigo-500 ring-4 ring-indigo-500/30 shadow-[0_0_25px_rgba(99,102,241,0.35)]"
          style={{
            zIndex: 9992,
            left: cutout.x,
            top: cutout.y,
            width: cutout.width,
            height: cutout.height
          }}
        >
          {/* Subtle animated pulse corner indicators */}
          <span className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-indigo-500 ring-2 ring-white animate-ping" />
        </div>
      )}

      {/* Anchored Tooltip Popup Card */}
      <div
        ref={cardRef}
        style={cardStyle}
        className="bg-white dark:bg-[#131926] border border-indigo-100 dark:border-indigo-900/60 shadow-2xl rounded-2xl p-4 sm:p-5 space-y-3 pointer-events-auto transition-all duration-200 animate-fadeIn overflow-y-auto"
      >
        {/* Pointer Arrow Beak */}
        {arrowPlacement === 'top' && (
          <div
            style={{ left: `${arrowLeft}px` }}
            className="absolute -top-2 w-4 h-4 bg-white dark:bg-[#131926] border-t border-l border-indigo-100 dark:border-indigo-900/60 transform rotate-45 pointer-events-none"
          />
        )}
        {arrowPlacement === 'bottom' && (
          <div
            style={{ left: `${arrowLeft}px` }}
            className="absolute -bottom-2 w-4 h-4 bg-white dark:bg-[#131926] border-b border-r border-indigo-100 dark:border-indigo-900/60 transform rotate-45 pointer-events-none"
          />
        )}

        {/* Header: Step Counter Badge & Close Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
              <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span>Step {currentStepIndex + 1}/{steps.length}</span>
            </span>

            {currentStep.badge && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate max-w-[130px] sm:max-w-none">
                {currentStep.badge}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleFinishOrDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Close Tour (Esc)"
            aria-label="Close Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Content: Title & Plain 1-2 sentence description */}
        <div className="space-y-1">
          <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
            {currentStep.title}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Step Progress Bar Track */}
        <div className="pt-1.5 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500">
            <span>{tourTitle || 'Tour Walkthrough'}</span>
            <span className="font-mono">{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800/90 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.round(((currentStepIndex + 1) / steps.length) * 100)}%` }}
            />
          </div>
        </div>

        {/* Action Controls: Skip on left, Back & Next on right */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 gap-2">
          <button
            type="button"
            onClick={handleFinishOrDismiss}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-1.5 transition-colors cursor-pointer shrink-0"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isFirstStep && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setCurrentStepIndex(prev => Math.max(0, prev - 1));
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                aria-label="Previous tour step"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                if (isLastStep) {
                  handleFinishOrDismiss();
                } else {
                  setCurrentStepIndex(prev => prev + 1);
                }
              }}
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/25 cursor-pointer transition-all active:scale-95 shrink-0 whitespace-nowrap"
              aria-label={isLastStep ? 'Finish onboarding tour' : 'Next tour step'}
            >
              <span>{isLastStep ? 'Get Started' : 'Next'}</span>
              {isLastStep ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
