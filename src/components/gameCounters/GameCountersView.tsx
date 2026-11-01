import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Gamepad2,
  CircleDot,
  Trophy,
  Plus,
  Flame,
  Sparkles,
  LayoutList,
  Focus,
  List
} from 'lucide-react';
import {
  PlayStationStation,
  GameCountersState,
  PoolBettingCardState,
  PoolBettingAdminSettings
} from '../../types/gameCounters';
import { Wallet, UserProfile } from '../../types';
import { PlayStationDashboardMatrix } from './PlayStationDashboardMatrix';
import { MobilePoolBettingCard } from './MobilePoolBettingCard';
import {
  loadGameCountersState,
  saveGameCountersState,
  createNewPsStation,
  loadPoolBettingCards,
  savePoolBettingCards,
  loadPoolBettingAdminSettings,
  savePoolBettingAdminSettings,
  createNewPoolBettingCard
} from '../../lib/gameCountersStore';
import { triggerHaptic } from '../../lib/haptics';

interface GameCountersViewProps {
  wallets: Wallet[];
  currentUser: UserProfile;
  onBackToDashboard: () => void;
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

export const GameCountersView: React.FC<GameCountersViewProps> = ({
  wallets,
  currentUser,
  onBackToDashboard,
  onRecordRevenue,
  onRecordExpense
}) => {
  const [gameState, setGameState] = useState<GameCountersState>(() => loadGameCountersState());
  const [activeTab, setActiveTab] = useState<'PLAYSTATION' | 'POOL'>('PLAYSTATION');

  // Mobile-First Pool Betting Cards State (Pool 1, Pool 2, Pool 3...)
  const [poolBettingCards, setPoolBettingCards] = useState<PoolBettingCardState[]>(() => loadPoolBettingCards());
  const [poolAdminSettings, setPoolAdminSettings] = useState<PoolBettingAdminSettings>(() => loadPoolBettingAdminSettings());
  const [activePoolBettingCardId, setActivePoolBettingCardId] = useState<string>(
    () => loadPoolBettingCards()[0]?.id || 'pool-card-1'
  );
  const [poolBettingDisplayMode, setPoolBettingDisplayMode] = useState<'LIST' | 'FOCUS'>('LIST');

  const handleUpdatePoolBettingCard = (updated: PoolBettingCardState) => {
    setPoolBettingCards(prev => {
      const next = prev.map(c => c.id === updated.id ? updated : c);
      savePoolBettingCards(next);
      return next;
    });
  };

  const handleUpdatePoolAdminSettings = (newSettings: PoolBettingAdminSettings) => {
    setPoolAdminSettings(newSettings);
    savePoolBettingAdminSettings(newSettings);
  };

  const handleAddPoolBettingCard = () => {
    triggerHaptic('medium');
    const nextNum = poolBettingCards.length + 1;
    const newCard = createNewPoolBettingCard(nextNum, poolAdminSettings);
    const next = [...poolBettingCards, newCard];
    setPoolBettingCards(next);
    setActivePoolBettingCardId(newCard.id);
    savePoolBettingCards(next);
  };

  const handleDeletePoolBettingCard = (poolId: string) => {
    if (poolBettingCards.length <= 1) return;
    triggerHaptic('warning');
    const next = poolBettingCards.filter(c => c.id !== poolId);
    setPoolBettingCards(next);
    setActivePoolBettingCardId(next[0]?.id || '');
    savePoolBettingCards(next);
  };

  // Add & Delete PS Stations
  const handleAddPsStation = () => {
    triggerHaptic('medium');
    const newStation = createNewPsStation(gameState.psStations.length);
    setGameState(prev => ({
      ...prev,
      psStations: [...prev.psStations, newStation]
    }));
  };

  const handleDeletePsStation = (stationId: string) => {
    triggerHaptic('warning');
    setGameState(prev => ({
      ...prev,
      psStations: prev.psStations.filter(s => s.id !== stationId)
    }));
  };

  // Persist PlayStation and general counters state changes
  useEffect(() => {
    saveGameCountersState(gameState);
  }, [gameState]);

  // Touch Swipe-Left to return to Dashboard gesture support
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Check if horizontal swipe left (negative deltaX >= 75px) with low vertical movement
    if (deltaX <= -75 && Math.abs(deltaX) > Math.abs(deltaY) * 1.8) {
      triggerHaptic('medium');
      onBackToDashboard();
    }
  };

  // Station updates
  const handleUpdatePsStation = (updated: PlayStationStation) => {
    setGameState(prev => ({
      ...prev,
      psStations: prev.psStations.map(s => s.id === updated.id ? updated : s)
    }));
  };

  // Record revenue wrapper to update counters daily metric
  const handleRecordRevenueWrapper = (data: {
    amount: number;
    walletId: string;
    description: string;
    category: string;
    stationId: string;
  }) => {
    setGameState(prev => ({
      ...prev,
      totalDailyRevenueRecorded: prev.totalDailyRevenueRecorded + data.amount
    }));
    onRecordRevenue(data);
  };

  // Metrics for Top Arcade Overview
  const totalPsMatches = gameState.psStations.reduce((sum, s) => sum + s.matchesPlayed, 0);
  const totalPoolGames = poolBettingCards.reduce((acc, c) => acc + (c.basicGamesPlayed || 0) + c.roundHistory.length, 0);
  const livePoolsCount = poolBettingCards.filter(c => (c.basicGamesPlayed || 0) > 0 || (c.players.reduce((s, p) => s + (p.currentBet || 0), 0) > 0)).length;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="space-y-6 animate-fadeIn select-none"
    >
      {/* Top Navigation Bar & Arcade Title */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          onClick={() => {
            triggerHaptic('light');
            onBackToDashboard();
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white text-xs sm:text-sm font-extrabold transition-all cursor-pointer shadow-md group"
        >
          <ArrowLeft className="w-4 h-4 text-[#00D4AA] group-hover:-translate-x-1 transition-transform" />
          <span>Dashboard</span>
          <span className="hidden sm:inline text-[10px] text-slate-400 font-normal">
            (or swipe left)
          </span>
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30">
            <Flame className="w-3.5 h-3.5 text-[#00D4AA]" /> ARCADE LIVE CONTROL
          </span>
        </div>
      </div>

      {/* Arcade Dashboard Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B1528] via-[#0E1F3D] to-[#0A1830] border border-[#00D4AA]/30 p-5 sm:p-6 shadow-2xl">
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-[#00D4AA]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-[#3B82F6]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#00D4AA] uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" /> PlusZone Station Operations
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Game Counters & Match Trackers
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Live arcade operations: PlayStation consoles and simple pool tables (20 ETB fee & betting).
            </p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">PS Matches</span>
              <span className="font-mono font-black text-lg sm:text-xl text-[#00D4AA]">
                {totalPsMatches}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Pool Tables</span>
              <span className="font-mono font-black text-lg sm:text-xl text-emerald-400">
                {poolBettingCards.length}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Pool Games</span>
              <span className="font-mono font-black text-lg sm:text-xl text-teal-400">
                {totalPoolGames}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Tabs Switcher - PlayStation & Pool Tables */}
      <div className="flex p-1.5 rounded-2xl bg-[#090F1C] border border-slate-800/80 max-w-md mx-auto shadow-lg">
        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('PLAYSTATION');
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'PLAYSTATION'
              ? 'bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] text-[#0A0E1A] shadow-md shadow-[#00D4AA]/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>PlayStation</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('POOL');
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'POOL'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-[#0A0E1A] shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CircleDot className="w-4 h-4" />
          <span>Pool Tables</span>
          {livePoolsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#0A0E1A] text-emerald-400 animate-pulse">
              {livePoolsCount} LIVE
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: PlayStation Match Counter - Direct Matrix Grid */}
      {activeTab === 'PLAYSTATION' && (
        <PlayStationDashboardMatrix
          stations={gameState.psStations}
          timedStations={gameState.timedStations}
          wallets={wallets}
          onUpdateStation={handleUpdatePsStation}
          onAddStation={handleAddPsStation}
          onDeleteStation={handleDeletePsStation}
          onRecordRevenue={handleRecordRevenueWrapper}
        />
      )}

      {/* Tab 2: Pool Section - Direct Mobile Pool Betting Cards (Pool 1, Pool 2, Pool 3...) */}
      {activeTab === 'POOL' && (
        <div className="space-y-4">
          {/* Top Controls: Active Pools Switcher, View Mode, and Add Pool */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl">
            {/* Pool Card Switcher Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-xs font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tables:</span>
              </span>
              {poolBettingCards.map((pbc) => {
                const isSelected = activePoolBettingCardId === pbc.id;
                const isBetting = pbc.gameMode === 'BETTING';
                const pot = pbc.players.reduce((sum, p) => sum + (p.currentBet || 0), 0);
                const badgeText = isBetting
                  ? `${pot} ETB`
                  : (pbc.basicGamesPlayed || 0) > 0
                  ? `${pbc.basicGamesPlayed} gms`
                  : 'Ready';

                return (
                  <button
                    key={pbc.id}
                    onClick={() => {
                      triggerHaptic('light');
                      setActivePoolBettingCardId(pbc.id);
                      if (poolBettingDisplayMode === 'LIST') {
                        const el = document.getElementById(`pool-table-${pbc.id}`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-black whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span>{pbc.title}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {badgeText}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Mode Toggle (List View vs Focus Card) & Add Pool Button */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <div className="flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setPoolBettingDisplayMode('LIST');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    poolBettingDisplayMode === 'LIST'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="List view of all pool tables"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>List View</span>
                </button>

                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setPoolBettingDisplayMode('FOCUS');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    poolBettingDisplayMode === 'FOCUS'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Focus single pool card"
                >
                  <Focus className="w-3.5 h-3.5" />
                  <span>Focus Card</span>
                </button>
              </div>

              <button
                onClick={handleAddPoolBettingCard}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Pool</span>
              </button>
            </div>
          </div>

          {/* Pool Cards Display: List View (Vertical Stack) or Focus View */}
          {poolBettingDisplayMode === 'LIST' ? (
            <div className="flex flex-col space-y-4 max-w-2xl mx-auto animate-fadeIn">
              {poolBettingCards.map((pbc, idx) => (
                <div key={pbc.id} id={`pool-table-${pbc.id}`} className="relative">
                  {poolBettingCards.length > 1 && (
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-2 pb-1.5">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Table #{idx + 1}: <strong className="text-white">{pbc.title}</strong>
                      </span>
                      <span>
                        {pbc.gameMode === 'BETTING' ? '🏆 Betting Mode' : '🎱 Basic Table Fee'}
                      </span>
                    </div>
                  )}

                  <MobilePoolBettingCard
                    pool={pbc}
                    adminSettings={poolAdminSettings}
                    wallets={wallets}
                    onUpdatePool={handleUpdatePoolBettingCard}
                    onUpdateAdminSettings={handleUpdatePoolAdminSettings}
                    onRecordRevenue={handleRecordRevenueWrapper}
                    onDeletePool={poolBettingCards.length > 1 ? handleDeletePoolBettingCard : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            (() => {
              const activeCard = poolBettingCards.find(c => c.id === activePoolBettingCardId) || poolBettingCards[0];
              if (!activeCard) return null;
              return (
                <div className="max-w-2xl mx-auto animate-fadeIn">
                  <MobilePoolBettingCard
                    pool={activeCard}
                    adminSettings={poolAdminSettings}
                    wallets={wallets}
                    onUpdatePool={handleUpdatePoolBettingCard}
                    onUpdateAdminSettings={handleUpdatePoolAdminSettings}
                    onRecordRevenue={handleRecordRevenueWrapper}
                    onDeletePool={poolBettingCards.length > 1 ? handleDeletePoolBettingCard : undefined}
                  />
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
};
