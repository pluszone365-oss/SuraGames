import React, { useState } from 'react';
import {
  CircleDot,
  Plus,
  Minus,
  RotateCcw,
  CreditCard,
  Trophy,
  Users,
  Settings,
  Sparkles,
  Flame,
  ArrowRight,
  Crown,
  ChevronRight,
  Shield,
  Coins,
  X,
  Wallet as WalletIcon
} from 'lucide-react';
import { PoolTableState, PoolPlayer, PoolGameRound } from '../../types/gameCounters';
import { Wallet } from '../../types';
import { formatETB } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';

interface PoolDashboardMatrixProps {
  tables: PoolTableState[];
  wallets: Wallet[];
  onUpdateTable: (updated: PoolTableState) => void;
  onSelectTableForFocus: (tableId: string) => void;
  onAddTable: () => void;
  onDeleteTable?: (tableId: string) => void;
  onRecordRevenue: (data: {
    amount: number;
    walletId: string;
    description: string;
    category: string;
    stationId: string;
  }) => void;
  onRecordExpense?: (data: {
    amount: number;
    walletId: string;
    description: string;
    category: string;
    stationId: string;
  }) => void;
}

export const PoolDashboardMatrix: React.FC<PoolDashboardMatrixProps> = ({
  tables,
  wallets,
  onUpdateTable,
  onSelectTableForFocus,
  onAddTable,
  onDeleteTable,
  onRecordRevenue,
  onRecordExpense
}) => {
  const [selectedTableForPay, setSelectedTableForPay] = useState<PoolTableState | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(wallets[0]?.id || 'w-cash');
  const [customerNote, setCustomerNote] = useState<string>('');

  // 1. Direct +1 / +X increment like PlayStation
  const handleIncrement = (table: PoolTableState, amount = 1) => {
    triggerHaptic('medium');
    const currentCount = table.gamesPlayed ?? (table.roundHistory?.filter(r => !r.tableFeeRecorded).length || 0);
    const history = table.gameHistory || [];
    const newCount = currentCount + amount;

    onUpdateTable({
      ...table,
      gamesPlayed: newCount,
      gameHistory: [...history, currentCount],
      unsettledTableFees: newCount * table.tableFeePerGame
    });
  };

  // 2. Direct Decrement
  const handleDecrement = (table: PoolTableState) => {
    const currentCount = table.gamesPlayed ?? (table.roundHistory?.filter(r => !r.tableFeeRecorded).length || 0);
    if (currentCount <= 0) return;

    triggerHaptic('light');
    const history = table.gameHistory || [];
    const newCount = Math.max(0, currentCount - 1);

    onUpdateTable({
      ...table,
      gamesPlayed: newCount,
      gameHistory: [...history, currentCount],
      unsettledTableFees: newCount * table.tableFeePerGame
    });
  };

  // 3. Undo
  const handleUndo = (table: PoolTableState) => {
    const history = table.gameHistory || [];
    if (history.length === 0) return;

    triggerHaptic('warning');
    const prevCount = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    onUpdateTable({
      ...table,
      gamesPlayed: prevCount,
      gameHistory: newHistory,
      unsettledTableFees: prevCount * table.tableFeePerGame
    });
  };

  // 4. Quick Winner Selection directly on card
  const handleQuickWinner = (table: PoolTableState, winnerId: string) => {
    if (!table.activeGame) return;
    triggerHaptic('heavy');

    const activeGame = table.activeGame;
    const loserId = winnerId === activeGame.player1Id ? activeGame.player2Id : activeGame.player1Id;
    const pot = activeGame.totalPot;
    const profit = activeGame.player1Stake;

    const updatedPlayers = table.players.map(p => {
      if (p.id === winnerId) {
        return {
          ...p,
          depositedBalance: p.depositedBalance + pot,
          currentStake: 0,
          totalWinnings: p.totalWinnings + profit,
          gamesWonCount: p.gamesWonCount + 1
        };
      }
      if (p.id === loserId) {
        return {
          ...p,
          currentStake: 0,
          totalLosses: p.totalLosses + profit,
          gamesLostCount: p.gamesLostCount + 1
        };
      }
      return p;
    });

    const isRefEnabled = table.refereeEnabled !== false;
    const refFee = isRefEnabled ? (table.refereeFeePerGame || 10) : 0;

    const completedRound: PoolGameRound = {
      ...activeGame,
      winnerId,
      loserId,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      refereeFee: refFee,
      refereeName: isRefEnabled ? (table.refereeName || 'Referee') : undefined
    };

    const currentCount = table.gamesPlayed ?? (table.roundHistory?.filter(r => !r.tableFeeRecorded).length || 0);
    const history = table.gameHistory || [];
    const newCount = currentCount + 1;

    onUpdateTable({
      ...table,
      activeGame: null,
      lastCompletedGame: completedRound,
      players: updatedPlayers,
      roundHistory: [completedRound, ...table.roundHistory],
      gamesPlayed: newCount,
      gameHistory: [...history, currentCount],
      unsettledTableFees: newCount * table.tableFeePerGame,
      accumulatedRefereeFee: (table.accumulatedRefereeFee || 0) + refFee
    });
  };

  // 5. Confirm Payment
  const handleConfirmPayment = () => {
    if (!selectedTableForPay) return;
    const count = selectedTableForPay.gamesPlayed ?? (selectedTableForPay.roundHistory?.filter(r => !r.tableFeeRecorded).length || 0);
    const totalCharge = count * selectedTableForPay.tableFeePerGame;
    if (totalCharge <= 0) return;

    triggerHaptic('success');
    const targetW = wallets.find(w => w.id === selectedWalletId) || wallets[0] || { id: 'w-cash', name: 'Main Cash Drawer' };
    const desc = `${selectedTableForPay.name}: ${count} pool games @ ${formatETB(selectedTableForPay.tableFeePerGame)}/game${customerNote.trim() ? ` (${customerNote.trim()})` : ''}`;

    onRecordRevenue({
      amount: totalCharge,
      walletId: targetW.id,
      description: desc,
      category: 'Sales Revenue',
      stationId: selectedTableForPay.id
    });

    onUpdateTable({
      ...selectedTableForPay,
      gamesPlayed: 0,
      gameHistory: [],
      unsettledTableFees: 0,
      roundHistory: selectedTableForPay.roundHistory.map(r => ({ ...r, tableFeeRecorded: true }))
    });

    setSelectedTableForPay(null);
    setCustomerNote('');
  };

  return (
    <div className="space-y-4">
      {/* Tables Grid - 2 Column or 1 Column responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tables.map((table) => {
          const games = table.gamesPlayed ?? (table.roundHistory?.filter(r => !r.tableFeeRecorded).length || 0);
          const history = table.gameHistory || [];
          const totalFee = games * table.tableFeePerGame;
          const activeGame = table.activeGame;
          const p1 = table.players.find(p => p.id === activeGame?.player1Id);
          const p2 = table.players.find(p => p.id === activeGame?.player2Id);
          const lastGame = table.lastCompletedGame;
          const lastWinner = table.players.find(p => p.id === lastGame?.winnerId);

          return (
            <div
              key={table.id}
              className={`rounded-3xl border transition-all duration-200 overflow-hidden relative flex flex-col justify-between ${
                activeGame
                  ? 'bg-gradient-to-b from-[#091522] to-[#0A111F] border-emerald-500/50 shadow-xl shadow-emerald-500/10'
                  : games > 0
                  ? 'bg-[#0D1527] border-teal-500/40 shadow-xl shadow-black/40'
                  : 'bg-[#090F1C] border-[#1E2D4A] hover:border-slate-700 shadow-md'
              }`}
            >
              {/* Card Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0 shadow-md shadow-emerald-500/10">
                    <CircleDot className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-white text-base sm:text-lg truncate tracking-tight">
                        {table.name}
                      </h3>
                      {activeGame ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">
                          <Flame className="w-3 h-3 text-emerald-400" /> LIVE MATCH
                        </span>
                      ) : games > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                          {games} UNPAID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                          READY
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      Rate: <span className="text-emerald-400 font-bold">{formatETB(table.tableFeePerGame)}</span> per game • Referee: <span className="text-blue-300">{table.refereeName || 'Referee'}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onSelectTableForFocus(table.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Open full table details, player ledger & settings"
                >
                  <span>Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Main Body: Easy Match Counter (PlayStation Style) */}
              <div className="p-4 sm:p-5 space-y-4">
                {/* Central Counter Box */}
                <div className="bg-[#070B14]/90 border border-[#162238] rounded-2xl p-4 sm:p-5 text-center relative overflow-hidden">
                  <div className="absolute -top-10 -left-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    GAMES PLAYED
                  </span>

                  {/* Big Number and - / + buttons */}
                  <div className="flex items-center justify-center gap-4 sm:gap-6 my-1">
                    <button
                      onClick={() => handleDecrement(table)}
                      disabled={games <= 0}
                      aria-label="Decrease game count"
                      className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700 text-rose-400 font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-black/40"
                    >
                      <Minus className="w-6 h-6" />
                    </button>

                    <div className="min-w-[100px] flex flex-col items-center justify-center">
                      <span className="font-mono font-black text-5xl sm:text-6xl text-white tracking-tight drop-shadow-md">
                        {games}
                      </span>
                    </div>

                    <button
                      onClick={() => handleIncrement(table, 1)}
                      aria-label="Add 1 game"
                      className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-[#0A0E1A] font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-emerald-500/25"
                    >
                      <Plus className="w-7 h-7" />
                    </button>
                  </div>

                  {/* Quick Stepper Pills & Undo */}
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => handleIncrement(table, 2)}
                      className="px-2.5 py-1 rounded-xl bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700/60 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      +2 Games
                    </button>
                    <button
                      onClick={() => handleIncrement(table, 3)}
                      className="px-2.5 py-1 rounded-xl bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700/60 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      +3 Games
                    </button>
                    {history.length > 0 && (
                      <button
                        onClick={() => handleUndo(table)}
                        className="px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Undo last change"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Undo</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* If Live Tournament Match is Active: Show 1-Tap Winner Buttons */}
                {activeGame && p1 && p2 && (
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/40 space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5" /> Round #{activeGame.roundNumber} Stakes:
                      </span>
                      <span className="font-mono font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                        Pot: {formatETB(activeGame.totalPot)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center">
                      <button
                        onClick={() => handleQuickWinner(table, p1.id)}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer text-left group"
                      >
                        <span className="text-[10px] text-slate-400 block font-bold">Declare Winner</span>
                        <span className="font-black text-white text-sm block truncate group-hover:text-emerald-300">
                          🏆 {p1.name}
                        </span>
                        <span className="text-[10px] text-amber-400 font-mono font-bold block">
                          Stake: {formatETB(activeGame.player1Stake)}
                        </span>
                      </button>

                      <button
                        onClick={() => handleQuickWinner(table, p2.id)}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer text-left group"
                      >
                        <span className="text-[10px] text-slate-400 block font-bold">Declare Winner</span>
                        <span className="font-black text-white text-sm block truncate group-hover:text-emerald-300">
                          🏆 {p2.name}
                        </span>
                        <span className="text-[10px] text-amber-400 font-mono font-bold block">
                          Stake: {formatETB(activeGame.player2Stake)}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* If Match Just Finished: Quick Winner Banner */}
                {!activeGame && lastGame && lastWinner && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-amber-400 uppercase block">Last Winner:</span>
                        <span className="text-xs font-black text-white truncate block">
                          {lastWinner.name} (Won {formatETB(lastGame.totalPot)})
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectTableForFocus(table.id)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      Next Game →
                    </button>
                  </div>
                )}

                {/* Financial Summary Bar */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#090F1C] border border-slate-800/80">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Total Billable ({games} × {formatETB(table.tableFeePerGame)})
                    </span>
                    <span className="font-mono font-black text-xl text-emerald-400">
                      {formatETB(totalFee)}
                    </span>
                  </div>

                  {table.refereeEnabled !== false && (
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        Referee Accrued
                      </span>
                      <span className="font-mono font-bold text-xs text-blue-300">
                        {formatETB(table.accumulatedRefereeFee || 0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950/40 grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => onSelectTableForFocus(table.id)}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Match & Players</span>
                </button>

                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedTableForPay(table);
                  }}
                  disabled={totalFee <= 0}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0E1A] font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Record Payment</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Modal (Identical to PlayStation payment flow) */}
      {selectedTableForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Record Table Payment
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {selectedTableForPay.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTableForPay(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Fee Callout */}
            <div className="bg-[#070B14] border border-emerald-500/30 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Total Fee to Collect
              </span>
              <span className="font-mono font-black text-3xl text-emerald-400 block my-1">
                {formatETB(
                  (selectedTableForPay.gamesPlayed ?? (selectedTableForPay.roundHistory?.filter(r => !r.tableFeeRecorded).length || 0)) *
                  selectedTableForPay.tableFeePerGame
                )}
              </span>
              <span className="text-xs text-slate-400">
                {(selectedTableForPay.gamesPlayed ?? (selectedTableForPay.roundHistory?.filter(r => !r.tableFeeRecorded).length || 0))} games completed @ {formatETB(selectedTableForPay.tableFeePerGame)}/game
              </span>
            </div>

            {/* Wallet Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Deposit Into Wallet:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedWalletId(w.id);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      selectedWalletId === w.id
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-xs truncate block">{w.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{w.type}</span>
                    </div>
                    {selectedWalletId === w.id && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Note / Customer Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Customer Note / Reference (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Table 1 walk-in players, cash paid..."
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium text-xs outline-none focus:border-emerald-400"
              />
            </div>

            {/* Confirm Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTableForPay(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#0A0E1A] font-black text-xs transition-all cursor-pointer shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-4 h-4" />
                <span>Confirm & Record</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
