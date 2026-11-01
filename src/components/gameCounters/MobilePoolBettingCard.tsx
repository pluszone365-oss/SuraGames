import React, { useState } from 'react';
import {
  Trophy,
  CircleDot,
  Plus,
  Minus,
  Trash2,
  Settings,
  RotateCcw,
  Wallet as WalletIcon,
  Crown,
  CheckCircle2,
  AlertCircle,
  X,
  UserPlus,
  Flame,
  History,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Eye,
  Check,
  Coins,
  Edit2,
  CheckCircle
} from 'lucide-react';
import {
  PoolBettingCardState,
  PoolBettingPlayer,
  PoolBettingAdminSettings,
  PoolBettingRoundSettlement,
  PoolBettingTransaction,
  PoolBettingPlayerHistory
} from '../../types/gameCounters';
import { Wallet } from '../../types';
import { formatETB } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import { createNewPoolBettingPlayer } from '../../lib/gameCountersStore';

interface MobilePoolBettingCardProps {
  pool: PoolBettingCardState;
  adminSettings: PoolBettingAdminSettings;
  wallets: Wallet[];
  onUpdatePool: (updated: PoolBettingCardState) => void;
  onUpdateAdminSettings: (settings: PoolBettingAdminSettings) => void;
  onRecordRevenue: (data: {
    amount: number;
    walletId: string;
    description: string;
    category: string;
    stationId: string;
  }) => void;
  onDeletePool?: (poolId: string) => void;
}

export const MobilePoolBettingCard: React.FC<MobilePoolBettingCardProps> = ({
  pool,
  adminSettings,
  wallets,
  onUpdatePool,
  onUpdateAdminSettings,
  onRecordRevenue,
  onDeletePool
}) => {
  // Current game mode: 'BASIC' (20 ETB table fee per game, no bet) or 'BETTING' (player stakes, pot & ref)
  const mode = pool.gameMode || 'BASIC';
  const basicFee = pool.basicTableFeePerGame || 20;
  const basicGames = pool.basicGamesPlayed || 0;
  const basicTotalFee = basicGames * basicFee;

  // Modals state
  const [showBasicSettleModal, setShowBasicSettleModal] = useState<boolean>(false);
  const [basicSettleWalletId, setBasicSettleWalletId] = useState<string>(wallets[0]?.id || 'w-cash');
  const [basicPlayerNames, setBasicPlayerNames] = useState<string>(pool.basicPlayerNames || 'Open Play');
  const [isEditingPlayerNames, setIsEditingPlayerNames] = useState<boolean>(false);

  // Betting mode state
  const [showAddPlayerModal, setShowAddPlayerModal] = useState<boolean>(false);
  const [newPlayerName, setNewPlayerName] = useState<string>('');
  const [newPlayerDeposit, setNewPlayerDeposit] = useState<string>('200');
  const [newPlayerBet, setNewPlayerBet] = useState<string>((pool.defaultGamePrice || 20).toString());
  const [newPlayerError, setNewPlayerError] = useState<string | null>(null);

  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [depositTargetPlayer, setDepositTargetPlayer] = useState<PoolBettingPlayer | null>(null);
  const [depositAmountInput, setDepositAmountInput] = useState<string>('100');

  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const [isConfirmingSettlement, setIsConfirmingSettlement] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);

  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [adminPriceInput, setAdminPriceInput] = useState<string>(adminSettings.defaultGamePrice.toString());
  const [adminRefereeFeeInput, setAdminRefereeFeeInput] = useState<string>(adminSettings.defaultRefereeFee.toString());
  const [adminConfigurableToggle, setAdminConfigurableToggle] = useState<boolean>(adminSettings.isRefereeFeeConfigurable);

  // Safe Reset Modal (Keeps players & deposits by default!)
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [playerToRemove, setPlayerToRemove] = useState<PoolBettingPlayer | null>(null);

  // Player Match Detail Modal
  const [inspectingPlayer, setInspectingPlayer] = useState<PoolBettingPlayer | null>(null);

  // Expandable Match History Feed toggle on the card
  const [isMatchHistoryExpanded, setIsMatchHistoryExpanded] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Unfinished game warning dialog state
  const [unfinishedWarning, setUnfinishedWarning] = useState<{
    title: string;
    message: string;
    details?: string;
    resolveLabel?: string;
    onResolve?: () => void;
    proceedLabel?: string;
    onProceed: () => void;
  } | null>(null);

  // ----------------------------------------------------------------------
  // BETTING MODE CALCULATIONS & COMMON VALUES
  // ----------------------------------------------------------------------
  const totalPot = pool.players.reduce((sum, p) => sum + (p.currentBet || 0), 0);
  const activePlayersCount = pool.players.filter(p => (p.currentBet || 0) > 0).length;
  const currentRefereeFee = Math.min(pool.refereeFee, totalPot);
  const winnerPayout = Math.max(0, totalPot - currentRefereeFee);

  // Common active bet detection across players
  const activeBets = pool.players.map(p => p.currentBet || 0).filter(b => b > 0);
  const commonRoundBet = activeBets.length > 0 ? activeBets[0] : (pool.currentRoundBet || pool.defaultGamePrice || 20);

  // Round Bet Change & Inquire states
  const [nextRoundBetMode, setNextRoundBetMode] = useState<'SAME' | 'CHANGE'>('SAME');
  const [nextRoundBetValue, setNextRoundBetValue] = useState<string>((commonRoundBet || 20).toString());
  const [showChangeRoundBetModal, setShowChangeRoundBetModal] = useState<boolean>(false);
  const [changeRoundBetAmountInput, setChangeRoundBetAmountInput] = useState<string>((commonRoundBet || 20).toString());

  // Switch between Basic (20 birr table fee) and Betting (Player Pot) with Unfinished Game Warning
  const handleToggleMode = (targetMode: 'BASIC' | 'BETTING') => {
    triggerHaptic('light');

    // Case 1: Switching to BETTING, but BASIC pool has an unfinished/unsettled game session
    if (targetMode === 'BETTING' && basicGames > 0) {
      setUnfinishedWarning({
        title: `Unfinished Basic Game on ${pool.title}`,
        message: `There are ${basicGames} games played on ${pool.title} with ${formatETB(basicTotalFee)} in unsettled table fees.`,
        details: `Starting a Bet Pool game now will leave this ${formatETB(basicTotalFee)} table fee unsettled in your business records.`,
        resolveLabel: `Settle ${formatETB(basicTotalFee)} to Wallet First`,
        onResolve: () => setShowBasicSettleModal(true),
        proceedLabel: 'Switch to Bet Pool Anyway',
        onProceed: () => {
          onUpdatePool({ ...pool, gameMode: 'BETTING' });
        }
      });
      return;
    }

    // Case 2: Switching to BASIC, but BETTING pool has an active unfinished round with stakes
    if (targetMode === 'BASIC' && totalPot > 0 && activePlayersCount > 0) {
      const activeNames = pool.players.filter(p => (p.currentBet || 0) > 0).map(p => p.name).join(', ');
      setUnfinishedWarning({
        title: `Unfinished Bet Pool Game on ${pool.title}`,
        message: `Round #${pool.currentRoundNumber} has an active pot of ${formatETB(totalPot)} with ${activePlayersCount} players (${activeNames}). The winner has not been crowned yet!`,
        details: `Switching to Basic Pool before finishing the round leaves active player bets on the table.`,
        resolveLabel: `Finish Round & Crown Winner First`,
        onResolve: () => setShowSettlementModal(true),
        proceedLabel: 'Switch to Basic Pool Anyway',
        onProceed: () => {
          onUpdatePool({ ...pool, gameMode: 'BASIC' });
        }
      });
      return;
    }

    onUpdatePool({
      ...pool,
      gameMode: targetMode
    });
  };

  // ----------------------------------------------------------------------
  // BASIC POOL GAME HANDLERS (20 ETB Table Fee / Game, No Bet)
  // ----------------------------------------------------------------------
  const executeAddBasicGame = () => {
    triggerHaptic('success');
    const newCount = basicGames + 1;
    const history = [...(pool.basicGamesHistory || []), newCount];
    onUpdatePool({
      ...pool,
      basicGamesPlayed: newCount,
      basicGamesHistory: history
    });
    showToast(`+1 Game recorded. House Table Fee: ${formatETB(newCount * basicFee)}`);
  };

  const handleAddBasicGame = () => {
    // Check if previous betting round is unfinished with active pot
    if (totalPot > 0 && activePlayersCount > 0) {
      triggerHaptic('warning');
      const activeNames = pool.players.filter(p => (p.currentBet || 0) > 0).map(p => p.name).join(', ');
      setUnfinishedWarning({
        title: `Unfinished Bet Pool Round on ${pool.title}`,
        message: `Round #${pool.currentRoundNumber} has an active betting pot of ${formatETB(totalPot)} with ${activePlayersCount} players (${activeNames}). The previous betting game was not finished!`,
        details: `Please crown the round winner or resolve the betting pot before starting basic pool games.`,
        resolveLabel: `Finish Round & Crown Winner`,
        onResolve: () => {
          onUpdatePool({ ...pool, gameMode: 'BETTING' });
          setShowSettlementModal(true);
        },
        proceedLabel: `Proceed with +1 Basic Game`,
        onProceed: () => {
          executeAddBasicGame();
        }
      });
      return;
    }

    executeAddBasicGame();
  };

  const handleUndoBasicGame = () => {
    if (basicGames <= 0) return;
    triggerHaptic('light');
    const newCount = Math.max(0, basicGames - 1);
    const history = (pool.basicGamesHistory || []).slice(0, -1);
    onUpdatePool({
      ...pool,
      basicGamesPlayed: newCount,
      basicGamesHistory: history
    });
  };

  const handleResetBasicGames = () => {
    triggerHaptic('warning');
    onUpdatePool({
      ...pool,
      basicGamesPlayed: 0,
      basicGamesHistory: []
    });
    showToast('Counter reset to 0 games.');
  };

  const handleSavePlayerNames = () => {
    onUpdatePool({
      ...pool,
      basicPlayerNames: basicPlayerNames.trim() || 'Open Play'
    });
    setIsEditingPlayerNames(false);
  };

  const handleConfirmBasicSettle = () => {
    if (basicTotalFee <= 0) return;
    triggerHaptic('success');

    const selectedWallet = wallets.find(w => w.id === basicSettleWalletId) || wallets[0];
    onRecordRevenue({
      amount: basicTotalFee,
      walletId: selectedWallet.id,
      description: `Pool Table Fee - ${pool.title} (${basicGames} games @ ${basicFee} ETB) [${pool.basicPlayerNames || 'Casual'}]`,
      category: 'Pool Table Fee',
      stationId: pool.id
    });

    onUpdatePool({
      ...pool,
      basicGamesPlayed: 0,
      basicGamesHistory: []
    });

    setShowBasicSettleModal(false);
    showToast(`Recorded ${formatETB(basicTotalFee)} to ${selectedWallet.name}!`);
  };

  // Confirm bet stays the same for current round
  const handleConfirmSameBet = () => {
    triggerHaptic('success');
    onUpdatePool({
      ...pool,
      currentRoundBet: commonRoundBet,
      roundBetConfirmedForRound: pool.currentRoundNumber
    });
    showToast(`✓ Round #${pool.currentRoundNumber} bet confirmed: ${commonRoundBet} ETB each.`);
  };

  // Set uniform bet for all players in this round
  const handleApplyUniformRoundBet = (amount: number) => {
    const validAmount = Math.max(0, amount);
    triggerHaptic('success');
    const updatedPlayers = pool.players.map(p => ({
      ...p,
      currentBet: Math.min(p.depositBalance, validAmount)
    }));

    onUpdatePool({
      ...pool,
      currentRoundBet: validAmount,
      roundBetConfirmedForRound: pool.currentRoundNumber,
      players: updatedPlayers
    });
    setShowChangeRoundBetModal(false);
    showToast(`Round #${pool.currentRoundNumber} bet set to ${validAmount} ETB for all players.`);
  };

  const handleOpenAddPlayer = () => {
    triggerHaptic('light');
    if (basicGames > 0) {
      setUnfinishedWarning({
        title: `Unfinished Basic Game on ${pool.title}`,
        message: `There are ${basicGames} games played with ${formatETB(basicTotalFee)} in unpaid table fees on ${pool.title}.`,
        details: `Settle the unpaid basic games or confirm before adding players to a new betting game on this pool.`,
        resolveLabel: `Settle ${formatETB(basicTotalFee)} Now`,
        onResolve: () => setShowBasicSettleModal(true),
        proceedLabel: 'Add Player Anyway',
        onProceed: () => setShowAddPlayerModal(true)
      });
      return;
    }
    setShowAddPlayerModal(true);
  };

  const handleOpenChangeBet = () => {
    triggerHaptic('light');
    setChangeRoundBetAmountInput((commonRoundBet || 20).toString());
    if (basicGames > 0) {
      setUnfinishedWarning({
        title: `Unfinished Basic Game on ${pool.title}`,
        message: `There are ${basicGames} games played with ${formatETB(basicTotalFee)} in unpaid table fees on ${pool.title}.`,
        details: `Settle the unpaid basic pool games to the wallet or confirm before changing round bets.`,
        resolveLabel: `Settle ${formatETB(basicTotalFee)} Now`,
        onResolve: () => setShowBasicSettleModal(true),
        proceedLabel: 'Change Bet Anyway',
        onProceed: () => setShowChangeRoundBetModal(true)
      });
      return;
    }
    setShowChangeRoundBetModal(true);
  };

  const handleAdjustBet = (playerId: string, delta: number) => {
    triggerHaptic('light');
    const updatedPlayers = pool.players.map(p => {
      if (p.id !== playerId) return p;
      const step = 10;
      const nextBet = Math.max(0, Math.min(p.depositBalance, p.currentBet + delta * step));
      return { ...p, currentBet: nextBet };
    });
    onUpdatePool({ ...pool, players: updatedPlayers });
  };

  const handleAddPlayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewPlayerError(null);
    const name = newPlayerName.trim();
    if (!name) {
      setNewPlayerError('Player name is required');
      return;
    }
    const deposit = Math.max(0, parseFloat(newPlayerDeposit) || 0);
    const initialBet = Math.min(deposit, Math.max(0, parseFloat(newPlayerBet) || pool.defaultGamePrice));

    triggerHaptic('success');
    const newPlayer = createNewPoolBettingPlayer(name, deposit, initialBet);
    const updatedPlayers = [...pool.players, newPlayer];

    onUpdatePool({
      ...pool,
      players: updatedPlayers
    });

    setNewPlayerName('');
    setNewPlayerDeposit('200');
    setNewPlayerBet((pool.defaultGamePrice || 20).toString());
    setShowAddPlayerModal(false);
    showToast(`Added ${name} to Round #${pool.currentRoundNumber}.`);
  };

  const handleConfirmDeposit = () => {
    if (!depositTargetPlayer) return;
    const amount = Math.max(0, parseFloat(depositAmountInput) || 0);
    if (amount <= 0) return;

    triggerHaptic('success');
    const updatedPlayers = pool.players.map(p => {
      if (p.id !== depositTargetPlayer.id) return p;
      const nextBal = p.depositBalance + amount;
      return { ...p, depositBalance: nextBal };
    });

    onUpdatePool({ ...pool, players: updatedPlayers });
    setShowDepositModal(false);
    setDepositTargetPlayer(null);
    setDepositAmountInput('100');
    showToast(`Deposited ${formatETB(amount)} to ${depositTargetPlayer.name}.`);
  };

  const handleRemovePlayer = (player: PoolBettingPlayer) => {
    triggerHaptic('warning');
    const updatedPlayers = pool.players.filter(p => p.id !== player.id);
    onUpdatePool({ ...pool, players: updatedPlayers });
    setPlayerToRemove(null);
    showToast(`Removed ${player.name} from ${pool.title}.`);
  };

  // ----------------------------------------------------------------------
  // WINNER SETTLEMENT EXECUTION (Records every round & player stats)
  // ----------------------------------------------------------------------
  const handleExecuteSettlement = () => {
    if (!selectedWinnerId || isSettling) return;
    const winner = pool.players.find(p => p.id === selectedWinnerId);
    if (!winner) return;

    setIsSettling(true);
    triggerHaptic('success');

    const roundNumber = pool.currentRoundNumber;
    const roundId = `round-${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Determine target bet for next round based on user choice
    const targetNewBet = nextRoundBetMode === 'CHANGE'
      ? Math.max(0, parseFloat(nextRoundBetValue) || pool.defaultGamePrice || 20)
      : commonRoundBet;

    // Deduct bets from all players, credit winner, record match logs
    const updatedPlayers = pool.players.map(p => {
      const bet = p.currentBet || 0;
      const isWinner = p.id === winner.id;
      const balanceAfterDeduction = Math.max(0, p.depositBalance - bet);
      const finalBalance = isWinner ? balanceAfterDeduction + winnerPayout : balanceAfterDeduction;

      // Next bet for new round:
      // If operator selected 'SAME', retain this player's previous round bet (clamped to their new deposit)
      // If operator selected 'CHANGE', apply the new uniform bet (clamped to their deposit)
      const nextPlayerBet = nextRoundBetMode === 'CHANGE'
        ? Math.min(finalBalance, targetNewBet)
        : Math.min(finalBalance, bet > 0 ? bet : targetNewBet);

      // Track rounds played and won rounds list
      const prevPlayed = p.roundsPlayedCount || (p.gamesWonCount + p.gamesLostCount) || 0;
      const roundsPlayedCount = prevPlayed + (bet > 0 ? 1 : 0);
      const wonRoundsList = isWinner
        ? [...(p.wonRoundsList || []), roundNumber]
        : (p.wonRoundsList || []);

      const newHistoryItem: PoolBettingPlayerHistory = {
        roundId,
        roundNumber,
        poolId: pool.id,
        poolNumber: pool.poolNumber,
        betAmount: bet,
        isWinner,
        payoutAmount: isWinner ? winnerPayout : 0,
        timestamp
      };

      return {
        ...p,
        depositBalance: finalBalance,
        currentBet: nextPlayerBet,
        roundsPlayedCount,
        gamesWonCount: isWinner ? p.gamesWonCount + 1 : p.gamesWonCount,
        gamesLostCount: !isWinner && bet > 0 ? p.gamesLostCount + 1 : p.gamesLostCount,
        wonRoundsList,
        totalWonAmount: isWinner ? p.totalWonAmount + winnerPayout : p.totalWonAmount,
        totalLostAmount: !isWinner ? p.totalLostAmount + bet : p.totalLostAmount,
        winLossHistory: [newHistoryItem, ...(p.winLossHistory || [])]
      };
    });

    // Record Referee Fee to ERP Wallet if > 0
    if (currentRefereeFee > 0) {
      const selectedWallet = wallets[0] || { id: 'w-cash', name: 'Cash' };
      onRecordRevenue({
        amount: currentRefereeFee,
        walletId: selectedWallet.id,
        description: `Referee Fee - ${pool.title} Round #${roundNumber} (Winner: ${winner.name})`,
        category: 'Referee Fee',
        stationId: pool.id
      });
    }

    const settlementRecord: PoolBettingRoundSettlement = {
      roundId,
      roundNumber,
      completedAt: timestamp,
      winnerId: winner.id,
      winnerName: winner.name,
      totalPot,
      refereeFee: currentRefereeFee,
      winnerPayout,
      playerBets: pool.players.map(p => ({
        playerId: p.id,
        playerName: p.name,
        betAmount: p.currentBet || 0,
        depositBefore: p.depositBalance,
        depositAfter: p.id === winner.id
          ? Math.max(0, p.depositBalance - (p.currentBet || 0)) + winnerPayout
          : Math.max(0, p.depositBalance - (p.currentBet || 0))
      })),
      isSettled: true,
      revenueRecorded: currentRefereeFee > 0
    };

    onUpdatePool({
      ...pool,
      currentRoundNumber: roundNumber + 1,
      currentRoundBet: targetNewBet,
      roundBetConfirmedForRound: roundNumber + 1,
      players: updatedPlayers, // All players remain at table with updated deposits!
      lastSettlement: settlementRecord, // Saved until explicitly reset
      roundHistory: [settlementRecord, ...pool.roundHistory]
    });

    setIsSettling(false);
    setIsConfirmingSettlement(false);
    setShowSettlementModal(false);
    setSelectedWinnerId(null);
    setNextRoundBetMode('SAME');
    showToast(`🏆 Round #${roundNumber} Won by ${winner.name}! Round #${roundNumber + 1} started with ${targetNewBet} ETB bets.`);
  };

  // ----------------------------------------------------------------------
  // SAFE RESET HANDLERS (NEVER WIPE PLAYERS BY DEFAULT)
  // ----------------------------------------------------------------------
  const executeResetMatchScoresKeepPlayers = () => {
    triggerHaptic('warning');
    // Keep all players and their deposit balances! Only reset round counter and match scores
    const resetPlayers = pool.players.map(p => ({
      ...p,
      gamesWonCount: 0,
      gamesLostCount: 0,
      roundsPlayedCount: 0,
      wonRoundsList: [],
      winLossHistory: [],
      totalWonAmount: 0,
      totalLostAmount: 0,
      currentBet: Math.min(p.depositBalance, pool.defaultGamePrice)
    }));

    onUpdatePool({
      ...pool,
      currentRoundNumber: 1,
      roundHistory: [],
      lastSettlement: null,
      players: resetPlayers // PLAYERS & BALANCES ARE KEPT INTACT!
    });

    setShowResetModal(false);
    showToast(`Match reset to Round #1. All ${resetPlayers.length} players & deposits preserved!`);
  };

  const handleResetMatchScoresKeepPlayers = () => {
    if (totalPot > 0 && activePlayersCount > 0) {
      setUnfinishedWarning({
        title: `Unfinished Bet Round on ${pool.title}`,
        message: `Round #${pool.currentRoundNumber} has an active betting pot of ${formatETB(totalPot)} with ${activePlayersCount} players. The round is not finished!`,
        details: `Resetting will clear the active round. Crown the round winner first to distribute payouts, or proceed to reset.`,
        resolveLabel: 'Finish Round & Crown Winner First',
        onResolve: () => {
          setShowResetModal(false);
          setShowSettlementModal(true);
        },
        proceedLabel: 'Reset Match Anyway',
        onProceed: () => {
          executeResetMatchScoresKeepPlayers();
        }
      });
      return;
    }

    if (basicGames > 0) {
      setUnfinishedWarning({
        title: `Unfinished Basic Game on ${pool.title}`,
        message: `There are ${basicGames} basic pool games played with ${formatETB(basicTotalFee)} in unpaid table fees.`,
        details: `Settle the unpaid fees to wallet first or proceed to reset.`,
        resolveLabel: `Settle ${formatETB(basicTotalFee)} to Wallet First`,
        onResolve: () => {
          setShowResetModal(false);
          setShowBasicSettleModal(true);
        },
        proceedLabel: 'Reset Match Anyway',
        onProceed: () => {
          executeResetMatchScoresKeepPlayers();
        }
      });
      return;
    }

    executeResetMatchScoresKeepPlayers();
  };

  const handleResetWinnerBannerOnly = () => {
    triggerHaptic('light');
    onUpdatePool({
      ...pool,
      lastSettlement: null
    });
    setShowResetModal(false);
    showToast('Previous winner banner cleared.');
  };

  const executeWipeAllPlayers = () => {
    triggerHaptic('warning');
    onUpdatePool({
      ...pool,
      players: [],
      currentRoundNumber: 1,
      roundHistory: [],
      lastSettlement: null
    });
    setShowResetModal(false);
    showToast('Table cleared. All players removed.');
  };

  const handleWipeAllPlayers = () => {
    if ((totalPot > 0 && activePlayersCount > 0) || basicGames > 0) {
      setUnfinishedWarning({
        title: `Unfinished Games on ${pool.title}`,
        message: `This pool table has active games in progress (${basicGames > 0 ? `${basicGames} basic games (${formatETB(basicTotalFee)})` : ''}${basicGames > 0 && totalPot > 0 ? ' and ' : ''}${totalPot > 0 ? `${formatETB(totalPot)} in active betting pot` : ''}).`,
        details: `Wiping the table will clear all active sessions and player deposits.`,
        resolveLabel: basicGames > 0 ? `Settle ${formatETB(basicTotalFee)} First` : `Finish Round #${pool.currentRoundNumber}`,
        onResolve: () => {
          setShowResetModal(false);
          if (basicGames > 0) setShowBasicSettleModal(true);
          else setShowSettlementModal(true);
        },
        proceedLabel: 'Wipe All Anyway',
        onProceed: () => {
          executeWipeAllPlayers();
        }
      });
      return;
    }

    executeWipeAllPlayers();
  };

  const handleSaveAdminSettings = () => {
    const price = Math.max(1, parseFloat(adminPriceInput) || 20);
    const refFee = Math.max(0, parseFloat(adminRefereeFeeInput) || 10);
    const newSettings: PoolBettingAdminSettings = {
      defaultGamePrice: price,
      defaultRefereeFee: refFee,
      isRefereeFeeConfigurable: adminConfigurableToggle
    };
    onUpdateAdminSettings(newSettings);
    onUpdatePool({
      ...pool,
      defaultGamePrice: price,
      refereeFee: refFee
    });
    setShowAdminModal(false);
    showToast('Admin settings saved.');
  };

  return (
    <div className="bg-[#0D1527] border border-[#1E2D4A] rounded-3xl p-4 sm:p-5 shadow-xl relative overflow-hidden transition-all">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Card Header: Title, Status Badge, Reset, Admin Settings, and Delete */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black">
            <CircleDot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-white text-base tracking-tight">{pool.title}</h3>
              {mode === 'BASIC' ? (
                basicGames > 0 ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                    {basicGames} {basicGames === 1 ? 'GAME' : 'GAMES'} LIVE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400">
                    READY
                  </span>
                )
              ) : (
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  CURRENTLY IN ROUND #{pool.currentRoundNumber}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {mode === 'BASIC'
                ? `Casual pool • ${basicFee} ETB table fee per game`
                : `${pool.players.length} players • ${pool.roundHistory.length} rounds settled`}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {/* Safe Reset Button (Never wipes players by default!) */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setShowResetModal(true);
            }}
            title="Reset match / clear history"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setShowAdminModal(true);
            }}
            title="Configure table & fees"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          {onDeletePool && (
            <button
              onClick={() => onDeletePool(pool.id)}
              title="Delete pool table"
              className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Visual Notice: Unfinished game from alternate mode */}
      {mode === 'BASIC' && totalPot > 0 && activePlayersCount > 0 && (
        <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-amber-950/70 to-orange-950/70 border border-amber-500/50 flex items-center justify-between gap-2.5 text-xs animate-fadeIn shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                Unfinished Bet Pool Game
              </span>
              <p className="text-xs text-amber-200 truncate">
                Round #{pool.currentRoundNumber} has an unsettled pot of <strong className="text-white font-mono">{formatETB(totalPot)}</strong> ({activePlayersCount} players).
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onUpdatePool({ ...pool, gameMode: 'BETTING' });
              setShowSettlementModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs shrink-0 cursor-pointer shadow-md shadow-amber-500/20 hover:opacity-95"
          >
            Finish Round
          </button>
        </div>
      )}

      {mode === 'BETTING' && basicGames > 0 && (
        <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-teal-950/70 border border-emerald-500/50 flex items-center justify-between gap-2.5 text-xs animate-fadeIn shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">
                Unfinished Basic Pool Session
              </span>
              <p className="text-xs text-emerald-200 truncate">
                <strong className="text-white">{basicGames}</strong> games played with <strong className="text-white font-mono">{formatETB(basicTotalFee)}</strong> unpaid table fees.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowBasicSettleModal(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs shrink-0 cursor-pointer shadow-md shadow-emerald-500/20 hover:opacity-95"
          >
            Settle Fee
          </button>
        </div>
      )}

      {/* Mode Switcher Pill (Basic 20 Birr Fee vs Betting Pot) */}
      <div className="flex p-1 rounded-xl bg-slate-950 border border-slate-800/80 mb-3">
        <button
          onClick={() => handleToggleMode('BASIC')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mode === 'BASIC'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CircleDot className="w-3.5 h-3.5" />
          <span>Basic Game (20 Birr Fee)</span>
        </button>

        <button
          onClick={() => handleToggleMode('BETTING')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mode === 'BETTING'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Betting Pot</span>
          {totalPot > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950 text-amber-300 font-bold">
              {totalPot} ETB
            </span>
          )}
        </button>
      </div>

      {/* ==================================================================== */}
      {/* MODE 1: BASIC POOL GAME (No Bet, Table Fee 20 ETB / Game)            */}
      {/* ==================================================================== */}
      {mode === 'BASIC' && (
        <div className="space-y-3 animate-fadeIn">
          {/* Optional player names bar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
            <span className="text-slate-400 font-bold">Matchup / Players:</span>
            {isEditingPlayerNames ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={basicPlayerNames}
                  onChange={(e) => setBasicPlayerNames(e.target.value)}
                  placeholder="e.g. Yared vs Dawit"
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold text-xs outline-none focus:border-emerald-400 w-36"
                />
                <button
                  onClick={handleSavePlayerNames}
                  className="px-2 py-1 rounded bg-emerald-500 text-slate-950 font-black text-[11px] cursor-pointer"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingPlayerNames(true)}
                className="text-slate-200 hover:text-emerald-400 font-bold cursor-pointer flex items-center gap-1"
              >
                <span>{pool.basicPlayerNames || 'Open Play'}</span>
                <span className="text-[10px] text-slate-500">(edit)</span>
              </button>
            )}
          </div>

          {/* Large PlayStation-style Digital Game Counter Display */}
          <div className="bg-[#060A14] border border-slate-800/90 rounded-2xl p-4 text-center relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <span>Games Played</span>
              <span>Table Rate: {basicFee} ETB / game</span>
              <span>Total House Fee</span>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="font-mono font-black text-4xl text-white tracking-tight">
                  {basicGames}
                </span>
                <span className="text-xs text-slate-400 font-bold">games</span>
              </div>

              <div className="text-right">
                <span className="font-mono font-black text-2xl sm:text-3xl text-emerald-400">
                  {formatETB(basicTotalFee)}
                </span>
                <span className="block text-[10px] text-slate-400">unsettled fee</span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Big Green +1 Game, Undo, Reset */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={handleAddBasicGame}
              className="col-span-3 h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>+1 Game ({basicFee} Birr)</span>
            </button>

            <button
              onClick={handleUndoBasicGame}
              disabled={basicGames <= 0}
              title="Undo last game"
              className="h-12 rounded-2xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
            >
              <Minus className="w-4 h-4" />
              <span>-1</span>
            </button>
          </div>

          {/* Settle Table Fee & Reset Row */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                triggerHaptic('medium');
                setShowBasicSettleModal(true);
              }}
              disabled={basicTotalFee <= 0}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-black text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <WalletIcon className="w-3.5 h-3.5" />
              <span>Settle {formatETB(basicTotalFee)} to Wallet</span>
            </button>

            {basicGames > 0 && (
              <button
                onClick={handleResetBasicGames}
                title="Reset counter"
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 border border-slate-700 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 2: BETTING POT (Player Deposits, Pot, Referee Fee, Winner)       */}
      {/* ==================================================================== */}
      {mode === 'BETTING' && (
        <div className="space-y-3 animate-fadeIn">
          {/* Prominent Current Round Banner */}
          <div className="px-3 py-2 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#0D1B33] to-slate-900 border border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block leading-tight">
                  Match In Progress
                </span>
                <span className="text-xs sm:text-sm font-black text-white">
                  Currently in Round #{pool.currentRoundNumber}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-bold">Past Matches</span>
              <span className="text-xs font-mono font-bold text-amber-300">
                {pool.roundHistory.length} completed
              </span>
            </div>
          </div>

          {/* Saved Previous Winner Data Banner (Retained until explicitly reset) */}
          {pool.lastSettlement && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-amber-300 font-black uppercase tracking-wider block">
                    Winner of Round #{pool.lastSettlement.roundNumber}
                  </span>
                  <span className="text-xs font-black text-white truncate block">
                    {pool.lastSettlement.winnerName} won <span className="text-amber-400 font-mono">{formatETB(pool.lastSettlement.winnerPayout)}</span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleResetWinnerBannerOnly()}
                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-black shrink-0 transition-colors cursor-pointer"
              >
                Clear Banner
              </button>
            </div>
          )}

          {/* Round Bet Inquiry Banner: In any round the bet might change so ask if bet is same */}
          {pool.players.length > 0 && pool.roundBetConfirmedForRound !== pool.currentRoundNumber && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-md animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
                      Round #{pool.currentRoundNumber} Bet Check
                    </span>
                    <span className="text-xs font-bold text-slate-300">
                      Current: <strong className="text-amber-300 font-mono">{commonRoundBet} ETB</strong>
                    </span>
                  </div>
                  <p className="text-xs text-white font-medium truncate mt-0.5">
                    Is the bet the same for Round #{pool.currentRoundNumber}?
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleConfirmSameBet}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md shadow-emerald-500/10 flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Keep Same</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChangeRoundBetAmountInput((commonRoundBet || 20).toString());
                    setShowChangeRoundBetModal(true);
                  }}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Change Bet</span>
                </button>
              </div>
            </div>
          )}

          {/* Compact 4-Cell Betting Summary */}
          <div className="grid grid-cols-4 gap-1.5 p-2.5 rounded-2xl bg-[#060A14] border border-slate-800 text-center">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Pot</span>
              <span className="font-mono font-black text-xs sm:text-sm text-emerald-400">
                {formatETB(totalPot)}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">In Round</span>
              <span className="font-mono font-black text-xs sm:text-sm text-white">
                {activePlayersCount} of {pool.players.length}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Ref Fee</span>
              <span className="font-mono font-black text-xs sm:text-sm text-blue-400">
                {formatETB(currentRefereeFee)}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Winner Takes</span>
              <span className="font-mono font-black text-xs sm:text-sm text-amber-400">
                {formatETB(winnerPayout)}
              </span>
            </div>
          </div>

          {/* Action Row: Add Player, Change Bet & Finish Round */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleOpenAddPlayer}
              className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Player</span>
            </button>

            <button
              onClick={handleOpenChangeBet}
              className="py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/30 text-amber-300 hover:text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Change bet amount for this round"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Change Bet</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('medium');
                setNextRoundBetValue((commonRoundBet || 20).toString());
                setNextRoundBetMode('SAME');
                setShowSettlementModal(true);
              }}
              disabled={totalPot <= 0 || activePlayersCount < 2}
              className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 font-black text-xs disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 transition-all cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Finish Round</span>
            </button>
          </div>

          {/* Players List with Detailed Match Record (Who won which round & how many played) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-1 text-slate-400 font-bold">
              <span>Players in Round #{pool.currentRoundNumber}:</span>
              <span>{pool.players.length} Registered</span>
            </div>

            {pool.players.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center">
                <p className="text-xs text-slate-400">No players in this pool yet.</p>
                <button
                  onClick={handleOpenAddPlayer}
                  className="mt-1.5 text-xs text-emerald-400 font-bold hover:underline cursor-pointer"
                >
                  + Add First Player
                </button>
              </div>
            ) : (
              pool.players.map((p) => {
                const bet = p.currentBet || 0;
                const playedCount = p.roundsPlayedCount || (p.gamesWonCount + p.gamesLostCount) || 0;
                const wonRounds = p.wonRoundsList || [];

                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                  >
                    {/* Top Row: Player Identity, Current Round Badge, and Inspect/Remove */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => setInspectingPlayer(p)}
                          className="font-black text-white text-xs sm:text-sm truncate hover:text-emerald-400 transition-colors text-left flex items-center gap-1.5 cursor-pointer"
                          title="Click to view player round history"
                        >
                          <span>{p.name}</span>
                          <Eye className="w-3 h-3 text-slate-500 hover:text-emerald-400" />
                        </button>

                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                          In Round #{pool.currentRoundNumber}
                        </span>
                      </div>

                      <button
                        onClick={() => setPlayerToRemove(p)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove player"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Middle Row: Match Record (Rounds Played, Wins, Won rounds list) */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-900/60 p-1.5 rounded-xl border border-slate-800/80">
                      <span className="font-bold text-slate-300">
                        {playedCount} {playedCount === 1 ? 'round' : 'rounds'} played
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="font-bold text-emerald-400">
                        {p.gamesWonCount}W
                      </span>
                      <span className="text-slate-500">/</span>
                      <span className="font-bold text-slate-400">
                        {p.gamesLostCount}L
                      </span>

                      {/* Display which rounds this player won */}
                      {wonRounds.length > 0 && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Trophy className="w-2.5 h-2.5 text-amber-400" />
                            <span>Won {wonRounds.map(r => `R${r}`).join(', ')}</span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Bottom Row: Deposit Balance & Bet Stepper for Current Round */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-300 font-mono font-bold">
                          Deposit: <span className="text-emerald-400">{formatETB(p.depositBalance)}</span>
                        </span>
                        <button
                          onClick={() => {
                            setDepositTargetPlayer(p);
                            setShowDepositModal(true);
                          }}
                          className="text-[10px] text-emerald-400 font-bold hover:underline cursor-pointer"
                        >
                          +Deposit
                        </button>
                      </div>

                      {/* Round Bet Stepper */}
                      <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800 shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold mr-1">Round Bet:</span>
                        <button
                          onClick={() => handleAdjustBet(p.id, -1)}
                          disabled={bet <= 0}
                          className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <span className="font-mono font-black text-xs text-emerald-400 w-12 text-center">
                          {bet} ETB
                        </span>

                        <button
                          onClick={() => handleAdjustBet(p.id, 1)}
                          disabled={bet >= p.depositBalance}
                          className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ==================================================================== */}
          {/* WHO WON WHICH ROUND — MATCH HISTORY & ROUND LOGS FEED               */}
          {/* ==================================================================== */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
            <button
              onClick={() => setIsMatchHistoryExpanded(!isMatchHistoryExpanded)}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                <span>Round-by-Round Match History</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-800 text-emerald-300">
                  {pool.roundHistory.length} Settled
                </span>
              </div>
              {isMatchHistoryExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {isMatchHistoryExpanded && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 animate-fadeIn">
                {pool.roundHistory.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-950/40 text-center text-xs text-slate-400">
                    No completed rounds yet. Settle Round #{pool.currentRoundNumber} to log the match history!
                  </div>
                ) : (
                  pool.roundHistory.map((rh) => (
                    <div
                      key={rh.roundId}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                            Round #{rh.roundNumber}
                          </span>
                          <span className="font-bold text-white flex items-center gap-1">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            Winner: <span className="text-emerald-400">{rh.winnerName}</span>
                          </span>
                        </div>

                        <span className="font-mono font-black text-emerald-400">
                          +{formatETB(rh.winnerPayout)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                        <span>
                          Pot: {formatETB(rh.totalPot)} (Ref: {formatETB(rh.refereeFee)})
                        </span>
                        <span>
                          {new Date(rh.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Players who placed bets in this round */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {rh.playerBets.map(b => (
                          <span
                            key={b.playerId}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              b.playerId === rh.winnerId
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                                : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {b.playerName}: {b.betAmount} ETB {b.playerId === rh.winnerId ? '🏆' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: SETTLE BASIC TABLE FEE TO ERP WALLET                        */}
      {/* ==================================================================== */}
      {showBasicSettleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 max-w-sm w-full shadow-2xl relative animate-scaleUp space-y-4">
            <button
              onClick={() => setShowBasicSettleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <WalletIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-white text-base">Settle Pool House Fee</h4>
                <p className="text-xs text-slate-400">{pool.title} • {basicGames} games</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Total Table Fee Due
              </span>
              <span className="font-mono font-black text-3xl text-emerald-400">
                {formatETB(basicTotalFee)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                {basicGames} games × {basicFee} ETB
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Deposit Into ERP Wallet:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setBasicSettleWalletId(w.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      basicSettleWalletId === w.id
                        ? 'bg-emerald-500/20 border-emerald-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="font-bold text-xs block">{w.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatETB(w.openingBalance + w.totalIn - w.totalOut)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowBasicSettleModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBasicSettle}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Record {formatETB(basicTotalFee)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: ADD PLAYER IN BETTING MODE                                  */}
      {/* ==================================================================== */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 max-w-sm w-full shadow-2xl relative animate-scaleUp space-y-4">
            <button
              onClick={() => setShowAddPlayerModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="font-black text-white text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Add Player to Round #{pool.currentRoundNumber}</span>
            </h4>

            {newPlayerError && (
              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {newPlayerError}
              </div>
            )}

            <form onSubmit={handleAddPlayerSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Player Name / Nickname:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Yared, Dawit, Abiy"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Initial Deposit Balance (ETB):</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newPlayerDeposit}
                  onChange={(e) => setNewPlayerDeposit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Round Bet Amount (ETB):</label>
                <input
                  type="number"
                  min="0"
                  max={newPlayerDeposit}
                  required
                  value={newPlayerBet}
                  onChange={(e) => setNewPlayerBet(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlayerModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  Add Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: TOP-UP PLAYER DEPOSIT                                       */}
      {/* ==================================================================== */}
      {showDepositModal && depositTargetPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 max-w-sm w-full shadow-2xl relative animate-scaleUp space-y-4">
            <button
              onClick={() => setShowDepositModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="font-black text-white text-base">Top-Up Deposit</h4>
            <p className="text-xs text-slate-400">
              Player: <span className="text-white font-bold">{depositTargetPlayer.name}</span>
              <br />
              Current Deposit: <span className="font-mono text-emerald-400">{formatETB(depositTargetPlayer.depositBalance)}</span>
            </p>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Deposit Amount (ETB):
              </label>
              <input
                type="number"
                min="10"
                step="10"
                value={depositAmountInput}
                onChange={(e) => setDepositAmountInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-lg outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDepositModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeposit}
                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Confirm Deposit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: FINISH ROUND & WINNER SETTLEMENT (BETTING MODE)             */}
      {/* ==================================================================== */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 max-w-md w-full shadow-2xl relative animate-scaleUp space-y-4">
            <button
              onClick={() => {
                setShowSettlementModal(false);
                setIsConfirmingSettlement(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-white text-base">Select Round #{pool.currentRoundNumber} Winner</h4>
                <p className="text-xs text-slate-400">{pool.title} • {activePlayersCount} players in round</p>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Pot (Sum of all bets):</span>
                <span className="font-mono font-bold text-white">{formatETB(totalPot)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Referee Fee (PlusZone Revenue):</span>
                <span className="font-mono font-bold text-blue-400">-{formatETB(currentRefereeFee)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-black">
                <span className="text-amber-300">Winner Payout:</span>
                <span className="font-mono text-emerald-400">{formatETB(winnerPayout)}</span>
              </div>
            </div>

            {/* Select Winner from active players */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">
                Tap the Winning Player for Round #{pool.currentRoundNumber}:
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {pool.players
                  .filter(p => (p.currentBet || 0) > 0)
                  .map((p) => {
                    const isSelected = selectedWinnerId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedWinnerId(p.id)}
                        className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-md shadow-amber-500/10'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Crown className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-600'}`} />
                          <div>
                            <span className="font-bold text-xs block">{p.name}</span>
                            <span className="text-[10px] text-slate-400">
                              Played: {p.roundsPlayedCount || (p.gamesWonCount + p.gamesLostCount) || 0} rounds ({p.gamesWonCount}W)
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-300">Bet: {p.currentBet} ETB</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Settlement Confirm View */}
            {isConfirmingSettlement ? (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-amber-200">
                    Crown winner <span className="font-black text-white">{pool.players.find(p => p.id === selectedWinnerId)?.name}</span> with payout of <span className="font-black text-white">{formatETB(winnerPayout)}</span>.
                  </p>
                </div>

                {/* THE CORE QUESTION: Ask if the bet is the same in the new round */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-blue-500/40 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-black text-white text-xs">
                        Round #{pool.currentRoundNumber + 1} Bet Settings
                      </h5>
                      <p className="text-[10px] text-blue-300">
                        Is the bet the same in the new round?
                      </p>
                    </div>
                  </div>

                  {/* Toggle: Same Bet vs Change Bet */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNextRoundBetMode('SAME')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        nextRoundBetMode === 'SAME'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400/50'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-emerald-400">Yes, Same Bet</span>
                        {nextRoundBetMode === 'SAME' && <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />}
                      </div>
                      <span className="font-mono font-black text-sm text-white block mt-0.5">
                        {commonRoundBet} ETB
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        Keep current player stakes
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNextRoundBetMode('CHANGE')}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        nextRoundBetMode === 'CHANGE'
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-400/50'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-amber-400">No, Change Bet</span>
                        {nextRoundBetMode === 'CHANGE' && <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />}
                      </div>
                      <span className="font-mono font-black text-sm text-white block mt-0.5">
                        {parseFloat(nextRoundBetValue) || 0} ETB
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        Set new bet for players
                      </span>
                    </button>
                  </div>

                  {/* Input if CHANGE is selected */}
                  {nextRoundBetMode === 'CHANGE' && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 space-y-2 animate-fadeIn">
                      <label className="text-[10px] font-bold text-slate-300 block">
                        New Bet for Round #{pool.currentRoundNumber + 1}:
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={nextRoundBetValue}
                          onChange={(e) => setNextRoundBetValue(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white font-mono font-bold text-sm focus:outline-none"
                          placeholder="e.g. 50"
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold text-amber-400">ETB</span>
                      </div>

                      {/* Quick Chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {[10, 20, 30, 50, 100, 200].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setNextRoundBetValue(amt.toString())}
                            className={`px-2 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                              nextRoundBetValue === amt.toString()
                                ? 'bg-amber-500 text-slate-950 font-black'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {amt} ETB
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsConfirmingSettlement(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleExecuteSettlement}
                    disabled={isSettling}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    {isSettling ? 'Settling...' : `Confirm & Advance to R#${pool.currentRoundNumber + 1}`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowSettlementModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsConfirmingSettlement(true)}
                  disabled={!selectedWinnerId}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Proceed to Settle
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: SAFE RESET MODAL (NEVER WIPES PLAYERS UNLESS REQUESTED)     */}
      {/* ==================================================================== */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 max-w-sm w-full shadow-2xl relative animate-scaleUp space-y-4">
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-white text-base">Reset Match Options</h4>
                <p className="text-xs text-slate-400">{pool.title}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Option 1 (Recommended): Reset scores to Round #1 while keeping all players & balances */}
              <button
                onClick={handleResetMatchScoresKeepPlayers}
                className="w-full p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="font-black text-white text-xs">
                    Start New Match (Keep All Players)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Resets to Round #1 and clears win/loss history. <strong className="text-emerald-400">All players and their deposited balances stay at the table!</strong>
                </p>
              </button>

              {/* Option 2: Clear previous winner banner only */}
              {pool.lastSettlement && (
                <button
                  onClick={handleResetWinnerBannerOnly}
                  className="w-full p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer"
                >
                  <span className="font-bold text-white text-xs block mb-0.5">
                    Clear Previous Winner Banner Only
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Hides the previous winner card on top while keeping the current round and player records intact.
                  </span>
                </button>
              )}

              {/* Option 3: Danger Zone - Clear all players */}
              <button
                onClick={handleWipeAllPlayers}
                className="w-full p-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition-all cursor-pointer"
              >
                <span className="font-bold text-rose-300 text-xs block mb-0.5">
                  Wipe All Players & Table
                </span>
                <span className="text-[10px] text-rose-400/80 block">
                  Removes all players and resets table to empty state.
                </span>
              </button>
            </div>

            <button
              onClick={() => setShowResetModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: INSPECT PLAYER MATCH CARD & ROUNDS WON                      */}
      {/* ==================================================================== */}
      {inspectingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 max-w-sm w-full shadow-2xl relative animate-scaleUp space-y-4">
            <button
              onClick={() => setInspectingPlayer(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                {inspectingPlayer.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-black text-white text-base">{inspectingPlayer.name}</h4>
                <p className="text-xs text-slate-400">
                  Currently in Round #{pool.currentRoundNumber} • {pool.title}
                </p>
              </div>
            </div>

            {/* Player Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Rounds Played</span>
                <span className="font-mono font-black text-sm text-white">
                  {inspectingPlayer.roundsPlayedCount || (inspectingPlayer.gamesWonCount + inspectingPlayer.gamesLostCount) || 0}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Won / Lost</span>
                <span className="font-mono font-black text-sm text-emerald-400">
                  {inspectingPlayer.gamesWonCount}W <span className="text-slate-500 font-normal">/</span> {inspectingPlayer.gamesLostCount}L
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Deposit Bal</span>
                <span className="font-mono font-black text-sm text-amber-400">
                  {formatETB(inspectingPlayer.depositBalance)}
                </span>
              </div>
            </div>

            {/* List of Won Rounds */}
            <div>
              <span className="text-xs font-bold text-slate-300 block mb-1.5">
                Rounds Won by {inspectingPlayer.name}:
              </span>
              {(!inspectingPlayer.wonRoundsList || inspectingPlayer.wonRoundsList.length === 0) ? (
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                  No rounds won yet in this session.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {inspectingPlayer.wonRoundsList.map(r => (
                    <span
                      key={r}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black flex items-center gap-1"
                    >
                      <Trophy className="w-3 h-3 text-amber-400" />
                      Round #{r}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setInspectingPlayer(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: REMOVE SINGLE PLAYER CONFIRMATION                           */}
      {/* ==================================================================== */}
      {playerToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 max-w-sm w-full shadow-2xl relative animate-scaleUp space-y-3">
            <h4 className="font-black text-white text-base">Remove Player?</h4>
            <p className="text-xs text-slate-400">
              Remove <span className="text-white font-bold">{playerToRemove.name}</span> with remaining deposit{' '}
              <span className="font-mono text-emerald-400">{formatETB(playerToRemove.depositBalance)}</span>?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPlayerToRemove(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemovePlayer(playerToRemove)}
                className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CHANGE ROUND BET MODAL (FOR ANY ROUND)                        */}
      {/* ==================================================================== */}
      {showChangeRoundBetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 max-w-md w-full shadow-2xl relative animate-scaleUp space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowChangeRoundBetModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-white text-base">Change Round #{pool.currentRoundNumber} Bet</h4>
                <p className="text-xs text-slate-400">{pool.title} • {pool.players.length} players registered</p>
              </div>
            </div>

            {/* Set Bet for All Players */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                  Set Uniform Bet For All Players
                </span>
                <span className="text-[10px] text-slate-400">
                  Current: <strong className="text-white">{commonRoundBet} ETB</strong>
                </span>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={changeRoundBetAmountInput}
                    onChange={(e) => setChangeRoundBetAmountInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl text-white font-mono font-bold text-sm focus:outline-none"
                    placeholder="e.g. 50"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-amber-400">ETB</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const amt = Math.max(0, parseFloat(changeRoundBetAmountInput) || 0);
                    handleApplyUniformRoundBet(amt);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer shadow-md shadow-amber-500/20 shrink-0"
                >
                  Apply to All
                </button>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[10, 20, 30, 50, 100, 150, 200].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setChangeRoundBetAmountInput(amt.toString());
                      handleApplyUniformRoundBet(amt);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                      parseFloat(changeRoundBetAmountInput) === amt
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {amt} ETB
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Player Adjustment */}
            {pool.players.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Individual Player Bets:</span>
                  <span className="text-[10px] text-slate-400">Step: ±10 ETB</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {pool.players.map(p => {
                    const bet = p.currentBet || 0;
                    return (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Deposit: <strong className="text-emerald-400">{formatETB(p.depositBalance)}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustBet(p.id, -1)}
                            disabled={bet <= 0}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center cursor-pointer text-xs font-bold"
                          >
                            -
                          </button>
                          <span className="w-14 text-center font-mono font-black text-xs text-amber-300">
                            {bet} ETB
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustBet(p.id, 1)}
                            disabled={bet >= p.depositBalance}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center cursor-pointer text-xs font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live Pot Preview */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">New Pot Total</span>
                <span className="font-mono font-black text-sm text-emerald-400">{formatETB(totalPot)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Active In Round</span>
                <span className="font-mono font-black text-sm text-white">{activePlayersCount} of {pool.players.length} players</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onUpdatePool({
                  ...pool,
                  roundBetConfirmedForRound: pool.currentRoundNumber
                });
                setShowChangeRoundBetModal(false);
                showToast(`Round #${pool.currentRoundNumber} bets saved.`);
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              Done & Save Round #{pool.currentRoundNumber} Bets
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 8: ADMIN SETTINGS (Default Game Price & Referee Fee)           */}
      {/* ==================================================================== */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-[#1E2D4A] rounded-3xl p-5 max-w-sm w-full shadow-2xl relative animate-scaleUp space-y-4">
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="font-black text-white text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>Pool Admin Settings</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Default Game / Table Price (ETB):
                </label>
                <input
                  type="number"
                  min="1"
                  value={adminPriceInput}
                  onChange={(e) => setAdminPriceInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold outline-none focus:border-emerald-400"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Applied as default table fee (20 ETB) and initial player bet.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Default Referee Fee (ETB):
                </label>
                <input
                  type="number"
                  min="0"
                  value={adminRefereeFeeInput}
                  onChange={(e) => setAdminRefereeFeeInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block">Configurable Referee Fee:</span>
                  <span className="text-[10px] text-slate-400">Allow operators to adjust per round</span>
                </div>
                <input
                  type="checkbox"
                  checked={adminConfigurableToggle}
                  onChange={(e) => setAdminConfigurableToggle(e.target.checked)}
                  className="w-4 h-4 accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAdminModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdminSettings}
                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: UNFINISHED GAME WARNING (BEFORE STARTING BASIC OR BET POOL)   */}
      {/* ==================================================================== */}
      {unfinishedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#0E1626] border border-amber-500/50 rounded-3xl p-5 max-w-md w-full shadow-2xl relative animate-scaleUp space-y-4">
            <button
              onClick={() => setUnfinishedWarning(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
                <AlertCircle className="w-6 h-6 text-amber-400 animate-pulse" />
              </div>
              <div className="min-w-0">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 inline-block mb-0.5">
                  Action Required
                </span>
                <h4 className="font-black text-white text-base truncate">
                  {unfinishedWarning.title}
                </h4>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2.5 text-xs">
              <p className="text-slate-200 leading-relaxed font-medium">
                {unfinishedWarning.message}
              </p>

              {unfinishedWarning.details && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs font-semibold leading-relaxed">
                  {unfinishedWarning.details}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              {unfinishedWarning.onResolve && (
                <button
                  type="button"
                  onClick={() => {
                    const resolveFn = unfinishedWarning.onResolve;
                    setUnfinishedWarning(null);
                    resolveFn?.();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <CheckCircle className="w-4 h-4 stroke-[2.5]" />
                  <span>{unfinishedWarning.resolveLabel || 'Finish / Settle Previous Game'}</span>
                </button>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUnfinishedWarning(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const proceedFn = unfinishedWarning.onProceed;
                    setUnfinishedWarning(null);
                    proceedFn();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-500/20 border border-amber-500/40 text-amber-300 hover:text-white font-black text-xs cursor-pointer transition-colors"
                >
                  {unfinishedWarning.proceedLabel || 'Continue Anyway'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
