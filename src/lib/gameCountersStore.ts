import {
  GameCountersState,
  PlayStationStation,
  TimedStation,
  PoolPlayer,
  PoolGameRound,
  PoolTableState,
  PoolBettingCardState,
  PoolBettingPlayer,
  PoolBettingAdminSettings,
  PoolBettingRoundSettlement,
  PoolBettingTransaction
} from '../types/gameCounters';

const STORAGE_KEY = 'pgz_arcade_game_counters_state_v2';
const POOL_BETTING_CARDS_STORAGE_KEY = 'pluszone_pool_betting_cards_v3';
const POOL_BETTING_ADMIN_STORAGE_KEY = 'pluszone_pool_betting_admin_v1';

export const DEFAULT_PS_STATIONS: PlayStationStation[] = [
  {
    id: 'ps-1',
    name: 'PS 1',
    subtitle: 'FIFA / FC 26',
    pricePerMatch: 20,
    matchesPlayed: 0,
    matchHistory: [],
    activeSessionStartTime: new Date().toISOString()
  },
  {
    id: 'ps-2',
    name: 'PS 2',
    subtitle: 'Mortal Kombat 1',
    pricePerMatch: 20,
    matchesPlayed: 0,
    matchHistory: [],
    activeSessionStartTime: new Date().toISOString()
  },
  {
    id: 'ps-3',
    name: 'PS 3',
    subtitle: 'Tekken 8',
    pricePerMatch: 20,
    matchesPlayed: 0,
    matchHistory: [],
    activeSessionStartTime: new Date().toISOString()
  },
  {
    id: 'ps-4',
    name: 'PS 4',
    subtitle: 'NBA 2K26',
    pricePerMatch: 20,
    matchesPlayed: 0,
    matchHistory: [],
    activeSessionStartTime: new Date().toISOString()
  },
  {
    id: 'ps-5',
    name: 'PS 5',
    subtitle: 'Co-op / Split Screen',
    pricePerMatch: 20,
    matchesPlayed: 0,
    matchHistory: [],
    activeSessionStartTime: new Date().toISOString()
  },
  {
    id: 'ps-6',
    name: 'PS 6',
    subtitle: 'Free Play Lounge',
    pricePerMatch: 20,
    matchesPlayed: 0,
    matchHistory: [],
    activeSessionStartTime: new Date().toISOString()
  }
];

export const DEFAULT_TIMED_STATIONS: TimedStation[] = [
  {
    id: 'time-2',
    name: 'VR Metaverse Booth',
    pricePerBlock: 20,
    blockMinutes: 10,
    elapsedSeconds: 0,
    isRunning: false,
    status: 'IDLE'
  },
  {
    id: 'time-2',
    name: 'VR Metaverse Booth',
    pricePerBlock: 20,
    blockMinutes: 10,
    elapsedSeconds: 0,
    isRunning: false,
    status: 'IDLE'
  },
  {
    id: 'time-3',
    name: 'Racing Sim Rig Pro',
    pricePerBlock: 20,
    blockMinutes: 10,
    elapsedSeconds: 0,
    isRunning: false,
    status: 'IDLE'
  }
];

export const DEFAULT_POOL_PLAYERS: PoolPlayer[] = [];

export const DEFAULT_POOL_TABLES: PoolTableState[] = [
  {
    id: 'pool-table-1',
    name: 'Table 1: Diamond Arena',
    tableFeePerGame: 20,
    refereeEnabled: true,
    refereeName: 'Referee',
    refereeFeePerGame: 10,
    accumulatedRefereeFee: 0,
    totalRefereePaid: 0,
    activeGame: null,
    lastCompletedGame: null,
    players: DEFAULT_POOL_PLAYERS,
    roundHistory: [],
    unsettledTableFees: 0,
    gamesPlayed: 0,
    gameHistory: []
  },
  {
    id: 'pool-table-2',
    name: 'Table 2: Predator Pro',
    tableFeePerGame: 20,
    refereeEnabled: true,
    refereeName: 'Referee',
    refereeFeePerGame: 10,
    accumulatedRefereeFee: 0,
    totalRefereePaid: 0,
    activeGame: null,
    lastCompletedGame: null,
    players: DEFAULT_POOL_PLAYERS,
    roundHistory: [],
    unsettledTableFees: 0,
    gamesPlayed: 0,
    gameHistory: []
  }
];

export const DEFAULT_POOL_TABLE: PoolTableState = DEFAULT_POOL_TABLES[0];

export function createNewPoolTable(tableIndex: number, customName?: string, customFee = 20): PoolTableState {
  const tableId = `pool-table-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  return {
    id: tableId,
    name: customName || `Table ${tableIndex}: Standard Slate`,
    tableFeePerGame: customFee,
    refereeEnabled: true,
    refereeName: 'Referee',
    refereeFeePerGame: 10,
    accumulatedRefereeFee: 0,
    totalRefereePaid: 0,
    activeGame: null,
    lastCompletedGame: null,
    players: DEFAULT_POOL_PLAYERS,
    roundHistory: [],
    unsettledTableFees: 0,
    gamesPlayed: 0,
    gameHistory: []
  };
}

export function loadGameCountersState(): GameCountersState {
  if (typeof window === 'undefined') {
    return {
      psStations: DEFAULT_PS_STATIONS,
      timedStations: DEFAULT_TIMED_STATIONS,
      poolTable: DEFAULT_POOL_TABLE,
      poolTables: DEFAULT_POOL_TABLES,
      selectedTab: 'PLAYSTATION',
      activeStationId: DEFAULT_PS_STATIONS[0].id,
      activePoolTableId: DEFAULT_POOL_TABLES[0].id,
      totalDailyRevenueRecorded: 0
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let loadedPs: PlayStationStation[] = Array.isArray(parsed.psStations) && parsed.psStations.length > 0 ? parsed.psStations : DEFAULT_PS_STATIONS;

      // Standardize clean dashboard names (PS 1, PS 2, PS 3...)
      loadedPs = loadedPs.map((st, idx) => {
        let name = st.name;
        let subtitle = st.subtitle;
        if (name.includes('PS5 Station 1') || name.includes('Station 1')) {
          name = 'PS 1';
          subtitle = subtitle || 'FIFA / FC 26';
        } else if (name.includes('PS5 Station 2') || name.includes('Station 2')) {
          name = 'PS 2';
          subtitle = subtitle || 'Mortal Kombat 1';
        } else if (name.includes('PS4 Station 3') || name.includes('Station 3')) {
          name = 'PS 3';
          subtitle = subtitle || 'Tekken 8';
        }
        return {
          ...st,
          name,
          subtitle
        };
      });

      // Ensure PS 1 through PS 6 are readily available for arcade dashboard
      if (loadedPs.length < 6) {
        const existingIds = new Set(loadedPs.map(s => s.id));
        const missing = DEFAULT_PS_STATIONS.filter(s => !existingIds.has(s.id));
        loadedPs = [...loadedPs, ...missing];
      }

      // Handle multiple pool tables migration & validation (defaults to 2 pool tables)
      let loadedPoolTables: PoolTableState[] = [];
      if (Array.isArray(parsed.poolTables) && parsed.poolTables.length > 0) {
        loadedPoolTables = parsed.poolTables.map((t: any, idx: number) => ({
          ...DEFAULT_POOL_TABLE,
          ...t,
          id: t.id || `pool-table-${idx + 1}`,
          name: t.name || `Table ${idx + 1}`,
          tableFeePerGame: Number(t.tableFeePerGame) || 20,
          refereeEnabled: t.refereeEnabled !== undefined ? t.refereeEnabled : true,
          refereeName: t.refereeName || 'Referee',
          refereeFeePerGame: Number(t.refereeFeePerGame) || 10,
          accumulatedRefereeFee: Number(t.accumulatedRefereeFee) || 0,
          totalRefereePaid: Number(t.totalRefereePaid) || 0,
          activeGame: t.activeGame || null,
          lastCompletedGame: t.lastCompletedGame || null,
          players: Array.isArray(t.players)
            ? t.players.filter((p: any) => !p.id?.startsWith('pp-') && !p.id?.startsWith('pbp-') && !['Yared B.', 'Dawit M.', 'Abiy T.', 'Henok K.', 'Robel S.', 'Yared (Hustler)', 'Dawit (Spin Master)', 'Abiy (Cue Ball)'].includes(p.name))
            : [],
          roundHistory: Array.isArray(t.roundHistory) ? t.roundHistory : [],
          unsettledTableFees: Number(t.unsettledTableFees) || 0,
          gamesPlayed: typeof t.gamesPlayed === 'number' ? t.gamesPlayed : (Array.isArray(t.roundHistory) ? t.roundHistory.filter((r: any) => !r.tableFeeRecorded).length : 0),
          gameHistory: Array.isArray(t.gameHistory) ? t.gameHistory : []
        }));

        // If user has 3 default tables from earlier without history on table 3, trim to 2 tables
        if (loadedPoolTables.length === 3 && loadedPoolTables[2].id === 'pool-table-3' && (!loadedPoolTables[2].roundHistory || loadedPoolTables[2].roundHistory.length === 0) && !loadedPoolTables[2].activeGame) {
          loadedPoolTables = loadedPoolTables.slice(0, 2);
        }
      } else if (parsed.poolTable) {
        loadedPoolTables = [
          {
            ...DEFAULT_POOL_TABLES[0],
            ...parsed.poolTable,
            refereeEnabled: parsed.poolTable.refereeEnabled !== undefined ? parsed.poolTable.refereeEnabled : true,
            refereeName: parsed.poolTable.refereeName || 'Referee',
            refereeFeePerGame: Number(parsed.poolTable.refereeFeePerGame) || 10,
            accumulatedRefereeFee: Number(parsed.poolTable.accumulatedRefereeFee) || 0,
            totalRefereePaid: Number(parsed.poolTable.totalRefereePaid) || 0,
            players: Array.isArray(parsed.poolTable.players)
              ? parsed.poolTable.players.filter((p: any) => !p.id?.startsWith('pp-') && !p.id?.startsWith('pbp-') && !['Yared B.', 'Dawit M.', 'Abiy T.', 'Henok K.', 'Robel S.', 'Yared (Hustler)', 'Dawit (Spin Master)', 'Abiy (Cue Ball)'].includes(p.name))
              : [],
            roundHistory: Array.isArray(parsed.poolTable.roundHistory) ? parsed.poolTable.roundHistory : [],
            unsettledTableFees: Number(parsed.poolTable.unsettledTableFees) || 0
          },
          DEFAULT_POOL_TABLES[1]
        ];
      } else {
        loadedPoolTables = DEFAULT_POOL_TABLES;
      }

      const activePoolTableId = parsed.activePoolTableId && loadedPoolTables.some(t => t.id === parsed.activePoolTableId)
        ? parsed.activePoolTableId
        : loadedPoolTables[0]?.id || 'pool-table-1';

      return {
        psStations: loadedPs,
        timedStations: Array.isArray(parsed.timedStations) && parsed.timedStations.length > 0 ? parsed.timedStations : DEFAULT_TIMED_STATIONS,
        poolTable: loadedPoolTables[0] || DEFAULT_POOL_TABLE,
        poolTables: loadedPoolTables,
        selectedTab: parsed.selectedTab === 'POOL' ? 'POOL' : 'PLAYSTATION',
        activeStationId: loadedPs[0]?.id || DEFAULT_PS_STATIONS[0].id,
        activePoolTableId,
        totalDailyRevenueRecorded: Number(parsed.totalDailyRevenueRecorded) || 0
      };
    }
  } catch (err) {
    console.warn('[Game Counters] Failed to load local storage state:', err);
  }

  return {
    psStations: DEFAULT_PS_STATIONS,
    timedStations: DEFAULT_TIMED_STATIONS,
    poolTable: DEFAULT_POOL_TABLES[0],
    poolTables: DEFAULT_POOL_TABLES,
    selectedTab: 'PLAYSTATION',
    activeStationId: DEFAULT_PS_STATIONS[0].id,
    activePoolTableId: DEFAULT_POOL_TABLES[0].id,
    totalDailyRevenueRecorded: 0
  };
}

export function saveGameCountersState(state: GameCountersState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[Game Counters] Failed to save local storage state:', err);
  }
}

/**
 * Calculates billable blocks for timed stations:
 * Automatically rounds UP every started 10-minute block.
 * e.g., 1 second = 1 block (20 ETB)
 * 10 min 01 sec = 2 blocks (40 ETB)
 * 20 min 01 sec = 3 blocks (60 ETB)
 */
export function calculateTimedBillableBlocks(elapsedSeconds: number, blockMinutes = 10): number {
  if (elapsedSeconds <= 0) return 0;
  const blockSeconds = blockMinutes * 60;
  return Math.ceil(elapsedSeconds / blockSeconds);
}

export function calculateTimedCost(elapsedSeconds: number, pricePerBlock = 20, blockMinutes = 10): number {
  const blocks = calculateTimedBillableBlocks(elapsedSeconds, blockMinutes);
  return blocks * pricePerBlock;
}

export function formatElapsedSeconds(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function secondsUntilNextBlock(elapsedSeconds: number, blockMinutes = 10): number {
  const blockSec = blockMinutes * 60;
  if (elapsedSeconds <= 0) return blockSec;
  const currentBlockEnd = Math.ceil(elapsedSeconds / blockSec) * blockSec;
  return Math.max(0, currentBlockEnd - elapsedSeconds);
}

export function createNewPsStation(existingCount: number): PlayStationStation {
  const nextNum = existingCount + 1;
  return {
    id: `ps-${Date.now()}-${nextNum}`,
    name: `PS ${nextNum}`,
    subtitle: 'Standard Match',
    pricePerMatch: 20,
    matchesPlayed: 0,
    matchHistory: [],
    activeSessionStartTime: new Date().toISOString()
  };
}

export const DEFAULT_POOL_BETTING_ADMIN_SETTINGS: PoolBettingAdminSettings = {
  defaultGamePrice: 20,
  defaultRefereeFee: 10,
  isRefereeFeeConfigurable: true
};

export const DEFAULT_POOL_BETTING_CARDS: PoolBettingCardState[] = [
  {
    id: 'pool-card-1',
    poolNumber: 1,
    title: 'Pool 1',
    status: 'Active',
    currentRoundNumber: 1,
    defaultGamePrice: 20,
    currentRoundBet: 20,
    roundBetConfirmedForRound: 1,
    refereeFee: 10,
    gameMode: 'BASIC',
    basicGamesPlayed: 0,
    basicTableFeePerGame: 20,
    basicGamesHistory: [],
    basicPlayerNames: 'Open Play',
    createdAt: new Date().toISOString(),
    lastSettlement: null,
    roundHistory: [],
    transactionLogs: [],
    players: []
  },
  {
    id: 'pool-card-2',
    poolNumber: 2,
    title: 'Pool 2',
    status: 'Active',
    currentRoundNumber: 1,
    defaultGamePrice: 20,
    currentRoundBet: 20,
    roundBetConfirmedForRound: 1,
    refereeFee: 10,
    gameMode: 'BASIC',
    basicGamesPlayed: 0,
    basicTableFeePerGame: 20,
    basicGamesHistory: [],
    basicPlayerNames: 'Open Play',
    createdAt: new Date().toISOString(),
    lastSettlement: null,
    roundHistory: [],
    transactionLogs: [],
    players: []
  }
];

export function loadPoolBettingAdminSettings(): PoolBettingAdminSettings {
  try {
    const raw = localStorage.getItem(POOL_BETTING_ADMIN_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_POOL_BETTING_ADMIN_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Error loading pool betting admin settings:', err);
  }
  return DEFAULT_POOL_BETTING_ADMIN_SETTINGS;
}

export function savePoolBettingAdminSettings(settings: PoolBettingAdminSettings): void {
  try {
    localStorage.setItem(POOL_BETTING_ADMIN_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving pool betting admin settings:', err);
  }
}

export function loadPoolBettingCards(): PoolBettingCardState[] {
  try {
    const raw = localStorage.getItem(POOL_BETTING_CARDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure no mock sample players exist in loaded pool cards
        return parsed.map((card: PoolBettingCardState) => ({
          ...card,
          currentRoundBet: card.currentRoundBet || card.defaultGamePrice || 20,
          players: Array.isArray(card.players)
            ? card.players.filter(p => !p.id.startsWith('pbp-1') && !p.id.startsWith('pbp-2') && !p.id.startsWith('pbp-3') && !p.id.startsWith('pbp-4') && !p.id.startsWith('pbp-5') && !['Yared B.', 'Dawit M.', 'Abiy T.', 'Henok K.', 'Robel S.'].includes(p.name))
            : []
        }));
      }
    }
  } catch (err) {
    console.error('Error loading pool betting cards:', err);
  }
  return DEFAULT_POOL_BETTING_CARDS;
}

export function savePoolBettingCards(cards: PoolBettingCardState[]): void {
  try {
    localStorage.setItem(POOL_BETTING_CARDS_STORAGE_KEY, JSON.stringify(cards));
  } catch (err) {
    console.error('Error saving pool betting cards:', err);
  }
}

export function createNewPoolBettingCard(
  poolNumber: number,
  adminSettings: PoolBettingAdminSettings = DEFAULT_POOL_BETTING_ADMIN_SETTINGS
): PoolBettingCardState {
  return {
    id: `pool-card-${Date.now()}-${poolNumber}`,
    poolNumber,
    title: `Pool ${poolNumber}`,
    status: 'Active',
    currentRoundNumber: 1,
    defaultGamePrice: adminSettings.defaultGamePrice,
    currentRoundBet: adminSettings.defaultGamePrice,
    roundBetConfirmedForRound: 1,
    refereeFee: adminSettings.defaultRefereeFee,
    gameMode: 'BASIC',
    basicGamesPlayed: 0,
    basicTableFeePerGame: 20,
    basicGamesHistory: [],
    basicPlayerNames: 'Open Play',
    players: [],
    roundHistory: [],
    transactionLogs: [],
    createdAt: new Date().toISOString()
  };
}

export function createNewPoolBettingPlayer(
  name: string,
  deposit: number,
  defaultBet: number,
  phone?: string
): PoolBettingPlayer {
  return {
    id: `pbp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    phone: phone?.trim(),
    depositBalance: Math.max(0, deposit),
    currentBet: Math.min(Math.max(0, deposit), Math.max(0, defaultBet)),
    roundsPlayedCount: 0,
    gamesWonCount: 0,
    gamesLostCount: 0,
    wonRoundsList: [],
    totalWonAmount: 0,
    totalLostAmount: 0,
    winLossHistory: [],
    createdAt: new Date().toISOString()
  };
}

