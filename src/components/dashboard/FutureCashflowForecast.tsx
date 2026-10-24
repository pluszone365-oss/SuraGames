import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  CreditCard,
  Building2,
  Repeat,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Layers,
  DollarSign,
  HelpCircle,
  Info,
  Coins,
  BarChart3,
  CalendarDays,
  Flame,
  Check
} from 'lucide-react';
import {
  Wallet as WalletType,
  Transaction,
  Equb,
  Loan,
  RecurringTemplate
} from '../../types';
import {
  formatETB,
  calculateTotalBusinessBalance
} from '../../lib/store';
import {
  toEthiopianDate,
  formatEthiopianDate,
  formatDateByCalendar,
  evaluatePagumeExemption,
  calculateNextEthiopianDueDate,
  ETHIOPIAN_MONTHS
} from '../../lib/ethiopianCalendar';
import { triggerHaptic } from '../../lib/haptics';

interface FutureCashflowForecastProps {
  wallets: WalletType[];
  transactions: Transaction[];
  transfers: any[];
  equbs: Equb[];
  loans: Loan[];
  recurring: RecurringTemplate[];
  hideBalances: boolean;
  calendarType?: 'ETHIOPIAN' | 'GREGORIAN';
  onNavigateTab?: (tab: any, subView?: any) => void;
}

export interface ForecastIncomeItem {
  id: string;
  title: string;
  category: string;
  description: string;
  amount: number;
  basis: string;
}

export interface ForecastExpenseItem {
  id: string;
  title: string;
  category: string;
  description: string;
  amount: number;
  scheduledAmount?: number;
  type: 'RECURRING' | 'LOAN' | 'EQUB';
  frequency: string;
  walletName: string;
  isExempt: boolean;
  exemptionReason?: string;
  isMandatory: boolean;
  opportunityStatus?: 'PAID_FROM_SURPLUS' | 'DEFERRED_NO_SURPLUS' | 'SCHEDULED_PAYMENT' | 'PAGUME_EXEMPT';
}

export type ForecastPeriod = 'WEEKLY' | 'MONTHLY' | 'YEARLY_CALENDAR';
export type LoanStrategy = 'FLEXIBLE_OPPORTUNITY' | 'STRICT_SCHEDULED';

/**
 * Helper: Computes all occurrences of a recurring obligation falling within [wStart, wEnd].
 * NEVER divides the obligation amount — either due in full or not due in this window.
 */
function getRecurringDuesInWindow(
  r: RecurringTemplate,
  wStart: Date,
  wEnd: Date,
  isFirstWeek: boolean
): { isDue: boolean; occurrences: number; fullAmount: number; dueDateStr: string } {
  const amt = Number(r.amount) || 0;
  if (amt <= 0) return { isDue: false, occurrences: 0, fullAmount: 0, dueDateStr: '' };

  const freq = (r.frequency || 'MONTHLY').toUpperCase();

  // Daily: occurs 7 times in a 7-day week
  if (freq === 'DAILY') {
    return { isDue: true, occurrences: 7, fullAmount: amt * 7, dueDateStr: 'Daily (7x in week)' };
  }

  // Weekly: occurs once every week
  if (freq === 'WEEKLY') {
    return { isDue: true, occurrences: 1, fullAmount: amt, dueDateStr: 'Weekly (1x in week)' };
  }

  const baseDue = new Date(r.nextDueDate || wStart);
  if (isNaN(baseDue.getTime())) {
    return isFirstWeek
      ? { isDue: true, occurrences: 1, fullAmount: amt, dueDateStr: wStart.toISOString().split('T')[0] }
      : { isDue: false, occurrences: 0, fullAmount: 0, dueDateStr: '' };
  }

  if (freq === 'ONE_TIME' || r.isOneTime) {
    if (baseDue.getTime() >= wStart.getTime() && baseDue.getTime() <= wEnd.getTime()) {
      return { isDue: true, occurrences: 1, fullAmount: amt, dueDateStr: baseDue.toISOString().split('T')[0] };
    }
    return { isDue: false, occurrences: 0, fullAmount: 0, dueDateStr: '' };
  }

  // If this is Week 1 (current week) and the base due date is in the past or within this week:
  // It is due in full right now!
  if (isFirstWeek && baseDue.getTime() <= wEnd.getTime()) {
    return { isDue: true, occurrences: 1, fullAmount: amt, dueDateStr: baseDue.toISOString().split('T')[0] };
  }

  // Advance baseDue using calendar recurrence to find all occurrences that land in [wStart, wEnd]
  let cur = new Date(baseDue);
  let safety = 0;
  while (cur.getTime() < wStart.getTime() && safety < 120) {
    cur = calculateNextEthiopianDueDate(cur, freq);
    safety++;
  }

  let occurrences = 0;
  let firstDateStr = '';
  safety = 0;
  while (cur.getTime() >= wStart.getTime() && cur.getTime() <= wEnd.getTime() && safety < 20) {
    occurrences++;
    if (!firstDateStr) firstDateStr = cur.toISOString().split('T')[0];
    cur = calculateNextEthiopianDueDate(cur, freq);
    safety++;
  }

  if (occurrences > 0) {
    return { isDue: true, occurrences, fullAmount: amt * occurrences, dueDateStr: firstDateStr };
  }

  return { isDue: false, occurrences: 0, fullAmount: 0, dueDateStr: '' };
}

/**
 * Helper: Computes Equb round dues falling within [wStart, wEnd].
 * NEVER divides the round contribution — either a full round is due or 0.
 */
function getEqubDuesInWindow(
  e: Equb,
  wStart: Date,
  wEnd: Date,
  isFirstWeek: boolean,
  now: Date
): { isDue: boolean; roundsCount: number; fullAmount: number; dueDateStr: string } {
  const c = Number(e.contributionPerRound) || 0;
  if (c <= 0 || e.status !== 'ACTIVE') return { isDue: false, roundsCount: 0, fullAmount: 0, dueDateStr: '' };

  const interval = (e.interval || 'WEEKLY').toUpperCase();
  const completed = typeof e.completedRounds === 'number' ? e.completedRounds : Math.max(0, e.currentRound - 1);
  const roundsRemaining = Math.max(0, e.totalRounds - completed);
  if (roundsRemaining <= 0) return { isDue: false, roundsCount: 0, fullAmount: 0, dueDateStr: '' };

  if (interval === 'DAILY') {
    const days = Math.min(7, roundsRemaining);
    return { isDue: true, roundsCount: days, fullAmount: c * days, dueDateStr: 'Daily round' };
  }

  if (interval === 'WEEKLY') {
    return { isDue: true, roundsCount: 1, fullAmount: c, dueDateStr: 'Weekly round' };
  }

  let intervalDays = 10;
  if (interval === 'EVERY_5_DAYS') intervalDays = 5;
  else if (interval === 'EVERY_10_DAYS') intervalDays = 10;
  else if (interval === 'BI_WEEKLY' || interval === 'BIWEEKLY') intervalDays = 14;
  else if (interval === 'EVERY_15_DAYS') intervalDays = 15;
  else if (interval === 'MONTHLY') intervalDays = 30;

  // Compute next round date
  let nextRoundMs = now.getTime();
  if (e.computedEndingDate) {
    const endMs = new Date(e.computedEndingDate).getTime();
    if (!isNaN(endMs)) {
      const roundsAfterCurrent = Math.max(0, e.totalRounds - e.currentRound);
      nextRoundMs = endMs - roundsAfterCurrent * intervalDays * 86400000;
    }
  } else if (e.startDate) {
    const startMs = new Date(e.startDate).getTime();
    if (!isNaN(startMs)) {
      const offsetMs = (e.currentRound - 1) * intervalDays * 86400000;
      nextRoundMs = startMs + offsetMs;
    }
  }

  // If next round is in the past, anchor it to current date
  if (nextRoundMs < now.getTime()) {
    nextRoundMs = now.getTime();
  }

  // Step through remaining rounds
  let roundsCount = 0;
  let firstDateStr = '';
  for (let r = 0; r < roundsRemaining && r < 30; r++) {
    const roundTime = nextRoundMs + r * intervalDays * 86400000;
    if (roundTime >= wStart.getTime() && roundTime <= wEnd.getTime()) {
      roundsCount++;
      if (!firstDateStr) firstDateStr = new Date(roundTime).toISOString().split('T')[0];
    }
    if (roundTime > wEnd.getTime()) break;
  }

  if (roundsCount > 0) {
    return { isDue: true, roundsCount, fullAmount: c * roundsCount, dueDateStr: firstDateStr };
  }

  return { isDue: false, roundsCount: 0, fullAmount: 0, dueDateStr: '' };
}

/**
 * Helper: Computes scheduled loan installment due within [wStart, wEnd].
 * Business Rule: Loans and loan installments cannot be less than ETB 1,000 (1k)
 * unless the total outstanding balance is under 1,000 ETB (settling the loan).
 */
function getLoanDueInWindow(
  l: Loan,
  wStart: Date,
  wEnd: Date,
  isFirstWeek: boolean
): { isDue: boolean; fullAmount: number; dueDateStr: string } {
  let inst = Number(l.monthlyInstallment || l.outstandingBalance || 0);
  if (inst <= 0 || l.status !== 'ACTIVE') return { isDue: false, fullAmount: 0, dueDateStr: '' };

  // Loans cannot be less than 1,000 ETB (1k)
  if (inst < 1000 && l.outstandingBalance >= 1000) {
    inst = 1000;
  }

  const baseDue = new Date(l.dueDate || wStart);
  if (isNaN(baseDue.getTime())) {
    return isFirstWeek ? { isDue: true, fullAmount: inst, dueDateStr: 'Due Now' } : { isDue: false, fullAmount: 0, dueDateStr: '' };
  }

  if (isFirstWeek && baseDue.getTime() <= wEnd.getTime()) {
    return { isDue: true, fullAmount: inst, dueDateStr: baseDue.toISOString().split('T')[0] };
  }

  // Step monthly from baseDue
  let cur = new Date(baseDue);
  let safety = 0;
  while (cur.getTime() < wStart.getTime() && safety < 120) {
    cur = calculateNextEthiopianDueDate(cur, 'MONTHLY');
    safety++;
  }

  if (cur.getTime() >= wStart.getTime() && cur.getTime() <= wEnd.getTime()) {
    return { isDue: true, fullAmount: inst, dueDateStr: cur.toISOString().split('T')[0] };
  }

  return { isDue: false, fullAmount: 0, dueDateStr: '' };
}

export const FutureCashflowForecast: React.FC<FutureCashflowForecastProps> = ({
  wallets,
  transactions,
  transfers,
  equbs,
  loans,
  recurring,
  hideBalances,
  calendarType = 'GREGORIAN',
  onNavigateTab
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<ForecastPeriod>('WEEKLY');
  const [loanStrategy, setLoanStrategy] = useState<LoanStrategy>('FLEXIBLE_OPPORTUNITY');
  const [expandedWeekId, setExpandedWeekId] = useState<string | null>('Week 1');
  const [expandedMonthId, setExpandedMonthId] = useState<number | null>(null);
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState<number>(1); // 1-13 Ethiopian month

  // Helper to retrieve user-friendly wallet labels
  const getWalletName = (walletId?: string) => {
    if (!walletId) return 'Main Wallet';
    const found = wallets.find(w => w.id === walletId);
    if (found) return found.name;
    if (walletId === 'w-telebirr') return 'Telebirr';
    if (walletId === 'w-cash') return 'Cash Wallet';
    if (walletId === 'w-cbe') return 'CBE Bank';
    if (walletId === 'w-boa') return 'BOA Bank';
    return walletId.replace(/^w-/, '').toUpperCase();
  };

  // Current liquid cash across all business wallets
  const currentTotalBalance = useMemo(() => {
    return calculateTotalBusinessBalance(wallets, transactions, transfers);
  }, [wallets, transactions, transfers]);

  // 1. Calculate Current Week Real Income Average & Run Rate
  const currentWeekStats = useMemo(() => {
    const now = new Date();
    const nowTime = now.getTime();

    // Filter valid income transactions
    const incomeTxs = transactions.filter(
      tx => tx.type === 'INCOME' && !tx.reversed && Number(tx.amount || 0) > 0 && tx.date
    );

    // Find the reference end date: either today, or the latest transaction date if future/recent
    let latestTxTime = nowTime;
    incomeTxs.forEach(tx => {
      const t = new Date(tx.date).getTime();
      if (!isNaN(t) && t > latestTxTime) {
        latestTxTime = t;
      }
    });

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    // Check if we have transactions within the current week (last 7 days from now)
    let windowEnd = nowTime;
    let windowStart = nowTime - sevenDaysMs;

    let windowTxs = incomeTxs.filter(tx => {
      const t = new Date(tx.date).getTime();
      return t >= windowStart && t <= windowEnd;
    });

    // If no transactions in recent 7 days from now (e.g. historical / demo dataset where latest transaction was earlier), anchor to the latest 7-day recorded active week
    if (windowTxs.length === 0 && incomeTxs.length > 0) {
      windowEnd = latestTxTime;
      windowStart = latestTxTime - sevenDaysMs;
      windowTxs = incomeTxs.filter(tx => {
        const t = new Date(tx.date).getTime();
        return t >= windowStart && t <= windowEnd;
      });
    }

    // If still 0, fall back to recent income transactions
    const usedTxs = windowTxs.length > 0 ? windowTxs : incomeTxs.slice(-15);
    const totalCurrentWeekIncome = usedTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const txCount = usedTxs.length;

    // Distinct calendar days with income in the current week window
    const activeDaysSet = new Set(
      usedTxs.map(tx => new Date(tx.date).toISOString().split('T')[0])
    );
    const activeDaysCount = activeDaysSet.size;

    // Daily average: total current week income divided by 7 days
    const dailyIncomeRunRate = totalCurrentWeekIncome > 0 ? totalCurrentWeekIncome / 7 : 0;
    const weeklyIncomeRunRate = dailyIncomeRunRate * 7;
    const monthlyIncomeRunRate = dailyIncomeRunRate * 30.4167; // standard avg month pace
    const yearlyIncomeRunRate = dailyIncomeRunRate * 365;

    return {
      totalCurrentWeekIncome,
      txCount,
      activeDaysCount,
      dailyIncomeRunRate,
      weeklyIncomeRunRate,
      monthlyIncomeRunRate,
      yearlyIncomeRunRate,
      windowStartDate: new Date(windowStart),
      windowEndDate: new Date(windowEnd)
    };
  }, [transactions]);

  // 2. Active Obligations Analysis (Recurring Payments, Loans, Equb - Undivided)
  const obligationsStats = useMemo(() => {
    const activeRecurring = recurring.filter(r => r.status === 'ACTIVE' && r.type === 'EXPENSE');
    const activeLoans = loans.filter(l => l.status === 'ACTIVE');
    const activeEqubs = equbs.filter(e => e.status === 'ACTIVE');

    const now = new Date();
    const wStart0 = new Date(now.getTime());
    const wEnd0 = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    // 1. Recurring Payments (Full Scheduled Amounts, Not Divided)
    let dueThisWeekRecurring = 0;
    let recurringMonthly = 0;
    let recurringYearly = 0;

    activeRecurring.forEach(r => {
      const amt = Number(r.amount) || 0;
      const freq = (r.frequency || 'MONTHLY').toUpperCase();

      // Check exact full amount due this week (undivided)
      const weekDue = getRecurringDuesInWindow(r, wStart0, wEnd0, true);
      if (weekDue.isDue) {
        dueThisWeekRecurring += weekDue.fullAmount;
      }

      // If this recurring item is ONE_TIME (like one-time advance rent) or prepaid past this month:
      const dueMs = r.nextDueDate ? new Date(r.nextDueDate).getTime() : 0;
      const currentMonthEndMs = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
      const isOneTimeRentOrPrepaid = r.isOneTime || freq === 'ONE_TIME' || (r.prepaidUntilDate && new Date(r.prepaidUntilDate).getTime() > currentMonthEndMs);

      if (isOneTimeRentOrPrepaid) {
        // Rent paid in advance one time — no recurring baseline outflow needed for this period
        return;
      }

      // Full schedule commitments
      if (freq === 'DAILY') {
        recurringMonthly += amt * 30;
        recurringYearly += amt * 365;
      } else if (freq === 'WEEKLY') {
        recurringMonthly += amt * 4;
        recurringYearly += amt * 52;
      } else if (freq === 'BIWEEKLY') {
        recurringMonthly += amt * 2;
        recurringYearly += amt * 26;
      } else if (freq === 'EVERY_3_WEEKS') {
        recurringMonthly += amt;
        recurringYearly += amt * 17;
      } else if (freq === 'EVERY_2_MONTHS') {
        recurringMonthly += amt / 2;
        recurringYearly += amt * 6;
      } else if (freq === 'QUARTERLY') {
        recurringMonthly += amt / 3;
        recurringYearly += amt * 4;
      } else if (freq === 'YEARLY') {
        recurringMonthly += amt / 12;
        recurringYearly += amt;
      } else {
        // MONTHLY default
        recurringMonthly += amt;
        recurringYearly += amt * 12;
      }
    });

    // 2. Loans (Monthly installment / scheduled due date)
    let dueThisWeekLoans = 0;
    let loansMonthly = 0;
    let loansYearly = 0;

    activeLoans.forEach(l => {
      let installment = Number(l.monthlyInstallment || l.outstandingBalance || 0);
      if (installment < 1000 && l.outstandingBalance >= 1000) {
        installment = 1000;
      }
      const loanDue = getLoanDueInWindow(l, wStart0, wEnd0, true);
      if (loanDue.isDue) {
        dueThisWeekLoans += loanDue.fullAmount;
      }
      loansMonthly += installment;
      loansYearly += Math.min(installment * 12, l.outstandingBalance);
    });

    // 3. Equb (Whole Round Contributions, Not Divided)
    let dueThisWeekEqub = 0;
    let equbMonthly = 0;
    let equbYearly = 0;

    activeEqubs.forEach(e => {
      const contribution = Number(e.contributionPerRound) || 0;
      const interval = (e.interval || 'WEEKLY').toUpperCase();
      const completed = typeof e.completedRounds === 'number' ? e.completedRounds : Math.max(0, e.currentRound - 1);
      const roundsRemaining = Math.max(0, e.totalRounds - completed);

      const equbDue = getEqubDuesInWindow(e, wStart0, wEnd0, true, now);
      if (equbDue.isDue) {
        dueThisWeekEqub += equbDue.fullAmount;
      }

      let mRounds = 1;
      if (interval === 'DAILY') mRounds = 30;
      else if (interval === 'EVERY_5_DAYS') mRounds = 6;
      else if (interval === 'EVERY_10_DAYS') mRounds = 3;
      else if (interval === 'WEEKLY') mRounds = 4;
      else if (interval === 'BI_WEEKLY' || interval === 'BIWEEKLY') mRounds = 2;
      else if (interval === 'EVERY_15_DAYS') mRounds = 2;
      else if (interval === 'MONTHLY') mRounds = 1;

      // In the immediate current month, commitment cannot exceed the actual rounds remaining
      const monthlyCommitment = contribution * Math.min(mRounds, roundsRemaining);
      equbMonthly += monthlyCommitment;
      equbYearly += contribution * roundsRemaining;
    });

    // Mandatory totals (recurring + equb) — NOT divided
    const dueThisWeekMandatory = dueThisWeekRecurring + dueThisWeekEqub;
    const mandatoryWeekly = dueThisWeekMandatory; // Actual full sum due this current week
    const recurringWeekly = dueThisWeekRecurring;
    const equbWeekly = dueThisWeekEqub;
    const loansWeekly = dueThisWeekLoans;

    const mandatoryMonthly = recurringMonthly + equbMonthly;
    const mandatoryYearly = recurringYearly + equbYearly;

    const totalWeeklyObligations = mandatoryWeekly + loansWeekly;
    const totalMonthlyObligations = mandatoryMonthly + loansMonthly;
    const totalYearlyObligations = mandatoryYearly + loansYearly;

    return {
      activeRecurring,
      activeLoans,
      activeEqubs,
      dueThisWeekRecurring,
      dueThisWeekEqub,
      dueThisWeekLoans,
      dueThisWeekMandatory,
      recurringWeekly,
      recurringMonthly,
      recurringYearly,
      loansWeekly,
      loansMonthly,
      loansYearly,
      equbWeekly,
      equbMonthly,
      equbYearly,
      mandatoryWeekly,
      mandatoryMonthly,
      mandatoryYearly,
      totalWeeklyObligations,
      totalMonthlyObligations,
      totalYearlyObligations
    };
  }, [recurring, loans, equbs]);

  // Mandatory Net Cashflow Projections (Income minus Mandatory Bills & Equb)
  const mandatoryNetWeekly = currentWeekStats.weeklyIncomeRunRate - obligationsStats.mandatoryWeekly;
  const mandatoryNetMonthly = currentWeekStats.monthlyIncomeRunRate - obligationsStats.mandatoryMonthly;
  const mandatoryNetYearly = currentWeekStats.yearlyIncomeRunRate - obligationsStats.mandatoryYearly;

  // Opportunity for Loan Repayment in the Middle:
  // Rule: Loans cannot be less than 1,000 ETB (1k).
  // Repayments are only funded if available operating surplus is at least 1,000 ETB.
  const weeklyLoanOpportunity = mandatoryNetWeekly >= 1000 ? mandatoryNetWeekly : 0;
  const monthlyLoanOpportunity = mandatoryNetMonthly >= 1000 ? mandatoryNetMonthly : 0;

  // Net Cashflow Projections
  const netWeekly = loanStrategy === 'FLEXIBLE_OPPORTUNITY'
    ? (mandatoryNetWeekly - (weeklyLoanOpportunity >= 1000 ? Math.min(obligationsStats.loansWeekly, weeklyLoanOpportunity) : 0))
    : (currentWeekStats.weeklyIncomeRunRate - obligationsStats.totalWeeklyObligations);

  const netMonthly = loanStrategy === 'FLEXIBLE_OPPORTUNITY'
    ? (mandatoryNetMonthly - (monthlyLoanOpportunity >= 1000 ? Math.min(obligationsStats.loansMonthly, monthlyLoanOpportunity) : 0))
    : (currentWeekStats.monthlyIncomeRunRate - obligationsStats.totalMonthlyObligations);

  const netYearly = loanStrategy === 'FLEXIBLE_OPPORTUNITY'
    ? (mandatoryNetYearly - (mandatoryNetYearly >= 1000 ? Math.min(obligationsStats.loansYearly, mandatoryNetYearly) : 0))
    : (currentWeekStats.yearlyIncomeRunRate - obligationsStats.totalYearlyObligations);

  // Runway in weeks/months: grounded primarily on non-negotiable Mandatory Commitments (Recurring + Equb)
  const mandatoryRunwayMonths = obligationsStats.mandatoryMonthly > 0
    ? (currentTotalBalance / obligationsStats.mandatoryMonthly).toFixed(1)
    : '∞';

  const fullRunwayMonths = obligationsStats.totalMonthlyObligations > 0
    ? (currentTotalBalance / obligationsStats.totalMonthlyObligations).toFixed(1)
    : '∞';

  const runwayMonths = mandatoryRunwayMonths;

  // 3. GENERATE WEEKLY PROJECTION (Next 12 Weeks)
  const weeklyForecast = useMemo(() => {
    const list: Array<{
      weekIndex: number;
      label: string;
      startDate: Date;
      endDate: Date;
      startBal: number;
      projectedIncome: number;
      recurringOut: number;
      loansOut: number;
      equbOut: number;
      mandatoryOut: number;
      operatingSurplus: number;
      loanOpportunityPaid: number;
      loanOpportunityDeferred: number;
      totalOut: number;
      netFlow: number;
      endBal: number;
      isPagume: boolean;
      itemsDue: Array<{ name: string; type: string; amount: number; isExempt: boolean; isMandatory: boolean }>;
      incomes: ForecastIncomeItem[];
      expenses: ForecastExpenseItem[];
      expensesSummary: string;
      mandatorySummary: string;
      flexibleSummary: string;
    }> = [];

    const now = new Date();
    let rollingBalance = currentTotalBalance;

    for (let i = 0; i < 12; i++) {
      const wStart = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const wEnd = new Date(wStart.getTime() + 6 * 24 * 60 * 60 * 1000);

      // Check if this week falls in Pagumē
      const startEth = toEthiopianDate(wStart);
      const isPagumeWeek = startEth.isPagume;

      // Income run-rate
      const projectedIncome = currentWeekStats.weeklyIncomeRunRate;

      // Calculate dues specifically for this week
      const itemsDue: Array<{ name: string; type: string; amount: number; isExempt: boolean; isMandatory: boolean }> = [];

      // 1. Projected Incomes with Description
      const incomes: ForecastIncomeItem[] = [
        {
          id: `inc-runrate-${i}`,
          title: 'Income',
          category: 'Operations',
          description: `Projected weekly income based on current average (~${formatETB(currentWeekStats.dailyIncomeRunRate, true)}/day).`,
          amount: projectedIncome,
          basis: 'Weekly Pace'
        }
      ];

      // 2. Scheduled Expenses with Description
      const expenses: ForecastExpenseItem[] = [];

      // Recurring bills (MANDATORY - Full Scheduled Amounts, Undivided)
      let rOut = 0;
      obligationsStats.activeRecurring.forEach(r => {
        const exemption = evaluatePagumeExemption(r.category || r.title, wStart);
        const wName = getWalletName(r.walletId);
        const freqLabel = (r.frequency || 'MONTHLY').replace(/_/g, ' ').toLowerCase();

        let desc = r.notes?.trim() || '';
        if (!desc) {
          desc = `${r.category || 'Operating'} scheduled payment for PlusZone gaming operations payable via ${wName}.`;
        }

        const dues = getRecurringDuesInWindow(r, wStart, wEnd, i === 0);
        if (!dues.isDue) return;

        if (exemption.isExempt) {
          expenses.push({
            id: `${r.id}-w${i}`,
            title: r.title,
            category: r.category || 'Utilities',
            description: `[MANDATORY COMMITMENT] ${desc} — [Pagumē Exemption: Waived during 13th month holiday]`,
            amount: dues.fullAmount,
            scheduledAmount: dues.fullAmount,
            type: 'RECURRING',
            frequency: freqLabel,
            walletName: wName,
            isExempt: true,
            exemptionReason: exemption.reason || 'Pagumē holiday custom',
            isMandatory: true
          });
          itemsDue.push({ name: r.title, type: 'Recurring', amount: dues.fullAmount, isExempt: true, isMandatory: true });
        } else {
          rOut += dues.fullAmount;
          expenses.push({
            id: `${r.id}-w${i}`,
            title: r.title,
            category: r.category || 'Utilities',
            description: `[MANDATORY COMMITMENT] ${desc} (Due in full on ${dues.dueDateStr} • Undivided operational commitment).`,
            amount: dues.fullAmount,
            scheduledAmount: dues.fullAmount,
            type: 'RECURRING',
            frequency: `${freqLabel} • Full Payment`,
            walletName: wName,
            isExempt: false,
            isMandatory: true
          });
          itemsDue.push({ name: r.title, type: 'Recurring', amount: dues.fullAmount, isExempt: false, isMandatory: true });
        }
      });

      // Equb (MANDATORY - Full Round Contributions, Undivided)
      let eqOut = 0;
      obligationsStats.activeEqubs.forEach(e => {
        const exemption = evaluatePagumeExemption('Equb Contribution', wStart);
        const wName = getWalletName(e.walletId);
        const intervalLabel = (e.interval || 'WEEKLY').replace(/_/g, ' ').toLowerCase();
        const equbDesc = `Round contribution for ${e.name} Equb (${intervalLabel} rotation, round ${e.currentRound} of ${e.totalRounds}, ${formatETB(e.contributionPerRound)}/round via ${wName}).`;

        const dues = getEqubDuesInWindow(e, wStart, wEnd, i === 0, now);
        if (!dues.isDue) return;

        if (exemption.isExempt) {
          expenses.push({
            id: `${e.id}-w${i}`,
            title: `Equb: ${e.name}`,
            category: 'Equb Savings',
            description: `[MANDATORY COMMITMENT] ${equbDesc} — [Pagumē Exemption: Equb rounds paused during 13th month]`,
            amount: dues.fullAmount,
            scheduledAmount: dues.fullAmount,
            type: 'EQUB',
            frequency: intervalLabel,
            walletName: wName,
            isExempt: true,
            exemptionReason: exemption.reason || 'Pagumē holiday custom',
            isMandatory: true
          });
          itemsDue.push({ name: `Equb: ${e.name}`, type: 'Equb', amount: dues.fullAmount, isExempt: true, isMandatory: true });
        } else {
          eqOut += dues.fullAmount;
          expenses.push({
            id: `${e.id}-w${i}`,
            title: `Equb: ${e.name}`,
            category: 'Equb Savings',
            description: `[MANDATORY COMMITMENT] ${equbDesc} (Due in full on ${dues.dueDateStr} • ${dues.roundsCount} round${dues.roundsCount > 1 ? 's' : ''} • Undivided mandatory community savings).`,
            amount: dues.fullAmount,
            scheduledAmount: dues.fullAmount,
            type: 'EQUB',
            frequency: `${intervalLabel} • Full Round`,
            walletName: wName,
            isExempt: false,
            isMandatory: true
          });
          itemsDue.push({ name: `Equb: ${e.name}`, type: 'Equb', amount: dues.fullAmount, isExempt: false, isMandatory: true });
        }
      });

      const mandatoryOut = rOut + eqOut;
      const operatingSurplus = projectedIncome - mandatoryOut;

      // Loans (FLEXIBLE - paid in the middle on opportunity, or strict scheduled)
      const dueLoans: Array<{ loan: Loan; dues: ReturnType<typeof getLoanDueInWindow>; exemption: ReturnType<typeof evaluatePagumeExemption> }> = [];
      let lScheduled = 0;

      obligationsStats.activeLoans.forEach(l => {
        const dues = getLoanDueInWindow(l, wStart, wEnd, i === 0);
        const exemption = evaluatePagumeExemption('Loan Repayment', wStart);
        if (dues.isDue && !exemption.isExempt) {
          lScheduled += dues.fullAmount;
          dueLoans.push({ loan: l, dues, exemption });
        } else if (dues.isDue && exemption.isExempt) {
          dueLoans.push({ loan: l, dues, exemption });
        }
      });

      let actualLoanPaid = 0;
      let loanOpportunityDeferred = 0;
      const allocatedWeeklyLoanPayments = new Map<string, number>();

      if (loanStrategy === 'FLEXIBLE_OPPORTUNITY') {
        // Business Rule: Loans / repayments cannot be less than ETB 1,000 (1k).
        // If operating surplus is less than 1,000 ETB, repayments are deferred in the middle to protect cash.
        if (operatingSurplus >= 1000 && lScheduled > 0) {
          let pool = Math.min(lScheduled, operatingSurplus);

          // Allocate to due non-exempt loans in units of at least 1,000 ETB
          for (const { loan: l, dues, exemption } of dueLoans) {
            if (exemption.isExempt) continue;
            const need = dues.fullAmount;
            const minAllowed = Math.min(1000, need); // If remaining balance < 1000, settling amount allowed

            if (pool >= minAllowed) {
              const toPay = Math.min(need, pool);
              if (toPay >= minAllowed) {
                allocatedWeeklyLoanPayments.set(l.id, toPay);
                pool -= toPay;
              } else {
                allocatedWeeklyLoanPayments.set(l.id, 0);
              }
            } else {
              allocatedWeeklyLoanPayments.set(l.id, 0);
            }
          }

          // Distribute any remaining pool to partially paid loans if applicable
          if (pool > 0) {
            for (const { loan: l, dues, exemption } of dueLoans) {
              if (exemption.isExempt) continue;
              const curPaid = allocatedWeeklyLoanPayments.get(l.id) || 0;
              if (curPaid > 0 && curPaid < dues.fullAmount) {
                const add = Math.min(dues.fullAmount - curPaid, pool);
                allocatedWeeklyLoanPayments.set(l.id, curPaid + add);
                pool -= add;
              }
              if (pool <= 0) break;
            }
          }

          actualLoanPaid = Array.from(allocatedWeeklyLoanPayments.values()).reduce((s, v) => s + v, 0);
          loanOpportunityDeferred = Math.max(0, lScheduled - actualLoanPaid);
        } else {
          actualLoanPaid = 0;
          loanOpportunityDeferred = lScheduled;
          dueLoans.forEach(({ loan: l }) => allocatedWeeklyLoanPayments.set(l.id, 0));
        }
      } else {
        // Strict amortization: pay full scheduled amount (installments enforced >= 1,000)
        actualLoanPaid = lScheduled;
        loanOpportunityDeferred = 0;
        dueLoans.forEach(({ loan: l, dues, exemption }) => {
          allocatedWeeklyLoanPayments.set(l.id, exemption.isExempt ? 0 : dues.fullAmount);
        });
      }

      // Add individual loan items
      dueLoans.forEach(({ loan: l, dues, exemption }) => {
        const wName = getWalletName(l.walletId);
        const counterparty = l.counterparty || l.title || 'Lender';
        const scheduledAmt = dues.fullAmount;

        if (exemption.isExempt) {
          expenses.push({
            id: `${l.id}-w${i}`,
            title: `Loan: ${counterparty}`,
            category: 'Flexible Debt',
            description: `Flexible debt repayment to ${counterparty}. [Pagumē Exemption: Debt repayments paused during 13th month]. Remaining balance: ${formatETB(l.outstandingBalance)}.`,
            amount: scheduledAmt,
            scheduledAmount: scheduledAmt,
            type: 'LOAN',
            frequency: 'Due on Schedule',
            walletName: wName,
            isExempt: true,
            exemptionReason: exemption.reason || 'Pagumē holiday custom',
            isMandatory: false,
            opportunityStatus: 'PAGUME_EXEMPT'
          });
          itemsDue.push({ name: `Loan: ${counterparty}`, type: 'Loan', amount: scheduledAmt, isExempt: true, isMandatory: false });
        } else if (loanStrategy === 'FLEXIBLE_OPPORTUNITY') {
          const itemPaid = allocatedWeeklyLoanPayments.get(l.id) || 0;
          if (itemPaid > 0) {
            expenses.push({
              id: `${l.id}-w${i}`,
              title: `Loan: ${counterparty}`,
              category: 'Flexible Debt',
              description: `Paid from surplus (${formatETB(itemPaid, true)} of ${formatETB(scheduledAmt, true)} due via ${wName}). Remaining balance: ${formatETB(l.outstandingBalance)}.`,
              amount: itemPaid,
              scheduledAmount: scheduledAmt,
              type: 'LOAN',
              frequency: 'Surplus Opportunity (≥ 1k)',
              walletName: wName,
              isExempt: false,
              isMandatory: false,
              opportunityStatus: 'PAID_FROM_SURPLUS'
            });
            itemsDue.push({ name: `Loan: ${counterparty}`, type: 'Loan', amount: itemPaid, isExempt: false, isMandatory: false });
          } else {
            const deferReason = operatingSurplus < 1000
              ? `Surplus below ETB 1,000 threshold; deferred to protect bills & Equb.`
              : `Deferred to preserve cash for mandatory bills & Equb.`;
            expenses.push({
              id: `${l.id}-w${i}`,
              title: `Loan: ${counterparty} (Deferred)`,
              category: 'Flexible Debt',
              description: `${deferReason} Balance: ${formatETB(l.outstandingBalance)}.`,
              amount: 0,
              scheduledAmount: scheduledAmt,
              type: 'LOAN',
              frequency: 'Deferred (< 1k surplus)',
              walletName: wName,
              isExempt: false,
              isMandatory: false,
              opportunityStatus: 'DEFERRED_NO_SURPLUS'
            });
            itemsDue.push({ name: `Loan: ${counterparty} (Deferred)`, type: 'Loan', amount: 0, isExempt: false, isMandatory: false });
          }
        } else {
          // Strict amortization
          expenses.push({
            id: `${l.id}-w${i}`,
            title: `Loan: ${counterparty}`,
            category: 'Debt Repayment',
            description: `Scheduled debt repayment to ${counterparty} (Due on ${dues.dueDateStr} via ${wName}). Outstanding: ${formatETB(l.outstandingBalance)}.`,
            amount: scheduledAmt,
            scheduledAmount: scheduledAmt,
            type: 'LOAN',
            frequency: 'Due on Schedule',
            walletName: wName,
            isExempt: false,
            isMandatory: false,
            opportunityStatus: 'SCHEDULED_PAYMENT'
          });
          itemsDue.push({ name: `Loan: ${counterparty}`, type: 'Loan', amount: scheduledAmt, isExempt: false, isMandatory: false });
        }
      });

      if (expenses.length === 0) {
        expenses.push({
          id: `no-exp-w${i}`,
          title: 'No Major Obligations Due',
          category: 'Free Operating Cashflow',
          description: 'No scheduled mandatory bills, Equb rounds, or loan amortizations fall due in this week. 100% of weekly operating income is retained as liquid cash.',
          amount: 0,
          scheduledAmount: 0,
          type: 'RECURRING',
          frequency: 'Open',
          walletName: 'Cash',
          isExempt: false,
          isMandatory: false
        });
      }

      const totalOut = mandatoryOut + actualLoanPaid;
      const netFlow = projectedIncome - totalOut;
      const startBal = rollingBalance;
      rollingBalance += netFlow;

      const activeExpensesCount = expenses.filter(e => !e.isExempt).length;
      const mandatorySummary = [
        obligationsStats.activeRecurring.length > 0 ? `${obligationsStats.activeRecurring.length} Bills (${formatETB(rOut, true)})` : '',
        obligationsStats.activeEqubs.length > 0 ? `Equb (${formatETB(eqOut, true)})` : ''
      ].filter(Boolean).join(' • ');

      const flexibleSummary = obligationsStats.activeLoans.length > 0
        ? `Loans: ${formatETB(actualLoanPaid, true)} ${loanStrategy === 'FLEXIBLE_OPPORTUNITY' ? (actualLoanPaid > 0 ? '(paid from surplus)' : '(deferred)') : '(scheduled)'}`
        : '';

      const expensesSummary = [
        mandatorySummary,
        flexibleSummary
      ].filter(Boolean).join(' • ');

      list.push({
        weekIndex: i + 1,
        label: `Week ${i + 1}`,
        startDate: wStart,
        endDate: wEnd,
        startBal,
        projectedIncome,
        recurringOut: rOut,
        loansOut: actualLoanPaid,
        equbOut: eqOut,
        mandatoryOut,
        operatingSurplus,
        loanOpportunityPaid: actualLoanPaid,
        loanOpportunityDeferred,
        totalOut,
        netFlow,
        endBal: rollingBalance,
        isPagume: isPagumeWeek,
        itemsDue,
        incomes,
        expenses,
        expensesSummary: expensesSummary || `${activeExpensesCount} items (${formatETB(totalOut, true)})`,
        mandatorySummary,
        flexibleSummary
      });
    }

    return list;
  }, [currentTotalBalance, currentWeekStats, obligationsStats, wallets, loanStrategy]);

  // 4. GENERATE MONTHLY PROJECTION (Next 12 Months)
  const monthlyForecast = useMemo(() => {
    const list: Array<{
      monthIndex: number;
      ethMonthName: string;
      ethYear: number;
      gregLabel: string;
      startBal: number;
      projectedIncome: number;
      recurringOut: number;
      loansOut: number;
      equbOut: number;
      mandatoryOut: number;
      operatingSurplus: number;
      loanOpportunityPaid: number;
      loanOpportunityDeferred: number;
      totalOut: number;
      netFlow: number;
      endBal: number;
      isPagume: boolean;
      daysInMonth: number;
      pagumeExemptionSaved: number;
      incomes: ForecastIncomeItem[];
      expenses: ForecastExpenseItem[];
      expensesSummary: string;
      mandatorySummary: string;
      flexibleSummary: string;
    }> = [];

    const now = new Date();
    let rollingBalance = currentTotalBalance;

    // Track remaining rounds for each active Equb across the 12-month trajectory
    const equbRoundsTracker = new Map<string, number>();
    obligationsStats.activeEqubs.forEach(e => {
      const completed = typeof e.completedRounds === 'number' ? e.completedRounds : Math.max(0, e.currentRound - 1);
      const rem = Math.max(0, e.totalRounds - completed);
      equbRoundsTracker.set(e.id, rem);
    });

    // Track remaining balance for active loans across the 12-month trajectory
    const loanBalanceTracker = new Map<string, number>();
    obligationsStats.activeLoans.forEach(l => {
      loanBalanceTracker.set(l.id, Math.max(0, Number(l.outstandingBalance || 0)));
    });

    for (let i = 0; i < 12; i++) {
      // Advance by i months in Gregorian or Ethiopian
      const mDate = new Date(now.getFullYear(), now.getMonth() + i, 15);
      const eth = toEthiopianDate(mDate);
      const isPagume = eth.isPagume;
      const daysInMonth = isPagume ? (eth.year % 4 === 3 ? 6 : 5) : 30;

      const gregLabel = mDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      const projectedIncome = isPagume
        ? currentWeekStats.dailyIncomeRunRate * 5
        : currentWeekStats.monthlyIncomeRunRate;

      const incomes: ForecastIncomeItem[] = [
        {
          id: `inc-month-${i}`,
          title: 'Income',
          category: 'Operations',
          description: isPagume
            ? `Projected 5-day income for Pagumē (~${formatETB(currentWeekStats.dailyIncomeRunRate, true)}/day).`
            : `Projected monthly income based on current weekly pace (~${formatETB(currentWeekStats.dailyIncomeRunRate, true)}/day).`,
          amount: projectedIncome,
          basis: isPagume ? '5 Operating Days' : 'Monthly Pace'
        }
      ];

      const expenses: ForecastExpenseItem[] = [];

      let rOut = 0;
      let eqOut = 0;
      let pagumeExemptionSaved = 0;

      // Recurring (MANDATORY)
      obligationsStats.activeRecurring.forEach(r => {
        const amt = Number(r.amount) || 0;
        const wName = getWalletName(r.walletId);
        const freq = (r.frequency || 'MONTHLY').toUpperCase();
        let monthlyAmt = amt;
        if (freq === 'DAILY') monthlyAmt = amt * 30;
        else if (freq === 'WEEKLY') monthlyAmt = amt * 4;
        else if (freq === 'BIWEEKLY') monthlyAmt = amt * 2;
        else if (freq === 'EVERY_2_MONTHS') monthlyAmt = amt;
        else monthlyAmt = amt;

        const isRentOrBill = (r.category || '').toLowerCase().includes('rent') || (r.title || '').toLowerCase().includes('rent');

        if (isPagume) {
          if (isRentOrBill) {
            pagumeExemptionSaved += monthlyAmt;
            expenses.push({
              id: `m-rec-${r.id}`,
              title: r.title,
              category: r.category || 'Rent & Facilities',
              description: `[MANDATORY COMMITMENT] ${r.title} waived under Ethiopian Pagumē 13th-month calendar convention.`,
              amount: monthlyAmt,
              scheduledAmount: monthlyAmt,
              type: 'RECURRING',
              frequency: 'Monthly',
              walletName: wName,
              isExempt: true,
              exemptionReason: 'Pagumē holiday custom',
              isMandatory: true
            });
          } else {
            // Electricity/utilities portion during 5-day holiday
            const pagumePortion = monthlyAmt * 0.166;
            rOut += pagumePortion;
            expenses.push({
              id: `m-rec-${r.id}`,
              title: r.title,
              category: r.category || 'Utilities',
              description: `[MANDATORY COMMITMENT] 5-day electricity & operational baseline for gaming hall during Pagumē.`,
              amount: pagumePortion,
              scheduledAmount: pagumePortion,
              type: 'RECURRING',
              frequency: 'Pagumē 5 days',
              walletName: wName,
              isExempt: false,
              isMandatory: true
            });
          }
        } else {
          // Check if this recurring item is prepaid in advance past this forecast month
          const dueMs = r.nextDueDate ? new Date(r.nextDueDate).getTime() : 0;
          const monthEndMs = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59).getTime();
          const isPrepaidForThisMonth = dueMs > monthEndMs;

          if (isPrepaidForThisMonth) {
            expenses.push({
              id: `m-rec-${r.id}-${i}`,
              title: r.title,
              category: r.category || 'Rent & Facilities',
              description: `[PREPAID IN ADVANCE] ${r.title} settled in advance (covered until ${r.nextDueDate ? new Date(r.nextDueDate).toLocaleDateString() : 'future date'}). ETB 0 outflow needed this month.`,
              amount: 0,
              scheduledAmount: 0,
              type: 'RECURRING',
              frequency: 'Prepaid in advance',
              walletName: wName,
              isExempt: true,
              exemptionReason: 'Paid in advance',
              isMandatory: false
            });
          } else {
            rOut += monthlyAmt;
            expenses.push({
              id: `m-rec-${r.id}-${i}`,
              title: r.title,
              category: r.category || 'Utilities',
              description: `[MANDATORY COMMITMENT] ${r.notes?.trim() || `${r.category || 'Operating'} scheduled monthly expense payable via ${wName}.`}`,
              amount: monthlyAmt,
              scheduledAmount: monthlyAmt,
              type: 'RECURRING',
              frequency: 'Monthly',
              walletName: wName,
              isExempt: false,
              isMandatory: true
            });
          }
        }
      });

      // Equb (MANDATORY - Decreases accordingly as remaining rounds are completed)
      obligationsStats.activeEqubs.forEach(e => {
        const c = Number(e.contributionPerRound) || 0;
        const wName = getWalletName(e.walletId);
        const interval = (e.interval || 'WEEKLY').toUpperCase();
        let standardMonthlyRounds = 1;
        if (interval === 'DAILY') standardMonthlyRounds = 30;
        else if (interval === 'EVERY_5_DAYS') standardMonthlyRounds = 6;
        else if (interval === 'EVERY_10_DAYS') standardMonthlyRounds = 3;
        else if (interval === 'WEEKLY') standardMonthlyRounds = 4;
        else if (interval === 'BI_WEEKLY' || interval === 'BIWEEKLY') standardMonthlyRounds = 2;
        else if (interval === 'EVERY_15_DAYS') standardMonthlyRounds = 2;
        else if (interval === 'MONTHLY') standardMonthlyRounds = 1;

        const remRoundsBefore = equbRoundsTracker.get(e.id) || 0;

        if (isPagume) {
          if (remRoundsBefore > 0) {
            const pausedAmt = c * Math.min(standardMonthlyRounds, remRoundsBefore);
            pagumeExemptionSaved += pausedAmt;
            expenses.push({
              id: `m-eq-${e.id}-${i}`,
              title: `Equb: ${e.name}`,
              category: 'Equb Savings',
              description: `[MANDATORY COMMITMENT] Round contribution for ${e.name} Equb paused under Pagumē 13th-month calendar convention (${remRoundsBefore} rounds remaining).`,
              amount: pausedAmt,
              scheduledAmount: pausedAmt,
              type: 'EQUB',
              frequency: e.interval.replace(/_/g, ' ').toLowerCase(),
              walletName: wName,
              isExempt: true,
              exemptionReason: 'Pagumē holiday custom',
              isMandatory: true
            });
          }
        } else {
          const roundsToPay = Math.min(standardMonthlyRounds, remRoundsBefore);
          const monthlyAmt = roundsToPay * c;
          const remRoundsAfter = remRoundsBefore - roundsToPay;
          equbRoundsTracker.set(e.id, remRoundsAfter);

          if (roundsToPay > 0) {
            eqOut += monthlyAmt;
            const isCompletedThisMonth = remRoundsAfter === 0;
            expenses.push({
              id: `m-eq-${e.id}-${i}`,
              title: `Equb: ${e.name}`,
              category: 'Equb Savings',
              description: `[MANDATORY COMMITMENT] ${roundsToPay} round${roundsToPay > 1 ? 's' : ''} for ${e.name} Equb (${formatETB(monthlyAmt)} total • ${isCompletedThisMonth ? 'All rounds completed!' : `${remRoundsAfter} round${remRoundsAfter > 1 ? 's' : ''} remaining after this month`}).`,
              amount: monthlyAmt,
              scheduledAmount: monthlyAmt,
              type: 'EQUB',
              frequency: `${e.interval.replace(/_/g, ' ').toLowerCase()} • ${roundsToPay} round${roundsToPay > 1 ? 's' : ''}`,
              walletName: wName,
              isExempt: false,
              isMandatory: true
            });
          }
        }
      });

      const mandatoryOut = rOut + eqOut;
      const operatingSurplus = projectedIncome - mandatoryOut;

      // Loans (FLEXIBLE - paid on opportunity in the middle, tracked against remaining principal)
      let lScheduled = 0;
      obligationsStats.activeLoans.forEach(l => {
        const curRemLoan = loanBalanceTracker.get(l.id) || 0;
        if (curRemLoan > 0) {
          let inst = Number(l.monthlyInstallment || curRemLoan || 0);
          if (inst < 1000 && curRemLoan >= 1000) {
            inst = 1000;
          }
          inst = Math.min(inst, curRemLoan);
          if (!isPagume) {
            lScheduled += inst;
          }
        }
      });

      let actualLoanPaid = 0;
      let loanOpportunityDeferred = 0;
      const allocatedMonthlyLoanPayments = new Map<string, number>();

      if (isPagume || lScheduled === 0) {
        actualLoanPaid = 0;
        loanOpportunityDeferred = 0;
        obligationsStats.activeLoans.forEach(l => allocatedMonthlyLoanPayments.set(l.id, 0));
      } else if (loanStrategy === 'FLEXIBLE_OPPORTUNITY') {
        if (operatingSurplus >= 1000 && lScheduled > 0) {
          let pool = Math.min(lScheduled, operatingSurplus);

          for (const l of obligationsStats.activeLoans) {
            const curRemLoan = loanBalanceTracker.get(l.id) || 0;
            if (curRemLoan <= 0) {
              allocatedMonthlyLoanPayments.set(l.id, 0);
              continue;
            }
            let inst = Number(l.monthlyInstallment || curRemLoan || 0);
            if (inst < 1000 && curRemLoan >= 1000) inst = 1000;
            inst = Math.min(inst, curRemLoan);
            const minAllowed = Math.min(1000, inst);

            if (pool >= minAllowed) {
              const toPay = Math.min(inst, pool);
              if (toPay >= minAllowed) {
                allocatedMonthlyLoanPayments.set(l.id, toPay);
                pool -= toPay;
              } else {
                allocatedMonthlyLoanPayments.set(l.id, 0);
              }
            } else {
              allocatedMonthlyLoanPayments.set(l.id, 0);
            }
          }

          if (pool > 0) {
            for (const l of obligationsStats.activeLoans) {
              const curRemLoan = loanBalanceTracker.get(l.id) || 0;
              if (curRemLoan <= 0) continue;
              let inst = Number(l.monthlyInstallment || curRemLoan || 0);
              if (inst < 1000 && curRemLoan >= 1000) inst = 1000;
              inst = Math.min(inst, curRemLoan);
              const curPaid = allocatedMonthlyLoanPayments.get(l.id) || 0;
              if (curPaid > 0 && curPaid < inst) {
                const add = Math.min(inst - curPaid, pool);
                allocatedMonthlyLoanPayments.set(l.id, curPaid + add);
                pool -= add;
              }
              if (pool <= 0) break;
            }
          }

          actualLoanPaid = Array.from(allocatedMonthlyLoanPayments.values()).reduce((s, v) => s + v, 0);
          loanOpportunityDeferred = Math.max(0, lScheduled - actualLoanPaid);
        } else {
          actualLoanPaid = 0;
          loanOpportunityDeferred = lScheduled;
          obligationsStats.activeLoans.forEach(l => allocatedMonthlyLoanPayments.set(l.id, 0));
        }
      } else {
        actualLoanPaid = lScheduled;
        loanOpportunityDeferred = 0;
        obligationsStats.activeLoans.forEach(l => {
          const curRemLoan = loanBalanceTracker.get(l.id) || 0;
          let inst = Number(l.monthlyInstallment || curRemLoan || 0);
          if (inst < 1000 && curRemLoan >= 1000) inst = 1000;
          inst = Math.min(inst, curRemLoan);
          allocatedMonthlyLoanPayments.set(l.id, inst);
        });
      }

      // Deduct paid loan principal from loanBalanceTracker
      allocatedMonthlyLoanPayments.forEach((paidAmt, lId) => {
        if (paidAmt > 0) {
          const cur = loanBalanceTracker.get(lId) || 0;
          loanBalanceTracker.set(lId, Math.max(0, cur - paidAmt));
        }
      });

      obligationsStats.activeLoans.forEach(l => {
        let inst = Number(l.monthlyInstallment || l.outstandingBalance || 0);
        if (inst < 1000 && l.outstandingBalance >= 1000) inst = 1000;
        const wName = getWalletName(l.walletId);
        const counterparty = l.counterparty || l.title || 'Lender';
        const loanDesc = `Monthly debt repayment for borrowed funds from ${counterparty} (Initial: ${formatETB(l.initialAmount)}, remaining: ${formatETB(l.outstandingBalance)} via ${wName}).`;

        if (isPagume) {
          pagumeExemptionSaved += inst;
          expenses.push({
            id: `m-loan-${l.id}`,
            title: `Loan: ${counterparty}`,
            category: 'Flexible Debt',
            description: `${loanDesc} — [Pagumē Exemption: Debt repayments paused during 13th month]`,
            amount: inst,
            scheduledAmount: inst,
            type: 'LOAN',
            frequency: 'Monthly',
            walletName: wName,
            isExempt: true,
            exemptionReason: 'Pagumē holiday custom',
            isMandatory: false,
            opportunityStatus: 'PAGUME_EXEMPT'
          });
        } else if (loanStrategy === 'FLEXIBLE_OPPORTUNITY') {
          const itemPaid = allocatedMonthlyLoanPayments.get(l.id) || 0;
          if (itemPaid > 0) {
            expenses.push({
              id: `m-loan-${l.id}`,
              title: `Loan: ${counterparty}`,
              category: 'Flexible Debt',
              description: `Paid from monthly surplus (${formatETB(itemPaid, true)} of ${formatETB(inst, true)} via ${wName}). Remaining balance: ${formatETB(l.outstandingBalance)}.`,
              amount: itemPaid,
              scheduledAmount: inst,
              type: 'LOAN',
              frequency: 'Surplus Opportunity (≥ 1k)',
              walletName: wName,
              isExempt: false,
              isMandatory: false,
              opportunityStatus: 'PAID_FROM_SURPLUS'
            });
          } else {
            const deferReason = operatingSurplus < 1000
              ? `Surplus below ETB 1,000 threshold; deferred to protect bills & Equb.`
              : `Deferred to protect mandatory recurring bills & Equb.`;
            expenses.push({
              id: `m-loan-${l.id}`,
              title: `Loan: ${counterparty} (Deferred)`,
              category: 'Flexible Debt',
              description: `${deferReason} Balance: ${formatETB(l.outstandingBalance)}.`,
              amount: 0,
              scheduledAmount: inst,
              type: 'LOAN',
              frequency: 'Deferred (< 1k surplus)',
              walletName: wName,
              isExempt: false,
              isMandatory: false,
              opportunityStatus: 'DEFERRED_NO_SURPLUS'
            });
          }
        } else {
          expenses.push({
            id: `m-loan-${l.id}`,
            title: `Loan: ${counterparty}`,
            category: 'Debt Repayment',
            description: `${loanDesc} (Scheduled amortization).`,
            amount: inst,
            scheduledAmount: inst,
            type: 'LOAN',
            frequency: 'Monthly Installment (≥ 1k)',
            walletName: wName,
            isExempt: false,
            isMandatory: false,
            opportunityStatus: 'SCHEDULED_PAYMENT'
          });
        }
      });

      const totalOut = mandatoryOut + actualLoanPaid;
      const netFlow = projectedIncome - totalOut;
      const startBal = rollingBalance;
      rollingBalance += netFlow;

      const mandatorySummary = [
        obligationsStats.activeRecurring.length > 0 ? `${obligationsStats.activeRecurring.length} Bills (${formatETB(rOut, true)})` : '',
        eqOut > 0 ? `Equb (${formatETB(eqOut, true)})` : ''
      ].filter(Boolean).join(' • ');

      const flexibleSummary = obligationsStats.activeLoans.length > 0
        ? `Loans: ${formatETB(actualLoanPaid, true)} ${loanStrategy === 'FLEXIBLE_OPPORTUNITY' ? (actualLoanPaid > 0 ? '(paid from surplus)' : '(deferred)') : '(scheduled)'}`
        : '';

      const expensesSummary = [
        mandatorySummary,
        flexibleSummary
      ].filter(Boolean).join(' • ');

      list.push({
        monthIndex: i + 1,
        ethMonthName: eth.monthNameEn,
        ethYear: eth.year,
        gregLabel,
        startBal,
        projectedIncome,
        recurringOut: rOut,
        loansOut: actualLoanPaid,
        equbOut: eqOut,
        mandatoryOut,
        operatingSurplus,
        loanOpportunityPaid: actualLoanPaid,
        loanOpportunityDeferred,
        totalOut,
        netFlow,
        endBal: rollingBalance,
        isPagume,
        daysInMonth,
        pagumeExemptionSaved,
        incomes,
        expenses,
        expensesSummary: expensesSummary || `${expenses.filter(e => !e.isExempt).length} items (${formatETB(totalOut, true)})`,
        mandatorySummary,
        flexibleSummary
      });
    }

    return list;
  }, [currentTotalBalance, currentWeekStats, obligationsStats, wallets, loanStrategy]);

  // 5. YEARLY CALENDAR DATA (13 Ethiopian Months Detailed Schedule)
  const yearlyCalendarMonths = useMemo(() => {
    const calEqubTracker = new Map<string, number>();
    obligationsStats.activeEqubs.forEach(e => {
      const completed = typeof e.completedRounds === 'number' ? e.completedRounds : Math.max(0, e.currentRound - 1);
      calEqubTracker.set(e.id, Math.max(0, e.totalRounds - completed));
    });

    return ETHIOPIAN_MONTHS.map(m => {
      const isPagume = m.id === 13;
      const daysCount = isPagume ? 5 : 30;

      // Project income for that month
      const monthIncome = isPagume
        ? (currentWeekStats.dailyIncomeRunRate * 5)
        : (currentWeekStats.dailyIncomeRunRate * 30);

      // Project outflows: Mandatory bills & Equb
      const recurringBill = isPagume
        ? (obligationsStats.recurringMonthly * 0.15) // electricity only
        : obligationsStats.recurringMonthly;

      let equbBill = 0;
      if (!isPagume) {
        obligationsStats.activeEqubs.forEach(e => {
          const c = Number(e.contributionPerRound) || 0;
          const interval = (e.interval || 'WEEKLY').toUpperCase();
          let mRounds = 1;
          if (interval === 'DAILY') mRounds = 30;
          else if (interval === 'EVERY_5_DAYS') mRounds = 6;
          else if (interval === 'EVERY_10_DAYS') mRounds = 3;
          else if (interval === 'WEEKLY') mRounds = 4;
          else if (interval === 'BI_WEEKLY' || interval === 'BIWEEKLY') mRounds = 2;
          else if (interval === 'EVERY_15_DAYS') mRounds = 2;
          else if (interval === 'MONTHLY') mRounds = 1;

          const rem = calEqubTracker.get(e.id) || 0;
          const toPay = Math.min(mRounds, rem);
          calEqubTracker.set(e.id, rem - toPay);
          equbBill += toPay * c;
        });
      }

      const mandatoryBill = recurringBill + equbBill;
      const monthSurplus = monthIncome - mandatoryBill;

      const scheduledLoanBill = isPagume ? 0 : obligationsStats.loansMonthly;
      const loanBill = loanStrategy === 'FLEXIBLE_OPPORTUNITY'
        ? (isPagume ? 0 : (monthSurplus >= 1000 ? Math.min(scheduledLoanBill, monthSurplus) : 0))
        : scheduledLoanBill;

      const totalOutflow = mandatoryBill + loanBill;
      const netMonth = monthIncome - totalOutflow;

      return {
        id: m.id,
        nameEn: m.en,
        nameAm: m.am,
        daysCount,
        isPagume,
        monthIncome,
        recurringBill,
        loanBill,
        equbBill,
        mandatoryBill,
        scheduledLoanBill,
        monthSurplus,
        totalOutflow,
        netMonth
      };
    });
  }, [currentWeekStats, obligationsStats, loanStrategy]);

  const selectedMonthData = useMemo(() => {
    return yearlyCalendarMonths.find(m => m.id === selectedCalendarMonth) || yearlyCalendarMonths[0];
  }, [yearlyCalendarMonths, selectedCalendarMonth]);

  // Trajectory Short Summary (12-Week Cashflow Trajectory)
  const weeklyTrajectorySummary = useMemo(() => {
    if (weeklyForecast.length === 0) return null;

    const startBal = weeklyForecast[0].startBal;
    const endBal = weeklyForecast[weeklyForecast.length - 1].endBal;
    const netChange = endBal - startBal;
    const pctChange = startBal !== 0 ? (netChange / Math.abs(startBal)) * 100 : 0;

    let lowestWeek = weeklyForecast[0];
    let highestWeek = weeklyForecast[0];
    let totalIn = 0;
    let totalOut = 0;
    let surplusCount = 0;
    let deficitCount = 0;

    for (const w of weeklyForecast) {
      if (w.endBal < lowestWeek.endBal) lowestWeek = w;
      if (w.endBal > highestWeek.endBal) highestWeek = w;
      totalIn += w.projectedIncome;
      totalOut += w.totalOut;
      if (w.netFlow >= 0) surplusCount++;
      else deficitCount++;
    }

    let health: 'EXPANDING' | 'STABLE' | 'TIGHT' | 'DEFICIT';
    let healthLabel = '';
    let badgeStyle = '';

    if (netChange >= 0 && lowestWeek.endBal >= startBal * 0.75) {
      health = 'EXPANDING';
      healthLabel = 'Positive Growth (+Surplus)';
      badgeStyle = 'bg-emerald-500/15 text-emerald-700 dark:text-[#00D4AA] border-emerald-500/30';
    } else if (netChange >= 0) {
      health = 'STABLE';
      healthLabel = 'Net Surplus (Mid-Period Dip)';
      badgeStyle = 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
    } else if (lowestWeek.endBal > 0) {
      health = 'TIGHT';
      healthLabel = 'Managed Burn (Solvent)';
      badgeStyle = 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    } else {
      health = 'DEFICIT';
      healthLabel = 'Shortfall Risk Detected';
      badgeStyle = 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30';
    }

    let narrative = '';
    if (netChange >= 0) {
      narrative = `Over the next 12 weeks, liquid reserves are projected to increase by +${formatETB(netChange, true)} (${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}%) to ${formatETB(endBal, true)} across ${surplusCount} surplus weeks. Lowest liquidity buffer occurs in Week ${lowestWeek.weekIndex} (${formatETB(lowestWeek.endBal, true)}) with zero insolvency risk.`;
    } else {
      narrative = `Over the next 12 weeks, net reserves contract by ${formatETB(Math.abs(netChange), true)} (${pctChange.toFixed(1)}%) ending at ${formatETB(endBal, true)} across ${deficitCount} deficit weeks. The lowest cash reserve point occurs in Week ${lowestWeek.weekIndex} (${formatETB(lowestWeek.endBal, true)}).`;
    }

    return {
      startBal,
      endBal,
      netChange,
      pctChange,
      lowestWeek,
      highestWeek,
      totalIn,
      totalOut,
      surplusCount,
      deficitCount,
      health,
      healthLabel,
      badgeStyle,
      narrative
    };
  }, [weeklyForecast]);

  // Trajectory Short Summary (12-Month Fiscal Trajectory)
  const monthlyTrajectorySummary = useMemo(() => {
    if (monthlyForecast.length === 0) return null;

    const startBal = monthlyForecast[0].startBal;
    const endBal = monthlyForecast[monthlyForecast.length - 1].endBal;
    const netChange = endBal - startBal;
    const pctChange = startBal !== 0 ? (netChange / Math.abs(startBal)) * 100 : 0;

    let lowestMonth = monthlyForecast[0];
    let highestMonth = monthlyForecast[0];
    let totalIn = 0;
    let totalOut = 0;
    let totalPagumeSavings = 0;

    for (const m of monthlyForecast) {
      if (m.endBal < lowestMonth.endBal) lowestMonth = m;
      if (m.endBal > highestMonth.endBal) highestMonth = m;
      totalIn += m.projectedIncome;
      totalOut += m.totalOut;
      totalPagumeSavings += m.pagumeExemptionSaved || 0;
    }

    let narrative = '';
    if (netChange >= 0) {
      narrative = `12-month fiscal projection forecasts cumulative liquidity expansion of +${formatETB(netChange, true)} (${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}%), ending at ${formatETB(endBal, true)}. Includes ${formatETB(totalPagumeSavings, true)} in 13th Month (Pagumē) holiday exemption savings.`;
    } else {
      narrative = `12-month fiscal projection anticipates a net contraction of ${formatETB(Math.abs(netChange), true)} ending at ${formatETB(endBal, true)}. Lowest point occurs in ${lowestMonth.ethMonthName} (${formatETB(lowestMonth.endBal, true)}).`;
    }

    return {
      startBal,
      endBal,
      netChange,
      pctChange,
      lowestMonth,
      highestMonth,
      totalIn,
      totalOut,
      totalPagumeSavings,
      narrative
    };
  }, [monthlyForecast]);

  return (
    <div className="bg-white dark:bg-[#111622] border border-slate-200/80 dark:border-[#1C2638] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5 transition-all">
      
      {/* SECTION HEADER & VIEW SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#1C2638]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-[#00D4AA] flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Cashflow Forecast
            </h3>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1A2232] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#243046]">
              Weekly Pace
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-1">
            Projected income and scheduled expenses based on current week activity.
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center bg-slate-100 dark:bg-[#1A2232] p-1 rounded-xl border border-slate-200 dark:border-[#243046] text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSelectedPeriod('WEEKLY');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedPeriod === 'WEEKLY'
                ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Weekly</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSelectedPeriod('MONTHLY');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedPeriod === 'MONTHLY'
                ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Monthly</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSelectedPeriod('YEARLY_CALENDAR');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedPeriod === 'YEARLY_CALENDAR'
                ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {/* OBLIGATION STRATEGY & LOAN FLEXIBILITY CONTROLLER */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#151C2A] border border-slate-200/80 dark:border-[#1C2638] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>
            <strong className="text-slate-900 dark:text-white">Priority:</strong> Mandatory Bills & Equb first • Loans paid from surplus (min 1k)
          </span>
        </div>

        {/* Strategy Mode Toggle Button */}
        <div className="flex items-center bg-white dark:bg-[#1A2232] p-0.5 rounded-lg border border-slate-200 dark:border-[#243046] text-xs shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setLoanStrategy('FLEXIBLE_OPPORTUNITY');
            }}
            className={`px-2.5 py-1 rounded-md font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              loanStrategy === 'FLEXIBLE_OPPORTUNITY'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Flexible on Surplus</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setLoanStrategy('STRICT_SCHEDULED');
            }}
            className={`px-2.5 py-1 rounded-md font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              loanStrategy === 'STRICT_SCHEDULED'
                ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Repeat className="w-3 h-3" />
            <span>Strict</span>
          </button>
        </div>
      </div>

      {/* 4 CORE CASHFLOW ENGINE METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Weekly Income */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#151C2A] border border-slate-200/80 dark:border-[#1C2638] space-y-1 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-[#8899BB]">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-[#00D4AA]">
              <TrendingUp className="w-3.5 h-3.5" />
              Weekly Income
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {currentWeekStats.activeDaysCount} active days
            </span>
          </div>
          <p className="text-xl font-black font-mono text-emerald-700 dark:text-[#00D4AA]">
            {hideBalances ? '••••••' : formatETB(currentWeekStats.weeklyIncomeRunRate)}
            <span className="text-xs font-normal text-slate-500 dark:text-[#8899BB] font-sans"> / wk</span>
          </p>
          <div className="text-[11px] text-slate-500 dark:text-[#8899BB] border-t border-slate-200/60 dark:border-[#1E2D40] pt-1">
            <span>Daily avg: {hideBalances ? '•••' : formatETB(currentWeekStats.dailyIncomeRunRate, true)}/day</span>
          </div>
        </div>

        {/* Card 2: Mandatory Committed Outflow (Bills + Equb) */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#151C2A] border border-slate-200/80 dark:border-[#1C2638] space-y-1 hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-[#8899BB]">
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Mandatory Outflow
            </span>
            <span className="font-mono text-[10px] text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded font-semibold">
              Bills & Equb
            </span>
          </div>
          <p className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
            {hideBalances ? '••••••' : formatETB(obligationsStats.mandatoryWeekly)}
            <span className="text-xs font-normal text-slate-500 dark:text-[#8899BB] font-sans"> / wk</span>
          </p>
          <div className="text-[11px] text-slate-500 dark:text-[#8899BB] border-t border-slate-200/60 dark:border-[#1E2D40] pt-1">
            <span>Monthly: {hideBalances ? '•••' : formatETB(obligationsStats.mandatoryMonthly, true)}</span>
          </div>
        </div>

        {/* Card 3: Operating Surplus & Net Flow */}
        <div className={`p-3.5 rounded-xl border space-y-1 transition-all ${
          mandatoryNetWeekly >= 1000
            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
            : mandatoryNetWeekly >= 0
            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
            : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={mandatoryNetWeekly >= 1000 ? 'text-emerald-700 dark:text-emerald-300' : mandatoryNetWeekly >= 0 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}>
              Net Surplus
            </span>
            <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold ${
              mandatoryNetWeekly >= 1000
                ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                : mandatoryNetWeekly > 0
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                : 'bg-rose-500/20 text-rose-800 dark:text-rose-300'
            }`}>
              {mandatoryNetWeekly >= 1000
                ? 'Surplus (≥ 1k)'
                : mandatoryNetWeekly > 0
                ? 'Loans Deferred'
                : 'Deficit'}
            </span>
          </div>
          <p className={`text-xl font-black font-mono ${
            netWeekly >= 0 ? 'text-emerald-700 dark:text-[#00D4AA]' : 'text-rose-700 dark:text-rose-400'
          }`}>
            {netWeekly >= 0 ? '+' : ''}{hideBalances ? '••••••' : formatETB(netWeekly)}
            <span className="text-xs font-normal text-slate-500 dark:text-[#8899BB] font-sans"> / wk</span>
          </p>
          <div className="text-[11px] text-slate-500 dark:text-[#8899BB] border-t border-slate-200/60 dark:border-[#1E2D40] pt-1">
            <span>Operating surplus: {mandatoryNetWeekly >= 0 ? '+' : ''}{hideBalances ? '•••' : formatETB(mandatoryNetWeekly, true)}</span>
          </div>
        </div>

        {/* Card 4: Cash Runway */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#151C2A] border border-slate-200/80 dark:border-[#1C2638] space-y-1 hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-[#8899BB]">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Wallet className="w-3.5 h-3.5" />
              Cash Runway
            </span>
            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded">
              Buffer
            </span>
          </div>
          <p className="text-xl font-black font-mono text-slate-900 dark:text-white">
            {runwayMonths} <span className="text-xs font-normal text-slate-500 dark:text-[#8899BB] font-sans">Months</span>
          </p>
          <div className="text-[11px] text-slate-500 dark:text-[#8899BB] border-t border-slate-200/60 dark:border-[#1E2D40] pt-1">
            <span>Available cash: {hideBalances ? '••••' : formatETB(currentTotalBalance, true)}</span>
          </div>
        </div>
      </div>

      {/* VIEW 1: WEEKLY PROJECTION (12 WEEKS) */}
      {selectedPeriod === 'WEEKLY' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-500" />
              12-Week Cashflow Trajectory & Ending Balance
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-[#8899BB]">
              Click any week to inspect scheduled dues
            </span>
          </div>

          {/* TRAJECTORY SHORT SUMMARY CARD */}
          {weeklyTrajectorySummary && (
            <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-[#1E2D40] bg-slate-50/80 dark:bg-[#151C2A] space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-[#00D4AA] flex items-center justify-center font-bold">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Trajectory Short Summary
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${weeklyTrajectorySummary.badgeStyle}`}>
                    {weeklyTrajectorySummary.healthLabel}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-[#8899BB]">
                  12-Wk Horizon • Starting: {hideBalances ? '••••' : formatETB(weeklyTrajectorySummary.startBal, true)}
                </div>
              </div>

              {/* 4-Stat Key Highlights Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Stat 1: Net Delta */}
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0E131F] border border-slate-200/70 dark:border-[#1C2638]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] block">
                    Net Trajectory
                  </span>
                  <span className={`text-sm font-black font-mono block mt-0.5 ${
                    weeklyTrajectorySummary.netChange >= 0 ? 'text-emerald-600 dark:text-[#00D4AA]' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {weeklyTrajectorySummary.netChange >= 0 ? '+' : ''}{hideBalances ? '••••' : formatETB(weeklyTrajectorySummary.netChange, true)}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    {weeklyTrajectorySummary.pctChange > 0 ? '+' : ''}{weeklyTrajectorySummary.pctChange.toFixed(1)}% change
                  </span>
                </div>

                {/* Stat 2: Projected Ending Balance */}
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0E131F] border border-slate-200/70 dark:border-[#1C2638]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] block">
                    12-Wk Ending Cash
                  </span>
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white block mt-0.5">
                    {hideBalances ? '••••' : formatETB(weeklyTrajectorySummary.endBal, true)}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    Week 12 balance
                  </span>
                </div>

                {/* Stat 3: Lowest Buffer (Trough) */}
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0E131F] border border-slate-200/70 dark:border-[#1C2638]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] block">
                    Lowest Cash Point
                  </span>
                  <span className={`text-sm font-black font-mono block mt-0.5 ${
                    weeklyTrajectorySummary.lowestWeek.endBal > 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {hideBalances ? '••••' : formatETB(weeklyTrajectorySummary.lowestWeek.endBal, true)}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    Trough at Week {weeklyTrajectorySummary.lowestWeek.weekIndex}
                  </span>
                </div>

                {/* Stat 4: Surplus Ratio */}
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0E131F] border border-slate-200/70 dark:border-[#1C2638]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] block">
                    Surplus Ratio
                  </span>
                  <span className="text-sm font-black font-mono text-emerald-600 dark:text-[#00D4AA] block mt-0.5">
                    {weeklyTrajectorySummary.surplusCount}/12 Weeks
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {Math.round((weeklyTrajectorySummary.surplusCount / 12) * 100)}% positive weeks
                  </span>
                </div>
              </div>

              {/* Natural Language Short Summary Callout */}
              <div className="p-2.5 rounded-lg bg-emerald-500/5 dark:bg-[#111A26] border border-emerald-500/20 text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-[#00D4AA] shrink-0 mt-0.5" />
                <p>
                  {weeklyTrajectorySummary.narrative}
                </p>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-[#1C2638] border border-slate-200/80 dark:border-[#1C2638] rounded-xl overflow-hidden bg-slate-50/50 dark:bg-[#151C2A]">
            {weeklyForecast.map((w) => {
              const isExpanded = expandedWeekId === w.label;
              return (
                <div key={w.label} className="transition-colors">
                  <div
                    onClick={() => {
                      triggerHaptic('light');
                      setExpandedWeekId(isExpanded ? null : w.label);
                    }}
                    className="p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-100/70 dark:hover:bg-[#1C2638] cursor-pointer transition-colors"
                  >
                    {/* Week Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        w.isPagume
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : w.netFlow >= 0
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-[#00D4AA]'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                      }`}>
                        W{w.weekIndex}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {w.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {w.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {w.isPagume && (
                            <span className="text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded">
                              ጳጉሜ (Pagumē) Exemption Active
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            E.C. {formatDateByCalendar(w.startDate, 'ETHIOPIAN', false)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1">
                          <span className="text-emerald-600 dark:text-[#00D4AA] font-mono font-bold flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3 shrink-0" />
                            Income: +{hideBalances ? '••••' : formatETB(w.projectedIncome, true)}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="text-rose-600 dark:text-rose-400 font-mono font-medium flex items-center gap-1">
                            <ArrowDownLeft className="w-3 h-3 shrink-0" />
                            Outflow: -{hideBalances ? '••••' : formatETB(w.totalOut, true)}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
                          <span className="text-slate-500 dark:text-[#8899BB] truncate max-w-[280px] hidden sm:inline">
                            {w.expensesSummary}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Net Result & Ending Balance */}
                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pl-11 md:pl-0 border-t md:border-t-0 border-slate-200/50 dark:border-[#1E2D40] pt-2 md:pt-0">
                      <div className="text-left md:text-right">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Weekly Net</span>
                        <span className={`text-xs font-mono font-black ${
                          w.netFlow >= 0 ? 'text-emerald-600 dark:text-[#00D4AA]' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {w.netFlow >= 0 ? '+' : ''}{hideBalances ? '••••' : formatETB(w.netFlow)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Projected End Balance</span>
                        <span className="text-xs sm:text-sm font-mono font-black text-slate-900 dark:text-white">
                          {hideBalances ? '••••••••' : formatETB(w.endBal)}
                        </span>
                      </div>

                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-emerald-500' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Trajectory Breakdown with Incomes & Expenses Descriptions */}
                  {isExpanded && (
                    <div className="p-3.5 sm:p-4 bg-slate-100/70 dark:bg-[#111722] border-t border-slate-200/80 dark:border-[#1C2638] space-y-3.5 text-xs">
                      {/* Trajectory Header Banner */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 sm:p-3 rounded-xl bg-white dark:bg-[#161F2E] border border-slate-200/70 dark:border-[#1E2D40]">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {w.label} ({w.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {w.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-slate-500 dark:text-slate-400">Opening: <strong className="text-slate-800 dark:text-slate-200">{hideBalances ? '••••' : formatETB(w.startBal, true)}</strong></span>
                          <span className="text-slate-400">➔</span>
                          <span className="text-slate-500 dark:text-slate-400">Ending: <strong className="text-emerald-600 dark:text-[#00D4AA]">{hideBalances ? '••••' : formatETB(w.endBal, true)}</strong></span>
                        </div>
                      </div>

                      {/* Opportunity Status Callout */}
                      {w.loanOpportunityPaid > 0 ? (
                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-300">
                          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-[#00D4AA] shrink-0" />
                          <span>
                            <strong>Surplus Loan Payment:</strong> Operating surplus (+{formatETB(w.operatingSurplus, true)}) paid <strong>{formatETB(w.loanOpportunityPaid, true)}</strong> toward flexible loans.
                          </span>
                        </div>
                      ) : w.loanOpportunityDeferred > 0 ? (
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300">
                          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>
                            <strong>Loans Deferred:</strong> Surplus is under ETB 1,000; loan payment of {formatETB(w.loanOpportunityDeferred, true)} deferred to protect bills and Equb.
                          </span>
                        </div>
                      ) : null}

                      {/* 2-Column Responsive Grid: Incomes (Left) & Expenses (Right) */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                        {/* 1. PROJECTED INCOMES WITH DESCRIPTIONS */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-[#00D4AA]">
                              <ArrowUpRight className="w-4 h-4 shrink-0" />
                              <span className="text-xs font-black uppercase tracking-wider">Projected Incomes</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-[#00D4AA]">
                                {w.incomes.length} source
                              </span>
                            </div>
                            <span className="text-xs font-mono font-black text-emerald-600 dark:text-[#00D4AA]">
                              +{hideBalances ? '••••' : formatETB(w.projectedIncome)}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {w.incomes.map((inc) => (
                              <div
                                key={inc.id}
                                className="p-3 rounded-xl bg-white dark:bg-[#161E2C] border border-emerald-500/20 space-y-1.5 shadow-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {inc.title}
                                      </span>
                                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-[#00D4AA] border border-emerald-500/20">
                                        {inc.category}
                                      </span>
                                      <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1E2A3C] px-1.5 py-0.5 rounded">
                                        {inc.basis}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-xs font-mono font-black text-emerald-600 dark:text-[#00D4AA] shrink-0">
                                    +{hideBalances ? '••••' : formatETB(inc.amount)}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#121824] p-2 rounded-lg border border-slate-200/50 dark:border-[#1E2D40]">
                                  {inc.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 2. SCHEDULED EXPENSES WITH DESCRIPTIONS */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between pb-1.5 border-b border-rose-500/20">
                            <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                              <ArrowDownLeft className="w-4 h-4 shrink-0" />
                              <span className="text-xs font-black uppercase tracking-wider">Scheduled Expenses & Commitments</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                {w.expenses.length} item{w.expenses.length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <span className="text-xs font-mono font-black text-rose-600 dark:text-rose-400">
                              -{hideBalances ? '••••' : formatETB(w.totalOut)}
                            </span>
                          </div>

                          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                            {w.expenses.map((exp) => (
                              <div
                                key={exp.id}
                                className={`p-3 rounded-xl border space-y-1.5 shadow-xs transition-all ${
                                  exp.isExempt
                                    ? 'bg-amber-50/50 dark:bg-[#1C1A16] border-amber-300/60 dark:border-amber-700/40 opacity-80'
                                    : exp.opportunityStatus === 'DEFERRED_NO_SURPLUS'
                                    ? 'bg-amber-50/30 dark:bg-amber-950/10 border-amber-300/40 dark:border-amber-800/40 opacity-75'
                                    : 'bg-white dark:bg-[#161E2C] border-slate-200/80 dark:border-[#1E2D40]'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`text-xs font-bold ${exp.isExempt ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                        {exp.title}
                                      </span>

                                      {/* Obligation Type & Priority Badges */}
                                      {exp.isMandatory ? (
                                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-[#00D4AA] border border-emerald-500/30">
                                          Mandatory
                                        </span>
                                      ) : (
                                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                          exp.opportunityStatus === 'PAID_FROM_SURPLUS'
                                            ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                        }`}>
                                          Flexible Loan
                                        </span>
                                      )}

                                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                        exp.type === 'LOAN'
                                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                          : exp.type === 'EQUB'
                                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                                          : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20'
                                      }`}>
                                        {exp.category}
                                      </span>

                                      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-[#1E2A3C] px-1.5 py-0.5 rounded">
                                        {exp.frequency} • {exp.walletName}
                                      </span>

                                      {exp.isExempt && (
                                        <span className="text-[9px] font-extrabold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">
                                          Pagumē Waived
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-xs font-mono font-black shrink-0 ${
                                    exp.isExempt
                                      ? 'text-slate-400 line-through'
                                      : exp.opportunityStatus === 'DEFERRED_NO_SURPLUS'
                                      ? 'text-amber-600 dark:text-amber-400 font-medium'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}>
                                    {exp.opportunityStatus === 'DEFERRED_NO_SURPLUS' ? 'Deferred (0)' : `-${hideBalances ? '•••' : formatETB(exp.amount)}`}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#121824] p-2 rounded-lg border border-slate-200/50 dark:border-[#1E2D40]">
                                  {exp.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Trajectory & Ending Balance Mathematical Equation Bar */}
                      <div className="p-3 rounded-xl bg-slate-200/60 dark:bg-[#182232] border border-slate-300/70 dark:border-[#223044] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Trajectory Formula:</span>
                          <span className="font-mono text-slate-600 dark:text-slate-400">
                            Start ({hideBalances ? '••••' : formatETB(w.startBal, true)})
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-[#00D4AA] font-mono">
                            + Inflow ({hideBalances ? '••••' : formatETB(w.projectedIncome, true)})
                          </span>
                          <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                            - Mandatory ({hideBalances ? '••••' : formatETB(w.mandatoryOut, true)})
                          </span>
                          <span className="font-bold text-slate-400">=</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            Surplus ({hideBalances ? '••••' : formatETB(w.operatingSurplus, true)})
                          </span>
                          {w.loanOpportunityPaid > 0 && (
                            <>
                              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                                - Loan Paid ({hideBalances ? '••••' : formatETB(w.loanOpportunityPaid, true)})
                              </span>
                              <span className="font-bold text-slate-400">=</span>
                            </>
                          )}
                          <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                            Net {w.netFlow >= 0 ? '+' : ''}{hideBalances ? '••••' : formatETB(w.netFlow)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Ending Balance:
                          </span>
                          <span className="text-sm font-mono font-black text-slate-900 dark:text-white bg-white dark:bg-[#131A26] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#1E2D40]">
                            {hideBalances ? '••••••••' : formatETB(w.endBal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: MONTHLY PROJECTION (12 MONTHS) */}
      {selectedPeriod === 'MONTHLY' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              12-Month Fiscal Forecast & Cumulative Balances
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-[#8899BB]">
              Includes 13th Month (Pagumē) Exemption Savings
            </span>
          </div>

          {/* 12-MONTH FISCAL TRAJECTORY SHORT SUMMARY CARD */}
          {monthlyTrajectorySummary && (
            <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-[#1E2D40] bg-slate-50/80 dark:bg-[#151C2A] space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    12-Month Trajectory Short Summary
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
                    Fiscal Annual View
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-[#8899BB]">
                  Starting: {hideBalances ? '••••' : formatETB(monthlyTrajectorySummary.startBal, true)}
                </div>
              </div>

              {/* 4-Stat Micro Highlights Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0E131F] border border-slate-200/70 dark:border-[#1C2638]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] block">
                    Net 12-Mo Change
                  </span>
                  <span className={`text-sm font-black font-mono block mt-0.5 ${
                    monthlyTrajectorySummary.netChange >= 0 ? 'text-emerald-600 dark:text-[#00D4AA]' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {monthlyTrajectorySummary.netChange >= 0 ? '+' : ''}{hideBalances ? '••••' : formatETB(monthlyTrajectorySummary.netChange, true)}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    {monthlyTrajectorySummary.pctChange > 0 ? '+' : ''}{monthlyTrajectorySummary.pctChange.toFixed(1)}% annual delta
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0E131F] border border-slate-200/70 dark:border-[#1C2638]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] block">
                    Projected Year-End
                  </span>
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white block mt-0.5">
                    {hideBalances ? '••••' : formatETB(monthlyTrajectorySummary.endBal, true)}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    Month 12 reserve
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0E131F] border border-slate-200/70 dark:border-[#1C2638]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] block">
                    Lowest Month Reserve
                  </span>
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-white block mt-0.5">
                    {hideBalances ? '••••' : formatETB(monthlyTrajectorySummary.lowestMonth.endBal, true)}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {monthlyTrajectorySummary.lowestMonth.ethMonthName}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0E131F] border border-slate-200/70 dark:border-[#1C2638]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] block">
                    Pagumē Exemption Saved
                  </span>
                  <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400 block mt-0.5">
                    {hideBalances ? '••••' : formatETB(monthlyTrajectorySummary.totalPagumeSavings, true)}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    13th Month holiday savings
                  </span>
                </div>
              </div>

              {/* Natural Language Summary */}
              <div className="p-2.5 rounded-lg bg-blue-500/5 dark:bg-[#111A26] border border-blue-500/20 text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  {monthlyTrajectorySummary.narrative}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthlyForecast.map((m) => {
              const isMonthExpanded = expandedMonthId === m.monthIndex;
              return (
                <div
                  key={m.monthIndex}
                  className={`p-4 rounded-xl border space-y-3 transition-all ${
                    m.isPagume
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80'
                      : 'bg-slate-50 dark:bg-[#151C2A] border-slate-200/80 dark:border-[#1C2638] hover:border-blue-500/40'
                  } ${isMonthExpanded ? 'md:col-span-2 lg:col-span-3 ring-2 ring-emerald-500/30' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        {m.ethMonthName} {m.ethYear}
                        {m.isPagume && (
                          <span className="text-[9px] font-bold bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded">
                            13th Month
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">{m.gregLabel}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${
                        m.netFlow >= 0
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-[#00D4AA]'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                      }`}>
                        {m.netFlow >= 0 ? '+' : ''}{hideBalances ? '•••' : formatETB(m.netFlow, true)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setExpandedMonthId(isMonthExpanded ? null : m.monthIndex);
                        }}
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-[#1E2D40] text-slate-500 dark:text-slate-400 transition-colors"
                        title={isMonthExpanded ? 'Collapse breakdown' : 'Expand detailed incomes and expenses'}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isMonthExpanded ? 'rotate-180 text-emerald-500' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Rows */}
                  <div className="space-y-1.5 text-xs border-y border-slate-200/60 dark:border-[#1E2D40] py-2">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                        Income:
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{hideBalances ? '••••' : formatETB(m.projectedIncome, true)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Repeat className="w-3.5 h-3.5 text-rose-500" />
                        Mandatory Bills:
                      </span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">
                        -{hideBalances ? '••••' : formatETB(m.recurringOut, true)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-purple-500" />
                        Mandatory Equb:
                      </span>
                      <span className={`font-mono ${m.equbOut > 0 ? 'text-purple-600 dark:text-purple-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
                        {m.equbOut > 0 ? `-${hideBalances ? '••••' : formatETB(m.equbOut, true)}` : 'Completed (0)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                        Flexible Loans:
                      </span>
                      <span className={`font-mono ${m.loansOut > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400'}`}>
                        {m.loansOut > 0 ? `-${hideBalances ? '••••' : formatETB(m.loansOut, true)} (surplus)` : 'Deferred (0)'}
                      </span>
                    </div>

                    {/* Quick Expense Highlights */}
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/40 dark:border-[#1E2D40]/60 flex items-center justify-between">
                      <span className="truncate max-w-[200px]">{m.expensesSummary}</span>
                      <span className="font-mono shrink-0 text-slate-400">{m.daysInMonth} days</span>
                    </div>

                    {m.isPagume && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 pt-1">
                        <Sparkles className="w-3 h-3" />
                        Saved {formatETB(m.pagumeExemptionSaved)} in waived fees!
                      </div>
                    )}
                  </div>

                  {/* Ending Balance Summary */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="text-slate-500 dark:text-[#8899BB] font-medium">Month-End Balance:</span>
                    <span className="font-mono font-black text-slate-900 dark:text-white">
                      {hideBalances ? '••••••••' : formatETB(m.endBal)}
                    </span>
                  </div>

                  {/* Detailed Incomes & Expenses Breakdown (when expanded) */}
                  {isMonthExpanded && (
                    <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-[#111722] border border-slate-200/80 dark:border-[#1C2638] space-y-3 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Detailed Monthly Cashflow Breakdown ({m.ethMonthName})
                        </span>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          Starting: <strong className="text-slate-800 dark:text-slate-200">{hideBalances ? '••••' : formatETB(m.startBal, true)}</strong>
                          {' ➔ '}
                          Ending: <strong className="text-emerald-600 dark:text-[#00D4AA]">{hideBalances ? '••••' : formatETB(m.endBal, true)}</strong>
                        </div>
                      </div>

                      {/* Opportunity Status Callout for Month */}
                      {m.loanOpportunityPaid > 0 ? (
                        <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-300">
                          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-[#00D4AA] shrink-0" />
                          <span>
                            <strong>Opportunity in the middle:</strong> Operating surplus of <span className="font-mono font-bold">+{formatETB(m.operatingSurplus, true)}</span> safely serviced <span className="font-mono font-bold">-{formatETB(m.loanOpportunityPaid, true)}</span> in flexible loan payments.
                          </span>
                        </div>
                      ) : m.loanOpportunityDeferred > 0 ? (
                        <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300">
                          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>
                            <strong>Mandatory obligations prioritized:</strong> Scheduled loans of <span className="font-mono font-bold">{formatETB(m.loanOpportunityDeferred, true)}</span> deferred in the middle to maintain mandatory recurring bills and Equb rotation.
                          </span>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Monthly Incomes */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-emerald-500/20 text-emerald-700 dark:text-[#00D4AA] font-bold text-xs">
                            <span className="flex items-center gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              Projected Incomes
                            </span>
                            <span className="font-mono">+{hideBalances ? '••••' : formatETB(m.projectedIncome)}</span>
                          </div>
                          {m.incomes.map((inc) => (
                            <div key={inc.id} className="p-2.5 rounded-lg bg-white dark:bg-[#161E2C] border border-emerald-500/20 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">{inc.title}</span>
                                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-[#00D4AA]">+{hideBalances ? '••••' : formatETB(inc.amount)}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#121824] p-1.5 rounded border border-slate-200/50 dark:border-[#1E2D40]">
                                {inc.description}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Monthly Expenses */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between pb-1 border-b border-rose-500/20 text-rose-700 dark:text-rose-400 font-bold text-xs">
                            <span className="flex items-center gap-1">
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              Scheduled Monthly Expenses
                            </span>
                            <span className="font-mono">-{hideBalances ? '••••' : formatETB(m.totalOut)}</span>
                          </div>
                          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                            {m.expenses.map((exp) => (
                              <div
                                key={exp.id}
                                className={`p-2.5 rounded-lg border space-y-1 ${
                                  exp.isExempt
                                    ? 'bg-amber-50/50 dark:bg-[#1C1A16] border-amber-300/60 opacity-80'
                                    : exp.opportunityStatus === 'DEFERRED_NO_SURPLUS'
                                    ? 'bg-amber-50/30 dark:bg-amber-950/10 border-amber-300/40 opacity-75'
                                    : 'bg-white dark:bg-[#161E2C] border-slate-200/80 dark:border-[#1E2D40]'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-xs font-bold ${exp.isExempt ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                      {exp.title}
                                    </span>
                                    {exp.isMandatory ? (
                                      <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-emerald-500/15 text-emerald-700 dark:text-[#00D4AA] border border-emerald-500/30">
                                        Mandatory
                                      </span>
                                    ) : (
                                      <span className={`text-[9px] font-extrabold uppercase px-1 rounded ${
                                        exp.opportunityStatus === 'PAID_FROM_SURPLUS'
                                          ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                      }`}>
                                        Flexible Loan
                                      </span>
                                    )}
                                    <span className="text-[9px] uppercase px-1 rounded bg-slate-100 dark:bg-[#1E2A3C] text-slate-600 dark:text-slate-400 font-mono">
                                      {exp.walletName}
                                    </span>
                                    {exp.isExempt && (
                                      <span className="text-[9px] font-bold bg-amber-500 text-slate-950 px-1 py-0.2 rounded">
                                        Pagumē Exempt
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-xs font-mono font-bold ${
                                    exp.isExempt
                                      ? 'line-through text-slate-400'
                                      : exp.opportunityStatus === 'DEFERRED_NO_SURPLUS'
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}>
                                    {exp.opportunityStatus === 'DEFERRED_NO_SURPLUS' ? 'Deferred (0)' : `-${hideBalances ? '•••' : formatETB(exp.amount)}`}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#121824] p-1.5 rounded border border-slate-200/50 dark:border-[#1E2D40]">
                                  {exp.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Mathematical Trajectory Equation for Month */}
                      <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-[#182232] border border-slate-300/70 dark:border-[#223044] flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Trajectory Formula:</span>
                          <span className="font-mono text-slate-600 dark:text-slate-400">Start ({hideBalances ? '••••' : formatETB(m.startBal, true)})</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-[#00D4AA]">+ In ({hideBalances ? '••••' : formatETB(m.projectedIncome, true)})</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">- Mandatory ({hideBalances ? '••••' : formatETB(m.mandatoryOut, true)})</span>
                          <span className="font-bold text-slate-400">=</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">Surplus ({hideBalances ? '••••' : formatETB(m.operatingSurplus, true)})</span>
                          {m.loanOpportunityPaid > 0 && (
                            <>
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">- Loan Paid ({hideBalances ? '••••' : formatETB(m.loanOpportunityPaid, true)})</span>
                              <span className="font-bold text-slate-400">=</span>
                            </>
                          )}
                          <span className="font-mono font-bold text-slate-900 dark:text-white">Net {m.netFlow >= 0 ? '+' : ''}{hideBalances ? '••••' : formatETB(m.netFlow, true)}</span>
                        </div>
                        <div className="font-mono font-black text-slate-900 dark:text-white">
                          Ending: {hideBalances ? '••••••••' : formatETB(m.endBal)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: YEARLY CALENDAR (ETHIOPIAN & GREGORIAN FISCAL CALENDAR) */}
      {selectedPeriod === 'YEARLY_CALENDAR' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-purple-500" />
              Annual Calendar Cashflow Grid (13 Ethiopian Months)
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-[#8899BB]">
              Select any month below to inspect day-to-day commitments
            </span>
          </div>

          {/* 13 Month Calendar Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {yearlyCalendarMonths.map((m) => {
              const isSelected = selectedCalendarMonth === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedCalendarMonth(m.id);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500 dark:border-[#00D4AA] text-slate-950 dark:text-white ring-1 ring-emerald-500/50'
                      : m.isPagume
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-slate-900 dark:text-white hover:border-amber-400'
                      : 'bg-slate-50 dark:bg-[#151C2A] border-slate-200/80 dark:border-[#1C2638] text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-[#223044]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">{m.nameEn}</span>
                    <span className="text-[10px] font-mono text-slate-400">{m.nameAm}</span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-[#8899BB]">
                    <span>{m.daysCount} Days</span>
                    <span className={m.isPagume ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>
                      {m.isPagume ? 'Month 13' : `M${m.id}`}
                    </span>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-[#1E2D40] flex items-center justify-between">
                    <span className="text-[9px] text-slate-400 uppercase font-bold">Net</span>
                    <span className={`text-[10px] font-mono font-black ${
                      m.netMonth >= 0 ? 'text-emerald-600 dark:text-[#00D4AA]' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {m.netMonth >= 0 ? '+' : ''}{hideBalances ? '•••' : formatETB(m.netMonth, true)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Month Detail Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#151C2A] border border-slate-200/80 dark:border-[#1C2638] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-[#1E2D40] pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                  {selectedMonthData.id}
                </div>
                <div>
                  <h5 className="text-sm font-black text-slate-900 dark:text-white">
                    {selectedMonthData.nameEn} ({selectedMonthData.nameAm}) Financial Plan
                  </h5>
                  <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">
                    Duration: {selectedMonthData.daysCount} Calendar Days • {selectedMonthData.isPagume ? '13th Month Rules Apply' : 'Full Ethiopian Operating Month'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-slate-500 dark:text-[#8899BB]">Expected Month Surplus:</span>
                <span className="font-mono font-black text-emerald-600 dark:text-[#00D4AA]">
                  +{hideBalances ? '••••••' : formatETB(selectedMonthData.netMonth)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#1A2232] border border-slate-200/60 dark:border-[#223044]">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Projected Inflow</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                  +{hideBalances ? '••••' : formatETB(selectedMonthData.monthIncome)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-[#1A2232] border border-slate-200/60 dark:border-[#223044]">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Recurring Bills</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  -{hideBalances ? '••••' : formatETB(selectedMonthData.recurringBill)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-[#1A2232] border border-slate-200/60 dark:border-[#223044]">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Equb Allocation</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  -{hideBalances ? '••••' : formatETB(selectedMonthData.equbBill)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-[#1A2232] border border-slate-200/60 dark:border-[#223044]">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Loan Installments</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  -{hideBalances ? '••••' : formatETB(selectedMonthData.loanBill)}
                </span>
              </div>
            </div>

            {selectedMonthData.isPagume && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
                <span>
                  <strong>13th Month Exemption:</strong> During Pagumē, all Equb contributions, rent, and loan payments are waived. Only electricity remains payable, delivering an automatic cash buffer boost!
                </span>
              </div>
            )}
          </div>

          {/* Full Fiscal Year 1 Outlook vs Year 2 */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-[#151C2A] text-white border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <h5 className="text-xs font-black uppercase tracking-wider text-white">
                  Annual Fiscal Cash Runway (12-Month Aggregation)
                </h5>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                Run-Rate Projected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Annual Income (1Y)</span>
                <span className="text-sm font-black font-mono text-emerald-400">
                  {hideBalances ? '••••••••' : formatETB(currentWeekStats.yearlyIncomeRunRate)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Annual Obligations (1Y)</span>
                <span className="text-sm font-black font-mono text-rose-400">
                  {hideBalances ? '••••••••' : formatETB(obligationsStats.totalYearlyObligations)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Year-End Capital Addition</span>
                <span className={`text-sm font-black font-mono ${
                  netYearly >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {netYearly >= 0 ? '+' : ''}{hideBalances ? '••••••••' : formatETB(netYearly)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
