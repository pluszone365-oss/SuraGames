import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Sparkles,
  Sliders,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Calendar,
  Layers
} from 'lucide-react';
import { ERPState, ShopOperatingHours } from '../../types';
import {
  formatETB,
  getShopStatusInfo,
  calculateTodayShiftMetrics,
  ShopStatusInfo
} from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';

interface ShopOperatingHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: ERPState;
  onUpdateShopHours?: (updated: ShopOperatingHours) => void;
}

export const ShopOperatingHoursModal: React.FC<ShopOperatingHoursModalProps> = ({
  isOpen,
  onClose,
  state,
  onUpdateShopHours
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [openTimeGMT, setOpenTimeGMT] = useState(state.shopHours?.openTimeGMT || '06:00');
  const [closeTimeGMT, setCloseTimeGMT] = useState(state.shopHours?.closeTimeGMT || '18:00');
  const [closingReason, setClosingReason] = useState(state.shopHours?.closingReason || '');

  // Tick every 10 seconds for real-time live clock
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const statusInfo: ShopStatusInfo = getShopStatusInfo(state.shopHours, currentTime);
  const shiftMetrics = calculateTodayShiftMetrics(state.transactions, state.shopHours, currentTime);

  const isSuperAdmin = state.currentUser.role === 'SuperAdmin' || state.currentUser.role === 'Admin';

  const handleSetOverride = (override: 'OPEN' | 'CLOSED' | null) => {
    triggerHaptic('medium');
    if (!onUpdateShopHours) return;
    const updated: ShopOperatingHours = {
      ...(state.shopHours || {
        openTimeGMT: '06:00',
        closeTimeGMT: '18:00',
        autoStatus: true
      }),
      autoStatus: override === null,
      manualOverrideStatus: override,
      closingReason: override === 'CLOSED' ? (closingReason || 'Manual shop closure') : undefined
    };
    onUpdateShopHours(updated);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('success');
    if (!onUpdateShopHours) return;
    const updated: ShopOperatingHours = {
      ...(state.shopHours || {
        autoStatus: true,
        manualOverrideStatus: null
      }),
      openTimeGMT,
      closeTimeGMT,
      closingReason: closingReason || undefined
    };
    onUpdateShopHours(updated);
    setShowEditSchedule(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#111622] border border-slate-200 dark:border-[#1E2D40] rounded-3xl shadow-2xl overflow-hidden animate-scaleUp flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-[#1C2638] bg-slate-50/50 dark:bg-[#131926]/50">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-xs ${
              statusInfo.isOpen
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                : 'bg-rose-500 text-white shadow-rose-500/20'
            }`}>
              {statusInfo.isOpen ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Shop Operating Hours & Shift Status</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#8899BB] font-medium">
                Plus Game Zone • Standard 12-Hour Daily Operating Window
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2333] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">

          {/* 1. Live Operating Status Hero Banner */}
          <div className={`p-4 rounded-2xl border transition-all ${
            statusInfo.isOpen
              ? 'bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-50 dark:from-emerald-500/15 dark:via-teal-500/5 dark:to-[#131926] border-emerald-500/30'
              : 'bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-slate-50 dark:from-rose-500/15 dark:via-amber-500/5 dark:to-[#131926] border-rose-500/30'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    statusInfo.isOpen
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'bg-rose-500 text-white shadow-xs'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                    {statusInfo.isOpen ? 'SHOP CURRENTLY OPEN' : 'SHOP CURRENTLY CLOSED'}
                  </span>
                  {statusInfo.isOverridden && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 px-2 py-0.5 rounded-full">
                      Manual Override Active
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {statusInfo.countdownText}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-[#8899BB] mt-0.5">
                  Operating Window: <span className="font-bold text-slate-900 dark:text-white">6:00 AM – 6:00 PM GMT</span>
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#8899BB] block">
                  Current GMT
                </span>
                <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  {statusInfo.currentGmtTimeStr}
                </span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-[#00D4AA] block mt-0.5">
                  {statusInfo.currentEatTimeStr}
                </span>
              </div>
            </div>

            {/* Timezone Translation Grid */}
            <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-[#1E2D40] grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-white/70 dark:bg-[#1A2232]/80 border border-slate-200/60 dark:border-[#223147]">
                <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-[#8899BB] block">
                  Global Standard (GMT)
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-xs mt-0.5 block">
                  06:00 – 18:00
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">6 AM – 6 PM GMT</span>
              </div>

              <div className="p-2 rounded-xl bg-white/70 dark:bg-[#1A2232]/80 border border-slate-200/60 dark:border-[#223147]">
                <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-[#8899BB] block">
                  East Africa (EAT)
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-[#00D4AA] text-xs mt-0.5 block">
                  09:00 – 21:00
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Addis Ababa Time</span>
              </div>

              <div className="p-2 rounded-xl bg-white/70 dark:bg-[#1A2232]/80 border border-slate-200/60 dark:border-[#223147]">
                <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-[#8899BB] block">
                  Ethiopian Clock (ሰዓት)
                </span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs mt-0.5 block">
                  3:00 – 3:00
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">ጠዋት እስከ ማታ</span>
              </div>
            </div>
          </div>

          {/* 2. Today's Day Shift Performance Breakdown (06:00 - 18:00 GMT) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#141B2A] border border-slate-200/80 dark:border-[#1E2D40] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Today's Day Shift Ledger (06:00 – 18:00 GMT)
                </h4>
              </div>
              <span className="text-[10px] font-mono font-bold bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#243046] px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300">
                {shiftMetrics.openShiftTxCount} Shift Txs
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A2232] border border-slate-200/60 dark:border-[#223147]">
                <span className="text-[10px] text-slate-500 dark:text-[#8899BB] flex items-center gap-1 font-medium">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  Shift Inflow
                </span>
                <p className="text-sm font-mono font-black text-emerald-600 dark:text-[#00D4AA] mt-1">
                  {formatETB(shiftMetrics.openShiftIncome)}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A2232] border border-slate-200/60 dark:border-[#223147]">
                <span className="text-[10px] text-slate-500 dark:text-[#8899BB] flex items-center gap-1 font-medium">
                  <TrendingDown className="w-3 h-3 text-rose-500" />
                  Shift Expenses
                </span>
                <p className="text-sm font-mono font-black text-rose-600 dark:text-rose-400 mt-1">
                  {formatETB(shiftMetrics.openShiftExpenses)}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A2232] border border-slate-200/60 dark:border-[#223147]">
                <span className="text-[10px] text-slate-500 dark:text-[#8899BB] flex items-center gap-1 font-medium">
                  <DollarSign className="w-3 h-3 text-indigo-500" />
                  Net Operating
                </span>
                <p className={`text-sm font-mono font-black mt-1 ${
                  shiftMetrics.openShiftNet >= 0
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formatETB(shiftMetrics.openShiftNet)}
                </p>
              </div>
            </div>

            {/* After-Hours Alert if any occurred */}
            {shiftMetrics.afterHoursTxCount > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <Moon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>After-Hours Transactions recorded outside 6 AM - 6 PM GMT:</span>
                </span>
                <span className="font-mono font-bold">
                  {shiftMetrics.afterHoursTxCount} txs • {formatETB(shiftMetrics.afterHoursIncome - shiftMetrics.afterHoursExpenses)}
                </span>
              </div>
            )}
          </div>

          {/* 3. Manual Shift Override & Admin Controls */}
          {isSuperAdmin && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Shift Mode & Override Controls
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditSchedule(prev => !prev)}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                >
                  {showEditSchedule ? 'Cancel' : 'Edit Default Hours'}
                </button>
              </div>

              {/* Mode Selection Chips */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSetOverride(null)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    state.shopHours?.manualOverrideStatus == null
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-[#1A2232] text-slate-700 dark:text-[#8899BB] border-slate-200 dark:border-[#223147] hover:border-indigo-400'
                  }`}
                >
                  <span className="text-xs font-bold block">Auto Mode</span>
                  <span className="text-[9px] opacity-80 block mt-0.5">6 AM – 6 PM GMT</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetOverride('OPEN')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    state.shopHours?.manualOverrideStatus === 'OPEN'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-[#1A2232] text-slate-700 dark:text-[#8899BB] border-slate-200 dark:border-[#223147] hover:border-emerald-400'
                  }`}
                >
                  <span className="text-xs font-bold block">Force Open</span>
                  <span className="text-[9px] opacity-80 block mt-0.5">Late Night Shift</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetOverride('CLOSED')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    state.shopHours?.manualOverrideStatus === 'CLOSED'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-[#1A2232] text-slate-700 dark:text-[#8899BB] border-slate-200 dark:border-[#223147] hover:border-rose-400'
                  }`}
                >
                  <span className="text-xs font-bold block">Force Closed</span>
                  <span className="text-[9px] opacity-80 block mt-0.5">Maintenance / Holiday</span>
                </button>
              </div>

              {/* Edit Schedule Form */}
              {showEditSchedule && (
                <form onSubmit={handleSaveSchedule} className="pt-3 border-t border-slate-100 dark:border-[#1E2D40] space-y-3 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                        Opens (GMT)
                      </label>
                      <input
                        type="time"
                        value={openTimeGMT}
                        onChange={e => setOpenTimeGMT(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#1A2232] border border-slate-200 dark:border-[#223147] rounded-xl p-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                        Closes (GMT)
                      </label>
                      <input
                        type="time"
                        value={closeTimeGMT}
                        onChange={e => setCloseTimeGMT(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#1A2232] border border-slate-200 dark:border-[#223147] rounded-xl p-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                      Reason / Operating Note
                    </label>
                    <input
                      type="text"
                      value={closingReason}
                      onChange={e => setClosingReason(e.target.value)}
                      placeholder="e.g. Standard 6 AM - 6 PM GMT shift"
                      className="w-full bg-slate-50 dark:bg-[#1A2232] border border-slate-200 dark:border-[#223147] rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowEditSchedule(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1E2D40] text-xs font-bold text-slate-600 dark:text-[#8899BB] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Save Operating Hours
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-[#1C2638] bg-slate-50/50 dark:bg-[#131926]/50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-[#8899BB] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Audit-ready shift logging active</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
