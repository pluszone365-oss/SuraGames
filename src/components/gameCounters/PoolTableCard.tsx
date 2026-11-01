import React, { useState } from 'react';
import {
  CircleDot,
  Users,
  Trophy,
  Plus,
  Minus,
  Coins,
  History,
  CheckCircle,
  CreditCard,
  UserPlus,
  DollarSign,
  AlertCircle,
  ArrowRightLeft,
  X,
  Wallet as WalletIcon,
  ShieldCheck,
  Award,
  Search,
  Trash2,
  Settings,
  Shield,
  Edit2,
  RotateCcw,
  Crown,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { PoolTableState, PoolPlayer, PoolGameRound } from '../../types/gameCounters';
import { Wallet } from '../../types';
import { formatETB } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';

interface PoolTableCardProps {
  poolTable: PoolTableState;
  allPoolTables?: PoolTableState[];
  wallets: Wallet[];
  onUpdatePoolTable: (updated: PoolTableState) => void;
  onDeletePoolTable?: (tableId: string) => void;
  canDeleteTable?: boolean;
  onSwitchToTable?: (targetTableId: string, player1Id?: string, player2Id?: string, nextStake?: number) => void;
  onResetTableHistory?: (tableId: string) => void;
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

export const PoolTableCard: React.FC<PoolTableCardProps> = ({
  poolTable,
  allPoolTables = [],
  wallets,
  onUpdatePoolTable,
  onDeletePoolTable,
  canDeleteTable = false,
  onSwitchToTable,
  onResetTableHistory,
  onRecordRevenue,
  onRecordExpense
}) => {
  const [betMode, setBetMode] = useState<'INDIVIDUAL' | 'POT'>('INDIVIDUAL');
  const [player1Id, setPlayer1Id] = useState<string>(poolTable.players[0]?.id || '');
  const [player2Id, setPlayer2Id] = useState<string>(poolTable.players[1]?.id || '');
  const [stakeAmount, setStakeAmount] = useState<number>(20); // Default 20 ETB
  const [customPotAmount, setCustomPotAmount] = useState<number>(100);

  // Table Configuration Modal (Name, House Fee, Delete Table)
  const [showTableConfigModal, setShowTableConfigModal] = useState(false);
  const [tempTableName, setTempTableName] = useState(poolTable.name);
  const [tempTableFee, setTempTableFee] = useState<number>(poolTable.tableFeePerGame);

  // Sync state when active poolTable prop changes
  React.useEffect(() => {
    setTempTableName(poolTable.name);
    setTempTableFee(poolTable.tableFeePerGame);
    setTempRefereeName(poolTable.refereeName || 'Referee');
    setTempRefereeFee(poolTable.refereeFeePerGame || 10);
    setTempRefereeEnabled(poolTable.refereeEnabled !== false);
    if (!poolTable.players.some(p => p.id === player1Id)) {
      setPlayer1Id(poolTable.players[0]?.id || '');
    }
    if (!poolTable.players.some(p => p.id === player2Id)) {
      setPlayer2Id(poolTable.players[1]?.id || '');
    }
  }, [poolTable.id, poolTable.name, poolTable.tableFeePerGame]);

  // Modals
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [newPlayerDeposit, setNewPlayerDeposit] = useState('200');

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositTargetPlayer, setDepositTargetPlayer] = useState<PoolPlayer | null>(null);
  const [depositAmount, setDepositAmount] = useState('100');

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlePlayer, setSettlePlayer] = useState<PoolPlayer | null>(null);

  const [showRecordFeeModal, setShowRecordFeeModal] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');

  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // Referee States & Modals
  const [showRefereePayModal, setShowRefereePayModal] = useState(false);
  const [refereePayAmount, setRefereePayAmount] = useState<string>(String(poolTable.accumulatedRefereeFee || 0));
  const [refereeWalletId, setRefereeWalletId] = useState<string>(wallets[0]?.id || 'w-cash');
  const [refereePayNotes, setRefereePayNotes] = useState('');

  const [showRefereeConfigModal, setShowRefereeConfigModal] = useState(false);
  const [tempRefereeName, setTempRefereeName] = useState(poolTable.refereeName || 'Referee');
  const [tempRefereeFee, setTempRefereeFee] = useState<number>(poolTable.refereeFeePerGame || 10);
  const [tempRefereeEnabled, setTempRefereeEnabled] = useState<boolean>(poolTable.refereeEnabled !== false);

  // Active sub-tab within single table focus: 'COUNTER' | 'BETTING' | 'PLAYERS' | 'REFEREE'
  const [activeSubTab, setActiveSubTab] = useState<'COUNTER' | 'BETTING' | 'PLAYERS' | 'REFEREE'>('COUNTER');
  const [directPayNotes, setDirectPayNotes] = useState('');

  // Active game or setup
  const activeGame = poolTable.activeGame;

  // Calculate total table fees pending in unrecorded sessions
  const pendingTableFeeCount = poolTable.roundHistory.filter(r => !r.tableFeeRecorded).length;
  const gamesPlayed = poolTable.gamesPlayed ?? pendingTableFeeCount;
  const gameHistory = poolTable.gameHistory || [];
  const totalDirectCharge = gamesPlayed * poolTable.tableFeePerGame;
  const pendingTableFeeTotal = (gamesPlayed > 0 ? gamesPlayed : pendingTableFeeCount) * poolTable.tableFeePerGame;

  // PlayStation-style Direct Stepper Handlers
  const handleIncrement = (amount = 1) => {
    triggerHaptic('medium');
    const newHistory = [...gameHistory, gamesPlayed];
    const newCount = gamesPlayed + amount;
    onUpdatePoolTable({
      ...poolTable,
      gamesPlayed: newCount,
      gameHistory: newHistory,
      unsettledTableFees: newCount * poolTable.tableFeePerGame
    });
  };

  const handleDecrement = () => {
    if (gamesPlayed <= 0) return;
    triggerHaptic('light');
    const newHistory = [...gameHistory, gamesPlayed];
    const newCount = Math.max(0, gamesPlayed - 1);
    onUpdatePoolTable({
      ...poolTable,
      gamesPlayed: newCount,
      gameHistory: newHistory,
      unsettledTableFees: newCount * poolTable.tableFeePerGame
    });
  };

  const handleUndo = () => {
    if (gameHistory.length === 0) return;
    triggerHaptic('warning');
    const prevMatches = gameHistory[gameHistory.length - 1];
    const newHistory = gameHistory.slice(0, -1);
    onUpdatePoolTable({
      ...poolTable,
      gamesPlayed: prevMatches,
      gameHistory: newHistory,
      unsettledTableFees: prevMatches * poolTable.tableFeePerGame
    });
  };

  const handleEndSession = () => {
    triggerHaptic('warning');
    if (gamesPlayed > 0 && totalDirectCharge > 0) {
      setShowRecordFeeModal(true);
    } else {
      onUpdatePoolTable({
        ...poolTable,
        gamesPlayed: 0,
        gameHistory: [],
        unsettledTableFees: 0,
        activeSessionStartTime: new Date().toISOString()
      });
    }
  };

  // 1. Start a New Pool Game Round
  const handleStartGame = () => {
    if (!player1Id || !player2Id || player1Id === player2Id) {
      alert('Please select two distinct players for the match');
      return;
    }

    const p1 = poolTable.players.find(p => p.id === player1Id);
    const p2 = poolTable.players.find(p => p.id === player2Id);
    if (!p1 || !p2) return;

    const actualStake = betMode === 'INDIVIDUAL' ? Number(stakeAmount) || 20 : Math.round((Number(customPotAmount) || 40) / 2);

    if (p1.depositedBalance < actualStake) {
      alert(`${p1.name} has only ${formatETB(p1.depositedBalance)} available. Please add deposit first.`);
      return;
    }
    if (p2.depositedBalance < actualStake) {
      alert(`${p2.name} has only ${formatETB(p2.depositedBalance)} available. Please add deposit first.`);
      return;
    }

    triggerHaptic('success');

    // Deduct stake from available deposits into active stake
    const updatedPlayers = poolTable.players.map(p => {
      if (p.id === player1Id) {
        return {
          ...p,
          depositedBalance: p.depositedBalance - actualStake,
          currentStake: actualStake
        };
      }
      if (p.id === player2Id) {
        return {
          ...p,
          depositedBalance: p.depositedBalance - actualStake,
          currentStake: actualStake
        };
      }
      return p;
    });

    const newRound: PoolGameRound = {
      id: `p-round-${Date.now()}`,
      roundNumber: poolTable.roundHistory.length + 1,
      tableFee: poolTable.tableFeePerGame,
      betMode,
      player1Id,
      player2Id,
      player1Stake: actualStake,
      player2Stake: actualStake,
      totalPot: actualStake * 2,
      status: 'IN_PROGRESS',
      tableFeeRecorded: false
    };

    onUpdatePoolTable({
      ...poolTable,
      activeGame: newRound,
      players: updatedPlayers
    });
  };

  // 2. Select Winner and Complete Game
  const handleSelectWinner = (winnerId: string) => {
    if (!activeGame) return;
    triggerHaptic('heavy');

    const loserId = winnerId === activeGame.player1Id ? activeGame.player2Id : activeGame.player1Id;
    const pot = activeGame.totalPot;
    const profit = activeGame.player1Stake; // net profit won from opponent

    // Update player balances:
    // Winner gets the total pot added back into their deposited balance + winnings stat
    // Loser currentStake is reset to 0 + losses stat increased
    const updatedPlayers = poolTable.players.map(p => {
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

    const isRefEnabled = poolTable.refereeEnabled !== false;
    const refFee = isRefEnabled ? (poolTable.refereeFeePerGame || 10) : 0;

    const completedRound: PoolGameRound = {
      ...activeGame,
      winnerId,
      loserId,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      refereeFee: refFee,
      refereeName: isRefEnabled ? (poolTable.refereeName || 'Referee') : undefined
    };

    const newCount = gamesPlayed + 1;
    onUpdatePoolTable({
      ...poolTable,
      activeGame: null,
      lastCompletedGame: completedRound,
      players: updatedPlayers,
      roundHistory: [completedRound, ...poolTable.roundHistory],
      gamesPlayed: newCount,
      gameHistory: [...gameHistory, gamesPlayed],
      unsettledTableFees: newCount * poolTable.tableFeePerGame,
      accumulatedRefereeFee: (poolTable.accumulatedRefereeFee || 0) + refFee
    });
  };

  // Start next round with new bet or updated players
  const handleStartNextRound = (p1Id: string, p2Id: string, nextStake: number) => {
    const p1 = poolTable.players.find(p => p.id === p1Id);
    const p2 = poolTable.players.find(p => p.id === p2Id);

    if (!p1 || !p2) {
      alert('Selected players were not found. Please choose players below.');
      return;
    }

    if (p1.depositedBalance < nextStake) {
      alert(`${p1.name} has only ${formatETB(p1.depositedBalance)} deposited. Needs at least ${formatETB(nextStake)} to play.`);
      return;
    }
    if (p2.depositedBalance < nextStake) {
      alert(`${p2.name} has only ${formatETB(p2.depositedBalance)} deposited. Needs at least ${formatETB(nextStake)} to play.`);
      return;
    }

    triggerHaptic('medium');

    const updatedPlayers = poolTable.players.map(p => {
      if (p.id === p1Id) {
        return {
          ...p,
          depositedBalance: p.depositedBalance - nextStake,
          currentStake: nextStake
        };
      }
      if (p.id === p2Id) {
        return {
          ...p,
          depositedBalance: p.depositedBalance - nextStake,
          currentStake: nextStake
        };
      }
      return p;
    });

    const newRound: PoolGameRound = {
      id: `p-round-${Date.now()}`,
      roundNumber: poolTable.roundHistory.length + 1,
      tableFee: poolTable.tableFeePerGame,
      betMode: 'INDIVIDUAL',
      player1Id: p1Id,
      player2Id: p2Id,
      player1Stake: nextStake,
      player2Stake: nextStake,
      totalPot: nextStake * 2,
      status: 'IN_PROGRESS',
      tableFeeRecorded: false
    };

    onUpdatePoolTable({
      ...poolTable,
      activeGame: newRound,
      lastCompletedGame: poolTable.lastCompletedGame, // Preserved until explicitly reset
      players: updatedPlayers
    });
  };

  const handleDismissLastCompleted = () => {
    triggerHaptic('light');
    onUpdatePoolTable({
      ...poolTable,
      lastCompletedGame: null
    });
  };

  // Referee Handlers
  const handlePayReferee = (e: React.FormEvent) => {
    e.preventDefault();
    const payAmt = Math.max(0, parseFloat(refereePayAmount) || 0);
    if (payAmt <= 0) return;

    triggerHaptic('success');
    const targetW = wallets.find(w => w.id === refereeWalletId) || wallets[0] || { id: 'w-cash', name: 'Main Cash Drawer' };
    const desc = `Referee payout to ${poolTable.refereeName || 'Referee'}: ${formatETB(payAmt)}${refereePayNotes.trim() ? ` (${refereePayNotes.trim()})` : ''}`;

    if (onRecordExpense) {
      onRecordExpense({
        amount: payAmt,
        walletId: targetW.id,
        description: desc,
        category: 'Gaming Operations & Referee Fees',
        stationId: poolTable.id
      });
    }

    onUpdatePoolTable({
      ...poolTable,
      accumulatedRefereeFee: Math.max(0, (poolTable.accumulatedRefereeFee || 0) - payAmt),
      totalRefereePaid: (poolTable.totalRefereePaid || 0) + payAmt
    });

    setShowRefereePayModal(false);
    setRefereePayNotes('');
  };

  const handleSaveRefereeConfig = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('success');
    onUpdatePoolTable({
      ...poolTable,
      refereeEnabled: tempRefereeEnabled,
      refereeName: tempRefereeName.trim() || 'Referee',
      refereeFeePerGame: Math.max(1, Number(tempRefereeFee) || 10)
    });
    setShowRefereeConfigModal(false);
  };

  const handleSaveTableConfig = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('success');
    onUpdatePoolTable({
      ...poolTable,
      name: tempTableName.trim() || poolTable.name,
      tableFeePerGame: Math.max(1, Number(tempTableFee) || 20)
    });
    setShowTableConfigModal(false);
  };

  const handleDeleteTable = () => {
    if (activeGame) {
      alert('Cannot delete pool table while a game is actively in progress. Please complete or cancel the game first.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete "${poolTable.name}"?`)) {
      triggerHaptic('warning');
      setShowTableConfigModal(false);
      onDeletePoolTable?.(poolTable.id);
    }
  };

  const handleDeletePlayer = (playerId: string) => {
    if (activeGame && (activeGame.player1Id === playerId || activeGame.player2Id === playerId)) {
      alert('Cannot remove player while an active game is in progress.');
      return;
    }
    triggerHaptic('warning');
    onUpdatePoolTable({
      ...poolTable,
      players: poolTable.players.filter(p => p.id !== playerId)
    });
  };

  // 3. Cancel Active Game (Refund stakes)
  const handleCancelGame = () => {
    if (!activeGame) return;
    triggerHaptic('warning');

    const updatedPlayers = poolTable.players.map(p => {
      if (p.id === activeGame.player1Id) {
        return {
          ...p,
          depositedBalance: p.depositedBalance + activeGame.player1Stake,
          currentStake: 0
        };
      }
      if (p.id === activeGame.player2Id) {
        return {
          ...p,
          depositedBalance: p.depositedBalance + activeGame.player2Stake,
          currentStake: 0
        };
      }
      return p;
    });

    onUpdatePoolTable({
      ...poolTable,
      activeGame: null,
      players: updatedPlayers
    });
  };

  // 4. Add New Player
  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    triggerHaptic('success');
    const deposit = Math.max(0, parseFloat(newPlayerDeposit) || 0);
    const newPlayer: PoolPlayer = {
      id: `p-${Date.now()}`,
      name: newPlayerName.trim(),
      phone: newPlayerPhone.trim() || undefined,
      depositedBalance: deposit,
      currentStake: 0,
      totalWinnings: 0,
      totalLosses: 0,
      gamesWonCount: 0,
      gamesLostCount: 0,
      createdAt: new Date().toISOString()
    };

    onUpdatePoolTable({
      ...poolTable,
      players: [...poolTable.players, newPlayer]
    });

    setShowAddPlayerModal(false);
    setNewPlayerName('');
    setNewPlayerPhone('');
    setNewPlayerDeposit('200');
  };

  // 5. Deposit Funds for a Player (Lounge Credit)
  const handleDepositToPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositTargetPlayer) return;

    const amt = parseFloat(depositAmount) || 0;
    if (amt <= 0) return;

    triggerHaptic('success');
    const updated = poolTable.players.map(p =>
      p.id === depositTargetPlayer.id
        ? { ...p, depositedBalance: p.depositedBalance + amt }
        : p
    );

    onUpdatePoolTable({
      ...poolTable,
      players: updated
    });

    setShowDepositModal(false);
    setDepositTargetPlayer(null);
    setDepositAmount('100');
  };

  // 6. Settle & Cash Out Player (Refund remaining balance upon exit)
  const handleSettlePlayer = () => {
    if (!settlePlayer) return;
    triggerHaptic('success');

    const updated = poolTable.players.map(p =>
      p.id === settlePlayer.id
        ? { ...p, depositedBalance: 0, currentStake: 0 }
        : p
    );

    onUpdatePoolTable({
      ...poolTable,
      players: updated
    });

    setShowSettleModal(false);
    setSettlePlayer(null);
  };

  // 7. Record Confirmed Table Fees into ERP Financial Transaction Flow
  const handleRecordTableFees = () => {
    if (pendingTableFeeTotal <= 0) return;
    triggerHaptic('success');

    const targetW = wallets.find(w => w.id === selectedWalletId) || wallets[0];
    const count = gamesPlayed > 0 ? gamesPlayed : pendingTableFeeCount;
    const desc = `${poolTable.name}: ${count} games @ ${formatETB(poolTable.tableFeePerGame)}/game${directPayNotes.trim() ? ` (${directPayNotes.trim()})` : ''}`;

    onRecordRevenue({
      amount: pendingTableFeeTotal,
      walletId: targetW?.id || 'w-cash',
      description: desc,
      category: 'Sales Revenue',
      stationId: poolTable.id
    });

    // Mark all history rounds as recorded
    const updatedHistory = poolTable.roundHistory.map(r => ({
      ...r,
      tableFeeRecorded: true
    }));

    onUpdatePoolTable({
      ...poolTable,
      roundHistory: updatedHistory,
      gamesPlayed: 0,
      gameHistory: [],
      unsettledTableFees: 0
    });

    setShowRecordFeeModal(false);
    setDirectPayNotes('');
  };

  const p1 = poolTable.players.find(p => p.id === (activeGame ? activeGame.player1Id : player1Id));
  const p2 = poolTable.players.find(p => p.id === (activeGame ? activeGame.player2Id : player2Id));

  const lastGame = poolTable.lastCompletedGame;
  const lastWinner = lastGame ? poolTable.players.find(p => p.id === lastGame.winnerId) : null;
  const lastLoser = lastGame ? poolTable.players.find(p => p.id === lastGame.loserId) : null;
  const otherTables = (allPoolTables || []).filter(t => t.id !== poolTable.id);

  const filteredPlayers = poolTable.players.filter(p => {
    if (!playerSearchQuery.trim()) return true;
    const q = playerSearchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q));
  });

  return (
    <div className="bg-[#0D1527] border border-[#1E2D4A] hover:border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-xl transition-all relative overflow-hidden space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <CircleDot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-white text-base sm:text-lg tracking-wide">
                {poolTable.name}
              </h3>
              {activeGame && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  ● GAME IN PROGRESS
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium">
              House Fee: <span className="text-emerald-400 font-bold">{formatETB(poolTable.tableFeePerGame)}</span> per completed game
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              triggerHaptic('light');
              setShowTableConfigModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
            title="Configure table name & fee rate"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Table Settings</span>
          </button>

          <button
            onClick={() => setShowAddPlayerModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Player
          </button>
        </div>
      </div>

      {/* Sub-tab Navigation: Quick Counter (Default) | Match & Betting | Players | Referee */}
      <div className="flex p-1.5 rounded-2xl bg-[#090F1C] border border-slate-800/80 max-w-xl mx-auto shadow-md">
        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveSubTab('COUNTER');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'COUNTER'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-[#0A0E1A] font-black shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CircleDot className="w-3.5 h-3.5" />
          <span>Quick Counter</span>
          {gamesPlayed > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#0A0E1A] text-emerald-400">
              {gamesPlayed}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveSubTab('BETTING');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'BETTING'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-[#0A0E1A] font-black shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Match & Betting</span>
          {activeGame && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveSubTab('PLAYERS');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'PLAYERS'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-[#0A0E1A] font-black shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Players ({poolTable.players.length})</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveSubTab('REFEREE');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'REFEREE'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Referee</span>
          {(poolTable.accumulatedRefereeFee || 0) > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300">
              {formatETB(poolTable.accumulatedRefereeFee || 0)}
            </span>
          )}
        </button>
      </div>

      {/* View 1: EASY MATCH COUNTER (PlayStation-Style Simplicity) */}
      {activeSubTab === 'COUNTER' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Central Counter Display Box (identical to PlayStation style!) */}
          <div className="bg-[#070B14]/90 border border-[#162238] rounded-2xl p-6 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute -top-12 -left-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
              GAMES PLAYED ON THIS TABLE
            </div>

            {/* Big Match Counter Number with prominent - and +1 controls */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 my-2">
              <button
                onClick={handleDecrement}
                disabled={gamesPlayed <= 0}
                aria-label="Decrease game count"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700/80 text-rose-400 font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-black/40"
              >
                <Minus className="w-7 h-7" />
              </button>

              <div className="min-w-[120px] sm:min-w-[150px] flex flex-col items-center justify-center">
                <span className="font-mono font-black text-6xl sm:text-7xl text-white tracking-tight drop-shadow-md">
                  {gamesPlayed}
                </span>
              </div>

              <button
                onClick={() => handleIncrement(1)}
                aria-label="Add 1 game"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-[#0A0E1A] font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-emerald-500/25"
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
                +2 Games
              </button>
              <button
                onClick={() => handleIncrement(5)}
                className="px-3 py-1 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                +5 Games
              </button>
              {gameHistory.length > 0 && (
                <button
                  onClick={handleUndo}
                  className="px-3 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
            </div>
          </div>

          {/* Financial Summary Bar (identical to PlayStation style!) */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">
                Total Charge ({gamesPlayed} × {formatETB(poolTable.tableFeePerGame)})
              </span>
              <span className="font-mono font-black text-2xl text-emerald-400">
                {formatETB(totalDirectCharge)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">
                Table Rate
              </span>
              <span className="font-mono font-bold text-sm text-slate-300">
                {formatETB(poolTable.tableFeePerGame)} / game
              </span>
            </div>
          </div>

          {/* Primary Action Buttons (identical to PlayStation style!) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleEndSession}
              disabled={gamesPlayed === 0}
              className="py-3 px-4 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700 text-slate-300 hover:text-white font-extrabold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
              <span>End Session</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('light');
                setShowRecordFeeModal(true);
              }}
              disabled={totalDirectCharge <= 0}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-[#0A0E1A] font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              <CreditCard className="w-4 h-4" />
              <span>Record Payment</span>
            </button>
          </div>

          {/* If Live Tournament Match is Active: Quick 1-Tap Winner Selection */}
          {activeGame && p1 && p2 && (
            <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-emerald-500/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" /> Live Match Active: Round #{activeGame.roundNumber}
                </span>
                <span className="font-mono font-black text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                  Pot: {formatETB(activeGame.totalPot)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => handleSelectWinner(activeGame.player1Id)}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer text-left"
                >
                  <span className="text-[10px] text-slate-400 font-bold block">1-Tap Winner</span>
                  <span className="font-black text-white text-sm block truncate">🏆 {p1.name}</span>
                  <span className="text-[11px] text-amber-400 font-mono font-bold block">Stake: {formatETB(activeGame.player1Stake)}</span>
                </button>

                <button
                  onClick={() => handleSelectWinner(activeGame.player2Id!)}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer text-left"
                >
                  <span className="text-[10px] text-slate-400 font-bold block">1-Tap Winner</span>
                  <span className="font-black text-white text-sm block truncate">🏆 {p2.name}</span>
                  <span className="text-[11px] text-amber-400 font-mono font-bold block">Stake: {formatETB(activeGame.player2Stake)}</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Shortcuts to other sections */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
            <button
              onClick={() => setActiveSubTab('BETTING')}
              className="text-emerald-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Switch to Player Betting & Stakes →</span>
            </button>
            <button
              onClick={() => setActiveSubTab('PLAYERS')}
              className="text-slate-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Players ({poolTable.players.length}) →</span>
            </button>
          </div>
        </div>
      )}

      {/* View 4: Referee Payout & Operator Tab */}
      {activeSubTab === 'REFEREE' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-[#131E33] border border-blue-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Table Operator / Referee: <strong className="text-white text-sm">{poolTable.refereeName || 'Referee'}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTempRefereeName(poolTable.refereeName || 'Referee');
                    setTempRefereeFee(poolTable.refereeFeePerGame || 10);
                    setTempRefereeEnabled(poolTable.refereeEnabled !== false);
                    setShowRefereeConfigModal(true);
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Configure referee payment rate"
                >
                  <Settings className="w-3.5 h-3.5 text-blue-400" />
                </button>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-mono font-black text-3xl text-blue-400">
                  {formatETB(poolTable.accumulatedRefereeFee || 0)}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  unpaid earnings ({formatETB(poolTable.refereeFeePerGame || 10)}/game)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                Total Lifetime Paid Out: <strong className="text-white">{formatETB(poolTable.totalRefereePaid || 0)}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setRefereePayAmount(String(poolTable.accumulatedRefereeFee || 0));
                setRefereeWalletId(wallets[0]?.id || 'w-cash');
                setShowRefereePayModal(true);
              }}
              disabled={(poolTable.accumulatedRefereeFee || 0) <= 0}
              className="py-3 px-5 rounded-2xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs transition-all cursor-pointer shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <Coins className="w-4 h-4" />
              <span>Record Referee Payout</span>
            </button>
          </div>
        </div>
      )}

      {/* View 2: MATCH & BETTING (Tournament Matchmaker, Pot Winner, and Table Switching) */}
      {activeSubTab === 'BETTING' && (
        <div className="space-y-4 animate-fadeIn">
          {activeGame ? (
            <div className="p-5 rounded-2xl bg-gradient-to-b from-[#0B1220] to-[#070B14] border-2 border-emerald-500/40 relative overflow-hidden shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4" /> Round #{activeGame.roundNumber} Live
            </span>
            <span className="font-mono font-black text-white text-sm bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700">
              Total Pot: {formatETB(activeGame.totalPot)}
            </span>
          </div>

          {/* Versus Visual Banner */}
          <div className="grid grid-cols-2 gap-4 text-center relative py-2">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Player 1</span>
              <p className="font-black text-white text-base truncate">{p1?.name || 'Player 1'}</p>
              <p className="text-xs text-amber-400 font-mono font-bold">Stake: {formatETB(activeGame.player1Stake)}</p>
              <button
                onClick={() => handleSelectWinner(activeGame.player1Id)}
                className="w-full mt-3 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-[#0A0E1A] font-black text-xs cursor-pointer shadow-md transition-all active:scale-95"
              >
                🏆 Winner: {p1?.name.split(' ')[0]}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Player 2</span>
              <p className="font-black text-white text-base truncate">{p2?.name || 'Player 2'}</p>
              <p className="text-xs text-amber-400 font-mono font-bold">Stake: {formatETB(activeGame.player2Stake)}</p>
              <button
                onClick={() => handleSelectWinner(activeGame.player2Id!)}
                className="w-full mt-3 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-[#0A0E1A] font-black text-xs cursor-pointer shadow-md transition-all active:scale-95"
              >
                🏆 Winner: {p2?.name.split(' ')[0]}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[11px] text-slate-400">
              Table Fee of {formatETB(activeGame.tableFee)} will be credited to house upon finish.
            </span>
            <button
              onClick={handleCancelGame}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
            >
              Cancel Match (Refund Stakes)
            </button>
          </div>

          {/* Saved Previous Winner Banner while continuing to play new game */}
          {lastGame && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-white mt-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                      Previous Winner (Round #{lastGame.roundNumber})
                    </span>
                    <span className="text-[9px] bg-slate-800 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold">
                      Saved until reset
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-black text-white">
                    🏆 {lastWinner?.name || 'Winner'} • Won {formatETB(lastGame.totalPot)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissLastCompleted}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-slate-700 shrink-0"
                title="Reset/Clear previous winner data"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>
      ) : lastGame ? (
        /* Finished Match Winner & Details Showcase */
        <div className="p-5 rounded-3xl bg-gradient-to-br from-[#0D1C2E] via-[#091522] to-[#0B1E19] border-2 border-amber-500/50 shadow-2xl space-y-4 animate-fadeIn relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
                <Crown className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Match Finished • Round #{lastGame.roundNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    🏆 Winner Decided
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Total pot awarded to winner & player balances updated
                </span>
              </div>
            </div>

            <button
              onClick={handleDismissLastCompleted}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Reset view to start with new players"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Winner and Runner-Up Details Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Winner Spotlight Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-500/15 to-amber-950/20 border-2 border-amber-500/50 shadow-lg relative space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-sm">
                  <Trophy className="w-3.5 h-3.5" /> Match Winner
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  +{formatETB(lastGame.player1Stake)} Net Won
                </span>
              </div>

              <div>
                <h4 className="font-black text-white text-lg tracking-wide truncate">
                  {lastWinner?.name || 'Winner'}
                </h4>
                <p className="text-[11px] text-amber-200/70">
                  Collected entire match pot of {formatETB(lastGame.totalPot)}
                </p>
              </div>

              <div className="pt-2 border-t border-amber-500/20 space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Prize Claimed:</span>
                  <span className="font-mono font-black text-amber-300">{formatETB(lastGame.totalPot)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-bold">New Available Balance:</span>
                  <span className="font-mono font-black text-emerald-400">{formatETB(lastWinner?.depositedBalance || 0)}</span>
                </div>
              </div>
            </div>

            {/* Runner-Up Card */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 relative space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                  Opponent (Runner-Up)
                </span>
                <span className="text-xs font-mono font-bold text-rose-400">
                  -{formatETB(lastGame.player2Stake)} Stake
                </span>
              </div>

              <div>
                <h4 className="font-bold text-slate-300 text-lg truncate">
                  {lastLoser?.name || 'Opponent'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Stake transferred to winner
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">House Table Fee:</span>
                  <span className="font-mono text-slate-300">{formatETB(lastGame.tableFee)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-bold">Remaining Balance:</span>
                  <span className="font-mono font-black text-white">{formatETB(lastLoser?.depositedBalance || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Change Bet Amount for Next Game */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" /> Change Bet for Next Match:
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                Next Pot Prize: {formatETB(stakeAmount * 2)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {[20, 30, 50, 100, 200].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setStakeAmount(amt);
                  }}
                  className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    stakeAmount === amt
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-black shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {amt} ETB
                </button>
              ))}
              <input
                type="number"
                min="5"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(Math.max(5, Number(e.target.value)))}
                className="w-20 px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center text-xs outline-none focus:border-amber-400"
                title="Custom stake"
              />
            </div>
          </div>

          {/* Action Row: Start Next Round / Switch Table / Reset */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleStartNextRound(lastGame.winnerId || player1Id, lastGame.loserId || player2Id, stakeAmount)}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-[#0A0E1A] font-black text-xs sm:text-sm cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              <CircleDot className="w-4 h-4" />
              <span>Start Next Game ({formatETB(stakeAmount)} Bet)</span>
            </button>

            {otherTables.length > 0 && onSwitchToTable && (
              <button
                type="button"
                onClick={() => {
                  const targetTbl = otherTables[0];
                  onSwitchToTable(targetTbl.id, lastGame.winnerId, lastGame.loserId, stakeAmount);
                }}
                className="py-3 px-4 rounded-2xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 hover:text-white font-extrabold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                title={`Switch players to ${otherTables[0].name}`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Switch to {otherTables[0].name.split(':')[0]}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDismissLastCompleted}
              className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
              title="Reset to player selection matchmaker"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Matchmaker</span>
            </button>
          </div>
        </div>
      ) : (
        /* Match Setup Controls */
        <div className="p-5 rounded-2xl bg-[#070B14]/80 border border-[#162238] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" /> Start New Pool Match
            </h4>

            {/* Mode Switcher */}
            <div className="flex p-0.5 rounded-xl bg-slate-900 border border-slate-800">
              <button
                onClick={() => setBetMode('INDIVIDUAL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  betMode === 'INDIVIDUAL'
                    ? 'bg-emerald-500 text-[#0A0E1A]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Equal Stakes
              </button>
              <button
                onClick={() => setBetMode('POT')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  betMode === 'POT'
                    ? 'bg-emerald-500 text-[#0A0E1A]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Custom Pot
              </button>
            </div>
          </div>

          {/* Player Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Player 1 (Cue):</label>
              <select
                value={player1Id}
                onChange={(e) => setPlayer1Id(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold outline-none focus:border-emerald-400"
              >
                {poolTable.players.map(p => (
                  <option key={p.id} value={p.id} disabled={p.id === player2Id}>
                    {p.name} (Deposit: {formatETB(p.depositedBalance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Player 2 (Opponent):</label>
              <select
                value={player2Id}
                onChange={(e) => setPlayer2Id(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold outline-none focus:border-emerald-400"
              >
                {poolTable.players.map(p => (
                  <option key={p.id} value={p.id} disabled={p.id === player1Id}>
                    {p.name} (Deposit: {formatETB(p.depositedBalance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stake / Pot Controls */}
          {betMode === 'INDIVIDUAL' ? (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold">Stake per Player (ETB):</span>
                <span className="font-mono text-emerald-400 font-bold">Total Pot: {formatETB(stakeAmount * 2)}</span>
              </div>
              <div className="flex gap-2">
                {[20, 30, 50, 100, 200].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStakeAmount(val)}
                    className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      stakeAmount === val
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {val} ETB
                  </button>
                ))}
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(Math.max(5, Number(e.target.value)))}
                  className="w-20 px-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center text-xs outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="text-xs text-slate-300 font-bold block">Total Pot Prize (ETB):</span>
              <input
                type="number"
                value={customPotAmount}
                onChange={(e) => setCustomPotAmount(Math.max(10, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm outline-none focus:border-emerald-400"
              />
            </div>
          )}

          {/* Launch Button & Switch Table option */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleStartGame}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-[#0A0E1A] font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <CircleDot className="w-4 h-4" /> Start Round & Lock Stakes
            </button>

            {otherTables.length > 0 && onSwitchToTable && (
              <button
                type="button"
                onClick={() => {
                  const targetTbl = otherTables[0];
                  onSwitchToTable(targetTbl.id, player1Id, player2Id, stakeAmount);
                }}
                className="py-3 px-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-blue-300 hover:text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                title={`Switch to ${otherTables[0].name}`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                <span>Switch to {otherTables[0].name.split(':')[0]}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )}

      {/* View 3: Player Management Table */}
      {(activeSubTab === 'PLAYERS' || activeSubTab === 'BETTING') && (
      <div className="space-y-3 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" /> Player Ledger & Available Balances
            </h4>
            <span className="text-xs text-slate-400">
              {poolTable.players.length} registered players • separate deposits & match stakes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                placeholder="Search player..."
                className="pl-8 pr-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs w-36 sm:w-44 outline-none focus:border-emerald-400"
              />
            </div>

            <button
              onClick={() => {
                triggerHaptic('light');
                setShowAddPlayerModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A0E1A] font-extrabold text-xs transition-all cursor-pointer shadow-md shadow-emerald-500/20 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Add Player</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {filteredPlayers.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#090F1C] border border-slate-800/80 text-center text-xs text-slate-400">
              No players found matching "{playerSearchQuery}". Click "+ Add Player" to register a new player.
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <div
                key={player.id}
                className="p-3.5 rounded-2xl bg-[#090F1C] border border-slate-800/80 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm truncate">{player.name}</span>
                    {player.phone && (
                      <span className="text-[10px] text-slate-400 font-mono">({player.phone})</span>
                    )}
                    {player.currentStake > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 animate-pulse">
                        Staked: {formatETB(player.currentStake)}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      W:{player.gamesWonCount} / L:{player.gamesLostCount}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-400 mt-1">
                    <span>
                      Deposit: <strong className="text-emerald-400 font-mono">{formatETB(player.depositedBalance)}</strong>
                    </span>
                    <span>
                      Won: <strong className="text-emerald-400 font-mono">+{formatETB(player.totalWinnings)}</strong>
                    </span>
                    <span>
                      Lost: <strong className="text-rose-400 font-mono">-{formatETB(player.totalLosses)}</strong>
                    </span>
                  </div>
                </div>

                {/* Action Buttons: Add Deposit, Cash Out, & Delete */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setDepositTargetPlayer(player);
                      setShowDepositModal(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
                    title="Add lounge credit deposit"
                  >
                    + Deposit
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setSettlePlayer(player);
                      setShowSettleModal(true);
                    }}
                    disabled={player.depositedBalance <= 0 || player.currentStake > 0}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 disabled:opacity-30 disabled:cursor-not-allowed text-rose-300 font-bold text-xs cursor-pointer transition-colors"
                    title="Settle balance & cash out"
                  >
                    Cash Out
                  </button>

                  {otherTables.length > 0 && onSwitchToTable && player.currentStake === 0 && (
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        onSwitchToTable(otherTables[0].id, player.id);
                      }}
                      className="px-2 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 font-bold text-[11px] cursor-pointer transition-colors flex items-center gap-1"
                      title={`Move ${player.name} to ${otherTables[0].name}`}
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span className="hidden sm:inline">To {otherTables[0].name.split(':')[0]}</span>
                    </button>
                  )}

                  {player.currentStake === 0 && (
                    <button
                      onClick={() => handleDeletePlayer(player.id)}
                      className="p-1.5 rounded-xl bg-slate-800/40 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remove player"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {/* Recent Rounds Log */}
      {poolTable.roundHistory.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold flex items-center gap-1.5 text-slate-300">
              <History className="w-3.5 h-3.5 text-emerald-400" /> Recent Completed Rounds
            </span>
            <div className="flex items-center gap-2">
              <span>{poolTable.roundHistory.length} total games</span>
              {onResetTableHistory && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Reset completed round history for ${poolTable.name}?`)) {
                      onResetTableHistory(poolTable.id);
                    }
                  }}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-[10px] cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Log</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {poolTable.roundHistory.slice(0, 5).map((r) => {
              const winP = poolTable.players.find(p => p.id === r.winnerId);
              const loseP = poolTable.players.find(p => p.id === r.loserId);
              return (
                <div
                  key={r.id}
                  className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-400">#{r.roundNumber}</span>
                    <span className="text-white font-semibold">{winP?.name || 'Winner'}</span>
                    <span className="text-slate-500">defeated</span>
                    <span className="text-slate-400">{loseP?.name || 'Opponent'}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-amber-400 font-bold">{formatETB(r.totalPot)} pot</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      r.tableFeeRecorded
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {r.tableFeeRecorded ? 'Fee Settled' : 'Fee Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal 1: Add New Player */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B0F19] border border-emerald-500/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" /> Add Pool Player
              </h3>
              <button
                onClick={() => setShowAddPlayerModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPlayer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Player Full Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ermias (Lucky 8)"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Phone Number (Optional):</label>
                <input
                  type="tel"
                  placeholder="09..."
                  value={newPlayerPhone}
                  onChange={(e) => setNewPlayerPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Initial Deposit (ETB):</label>
                <input
                  type="number"
                  min="0"
                  value={newPlayerDeposit}
                  onChange={(e) => setNewPlayerDeposit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold outline-none focus:border-emerald-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Player deposit is held for their game stakes and not counted as business revenue.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlayerModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A0E1A] font-extrabold cursor-pointer"
                >
                  Register Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Deposit to Player */}
      {showDepositModal && depositTargetPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B0F19] border border-emerald-500/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base">
                Add Deposit • {depositTargetPlayer.name}
              </h3>
              <button
                onClick={() => setShowDepositModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDepositToPlayer} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                Current Available Deposit: <strong className="text-emerald-400 font-mono">{formatETB(depositTargetPlayer.depositedBalance)}</strong>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Deposit Amount (ETB):</label>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-base outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A0E1A] font-extrabold"
                >
                  Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Settle & Cash Out */}
      {showSettleModal && settlePlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B0F19] border border-amber-500/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base">
                Cash Out • {settlePlayer.name}
              </h3>
              <button
                onClick={() => setShowSettleModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Winnings:</span>
                <span className="text-emerald-400 font-mono font-bold">+{formatETB(settlePlayer.totalWinnings)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Losses:</span>
                <span className="text-rose-400 font-mono font-bold">-{formatETB(settlePlayer.totalLosses)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm">
                <span className="font-bold text-white">Refund to Player:</span>
                <span className="font-mono font-black text-emerald-400 text-lg">
                  {formatETB(settlePlayer.depositedBalance)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSettleModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSettlePlayer}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0A0E1A] font-extrabold text-xs"
              >
                Confirm Cash Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Record Table Fees to ERP */}
      {showRecordFeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B0F19] border border-emerald-500/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" /> Record Table Revenue
              </h3>
              <button
                onClick={() => setShowRecordFeeModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Completed Games:</span>
                <span className="text-white font-bold">{gamesPlayed > 0 ? gamesPlayed : pendingTableFeeCount} games</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fee per Game:</span>
                <span className="text-white font-bold">{formatETB(poolTable.tableFeePerGame)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm">
                <span className="font-bold text-white">Total Income to Log:</span>
                <span className="font-mono font-black text-emerald-400 text-xl">
                  {formatETB(pendingTableFeeTotal)}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 text-xs mb-1">
                Receive Into Wallet:
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
                        ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <WalletIcon className="w-4 h-4 text-emerald-400" />
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{w.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{w.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Note / Reference (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Paid in cash, customer name..."
                value={directPayNotes}
                onChange={(e) => setDirectPayNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium text-xs outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRecordFeeModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordTableFees}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A0E1A] font-extrabold text-xs"
              >
                Confirm & Log to ERP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Pay Referee Payout Modal */}
      {showRefereePayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B0F19] border border-blue-500/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Coins className="w-5 h-5 text-blue-400" /> Pay Table Referee
              </h3>
              <button
                onClick={() => setShowRefereePayModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayReferee} className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Referee:</span>
                  <strong className="text-white">{poolTable.refereeName || 'Referee'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Unpaid Accumulated:</span>
                  <strong className="text-blue-400 font-mono">{formatETB(poolTable.accumulatedRefereeFee || 0)}</strong>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Paid to date:</span>
                  <span className="text-slate-400 font-mono">{formatETB(poolTable.totalRefereePaid || 0)}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Payout Amount (ETB):</label>
                <input
                  type="number"
                  min="1"
                  max={poolTable.accumulatedRefereeFee || 0}
                  required
                  value={refereePayAmount}
                  onChange={(e) => setRefereePayAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-base outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Disburse From Wallet:</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {wallets.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setRefereeWalletId(w.id);
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                        refereeWalletId === w.id
                          ? 'bg-blue-500/15 border-blue-400 text-white shadow-md'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <WalletIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold truncate">{w.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Notes (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly settlement, evening shift..."
                  value={refereePayNotes}
                  onChange={(e) => setRefereePayNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-blue-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRefereePayModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-extrabold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Confirm Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Configure Referee Settings Modal */}
      {showRefereeConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B0F19] border border-blue-500/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" /> Referee Payment Settings
              </h3>
              <button
                onClick={() => setShowRefereeConfigModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRefereeConfig} className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div>
                  <span className="font-bold text-white block">Enable Referee Fee</span>
                  <span className="text-[10px] text-slate-400">Track per-match payment for table operator</span>
                </div>
                <input
                  type="checkbox"
                  checked={tempRefereeEnabled}
                  onChange={(e) => setTempRefereeEnabled(e.target.checked)}
                  className="w-4 h-4 accent-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Referee / Operator Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dawit, Kassahun (Referee)..."
                  value={tempRefereeName}
                  onChange={(e) => setTempRefereeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-blue-400 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Referee Fee per Game (ETB):</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={tempRefereeFee}
                  onChange={(e) => setTempRefereeFee(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold outline-none focus:border-blue-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Each completed pool match automatically accumulates this fee to the referee's unpaid balance.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRefereeConfigModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-extrabold cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Table Settings & Rate */}
      {showTableConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" /> Pool Table Settings
              </h3>
              <button
                onClick={() => setShowTableConfigModal(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTableConfig} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Table Name / Label:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Table 1: Diamond Arena, VIP Pool Table..."
                  value={tempTableName}
                  onChange={(e) => setTempTableName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-emerald-400 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Table Fee per Completed Game (ETB):</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={tempTableFee}
                  onChange={(e) => setTempTableFee(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold outline-none focus:border-emerald-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Default rate is 20 ETB per completed game, recorded to your ERP revenue when confirmed.
                </p>
              </div>

              {canDeleteTable && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-rose-300 block">Remove This Table</span>
                    <span className="text-[10px] text-slate-400">Permanently remove this table from the lounge</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteTable}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              )}

              {onResetTableHistory && poolTable.roundHistory.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">Reset Round History</span>
                    <span className="text-[10px] text-slate-400">Clear past rounds log ({poolTable.roundHistory.length} completed rounds)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Clear round history and reset match counters for ${poolTable.name}?`)) {
                        onResetTableHistory(poolTable.id);
                        setShowTableConfigModal(false);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTableConfigModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer"
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
