import React, { useState, useEffect } from 'react';
import {
  Target,
  Repeat,
  FileCheck,
  BarChart3,
  Shield,
  Briefcase,
  Tag,
  Calendar as CalendarIcon,
  Users,
  Database,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Settings,
  Sliders,
  LogOut,
  MessageSquare,
  HelpCircle,
  Radio
} from 'lucide-react';
import { ERPState, Receivable } from '../../types';
import { triggerHaptic } from '../../lib/haptics';
import { saveStateToStorage } from '../../lib/store';
import { syncStateToFirebaseNow } from '../../lib/firebase';
import { TUTORIAL_STORAGE_KEY } from '../common/OnboardingTutorialCard';

// Subviews
import { GoalsView } from './GoalsView';
import { RecurringView } from './RecurringView';
import { ReceivablesView } from './ReceivablesView';
import { AssetsView } from './AssetsView';
import { ReportsView } from './ReportsView';
import { AuditLogView } from './AuditLogView';
import { UsersView } from './UsersView';
import { CalendarView } from './CalendarView';
import { BackupView } from './BackupView';
import { CategoriesView } from './CategoriesView';
import { SecuritySystemView } from './SecuritySystemView';
import { AdvancedFinancialSystem } from './AdvancedFinancialSystem';
import { PlayStoreStandardsView } from './PlayStoreStandardsView';
import { PaymentFraudPreventionView } from './PaymentFraudPreventionView';
import { SettingsView, SettingsTabType } from './SettingsView';
import { ProfileView } from './ProfileView';
import { User, Camera, Mail, ShieldCheck, Building2, Smartphone } from 'lucide-react';

export type SubViewType =
  | 'HUB'
  | 'PROFILE'
  | 'SETTINGS'
  | 'GOALS'
  | 'RECURRING'
  | 'RECEIVABLES'
  | 'ASSETS'
  | 'REPORTS'
  | 'AUDIT_LOG'
  | 'USERS'
  | 'CATEGORIES'
  | 'CALENDAR'
  | 'BACKUP'
  | 'SECURITY'
  | 'FINANCIAL_SYSTEM'
  | 'PLAY_STORE_STANDARDS'
  | 'FRAUD_PREVENTION';

export const normalizeSubView = (raw?: string): SubViewType => {
  if (!raw) return 'HUB';
  const u = raw.toUpperCase();
  if (u === 'FRAUD' || u === 'FRAUD_PREVENTION' || u === 'SMS_CONFIRMATION' || u === 'PAYMENT_FRAUD') return 'FRAUD_PREVENTION';
  if (u === 'RECEIVABLES' || u === 'RECEIVABLE') return 'RECEIVABLES';
  if (u === 'REPORTS' || u === 'REPORT') return 'REPORTS';
  if (u === 'CALENDAR') return 'CALENDAR';
  if (u === 'AUDIT' || u === 'AUDIT_LOG' || u === 'AUDIT_LOGS') return 'AUDIT_LOG';
  if (u === 'PARTNERS' || u === 'USERS' || u === 'USER') return 'USERS';
  if (u === 'CATEGORIES' || u === 'CATEGORY') return 'CATEGORIES';
  if (u === 'SETTINGS' || u === 'SETTING') return 'SETTINGS';
  if (u === 'SECURITY') return 'SECURITY';
  if (u === 'ASSETS' || u === 'ASSET') return 'ASSETS';
  if (u === 'GOALS' || u === 'GOAL') return 'GOALS';
  if (u === 'RECURRING') return 'RECURRING';
  if (u === 'BACKUP') return 'BACKUP';
  if (u === 'PROFILE') return 'PROFILE';
  if (u === 'FINANCIAL_SYSTEM') return 'FINANCIAL_SYSTEM';
  if (u === 'PLAY_STORE_STANDARDS') return 'PLAY_STORE_STANDARDS';
  return (u as SubViewType) || 'HUB';
};

interface MoreHubViewProps {
  state: ERPState;
  onUpdateState: (fn: (prev: ERPState) => ERPState) => void;
  onOpenAiAssistant: (prompt?: string, initialMode?: 'chat' | 'simulator') => void;
  onLogout?: () => void;
  initialSubView?: SubViewType;
  onNavigateTab?: (tab: any) => void;
  onCollectReceivable?: (receivableId: string, walletId: string, amount: number) => void;
  onReplayTour?: () => void;
  onOpenHelp?: (subView?: string) => void;
}

export const MoreHubView: React.FC<MoreHubViewProps> = ({
  state,
  onUpdateState,
  onOpenAiAssistant,
  onLogout,
  initialSubView,
  onNavigateTab,
  onCollectReceivable,
  onReplayTour,
  onOpenHelp
}) => {
  const [subView, setSubView] = useState<SubViewType>(() => normalizeSubView(initialSubView));
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabType | null>(null);

  React.useEffect(() => {
    if (initialSubView) {
      setSubView(normalizeSubView(initialSubView));
    }
  }, [initialSubView]);

  const openSettings = (tab: SettingsTabType | null = null) => {
    triggerHaptic('light');
    setSettingsInitialTab(tab);
    setSubView('SETTINGS');
  };

  // Settings grouped items
  const settingItems = [
    {
      id: 'CATEGORIES' as SettingsTabType,
      title: 'Categories',
      subtitle: 'Income & Expense tags',
      icon: Tag,
      color: '#00D4AA',
      count: `${state.categories.length} categories`
    },
    {
      id: 'PARTNERS' as SettingsTabType,
      title: 'Partners & Roles',
      subtitle: 'Users & permissions',
      icon: Users,
      color: '#FB923C',
      count: `${state.users.length} partners`,
      superAdminOnly: true
    },
    {
      id: 'RECURRING' as SettingsTabType,
      title: 'Recurring Bills',
      subtitle: 'Rent, telecom & schedules',
      icon: Repeat,
      color: '#A78BFA',
      count: `${state.recurring.length} active bills`
    },
    {
      id: 'BACKUP' as SettingsTabType,
      title: 'Data Backup & Import',
      subtitle: 'Export JSON & reset',
      icon: Database,
      color: '#64748B',
      count: 'JSON Snapshot'
    }
  ];

  const operationalTiles = [
    {
      id: 'SIMULATOR' as any,
      title: 'Business Decision & Scenario Simulator',
      subtitle: 'Simulate CapEx, Equb Circles, Branch Expansion, Price Elasticity & 24-Mo Enterprise Valuation',
      icon: Sliders,
      color: '#00D4AA',
      onClick: () => {
        triggerHaptic('light');
        onOpenAiAssistant(undefined, 'simulator');
      }
    },
    {
      id: 'FINANCIAL_SYSTEM' as SubViewType,
      title: 'Financial System & Intelligence Hub',
      subtitle: 'Liquidity Matrix, Cash Runway Buffer, Category Budgets & 3-Month Fixed Tax Schedule',
      icon: Building2,
      color: '#00D4AA',
      onClick: () => {
        triggerHaptic('light');
        setSubView('FINANCIAL_SYSTEM');
      }
    },
    {
      id: 'SECURITY' as SubViewType,
      title: 'Security System & SOC Center',
      subtitle: '2FA, Master PIN, WebAuthn Passkeys, Active Devices & Threat Radar',
      icon: ShieldCheck,
      color: '#3B82F6',
      onClick: () => {
        triggerHaptic('light');
        setSubView('SECURITY');
      }
    },
    {
      id: 'FRAUD_PREVENTION' as SubViewType,
      title: 'Payment Fraud Prevention System',
      subtitle: 'Zero-Trust Telebirr / CBE / E-Birr Bank SMS Verification & Cashier Protection',
      icon: Shield,
      color: '#00D4AA',
      onClick: () => {
        triggerHaptic('light');
        setSubView('FRAUD_PREVENTION');
      }
    },
    {
      id: 'PLAY_STORE_STANDARDS' as SubViewType,
      title: 'Google Play Store Standards & Compliance',
      subtitle: 'Data Safety Policy, AssetLinks, Privacy Policy & Account Deletion Portal',
      icon: Smartphone,
      color: '#10B981',
      onClick: () => {
        triggerHaptic('light');
        setSubView('PLAY_STORE_STANDARDS');
      }
    },
    {
      id: 'FEATURE_TOUR' as any,
      title: 'App Feature Tour & First-Time Guide',
      subtitle: 'Review Multi-Wallet Vaults, Split Expenses, Customer Bale\'da & Equb Engine',
      icon: HelpCircle,
      color: '#6366F1',
      onClick: () => {
        triggerHaptic('light');
        if (onReplayTour) {
          onReplayTour();
        } else {
          localStorage.removeItem(TUTORIAL_STORAGE_KEY);
          if (onNavigateTab) {
            onNavigateTab('dashboard');
          }
        }
      }
    },
    {
      id: 'CHAT' as any,
      title: 'Team Live Chat',
      subtitle: 'Real-time messages, channels & financial tags',
      icon: MessageSquare,
      color: '#00D4AA',
      onClick: () => {
        triggerHaptic('light');
        if (onNavigateTab) {
          onNavigateTab('chat');
        }
      }
    },
    {
      id: 'REPORTS' as SubViewType,
      title: 'Reports & P&L',
      subtitle: 'Cashflow, Balance Sheet, CSV Export',
      icon: BarChart3,
      color: '#3B82F6',
      onClick: () => {
        triggerHaptic('light');
        setSubView('REPORTS');
      }
    },
    {
      id: 'RECEIVABLES' as SubViewType,
      title: 'Receivables & Credit',
      subtitle: 'Customer IOUs & Cash Collections',
      icon: FileCheck,
      color: '#3B82F6',
      onClick: () => {
        triggerHaptic('light');
        setSubView('RECEIVABLES');
      }
    },
    {
      id: 'ASSETS' as SubViewType,
      title: 'Assets & Depreciation',
      subtitle: 'Equipment, Vehicles & Straight-line',
      icon: Briefcase,
      color: '#F5A623',
      onClick: () => {
        triggerHaptic('light');
        setSubView('ASSETS');
      }
    },
    {
      id: 'GOALS' as SubViewType,
      title: 'Savings Goals',
      subtitle: 'Expansion Targets & Dividend Reserves',
      icon: Target,
      color: '#22C55E',
      onClick: () => {
        triggerHaptic('light');
        setSubView('GOALS');
      }
    },
    {
      id: 'AUDIT_LOG' as SubViewType,
      title: 'Audit & Event Log',
      subtitle: 'Immutable Ledger Activity Log',
      icon: Shield,
      color: '#EC4899',
      superAdminOnly: true,
      onClick: () => {
        triggerHaptic('light');
        setSubView('AUDIT_LOG');
      }
    },
    {
      id: 'CALENDAR' as SubViewType,
      title: 'Financial Calendar',
      subtitle: 'Due Dates & Payment Schedules',
      icon: CalendarIcon,
      color: '#6366F1',
      onClick: () => {
        triggerHaptic('light');
        setSubView('CALENDAR');
      }
    }
  ];

  if (subView !== 'HUB') {
    return (
      <div className="space-y-4 pb-24">
        {/* Back navigation & Calendar toggle header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => {
              triggerHaptic('light');
              setSubView('HUB');
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-[#00D4AA] bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-[#00D4AA]/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to More Operations</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Quick Calendar Switch Pill */}
            <div className="flex items-center bg-slate-100 dark:bg-[#131926] p-1 rounded-xl border border-slate-200 dark:border-[#1E2D40] text-xs">
              <span className="text-[10px] font-bold text-slate-500 dark:text-[#8899BB] px-1.5 hidden xs:inline">
                Calendar:
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  if (typeof window !== 'undefined') localStorage.setItem('pluszone_calendar_user_choice', 'ETHIOPIAN');
                  onUpdateState(prev => ({ ...prev, calendarType: 'ETHIOPIAN' }));
                }}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  state.calendarType === 'ETHIOPIAN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🇪🇹 E.C.
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  if (typeof window !== 'undefined') localStorage.setItem('pluszone_calendar_user_choice', 'GREGORIAN');
                  onUpdateState(prev => ({ ...prev, calendarType: 'GREGORIAN' }));
                }}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  (state.calendarType || 'GREGORIAN') === 'GREGORIAN'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🌐 G.C.
              </button>
            </div>

            {onOpenHelp && (
              <button
                type="button"
                id="btn-page-help-more-subview"
                onClick={() => {
                  triggerHaptic('light');
                  onOpenHelp(subView);
                }}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#131926] dark:hover:bg-[#1a2336] border border-slate-200 dark:border-[#1E2D40] text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
                title="Operations Help (?)"
                aria-label="Help"
              >
                <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </button>
            )}
          </div>
        </div>

        {subView === 'PROFILE' && (
          <ProfileView currentUser={state.currentUser} onUpdateState={onUpdateState} />
        )}
        {subView === 'SETTINGS' && (
          <SettingsView
            state={state}
            onUpdateState={onUpdateState}
            initialTab={settingsInitialTab}
            onReplayTour={onReplayTour}
          />
        )}
        {subView === 'REPORTS' && <ReportsView state={state} onUpdateState={onUpdateState} />}
        {subView === 'RECEIVABLES' && (
          <ReceivablesView
            receivables={state.receivables}
            wallets={state.wallets}
            currentUser={state.currentUser}
            onCollect={(id, wId, amt) => {
              if (onCollectReceivable) {
                onCollectReceivable(id, wId, amt);
                return;
              }
              onUpdateState(prev => {
                const target = prev.receivables.find(r => r.id === id);
                if (!target) return prev;

                // Resolve valid wallet ID
                const targetWallet = prev.wallets.find(w => w.id === wId) || prev.wallets.find(w => w.isDefault) || prev.wallets[0];
                const resolvedWalletId = targetWallet?.id || wId || 'w-cash';

                const newCollected = (target.amountCollected || 0) + amt;
                const isFull = newCollected >= target.amountOwed;

                const updatedReceivables = prev.receivables.map(r =>
                  r.id === id
                    ? {
                        ...r,
                        amountCollected: newCollected,
                        status: isFull ? ('COLLECTED' as const) : ('OUTSTANDING' as const),
                        lastPaymentDate: new Date().toISOString()
                      }
                    : r
                );

                const newTx = {
                  id: `tx-rcv-${id}-${Date.now()}`,
                  date: new Date().toISOString(),
                  type: 'INCOME' as const,
                  amount: amt,
                  walletId: resolvedWalletId,
                  category: 'Daily Income / Collected',
                  description: `Collected from ${target.customerName}`,
                  creatorId: prev.currentUser.id,
                  creatorName: prev.currentUser.name,
                  branch: prev.currentUser.branch,
                  refType: 'RECEIVABLE' as const,
                  refId: id
                };

                const newAuditLog = {
                  id: `aud-${id}-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  actorId: prev.currentUser.id,
                  actorName: prev.currentUser.name,
                  action: 'COLLECT_RECEIVABLE',
                  entity: 'Receivable',
                  entityId: id,
                  diffAfter: {
                    amountCollected: amt,
                    totalCollected: newCollected,
                    walletId: resolvedWalletId,
                    walletName: targetWallet?.name || 'Wallet',
                    customerName: target.customerName,
                    isFullyPaid: isFull
                  },
                  branch: prev.currentUser.branch
                };

                return {
                  ...prev,
                  receivables: updatedReceivables,
                  transactions: [newTx, ...prev.transactions],
                  auditLogs: [newAuditLog, ...(prev.auditLogs || [])]
                };
              });
            }}
            onUpdate={(id, updates) => {
              onUpdateState(prev => {
                const target = prev.receivables.find(r => r.id === id);
                if (!target) return prev;
                const updated = {
                  ...prev,
                  receivables: prev.receivables.map(r => r.id === id ? { ...r, ...updates } : r),
                  auditLogs: [
                    {
                      id: `aud-${Date.now()}`,
                      timestamp: new Date().toISOString(),
                      actorId: prev.currentUser.id,
                      actorName: prev.currentUser.name,
                      action: 'UPDATE_RECEIVABLE',
                      entity: 'Receivable',
                      entityId: id,
                      diffBefore: target,
                      diffAfter: { ...target, ...updates },
                      branch: prev.currentUser.branch
                    },
                    ...(prev.auditLogs || [])
                  ]
                };
                saveStateToStorage(updated);
                syncStateToFirebaseNow(updated);
                return updated;
              });
            }}
            onDelete={(id) => {
              onUpdateState(prev => {
                const target = prev.receivables.find(r => r.id === id);
                if (!target) return prev;
                const updated = {
                  ...prev,
                  receivables: prev.receivables.filter(r => r.id !== id),
                  auditLogs: [
                    {
                      id: `aud-${Date.now()}`,
                      timestamp: new Date().toISOString(),
                      actorId: prev.currentUser.id,
                      actorName: prev.currentUser.name,
                      action: 'DELETE_RECEIVABLE',
                      entity: 'Receivable',
                      entityId: id,
                      diffAfter: { deleted: true, customerName: target.customerName },
                      branch: prev.currentUser.branch
                    },
                    ...(prev.auditLogs || [])
                  ]
                };
                saveStateToStorage(updated);
                syncStateToFirebaseNow(updated);
                return updated;
              });
            }}
            onCreate={(data) => {
              onUpdateState(prev => {
                const created: Receivable = {
                  ...data,
                  id: `rcv-${Date.now()}`,
                  walletId: data.walletId,
                  amountCollected: 0,
                  status: 'OUTSTANDING',
                  createdDate: new Date().toISOString()
                };
                const updated = {
                  ...prev,
                  receivables: [created, ...(prev.receivables || [])],
                  auditLogs: [
                    {
                      id: `aud-${Date.now()}`,
                      timestamp: new Date().toISOString(),
                      actorId: prev.currentUser.id,
                      actorName: prev.currentUser.name,
                      action: 'CREATE_RECEIVABLE',
                      entity: 'Receivable',
                      entityId: created.id,
                      diffAfter: created,
                      branch: prev.currentUser.branch
                    },
                    ...(prev.auditLogs || [])
                  ]
                };
                saveStateToStorage(updated);
                syncStateToFirebaseNow(updated);
                return updated;
              });
            }}
          />
        )}
        {subView === 'CATEGORIES' && (
          <SettingsView
            state={state}
            onUpdateState={onUpdateState}
            initialTab="CATEGORIES"
            onReplayTour={onReplayTour}
          />
        )}
        {subView === 'USERS' && (
          <SettingsView
            state={state}
            onUpdateState={onUpdateState}
            initialTab="PARTNERS"
            onReplayTour={onReplayTour}
          />
        )}
        {subView === 'RECURRING' && (
          <SettingsView
            state={state}
            onUpdateState={onUpdateState}
            initialTab="RECURRING"
            onReplayTour={onReplayTour}
          />
        )}
        {subView === 'ASSETS' && <AssetsView assets={state.assets} wallets={state.wallets} />}
        {subView === 'GOALS' && (
          <GoalsView
            goals={state.goals || []}
            onUpdateGoals={(newGoals) => {
              onUpdateState((prev) => {
                const updated = { ...prev, goals: newGoals };
                saveStateToStorage(updated);
                syncStateToFirebaseNow(updated);
                return updated;
              });
            }}
          />
        )}
        {subView === 'AUDIT_LOG' && <AuditLogView auditLogs={state.auditLogs} />}
        {subView === 'CALENDAR' && (
          <CalendarView
            equbs={state.equbs}
            loans={state.loans}
            recurring={state.recurring}
            receivables={state.receivables}
            transactions={state.transactions}
            calendarType={state.calendarType || 'GREGORIAN'}
            onToggleCalendarType={(type) => {
              if (typeof window !== 'undefined') localStorage.setItem('pluszone_calendar_user_choice', type);
              onUpdateState(prev => ({ ...prev, calendarType: type }));
            }}
          />
        )}
        {subView === 'BACKUP' && (
          <BackupView state={state} onRestore={newState => onUpdateState(() => newState)} />
        )}
        {subView === 'SECURITY' && (
          <SecuritySystemView state={state} />
        )}
        {subView === 'FINANCIAL_SYSTEM' && (
          <AdvancedFinancialSystem state={state} />
        )}
        {subView === 'PLAY_STORE_STANDARDS' && (
          <PlayStoreStandardsView state={state} />
        )}
        {subView === 'FRAUD_PREVENTION' && (
          <PaymentFraudPreventionView state={state} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Top Banner & Calendar System Switcher */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-[#131926] dark:via-[#1a2336] dark:to-[#131926] border border-indigo-500/30 rounded-2xl p-4 text-white shadow-md relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 font-extrabold shrink-0">
            <CalendarIcon className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">ERP Operations Hub</h2>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono font-bold border border-indigo-400/30">
                {(state.calendarType || 'GREGORIAN') === 'GREGORIAN' ? '🌐 Gregorian G.C.' : '🇪🇹 Ethiopian E.C.'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">Active Calendar System for Equbs, Obligations & Statements</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {/* Toggle Switch */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                if (typeof window !== 'undefined') localStorage.setItem('pluszone_calendar_user_choice', 'ETHIOPIAN');
                onUpdateState(prev => ({ ...prev, calendarType: 'ETHIOPIAN' }));
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                state.calendarType === 'ETHIOPIAN'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md border border-emerald-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🇪🇹 Ethiopian (E.C.)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                if (typeof window !== 'undefined') localStorage.setItem('pluszone_calendar_user_choice', 'GREGORIAN');
                onUpdateState(prev => ({ ...prev, calendarType: 'GREGORIAN' }));
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                (state.calendarType || 'GREGORIAN') === 'GREGORIAN'
                  ? 'bg-indigo-600 text-white shadow-md border border-indigo-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🌐 Gregorian (G.C.)</span>
            </button>
          </div>

          {onOpenHelp && (
            <button
              type="button"
              id="btn-page-help-more-hub"
              onClick={() => {
                triggerHaptic('light');
                onOpenHelp('HUB');
              }}
              className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-indigo-400 transition-colors cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
              title="More Hub Help (?)"
              aria-label="Help"
            >
              <HelpCircle className="w-4 h-4 text-indigo-400" />
            </button>
          )}
        </div>
      </div>

      {/* User Account Profile Card */}
      <div
        id="tour-more-hub-profile"
        data-tour="more-hub-profile"
        onClick={() => {
          triggerHaptic('light');
          setSubView('PROFILE');
        }}
        className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] hover:border-[#00D4AA]/60 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all shadow-sm hover:bg-slate-50 dark:hover:bg-[#1C2333] group"
      >
        <div className="flex items-center gap-3">
          {state.currentUser.avatarUrl ? (
            <img
              src={state.currentUser.avatarUrl}
              alt={state.currentUser.name}
              className="w-12 h-12 rounded-xl object-cover border-2 border-[#00D4AA]/40 group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm border border-[#00D4AA]/40 group-hover:scale-105 transition-transform">
              {state.currentUser.name ? state.currentUser.name.substring(0, 2).toUpperCase() : 'US'}
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {state.currentUser.name || 'User Account'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-0.5">
              {state.currentUser.email || 'Manage profile photo, password & account details'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold text-[#00D4AA]">
          <span className="hidden sm:inline">Manage Account</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* Operational Modules Section */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-500 dark:text-[#8899BB] uppercase tracking-wider px-1">
          Business Operations & Reporting
        </h3>
        <div id="tour-more-hub-grid" data-tour="more-hub-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {operationalTiles.map((tile) => {
            const Icon = tile.icon;
            const isRestricted = tile.superAdminOnly && state.currentUser.role === 'Partner';

            return (
              <div
                key={tile.id}
                id={tile.id === 'SECURITY' ? 'tour-more-hub-security' : undefined}
                data-tour={tile.id === 'SECURITY' ? 'more-hub-security' : undefined}
                onClick={() => {
                  if (isRestricted) {
                    alert('Audit log requires Admin or SuperAdmin permissions.');
                    return;
                  }
                  tile.onClick();
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isRestricted
                    ? 'bg-slate-100/50 dark:bg-[#131926]/50 border-slate-200 dark:border-[#1E2D40] opacity-50 cursor-not-allowed'
                    : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-[#1E2D40] hover:border-[#00D4AA]/50 hover:bg-slate-50 dark:hover:bg-[#1C2333] shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${tile.color}20`, color: tile.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {tile.title}
                      {tile.superAdminOnly && (
                        <span className="text-[9px] bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.2 rounded font-mono">
                          ADMIN
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-[#8899BB] mt-0.5">{tile.subtitle}</p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-[#8899BB]" />
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Assistant Banner Launcher */}
      <div
        id="tour-ai-insights-tool"
        data-tour="ai-insights-tool"
        onClick={() => {
          triggerHaptic('medium');
          onOpenAiAssistant();
        }}
        className="p-4 rounded-2xl bg-gradient-to-r from-[#00D4AA]/15 via-[#3B82F6]/15 to-[#A78BFA]/15 border border-[#00D4AA]/35 hover:border-[#00D4AA]/70 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00D4AA]/20 text-[#00D4AA] flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-slate-900 dark:text-white">
                PlusZone AI CFO & Decision Simulator
              </h4>
              <span className="text-[9px] bg-[#00D4AA]/20 text-[#00D4AA] px-1.5 py-0.2 rounded font-mono font-black">
                PREDICTIVE AI
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-[#8899BB] mt-0.5">
              Simulate What-If decisions, forecast 365-day cashflow, and model fixed constants & consequences
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#00D4AA] group-hover:translate-x-1 transition-transform" />
      </div>

      {/* System Settings Tile (at the bottom of the page) - SuperAdmin Only */}
      {state.currentUser.role === 'SuperAdmin' && (
        <div
          id="tour-backup-export"
          data-tour="backup-export"
          onClick={() => openSettings(null)}
          className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#00D4AA]/40 hover:border-[#00D4AA] rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00D4AA]/20 via-[#3B82F6]/20 to-[#A78BFA]/20 text-[#00D4AA] flex items-center justify-center border border-[#00D4AA]/30 group-hover:scale-105 transition-transform">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">System Settings</h3>
                <span className="text-[9px] bg-[#00D4AA]/20 text-[#00D4AA] px-1.5 py-0.2 rounded font-mono font-bold">
                  CONFIGURATIONS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-0.5">
                Categories, Partners & Roles, Recurring Bills & Data Backup
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#00D4AA] group-hover:translate-x-1 transition-transform" />
        </div>
      )}

      {/* Logout Action Tile */}
      {onLogout && (
        <div
          onClick={() => {
            triggerHaptic('heavy');
            onLogout();
          }}
          className="bg-rose-500/10 hover:bg-rose-500/20 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 border border-rose-300 dark:border-rose-900/60 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/30 group-hover:scale-105 transition-transform">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400">Sign Out / Log Out</h3>
              <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                Log out of partner session ({state.currentUser.name})
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-rose-500 group-hover:translate-x-1 transition-transform" />
        </div>
      )}
    </div>
  );
};
