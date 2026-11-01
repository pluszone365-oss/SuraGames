import React, { useState } from 'react';
import {
  Gamepad2,
  Plus,
  Minus,
  RotateCcw,
  CheckCircle,
  CreditCard,
  History,
  Settings,
  Sparkles,
  Trophy,
  Flame,
  X,
  Wallet as WalletIcon
} from 'lucide-react';
import { PlayStationStation } from '../../types/gameCounters';
import { Wallet } from '../../types';
import { formatETB } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';

interface PlayStationCounterCardProps {
  station: PlayStationStation;
  wallets: Wallet[];
  onUpdateStation: (updated: PlayStationStation) => void;
  onRecordRevenue: (data: {
    amount: number;
    walletId: string;
    description: string;
    category: string;
    stationId: string;
  }) => void;
}

export const PlayStationCounterCard: React.FC<PlayStationCounterCardProps> = ({
  station,
  wallets,
  onUpdateStation,
  onRecordRevenue
}) => {
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [customRate, setCustomRate] = useState(station.pricePerMatch);
  const [showSettings, setShowSettings] = useState(false);
  const [customerName, setCustomerName] = useState('');

  const totalCharge = station.matchesPlayed * station.pricePerMatch;

  const handleIncrement = (amount = 1) => {
    triggerHaptic('medium');
    const newHistory = [...station.matchHistory, station.matchesPlayed];
    onUpdateStation({
      ...station,
      matchesPlayed: station.matchesPlayed + amount,
      matchHistory: newHistory
    });
  };

  const handleDecrement = () => {
    if (station.matchesPlayed <= 0) return;
    triggerHaptic('light');
    const newHistory = [...station.matchHistory, station.matchesPlayed];
    onUpdateStation({
      ...station,
      matchesPlayed: Math.max(0, station.matchesPlayed - 1),
      matchHistory: newHistory
    });
  };

  const handleUndo = () => {
    if (station.matchHistory.length === 0) return;
    triggerHaptic('warning');
    const prevMatches = station.matchHistory[station.matchHistory.length - 1];
    const newHistory = station.matchHistory.slice(0, -1);
    onUpdateStation({
      ...station,
      matchesPlayed: prevMatches,
      matchHistory: newHistory
    });
  };

  const handleEndSession = () => {
    triggerHaptic('warning');
    if (station.matchesPlayed > 0 && totalCharge > 0) {
      // Suggest payment
      setShowPayModal(true);
    } else {
      onUpdateStation({
        ...station,
        matchesPlayed: 0,
        matchHistory: [],
        activeSessionStartTime: new Date().toISOString()
      });
    }
  };

  const handleConfirmPayment = () => {
    if (totalCharge <= 0) return;
    triggerHaptic('success');

    const targetW = wallets.find(w => w.id === selectedWalletId) || wallets[0];
    const desc = `${station.name}: ${station.matchesPlayed} matches @ ${formatETB(station.pricePerMatch)}/match${customerName.trim() ? ` (Player: ${customerName.trim()})` : ''}`;

    onRecordRevenue({
      amount: totalCharge,
      walletId: targetW?.id || 'w-cash',
      description: desc,
      category: 'Sales Revenue',
      stationId: station.id
    });

    // Reset station matches after recording payment
    onUpdateStation({
      ...station,
      matchesPlayed: 0,
      matchHistory: [],
      activeSessionStartTime: new Date().toISOString()
    });

    setShowPayModal(false);
    setCustomerName('');
  };

  const handleSaveRate = () => {
    triggerHaptic('success');
    onUpdateStation({
      ...station,
      pricePerMatch: Math.max(1, Number(customRate) || 20)
    });
    setShowSettings(false);
  };

  return (
    <div className="bg-[#0D1527] border border-[#1E2D4A] hover:border-[#00D4AA]/40 rounded-3xl p-5 sm:p-6 shadow-xl transition-all relative overflow-hidden group">
      {/* Station Header & Badges */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00D4AA]/20 to-[#3B82F6]/20 border border-[#00D4AA]/40 flex items-center justify-center text-[#00D4AA] shadow-lg shadow-[#00D4AA]/10">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-white text-base sm:text-lg tracking-wide">
                {station.name}
              </h3>
              {station.matchesPlayed > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30 animate-pulse">
                  <Flame className="w-3 h-3 text-[#00D4AA]" /> IN PLAY
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Fixed Rate: <span className="text-[#00D4AA] font-bold">{formatETB(station.pricePerMatch)}</span> per match
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(prev => !prev)}
          className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Configure match pricing"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Pricing Rate Inline Editor */}
      {showSettings && (
        <div className="mb-4 p-3.5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 font-semibold">Match Fee (ETB):</span>
            <input
              type="number"
              value={customRate}
              onChange={(e) => setCustomRate(Math.max(1, Number(e.target.value)))}
              className="w-20 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm text-center focus:border-[#00D4AA] outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(false)}
              className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRate}
              className="px-3 py-1.5 rounded-xl bg-[#00D4AA] text-[#0A0E1A] font-bold text-xs hover:bg-[#00D4AA]/90 cursor-pointer"
            >
              Save Rate
            </button>
          </div>
        </div>
      )}

      {/* Central Counter Display Box */}
      <div className="bg-[#070B14]/80 border border-[#162238] rounded-2xl p-6 my-4 text-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-12 -left-12 w-28 h-28 bg-[#00D4AA]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-[#3B82F6]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
          Matches Played
        </div>

        {/* Big Match Counter Number with prominent - and +1 controls */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 my-2">
          {/* Decrement Button */}
          <button
            onClick={handleDecrement}
            disabled={station.matchesPlayed <= 0}
            aria-label="Decrease match count"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700/80 text-rose-400 font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-black/40"
          >
            <Minus className="w-7 h-7" />
          </button>

          {/* Huge Number */}
          <div className="min-w-[120px] sm:min-w-[150px] flex flex-col items-center justify-center">
            <span className="font-mono font-black text-6xl sm:text-7xl text-white tracking-tight drop-shadow-md">
              {station.matchesPlayed}
            </span>
          </div>

          {/* Increment Button */}
          <button
            onClick={() => handleIncrement(1)}
            aria-label="Add 1 match"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] hover:from-[#00D4AA]/90 hover:to-[#00B4D8]/90 active:scale-95 text-[#0A0E1A] font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-[#00D4AA]/25"
          >
            <Plus className="w-8 h-8" />
          </button>
        </div>

        {/* Quick Stepper Pills */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => handleIncrement(2)}
            className="px-3 py-1 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            +2 Matches
          </button>
          <button
            onClick={() => handleIncrement(5)}
            className="px-3 py-1 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            +5 Matches
          </button>
          {station.matchHistory.length > 0 && (
            <button
              onClick={handleUndo}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-bold text-amber-400 transition-colors cursor-pointer"
              title="Undo last change"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Undo
            </button>
          )}
        </div>
      </div>

      {/* Financial Summary & Total Charge Bar */}
      <div className="bg-[#121B2E] border border-[#1E2D4A] rounded-2xl p-4 mb-4 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Charge ({station.matchesPlayed} × {formatETB(station.pricePerMatch)})
          </span>
          <span className="font-mono font-black text-2xl sm:text-3xl text-[#00D4AA]">
            {formatETB(totalCharge)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Status
          </span>
          <span className="text-xs font-bold text-slate-200">
            {station.matchesPlayed === 0 ? 'Ready for Players' : 'Active Session'}
          </span>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleEndSession}
          disabled={station.matchesPlayed === 0}
          className="w-full py-3 px-4 rounded-2xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700/80 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4 text-slate-400" />
          End Session
        </button>

        <button
          onClick={() => setShowPayModal(true)}
          disabled={totalCharge <= 0}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#00D4AA] to-[#3B82F6] hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0E1A] text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#00D4AA]/20"
        >
          <CreditCard className="w-4 h-4 text-[#0A0E1A]" />
          Record Payment
        </button>
      </div>

      {/* Record Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B0F19] border border-[#00D4AA]/40 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left relative space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-[#00D4AA]">
                <CheckCircle className="w-5 h-5" />
                <h3 className="font-extrabold text-white text-base">
                  Record Match Payment
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
                <span>Station:</span>
                <span className="text-white font-bold">{station.name}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Matches Count:</span>
                <span className="text-white font-bold">{station.matchesPlayed} matches</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Rate per Match:</span>
                <span className="text-white font-bold">{formatETB(station.pricePerMatch)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-200">Total Income:</span>
                <span className="font-mono font-black text-2xl text-[#00D4AA]">
                  {formatETB(totalCharge)}
                </span>
              </div>
            </div>

            {/* Optional Customer Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Player / Customer Name (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Dawit & Friends"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-[#00D4AA] outline-none"
              />
            </div>

            {/* Wallet Destination Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Deposit Into Wallet:
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
                        ? 'bg-[#00D4AA]/15 border-[#00D4AA] text-white shadow-md'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <WalletIcon className="w-4 h-4 text-[#00D4AA]" />
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
                className="flex-1 py-3 rounded-xl bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0A0E1A] text-xs font-black cursor-pointer shadow-lg shadow-[#00D4AA]/25"
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
