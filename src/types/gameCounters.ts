export type PlayStationBillingMode = 'MATCHES' | 'TIMED';

export interface PlayStationStation {
  id: string;
  name: string; // e.g. "PS 1", "PS 2"
  subtitle?: string;
  billingMode?: PlayStationBillingMode; // 'MATCHES' (default) or 'TIMED'
  pricePerMatch: number; // default: 20 ETB
  matchesPlayed: number;
  matchHistory: number[]; // For Undo stack
  activeSessionStartTime?: string;
  // Timed session fields when PS console is played by time (10-min blocks)
  timerPricePerBlock?: number; // default: 20 ETB
  timerBlockMinutes?: number; // default: 10 minutes
  timerElapsedSeconds?: number;
  timerIsRunning?: boolean;
  timerStatus?: 'IDLE' | 'RUNNING' | 'PAUSED';
  timerStartedAtTimestamp?: number;
  customerName?: string;
  notes?: string;
}

export interface TimedStation {
  id: string;
  name: string; // e.g. "VIP Gaming Lounge", "VR Booth 1", "Driving Simulator"
  pricePerBlock: number; // default: 20 ETB
  blockMinutes: number; // default: 10 minutes
  elapsedSeconds: number;
  isRunning: boolean;
  status: 'IDLE' | 'RUNNING' | 'PAUSED';
  startedAtTimestamp?: number;
  customerName?: string;
}

export interface PoolPlayer {
  id: string;
  name: string;
  phone?: string;
  depositedBalance: number; // Deposited lounge credits (separate from bets!)
  currentStake: number; // Current bet placed on active round
  totalWinnings: number;
  totalLosses: number;
  gamesWonCount: number;
  gamesLostCount: number;
  createdAt: string;
}

export interface PoolGameRound {
  id: string;
  roundNumber: number;
  tableFee: number; // default: 20 ETB
  betMode: 'INDIVIDUAL' | 'POT';
  player1Id: string;
  player2Id?: string;
  player1Stake: number;
  player2Stake: number;
  totalPot: number;
  winnerId?: string;
  loserId?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completedAt?: string;
  tableFeeRecorded: boolean;
  tableFeeTxId?: string;
  refereeFee?: number;
  refereeName?: string;
}

export interface PoolTableState {
  id: string;
  name: string; // e.g. "Main Tournament Pool Table"
  tableFeePerGame: number; // default: 20 ETB
  // Referee / Table Operator settings & payouts:
  refereeEnabled?: boolean;
  refereeName?: string; // e.g. "Dawit (Referee)"
  refereeFeePerGame?: number; // default: 10 ETB per completed game
  accumulatedRefereeFee?: number; // Total unpaid referee earnings
  totalRefereePaid?: number; // Total paid out to referee
  activeGame: PoolGameRound | null;
  lastCompletedGame?: PoolGameRound | null; // Details of the recently finished game (winner, loser, payouts)
  players: PoolPlayer[];
  roundHistory: PoolGameRound[];
  unsettledTableFees: number; // Accumulated unrecorded table revenue
  gamesPlayed?: number; // Direct simple counter like PlayStation
  gameHistory?: number[]; // For Undo stack like PlayStation
  activeSessionStartTime?: string;
}

export interface GameCountersState {
  psStations: PlayStationStation[];
  timedStations: TimedStation[];
  poolTable?: PoolTableState; // legacy single table fallback
  poolTables: PoolTableState[]; // multiple pool tables
  selectedTab: 'PLAYSTATION' | 'POOL';
  activeStationId: string;
  activePoolTableId?: string;
  totalDailyRevenueRecorded: number;
}

export interface PoolBettingPlayerHistory {
  roundId: string;
  roundNumber: number;
  poolId: string;
  poolNumber: number;
  betAmount: number;
  isWinner: boolean;
  payoutAmount: number;
  timestamp: string;
}

export interface PoolBettingPlayer {
  id: string;
  name: string; // Name or nickname
  phone?: string;
  depositBalance: number; // Current deposited balance
  currentBet: number; // Individual bet amount for current round
  gamesWonCount: number;
  gamesLostCount: number;
  roundsPlayedCount?: number; // Total rounds played by this player
  wonRoundsList?: number[]; // List of round numbers this player won (e.g. [1, 3])
  totalWonAmount: number;
  totalLostAmount: number;
  winLossHistory: PoolBettingPlayerHistory[];
  createdAt: string;
}

export interface PoolBettingTransaction {
  id: string;
  poolId: string;
  poolNumber: number;
  roundId: string;
  roundNumber: number;
  playerId?: string;
  playerName?: string;
  type: 'DEPOSIT' | 'BET_DEDUCTION' | 'WINNER_PAYOUT' | 'REFEREE_FEE';
  amount: number;
  timestamp: string;
  description?: string;
}

export interface PoolBettingRoundSettlement {
  roundId: string;
  roundNumber: number;
  completedAt: string;
  winnerId: string;
  winnerName: string;
  totalPot: number;
  refereeFee: number;
  winnerPayout: number;
  playerBets: {
    playerId: string;
    playerName: string;
    betAmount: number;
    depositBefore: number;
    depositAfter: number;
  }[];
  isSettled: boolean;
  revenueRecorded: boolean;
}

export interface PoolBettingCardState {
  id: string;
  poolNumber: number;
  title: string; // e.g. "Pool 1", "Pool 2", "Pool 3"
  status: 'Active' | 'Completed';
  currentRoundNumber: number;
  defaultGamePrice: number; // configured by admin
  refereeFee: number; // referee fee for current round
  players: PoolBettingPlayer[];
  lastSettlement?: PoolBettingRoundSettlement | null;
  roundHistory: PoolBettingRoundSettlement[];
  transactionLogs: PoolBettingTransaction[];
  createdAt: string;

  // Game Mode: 'BASIC' (Casual 20 ETB Table Fee per game, no bet) or 'BETTING' (Player Pot & Bets)
  gameMode?: 'BASIC' | 'BETTING';
  basicGamesPlayed?: number;
  basicTableFeePerGame?: number;
  basicGamesHistory?: number[];
  basicPlayerNames?: string;

  // Round Bet Tracking
  currentRoundBet?: number;
  roundBetConfirmedForRound?: number;
}

export interface PoolBettingAdminSettings {
  defaultGamePrice: number; // default: 20 ETB
  defaultRefereeFee: number; // default: 10 ETB
  isRefereeFeeConfigurable: boolean; // whether referee fee is fixed or configurable per round
}

