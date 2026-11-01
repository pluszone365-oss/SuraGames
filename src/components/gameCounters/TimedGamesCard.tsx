import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Pause,
  Square,
  RotateCcw,
  CreditCard,
  CheckCircle,
  Settings,
  Sparkles,
  Zap,
  Flame,
  X,
  Wallet as WalletIcon
} from 'lucide-react';
import { TimedStation } from '../../types/gameCounters';
import { Wallet } from '../../types';
import { formatETB } from '../../lib/store';
import {
  calculateTimedBillableBlocks,
  calculateTimedCost,
  formatElapsedSeconds,
  secondsUntilNextBlock
} from '../../lib/gameCountersStore';
import { triggerHaptic } from '../../lib/haptics';

interface TimedGamesCardProps {
  station: TimedStation;
  wallets: Wallet[];
  onUpdateStation: (updated: TimedStation) => void;
  onRecordRevenue: (data: {
    amount: number;
    walletId: string;
    description: string;
    category: string;
    stationId: string;
  }) => void;
}

export const TimedGamesCard: React.FC<TimedGamesCardProps> = ({
  station,
  wallets,
  onUpdateStation,
  onRecordRevenue
}) => {
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [customerName, setCustomerName] = useState(station.customerName || '');
  const [showSettings, setShowSettings] = useState(false);
  const [customRate, setCustomRate] = useState(station.pricePerBlock);
  const [customBlockMins, setCustomBlockMins] = useState(station.blockMinutes);

  // Live timer tick when isRunning
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (station.isRunning) {
      interval = setInterval(() => {
        onUpdateStation({
          ...station,
          elapsedSeconds: station.elapsedSeconds + 1
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [station.isRunning, station.elapsedSeconds]);

  const billableBlocks = calculateTimedBillableBlocks(station.elapsedSeconds, station.blockMinutes);
  const totalCost = calculateTimedCost(station.elapsedSeconds, station.pricePerBlock, station.blockMinutes);
  const nextBlockSec = secondsUntilNextBlock(station.elapsedSeconds, station.blockMinutes);

  const handleStart = () => {
    triggerHaptic('success');
    onUpdateStation({
      ...station,
      isRunning: true,
      status: 'RUNNING',
      startedAtTimestamp: station.startedAtTimestamp || Date.now()
    });
  };

  const handlePause = () => {
    triggerHaptic('medium');
    onUpdateStation({
      ...station,
      isRunning: false,
      status: 'PAUSED'
    });
  };

  const handleResume = () => {
    triggerHaptic('medium');
    onUpdateStation({
      ...station,
      isRunning: true,
      status: 'RUNNING'
    });
  };

  const handleStop = () => {
    triggerHaptic('warning');
    if (station.elapsedSeconds > 0 && totalCost > 0) {
      onUpdateStation({
        ...station,
        isRunning: false,
        status: 'PAUSED'
      });
      setShowPayModal(true);
    } else {
      handleReset();
    }
  };

  const handleReset = () => {
    triggerHaptic('warning');
    onUpdateStation({
      ...station,
      isRunning: false,
      elapsedSeconds: 0,
      status: 'IDLE',
      startedAtTimestamp: undefined,
      customerName: undefined
    });
  };

  const handleConfirmPayment = () => {
    if (totalCost <= 0) return;
    triggerHaptic('success');

    const targetW = wallets.find(w => w.id === selectedWalletId) || wallets[0];
    const minsElapsed = Math.round(station.elapsedSeconds / 60);
    const desc = `${station.name}: ${billableBlocks} × ${station.blockMinutes}-min blocks (${minsElapsed} mins total) @ ${formatETB(station.pricePerBlock)}/block${customerName.trim() ? ` (Customer: ${customerName.trim()})` : ''}`;

    onRecordRevenue({
      amount: totalCost,
      walletId: targetW?.id || 'w-cash',
      description: desc,
      category: 'Sales Revenue',
      stationId: station.id
    });

    handleReset();
    setShowPayModal(false);
  };

  const handleSaveSettings = () => {
    triggerHaptic('success');
    onUpdateStation({
      ...station,
      pricePerBlock: Math.max(1, Number(customRate) || 20),
      blockMinutes: Math.max(1, Number(customBlockMins) || 10)
    });
    setShowSettings(false);
  };

  return (
    <div className="bg-[#0D1527] border border-[#1E2D4A] hover:border-[#3B82F6]/40 rounded-3xl p-5 sm:p-6 shadow-xl transition-all relative overflow-hidden group">
      {/* Station Header & Badges */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3B82F6]/20 to-[#6366F1]/20 border border-[#3B82F6]/40 flex items-center justify-center text-[#3B82F6] shadow-lg shadow-[#3B82F6]/10">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-white text-base sm:text-lg tracking-wide">
                {station.name}
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  station.status === 'RUNNING'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse'
                    : station.status === 'PAUSED'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {station.status === 'RUNNING' ? '● TIMING' : station.status === 'PAUSED' ? '❚❚ PAUSED' : '○ IDLE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Rate: <span className="text-[#3B82F6] font-bold">{formatETB(station.pricePerBlock)}</span> per started {station.blockMinutes}-minute block
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(prev => !prev)}
          className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Configure block minutes and rate"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-3.5 rounded-2xl bg-slate-900/90 border border-blue-500/30 space-y-3 animate-fadeIn">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-300 font-semibold block mb-1">Fee per Block (ETB):</span>
              <input
                type="number"
                value={customRate}
                onChange={(e) => setCustomRate(Math.max(1, Number(e.target.value)))}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-center outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <span className="text-slate-300 font-semibold block mb-1">Block Minutes:</span>
              <input
                type="number"
                value={customBlockMins}
                onChange={(e) => setCustomBlockMins(Math.max(1, Number(e.target.value)))}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-center outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowSettings(false)}
              className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-3 py-1.5 rounded-xl bg-[#3B82F6] text-white font-bold text-xs hover:bg-[#3B82F6]/90 cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* Large Elapsed Timer Display */}
      <div className="bg-[#070B14]/80 border border-[#162238] rounded-2xl p-6 my-4 text-center relative overflow-hidden">
        {/* Glow */}
        <div className={`absolute -top-12 -left-12 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-all ${
          station.status === 'RUNNING' ? 'bg-emerald-500/20' : 'bg-blue-500/10'
        }`} />

        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-400" /> Elapsed Session Time
        </div>

        {/* Large Digital Stopwatch */}
        <div className="my-2">
          <span className={`font-mono font-black text-5xl sm:text-6xl tracking-tight drop-shadow-md ${
            station.status === 'RUNNING' ? 'text-white text-emerald-400/90' : 'text-slate-300'
          }`}>
            {formatElapsedSeconds(station.elapsedSeconds)}
          </span>
        </div>

        {/* Billable Blocks Progress Info */}
        <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
            {billableBlocks} started {station.blockMinutes}m block{billableBlocks !== 1 ? 's' : ''}
          </span>
          {station.isRunning && (
            <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 text-[11px]">
              {Math.floor(nextBlockSec / 60)}m {nextBlockSec % 60}s to next block
            </span>
          )}
        </div>
      </div>

      {/* Billable Calculation Row */}
      <div className="bg-[#121B2E] border border-[#1E2D4A] rounded-2xl p-4 mb-4 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Estimated Total ({billableBlocks} × {formatETB(station.pricePerBlock)})
          </span>
          <span className="font-mono font-black text-2xl sm:text-3xl text-blue-400">
            {formatETB(totalCost)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Billing Policy
          </span>
          <span className="text-xs font-bold text-slate-300">
            Auto rounded-up blocks
          </span>
        </div>
      </div>

      {/* Controls: Start, Pause, Resume, Stop */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
        {station.status === 'IDLE' ? (
          <button
            onClick={handleStart}
            className="col-span-3 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-[#00D4AA] hover:opacity-95 text-[#0A0E1A] font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Play className="w-5 h-5 fill-current" />
            Start Session
          </button>
        ) : station.status === 'RUNNING' ? (
          <>
            <button
              onClick={handlePause}
              className="py-3 px-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Pause className="w-4 h-4 fill-current" />
              Pause
            </button>
            <button
              onClick={handleStop}
              className="col-span-2 py-3 px-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop & Settle
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleResume}
              className="py-3 px-3 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              Resume
            </button>
            <button
              onClick={handleStop}
              className="py-3 px-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop
            </button>
            <button
              onClick={handleReset}
              className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </>
        )}
      </div>

      {/* Record Payment Action */}
      {station.elapsedSeconds > 0 && (
        <button
          onClick={() => setShowPayModal(true)}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600/30 hover:bg-blue-600/40 border border-blue-500/50 text-blue-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4 text-blue-400" />
          Record Payment Now ({formatETB(totalCost)})
        </button>
      )}

      {/* Payment Confirmation Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B0F19] border border-blue-500/40 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left relative space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-blue-400">
                <CheckCircle className="w-5 h-5" />
                <h3 className="font-extrabold text-white text-base">
                  Record Timed Session Payment
                </h3>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#070B14] border border-slate-800/80 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Timed Station:</span>
                <span className="text-white font-bold">{station.name}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Duration Elapsed:</span>
                <span className="text-white font-mono font-bold">{formatElapsedSeconds(station.elapsedSeconds)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Billable Started Blocks:</span>
                <span className="text-white font-bold">{billableBlocks} × {station.blockMinutes}m blocks</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-200">Total Billed:</span>
                <span className="font-mono font-black text-2xl text-blue-400">
                  {formatETB(totalCost)}
                </span>
              </div>
            </div>

            {/* Optional Customer Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Customer Name (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. VIP Gamer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-blue-400 outline-none"
              />
            </div>

            {/* Wallet Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Collect Payment In:
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedWalletId(w.id);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      selectedWalletId === w.id
                        ? 'bg-blue-500/15 border-blue-400 text-white shadow-md'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <WalletIcon className="w-4 h-4 text-blue-400" />
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{w.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{w.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Confirmation Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-black cursor-pointer shadow-lg shadow-blue-500/25"
              >
                Confirm & Post Income
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
