import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Sun, Moon, ShieldCheck, ChevronDown, Bell, CheckCircle2, RefreshCw, LogOut, Gamepad2, Send, Sparkles, X, CheckCheck } from 'lucide-react';
import { UserProfile, NavTab } from '../../types';
import { triggerHaptic } from '../../lib/haptics';
import { requestNotificationPermission, sendExternalNotification } from '../../lib/notifications';
import { AppLogo } from '../common/AppLogo';

export interface HeaderNotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'HIGH' | 'MEDIUM' | 'INFO';
  time: string;
  timestamp?: number;
  actionTab?: NavTab;
}

interface HeaderProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSwitchUser: (user: UserProfile) => void;
  onLogout?: () => void;
  onLockSession?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  hideBalances: boolean;
  onToggleHideBalances: () => void;
  onNavigateTab?: (tab: NavTab) => void;
  notifications?: HeaderNotificationItem[];
  onDismissNotification?: (id: string) => void;
  onClearAllNotifications?: () => void;
  lastRefreshedAt?: Date;
  isRefreshing?: boolean;
  autoRefreshEnabled?: boolean;
  calendarType?: 'ETHIOPIAN' | 'GREGORIAN';
  onToggleCalendarType?: (type: 'ETHIOPIAN' | 'GREGORIAN') => void;
  onToggleAutoRefresh?: () => void;
  onManualRefresh?: () => void;
  unreadChatCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  onLogout,
  onLockSession,
  theme,
  onToggleTheme,
  hideBalances,
  onToggleHideBalances,
  onNavigateTab,
  notifications = [],
  onDismissNotification,
  onClearAllNotifications,
  lastRefreshedAt,
  isRefreshing = false,
  autoRefreshEnabled = true,
  calendarType = 'GREGORIAN',
  onToggleCalendarType,
  onToggleAutoRefresh,
  onManualRefresh,
  unreadChatCount = 0
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [pushSentMessage, setPushSentMessage] = useState<string | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, []);

  const handleTestExternalPushNotification = async () => {
    triggerHaptic('heavy');
    const perm = await requestNotificationPermission();
    if (perm === 'granted') {
      const ok = await sendExternalNotification('PlusZone Financial Alert ⚡', {
        body: `Hello ${currentUser.name}! Push notifications outside the app are ACTIVE. Real-time transaction alerts will be delivered to your device.`,
        tag: 'test-push-alert'
      });
      if (ok) {
        setPushSentMessage('✓ System push notification sent outside the app!');
      } else {
        setPushSentMessage('✓ System push notification dispatched to your device');
      }
    } else {
      setPushSentMessage('⚠️ Notification permission denied in browser.');
    }

    setTimeout(() => {
      setPushSentMessage(null);
    }, 4000);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0A0E1A]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-[#1E2D40] px-4 py-3 transition-colors">
      <div className="max-w-6xl mx-auto flex items-center justify-between w-full">
        {/* Left: Brand logo */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => {
              triggerHaptic('light');
              if (onNavigateTab) onNavigateTab('dashboard');
            }}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
            title="Return to Dashboard"
          >
            <AppLogo size="md" className="group-hover:scale-105 transition-transform" />
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-[#F0F4FF] leading-tight group-hover:text-emerald-500 dark:group-hover:text-[#00D4AA] transition-colors">
                Plus Game Zone
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Financial ERP</p>
            </div>
          </div>
        </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">

        {/* Calendar Switcher Pill */}
        {onToggleCalendarType && (
          <div className="flex items-center bg-slate-100 dark:bg-[#1C2333] p-1 rounded-xl border border-slate-200 dark:border-[#1E2D40] text-xs">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onToggleCalendarType('ETHIOPIAN');
              }}
              title="Switch to Ethiopian Calendar (E.C.)"
              className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                calendarType === 'ETHIOPIAN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🇪🇹 E.C.
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onToggleCalendarType('GREGORIAN');
              }}
              title="Switch to Gregorian Calendar (G.C.)"
              className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                calendarType === 'GREGORIAN'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🌐 G.C.
            </button>
          </div>
        )}

        {/* Hide Amounts Toggle */}
        <button
          onClick={() => {
            triggerHaptic('light');
            onToggleHideBalances();
          }}
          title={hideBalances ? 'Show Balances' : 'Hide Balances'}
          className="p-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-[#F0F4FF] transition-colors cursor-pointer"
        >
          {hideBalances ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4 text-emerald-600 dark:text-[#00D4AA]" />}
        </button>

        {/* Notification Bell Icon */}
        <div className="relative" ref={notifRef}>
          {(() => {
            const hasHigh = notifications.some(n => n.type === 'HIGH');
            const hasMedium = notifications.some(n => n.type === 'MEDIUM');
            const bellColor = hasHigh ? 'text-rose-500' : hasMedium ? 'text-amber-500' : 'text-emerald-600 dark:text-[#00D4AA]';
            const badgeBg = hasHigh ? 'bg-rose-500 text-white' : hasMedium ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 dark:bg-[#00D4AA] text-white dark:text-[#0A0E1A]';

            return (
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setShowNotifMenu(!showNotifMenu);
                }}
                title="Operational Notifications & Alerts"
                className="p-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-[#F0F4FF] transition-colors cursor-pointer relative"
              >
                <Bell className={`w-4 h-4 ${bellColor}`} />
                {notifications.length > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 font-black text-[9px] rounded-full flex items-center justify-center border border-white dark:border-[#0A0E1A] animate-pulse ${badgeBg}`}>
                    {notifications.length}
                  </span>
                )}
              </button>
            );
          })()}

          {/* Notifications Dropdown Panel */}
          {showNotifMenu && (
            <div className="absolute top-11 right-0 bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#2A3B53] rounded-2xl shadow-2xl p-3.5 w-72 sm:w-88 z-50 animate-fadeIn space-y-2.5 text-slate-900 dark:text-white">
              {(() => {
                const hasHigh = notifications.some(n => n.type === 'HIGH');
                const hasMedium = notifications.some(n => n.type === 'MEDIUM');
                const headerColor = hasHigh ? 'text-rose-500 dark:text-rose-400' : hasMedium ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-[#00D4AA]';
                const headerBadge = hasHigh
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-600 dark:text-white border-rose-300 dark:border-rose-400 font-bold'
                  : hasMedium
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-500 dark:text-slate-950 border-amber-300 dark:border-amber-400 font-bold'
                  : 'bg-emerald-100 text-emerald-900 dark:bg-[#00D4AA] dark:text-slate-950 border-emerald-300 dark:border-[#00D4AA] font-bold';

                return (
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2A3B53] pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Bell className={`w-4 h-4 ${headerColor}`} />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">Operational Alerts</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-mono border px-2 py-0.5 rounded-full ${headerBadge}`}>
                        {notifications.length} Active
                      </span>
                      {notifications.length > 0 && onClearAllNotifications && (
                        <button
                          onClick={() => {
                            triggerHaptic('medium');
                            onClearAllNotifications();
                            setShowNotifMenu(false);
                          }}
                          className="text-[10px] font-bold text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Clear all seen notifications"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Clear All</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                {notifications.map(n => {
                  const isHigh = n.type === 'HIGH';
                  const isMedium = n.type === 'MEDIUM';

                  const cardBg = isHigh
                    ? 'bg-rose-50/90 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/60 hover:border-rose-500 dark:hover:border-rose-400'
                    : isMedium
                    ? 'bg-amber-50/90 dark:bg-amber-950/80 border-amber-300 dark:border-amber-500/60 hover:border-amber-500 dark:hover:border-amber-400'
                    : 'bg-slate-50 dark:bg-[#1C2538] border-slate-200 dark:border-[#00D4AA]/50 hover:border-emerald-500 dark:hover:border-[#00D4AA]';

                  const tagStyle = isHigh
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-500 dark:text-white border-rose-300 dark:border-rose-400'
                    : isMedium
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-400 dark:text-slate-950 border-amber-300 dark:border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 dark:bg-[#00D4AA] dark:text-slate-950 border-emerald-300 dark:border-[#00D4AA]';

                  const tagText = isHigh ? 'CRITICAL' : isMedium ? 'DUE' : 'NEW';

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        triggerHaptic('light');
                        if (onDismissNotification) {
                          onDismissNotification(n.id);
                        }
                        if (n.actionTab && onNavigateTab) {
                          onNavigateTab(n.actionTab);
                        }
                        setShowNotifMenu(false);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all shadow-sm relative group ${cardBg}`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <h5 className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight truncate">{n.title}</h5>
                          <span className={`text-[8px] font-mono font-extrabold px-1.5 py-0.2 rounded-full border shrink-0 ${tagStyle}`}>
                            {tagText}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-mono font-medium text-slate-500 dark:text-slate-400">{n.time}</span>
                          {onDismissNotification && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('light');
                                onDismissNotification(n.id);
                              }}
                              className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              title="Mark as seen / Dismiss"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200 mt-1 leading-snug">{n.message}</p>
                    </div>
                  );
                })}

                {notifications.length === 0 && (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-300 space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 dark:text-[#00D4AA] mx-auto opacity-90" />
                    <p className="text-xs font-semibold">No pending notifications.</p>
                  </div>
                )}
              </div>

              {/* Action: Dispatch Test External Push Notification */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#2A3B53] space-y-1">
                <button
                  onClick={handleTestExternalPushNotification}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center justify-center gap-2 shadow cursor-pointer transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Push Alert Outside App</span>
                </button>
                {pushSentMessage && (
                  <p className="text-[10px] text-center font-extrabold text-emerald-600 dark:text-[#00D4AA] animate-fadeIn">
                    {pushSentMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => {
            triggerHaptic('light');
            onToggleTheme();
          }}
          title="Toggle Dark/Light Mode"
          className="p-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-[#F0F4FF] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>
    </div>
  </header>
  );
};
