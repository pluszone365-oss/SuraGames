import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Plus,
  Minus,
  RotateCcw,
  CheckCircle,
  CreditCard,
  Settings,
  Sparkles,
  Flame,
  X,
  Wallet as WalletIcon,
  Trash2,
  Edit2,
  DollarSign,
  Check,
  Zap,
  Play,
  Pause,
  Clock,
  Hourglass,
  Layers,
  ChevronRight,
  TrendingUp,
  CircleDot
} from 'lucide-react';
import { PlayStationStation, TimedStation, PlayStationBillingMode } from '../../types/gameCounters';
import { Wallet } from '../../types';
import {
  formatElapsedSeconds,
  calculateTimedBillableBlocks,
  calculateTimedCost,
  secondsUntilNextBlock
} from '../../lib/gameCountersStore';
import { formatETB } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';

interface PlayStationDashboardMatrixProps {
  stations: PlayStationStation[];
  timedStations?: TimedStation[];
  wallets: Wallet[];
  onUpdateStation: (updated: PlayStationStation) => void;
  onUpdateTimedStation?: (updated: TimedStation) => void;
  onAddStation: () => void;
  onDeleteStation?: (stationId: string) => void;
  onRecordRevenue: (data: {
    amount: number;
    walletId: string;
    description: string;
    category: string;
    stationId: string;
  }) => void;
}

export const PlayStationDashboardMatrix: React.FC<PlayStationDashboardMatrixProps> = ({
  stations,
  timedStations = [],
  wallets,
  onUpdateStation,
  onUpdateTimedStation,
  onAddStation,
  onDeleteStation,
  onRecordRevenue
}) => {
  // Filter: 'ALL' | 'MATCHES' | 'ACTIVE' | 'IDLE'
  const [filter, setFilter] = useState<'ALL' | 'MATCHES' | 'ACTIVE' | 'IDLE'>('ALL');

  // Live ticker for stopwatch timestamps so elapsed seconds update on screen every second without drift
  const [ticker, setTicker] = useState<number>(() => Date.now());

  useEffect(() => {
    const hasRunningPsTimers = stations.some(s => s.billingMode === 'TIMED' && s.timerIsRunning);
    const hasRunningBooths = timedStations.some(t => t.isRunning);

    if (!hasRunningPsTimers && !hasRunningBooths) return;

    const interval = setInterval(() => {
      setTicker(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [stations, timedStations]);

  // Helper: compute true elapsed seconds for a PS station
  const getPsElapsedSeconds = (station: PlayStationStation): number => {
    const base = station.timerElapsedSeconds || 0;
    if (station.timerIsRunning && station.timerStartedAtTimestamp) {
      const added = Math.max(0, Math.floor((ticker - station.timerStartedAtTimestamp) / 1000));
      return base + added;
    }
    return base;
  };

  // Helper: compute true elapsed seconds for a standalone timed booth
  const getBoothElapsedSeconds = (booth: TimedStation): number => {
    const base = booth.elapsedSeconds || 0;
    if (booth.isRunning && booth.startedAtTimestamp) {
      const added = Math.max(0, Math.floor((ticker - booth.startedAtTimestamp) / 1000));
      return base + added;
    }
    return base;
  };

  // Modal states for settling payment or editing station
  const [payingTarget, setPayingTarget] = useState<{
    type: 'PS_MATCH' | 'PS_TIMED' | 'TIMED_BOOTH';
    psStation?: PlayStationStation;
    timedBooth?: TimedStation;
    amount: number;
    description: string;
    stationId: string;
    stationName: string;
  } | null>(null);

  const [selectedWalletId, setSelectedWalletId] = useState<string>(wallets[0]?.id || 'w-cash');
  const [customerName, setCustomerName] = useState('');

  // Station Settings/Edit modal
  const [editingStation, setEditingStation] = useState<PlayStationStation | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editRate, setEditRate] = useState<number>(20);
  const [editTimerRate, setEditTimerRate] = useState<number>(20);

  // Stepper handlers for Match Mode
  const handleIncrement = (station: PlayStationStation, amount = 1) => {
    triggerHaptic('medium');
    const newHistory = [...station.matchHistory, station.matchesPlayed];
    onUpdateStation({
      ...station,
      matchesPlayed: station.matchesPlayed + amount,
      matchHistory: newHistory
    });
  };

  const handleDecrement = (station: PlayStationStation) => {
    if (station.matchesPlayed <= 0) return;
    triggerHaptic('light');
    const newHistory = [...station.matchHistory, station.matchesPlayed];
    onUpdateStation({
      ...station,
      matchesPlayed: Math.max(0, station.matchesPlayed - 1),
      matchHistory: newHistory
    });
  };

  const handleUndo = (station: PlayStationStation) => {
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

  // Toggle Billing Mode (MATCHES vs TIMED) on a PlayStation Station
  const handleToggleMode = (station: PlayStationStation, newMode: PlayStationBillingMode) => {
    triggerHaptic('light');
    onUpdateStation({
      ...station,
      billingMode: newMode,
      // If switching to timed and never initialized, set defaults
      timerPricePerBlock: station.timerPricePerBlock || 20,
      timerBlockMinutes: station.timerBlockMinutes || 10,
      timerElapsedSeconds: station.timerElapsedSeconds || 0,
      timerIsRunning: station.timerIsRunning || false,
      timerStatus: station.timerStatus || 'IDLE'
    });
  };

  // Stopwatch actions on a PlayStation Station in Timed Mode
  const handleStartPsTimer = (station: PlayStationStation) => {
    triggerHaptic('success');
    onUpdateStation({
      ...station,
      timerIsRunning: true,
      timerStatus: 'RUNNING',
      timerStartedAtTimestamp: Date.now()
    });
  };

  const handlePausePsTimer = (station: PlayStationStation) => {
    triggerHaptic('light');
    const elapsed = getPsElapsedSeconds(station);
    onUpdateStation({
      ...station,
      timerElapsedSeconds: elapsed,
      timerIsRunning: false,
      timerStatus: 'PAUSED',
      timerStartedAtTimestamp: undefined
    });
  };

  const handleResumePsTimer = (station: PlayStationStation) => {
    triggerHaptic('success');
    onUpdateStation({
      ...station,
      timerIsRunning: true,
      timerStatus: 'RUNNING',
      timerStartedAtTimestamp: Date.now()
    });
  };

  const handleResetPsTimer = (station: PlayStationStation) => {
    triggerHaptic('warning');
    onUpdateStation({
      ...station,
      timerElapsedSeconds: 0,
      timerIsRunning: false,
      timerStatus: 'IDLE',
      timerStartedAtTimestamp: undefined
    });
  };

  // Stopwatch actions on a standalone Timed Booth
  const handleStartBoothTimer = (booth: TimedStation) => {
    if (!onUpdateTimedStation) return;
    triggerHaptic('success');
    onUpdateTimedStation({
      ...booth,
      isRunning: true,
      status: 'RUNNING',
      startedAtTimestamp: Date.now()
    });
  };

  const handlePauseBoothTimer = (booth: TimedStation) => {
    if (!onUpdateTimedStation) return;
    triggerHaptic('light');
    const elapsed = getBoothElapsedSeconds(booth);
    onUpdateTimedStation({
      ...booth,
      elapsedSeconds: elapsed,
      isRunning: false,
      status: 'PAUSED',
      startedAtTimestamp: undefined
    });
  };

  const handleResumeBoothTimer = (booth: TimedStation) => {
    if (!onUpdateTimedStation) return;
    triggerHaptic('success');
    onUpdateTimedStation({
      ...booth,
      isRunning: true,
      status: 'RUNNING',
      startedAtTimestamp: Date.now()
    });
  };

  const handleResetBoothTimer = (booth: TimedStation) => {
    if (!onUpdateTimedStation) return;
    triggerHaptic('warning');
    onUpdateTimedStation({
      ...booth,
      elapsedSeconds: 0,
      isRunning: false,
      status: 'IDLE',
      startedAtTimestamp: undefined
    });
  };

  // Open Payment Settle Modal for a Match session
  const handleOpenPayModalForMatch = (station: PlayStationStation) => {
    triggerHaptic('light');
    const totalCharge = station.matchesPlayed * station.pricePerMatch;
    setPayingTarget({
      type: 'PS_MATCH',
      psStation: station,
      amount: totalCharge,
      description: `${station.name} Matches: ${station.matchesPlayed} matches @ ${formatETB(station.pricePerMatch)}/match`,
      stationId: station.id,
      stationName: station.name
    });
    setCustomerName('');
    setSelectedWalletId(wallets[0]?.id || 'w-cash');
  };

  // Open Payment Settle Modal for a Timed PS session
  const handleOpenPayModalForPsTimed = (station: PlayStationStation) => {
    triggerHaptic('light');
    const elapsed = getPsElapsedSeconds(station);
    const pricePerBlock = station.timerPricePerBlock || 20;
    const blockMinutes = station.timerBlockMinutes || 10;
    const blocks = calculateTimedBillableBlocks(elapsed, blockMinutes);
    const totalCharge = calculateTimedCost(elapsed, pricePerBlock, blockMinutes);

    setPayingTarget({
      type: 'PS_TIMED',
      psStation: station,
      amount: totalCharge,
      description: `${station.name} Timed Game: ${formatElapsedSeconds(elapsed)} (${blocks} block${blocks > 1 ? 's' : ''} @ ${formatETB(pricePerBlock)}/block)`,
      stationId: station.id,
      stationName: station.name
    });
    setCustomerName('');
    setSelectedWalletId(wallets[0]?.id || 'w-cash');
  };

  // Open Payment Settle Modal for a Standalone Timed Booth
  const handleOpenPayModalForBooth = (booth: TimedStation) => {
    triggerHaptic('light');
    const elapsed = getBoothElapsedSeconds(booth);
    const blocks = calculateTimedBillableBlocks(elapsed, booth.blockMinutes);
    const totalCharge = calculateTimedCost(elapsed, booth.pricePerBlock, booth.blockMinutes);

    setPayingTarget({
      type: 'TIMED_BOOTH',
      timedBooth: booth,
      amount: totalCharge,
      description: `${booth.name} Timed Session: ${formatElapsedSeconds(elapsed)} (${blocks} block${blocks > 1 ? 's' : ''} @ ${formatETB(booth.pricePerBlock)}/block)`,
      stationId: booth.id,
      stationName: booth.name
    });
    setCustomerName('');
    setSelectedWalletId(wallets[0]?.id || 'w-cash');
  };

  // Confirm payment & post to ERP wallet
  const handleConfirmPayment = () => {
    if (!payingTarget || payingTarget.amount <= 0) return;
    triggerHaptic('success');

    const targetW = wallets.find(w => w.id === selectedWalletId) || wallets[0] || { id: 'w-cash', name: 'Cash Drawer' };
    const fullDesc = `${payingTarget.description}${customerName.trim() ? ` (Player: ${customerName.trim()})` : ''}`;

    onRecordRevenue({
      amount: payingTarget.amount,
      walletId: targetW.id,
      description: fullDesc,
      category: 'Sales Revenue',
      stationId: payingTarget.stationId
    });

    // Reset station after payment
    if (payingTarget.type === 'PS_MATCH' && payingTarget.psStation) {
      onUpdateStation({
        ...payingTarget.psStation,
        matchesPlayed: 0,
        matchHistory: [],
        activeSessionStartTime: new Date().toISOString()
      });
    } else if (payingTarget.type === 'PS_TIMED' && payingTarget.psStation) {
      onUpdateStation({
        ...payingTarget.psStation,
        timerElapsedSeconds: 0,
        timerIsRunning: false,
        timerStatus: 'IDLE',
        timerStartedAtTimestamp: undefined
      });
    } else if (payingTarget.type === 'TIMED_BOOTH' && payingTarget.timedBooth && onUpdateTimedStation) {
      onUpdateTimedStation({
        ...payingTarget.timedBooth,
        elapsedSeconds: 0,
        isRunning: false,
        status: 'IDLE',
        startedAtTimestamp: undefined
      });
    }

    setPayingTarget(null);
    setCustomerName('');
  };

  // Edit station modal
  const handleOpenEditModal = (station: PlayStationStation) => {
    triggerHaptic('light');
    setEditingStation(station);
    setEditName(station.name);
    setEditSubtitle(station.subtitle || '');
    setEditRate(station.pricePerMatch);
    setEditTimerRate(station.timerPricePerBlock || 20);
  };

  const handleSaveEdit = () => {
    if (!editingStation) return;
    triggerHaptic('success');
    onUpdateStation({
      ...editingStation,
      name: editName.trim() || editingStation.name,
      subtitle: editSubtitle.trim() || undefined,
      pricePerMatch: Math.max(1, Number(editRate) || 20),
      timerPricePerBlock: Math.max(1, Number(editTimerRate) || 20)
    });
    setEditingStation(null);
  };

  // Aggregate Metrics Across Dashboard
  const psMatchStations = stations.filter(s => (s.billingMode || 'MATCHES') === 'MATCHES');
  const psTimedStations = stations.filter(s => s.billingMode === 'TIMED');

  const activePsMatchesCount = psMatchStations.filter(s => s.matchesPlayed > 0).length;
  const runningPsTimersCount = psTimedStations.filter(s => s.timerIsRunning || (s.timerElapsedSeconds || 0) > 0).length;
  const runningBoothsCount = timedStations.filter(t => t.isRunning || t.elapsedSeconds > 0).length;

  const totalActiveStations = activePsMatchesCount + runningPsTimersCount + runningBoothsCount;

  const totalMatchesAcrossAll = psMatchStations.reduce((sum, s) => sum + s.matchesPlayed, 0);

  // Uncollected revenue calculation
  const uncollectedMatchesETB = psMatchStations.reduce((sum, s) => sum + (s.matchesPlayed * s.pricePerMatch), 0);
  const uncollectedPsTimedETB = psTimedStations.reduce((sum, s) => {
    const elapsed = getPsElapsedSeconds(s);
    return sum + calculateTimedCost(elapsed, s.timerPricePerBlock || 20, s.timerBlockMinutes || 10);
  }, 0);
  const uncollectedBoothsETB = timedStations.reduce((sum, b) => {
    const elapsed = getBoothElapsedSeconds(b);
    return sum + calculateTimedCost(elapsed, b.pricePerBlock, b.blockMinutes);
  }, 0);

  const totalUncollectedRevenue = uncollectedMatchesETB + uncollectedPsTimedETB;

  // Filtered station list for PS
  const filteredPsStations = stations.filter(s => {
    const isTimed = s.billingMode === 'TIMED';
    const isActive = isTimed
      ? (s.timerIsRunning || (s.timerElapsedSeconds || 0) > 0)
      : (s.matchesPlayed > 0);

    if (filter === 'MATCHES') return !isTimed;
    if (filter === 'ACTIVE') return isActive;
    if (filter === 'IDLE') return !isActive;
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-5 animate-fadeIn">
      {/* Top Arcade Command Header & Global Metrics */}
      <div className="bg-[#0D1527] border border-[#1E2D4A] rounded-3xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00D4AA] animate-pulse" />
              <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                PlayStation Dashboard
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30">
                {stations.length} CONSOLES
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live PlayStation console matrix: match tracking (20 ETB/match) with quick settlement and session logs.
            </p>
          </div>

          {/* Quick Action: Add PS Station */}
          <button
            onClick={() => {
              triggerHaptic('medium');
              onAddStation();
            }}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] text-[#0A0E1A] font-extrabold text-xs sm:text-sm hover:opacity-95 active:scale-95 transition-all shadow-md shadow-[#00D4AA]/20 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add PS Station</span>
          </button>
        </div>

        {/* Global Combined Stat Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Active In-Play</span>
            <span className="font-mono font-black text-base sm:text-xl text-[#00D4AA]">
              {totalActiveStations} <span className="text-xs text-slate-500 font-normal">/ {stations.length}</span>
            </span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">PS Matches Logged</span>
            <span className="font-mono font-black text-base sm:text-xl text-cyan-400">
              {totalMatchesAcrossAll}
            </span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Running Timers</span>
            <span className="font-mono font-black text-base sm:text-xl text-blue-400">
              {runningPsTimersCount}
            </span>
          </div>

          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Active Tab Bill</span>
            <span className="font-mono font-black text-base sm:text-xl text-emerald-400">
              {formatETB(totalUncollectedRevenue)}
            </span>
          </div>
        </div>

        {/* Filter Toggle Pills */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => {
              triggerHaptic('light');
              setFilter('ALL');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === 'ALL'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Stations ({stations.length})
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setFilter('MATCHES');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'MATCHES'
                ? 'bg-[#00D4AA]/20 border border-[#00D4AA] text-[#00D4AA] shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Match Play</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setFilter('ACTIVE');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'ACTIVE'
                ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-400 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            In Play ({totalActiveStations})
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setFilter('IDLE');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === 'IDLE'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Idle ({Math.max(0, stations.length - totalActiveStations)})
          </button>
        </div>
      </div>

      {/* Section 1: PlayStation Consoles Grid (PS 1, PS 2, PS 3...) with Dual Match & Timed Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {filteredPsStations.map((station) => {
          const isTimed = station.billingMode === 'TIMED';

          // Match calculations
          const matchCharge = station.matchesPlayed * station.pricePerMatch;
          const isMatchActive = station.matchesPlayed > 0;

          // Timed calculations
          const elapsed = getPsElapsedSeconds(station);
          const pricePerBlock = station.timerPricePerBlock || 20;
          const blockMinutes = station.timerBlockMinutes || 10;
          const blocks = calculateTimedBillableBlocks(elapsed, blockMinutes);
          const timedCharge = calculateTimedCost(elapsed, pricePerBlock, blockMinutes);
          const isTimerActive = station.timerIsRunning || elapsed > 0;
          const nextBlockSeconds = secondsUntilNextBlock(elapsed, blockMinutes);
          const blockProgressPercent = Math.min(100, Math.floor(((blockMinutes * 60 - nextBlockSeconds) / (blockMinutes * 60)) * 100));

          const isActive = isTimed ? isTimerActive : isMatchActive;

          return (
            <div
              key={station.id}
              className={`rounded-3xl p-5 sm:p-5 transition-all relative overflow-hidden flex flex-col justify-between border ${
                isActive
                  ? isTimed
                    ? 'bg-[#0B1A35] border-blue-500/50 shadow-xl shadow-blue-500/10'
                    : 'bg-[#0E1B33] border-[#00D4AA]/50 shadow-xl shadow-[#00D4AA]/10'
                  : 'bg-[#0B1120] border-[#182338] hover:border-slate-700 shadow-md'
              }`}
            >
              {/* Subtle ambient station glow when in-play */}
              {isActive && (
                <div
                  className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none ${
                    isTimed ? 'bg-blue-500/15' : 'bg-[#00D4AA]/15'
                  }`}
                />
              )}

              {/* Station Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm tracking-wider shadow-md ${
                        isActive
                          ? isTimed
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/20'
                            : 'bg-gradient-to-br from-[#00D4AA] to-[#00B4D8] text-[#0A0E1A] shadow-[#00D4AA]/20'
                          : 'bg-slate-800/80 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isTimed ? <Clock className="w-5 h-5" /> : <Gamepad2 className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-white text-base sm:text-lg tracking-tight">
                          {station.name}
                        </h3>
                        {isActive ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border animate-pulse ${
                              isTimed
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                : 'bg-[#00D4AA]/20 text-[#00D4AA] border-[#00D4AA]/40'
                            }`}
                          >
                            <Flame className="w-3 h-3" />
                            {isTimed ? (station.timerIsRunning ? 'RUNNING' : 'PAUSED') : 'IN PLAY'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800/70 text-slate-400">
                            IDLE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-[170px]">
                        {station.subtitle || (isTimed ? 'Timed Session' : 'FC 26 / Mortal Kombat')}
                      </p>
                    </div>
                  </div>

                  {/* Settings / Edit Button */}
                  <button
                    onClick={() => handleOpenEditModal(station)}
                    className="p-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Configure station & rate"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                {/* Mode Switcher Pill on each Station: Matches vs Timed */}
                <div className="flex p-0.5 rounded-xl bg-slate-950/90 border border-slate-800 mb-3">
                  <button
                    onClick={() => handleToggleMode(station, 'MATCHES')}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      !isTimed
                        ? 'bg-[#00D4AA] text-[#0A0E1A] font-black shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Gamepad2 className="w-3 h-3" />
                    <span>Matches ({formatETB(station.pricePerMatch)})</span>
                  </button>

                  <button
                    onClick={() => handleToggleMode(station, 'TIMED')}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      isTimed
                        ? 'bg-blue-500 text-white font-black shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>Timed ({formatETB(pricePerBlock)}/10m)</span>
                  </button>
                </div>

                {/* CARD BODY: MATCH MODE */}
                {!isTimed && (
                  <div>
                    {/* Big Center Display Box */}
                    <div className="bg-[#060A14]/90 border border-slate-800/80 rounded-2xl p-4 my-1 text-center relative overflow-hidden">
                      <div className="flex items-baseline justify-between mb-1 px-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Matches Played
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Rate: <strong className="text-slate-200">{formatETB(station.pricePerMatch)}</strong>
                        </span>
                      </div>

                      {/* Huge Digit & Calculated ETB */}
                      <div className="flex items-center justify-between py-1">
                        <div className="text-left">
                          <span className="font-mono font-black text-4xl sm:text-5xl text-white tracking-tight">
                            {station.matchesPlayed}
                          </span>
                          <span className="text-xs text-slate-400 ml-1.5 font-bold">
                            {station.matchesPlayed === 1 ? 'match' : 'matches'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Bill</span>
                          <span className="font-mono font-black text-xl sm:text-2xl text-[#00D4AA]">
                            {formatETB(matchCharge)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Primary Cashier Stepper Controls */}
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {/* Minus Button */}
                      <button
                        onClick={() => handleDecrement(station)}
                        disabled={station.matchesPlayed <= 0}
                        aria-label={`Minus 1 match for ${station.name}`}
                        className="h-12 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700 text-rose-400 font-black text-xl flex items-center justify-center transition-all cursor-pointer"
                      >
                        <Minus className="w-5 h-5" />
                      </button>

                      {/* Big Primary +1 Button (2 columns width) */}
                      <button
                        onClick={() => handleIncrement(station, 1)}
                        aria-label={`Add 1 match for ${station.name}`}
                        className="col-span-2 h-12 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] hover:opacity-95 active:scale-95 text-[#0A0E1A] font-black text-base flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-[#00D4AA]/25"
                      >
                        <Plus className="w-5 h-5 stroke-[3]" />
                        <span>+1 Match</span>
                      </button>

                      {/* Quick +2 or Undo Button */}
                      {station.matchHistory.length > 0 ? (
                        <button
                          onClick={() => handleUndo(station)}
                          title="Undo last tap"
                          className="h-12 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 border border-amber-500/30 text-amber-400 font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="text-[9px]">Undo</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleIncrement(station, 2)}
                          title="Add 2 matches"
                          className="h-12 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
                        >
                          +2
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* CARD BODY: TIMED GAME MODE */}
                {isTimed && (
                  <div>
                    {/* Big Stopwatch Display */}
                    <div className="bg-[#060A14]/90 border border-slate-800/80 rounded-2xl p-4 my-1 text-center relative overflow-hidden">
                      <div className="flex items-baseline justify-between mb-1 px-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Hourglass className="w-3 h-3 text-blue-400" /> Elapsed Time
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {formatETB(pricePerBlock)} / 10 min
                        </span>
                      </div>

                      {/* Big Digital Stopwatch */}
                      <div className="flex items-center justify-between py-1">
                        <div className="text-left">
                          <span className="font-mono font-black text-3xl sm:text-4xl text-white tracking-tight drop-shadow-sm">
                            {formatElapsedSeconds(elapsed)}
                          </span>
                          <span className="text-[11px] text-blue-400 block font-bold mt-0.5">
                            {blocks} {blocks === 1 ? 'Block' : 'Blocks'} (10m each)
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Due</span>
                          <span className="font-mono font-black text-xl sm:text-2xl text-blue-400">
                            {formatETB(timedCharge)}
                          </span>
                        </div>
                      </div>

                      {/* 10-Minute Block Progress Bar */}
                      {elapsed > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                          <div className="flex justify-between text-[9px] text-slate-400 mb-1 font-mono">
                            <span>Block #{blocks} progress</span>
                            <span>{Math.floor(nextBlockSeconds / 60)}m {nextBlockSeconds % 60}s to next +{formatETB(pricePerBlock)}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                              style={{ width: `${blockProgressPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Timed Stopwatch Controls: Start / Pause / Resume / Reset */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {!station.timerIsRunning && elapsed === 0 && (
                        <button
                          onClick={() => handleStartPsTimer(station)}
                          className="col-span-3 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-95 active:scale-95 text-white font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/25"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>Start 10-Min Timer</span>
                        </button>
                      )}

                      {station.timerIsRunning && (
                        <>
                          <button
                            onClick={() => handlePausePsTimer(station)}
                            className="col-span-2 h-12 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            <Pause className="w-4 h-4 fill-amber-300" />
                            <span>Pause Timer</span>
                          </button>

                          <button
                            onClick={() => handleResetPsTimer(station)}
                            title="Reset Stopwatch"
                            className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {!station.timerIsRunning && elapsed > 0 && (
                        <>
                          <button
                            onClick={() => handleResumePsTimer(station)}
                            className="col-span-2 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 active:scale-95 text-[#0A0E1A] font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                          >
                            <Play className="w-4 h-4 fill-[#0A0E1A]" />
                            <span>Resume</span>
                          </button>

                          <button
                            onClick={() => handleResetPsTimer(station)}
                            title="Reset Stopwatch"
                            className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Station Card Footer Actions */}
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center gap-2">
                {!isTimed ? (
                  // Match Mode Settle Button
                  isMatchActive ? (
                    <button
                      onClick={() => handleOpenPayModalForMatch(station)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <WalletIcon className="w-3.5 h-3.5" />
                      <span>Settle {formatETB(matchCharge)}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleIncrement(station, 1)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3 h-3 text-[#00D4AA]" />
                      <span>Start Matches</span>
                    </button>
                  )
                ) : (
                  // Timed Mode Settle Button
                  timedCharge > 0 ? (
                    <button
                      onClick={() => handleOpenPayModalForPsTimed(station)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <WalletIcon className="w-3.5 h-3.5" />
                      <span>Settle {formatETB(timedCharge)} ({blocks} blk)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartPsTimer(station)}
                      disabled={station.timerIsRunning}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <Play className="w-3 h-3 text-blue-400" />
                      <span>{station.timerIsRunning ? 'Timer Running' : 'Start Timer'}</span>
                    </button>
                  )
                )}

                {/* Reset button if session active */}
                {isActive && (
                  <button
                    onClick={() => {
                      triggerHaptic('warning');
                      if (isTimed) {
                        handleResetPsTimer(station);
                      } else {
                        onUpdateStation({
                          ...station,
                          matchesPlayed: 0,
                          matchHistory: []
                        });
                      }
                    }}
                    title="Clear session counter without recording"
                    className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>



      {/* Modal 1: Settle & Record Payment to ERP Wallet (Handles PS Matches & Timed Games) */}
      {payingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl relative animate-scaleUp">
            <button
              onClick={() => setPayingTarget(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                  payingTarget.type === 'PS_MATCH'
                    ? 'bg-gradient-to-br from-[#00D4AA] to-[#00B4D8] text-[#0A0E1A] shadow-[#00D4AA]/20'
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/20'
                }`}
              >
                {payingTarget.type === 'PS_MATCH' ? (
                  <Gamepad2 className="w-6 h-6 stroke-[2.5]" />
                ) : (
                  <Clock className="w-6 h-6 stroke-[2.5]" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Record Game Payment</h3>
                <p className="text-xs text-slate-400">{payingTarget.stationName}</p>
              </div>
            </div>

            {/* Bill Summary Banner */}
            <div className="p-4 rounded-2xl bg-[#080D18] border border-slate-800 text-center mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Total Billable Amount
              </span>
              <span
                className={`font-mono font-black text-3xl sm:text-4xl ${
                  payingTarget.type === 'PS_MATCH' ? 'text-[#00D4AA]' : 'text-blue-400'
                }`}
              >
                {formatETB(payingTarget.amount)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1 font-medium">
                {payingTarget.description}
              </span>
            </div>

            {/* Wallet Destination Selection */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Deposit to ERP Wallet
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {wallets.slice(0, 4).map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWalletId(w.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedWalletId === w.id
                          ? 'bg-[#00D4AA]/15 border-[#00D4AA] text-white shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="font-bold text-xs block truncate">{w.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{w.type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Player Name / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Yonas, GTA session, FIFA tournament..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-[#00D4AA]"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPayingTarget(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] text-[#0A0E1A] font-black text-xs hover:opacity-95 transition-all shadow-lg shadow-[#00D4AA]/25 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirm & Record</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Station Name & Match / Timed Rate */}
      {editingStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl relative animate-scaleUp">
            <button
              onClick={() => setEditingStation(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-[#00D4AA] flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Station Settings</h3>
                <p className="text-xs text-slate-400">{editingStation.name}</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Station Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. PS 1, PS 2, PS 3"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-[#00D4AA]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Game / Subtitle
                </label>
                <input
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  placeholder="e.g. FIFA / FC 26, Mortal Kombat"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-[#00D4AA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Match Rate (ETB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editRate}
                    onChange={(e) => setEditRate(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm outline-none focus:border-[#00D4AA]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    10-Min Block (ETB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editTimerRate}
                    onChange={(e) => setEditTimerRate(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onDeleteStation && stations.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('warning');
                    onDeleteStation(editingStation.id);
                    setEditingStation(null);
                  }}
                  className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                  title="Remove station"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setEditingStation(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 rounded-xl bg-[#00D4AA] text-[#0A0E1A] font-black text-xs hover:bg-[#00D4AA]/90 transition-all cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
