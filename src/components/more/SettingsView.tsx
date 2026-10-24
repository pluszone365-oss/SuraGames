import React, { useState } from 'react';
import { Tag, Users, Repeat, Database, Settings, ArrowLeft, ChevronRight, ShieldAlert, Sparkles, RotateCcw, Play } from 'lucide-react';
import { ERPState } from '../../types';
import { triggerHaptic } from '../../lib/haptics';

import { CategoriesView } from './CategoriesView';
import { UsersView } from './UsersView';
import { RecurringView } from './RecurringView';
import { BackupView } from './BackupView';
import { SecuritySystemView } from './SecuritySystemView';

export type SettingsTabType = 'CATEGORIES' | 'PARTNERS' | 'RECURRING' | 'BACKUP' | 'SECURITY';

interface SettingsViewProps {
  state: ERPState;
  onUpdateState: (fn: (prev: ERPState) => ERPState) => void;
  initialTab?: SettingsTabType | null;
  onReplayTour?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdateState,
  initialTab = null,
  onReplayTour
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabType | null>(initialTab);

  // Strict Privilege Check: Only SuperAdmin can see System Settings
  if (state.currentUser.role !== 'SuperAdmin') {
    return (
      <div className="bg-white dark:bg-[#131926] border border-rose-300 dark:border-rose-900/50 rounded-2xl p-6 sm:p-8 space-y-4 text-center shadow-lg animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 mx-auto flex items-center justify-center shadow-md">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            System Settings Access Restricted
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#8899BB] leading-relaxed">
            Only authorized administrator accounts have privilege to view or adjust System Settings, account access, category configs, and data backups.
          </p>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] rounded-xl text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto space-y-1">
          <p className="font-semibold text-slate-900 dark:text-white">Your Current Account:</p>
          <p className="text-[#00D4AA] font-mono font-bold">{state.currentUser.name}</p>
          <p className="text-[10px] text-slate-400">Branch: {state.currentUser.branch}</p>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: 'CATEGORIES' as SettingsTabType,
      label: 'Transaction Categories',
      subtitle: 'Income & Expense tags and custom classification',
      icon: Tag,
      color: '#00D4AA',
      count: `${state.categories.length} categories`
    },
    {
      id: 'PARTNERS' as SettingsTabType,
      label: 'Partners & Roles',
      subtitle: 'Users, roles, branches & privilege access levels',
      icon: Users,
      color: '#FB923C',
      count: `${state.users.length} partners`,
      superAdminOnly: true
    },
    {
      id: 'RECURRING' as SettingsTabType,
      label: 'Recurring Bills & Schedules',
      subtitle: 'Rent, telecom & automated bill payment schedules',
      icon: Repeat,
      color: '#A78BFA',
      count: `${state.recurring.length} active bills`
    },
    {
      id: 'BACKUP' as SettingsTabType,
      label: 'Data Backup & Import',
      subtitle: 'JSON Snapshot, automated Monday backups & consensus restore',
      icon: Database,
      color: '#64748B',
      count: 'Consensus JSON'
    },
    {
      id: 'SECURITY' as SettingsTabType,
      label: 'Advanced Security & Threat Shield',
      subtitle: '2FA, Master PIN, WebAuthn Passkeys, SOC Threat Radar & Device Manager',
      icon: ShieldAlert,
      color: '#00D4AA',
      count: 'SOC Center'
    }
  ];

  // 1. Settings Menu List Landing Page
  if (activeTab === null) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#00D4AA]/20 via-[#3B82F6]/20 to-[#A78BFA]/20 text-[#00D4AA] flex items-center justify-center border border-[#00D4AA]/30">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                System Settings & Configurations
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-0.5">
                Select a master configuration module to manage system settings and data
              </p>
            </div>
          </div>

          {/* Setting Items List */}
          <div className="space-y-2.5 pt-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <div
                  key={tab.id}
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab(tab.id);
                  }}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] hover:border-[#00D4AA] hover:bg-slate-100 dark:hover:bg-[#1C2333] transition-all cursor-pointer flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: `${tab.color}20`,
                        color: tab.color
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-[#00D4AA] transition-colors flex items-center gap-2 truncate">
                        {tab.label}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-0.5 truncate">{tab.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="hidden sm:inline-block text-xs font-mono font-bold text-slate-600 dark:text-[#8899BB] bg-white dark:bg-[#131926] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#1E2D40]">
                      {tab.count}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-400 dark:text-[#8899BB] group-hover:text-teal-600 dark:group-hover:text-[#00D4AA] group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Feature Walkthrough / Replay Tour */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-[#1E2D40]">
            <div
              id="btn-replay-tour"
              onClick={() => {
                triggerHaptic('medium');
                if (onReplayTour) {
                  onReplayTour();
                }
              }}
              className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-teal-500/10 border border-indigo-200 dark:border-indigo-800/60 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-sm"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <span>Replay Onboarding Tour</span>
                    <span className="text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                      8 Spotlight Steps
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-0.5">
                    Take an interactive walkthrough of PlusZone's core features anytime
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 sm:self-auto self-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('medium');
                    if (onReplayTour) {
                      onReplayTour();
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Replay Tour</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Dedicated Setting View Page with Back Navigation
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Dedicated Page Navigation Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-3 shadow-sm">
        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveTab(null);
          }}
          className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-[#00D4AA] bg-emerald-500/10 dark:bg-[#00D4AA]/10 border border-emerald-500/30 dark:border-[#00D4AA]/30 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-emerald-500/20 dark:hover:bg-[#00D4AA]/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to System Settings</span>
        </button>

        {/* Quick Switch Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0A0E1A] p-1 rounded-xl border border-slate-200 dark:border-[#1E2D40]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                triggerHaptic('light');
                setActiveTab(t.id);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-white dark:bg-[#1C2333] text-teal-600 dark:text-[#00D4AA] border border-slate-200 dark:border-[#00D4AA]/30 shadow-sm'
                  : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Setting View Content */}
      <div className="animate-fadeIn">
        {activeTab === 'CATEGORIES' && (
          <CategoriesView categories={state.categories} onUpdateState={onUpdateState} />
        )}

        {activeTab === 'PARTNERS' && (
          <UsersView
            users={state.users}
            currentUser={state.currentUser}
            onUpdateState={onUpdateState}
            onSwitchUser={(user) => onUpdateState((prev) => ({ ...prev, currentUser: user }))}
          />
        )}

        {activeTab === 'RECURRING' && (
          <RecurringView
            recurring={state.recurring}
            wallets={state.wallets}
            categories={state.categories}
            onUpdateState={onUpdateState}
          />
        )}

        {activeTab === 'BACKUP' && (
          <BackupView state={state} onRestore={(newState) => onUpdateState(() => newState)} />
        )}

        {activeTab === 'SECURITY' && (
          <SecuritySystemView state={state} />
        )}
      </div>
    </div>
  );
};

