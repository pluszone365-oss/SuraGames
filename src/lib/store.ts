import {
  UserProfile,
  Wallet,
  Transaction,
  Transfer,
  Equb,
  Loan,
  Asset,
  Goal,
  RecurringTemplate,
  Receivable,
  AuditLogEntry,
  Category,
  UserRole,
  ERPState,
  AutoImportSettings,
  PendingReviewTransaction,
  ChatChannel,
  ChatMessage,
  AutomatedEmailReportsSettings,
  SentReportEmailLog,
  ShopOperatingHours
} from '../types';
import { triggerHaptic } from './haptics';
import { DEFAULT_ROLE_PERMISSIONS, getEffectivePermissions } from './auth';
// Clean self-contained state starting today (2026-10-24) without legacy external data files
import { normalizeTransactionScopes, isPersonalExpense, resolveExpenseScope } from './expenseClassifier';
import { getActiveAuthSession } from './authSession';
import { calculateNextEthiopianDueDate } from './ethiopianCalendar';

export type { ERPState } from '../types';
export { isPersonalExpense, resolveExpenseScope, normalizeTransactionScopes };

const STORAGE_KEY = 'pluszone_fin_erp_state_v65_pure_clean_slate_all_data_removed_2026_10_25';

/**
 * Validates whether a transaction ID belongs to the immutable canonical business ledger.
 */
export function isCanonicalTransactionId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.startsWith('tx-20261019')) return false;
  return (
    id.startsWith('tx-start-') ||
    id.startsWith('tx-2026') ||
    id.startsWith('tx-equb') ||
    id.startsWith('tx-loan') ||
    id.startsWith('tx-rent')
  );
}

export const DEFAULT_AUTOMATED_EMAIL_REPORTS: AutomatedEmailReportsSettings = {
  enabled: true,
  dayOfMonth: 2, // Strictly every month 2nd day
  sendHourEAT: 8, // 08:00 AM EAT
  roles: ['SuperAdmin', 'Admin'], // Admin and SuperUser only
  includePdfAttachment: true,
  includeExcelAttachment: true,
  autoTriggerEnabled: true,
  lastSentPeriod: '',
  lastSentTimestamp: ''
};

export const DEFAULT_SENT_REPORT_LOGS: SentReportEmailLog[] = [];

const DEFAULT_CHAT_CHANNELS: ChatChannel[] = [
  {
    id: 'general',
    name: 'General Lounge',
    type: 'PUBLIC',
    description: 'Company-wide team chat, general discussions & announcements',
    createdDate: '2026-10-24T08:00:00.000Z'
  },
  {
    id: 'financial-approvals',
    name: 'Financial Approvals & Alerts',
    type: 'PUBLIC',
    description: 'Discuss pending transactions, expense reversals, and equb payouts',
    createdDate: '2026-10-24T08:00:00.000Z'
  },
  {
    id: 'cashiers-team',
    name: 'Cashiers & Operations',
    type: 'PUBLIC',
    description: 'Daily cash register shifts, bank deposits & vault updates',
    createdDate: '2026-10-24T08:00:00.000Z'
  }
];

const DEFAULT_CHAT_MESSAGES: ChatMessage[] = [];

const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'u-1',
    name: 'Suraphel',
    email: 'suraphel@pluszone.et',
    username: 'suraphel',
    role: 'SuperAdmin',
    active: true,
    isApproved: true,
    isDigitalMoneyManager: true, // SuperAdmin by default
    invitationCode: 'PZ-SUPER-SURAPHEL',
    hasSetPassword: true,
    password: 'password123',
    passwordHash: '66504d769f6166d7174783866d9ca51867bf2fab94a58a3149aed4bc8c273d8f',
    isTemporaryPassword: false,
    mustChangePassword: false,
    permissions: DEFAULT_ROLE_PERMISSIONS.SuperAdmin,
    branch: 'Addis Ababa HQ',
    lastActive: 'Just now'
  }
];

const DEFAULT_WALLETS: Wallet[] = [];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-0', name: 'Daily Income', type: 'INCOME', icon: 'TrendingUp', color: '#10B981', active: true },
  { id: 'cat-1', name: 'Sales Revenue', type: 'INCOME', icon: 'TrendingUp', color: '#22C55E', active: true },
  { id: 'cat-2', name: 'Daily Income / Collected', type: 'INCOME', icon: 'CheckCircle', color: '#8B5CF6', active: true },
  { id: 'cat-cap', name: 'Capital Injection', type: 'INCOME', icon: 'PlusCircle', color: '#3B82F6', active: true },
  { id: 'cat-lr', name: 'Loans Received', type: 'INCOME', icon: 'ArrowDownLeft', color: '#8B5CF6', active: true },
  { id: 'cat-purchase', name: 'Purchase', type: 'EXPENSE', icon: 'ShoppingBag', color: '#0EA5E9', active: true },
  { id: 'cat-3', name: 'Equipment / Asset Purchase', type: 'EXPENSE', icon: 'HardDrive', color: '#64748B', active: true },
  { id: 'cat-4', name: 'Tax & License', type: 'EXPENSE', icon: 'FileText', color: '#EF4444', active: true },
  { id: 'cat-5', name: 'Electricity & Utilities', type: 'EXPENSE', icon: 'Zap', color: '#FB923C', active: true },
  { id: 'cat-6', name: 'Transportation', type: 'EXPENSE', icon: 'Truck', color: '#F5A623', active: true },
  { id: 'cat-7', name: 'Internet & Phone', type: 'EXPENSE', icon: 'Smartphone', color: '#6366F1', active: true },
  { id: 'cat-8', name: 'Food & Refreshments', type: 'EXPENSE', icon: 'Coffee', color: '#EC4899', active: true },
  { id: 'cat-9', name: 'Cleaning & Supplies', type: 'EXPENSE', icon: 'Package', color: '#14B8A6', active: true },
  { id: 'cat-10', name: 'Other & Home Expenses', type: 'EXPENSE', icon: 'Home', color: '#6B7280', active: true },
  { id: 'cat-ow', name: 'Owner Withdrawal', type: 'EXPENSE', icon: 'UserMinus', color: '#F59E0B', active: true },
  { id: 'cat-11', name: 'Equb Contribution', type: 'EXPENSE', icon: 'Users', color: '#8B5CF6', active: true },
  { id: 'cat-12', name: 'Loan Repayments', type: 'EXPENSE', icon: 'ArrowUpRight', color: '#DC2626', active: true },
  { id: 'cat-bd', name: 'Bad Debt', type: 'EXPENSE', icon: 'AlertTriangle', color: '#DC2626', active: true },
  { id: 'cat-sec', name: 'Community & Security', type: 'EXPENSE', icon: 'Shield', color: '#3B82F6', active: true },
  { id: 'cat-rent', name: 'Rent', type: 'EXPENSE', icon: 'Home', color: '#E11D48', active: true },
  { id: 'cat-equb-payout', name: 'Equb Payout', type: 'INCOME', icon: 'Award', color: '#10B981', active: true },
  { id: 'cat-exp', name: 'Expense', type: 'EXPENSE', icon: 'MinusCircle', color: '#EF4444', active: true },
  { id: 'cat-rc', name: 'Receivable Created', type: 'INCOME', icon: 'Clock', color: '#6366F1', active: true },
  { id: 'cat-gen', name: 'Genesis / Setup', type: 'INCOME', icon: 'Settings', color: '#64748B', active: true },
  { id: 'cat-ob', name: 'Opening Balance', type: 'INCOME', icon: 'Landmark', color: '#3B82F6', active: true },
  { id: 'cat-bal-adj', name: 'Balance Correction', type: 'EXPENSE', icon: 'Sliders', color: '#6366F1', active: true }
];

export const DEFAULT_TRANSACTIONS: Transaction[] = [];
const DEFAULT_EQUBS: Equb[] = [];
const DEFAULT_LOANS: Loan[] = [];
const DEFAULT_ASSETS: Asset[] = [];
const DEFAULT_GOALS: Goal[] = [];
export const DEFAULT_RECURRING: RecurringTemplate[] = [];
const DEFAULT_RECEIVABLES: Receivable[] = [];

export const DEFAULT_SHOP_HOURS: ShopOperatingHours = {
  openTimeGMT: '06:00', // 6:00 AM GMT (09:00 EAT / 3:00 ጠዋት)
  closeTimeGMT: '18:00', // 6:00 PM GMT (21:00 EAT / 3:00 ማታ)
  autoStatus: true,
  manualOverrideStatus: null,
  notes: 'Plus Game Zone standard shift: 6:00 AM – 6:00 PM GMT (09:00 – 21:00 EAT / 12 Hours Daily).'
};

export function evaluateReceivableStatus(r: Receivable): 'OUTSTANDING' | 'COLLECTED' | 'WRITTEN_OFF' | 'LATE' {
  if (r.status === 'COLLECTED' || r.amountCollected >= r.amountOwed) {
    return 'COLLECTED';
  }
  if (r.status === 'WRITTEN_OFF') {
    return 'WRITTEN_OFF';
  }
  const createdTime = r.createdDate ? new Date(r.createdDate).getTime() : 0;
  const dueTime = r.dueDate ? new Date(r.dueDate).getTime() : 0;
  const now = Date.now();
  const daysSinceCreated = createdTime ? (now - createdTime) / (1000 * 60 * 60 * 24) : 0;
  const daysSinceDue = dueTime ? (now - dueTime) / (1000 * 60 * 60 * 24) : 0;

  if (daysSinceCreated >= 15 || daysSinceDue >= 15 || r.status === 'LATE' || r.status === 'OVERDUE') {
    return 'LATE';
  }
  return 'OUTSTANDING';
}

export function syncReceivablesLateStatus(receivables: Receivable[]): Receivable[] {
  if (!Array.isArray(receivables)) return [];
  return receivables.map(r => {
    const computedStatus = evaluateReceivableStatus(r);
    if (computedStatus !== r.status) {
      return { ...r, status: computedStatus };
    }
    return r;
  });
}

const DEFAULT_AUDIT_LOGS: AuditLogEntry[] = [];

export function loadInitialState(): ERPState {
  if (typeof window === 'undefined') {
    return createInitialState();
  }
  try {
    // Actively purge obsolete localStorage keys so stale cached transactions never linger
    const obsoleteKeys = [
      'pluszone_fin_erp_state_v63_zero_wallets_zero_txs_2026_10_25',
      'pluszone_fin_erp_state_v64_fresh_start_all_data_removed',
      'pluszone_fin_erp_state_v60_suraphel_start_today_2026_10_24',
      'pluszone_fin_erp_state_v51_oct12_dynamic_equb_trajectory',
      'pluszone_fin_erp_state_v50_oct11_wallet_balance_corrections',
      'pluszone_fin_erp_state_v49_oct11_verified_sales_and_rcvs',
      'pluszone_fin_erp_state_v48_oct9_agerye_round25_last',
      'pluszone_fin_erp_state_v47_oct9_zerubabel2_repayments',
      'pluszone_fin_erp_state_v46_oct9_oct6_to_oct8_txs',
      'pluszone_fin_erp_state_v45_oct9_shop_rent_69k',
      'pluszone_fin_erp_state_v44_oct9_loans_and_equbs_final',
      'pluszone_fin_erp_state_v43_oct8_equb_and_tx_final',
      'pluszone_fin_erp_state_v33_sep24_30_updated',
      'pluszone_fin_erp_state_v32_sep24_30_updated',
      'pluszone_fin_erp_state_v31_sep24_30_updated',
      'pluszone_fin_erp_state_v30_loans_equbs_included',
      'pluszone_fin_erp_state_v29_restored_history'
    ];

    const raw = localStorage.getItem(STORAGE_KEY);
    obsoleteKeys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (_) {}
    });
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        parsed.users = DEFAULT_USERS;
        parsed.currentUser = DEFAULT_USERS[0];
        parsed.chatMessages = [];
        parsed.equbs = [];
        parsed.loans = [];
        parsed.assets = [];
        parsed.receivables = [];
        parsed.transactions = [];
        parsed.transfers = [];
        parsed.wallets = [];
        parsed.recurring = [];
        parsed.goals = [];
        parsed.deletedEntityIds = [];
        parsed.categories = Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : DEFAULT_CATEGORIES;
        parsed.auditLogs = [];
        parsed.pendingReviewTransactions = [];
        parsed.approvalRequests = [];
        parsed.chatChannels = DEFAULT_CHAT_CHANNELS;
        parsed.automatedEmailReportsSettings = DEFAULT_AUTOMATED_EMAIL_REPORTS;
        parsed.sentReportEmailLogs = [];
        if (!parsed.shopHours || !parsed.shopHours.openTimeGMT) {
          parsed.shopHours = DEFAULT_SHOP_HOURS;
        }
        parsed.calendarType = 'GREGORIAN';
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse local storage ERP state:', e);
  }
  const state = createInitialState();
  saveStateToStorage(state);
  return state;
}

export function createInitialState(): ERPState {
  return {
    currentUser: DEFAULT_USERS[0],
    users: DEFAULT_USERS,
    wallets: [],
    transactions: [],
    transfers: [],
    equbs: [],
    loans: [],
    assets: [],
    goals: [],
    recurring: [],
    receivables: [],
    categories: DEFAULT_CATEGORIES,
    auditLogs: [
      {
        id: 'aud-init-today',
        timestamp: new Date().toISOString(),
        actorId: 'u-1',
        actorName: 'Suraphel',
        action: 'SYSTEM_START',
        entity: 'System',
        entityId: 'genesis',
        diffAfter: { status: 'Lounge ERP Initialized for Suraphel - Zero Wallets & Zero Transactions Clean Baseline' },
        branch: 'Addis Ababa HQ'
      }
    ],
    approvalRequests: [],
    digitalMoneyManagerUserId: DEFAULT_USERS[0].id,
    autoImportSettings: {
      enabled: true,
      importMethod: 'BOTH',
      selectedProvider: 'ALL',
      autoCategorize: true,
      notifyOnNewPending: true
    },
    pendingReviewTransactions: [],
    chatChannels: DEFAULT_CHAT_CHANNELS,
    chatMessages: [],
    automatedEmailReportsSettings: DEFAULT_AUTOMATED_EMAIL_REPORTS,
    sentReportEmailLogs: [],
    deletedEntityIds: [],
    shopHours: DEFAULT_SHOP_HOURS,
    theme: 'dark',
    hideBalances: false,
    calendarType: 'GREGORIAN'
  };
}

export function saveStateToStorage(state: ERPState) {
  if (typeof window !== 'undefined') {
    try {
      const stateToPersist = {
        ...state,
        transactions: consolidateEqubSplitTransactions(state.transactions, state.wallets)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
    } catch (e) {
      console.error('Failed to save ERP state:', e);
    }
  }
}

/**
 * Hard-resets the entire local data repository to the clean baseline.
 */
export function resetEntireSystemToCleanSlate(): ERPState {
  if (typeof window !== 'undefined') {
    try {
      localStorage.clear();
    } catch (_) {}
  }
  const clean = createInitialState();
  saveStateToStorage(clean);
  return clean;
}

/**
 * Calculations based on the ONE-LEDGER PRINCIPLE:
 * Wallet Balance = openingBalance + total Income Posted - total Expense Posted + Transfers In - Transfers Out
 */
export function calculateWalletBalance(wallet: Wallet, transactions: Transaction[], transfers: Transfer[] = []): number {
  let balance = wallet.openingBalance || 0;

  // Active ledger period begins on 2026-09-07 where the user defined verified opening balances.
  // Prior period transactions (July 1 - Sep 6) are preserved for historical audit & reporting.
  const activePeriodStart = '2026-10-24T00:00:00.000Z';
  const activeTransactions = transactions.filter(tx => tx.date >= activePeriodStart);
  const activeTransfers = (transfers || []).filter(tr => tr.date >= activePeriodStart);

  for (const tx of activeTransactions) {
    if (tx.reversed) continue;
    if (tx.splits && tx.splits.length > 0) {
      const split = tx.splits.find(s => s.walletId === wallet.id);
      if (split) {
        if (tx.type === 'INCOME') {
          balance += Math.abs(split.amount);
        } else {
          balance -= Math.abs(split.amount);
        }
      }
    } else if (tx.walletId === wallet.id) {
      if (tx.type === 'INCOME') {
        balance += Math.abs(tx.amount);
      } else if (tx.type === 'EXPENSE') {
        balance -= Math.abs(tx.amount);
      }
    }
  }

  for (const tr of activeTransfers) {
    if (tr.toWalletId === wallet.id) {
      balance += Math.abs(tr.amount);
    }
    if (tr.fromWalletId === wallet.id) {
      balance -= Math.abs(tr.amount);
    }
  }

  // Strict non-negative guarantee for wallets (wallet balances cannot drop below ETB 0)
  return Math.max(0, balance);
}

export function calculateTotalBusinessBalance(wallets: Wallet[], transactions: Transaction[], transfers: Transfer[]): number {
  return Math.max(0, wallets.reduce((acc, w) => acc + calculateWalletBalance(w, transactions, transfers), 0));
}

/**
 * Calculates net activity (inflows minus outflows) for a wallet since the active ledger start date.
 */
export function calculateWalletNetActivity(walletId: string, transactions: Transaction[], transfers: Transfer[] = []): number {
  let net = 0;
  const activePeriodStart = '2026-10-24T00:00:00.000Z';
  const activeTransactions = transactions.filter(tx => tx.date >= activePeriodStart);
  const activeTransfers = (transfers || []).filter(tr => tr.date >= activePeriodStart);

  for (const tx of activeTransactions) {
    if (tx.reversed) continue;
    if (tx.splits && tx.splits.length > 0) {
      const split = tx.splits.find(s => s.walletId === walletId);
      if (split) {
        if (tx.type === 'INCOME') {
          net += Math.abs(split.amount);
        } else {
          net -= Math.abs(split.amount);
        }
      }
    } else if (tx.walletId === walletId) {
      if (tx.type === 'INCOME') {
        net += Math.abs(tx.amount);
      } else if (tx.type === 'EXPENSE') {
        net -= Math.abs(tx.amount);
      }
    }
  }

  for (const tr of activeTransfers) {
    if (tr.toWalletId === walletId) {
      net += Math.abs(tr.amount);
    }
    if (tr.fromWalletId === walletId) {
      net -= Math.abs(tr.amount);
    }
  }

  return net;
}

/**
 * Derives the opening balance required so that the current calculated wallet balance equals the target balance.
 */
export function getAdjustedOpeningBalanceForTargetBalance(
  walletId: string,
  targetBalance: number,
  transactions: Transaction[],
  transfers: Transfer[] = []
): number {
  const netActivity = calculateWalletNetActivity(walletId, transactions, transfers);
  return Math.max(0, targetBalance - netActivity);
}

/**
 * Balance & Wallet Rules:
 * Wallets strictly do NOT allow negative balances / overdrafts.
 */
export function isOverdraftAllowed(_wallet?: Wallet): boolean {
  return false;
}

/**
 * Balance & Wallet Rules:
 * 2. Checks if a wallet exists and is active (not archived or disabled).
 */
export function isWalletActive(wallet?: Wallet): boolean {
  if (!wallet) return false;
  if (wallet.status === 'ARCHIVED' || wallet.status === 'DISABLED') return false;
  if (wallet.isArchived === true || wallet.isDisabled === true) return false;
  return true;
}

export interface WalletValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates transaction posting against Balance & Wallet Rules:
 * - Wallet must exist and be active.
 * - Expense cannot take wallet balance below zero unless overdraft is allowed.
 */
export function validateTransactionPosting(
  wallet: Wallet | undefined,
  type: 'INCOME' | 'EXPENSE',
  amount: number,
  transactions: Transaction[],
  transfers: Transfer[]
): WalletValidationResult {
  if (!wallet) {
    return { valid: false, error: 'Target wallet does not exist.' };
  }

  if (!isWalletActive(wallet)) {
    const statusText = wallet.status === 'ARCHIVED' || wallet.isArchived ? 'archived' : 'disabled';
    return {
      valid: false,
      error: `Cannot post to ${statusText} wallet "${wallet.name}". Wallet must be active.`
    };
  }

  const absAmount = Math.abs(amount);
  if (isNaN(absAmount) || absAmount <= 0) {
    return { valid: false, error: 'Transaction amount must be greater than ETB 0.' };
  }

  if (type === 'EXPENSE') {
    const currentBalance = calculateWalletBalance(wallet, transactions, transfers);
    if (!isOverdraftAllowed(wallet) && currentBalance - absAmount < 0) {
      return {
        valid: false,
        error: `Overdraft blocked: Wallet "${wallet.name}" balance (${formatETB(currentBalance)}) is insufficient for expense of ${formatETB(absAmount)}. Overdraft is not permitted on this account.`
      };
    }
  }

  return { valid: true };
}

/**
 * Validates inter-wallet transfer against Balance & Wallet Rules:
 * 1. Both wallets exist and are active.
 * 2. Source and destination wallets are distinct.
 * 3. Source wallet balance cannot drop below zero unless overdraft is allowed.
 * 4. Transfer amount must be positive.
 * 5. Debit and credit legs strictly balance (exact equal amounts on both sides).
 */
export function validateTransfer(
  fromWallet: Wallet | undefined,
  toWallet: Wallet | undefined,
  amount: number,
  transactions: Transaction[],
  transfers: Transfer[],
  excludeTransferId?: string
): WalletValidationResult {
  if (!fromWallet) {
    return { valid: false, error: 'Source wallet does not exist.' };
  }
  if (!toWallet) {
    return { valid: false, error: 'Destination wallet does not exist.' };
  }
  if (fromWallet.id === toWallet.id) {
    return { valid: false, error: 'Source and destination wallets must be different accounts.' };
  }

  if (!isWalletActive(fromWallet)) {
    const fromStatus = fromWallet.status === 'ARCHIVED' || fromWallet.isArchived ? 'archived' : 'disabled';
    return {
      valid: false,
      error: `Cannot transfer from ${fromStatus} wallet "${fromWallet.name}". Only active wallets can originate transfers.`
    };
  }
  if (!isWalletActive(toWallet)) {
    const toStatus = toWallet.status === 'ARCHIVED' || toWallet.isArchived ? 'archived' : 'disabled';
    return {
      valid: false,
      error: `Cannot transfer to ${toStatus} wallet "${toWallet.name}". Only active wallets can receive transfers.`
    };
  }

  const absAmount = Math.abs(amount);
  if (isNaN(absAmount) || absAmount <= 0) {
    return { valid: false, error: 'Transfer amount must be greater than ETB 0.' };
  }

  const effectiveTransfers = excludeTransferId
    ? transfers.filter(t => t.id !== excludeTransferId)
    : transfers;
  const currentFromBalance = calculateWalletBalance(fromWallet, transactions, effectiveTransfers);
  if (!isOverdraftAllowed(fromWallet) && currentFromBalance - absAmount < 0) {
    return {
      valid: false,
      error: `Overdraft blocked: Source wallet "${fromWallet.name}" balance (${formatETB(currentFromBalance)}) cannot cover transfer of ${formatETB(absAmount)}. Overdraft is not permitted on this account.`
    };
  }

  return { valid: true };
}

/**
 * Computes chronological running balances for each wallet at every transaction point in time.
 * Returns a mapping: tx.id -> { [walletId]: runningBalance }
 */
export function computeAllWalletRunningBalances(
  wallets: Wallet[],
  transactions: Transaction[],
  transfers: Transfer[] = []
): Record<string, Record<string, number>> {
  const walletBalances: Record<string, number> = {};
  // Prior historical period (before Sep 7) starts from genesis setup
  wallets.forEach(w => {
    walletBalances[w.id] = 0;
  });

  const activePeriodStartTime = new Date('2026-10-24T00:00:00.000Z').getTime();
  let periodResetDone = false;

  type LedgerEvent =
    | { kind: 'tx'; date: number; id: string; tx: Transaction }
    | { kind: 'transfer'; date: number; id: string; transfer: Transfer };

  const events: LedgerEvent[] = [];

  transactions.forEach(tx => {
    const timeVal = new Date(tx.date).getTime();
    events.push({
      kind: 'tx',
      date: isNaN(timeVal) ? 0 : timeVal,
      id: tx.id,
      tx
    });
  });

  transfers.forEach(tr => {
    const timeVal = new Date(tr.date).getTime();
    events.push({
      kind: 'transfer',
      date: isNaN(timeVal) ? 0 : timeVal,
      id: tr.id,
      transfer: tr
    });
  });

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date - b.date;
    return (a.id || '').localeCompare(b.id || '');
  });

  const txToWalletBalances: Record<string, Record<string, number>> = {};

  for (const ev of events) {
    // When reaching the verified active period (Sep 7 onwards), initialize with verified opening balances
    if (!periodResetDone && ev.date >= activePeriodStartTime) {
      wallets.forEach(w => {
        walletBalances[w.id] = w.openingBalance || 0;
      });
      periodResetDone = true;
    }

    if (ev.kind === 'tx') {
      const tx = ev.tx;
      if (!tx.reversed) {
        if (tx.splits && tx.splits.length > 0) {
          for (const s of tx.splits) {
            if (walletBalances[s.walletId] !== undefined) {
              if (tx.type === 'INCOME') {
                walletBalances[s.walletId] += Math.abs(s.amount);
              } else {
                walletBalances[s.walletId] = Math.max(0, walletBalances[s.walletId] - Math.abs(s.amount));
              }
            }
          }
        } else if (tx.walletId && walletBalances[tx.walletId] !== undefined) {
          if (tx.type === 'INCOME') {
            walletBalances[tx.walletId] += Math.abs(tx.amount);
          } else {
            walletBalances[tx.walletId] = Math.max(0, walletBalances[tx.walletId] - Math.abs(tx.amount));
          }
        }
      }
      txToWalletBalances[tx.id] = { ...walletBalances };
    } else if (ev.kind === 'transfer') {
      const tr = ev.transfer;
      if (walletBalances[tr.fromWalletId] !== undefined) {
        walletBalances[tr.fromWalletId] = Math.max(0, walletBalances[tr.fromWalletId] - Math.abs(tr.amount));
      }
      if (walletBalances[tr.toWalletId] !== undefined) {
        walletBalances[tr.toWalletId] += Math.abs(tr.amount);
      }
      txToWalletBalances[tr.id] = { ...walletBalances };
    }
  }

  return txToWalletBalances;
}

export function getWalletNickname(name?: string): string {
  if (!name) return 'Wallet';
  const lower = name.toLowerCase();
  if (lower.includes('saving')) return 'Saving wallet';
  if (lower.includes('telebirr') || lower.includes('tele')) return 'Telebirr';
  if (lower.includes('cbe birr') || lower.includes('cbebirr') || lower.includes('ebirr') || lower.includes('e-birr')) return 'eBirr';
  if (lower.includes('cbe') || lower.includes('commercial bank') || lower.includes('bank of ethiopia')) return 'CBE';
  if (lower.includes('cash') || lower.includes('vault') || lower.includes('drawer')) return 'Cash';
  return name.length > 14 ? name.slice(0, 12) + '...' : name;
}

export interface RelativeWalletInfo {
  walletId: string;
  walletName: string;
  amount?: number;
  balance: number;
}

export interface RelativeTransferWalletInfo {
  fromWalletId: string;
  fromWalletName: string;
  fromBalance: number;
  toWalletId: string;
  toWalletName: string;
  toBalance: number;
}

export function getRelativeWalletBalancesForTx(
  tx: Transaction,
  wallets: Wallet[],
  runningBalancesAtTx?: Record<string, number>
): RelativeWalletInfo[] {
  if (tx.splits && tx.splits.length > 0) {
    return tx.splits.map(s => {
      const w = wallets.find(item => item.id === s.walletId);
      return {
        walletId: s.walletId,
        walletName: w ? getWalletNickname(w.name) : 'Wallet',
        amount: s.amount,
        balance: runningBalancesAtTx ? (runningBalancesAtTx[s.walletId] ?? 0) : 0
      };
    });
  }

  const mainW = wallets.find(w => w.id === tx.walletId);
  return [
    {
      walletId: tx.walletId,
      walletName: mainW ? getWalletNickname(mainW.name) : 'Wallet',
      amount: tx.amount,
      balance: runningBalancesAtTx ? (runningBalancesAtTx[tx.walletId] ?? 0) : 0
    }
  ];
}

export function getRelativeWalletBalancesForTransfer(
  tr: Transfer,
  wallets: Wallet[],
  runningBalancesAtTransfer?: Record<string, number>
): RelativeTransferWalletInfo {
  const fromW = wallets.find(w => w.id === tr.fromWalletId);
  const toW = wallets.find(w => w.id === tr.toWalletId);
  return {
    fromWalletId: tr.fromWalletId,
    fromWalletName: fromW ? getWalletNickname(fromW.name) : 'Source Wallet',
    fromBalance: runningBalancesAtTransfer ? (runningBalancesAtTransfer[tr.fromWalletId] ?? 0) : 0,
    toWalletId: tr.toWalletId,
    toWalletName: toW ? getWalletNickname(toW.name) : 'Destination Wallet',
    toBalance: runningBalancesAtTransfer ? (runningBalancesAtTransfer[tr.toWalletId] ?? 0) : 0
  };
}

export function calculateMonthlyStats(transactions: Transaction[], receivables: Receivable[] = []) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let income = 0;
  let expense = 0;
  let creditWork = 0;

  for (const tx of transactions) {
    if (tx.reversed) continue;
    const d = new Date(tx.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      if (tx.type === 'INCOME') {
        income += tx.amount;
      } else {
        expense += tx.amount;
      }
    }
  }

  // Include credit work (uncollected receivables created in this month) in business work totals
  // Note: If a receivable was already collected, the cash income transaction is already in transactions!
  if (Array.isArray(receivables)) {
    for (const r of receivables) {
      if (!r.createdDate && !r.dueDate) continue;
      const d = new Date(r.createdDate || r.dueDate);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const uncollected = Math.max(0, (r.amountOwed || 0) - (r.amountCollected || 0));
        creditWork += uncollected;
        income += uncollected;
      }
    }
  }

  const profit = income - expense;
  return { income, expense, profit, creditWork };
}

export function calculateIncomeAverages(transactions: Transaction[], receivables: Receivable[] = []) {
  const validIncomes = transactions.filter(tx => !tx.reversed && tx.type === 'INCOME');
  
  // Calculate uncollected credit work from receivables
  const uncollectedReceivables = (receivables || []).filter(r => (r.amountOwed || 0) > (r.amountCollected || 0));
  const totalCreditWork = uncollectedReceivables.reduce((sum, r) => sum + Math.max(0, (r.amountOwed || 0) - (r.amountCollected || 0)), 0);

  if (validIncomes.length === 0 && totalCreditWork === 0) {
    return {
      weeklyAvg: 0,
      weeklyDailyAvg: 0,
      totalWeeklyAvg: 0,
      monthlyAvg: 0,
      dailyAvg: 0,
      currentWeekIncome: 0,
      currentMonthIncome: 0,
      totalIncome: 0,
      creditWork: 0
    };
  }

  const now = new Date();
  const nowMs = now.getTime();

  const timestamps = [
    ...transactions.filter(t => !t.reversed).map(tx => new Date(tx.date).getTime()),
    ...uncollectedReceivables.map(r => new Date(r.createdDate || r.dueDate).getTime())
  ].filter(t => !isNaN(t));

  const minTime = timestamps.length > 0 ? Math.min(...timestamps) : nowMs;

  const daysDiff = Math.max(1, Math.ceil((nowMs - minTime) / (1000 * 60 * 60 * 24)));
  const weeksDiff = Math.max(1, daysDiff / 7);
  const monthsDiff = Math.max(1, daysDiff / 30);

  const totalCashIncome = validIncomes.reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncome = totalCashIncome + totalCreditWork;

  const dailyAvg = totalIncome / daysDiff;
  const totalWeeklyAvg = totalIncome / weeksDiff;
  const monthlyAvg = totalIncome / monthsDiff;

  const sevenDaysAgo = nowMs - (7 * 24 * 60 * 60 * 1000);
  let currentWeekTxs = validIncomes.filter(tx => new Date(tx.date).getTime() >= sevenDaysAgo);
  const currentWeekCredit = uncollectedReceivables
    .filter(r => new Date(r.createdDate || r.dueDate).getTime() >= sevenDaysAgo)
    .reduce((s, r) => s + Math.max(0, (r.amountOwed || 0) - (r.amountCollected || 0)), 0);

  if (currentWeekTxs.length === 0 && validIncomes.length > 0) {
    const latestTxTime = Math.max(...validIncomes.map(tx => new Date(tx.date).getTime()));
    const anchorSevenDaysAgo = latestTxTime - (7 * 24 * 60 * 60 * 1000);
    currentWeekTxs = validIncomes.filter(tx => {
      const t = new Date(tx.date).getTime();
      return t >= anchorSevenDaysAgo && t <= latestTxTime;
    });
  }

  const currentWeekIncome = currentWeekTxs.reduce((sum, tx) => sum + tx.amount, 0) + currentWeekCredit;
  const weeklyDailyAvg = currentWeekIncome / 7;
  const weeklyAvg = weeklyDailyAvg;

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentMonthCredit = uncollectedReceivables
    .filter(r => {
      const d = new Date(r.createdDate || r.dueDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((s, r) => s + Math.max(0, (r.amountOwed || 0) - (r.amountCollected || 0)), 0);

  const currentMonthIncome = validIncomes
    .filter(tx => {
      const d = new Date(tx.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, tx) => sum + tx.amount, 0) + currentMonthCredit;

  return {
    dailyAvg,
    weeklyAvg,
    weeklyDailyAvg,
    totalWeeklyAvg,
    monthlyAvg,
    currentWeekIncome,
    currentMonthIncome,
    totalIncome,
    creditWork: totalCreditWork
  };
}

export function isTransactionEditable(txDateString: string): boolean {
  if (!txDateString) return false;
  const txTime = new Date(txDateString).getTime();
  if (isNaN(txTime)) return false;
  const now = Date.now();
  const diffDays = (now - txTime) / (1000 * 60 * 60 * 24);
  // Transaction is editable if it's within the 7-day window (0 to 7 days old)
  return diffDays >= 0 && diffDays <= 7;
}

export function isCreditSaleCollected(tx: { category?: string; description?: string; refType?: string; isCreditSale?: boolean; type?: string } | null | undefined): boolean {
  if (!tx) return false;
  // If explicitly tagged as an EXPENSE (e.g. loan repayment expense paid to others), not an income credit collection
  if (tx.type === 'EXPENSE' && tx.refType !== 'RECEIVABLE') return false;

  if (tx.refType === 'RECEIVABLE') return true;
  if (tx.isCreditSale) return true;
  
  const cat = (tx.category || '').toLowerCase().trim();
  const desc = (tx.description || '').toLowerCase().trim();

  // Category matching
  if (
    cat.includes('daily income / collected') ||
    cat.includes('daily income/collected') ||
    cat.includes('daily income/ collected') ||
    cat.includes('receivable collected') ||
    cat.includes('receivables collected') ||
    cat.includes('receivable') ||
    cat.includes('receivables') ||
    cat.includes('credit collected') ||
    cat.includes('credit sale') ||
    cat.includes('debt collection') ||
    cat.includes('debt collected') ||
    cat.includes('credit repayment')
  ) {
    return true;
  }

  // Description matching
  if (
    desc.includes('daily income / collected') ||
    desc.includes('daily income/collected') ||
    desc.includes('daily income/ collected') ||
    desc.includes('collected from') ||
    desc.includes('collected customer debt') ||
    desc.includes('repayment on receivable') ||
    desc.includes('repayment from') ||
    desc.includes('credit sale collected') ||
    desc.includes('credit collected') ||
    desc.includes('debt payment') ||
    desc.includes('customer debt') ||
    desc.includes('debt collected') ||
    desc.includes('receivable collected') ||
    desc.includes('receivables collected') ||
    desc.includes('split repayment on receivable') ||
    desc.includes('settled credit') ||
    desc.includes('settled receivable') ||
    desc.includes('weframu')
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves the display title for collected receivables to "Collected from <CustomerName>".
 */
export function getReceivableCollectedTitle(
  tx: { description?: string; category?: string; refType?: string; refId?: string } | null | undefined,
  receivables?: Receivable[]
): string {
  if (!tx) return '';
  const desc = (tx.description || '').trim();

  // If already matches "Collected from <Name>", ensure proper capitalization and return
  if (/^Collected from\s+/i.test(desc)) {
    return 'Collected from ' + desc.replace(/^Collected from\s+/i, '').trim();
  }

  // If refId is provided, look up the receivable customer name
  if (tx.refId && receivables && receivables.length > 0) {
    const matched = receivables.find(r => r.id === tx.refId);
    if (matched && matched.customerName) {
      return `Collected from ${matched.customerName}`;
    }
  }

  // Check if description contains customer name in square brackets: "Repayment on receivable [Customer]"
  const bracketMatch = desc.match(/\[([^\]]+)\]/);
  if (bracketMatch && bracketMatch[1]) {
    return `Collected from ${bracketMatch[1].trim()}`;
  }

  // Check "Daily Income / Collected: <Name>"
  const dailyIncomePrefixMatch = desc.match(/^Daily Income\s*\/\s*Collected:\s*([^(]+)/i);
  if (dailyIncomePrefixMatch && dailyIncomePrefixMatch[1]) {
    const rawName = dailyIncomePrefixMatch[1].trim();
    if (rawName && !/^Repayment/i.test(rawName)) {
      return `Collected from ${rawName}`;
    }
  }

  // Check "Repayment from <Name>"
  const repaymentFromMatch = desc.match(/^Repayment from\s+([^(]+)/i);
  if (repaymentFromMatch && repaymentFromMatch[1]) {
    return `Collected from ${repaymentFromMatch[1].trim()}`;
  }

  // Check if refType is RECEIVABLE or category is Daily Income / Collected / Receivable Collected
  if (tx.refType === 'RECEIVABLE' || isCreditSaleCollected(tx)) {
    if (tx.refId?.toLowerCase().includes('solomon') || /solomon/i.test(desc)) return 'Collected from Solomon';
    if (tx.refId?.toLowerCase().includes('fike') || /fike/i.test(desc)) return 'Collected from Fike';
    if (tx.refId?.toLowerCase().includes('weframu') || /weframu/i.test(desc)) return 'Collected from Weframu lij';
    if (tx.refId?.toLowerCase().includes('fikadu') || /fikadu/i.test(desc)) return 'Collected from Fikadu';

    if (/repayment on receivable/i.test(desc) || /^Daily Income\s*\/\s*Collected$/i.test(desc)) {
      return 'Collected from Customer';
    }
  }

  return desc;
}

/**
 * Returns the primary display title of a transaction in list views and cards.
 * If the transaction represents a collected receivable, formats as "Collected from <CustomerName>".
 */
export function getTransactionDisplayTitle(
  tx: { description?: string; category?: string; refType?: string; refId?: string } | null | undefined,
  receivables?: Receivable[]
): string {
  if (!tx) return '';
  if (tx.refType === 'RECEIVABLE' || isCreditSaleCollected(tx)) {
    return getReceivableCollectedTitle(tx, receivables);
  }
  return tx.description || tx.category || 'Transaction';
}

export function formatETB(amount: number, compact = false): string {
  const absVal = Math.abs(amount || 0);
  let valStr = '';
  if (compact) {
    if (absVal >= 1_000_000) {
      valStr = `ETB ${(absVal / 1_000_000).toFixed(2)}M`;
    } else if (absVal >= 1_000) {
      valStr = `ETB ${(absVal / 1_000).toFixed(1)}K`;
    } else {
      valStr = `ETB ${Math.round(absVal).toLocaleString('en-US')}`;
    }
  } else {
    valStr = `ETB ${Math.round(absVal).toLocaleString('en-US')}`;
  }
  return amount < 0 ? `-${valStr}` : valStr;
}

export interface SummedAmountResult {
  total: number;
  count: number;
  items: number[];
  isValid: boolean;
  formattedExpression: string;
}

/**
 * Parses user input amounts that can be single numbers or expressions/comma-separated values.
 * Enforces positive absolute amounts for professional ERP ledger entries.
 */
export function parseSummedAmount(inputStr: string): SummedAmountResult {
  if (!inputStr || !inputStr.trim()) {
    return { total: 0, count: 0, items: [], isValid: false, formattedExpression: '' };
  }
  const trimmed = inputStr.trim();

  // If standard number without separators (e.g. "90" or "90.5" or "-90")
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const val = Math.abs(parseFloat(trimmed));
    const valid = !isNaN(val) && val > 0;
    return {
      total: valid ? val : 0,
      count: 1,
      items: valid ? [val] : [],
      isValid: valid,
      formattedExpression: valid ? `${val}` : ''
    };
  }

  // Standard thousand separator number (e.g. "1,000" or "10,500.50" or "-1,000")
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed)) {
    const val = Math.abs(parseFloat(trimmed.replace(/,/g, '')));
    const valid = !isNaN(val) && val > 0;
    return {
      total: valid ? val : 0,
      count: 1,
      items: valid ? [val] : [],
      isValid: valid,
      formattedExpression: valid ? `${val}` : ''
    };
  }

  // Split by commas, plus signs, spaces, or newlines (e.g. "40,50", "40, 50, 100", "40+50+10.5")
  const rawTokens = trimmed.split(/[\s,+\n]+/);
  const validNumbers: number[] = [];

  for (const token of rawTokens) {
    if (!token) continue;
    const cleanToken = token.replace(/,/g, '');
    const num = Math.abs(parseFloat(cleanToken));
    if (!isNaN(num) && num > 0) {
      validNumbers.push(num);
    }
  }

  if (validNumbers.length === 0) {
    return { total: 0, count: 0, items: [], isValid: false, formattedExpression: '' };
  }

  const total = validNumbers.reduce((a, b) => a + b, 0);
  const roundedTotal = Math.round(total * 100) / 100;

  return {
    total: roundedTotal,
    count: validNumbers.length,
    items: validNumbers,
    isValid: roundedTotal > 0,
    formattedExpression: validNumbers.join(' + ')
  };
}

/**
 * Safely merges a local list and remote list by unique item ID.
 * Ensures that newly created local transactions, users, wallets, etc. are never lost during sync,
 * while strictly filtering out any IDs recorded in deletedEntityIds to prevent resurrected items.
 */
export function mergeListById<T extends { id: string }>(
  localList: T[] = [],
  remoteList: T[] = [],
  deletedEntityIds: string[] = []
): T[] {
  if (!Array.isArray(localList)) localList = [];
  if (!Array.isArray(remoteList)) remoteList = [];
  const rawDeletedIds = Array.isArray(deletedEntityIds) ? deletedEntityIds : [];
  const deletedSet = new Set(rawDeletedIds.filter((id: string) => !isCanonicalTransactionId(id)));
  deletedSet.add('tx-1790749015154');
  deletedSet.add('tx-1790748931615');
  const map = new Map<string, T>();

  // 1. Populate remote items first (skipping deleted entities, keeping canonical ledger items)
  remoteList.forEach(item => {
    if (item && typeof item === 'object' && item.id && (isCanonicalTransactionId(item.id) || !deletedSet.has(item.id))) {
      map.set(item.id, item);
    }
  });

  // 2. Local items overwrite remote items with the same ID (skipping deleted entities, keeping canonical ledger items)
  localList.forEach(item => {
    if (item && typeof item === 'object' && item.id && (isCanonicalTransactionId(item.id) || !deletedSet.has(item.id))) {
      map.set(item.id, item);
    }
  });

  let merged = Array.from(map.values());

  // Additional safety check: If items are transactions with refType === 'RECEIVABLE', deduplicate accidental multi-posts
  if (merged.length > 0 && (merged[0] as any)?.refType !== undefined) {
    const seenRcv = new Set<string>();
    const deduplicated = merged.filter((item: any) => {
      if (item.refType === 'RECEIVABLE' && item.refId) {
        const timeBucket = Math.floor(new Date(item.date || 0).getTime() / 10000);
        const key = `${item.refId}_${item.amount}_${timeBucket}`;
        if (seenRcv.has(key)) {
          return false;
        }
        seenRcv.add(key);
      }
      return true;
    });
    merged = consolidateEqubSplitTransactions(deduplicated as any) as any;
  }

  // Update transactions and dated records sorted chronologically by their dates (descending)
  if (merged.length > 0 && (merged[0] as any)?.date) {
    return merged.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  return merged;
}

/**
 * Merges chat messages prioritizing authoritative server messages while preserving
 * locally queued / optimistic messages and sorting strictly by timestamp.
 */
export function mergeChatMessages(
  localList: ChatMessage[] = [],
  liveList: ChatMessage[] = [],
  deletedMessageIds: string[] = []
): ChatMessage[] {
  const deletedSet = new Set(
    (Array.isArray(deletedMessageIds) ? deletedMessageIds : []).filter(
      (id) => typeof id === 'string' && id.length > 0
    )
  );
  const map = new Map<string, ChatMessage>();

  // 1. First add local messages (optimistic / pending)
  (Array.isArray(localList) ? localList : []).forEach(item => {
    if (item && item.id && !deletedSet.has(item.id)) {
      map.set(item.id, item);
    }
  });

  // 2. Authoritative live server messages overwrite local copies (getting newest reactions, server timestamps, etc.)
  (Array.isArray(liveList) ? liveList : []).forEach(item => {
    if (item && item.id && !deletedSet.has(item.id)) {
      map.set(item.id, item);
    }
  });

  const parseTs = (ts?: string | number) => {
    if (!ts) return 0;
    const n = typeof ts === 'number' ? ts : new Date(ts).getTime();
    return isNaN(n) ? 0 : n;
  };

  return Array.from(map.values()).sort((a, b) => {
    const diff = parseTs(a.timestamp) - parseTs(b.timestamp);
    if (diff !== 0) return diff;
    return (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Automatically consolidates sibling split transactions generated for the same Equb round payment
 * into a single unified transaction showing the total payment, with itemized wallet splits.
 * Also ensures any transaction that contains `splits` has its `amount` equal to the total sum of the splits.
 */
export function consolidateEqubSplitTransactions(
  transactions: Transaction[],
  wallets?: Wallet[]
): Transaction[] {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  // Helper to extract round number from string
  const extractRound = (str?: string): string | null => {
    if (!str) return null;
    const match = str.match(/round\s*#?\s*(\d+)/i);
    return match ? match[1] : null;
  };

  const getGroupKey = (tx: Transaction): string | null => {
    // 1. tx-eq-<timestamp>-<index> (multi-transaction generation from previous logic)
    const eqBatchMatch = tx.id.match(/^tx-eq-(\d+)-\d+$/);
    if (eqBatchMatch) {
      return `batch_${eqBatchMatch[1]}`;
    }

    const isEqub =
      tx.refType === 'EQUB' ||
      tx.category?.toLowerCase() === 'equb contribution' ||
      tx.category?.toLowerCase() === 'ekub' ||
      tx.category?.toLowerCase() === 'equb' ||
      tx.description?.toLowerCase().includes('round 21') ||
      tx.description?.toLowerCase().includes('round #21') ||
      (tx.description?.toLowerCase().includes('agerye') && tx.description?.toLowerCase().includes('round'));

    if (!isEqub || tx.type !== 'EXPENSE') return null;

    const roundNum = extractRound(tx.description);
    const datePrefix = (tx.date || '').slice(0, 10); // YYYY-MM-DD

    // Specifically handle Aug 17 Round 21 transactions
    if (
      (datePrefix === '2026-08-17' || tx.description?.includes('2026-08-17')) &&
      (roundNum === '21' || !roundNum || tx.description?.toLowerCase().includes('agerye'))
    ) {
      return 'equb_2026-08-17_round21';
    }

    // Handle any round with date
    if (roundNum && datePrefix) {
      return `equb_${datePrefix}_round${roundNum}`;
    }

    // Handle by refId & date
    if (tx.refId && datePrefix) {
      return `equb_${datePrefix}_${tx.refId}${roundNum ? `_r${roundNum}` : ''}`;
    }

    return null;
  };

  const groups: Record<string, Transaction[]> = {};
  const standalone: Transaction[] = [];

  for (const tx of transactions) {
    const key = getGroupKey(tx);
    if (key) {
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    } else {
      standalone.push(tx);
    }
  }

  const result: Transaction[] = [];

  // First process standalone transactions: ensure if any has splits, its amount is the sum of splits
  for (const tx of standalone) {
    if (tx.splits && tx.splits.length > 1) {
      const splitsTotal = tx.splits.reduce((sum, s) => sum + Math.abs(s.amount), 0);
      result.push({
        ...tx,
        amount: splitsTotal > 0 ? splitsTotal : tx.amount
      });
    } else {
      result.push(tx);
    }
  }

  // Next process groups
  for (const [key, groupTxs] of Object.entries(groups)) {
    if (groupTxs.length === 1) {
      const tx = groupTxs[0];
      if (tx.splits && tx.splits.length > 1) {
        const splitsTotal = tx.splits.reduce((sum, s) => sum + Math.abs(s.amount), 0);
        result.push({
          ...tx,
          amount: splitsTotal > 0 ? splitsTotal : tx.amount
        });
      } else {
        result.push(tx);
      }
      continue;
    }

    // Multiple transactions for the same Equb payment! Consolidate them into ONE.
    groupTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const baseTx = groupTxs[0];

    // Check if one of them already has the complete splits array
    const existingSplitsTx = groupTxs.find(t => t.splits && t.splits.length > 1);
    
    let consolidatedSplits: Array<{ walletId: string; amount: number }> = [];
    if (existingSplitsTx && existingSplitsTx.splits) {
      consolidatedSplits = existingSplitsTx.splits.map(s => ({
        walletId: s.walletId,
        amount: Math.abs(s.amount)
      }));
    } else {
      const walletMap = new Map<string, number>();
      for (const t of groupTxs) {
        if (t.splits && t.splits.length > 0) {
          for (const s of t.splits) {
            walletMap.set(s.walletId, (walletMap.get(s.walletId) || 0) + Math.abs(s.amount));
          }
        } else if (t.walletId) {
          walletMap.set(t.walletId, (walletMap.get(t.walletId) || 0) + Math.abs(t.amount));
        }
      }
      for (const [walletId, amount] of walletMap.entries()) {
        consolidatedSplits.push({ walletId, amount });
      }
    }

    const totalPaid = consolidatedSplits.reduce((sum, s) => sum + s.amount, 0) ||
      groupTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const primaryWalletId = consolidatedSplits[0]?.walletId || baseTx.walletId || 'w-cash';

    // Build clear description
    const roundNum = extractRound(baseTx.description) || (key.includes('round21') ? '21' : '');
    const equbName = baseTx.description?.toLowerCase().includes('agerye') ? 'Agerye' : 'Equb';

    const splitSummary = consolidatedSplits.map(s => {
      const w = wallets?.find(wal => wal.id === s.walletId);
      const name = w ? getWalletNickname(w.name) : s.walletId;
      return `${name}: ${formatETB(s.amount)}`;
    }).join(', ');

    const cleanDesc = roundNum
      ? `${equbName} Round #${roundNum} payment (Split: ${splitSummary})`
      : `${equbName} payment (Split: ${splitSummary})`;

    const consolidatedTx: Transaction = {
      ...baseTx,
      id: baseTx.id,
      siblingTxIds: groupTxs.filter(t => t.id !== baseTx.id).map(t => t.id),
      amount: totalPaid,
      walletId: primaryWalletId,
      category: 'Equb Contribution',
      description: cleanDesc,
      splits: consolidatedSplits.length > 1 ? consolidatedSplits : undefined,
      refType: 'EQUB',
      refId: baseTx.refId || 'eq-agerye'
    };

    result.push(consolidatedTx);
  }

  // Sort descending by date
  return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Checks whether a transaction is an Equb contribution payment (expense).
 */
export function isEqubContributionTransaction(tx: Transaction): boolean {
  if (!tx) return false;
  if (tx.refType === 'EQUB' && tx.type === 'EXPENSE') return true;
  const cat = (tx.category || '').toLowerCase().trim();
  if (cat === 'equb contribution' || cat === 'ekub' || cat === 'equb') return true;
  const desc = (tx.description || '').toLowerCase();
  if (
    (desc.includes('equb') || desc.includes('ekub') || desc.includes('agerye')) &&
    (desc.includes('round') || desc.includes('contribution') || desc.includes('payment'))
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether a transaction is an Equb payout winning receipt (income).
 */
export function isEqubPayoutTransaction(tx: Transaction): boolean {
  if (!tx) return false;
  if (tx.refType === 'EQUB' && tx.type === 'INCOME') return true;
  const cat = (tx.category || '').toLowerCase().trim();
  if (cat === 'equb payout') return true;
  const desc = (tx.description || '').toLowerCase();
  return desc.includes('equb') && (desc.includes('payout') || desc.includes('winnings'));
}

/**
 * Finds the corresponding Equb circle for a transaction.
 */
export function findMatchingEqub(tx: Transaction, equbs: Equb[]): Equb | undefined {
  if (!equbs || equbs.length === 0 || !tx) return undefined;
  
  // 1. By refId
  if (tx.refId) {
    const found = equbs.find(e => e.id === tx.refId);
    if (found) return found;
  }
  
  // 2. By matching equb name in description
  const desc = (tx.description || '').toLowerCase();
  const byName = equbs.find(e => desc.includes(e.name.toLowerCase()));
  if (byName) return byName;
  
  // 3. If there is only one Equb registered
  if (equbs.length === 1) return equbs[0];
  
  // 4. Return matching active equb if amount matches contribution
  const byAmt = equbs.find(e => Math.abs(tx.amount) % e.contributionPerRound === 0);
  if (byAmt) return byAmt;

  return undefined;
}

/**
 * Reverts the Equb state when a contribution transaction is deleted or reversed.
 * Directly restores the previous round and sets status back to 'ACTIVE'.
 */
export function revertEqubForDeletedContribution(equb: Equb, tx: Transaction): {
  updatedEqub: Equb;
  restoredRound: number;
  previousRound: number;
} {
  const match = tx.description?.match(/round\s*#?\s*(\d+)/i);
  const roundInTx = match ? parseInt(match[1], 10) : null;

  let newRound = equb.currentRound;
  if (roundInTx !== null) {
    if (equb.currentRound > roundInTx) {
      // The equb had progressed past this round; restore back to this round so it can be re-paid
      newRound = roundInTx;
    } else if (equb.currentRound === roundInTx) {
      newRound = Math.max(1, roundInTx - 1);
    } else {
      newRound = Math.max(1, equb.currentRound - 1);
    }
  } else {
    newRound = Math.max(1, equb.currentRound - 1);
  }

  const updatedEqub: Equb = {
    ...equb,
    currentRound: newRound,
    completedRounds: Math.max(0, newRound - 1),
    status: 'ACTIVE'
  };

  return {
    updatedEqub,
    restoredRound: newRound,
    previousRound: equb.currentRound
  };
}

/**
 * Reverts the Equb state when a payout transaction is deleted or reversed.
 */
export function revertEqubForDeletedPayout(equb: Equb): Equb {
  return {
    ...equb,
    payoutsClaimed: Math.max(0, (equb.payoutsClaimed || 1) - 1)
  };
}

/**
 * Automatically syncs and updates recurring templates when a transaction is recorded.
 * E.g. If rent or another recurring expense is paid in advance, this advances nextDueDate
 * by the number of prepaid periods so future trajectory projections reflect the advance payment.
 */
export function syncRecurringWithTransaction(
  tx: Transaction,
  recurring: RecurringTemplate[]
): { updatedRecurring: RecurringTemplate[]; matchedTemplate?: RecurringTemplate; periodsCovered: number } {
  if (tx.type !== 'EXPENSE' || tx.reversed) {
    return { updatedRecurring: recurring, periodsCovered: 0 };
  }

  const catLower = (tx.category || '').toLowerCase();
  const descLower = (tx.description || '').toLowerCase();

  // Find matching recurring template
  let matchedIndex = -1;
  if (tx.refType === 'RECURRING' && tx.refId) {
    matchedIndex = recurring.findIndex(r => r.id === tx.refId);
  }

  if (matchedIndex === -1) {
    matchedIndex = recurring.findIndex(r => {
      const rTitleLower = r.title.toLowerCase();
      const rCatLower = (r.category || '').toLowerCase();

      // Rent match (advance rent, shop rent, house renewal, etc.)
      if (catLower.includes('rent') || descLower.includes('rent') || descLower.includes('renewal') || descLower.includes('lease')) {
        return rCatLower.includes('rent') || rTitleLower.includes('rent') || rTitleLower.includes('lease') || r.id === 'rec-rent-shop';
      }
      // Internet / Fiber
      if (catLower.includes('internet') || descLower.includes('internet') || descLower.includes('fiber')) {
        return rCatLower.includes('internet') || rTitleLower.includes('internet') || r.id === 'rec-internet-monthly';
      }
      // Electricity
      if (catLower.includes('electric') || descLower.includes('electric') || descLower.includes('power')) {
        return rCatLower.includes('electric') || rTitleLower.includes('electric') || r.id === 'rec-electricity-3w';
      }
      // Water
      if (catLower.includes('water') || descLower.includes('water')) {
        return rCatLower.includes('water') || rTitleLower.includes('water') || r.id === 'rec-water-2m';
      }
      // Security / Police
      if (catLower.includes('police') || catLower.includes('security') || descLower.includes('police') || descLower.includes('security')) {
        return rCatLower.includes('police') || rTitleLower.includes('police') || rTitleLower.includes('security') || r.id === 'rec-police-2m';
      }
      // Transport
      if (catLower.includes('transport') || descLower.includes('transport')) {
        if (descLower.includes('person 1') || descLower.includes('p1')) return r.id === 'rec-transport-p1';
        if (descLower.includes('person 2') || descLower.includes('p2')) return r.id === 'rec-transport-p2';
        if (descLower.includes('person 3') || descLower.includes('p3')) return r.id === 'rec-transport-p3';
        return rCatLower.includes('transport') || rTitleLower.includes('transport');
      }
      return false;
    });
  }

  if (matchedIndex === -1) {
    return { updatedRecurring: recurring, periodsCovered: 0 };
  }

  const r = recurring[matchedIndex];
  const templateAmt = r.amount > 0 ? r.amount : tx.amount;
  // Calculate how many periods this payment covers (e.g. paying 69k for 23k monthly rent = 3 periods)
  const periodsCovered = Math.max(1, Math.round(tx.amount / templateAmt));

  // Determine starting point for advancing the due date
  const txDate = new Date(tx.date);
  const curDue = r.nextDueDate ? new Date(r.nextDueDate) : txDate;
  // If payment is made before or at current due date (advance payment), advance from current due date.
  // If current due date is in the past, advance from transaction date.
  let baseDate = curDue.getTime() > txDate.getTime() ? curDue : txDate;

  for (let p = 0; p < periodsCovered; p++) {
    baseDate = calculateNextEthiopianDueDate(baseDate, r.frequency);
  }

  const updatedItem: RecurringTemplate = {
    ...r,
    lastProcessedDate: tx.date,
    nextDueDate: baseDate.toISOString(),
    prepaidUntilDate: baseDate.toISOString(),
    status: 'ACTIVE'
  };

  const updatedRecurring = recurring.map((item, idx) => (idx === matchedIndex ? updatedItem : item));
  return { updatedRecurring, matchedTemplate: updatedItem, periodsCovered };
}

/**
 * Automatically syncs Equb state when an Equb contribution transaction is recorded.
 */
export function syncEqubWithTransaction(
  tx: Transaction,
  equbs: Equb[]
): { updatedEqubs: Equb[]; matchedEqub?: Equb } {
  if (tx.type !== 'EXPENSE' || tx.reversed) {
    return { updatedEqubs: equbs };
  }

  const targetEqub = findMatchingEqub(tx, equbs);
  if (!targetEqub) {
    return { updatedEqubs: equbs };
  }

  const match = tx.description?.match(/round\s*#?\s*(\d+)/i);
  const roundInTx = match ? parseInt(match[1], 10) : null;
  const advanceRoundsMatch = tx.description?.match(/(\d+)\s*rounds?\s*(?:prepaid|advance)/i);

  const singleRoundCost = (targetEqub.contributionPerRound || 1) * (targetEqub.mySlots || 1);
  const roundsCoveredByAmount = singleRoundCost > 0 ? Math.floor(tx.amount / singleRoundCost) : 1;
  const roundsToAdd = advanceRoundsMatch
    ? parseInt(advanceRoundsMatch[1], 10)
    : Math.max(1, roundsCoveredByAmount);

  let newCompleted = typeof targetEqub.completedRounds === 'number'
    ? targetEqub.completedRounds
    : Math.max(0, targetEqub.currentRound - 1);

  if (roundInTx !== null && roundsCoveredByAmount <= 1) {
    newCompleted = Math.max(newCompleted, roundInTx);
  } else {
    newCompleted += roundsToAdd;
  }

  newCompleted = Math.min(targetEqub.totalRounds, newCompleted);
  const nextRound = Math.min(targetEqub.totalRounds, newCompleted + 1);
  const isFinished = newCompleted >= targetEqub.totalRounds;

  let intervalDays = 7;
  if (targetEqub.interval === 'EVERY_10_DAYS') intervalDays = 10;
  else if (targetEqub.interval === 'EVERY_15_DAYS') intervalDays = 15;
  else if (targetEqub.interval === 'MONTHLY') intervalDays = 30;

  const txTime = new Date(tx.date).getTime();
  const prepaidUntilDate = new Date(txTime + roundsToAdd * intervalDays * 86400000).toISOString();

  const updatedEqub: Equb = {
    ...targetEqub,
    completedRounds: newCompleted,
    currentRound: nextRound,
    status: isFinished ? 'COMPLETED' : 'ACTIVE',
    isOverdue: false,
    prepaidUntilDate: roundsToAdd > 1 ? prepaidUntilDate : targetEqub.prepaidUntilDate
  };

  const updatedEqubs = equbs.map(e => (e.id === targetEqub.id ? updatedEqub : e));
  return { updatedEqubs, matchedEqub: updatedEqub };
}

// ==================== SHOP OPERATING HOURS (6:00 AM - 6:00 PM GMT) ====================

export interface ShopStatusInfo {
  isOpen: boolean;
  statusLabel: 'OPEN' | 'CLOSED';
  currentGmtTimeStr: string; // e.g. "17:47 GMT"
  currentEatTimeStr: string; // e.g. "08:47 PM EAT"
  currentEthTimeStr: string; // e.g. "2:47 ማታ"
  openTimeGmtFormatted: string; // "6:00 AM GMT (9:00 AM EAT)"
  closeTimeGmtFormatted: string; // "6:00 PM GMT (9:00 PM EAT)"
  countdownText: string;
  isOverridden: boolean;
  shiftName: 'Day Operating Shift' | 'After-Hours / Closed';
  openTimeGMT: string;
  closeTimeGMT: string;
}

export function getShopStatusInfo(
  shopHours?: ShopOperatingHours,
  referenceDate: Date = new Date()
): ShopStatusInfo {
  const hours = shopHours || DEFAULT_SHOP_HOURS;
  
  const utcHours = referenceDate.getUTCHours();
  const utcMinutes = referenceDate.getUTCMinutes();
  const currentUtcMinutes = utcHours * 60 + utcMinutes;

  const [openH, openM] = (hours.openTimeGMT || '06:00').split(':').map(Number);
  const [closeH, closeM] = (hours.closeTimeGMT || '18:00').split(':').map(Number);
  const openMinutes = (isNaN(openH) ? 6 : openH) * 60 + (isNaN(openM) ? 0 : openM);
  const closeMinutes = (isNaN(closeH) ? 18 : closeH) * 60 + (isNaN(closeM) ? 0 : closeM);

  let scheduledOpen = false;
  if (closeMinutes > openMinutes) {
    scheduledOpen = currentUtcMinutes >= openMinutes && currentUtcMinutes < closeMinutes;
  } else {
    scheduledOpen = currentUtcMinutes >= openMinutes || currentUtcMinutes < closeMinutes;
  }

  const isOverridden = hours.manualOverrideStatus === 'OPEN' || hours.manualOverrideStatus === 'CLOSED';
  const isOpen = isOverridden
    ? hours.manualOverrideStatus === 'OPEN'
    : scheduledOpen;

  let countdownText = '';
  if (isOpen) {
    let diff = closeMinutes - currentUtcMinutes;
    if (diff < 0) diff += 1440;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    countdownText = h > 0 ? `Closes in ${h}h ${m}m (6:00 PM GMT)` : `Closes in ${m}m (6:00 PM GMT)`;
  } else {
    let diff = openMinutes - currentUtcMinutes;
    if (diff <= 0) diff += 1440;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    countdownText = h > 0 ? `Opens in ${h}h ${m}m (6:00 AM GMT)` : `Opens in ${m}m (6:00 AM GMT)`;
  }

  const gmtPadH = String(utcHours).padStart(2, '0');
  const gmtPadM = String(utcMinutes).padStart(2, '0');
  const currentGmtTimeStr = `${gmtPadH}:${gmtPadM} GMT`;

  // East Africa Time (Addis Ababa) is GMT + 3
  const eatDate = new Date(referenceDate.getTime() + 3 * 3600 * 1000);
  const eatHours = eatDate.getUTCHours();
  const eatMinutes = eatDate.getUTCMinutes();
  const eatAmPm = eatHours >= 12 ? 'PM' : 'AM';
  const eat12 = eatHours % 12 || 12;
  const currentEatTimeStr = `${eat12}:${String(eatMinutes).padStart(2, '0')} ${eatAmPm} EAT`;

  // Ethiopian 12-hour clock (6:00 AM EAT is 12:00 morning)
  const ethHour = (eatHours - 6 + 24) % 24;
  const isEthNight = ethHour >= 12;
  const ethHour12 = (ethHour % 12) || 12;
  const ethPeriod = isEthNight ? 'ማታ' : (ethHour < 6 ? 'ጠዋት' : 'ከሰዓት');
  const currentEthTimeStr = `${ethHour12}:${String(eatMinutes).padStart(2, '0')} ${ethPeriod}`;

  return {
    isOpen,
    statusLabel: isOpen ? 'OPEN' : 'CLOSED',
    currentGmtTimeStr,
    currentEatTimeStr,
    currentEthTimeStr,
    openTimeGmtFormatted: '6:00 AM GMT (9:00 AM EAT)',
    closeTimeGmtFormatted: '6:00 PM GMT (9:00 PM EAT)',
    countdownText,
    isOverridden,
    shiftName: isOpen ? 'Day Operating Shift' : 'After-Hours / Closed',
    openTimeGMT: hours.openTimeGMT || '06:00',
    closeTimeGMT: hours.closeTimeGMT || '18:00'
  };
}

export function isTransactionDuringOpenHours(txDateIso: string, shopHours?: ShopOperatingHours): boolean {
  try {
    const d = new Date(txDateIso);
    if (isNaN(d.getTime())) return true;
    const utcM = d.getUTCHours() * 60 + d.getUTCMinutes();
    const [openH, openM] = ((shopHours?.openTimeGMT) || '06:00').split(':').map(Number);
    const [closeH, closeM] = ((shopHours?.closeTimeGMT) || '18:00').split(':').map(Number);
    const oMin = (isNaN(openH) ? 6 : openH) * 60 + (isNaN(openM) ? 0 : openM);
    const cMin = (isNaN(closeH) ? 18 : closeH) * 60 + (isNaN(closeM) ? 0 : closeM);
    if (cMin > oMin) {
      return utcM >= oMin && utcM < cMin;
    }
    return utcM >= oMin || utcM < cMin;
  } catch {
    return true;
  }
}

export interface TodayShiftMetrics {
  openShiftIncome: number;
  openShiftExpenses: number;
  openShiftNet: number;
  openShiftTxCount: number;
  afterHoursIncome: number;
  afterHoursExpenses: number;
  afterHoursNet: number;
  afterHoursTxCount: number;
  totalDayIncome: number;
  totalDayExpense: number;
  totalDayNet: number;
  totalTxCount: number;
}

export function calculateTodayShiftMetrics(
  transactions: Transaction[],
  shopHours?: ShopOperatingHours,
  targetDate: Date = new Date()
): TodayShiftMetrics {
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetDay = targetDate.getDate();

  const todayTxs = (transactions || []).filter(tx => {
    try {
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) return false;
      return (
        d.getFullYear() === targetYear &&
        d.getMonth() === targetMonth &&
        d.getDate() === targetDay
      );
    } catch {
      return false;
    }
  });

  let openShiftIncome = 0;
  let openShiftExpenses = 0;
  let openShiftTxCount = 0;

  let afterHoursIncome = 0;
  let afterHoursExpenses = 0;
  let afterHoursTxCount = 0;

  todayTxs.forEach(tx => {
    const isDuringShift = isTransactionDuringOpenHours(tx.date, shopHours);
    const amt = tx.amount || 0;
    if (isDuringShift) {
      openShiftTxCount++;
      if (tx.type === 'INCOME') {
        openShiftIncome += amt;
      } else {
        openShiftExpenses += amt;
      }
    } else {
      afterHoursTxCount++;
      if (tx.type === 'INCOME') {
        afterHoursIncome += amt;
      } else {
        afterHoursExpenses += amt;
      }
    }
  });

  return {
    openShiftIncome,
    openShiftExpenses,
    openShiftNet: openShiftIncome - openShiftExpenses,
    openShiftTxCount,
    afterHoursIncome,
    afterHoursExpenses,
    afterHoursNet: afterHoursIncome - afterHoursExpenses,
    afterHoursTxCount,
    totalDayIncome: openShiftIncome + afterHoursIncome,
    totalDayExpense: openShiftExpenses + afterHoursExpenses,
    totalDayNet: (openShiftIncome + afterHoursIncome) - (openShiftExpenses + afterHoursExpenses),
    totalTxCount: todayTxs.length
  };
}

// ==================== OPERATING HOURS CUTOFF (Closed 6pm GMT, Opened 6am GMT) ====================

/**
 * Checks if a given timestamp was recorded when the shop was closed
 * (Shop closes at 6:00 PM GMT and opens at 6:00 AM GMT)
 */
export function isRecordedAfter6pmGMT(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const totalMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    // Closed between 18:00 (6 PM GMT) and 06:00 (6 AM GMT)
    return totalMinutes >= 18 * 60 || totalMinutes < 6 * 60;
  } catch {
    return false;
  }
}

/**
 * Checks if the current live time is during closed hours
 * (Shop closed 6:00 PM GMT to 6:00 AM GMT)
 */
export function isCurrentTimeAfter6pmGMT(): boolean {
  const now = new Date();
  const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  // Closed between 18:00 (6 PM GMT) and 06:00 (6 AM GMT)
  return totalMinutes >= 18 * 60 || totalMinutes < 6 * 60;
}

export function isRecordedOutsideOperatingHours(dateStr: string, shopHours?: ShopOperatingHours): boolean {
  return !isTransactionDuringOpenHours(dateStr, shopHours);
}

export function isCurrentTimeOutsideOperatingHours(shopHours?: ShopOperatingHours): boolean {
  return !getShopStatusInfo(shopHours).isOpen;
}

// Backward compatibility aliases for legacy references (now aligned to 6 PM GMT shop closing)
export const isRecordedAfter7pmGMT = isRecordedAfter6pmGMT;
export const isCurrentTimeAfter7pmGMT = isCurrentTimeAfter6pmGMT;



