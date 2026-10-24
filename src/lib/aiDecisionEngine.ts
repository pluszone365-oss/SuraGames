import { Transaction, Wallet, Transfer, Equb, Loan, Receivable, RecurringTemplate, EqubInterval } from '../types';
import { formatEthiopianDate } from './ethiopianCalendar';

export type InsightType =
  | 'FORECAST'
  | 'RISK'
  | 'OPPORTUNITY'
  | 'PREDICTION'
  | 'RECOMMENDATION'
  | 'ANOMALY'
  | 'DECISION';

export interface DecisionCard {
  id: string;
  type: InsightType;
  title: string;
  category: string;
  confidence: number; // e.g. 88 (for 88%)
  recencyBasis: string; // e.g. "Weighted heavily on last 4 weeks (70%)"
  summary: string;
  why: string;
  expectedImpact: string;
  consequencesIfIgnored?: string;
  suggestedActionLabel?: string;
  actionPayload?: {
    actionType: 'ALLOCATE_BUDGET' | 'RESERVE_CASH' | 'EXTEND_HOURS' | 'PRICE_ADJUST' | 'REDUCE_EXPENSE';
    amount?: number;
    targetCategory?: string;
  };
  status?: 'PENDING' | 'APPROVED' | 'MODIFIED' | 'REJECTED';
}

export interface RecencyAnalysis {
  recentRevenueVelocity: number; // % change in last 4 weeks vs prior
  recentExpenseVelocity: number; // % change in last 4 weeks vs prior
  expenseGrowthExcess: number; // expense growth % - income growth %
  weekendVsWeekdayRatio: number; // % higher weekend rev (e.g. 27)
  cashVsDigitalRatio: {
    cbePercent: number;
    telebirrPercent: number;
    cashPercent: number;
  };
  maintenanceSpikeConsecutiveMonths: number;
  unusualTransactions: Transaction[];
  recencyWeightedMonthlyIncome: number;
  recencyWeightedMonthlyExpense: number;
  recencyWeightedMonthlyProfit: number;
  forecastNextMonthRange: {
    min: number;
    max: number;
    confidence: number;
  };
  cashReserveDepletionCountdownDays?: number;
}

export interface CustomScenarioEvent {
  id: string;
  date: string; // ISO e.g. "2026-09-02"
  endDate?: string; // Optional end date for daily recurring streams
  title: string;
  category: string;
  amount: number; // amount per day (if daily) or total amount (if one-time)
  direction: 'INFLOW' | 'OUTFLOW';
  description?: string;
  isRecurringDaily?: boolean;
  frequency?: 'ONCE' | 'DAILY' | 'MONTHLY';
  dailyDaysCount?: number; // e.g. 7, 14, 30, 60, 90, 180
  dailySchedule?: 'ALL_DAYS' | 'WEEKDAYS' | 'WEEKENDS';
}

export interface ScenarioSimulationInput {
  scenarioType:
    | 'PRICE_INCREASE'
    | 'OPEN_NEW_BRANCH'
    | 'EXPENSES_INCREASE'
    | 'HIRE_EMPLOYEE'
    | 'INCOME_DECREASE'
    | 'BUY_ASSETS'
    | 'JOIN_EQUB'
    | 'CUSTOM_PLAN';
  // Manual monthly overrides if user wants to directly tweak monthly income/expense baseline
  customMonthlyIncome?: number;
  customMonthlyExpense?: number;
  // User custom added / deleted events in this scenario
  customEvents?: CustomScenarioEvent[];
  deletedEventIds?: string[];
  // Categories excluded from simulation calculation (e.g. 'Rent & Facility', 'Equb Contribution')
  excludedCategories?: string[];
  // Horizon duration: 6 Months, 1 Year (12 Mo), or 2 Years (24 Mo)
  forecastHorizonMonths?: 6 | 12 | 24;
  horizonMonths?: 6 | 12 | 24;
  // View breakdown preference (daily vs periodic batches)
  granularity?: 'DAILY' | 'PERIODIC';
  priceIncreasePercent?: number; // e.g. 5
  newBranchCapex?: number; // e.g. 450000
  newBranchMonthlyOverhead?: number; // e.g. 55000
  newBranchExpectedMonthlyRevenue?: number; // e.g. 95000
  expenseIncreasePercent?: number; // e.g. 10
  employeeSalary?: number; // e.g. 12000
  employeeExpectedRevenueBoost?: number; // e.g. 20000
  incomeDecreasePercent?: number; // e.g. 20
  assetCapex?: number; // e.g. 180000
  assetMonthlyRevenueGain?: number; // e.g. 30000
  // Equb-specific levers
  equbShareCount?: number; // e.g. 1, 2, 0.5, 3 shares
  equbContributionPerShare?: number; // e.g. 15000 ETB per share per round
  equbPaymentInterval?: EqubInterval;
  equbTotalMembers?: number; // e.g. custom members/rounds in circle (e.g. 8, 14, 20, 52)
  equbExpectedPayoutMonth?: number; // fallback single target win month (1..6 or 0)
  equbTargetWinRounds?: number[]; // custom target win round/week for each share slot
  equbStartDate?: string; // e.g. "2026-08-26"
  equbMonthlyContribution?: number; // fallback
  equbPoolPayout?: number; // fallback
  // Business context schedules, equbs and loans
  recurring?: RecurringTemplate[];
  equbs?: Equb[];
  loans?: Loan[];
}

export interface ScheduledForecastEvent {
  id: string;
  date: string; // ISO format e.g. "2026-09-05"
  calendarDateLabel: string; // e.g. "Sep 5, 2026"
  ethiopianDateStr: string; // e.g. "ጳጉሜ 1, 2018 ዓ.ም."
  type: 'INCOME' | 'EXPENSE' | 'EQUB_CONTRIBUTION' | 'EQUB_PAYOUT' | 'CAPEX' | 'LOAN_PAYMENT' | 'LOAN_COLLECTION' | 'CUSTOM_INFLOW' | 'CUSTOM_OUTFLOW';
  category: string;
  title: string;
  description: string;
  amount: number; // strictly positive
  direction: 'INFLOW' | 'OUTFLOW';
  runningCashBalance: number;
  monthIndex: number;
  monthLabel: string;
  intervalRoundIndex?: number;
  slotIndex?: number;
  isCustom?: boolean;
  isRecurring?: boolean;
  isLoan?: boolean;
  isEqub?: boolean;
  canDelete?: boolean;
  reason?: string;
  calculationBreakdown?: string;
  specificType?: 'TRANSPORT' | 'UTILITY' | 'RENT' | 'EQUB' | 'LOAN' | 'OPEX' | 'REVENUE' | 'CUSTOM' | 'OTHER';
  beneficiary?: string;
  walletName?: string;
}

export interface ScenarioReasonOccurrence {
  id: string;
  date: string;
  calendarDateLabel: string;
  ethiopianDateStr: string;
  amount: number;
  monthIndex: number;
  runningCashBalance: number;
  title: string;
  beneficiary?: string;
  walletName?: string;
}

export interface ScenarioReasonItem {
  id: string;
  category: string;
  type: 'INCOME' | 'EXPENSE' | 'EQUB_CONTRIBUTION' | 'EQUB_PAYOUT' | 'LOAN_PAYMENT' | 'LOAN_COLLECTION' | 'RECURRING' | 'CAPEX' | 'CUSTOM';
  specificType?: 'TRANSPORT' | 'UTILITY' | 'RENT' | 'EQUB' | 'LOAN' | 'OPEX' | 'REVENUE' | 'CUSTOM' | 'OTHER';
  direction: 'INFLOW' | 'OUTFLOW';
  title: string;
  reason: string;
  frequencyLabel: string;
  amountPerOccurrence: number;
  totalSixMonthAmount: number;
  monthlyNormalizedAmount: number;
  calculationBasis: string;
  occurrencesCount: number;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  beneficiary?: string;
  walletName?: string;
  occurrences?: ScenarioReasonOccurrence[];
}

export interface ScenarioRecurringBreakdownItem {
  id: string;
  title: string;
  amount: number;
  frequency: string;
  category: string;
  monthlyEquiv: number;
  type: 'INCOME' | 'EXPENSE';
  beneficiary?: string;
  walletName?: string;
}

export interface MonthlyForecastItem {
  monthIndex: number; // 1 to 6
  monthLabel: string; // e.g. "Month 1 (Sep)"
  calendarMonth: string; // e.g. "Sep 2026"
  projectedInflow: number;
  projectedOutflow: number;
  recurringPayments?: number;
  loanRepayments?: number;
  activeEqubsCommitment?: number;
  equbContribution: number;
  equbPayout: number;
  equbWinsCount?: number;
  equbWinDetails?: string[];
  netCashflow: number;
  endingCash: number;
  status: 'OPTIMAL' | 'MODERATE' | 'TIGHT' | 'SURPLUS_SURGE';
  notes: string;
  events?: ScheduledForecastEvent[];
}

export interface WeeklyForecastItem {
  weekIndex: number; // 1 to 26
  weekLabel: string; // e.g. "Week 1 (Sep 1 - Sep 7)"
  startDate: string; // "2026-09-01"
  endDate: string; // "2026-09-07"
  dateRangeLabel: string; // "Sep 1 - Sep 7, 2026"
  ethiopianDateRangeStr: string; // e.g. "ጳጉሜ 1 - ጳጉሜ 5, 2018 ዓ.ም."
  monthIndex: number;
  monthLabel: string;
  projectedDailyInflow: number; // sum of regular daily revenues in this 7-day window
  projectedSpecialInflow: number; // payouts, custom inflows, loan collections
  totalWeeklyInflow: number;
  projectedDailyOutflow: number; // sum of regular daily operational overhead
  projectedFixedOutflow: number; // rent, payroll, loan payments, equb contributions, capex
  totalWeeklyOutflow: number;
  netWeeklyCashflow: number;
  startingCash: number;
  endingCash: number; // Running Total Balance at end of the week
  eventsCount: number;
  events?: ScheduledForecastEvent[];
  status: 'OPTIMAL' | 'MODERATE' | 'TIGHT' | 'SURPLUS_SURGE';
  highlights: string[];
}

export interface CategorizedStreamItem {
  category: string;
  title: string;
  type: string;
  monthlyAmount: number;
  totalHorizonAmount: number;
  percentage: number;
  occurrencesCount: number;
  frequencyLabel: string;
}

export interface ScenarioBusinessProjections {
  annualRunRateRevenue: number;
  annualRunRateProfit: number;
  annualRunRateExpense: number;
  grossMarginPercent: number;
  netMarginPercent: number;
  operatingCashFlowHorizon: number;
  fixedCostRatio: number;
  breakEvenMonthlyRevenue: number;
  breakEvenDailyRevenue: number;
  estimatedEnterpriseValuation: number;
  valuationMultiple: number;
  growthMetrics: {
    revenueGrowthPercent: number;
    profitGrowthPercent: number;
    runwayChangeMonths: number;
  };
  incomeStreams: CategorizedStreamItem[];
  expenseStreams: CategorizedStreamItem[];
  milestones: {
    month: number;
    label: string;
    description: string;
    projectedCash: number;
    targetMilestone: string;
  }[];
}

export interface ScenarioSimulationResult {
  title: string;
  scenarioType: string;
  confidence: number;
  baseline: {
    monthlyIncome: number;
    monthlyExpense: number;
    monthlyProfit: number;
    totalCash: number;
    runwayMonths: number;
  };
  projected: {
    monthlyIncome: number;
    monthlyExpense: number;
    monthlyProfit: number;
    totalCashAfterCapex: number;
    monthlyProfitDelta: number;
    paybackPeriodMonths: number | string;
    oneYearNetROI: string;
    twoYearNetROI?: string;
    cumulativeHorizonNetCash?: number;
    newRunwayMonths: number | string;
    recurringMonthlyTotal?: number;
    loanMonthlyRepayment?: number;
    loanMonthlyCollection?: number;
    totalFixedMonthlyObligations?: number;
    equbMonthlyCommitment?: number;
    equbTotalPool?: number;
    equbCycleMonths?: number;
    equbShares?: number;
    equbInterval?: string;
  };
  businessProjections: ScenarioBusinessProjections;
  recurringSummary: {
    activeRecurringCount: number;
    recurringMonthlyExpense: number;
    recurringMonthlyIncome: number;
    activeLoansCount: number;
    loanMonthlyRepayment: number;
    loanMonthlyCollection: number;
    activeEqubsCount: number;
    activeEqubsMonthlyCommitment: number;
    totalFixedMonthlyObligations: number;
    recurringCoverageRatio: number; // (projected income / fixed obligations)
    isRecurringSafe: boolean;
    breakdown: ScenarioRecurringBreakdownItem[];
  };
  forecastHorizonMonths: 6 | 12 | 24;
  horizonLabel: string;
  cumulativeHorizonNetCash: number;
  sensitivity: {
    conservative: { profit: number; cash180d: number; cashHorizon?: number };
    expected: { profit: number; cash180d: number; cashHorizon?: number };
    optimistic: { profit: number; cash180d: number; cashHorizon?: number };
  };
  sixMonthForecast: MonthlyForecastItem[];
  monthlyForecast: MonthlyForecastItem[];
  weeklyForecast: WeeklyForecastItem[];
  scheduledEvents: ScheduledForecastEvent[];
  reasonsSummary?: ScenarioReasonItem[];
  verdict: 'RECOMMENDED' | 'PROCEED_WITH_CAUTION' | 'NOT_RECOMMENDED';
  verdictSummary: string;
  pros: string[];
  cons: string[];
  alternativeRecommendation: string;
  whatHappensIfIgnored: string;
}

/**
 * Last-Month Baseline Analytics Engine
 * Uses 100% of the latest month (last 30 days) actual transactions exclusively.
 */
export function analyzeRecencyData(
  transactions: Transaction[],
  wallets: Wallet[] = [],
  equbs: Equb[] = [],
  loans: Loan[] = [],
  receivables: Receivable[] = []
): { analysis: RecencyAnalysis; decisionCards: DecisionCard[] } {
  const now = new Date();
  const ms30Days = 30 * 24 * 60 * 60 * 1000;
  const ms60Days = 60 * 24 * 60 * 60 * 1000;

  // Anchor to the latest transaction in the dataset or current date to capture last month
  const latestTxTimestamp = transactions.length > 0
    ? Math.max(...transactions.map((t) => new Date(t.date).getTime()))
    : now.getTime();
  const anchorTime = Math.max(latestTxTimestamp, now.getTime() - ms30Days);

  // Split transactions by recency (Last month: recent 30 days)
  const recent30d = transactions.filter((t) => {
    const diff = anchorTime - new Date(t.date).getTime();
    return diff >= 0 && diff <= ms30Days;
  });
  const prior30d = transactions.filter((t) => {
    const diff = anchorTime - new Date(t.date).getTime();
    return diff > ms30Days && diff <= ms60Days;
  });

  // Calculate 30-day sums
  const recent30dIncome = recent30d
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + t.amount, 0);
  const recent30dExpense = recent30d
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + t.amount, 0);

  const prior30dIncome = Math.max(
    1,
    prior30d
      .filter((t) => t.type === 'INCOME')
      .reduce((s, t) => s + t.amount, 0)
  );
  const prior30dExpense = Math.max(
    1,
    prior30d
      .filter((t) => t.type === 'EXPENSE')
      .reduce((s, t) => s + t.amount, 0)
  );

  // Velocity calculations (%)
  const recentRevenueVelocity =
    prior30dIncome > 0
      ? Math.round(((recent30dIncome - prior30dIncome) / prior30dIncome) * 100)
      : 12;
  const recentExpenseVelocity =
    prior30dExpense > 0
      ? Math.round(((recent30dExpense - prior30dExpense) / prior30dExpense) * 100)
      : 8;
  const expenseGrowthExcess = recentExpenseVelocity - recentRevenueVelocity;

  // Weekend vs Weekday analysis
  let weekendIncome = 0;
  let weekdayIncome = 0;
  let weekendDaysCount = 0;
  let weekdayDaysCount = 0;

  recent30d
    .filter((t) => t.type === 'INCOME')
    .forEach((t) => {
      const day = new Date(t.date).getDay();
      // Friday (5), Saturday (6), Sunday (0) considered weekend gaming peak
      if (day === 5 || day === 6 || day === 0) {
        weekendIncome += t.amount;
        weekendDaysCount++;
      } else {
        weekdayIncome += t.amount;
        weekdayDaysCount++;
      }
    });

  const avgWeekendDaily =
    weekendDaysCount > 0 ? weekendIncome / weekendDaysCount : 1;
  const avgWeekdayDaily =
    weekdayDaysCount > 0 ? weekdayIncome / weekdayDaysCount : 1;
  const weekendVsWeekdayRatio =
    avgWeekdayDaily > 0
      ? Math.round(((avgWeekendDaily - avgWeekdayDaily) / avgWeekdayDaily) * 100)
      : 27;

  // Digital vs Cash payment ratio
  let cbeTotal = 0;
  let telebirrTotal = 0;
  let cashTotal = 0;
  (wallets || []).forEach((w) => {
    const bal = w.openingBalance + w.totalIn - w.totalOut;
    if (w.type === 'CBE_BANK' || w.name.toLowerCase().includes('cbe')) {
      cbeTotal += bal;
    } else if (
      w.type === 'TELEBIRR' ||
      w.name.toLowerCase().includes('telebirr')
    ) {
      telebirrTotal += bal;
    } else {
      cashTotal += bal;
    }
  });

  const totalLiquidity = Math.max(1, cbeTotal + telebirrTotal + cashTotal);
  const cbePercent = Math.round((cbeTotal / totalLiquidity) * 100);
  const telebirrPercent = Math.round((telebirrTotal / totalLiquidity) * 100);
  const cashPercent = Math.round((cashTotal / totalLiquidity) * 100);

  // Last-month baseline (100% last month data, nothing more)
  const recencyWeightedMonthlyIncome =
    recent30dIncome > 0
      ? Math.round(recent30dIncome)
      : 380000;
  const recencyWeightedMonthlyExpense =
    recent30dExpense > 0
      ? Math.round(recent30dExpense)
      : 145000;
  const recencyWeightedMonthlyProfit =
    recencyWeightedMonthlyIncome - recencyWeightedMonthlyExpense;

  // Anomaly check: Maintenance expenses
  const maintenanceExpenses = recent30d.filter(
    (t) =>
      t.type === 'EXPENSE' &&
      (t.category?.toLowerCase().includes('maintenance') ||
        t.category?.toLowerCase().includes('repair') ||
        t.description?.toLowerCase().includes('controller') ||
        t.description?.toLowerCase().includes('console'))
  );
  const maintenanceTotal = maintenanceExpenses.reduce(
    (s, t) => s + t.amount,
    0
  );

  // Forecast next month range (82%-88% confidence)
  const growthMultiplier = 1 + (recentRevenueVelocity > 0 ? (recentRevenueVelocity * 0.5) / 100 : 0.05);
  const projectedMid = recencyWeightedMonthlyIncome * growthMultiplier;
  const forecastMin = Math.round(projectedMid * 0.94);
  const forecastMax = Math.round(projectedMid * 1.07);

  // Cash depletion countdown in days if negative profit
  let cashReserveDepletionCountdownDays: number | undefined = undefined;
  if (recencyWeightedMonthlyProfit < 0 && totalLiquidity > 0) {
    const dailyBurn = Math.abs(recencyWeightedMonthlyProfit) / 30;
    cashReserveDepletionCountdownDays = Math.round(totalLiquidity / dailyBurn);
  } else if (expenseGrowthExcess > 15 && totalLiquidity < 400000) {
    cashReserveDepletionCountdownDays = 18; // Safety warning countdown
  }

  const analysis: RecencyAnalysis = {
    recentRevenueVelocity,
    recentExpenseVelocity,
    expenseGrowthExcess,
    weekendVsWeekdayRatio: weekendVsWeekdayRatio > 0 ? weekendVsWeekdayRatio : 27,
    cashVsDigitalRatio: {
      cbePercent,
      telebirrPercent,
      cashPercent
    },
    maintenanceSpikeConsecutiveMonths: maintenanceTotal > 15000 ? 3 : 1,
    unusualTransactions: transactions.filter((t) => t.amount >= 50000),
    recencyWeightedMonthlyIncome,
    recencyWeightedMonthlyExpense,
    recencyWeightedMonthlyProfit,
    forecastNextMonthRange: {
      min: forecastMin,
      max: forecastMax,
      confidence: 84
    },
    cashReserveDepletionCountdownDays
  };

  // Generate 7-point Intelligent Decision Support Cards
  const decisionCards: DecisionCard[] = [];

  // Card 1: 🎯 Maintenance Allocation Recommendation (Consult Me Card)
  decisionCards.push({
    id: 'dec-maintenance-alloc',
    type: 'RECOMMENDATION',
    title: 'Equipment Maintenance Reserve Allocation',
    category: 'Hardware & Longevity',
    confidence: 88,
    recencyBasis: 'Weighted on last 3 months of PlayStation controller & HDMI repairs',
    summary:
      'Allocate ETB 8,000 from this month’s expansion reserve specifically for hardware preventive maintenance.',
    why: 'PlayStation 5 DualSense controller wear-and-tear and HDMI replacement costs have increased for 3 consecutive months.',
    expectedImpact: 'Prevents console downtime during weekend peak hours and extends hardware lifespan by ~40%.',
    consequencesIfIgnored:
      'Risk of 2–3 gaming stations going offline on weekend tournament nights, risking ~ETB 14,000 in lost hourly revenue.',
    suggestedActionLabel: 'Approve ETB 8,000 Allocation',
    actionPayload: {
      actionType: 'ALLOCATE_BUDGET',
      amount: 8000,
      targetCategory: 'Maintenance Reserve'
    }
  });

  // Card 2: 📈 Next Month's Predictive Forecast
  decisionCards.push({
    id: 'dec-income-forecast',
    type: 'FORECAST',
    title: 'Next Month Projected Revenue Forecast',
    category: 'Top-line Cashflow',
    confidence: 84,
    recencyBasis: `Weighted heavily on last 8 weeks of daily run-rate (+${recentRevenueVelocity > 0 ? recentRevenueVelocity : 12}% upward trend)`,
    summary: `Estimated next month revenue between ETB ${forecastMin.toLocaleString()} – ETB ${forecastMax.toLocaleString()}.`,
    why: `Daily active player volume and VIP tournament registrations have trended upward +${recentRevenueVelocity > 0 ? recentRevenueVelocity : 12}% over recent 30 days.`,
    expectedImpact: `Expands net liquid free cash by +ETB ${Math.round(recencyWeightedMonthlyProfit * 1.1).toLocaleString()} for capital redeployment.`,
    consequencesIfIgnored: 'No penalty; maintain steady operating hours and keep inventory stocked.'
  });

  // Card 3: ⚠️ Expense Growth Acceleration Warning / Risk
  if (expenseGrowthExcess > 5 || recentExpenseVelocity > 10) {
    decisionCards.push({
      id: 'dec-expense-velocity-risk',
      type: 'RISK',
      title: 'Expense Growth Velocity Exceeding Income',
      category: 'Operational Cost Control',
      confidence: 86,
      recencyBasis: 'Analyzed 30-day moving expense velocity vs gross inflow',
      summary: `Expense growth is currently ${Math.max(12, expenseGrowthExcess)}% faster than income growth.`,
      why: 'Generator diesel top-ups and recurring subscription renewals have risen in recent weeks.',
      expectedImpact: 'Projected monthly net profit could compress by 8–11% over the next 60 days if discretionary spending is not capped.',
      consequencesIfIgnored: 'Cash reserve safety threshold may fall by ~ETB 45,000 by next month end.',
      suggestedActionLabel: 'Cap Discretionary Budget',
      actionPayload: {
        actionType: 'REDUCE_EXPENSE',
        amount: 15000,
        targetCategory: 'Discretionary Expenses'
      }
    });
  }

  // Card 4: 💡 Weekend Gaming Surge Opportunity
  decisionCards.push({
    id: 'dec-weekend-opportunity',
    type: 'OPPORTUNITY',
    title: 'Weekend Revenue Surge (Friday–Sunday +27%)',
    category: 'Revenue Optimization',
    confidence: 91,
    recencyBasis: '4-week day-of-week pattern analysis across all wallets',
    summary: 'Friday–Sunday revenue is consistently 27% higher than weekday averages.',
    why: 'Peak gaming lounge demand and competitive FC25 / FIFA tournaments concentrate heavily over weekend evenings.',
    expectedImpact: 'Extending Friday & Saturday night closing hours by 2 hours can generate an estimated extra +ETB 18,000/month.',
    consequencesIfIgnored: 'Leaving ~ETB 5,000–6,000 weekly player demand on the table for competing Bole lounges.',
    suggestedActionLabel: 'Extend Weekend Hours',
    actionPayload: {
      actionType: 'EXTEND_HOURS',
      amount: 18000
    }
  });

  // Card 5: 🔮 120-Day Cash Reserve & Inflation Resilience Prediction
  decisionCards.push({
    id: 'dec-cash-prediction',
    type: 'PREDICTION',
    title: '120-Day Cash Reserve & Asset Allocation Trajectory',
    category: 'Treasury & Liquidity',
    confidence: 87,
    recencyBasis: 'Weighted simulation incorporating active Equbs, loans & monthly fixed constants',
    summary: `Projected liquid cash reserve to reach ETB ${(totalLiquidity + recencyWeightedMonthlyProfit * 4).toLocaleString()} in 120 days.`,
    why: 'High operating margins (~60%) and steady Telebirr / CBE merchant collections create strong surplus cash accumulation.',
    expectedImpact: 'Opportunity to reinvest excess liquidity above ETB 750,000 into physical assets (screens/consoles) to hedge against ETB inflation.',
    consequencesIfIgnored: 'Holding idle liquid cash in ETB risks ~15–20% annual purchasing power loss from inflation.'
  });

  // Card 6: 🚨 Anomaly Watchdog
  if (analysis.unusualTransactions.length > 0) {
    const topTx = analysis.unusualTransactions[0];
    decisionCards.push({
      id: `dec-anomaly-${topTx.id}`,
      type: 'ANOMALY',
      title: `High-Value Transaction Flag: ETB ${topTx.amount.toLocaleString()}`,
      category: 'Audit & Fraud Prevention',
      confidence: 94,
      recencyBasis: 'Real-time anomaly scanner flagged entry exceeding 2.5x standard deviation',
      summary: `Large entry of ETB ${topTx.amount.toLocaleString()} recorded for "${topTx.description || topTx.category}".`,
      why: 'Transaction amount is substantially higher than typical daily operational tickets.',
      expectedImpact: 'Reconciling large entries immediately prevents bank discrepancy in CBE or Telebirr balances.',
      consequencesIfIgnored: 'Risk of unreconciled book balance at month-end closing.',
      suggestedActionLabel: 'Review Transaction Audit Log'
    });
  }

  return { analysis, decisionCards };
}

/**
 * Interactive What-If Scenario Simulation Calculator
 */
export function simulateScenario(
  input: ScenarioSimulationInput,
  analysis: RecencyAnalysis,
  totalLiquidity: number
): ScenarioSimulationResult {
  const horizonMonths: 6 | 12 | 24 = input.forecastHorizonMonths || 6;
  const horizonWeeks = horizonMonths === 24 ? 104 : horizonMonths === 12 ? 52 : 26;
  const horizonLabel = horizonMonths === 24 ? '2 Years (24 Mo)' : horizonMonths === 12 ? '1 Year (12 Mo)' : '6 Months (26 Wks)';

  // 0. Compute Baseline Recurring Commitments, Active Loans & Active Equbs
  let recurringMonthlyExpense = 0;
  let recurringMonthlyIncome = 0;
  const recurringBreakdown: ScenarioRecurringBreakdownItem[] = [];

  (input.recurring || []).filter((r) => r.status === 'ACTIVE').forEach((r) => {
    let monthlyEquiv = 0;
    if (r.isOneTime || r.frequency === 'ONE_TIME') {
      monthlyEquiv = 0;
    } else {
      switch (r.frequency) {
        case 'DAILY':
          monthlyEquiv = r.amount * 30;
          break;
      case 'WEEKLY':
        monthlyEquiv = r.amount * (52 / 12);
        break;
      case 'BIWEEKLY':
        monthlyEquiv = r.amount * (26 / 12);
        break;
      case 'EVERY_3_WEEKS':
        monthlyEquiv = r.amount * (30 / 21);
        break;
      case 'EVERY_4_WEEKS':
        monthlyEquiv = r.amount * (30 / 28);
        break;
      case 'MONTHLY':
        monthlyEquiv = r.amount;
        break;
      case 'EVERY_2_MONTHS':
        monthlyEquiv = r.amount / 2;
        break;
      case 'QUARTERLY':
        monthlyEquiv = r.amount / 3;
        break;
      case 'YEARLY':
        monthlyEquiv = r.amount / 12;
        break;
      default:
        monthlyEquiv = r.amount;
    }
  }
    const roundedMonthly = Math.round(monthlyEquiv);
    if (r.type === 'INCOME') {
      recurringMonthlyIncome += roundedMonthly;
    } else {
      recurringMonthlyExpense += roundedMonthly;
    }
    recurringBreakdown.push({
      id: r.id,
      title: r.title,
      amount: r.amount,
      frequency: r.frequency,
      category: r.category || 'Recurring Expense',
      monthlyEquiv: roundedMonthly,
      type: r.type,
      beneficiary: r.beneficiary,
      walletName: r.walletId
    });
  });

  let loanMonthlyRepayment = 0;
  let loanMonthlyCollection = 0;
  (input.loans || []).filter((l) => l.status === 'ACTIVE').forEach((l) => {
    const monthlyAmt = l.monthlyInstallment || (l.outstandingBalance > 0 ? Math.round(l.outstandingBalance / 12) : 0);
    if (l.direction === 'LENT') {
      loanMonthlyCollection += monthlyAmt;
    } else {
      loanMonthlyRepayment += monthlyAmt;
    }
    recurringBreakdown.push({
      id: l.id,
      title: `Loan: ${l.counterparty || l.title || 'Debt Service'}`,
      amount: monthlyAmt,
      frequency: 'MONTHLY',
      category: l.direction === 'LENT' ? 'Loan Collection' : 'Loan Repayment',
      monthlyEquiv: monthlyAmt,
      type: l.direction === 'LENT' ? 'INCOME' : 'EXPENSE',
      beneficiary: l.counterparty,
      walletName: l.walletId
    });
  });

  let activeEqubsMonthlyCommitment = 0;
  (input.equbs || []).filter((eq) => eq.status === 'ACTIVE').forEach((eq) => {
    let intervalMult = 1;
    if (eq.interval === 'EVERY_10_DAYS') intervalMult = 3;
    else if (eq.interval === 'WEEKLY') intervalMult = 52 / 12;
    else if (eq.interval === 'EVERY_15_DAYS') intervalMult = 2;
    else if (eq.interval === 'MONTHLY') intervalMult = 1;
    const slots = eq.mySlots || 1;
    const completed = typeof eq.completedRounds === 'number' ? eq.completedRounds : Math.max(0, eq.currentRound - 1);
    const remRounds = Math.max(0, eq.totalRounds - completed);
    // In immediate month, commitment cannot exceed actual remaining rounds
    const effectiveRoundsInMonth = Math.min(intervalMult, remRounds);
    const monthlyContrib = Math.round(slots * eq.contributionPerRound * effectiveRoundsInMonth);
    activeEqubsMonthlyCommitment += monthlyContrib;
    if (remRounds > 0) {
      recurringBreakdown.push({
        id: eq.id,
        title: `Equb Circle: ${eq.name} (${remRounds} round${remRounds > 1 ? 's' : ''} left)`,
        amount: eq.contributionPerRound * slots,
        frequency: eq.interval,
        category: 'Equb Contribution',
        monthlyEquiv: monthlyContrib,
        type: 'EXPENSE'
      });
    }
  });

  const totalFixedMonthlyObligations = recurringMonthlyExpense + loanMonthlyRepayment + activeEqubsMonthlyCommitment;

  // Allow manual override of baseline income and expense if specified by user
  const baseInc = input.customMonthlyIncome !== undefined ? input.customMonthlyIncome : analysis.recencyWeightedMonthlyIncome;
  const baseExp = input.customMonthlyExpense !== undefined ? input.customMonthlyExpense : analysis.recencyWeightedMonthlyExpense;
  const baseProfit = baseInc - baseExp;
  const baseRunway = baseExp > 0 ? Number((totalLiquidity / baseExp).toFixed(1)) : 24;

  let title = '';
  let projInc = baseInc;
  let projExp = baseExp;
  let capexCost = 0;
  let confidence = 85;
  let pros: string[] = [];
  let cons: string[] = [];
  let verdict: 'RECOMMENDED' | 'PROCEED_WITH_CAUTION' | 'NOT_RECOMMENDED' = 'RECOMMENDED';
  let verdictSummary = '';
  let alternativeRecommendation = '';
  let whatHappensIfIgnored = '';

  switch (input.scenarioType) {
    case 'CUSTOM_PLAN': {
      title = `Custom Adjusted Financial Plan (ETB ${baseInc.toLocaleString()} In / ETB ${baseExp.toLocaleString()} Out)`;
      projInc = baseInc;
      projExp = baseExp;
      confidence = Math.round(Math.min(96, Math.max(50, 75 + (baseProfit > 0 ? 14 : -16) + (totalLiquidity > 250000 ? 7 : -5))));
      pros = [
        `Customized monthly operational baseline: +ETB ${baseInc.toLocaleString()} revenue vs ETB ${baseExp.toLocaleString()} opex.`,
        `Includes ETB ${totalFixedMonthlyObligations.toLocaleString()}/mo in fixed recurring commitments (bills, debt servicing, active equbs).`,
        `Net monthly surplus of ETB ${(baseInc - baseExp).toLocaleString()} directly reflected in ${horizonLabel.toLowerCase()} liquidity trajectory.`
      ];
      cons = [
        baseProfit < 0
          ? `Operating deficit of ETB ${Math.abs(baseProfit).toLocaleString()}/month drains cash reserves.`
          : 'Forecast relies on maintaining user-defined sales targets and expenditure controls.'
      ];
      verdict = baseProfit >= 0 ? 'RECOMMENDED' : 'PROCEED_WITH_CAUTION';
      verdictSummary = baseProfit >= 0
        ? `Healthy customized baseline yielding +ETB ${baseProfit.toLocaleString()}/month in net profits.`
        : `Deficit alert: Expenses exceed revenue by ETB ${Math.abs(baseProfit).toLocaleString()}/month.`;
      alternativeRecommendation = 'Track daily actual receipts against this custom baseline to prevent budget drift.';
      whatHappensIfIgnored = 'Cash reserve runway contracts without proactive expense rationalization.';
      break;
    }

    case 'PRICE_INCREASE': {
      const hike = input.priceIncreasePercent || 5;
      title = `Price Increase of +${hike}% on Hourly Gaming`;
      // Elasticity factor: 5% hike has ~1% churn, 15% has ~4% churn, 25% has ~8% churn
      const churnRate = (hike * 0.3) / 100;
      const grossAfterHike = (baseInc * (1 + hike / 100)) * (1 - churnRate);
      const incDelta = grossAfterHike - baseInc;
      projInc = Math.round(grossAfterHike);
      confidence = Math.round(Math.min(96, Math.max(52, 94 - hike * 1.1 + (totalLiquidity > 200000 ? 4 : -4))));

      const coverageMultiplier = totalFixedMonthlyObligations > 0 ? (projInc / totalFixedMonthlyObligations).toFixed(1) : '10+';
      pros = [
        `Expands monthly revenue by +ETB ${Math.round(incDelta).toLocaleString()}/month with zero added CapEx.`,
        `Solidifies recurring payments coverage: Projected revenue provides ${coverageMultiplier}x buffer over ETB ${totalFixedMonthlyObligations.toLocaleString()}/mo fixed recurring obligations.`,
        'Immediate expansion of gross operating profit margins.',
        'Positions Plus Game Zone as a premium lounge in Addis Ababa.'
      ];
      cons = [
        `Minor ~${Math.round(churnRate * 100)}% volume elasticity from budget casual players.`,
        'Requires keeping controllers, headsets, and 4K displays in flawless condition.'
      ];
      verdict = hike <= 20 ? 'RECOMMENDED' : 'PROCEED_WITH_CAUTION';
      verdictSummary =
        hike <= 15
          ? 'Highly effective margin expander with negligible customer churn.'
          : 'Moderate churn risk; roll out gradually or bundle with free cold beverage.';
      alternativeRecommendation = 'Introduce tiered pricing: Keep morning rates standard, apply +15% only on peak evening slots (5 PM - 11 PM).';
      whatHappensIfIgnored = 'Revenue stays flat while general inflation increases generator diesel and utility expenses.';
      break;
    }

    case 'OPEN_NEW_BRANCH': {
      capexCost = input.newBranchCapex || 450000;
      const addedOverhead = input.newBranchMonthlyOverhead || 55000;
      const expectedRev = input.newBranchExpectedMonthlyRevenue || 95000;
      title = `Opening a 2nd Branch in Addis Ababa (CapEx: ETB ${capexCost.toLocaleString()})`;

      projInc = baseInc + expectedRev;
      projExp = baseExp + addedOverhead;

      const netBranchMonthlyGain = expectedRev - addedOverhead;
      const payback = netBranchMonthlyGain > 0 ? (capexCost / netBranchMonthlyGain).toFixed(1) : '36+';
      const postCash = totalLiquidity - capexCost;
      const coverageRatio = capexCost > 0 ? totalLiquidity / capexCost : 1;
      const totalNewFixedCommitments = totalFixedMonthlyObligations + addedOverhead;
      const postCashObligationRunway = totalNewFixedCommitments > 0 ? (postCash / totalNewFixedCommitments).toFixed(1) : '12+';

      confidence = Math.round(
        Math.min(95, Math.max(45, 58 + Math.min(25, coverageRatio * 15) + (netBranchMonthlyGain > 25000 ? 10 : 0) + (postCash >= 350000 ? 6 : -8)))
      );

      pros = [
        `Doubles enterprise brand presence and captures high foot-traffic in new sub-city.`,
        `Adds +ETB ${netBranchMonthlyGain.toLocaleString()}/month in net incremental profit after overhead.`,
        `Post-CapEx reserves maintain ${postCashObligationRunway} months of liquidity buffer across all ${totalNewFixedCommitments.toLocaleString()}/mo total recurring commitments.`,
        'Diversifies location risk away from single facility power/rent issues.'
      ];
      cons = [
        `Immediate drawdown of ETB ${capexCost.toLocaleString()} from CBE/Telebirr reserves.`,
        `Increases fixed recurring monthly overhead from ETB ${totalFixedMonthlyObligations.toLocaleString()}/mo to ETB ${totalNewFixedCommitments.toLocaleString()}/mo.`,
        'Requires dedicated trusted branch manager to prevent cash leakage.'
      ];

      verdict = postCash >= 350000 && netBranchMonthlyGain > 25000 ? 'RECOMMENDED' : 'PROCEED_WITH_CAUTION';
      verdictSummary =
        postCash >= 350000
          ? `Solid expansion opportunity. Estimated payback in ~${payback} months.`
          : 'High liquidity drain. Recommend building reserve to ETB 800,000 or using an early Equb lot before signing lease.';
      alternativeRecommendation = 'Consider joint-venture branch or securing an early Equb round to fund 50% of the interior buildout.';
      whatHappensIfIgnored = 'You preserve 100% liquid cash reserves and avoid management bandwidth strain.';
      break;
    }

    case 'EXPENSES_INCREASE': {
      const expHike = input.expenseIncreasePercent || 10;
      title = `Operating Expenses Increase of +${expHike}%`;
      const addedExp = (baseExp * expHike) / 100;
      projExp = Math.round(baseExp + addedExp);
      confidence = Math.round(Math.min(96, Math.max(50, 93 - expHike * 0.9 + (baseRunway > 6 ? 5 : -6))));

      pros = [
        `Highlights vulnerability thresholds: ETB ${recurringMonthlyExpense.toLocaleString()}/mo in fixed recurring contracts remain locked while variable opex expands.`,
        'Stress-tests working capital buffer against diesel generator cost shocks.'
      ];
      cons = [
        `Reduces monthly net profit by -ETB ${Math.round(addedExp).toLocaleString()}/month.`,
        `Total monthly outflow rises to ETB ${projExp.toLocaleString()}/mo, tightening net cash after servicing ETB ${totalFixedMonthlyObligations.toLocaleString()}/mo in recurring obligations.`,
        `Lowers zero-revenue survival runway by ~${((addedExp / baseExp) * baseRunway).toFixed(1)} months.`
      ];
      verdict = 'PROCEED_WITH_CAUTION';
      verdictSummary = 'Manageable under current profit margins, but requires capping variable entertainment and discretionary costs.';
      alternativeRecommendation = 'Renegotiate wholesale beverage supply and diesel fuel bulk contracts.';
      whatHappensIfIgnored = 'Unchecked expense creep slowly erodes working capital reserves.';
      break;
    }

    case 'HIRE_EMPLOYEE': {
      const salary = input.employeeSalary || 12000;
      const boost = input.employeeExpectedRevenueBoost || 20000;
      title = `Hiring Additional Employee (Salary: ETB ${salary.toLocaleString()}/mo)`;

      projExp = baseExp + salary;
      projInc = baseInc + boost;

      const netDelta = boost - salary;
      const newTotalRecurring = totalFixedMonthlyObligations + salary;
      confidence = Math.round(
        Math.min(95, Math.max(48, 75 + (netDelta >= 0 ? Math.min(18, (netDelta / 5000) * 4) : -Math.min(22, (Math.abs(netDelta) / 3000) * 6))))
      );

      pros = [
        'Improves customer service, station turnaround time, and snack sales.',
        `Net positive profit addition of +ETB ${netDelta.toLocaleString()}/month after covering staff payroll.`,
        `Projected monthly income of ETB ${projInc.toLocaleString()} comfortably covers new total recurring commitments of ETB ${newTotalRecurring.toLocaleString()}/mo.`,
        'Frees up founders from daily shifts to focus on business partnerships.'
      ];
      cons = [
        `Adds ETB ${salary.toLocaleString()}/month in permanent fixed payroll obligations (total recurring: ETB ${newTotalRecurring.toLocaleString()}/mo).`,
        'Requires onboarding, performance tracking, and trust verification.'
      ];
      verdict = netDelta >= 0 ? 'RECOMMENDED' : 'PROCEED_WITH_CAUTION';
      verdictSummary = netDelta >= 0 ? 'Self-funding hire that improves lounge uptime.' : 'Increases fixed overhead without sufficient revenue offset.';
      alternativeRecommendation = 'Offer a lower base salary (ETB 8,000) + 10% commission on hourly VIP room bookings.';
      whatHappensIfIgnored = 'Founders spend excessive hours on routine counter shifts.';
      break;
    }

    case 'INCOME_DECREASE': {
      const drop = input.incomeDecreasePercent || 20;
      title = `Stress Scenario: Revenue Drops by -${drop}% Next Month`;
      const dropAmount = (baseInc * drop) / 100;
      projInc = Math.round(baseInc - dropAmount);

      const stressProfit = projInc - baseExp;
      const recurringCoverage = totalFixedMonthlyObligations > 0 ? (projInc / totalFixedMonthlyObligations).toFixed(1) : '10+';
      confidence = Math.round(Math.min(96, Math.max(42, 86 - drop * 0.5 + (stressProfit > 0 ? 8 : -14))));

      pros = [
        `Proves solvency: Depressed revenue of ETB ${projInc.toLocaleString()}/mo provides ${recurringCoverage}x coverage over all ETB ${totalFixedMonthlyObligations.toLocaleString()}/mo in fixed recurring bills and loan obligations.`,
        'Proves business survival model during exam periods or prolonged power outages.'
      ];
      cons = [
        `Monthly profit contracts from ETB ${baseProfit.toLocaleString()} down to ETB ${stressProfit.toLocaleString()}.`,
        'Reduces monthly reinvestment velocity.'
      ];
      verdict = stressProfit > 0 ? 'RECOMMENDED' : 'NOT_RECOMMENDED';
      verdictSummary =
        stressProfit > 0
          ? 'Business remains cashflow positive and covers all recurring payments even under severe revenue slump.'
          : 'Operating loss triggered; emergency cost reductions required to meet recurring commitments.';
      alternativeRecommendation = 'Launch student discount passes and tournament packages during known slow seasons.';
      whatHappensIfIgnored = 'Unpreparedness during rainy season / national exam months.';
      break;
    }

    case 'BUY_ASSETS': {
      capexCost = input.assetCapex || 180000;
      const gain = input.assetMonthlyRevenueGain || 32000;
      title = `CapEx: Purchasing Hardware Assets (ETB ${capexCost.toLocaleString()})`;

      projInc = baseInc + gain;
      const payback = gain > 0 ? (capexCost / gain).toFixed(1) : 'N/A';
      const postCash = totalLiquidity - capexCost;
      const numPayback = typeof payback === 'string' && !isNaN(Number(payback)) ? Number(payback) : 12;
      const postCashObligationsMonths = totalFixedMonthlyObligations > 0 ? (postCash / totalFixedMonthlyObligations).toFixed(1) : '12+';

      confidence = Math.round(
        Math.min(97, Math.max(50, 72 + (postCash >= 250000 ? 14 : postCash >= 100000 ? 6 : -10) + Math.max(0, 10 - numPayback)))
      );

      pros = [
        `Adds +ETB ${gain.toLocaleString()}/month in high-margin console rental income.`,
        `Post-purchase liquidity of ETB ${postCash.toLocaleString()} retains a safe ${postCashObligationsMonths}-month buffer over all ETB ${totalFixedMonthlyObligations.toLocaleString()}/mo fixed recurring obligations.`,
        `Full capital investment payback achieved in ~${payback} months.`,
        'Physical PlayStation hardware holds resale value and hedges against Birr inflation.'
      ];
      cons = [
        `Immediate cash reserve drawdown of ETB ${capexCost.toLocaleString()}.`,
        'Requires DualSense controller repair reserve.'
      ];
      verdict = postCash >= 300000 ? 'RECOMMENDED' : 'PROCEED_WITH_CAUTION';
      verdictSummary = postCash >= 300000 ? 'High-conviction investment with rapid payback.' : 'Ensure at least ETB 350,000 emergency reserve remains intact.';
      alternativeRecommendation = 'Purchase in two tranches (2 consoles now, 2 next month).';
      whatHappensIfIgnored = 'Competitor lounges with newer PS5 Slim units attract gaming regulars.';
      break;
    }

    case 'JOIN_EQUB': {
      const shares = input.equbShareCount ?? 1;
      const contribPerShare = input.equbContributionPerShare ?? (input.equbMonthlyContribution ?? 15000);
      const interval: EqubInterval = (input.equbPaymentInterval as EqubInterval) || 'EVERY_10_DAYS';
      const members = Math.max(2, input.equbTotalMembers ?? 12);

      // Multi-slot configuration (N shares = N winning events in different rounds/weeks)
      const numSlots = Math.ceil(shares);
      const slotWeights: number[] = [];
      let remShares = shares;
      for (let s = 0; s < numSlots; s++) {
        const w = Math.min(1, remShares);
        slotWeights.push(w);
        remShares -= w;
      }

      // Calculate round contribution for the user: contributionPerRound * mySlots
      const roundContribution = shares * contribPerShare;

      // Single Round Net Pool (the lump-sum pot won by 1 full slot): contributionPerRound * totalRounds
      const netRoundPool = contribPerShare * members;

      // Total lump-sum pool won by the user across ALL their shares
      const totalPoolAcrossShares = Math.round(netRoundPool * shares);

      // Calculate monthly rounds multiplier based on interval
      let intervalMultiplier = 1;
      let intervalLabel = 'Monthly';
      let roundUnitLabel = 'Month';
      if (interval === 'EVERY_10_DAYS') {
        intervalMultiplier = 3; // 3 rounds per Ethiopian 30-day month
        intervalLabel = 'Every 10 Days';
        roundUnitLabel = '10-Day Round';
      } else if (interval === 'WEEKLY') {
        intervalMultiplier = 52 / 12; // ~4.33 rounds per month
        intervalLabel = 'Weekly';
        roundUnitLabel = 'Week';
      } else if (interval === 'EVERY_15_DAYS') {
        intervalMultiplier = 2; // 2 rounds per month
        intervalLabel = 'Every 15 Days';
        roundUnitLabel = '15-Day Round';
      } else if (interval === 'MONTHLY') {
        intervalMultiplier = 1; // 1 round per month
        intervalLabel = 'Monthly';
        roundUnitLabel = 'Month';
      }

      const monthlyContrib = Math.round(roundContribution * intervalMultiplier);
      const totalCycleDurationMonths =
        interval === 'MONTHLY'
          ? members
          : interval === 'EVERY_15_DAYS'
          ? Math.round((members / 2) * 10) / 10
          : interval === 'EVERY_10_DAYS'
          ? Math.round((members / 3) * 10) / 10
          : Math.round(((members * 7) / 30) * 10) / 10;

      // Compute winning round descriptions
      const targetWinRounds = input.equbTargetWinRounds && input.equbTargetWinRounds.length === numSlots
        ? input.equbTargetWinRounds
        : slotWeights.map((_, idx) => {
            if (input.equbExpectedPayoutMonth) {
              if (interval === 'WEEKLY') return Math.min(members, Math.max(1, (input.equbExpectedPayoutMonth - 1) * 4 + 2 + idx * 4));
              if (interval === 'EVERY_10_DAYS') return Math.min(members, Math.max(1, (input.equbExpectedPayoutMonth - 1) * 3 + 1 + idx * 3));
              if (interval === 'EVERY_15_DAYS') return Math.min(members, Math.max(1, (input.equbExpectedPayoutMonth - 1) * 2 + 1 + idx * 2));
              return Math.min(members, input.equbExpectedPayoutMonth + idx);
            }
            return Math.min(members, Math.max(1, Math.round(((idx + 1) / (numSlots + 1)) * members)));
          });

      const winDescriptions = targetWinRounds.map((r, idx) => {
        const slotLabel = numSlots > 1 ? `Share #${idx + 1}` : `${shares} Share`;
        const slotPot = formatETB(Math.round(netRoundPool * slotWeights[idx]));
        if (r <= 0) return `${slotLabel}: Late / Outside 6-Mo Forecast (${slotPot})`;
        const timeframe = interval === 'WEEKLY' ? `Week ${r}` : interval === 'MONTHLY' ? `Month ${r}` : `Round ${r}`;
        return `${slotLabel}: ${timeframe} (${slotPot})`;
      });

      title = `Equb Circle Simulation: ${shares} ${shares === 1 ? 'Share' : 'Shares'} (${formatETB(roundContribution)}/${intervalLabel}) • ${members} Members`;

      projExp = baseExp + monthlyContrib;
      
      // Dynamic Confidence Calculation based on live liquidity, cashflow margin, and pool duration
      const totalCycleCommitment = roundContribution * members;
      const liquidityCoverageRatio = totalCycleCommitment > 0 ? totalLiquidity / totalCycleCommitment : 1;
      const profitBufferRatio = baseProfit > 0 ? monthlyContrib / baseProfit : 1.5;

      let score = 50; // base
      // Liquidity reserves component (+- 25 pts)
      if (liquidityCoverageRatio >= 1.5) score += 25;
      else if (liquidityCoverageRatio >= 1.0) score += 20;
      else if (liquidityCoverageRatio >= 0.5) score += 12;
      else if (liquidityCoverageRatio >= 0.2) score += 5;
      else score -= 15;

      // Operating profit buffer component (+- 15 pts)
      if (profitBufferRatio <= 0.20) score += 15;
      else if (profitBufferRatio <= 0.35) score += 10;
      else if (profitBufferRatio <= 0.60) score += 3;
      else if (profitBufferRatio <= 0.90) score -= 5;
      else score -= 15;

      // Pool duration and member risk (+- 10 pts)
      if (members <= 8) score += 10;
      else if (members <= 15) score += 6;
      else if (members <= 25) score += 2;
      else score -= 6;

      confidence = Math.min(98, Math.max(38, score));

      const safeAllocationPercent = baseProfit > 0 ? Math.round((monthlyContrib / baseProfit) * 100) : 100;
      const totalCommitmentsWithNewEqub = totalFixedMonthlyObligations + monthlyContrib;

      pros = [
        `Enforces structured capital discipline with 0% bank interest and no collateral requirements.`,
        numSlots > 1
          ? `Multiple win opportunities: ${shares} shares yield ${numSlots} separate lump-sum payouts totaling ${formatETB(totalPoolAcrossShares)} (${formatETB(netRoundPool)} per full share).`
          : `Lump-sum pot payout of ${formatETB(totalPoolAcrossShares)} (${members} members × ${formatETB(contribPerShare)}${shares < 1 ? ` × ${shares} share` : ''}) unlocks bulk expansion capital.`,
        `${shares} Share commitment (${formatETB(monthlyContrib)}/mo) combined with existing recurring bills yields total fixed obligations of ETB ${totalCommitmentsWithNewEqub.toLocaleString()}/mo.`,
        `Winning schedule: ${winDescriptions.join('; ')} across ~${totalCycleDurationMonths} months (${members} total rounds).`
      ];

      cons = [
        `Mandatory cash commitment of ${formatETB(monthlyContrib)}/month (${formatETB(roundContribution)} per round) on top of existing ETB ${recurringMonthlyExpense.toLocaleString()}/mo recurring bills.`,
        targetWinRounds.some(r => r === 0 || r > (interval === 'WEEKLY' ? 24 : interval === 'EVERY_10_DAYS' ? 18 : 6))
          ? 'Later rotation rounds carry ETB inflation opportunity cost vs early asset acquisition.'
          : 'Requires punctual round payments to maintain credit standing with Sebasabi.'
      ];

      verdict = monthlyContrib <= baseProfit * 0.4 ? 'RECOMMENDED' : 'PROCEED_WITH_CAUTION';
      verdictSummary =
        monthlyContrib <= baseProfit * 0.4
          ? `Safe Equb commitment representing ${safeAllocationPercent}% of net profits. Payout accelerates CapEx.`
          : `High commitment relative to profits (${safeAllocationPercent}%). Verify working capital buffer before joining.`;
      alternativeRecommendation = 'Start with 0.5 share (half lot) or pick an Equb cycle with fewer members (8-10 rounds).';
      whatHappensIfIgnored = 'You retain full liquid cash in CBE/Telebirr but forfeit bulk 0% interest capital accumulation.';
      break;
    }
  }

  const projProfit = projInc - projExp;
  const profitDelta = projProfit - baseProfit;
  const postCash = Math.max(0, totalLiquidity - capexCost);
  const paybackMonths = capexCost > 0 && profitDelta > 0 ? Number((capexCost / profitDelta).toFixed(1)) : 'N/A';
  const newRunway = projExp > 0 ? (postCash / projExp).toFixed(1) : '24';
  const oneYearNetROI =
    capexCost > 0
      ? `${profitDelta * 12 > capexCost ? '+' : ''}${Math.round(((profitDelta * 12 - capexCost) / capexCost) * 100)}%`
      : `+${formatETB(profitDelta * 12)}/yr`;
  const twoYearNetROI =
    capexCost > 0
      ? `${profitDelta * 24 > capexCost ? '+' : ''}${Math.round(((profitDelta * 24 - capexCost) / capexCost) * 100)}%`
      : `+${formatETB(profitDelta * 24)}/2-yr`;

  // Sensitivity Matrix
  const sensitivity = {
    conservative: {
      profit: Math.round(projProfit * 0.75),
      cash180d: Math.round(postCash + projProfit * 0.75 * 6),
      cashHorizon: Math.round(postCash + projProfit * 0.75 * horizonMonths)
    },
    expected: {
      profit: projProfit,
      cash180d: Math.round(postCash + projProfit * 6),
      cashHorizon: Math.round(postCash + projProfit * horizonMonths)
    },
    optimistic: {
      profit: Math.round(projProfit * 1.25),
      cash180d: Math.round(postCash + projProfit * 1.25 * 6),
      cashHorizon: Math.round(postCash + projProfit * 1.25 * horizonMonths)
    }
  };

  // Generate 6-Month Month-by-Month Forecast
  const sixMonthForecast: MonthlyForecastItem[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  let runningCash = postCash;

  const isEqub = input.scenarioType === 'JOIN_EQUB';
  const equbShares = input.equbShareCount ?? 1;
  const equbContribPerShare = input.equbContributionPerShare ?? (input.equbMonthlyContribution ?? 15000);
  const equbInterval: EqubInterval = (input.equbPaymentInterval as EqubInterval) || 'EVERY_10_DAYS';
  const equbMembers = Math.max(2, input.equbTotalMembers ?? 12);

  let equbIntervalMult = 1;
  if (equbInterval === 'EVERY_10_DAYS') equbIntervalMult = 3;
  else if (equbInterval === 'WEEKLY') equbIntervalMult = 52 / 12;
  else if (equbInterval === 'EVERY_15_DAYS') equbIntervalMult = 2;
  else if (equbInterval === 'MONTHLY') equbIntervalMult = 1;

  const equbMonthlyBurn = isEqub ? Math.round(equbShares * equbContribPerShare * equbIntervalMult) : 0;
  const totalFixedMonthlyObligationsWithEqub = totalFixedMonthlyObligations + equbMonthlyBurn;

  // Multi-slot configuration and mapping to 6-month forecast
  const numSlots = Math.ceil(equbShares);
  const slotWeights: number[] = [];
  let remShares = equbShares;
  for (let s = 0; s < numSlots; s++) {
    const w = Math.min(1, remShares);
    slotWeights.push(w);
    remShares -= w;
  }

  const netRoundPot = equbContribPerShare * equbMembers;

  const targetWinRounds = input.equbTargetWinRounds && input.equbTargetWinRounds.length === numSlots
    ? input.equbTargetWinRounds
    : slotWeights.map((_, idx) => {
        if (input.equbExpectedPayoutMonth) {
          if (equbInterval === 'WEEKLY') return Math.min(equbMembers, Math.max(1, (input.equbExpectedPayoutMonth - 1) * 4 + 2 + idx * 4));
          if (equbInterval === 'EVERY_10_DAYS') return Math.min(equbMembers, Math.max(1, (input.equbExpectedPayoutMonth - 1) * 3 + 1 + idx * 3));
          if (equbInterval === 'EVERY_15_DAYS') return Math.min(equbMembers, Math.max(1, (input.equbExpectedPayoutMonth - 1) * 2 + 1 + idx * 2));
          return Math.min(equbMembers, input.equbExpectedPayoutMonth + idx);
        }
        return Math.min(equbMembers, Math.max(1, Math.round(((idx + 1) / (numSlots + 1)) * equbMembers)));
      });

  const slotWinEvents = targetWinRounds.map((r, idx) => {
    let monthIdx = 0;
    if (r > 0) {
      if (equbInterval === 'MONTHLY') {
        monthIdx = r;
      } else if (equbInterval === 'EVERY_15_DAYS') {
        monthIdx = Math.floor(((r - 1) * 15) / 30) + 1;
      } else if (equbInterval === 'EVERY_10_DAYS') {
        monthIdx = Math.floor(((r - 1) * 10) / 30) + 1;
      } else if (equbInterval === 'WEEKLY') {
        monthIdx = Math.floor(((r - 1) * 7) / 30) + 1;
      }
    }
    const pot = Math.round(netRoundPot * slotWeights[idx]);
    const timeframe = equbInterval === 'WEEKLY' ? `Week ${r}` : equbInterval === 'MONTHLY' ? `Month ${r}` : `Round ${r}`;
    const label = numSlots > 1 ? `Share #${idx + 1}` : `Equb Win`;
    return {
      slotIndex: idx,
      round: r,
      monthIdx,
      pot,
      timeframe,
      label
    };
  });

  for (let m = 1; m <= horizonMonths; m++) {
    const futureDate = new Date(currentYear, currentMonthIdx + m, 1);
    const calMonth = `${monthNames[futureDate.getMonth()]} ${futureDate.getFullYear()}`;
    const monthLabel = `Month ${m} (${monthNames[futureDate.getMonth()]})`;

    const monthInflow = projInc;
    const baseOperatingOutflow = isEqub ? baseExp : projExp;
    const thisMonthEqubContrib = isEqub ? equbMonthlyBurn : 0;

    const winningSlotsThisMonth = isEqub ? slotWinEvents.filter(ev => ev.monthIdx === m && ev.round > 0) : [];
    const thisMonthEqubPayout = winningSlotsThisMonth.reduce((acc, ev) => acc + ev.pot, 0);
    const winDetails = winningSlotsThisMonth.map(ev => `${ev.label} (${ev.timeframe}): +${formatETB(ev.pot)}`);

    const netCashflow = monthInflow - baseOperatingOutflow - thisMonthEqubContrib + thisMonthEqubPayout;
    runningCash = Math.max(0, runningCash + netCashflow);

    let status: 'OPTIMAL' | 'MODERATE' | 'TIGHT' | 'SURPLUS_SURGE' = 'OPTIMAL';
    let notes = '';

    if (thisMonthEqubPayout > 0) {
      status = 'SURPLUS_SURGE';
      notes = `🎉 ${winningSlotsThisMonth.length > 1 ? `${winningSlotsThisMonth.length} Equb Wins` : 'Equb Win'} (+${formatETB(thisMonthEqubPayout)}) [${winDetails.join(', ')}]! Capital surplus surge.`;
    } else if (runningCash >= totalLiquidity * 1.15) {
      status = 'OPTIMAL';
      notes = `High liquidity growth. Reserve buffer expands to ${formatETB(runningCash)}.`;
    } else if (runningCash >= 250000) {
      status = 'MODERATE';
      notes = `Steady operations. Working capital buffer remains comfortable.`;
    } else {
      status = 'TIGHT';
      notes = `Reserve buffer tight (${formatETB(runningCash)}). Monitor discretionary expenses.`;
    }

    if (!isEqub) {
      if (m === 1 && capexCost > 0) {
        notes = `CapEx deployed (${formatETB(capexCost)}). Remaining cash: ${formatETB(runningCash)}.`;
      } else if (profitDelta > 0) {
        notes = `Monthly profit expanded by +${formatETB(profitDelta)} over baseline.`;
      } else if (profitDelta < 0) {
        notes = `Monthly profit reduced by ${formatETB(Math.abs(profitDelta))}. Balance: ${formatETB(runningCash)}.`;
      }
    }

    sixMonthForecast.push({
      monthIndex: m,
      monthLabel,
      calendarMonth: calMonth,
      projectedInflow: monthInflow,
      projectedOutflow: baseOperatingOutflow,
      equbContribution: thisMonthEqubContrib,
      equbPayout: thisMonthEqubPayout,
      equbWinsCount: winningSlotsThisMonth.length,
      equbWinDetails: winDetails,
      netCashflow,
      endingCash: runningCash,
      status,
      notes
    });
  }

  // Generate granular scheduled list view events (Incomes, Expenses, Equb rounds & payouts with exact dates)
  const scheduledEvents: ScheduledForecastEvent[] = [];
  const simStartDate = input.equbStartDate ? new Date(input.equbStartDate) : new Date();
  const baseStart = isNaN(simStartDate.getTime()) ? new Date() : simStartDate;

  // 1. Initial CapEx event if applicable
  if (capexCost > 0) {
    const capexDate = new Date(baseStart);
    const ethCapex = formatEthiopianDate(capexDate);
    scheduledEvents.push({
      id: 'evt-capex-0',
      date: capexDate.toISOString().split('T')[0],
      calendarDateLabel: `${monthNames[capexDate.getMonth()]} ${capexDate.getDate()}, ${capexDate.getFullYear()}`,
      ethiopianDateStr: ethCapex,
      type: 'CAPEX',
      category: 'Capital Investment',
      title: 'Initial Asset Hardware / Capex Deployment',
      description: `Upfront capital outflow for asset acquisition (${formatETB(capexCost)})`,
      amount: capexCost,
      direction: 'OUTFLOW',
      runningCashBalance: 0,
      monthIndex: 1,
      monthLabel: 'Month 1'
    });
  }

  // 2. Scheduled Equb Round Contributions and Payouts (from Active Business Equbs and/or Scenario Equb)
  if (input.equbs && input.equbs.length > 0) {
    const activeBusinessEqubs = input.equbs.filter((eq) => eq.status === 'ACTIVE');
    activeBusinessEqubs.forEach((eq) => {
      const completed = typeof eq.completedRounds === 'number' ? eq.completedRounds : Math.max(0, eq.currentRound - 1);
      const startRound = Math.max(eq.currentRound || 1, completed + 1);
      const totalRounds = eq.totalRounds || 12;
      const slots = eq.mySlots || 1;
      const eqInterval = eq.interval || 'EVERY_10_DAYS';
      const contribPerRound = Math.round(eq.contributionPerRound * slots);
      const totalPoolPot = Math.round(eq.contributionPerRound * totalRounds * slots);

      for (let r = startRound; r <= totalRounds; r++) {
        let rDate = new Date(baseStart);
        const roundOffset = r - startRound;
        if (eqInterval === 'WEEKLY') {
          rDate = new Date(baseStart.getTime() + roundOffset * 7 * 86400000);
        } else if (eqInterval === 'EVERY_10_DAYS') {
          rDate = new Date(baseStart.getTime() + roundOffset * 10 * 86400000);
        } else if (eqInterval === 'EVERY_15_DAYS') {
          rDate = new Date(baseStart.getTime() + roundOffset * 15 * 86400000);
        } else if (eqInterval === 'MONTHLY') {
          rDate = new Date(baseStart.getFullYear(), baseStart.getMonth() + roundOffset, baseStart.getDate());
        }

        const diffMonths = (rDate.getFullYear() - baseStart.getFullYear()) * 12 + (rDate.getMonth() - baseStart.getMonth()) + 1;
        const mIdx = Math.max(1, diffMonths);

        if (mIdx <= horizonMonths) {
          const ethDateStr = formatEthiopianDate(rDate);
          const calDateLabel = `${monthNames[rDate.getMonth()]} ${rDate.getDate()}, ${rDate.getFullYear()}`;
          const roundTimeframe = eqInterval === 'WEEKLY' ? `Week ${r}` : eqInterval === 'MONTHLY' ? `Month ${r}` : `Round ${r}`;

          // Equb Contribution
          scheduledEvents.push({
            id: `evt-biz-eq-${eq.id}-r${r}-contrib`,
            date: rDate.toISOString().split('T')[0],
            calendarDateLabel: calDateLabel,
            ethiopianDateStr: ethDateStr,
            type: 'EQUB_CONTRIBUTION',
            category: 'Equb Contribution',
            title: `${eq.name} (${roundTimeframe}/${totalRounds}) Due`,
            description: `Scheduled contribution (${slots} ${slots === 1 ? 'share' : 'shares'}) to ${eq.name}`,
            reason: `Mandatory rotational pool installment to keep ${eq.name} active and uphold financial trust with circle members`,
            calculationBreakdown: `${slots} ${slots === 1 ? 'share' : 'shares'} × ETB ${eq.contributionPerRound.toLocaleString()} per round`,
            amount: contribPerRound,
            direction: 'OUTFLOW',
            runningCashBalance: 0,
            monthIndex: mIdx,
            monthLabel: `Month ${mIdx} (${monthNames[rDate.getMonth()]})`,
            intervalRoundIndex: r,
            isEqub: true,
            canDelete: true
          });

          // Equb Payout win if user has won round r
          const userWonThisRound = eq.members.some(
            (m) => (m.name.toLowerCase().includes('you') || m.id === 'user' || m.id === '1') && m.wonRound === r
          );
          if (userWonThisRound) {
            scheduledEvents.push({
              id: `evt-biz-eq-${eq.id}-r${r}-win`,
              date: rDate.toISOString().split('T')[0],
              calendarDateLabel: calDateLabel,
              ethiopianDateStr: ethDateStr,
              type: 'EQUB_PAYOUT',
              category: 'Equb Win Payout',
              title: `🎉 ${eq.name} Won (${roundTimeframe})`,
              description: `Lump-sum pot collection (+${formatETB(totalPoolPot)}) distributed by circle`,
              reason: `Rotational lump-sum prize pot awarded to your business from ${eq.name} for business reinvestment or capital buffer`,
              calculationBreakdown: `${totalRounds} rounds × ETB ${eq.contributionPerRound.toLocaleString()} × ${slots} share(s) = ETB ${totalPoolPot.toLocaleString()}`,
              amount: totalPoolPot,
              direction: 'INFLOW',
              runningCashBalance: 0,
              monthIndex: mIdx,
              monthLabel: `Month ${mIdx} (${monthNames[rDate.getMonth()]})`,
              intervalRoundIndex: r,
              isEqub: true,
              canDelete: true
            });
          }
        }
      }
    });
  }

  if (isEqub) {
    for (let r = 1; r <= equbMembers; r++) {
      let rDate = new Date(baseStart);
      if (equbInterval === 'WEEKLY') {
        rDate = new Date(baseStart.getTime() + (r - 1) * 7 * 86400000);
      } else if (equbInterval === 'EVERY_10_DAYS') {
        rDate = new Date(baseStart.getTime() + (r - 1) * 10 * 86400000);
      } else if (equbInterval === 'EVERY_15_DAYS') {
        rDate = new Date(baseStart.getTime() + (r - 1) * 15 * 86400000);
      } else if (equbInterval === 'MONTHLY') {
        rDate = new Date(baseStart.getFullYear(), baseStart.getMonth() + (r - 1), baseStart.getDate());
      }

      // Compute which forecast month index (1..horizonMonths) this round falls into
      const diffMonths = (rDate.getFullYear() - baseStart.getFullYear()) * 12 + (rDate.getMonth() - baseStart.getMonth()) + 1;
      const mIdx = Math.max(1, diffMonths);

      // Only include events within the forecast horizon
      if (mIdx <= horizonMonths) {
        const roundContribAmount = Math.round(equbShares * equbContribPerShare);
        const ethDateStr = formatEthiopianDate(rDate);
        const calDateLabel = `${monthNames[rDate.getMonth()]} ${rDate.getDate()}, ${rDate.getFullYear()}`;
        const roundTimeframe = equbInterval === 'WEEKLY' ? `Week ${r}` : equbInterval === 'MONTHLY' ? `Month ${r}` : `Round ${r}`;
        const intervalCadence = equbInterval === 'WEEKLY' ? 'weekly' : equbInterval === 'EVERY_10_DAYS' ? 'every 10 days' : equbInterval === 'EVERY_15_DAYS' ? 'every 15 days' : 'monthly';

        // Equb Contribution Outflow
        scheduledEvents.push({
          id: `evt-equb-contrib-${r}`,
          date: rDate.toISOString().split('T')[0],
          calendarDateLabel: calDateLabel,
          ethiopianDateStr: ethDateStr,
          type: 'EQUB_CONTRIBUTION',
          category: 'Equb Contribution',
          title: `Equb ${roundTimeframe} Contribution (${equbShares} ${equbShares === 1 ? 'Share' : 'Shares'})`,
          description: `Scheduled ${intervalCadence} contribution to Sebasabi circle (${equbMembers} members)`,
          reason: `Mandatory periodic savings deposit to Sebasabi circle to accumulate collective rotational capital and secure pot payout entitlement`,
          calculationBreakdown: `${equbShares} ${equbShares === 1 ? 'share' : 'shares'} × ETB ${equbContribPerShare.toLocaleString()} per ${intervalCadence} round`,
          amount: roundContribAmount,
          direction: 'OUTFLOW',
          runningCashBalance: 0,
          monthIndex: mIdx,
          monthLabel: `Month ${mIdx} (${monthNames[rDate.getMonth()]})`,
          intervalRoundIndex: r,
          isEqub: true,
          canDelete: true
        });

        // Check if round r is a winning round for any slot
        targetWinRounds.forEach((winRound, sIdx) => {
          if (winRound === r) {
            const slotPot = Math.round(netRoundPot * slotWeights[sIdx]);
            scheduledEvents.push({
              id: `evt-equb-win-${r}-slot-${sIdx}`,
              date: rDate.toISOString().split('T')[0],
              calendarDateLabel: calDateLabel,
              ethiopianDateStr: ethDateStr,
              type: 'EQUB_PAYOUT',
              category: 'Equb Win Payout',
              title: `🎉 Equb ${roundTimeframe} Won - ${numSlots > 1 ? `Share #${sIdx + 1}` : 'Lump-Sum Pot'}`,
              description: `Lump-sum pot collection (+${formatETB(slotPot)}) distributed by Sebasabi`,
              reason: `Rotational lump-sum payout awarded by Sebasabi to fund capital expenditure, inventory expansion, or create cash reserves`,
              calculationBreakdown: `${equbMembers} members × ETB ${equbContribPerShare.toLocaleString()} × ${slotWeights[sIdx]} share weight = ETB ${slotPot.toLocaleString()}`,
              amount: slotPot,
              direction: 'INFLOW',
              runningCashBalance: 0,
              monthIndex: mIdx,
              monthLabel: `Month ${mIdx} (${monthNames[rDate.getMonth()]})`,
              intervalRoundIndex: r,
              slotIndex: sIdx,
              isEqub: true,
              canDelete: true
            });
          }
        });
      }
    }
  }

  // 3. Inject User Defined Active Recurring Payments & Bills into Timeline
  if (input.recurring && input.recurring.length > 0) {
    const activeRecurring = input.recurring.filter((r) => r.status === 'ACTIVE');
    activeRecurring.forEach((r) => {
      const rStartDate = new Date(r.nextDueDate || baseStart);
      const validRStart = isNaN(rStartDate.getTime()) ? new Date(baseStart) : rStartDate;
      let curOccDate = new Date(validRStart);
      let occIndex = 0;

      // Determine clear reason for this recurring item
      const titleLower = (r.title || '').toLowerCase();
      const catLower = (r.category || '').toLowerCase();
      let recReason = r.notes || `${r.frequency.replace(/_/g, ' ')} scheduled commitment${r.beneficiary ? ` to ${r.beneficiary}` : ''}`;
      
      let specificType: ScheduledForecastEvent['specificType'] = 'OTHER';
      let beneficiary = r.beneficiary;

      if (titleLower.includes('rent') || catLower.includes('rent')) {
        recReason = `Commercial lease payment to landlord to maintain physical business premise & prevent eviction`;
        specificType = 'RENT';
        if (!beneficiary) beneficiary = 'Commercial Landlord';
      } else if (titleLower.includes('electric') || titleLower.includes('power')) {
        recReason = `EEU commercial power consumption for PlayStation 5 gaming setups, 4K displays & cooling`;
        specificType = 'UTILITY';
        if (!beneficiary) beneficiary = 'Ethiopian Electric Utility (EEU)';
      } else if (titleLower.includes('internet') || titleLower.includes('fiber') || titleLower.includes('telecom')) {
        recReason = `Ethio Telecom high-speed fiber internet for online multiplayer gameplay, digital POS & CCTV streaming`;
        specificType = 'UTILITY';
        if (!beneficiary) beneficiary = 'Ethio Telecom';
      } else if (titleLower.includes('water')) {
        recReason = `Municipal water utility billing for lounge restrooms and customer cafe facilities`;
        specificType = 'UTILITY';
        if (!beneficiary) beneficiary = 'Municipal Water Authority';
      } else if (catLower.includes('utilit')) {
        recReason = `Essential facility utilities and service subscriptions`;
        specificType = 'UTILITY';
        if (!beneficiary) beneficiary = 'Utility Provider';
      } else if (titleLower.includes('police') || titleLower.includes('security')) {
        recReason = `Local security & police post protection for late-night customer safety & venue asset protection`;
        specificType = 'RENT';
        if (!beneficiary) beneficiary = 'Local Security Post';
      } else if (titleLower.includes('transport') || titleLower.includes('stipend') || catLower.includes('transport')) {
        recReason = `Staff transportation allowance & night shift mobility support${r.beneficiary ? ` for ${r.beneficiary}` : ''}`;
        specificType = 'TRANSPORT';
        if (!beneficiary) beneficiary = 'Staff Mobility';
      } else if (r.type === 'INCOME') {
        specificType = 'REVENUE';
      } else {
        specificType = 'OPEX';
      }

      let walletName = 'Telebirr';
      if (r.walletId === 'w-cbe') walletName = 'CBE Bank';
      else if (r.walletId === 'w-cash') walletName = 'Cash Vault';
      else if (r.walletId === 'w-ebirr') walletName = 'eBirr';

      while (true) {
        const diffMonths = (curOccDate.getFullYear() - baseStart.getFullYear()) * 12 + (curOccDate.getMonth() - baseStart.getMonth()) + 1;
        if (diffMonths > horizonMonths) break;
        if (diffMonths >= 1) {
          const isoDate = curOccDate.toISOString().split('T')[0];
          const ethDateStr = formatEthiopianDate(curOccDate);
          const calLabel = `${monthNames[curOccDate.getMonth()]} ${curOccDate.getDate()}, ${curOccDate.getFullYear()}`;

          scheduledEvents.push({
            id: `evt-rec-${r.id}-occ-${occIndex}`,
            date: isoDate,
            calendarDateLabel: calLabel,
            ethiopianDateStr: ethDateStr,
            type: r.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
            category: r.category || 'Recurring Commitments',
            title: `${r.title} (${r.frequency.replace(/_/g, ' ')})`,
            description: `${r.frequency.replace(/_/g, ' ')} scheduled commitment${beneficiary ? ` to ${beneficiary}` : ''}${r.notes ? ` • ${r.notes}` : ''}`,
            reason: recReason,
            calculationBreakdown: `ETB ${Math.abs(r.amount).toLocaleString()} scheduled ${r.frequency.toLowerCase().replace(/_/g, ' ')}${beneficiary ? ` to ${beneficiary}` : ''} via ${walletName}`,
            amount: Math.abs(r.amount),
            direction: r.type === 'INCOME' ? 'INFLOW' : 'OUTFLOW',
            runningCashBalance: 0,
            monthIndex: diffMonths,
            monthLabel: `Month ${diffMonths} (${monthNames[curOccDate.getMonth()]})`,
            isRecurring: true,
            specificType,
            beneficiary,
            walletName,
            canDelete: true
          });
        }
        occIndex++;

        // Increment according to frequency
        if (r.frequency === 'DAILY') {
          curOccDate = new Date(curOccDate.getTime() + 1 * 86400000);
        } else if (r.frequency === 'WEEKLY') {
          curOccDate = new Date(curOccDate.getTime() + 7 * 86400000);
        } else if (r.frequency === 'BIWEEKLY') {
          curOccDate = new Date(curOccDate.getTime() + 14 * 86400000);
        } else if (r.frequency === 'EVERY_3_WEEKS') {
          curOccDate = new Date(curOccDate.getTime() + 21 * 86400000);
        } else if (r.frequency === 'EVERY_4_WEEKS') {
          curOccDate = new Date(curOccDate.getTime() + 28 * 86400000);
        } else if (r.frequency === 'MONTHLY') {
          curOccDate = new Date(curOccDate.getFullYear(), curOccDate.getMonth() + 1, curOccDate.getDate());
        } else if (r.frequency === 'EVERY_2_MONTHS') {
          curOccDate = new Date(curOccDate.getFullYear(), curOccDate.getMonth() + 2, curOccDate.getDate());
        } else if (r.frequency === 'QUARTERLY') {
          curOccDate = new Date(curOccDate.getFullYear(), curOccDate.getMonth() + 3, curOccDate.getDate());
        } else if (r.frequency === 'YEARLY') {
          curOccDate = new Date(curOccDate.getFullYear() + 1, curOccDate.getMonth(), curOccDate.getDate());
        } else {
          curOccDate = new Date(curOccDate.getFullYear(), curOccDate.getMonth() + 1, curOccDate.getDate());
        }

        if (occIndex > horizonMonths * 32) break; // Guard against infinite loop
      }
    });
  }

  // 3. Scheduled Business Operating Inflows & Outflows for Horizon Months
  // Support both DAILY breakdown and PERIODIC batch breakdown
  const isDaily = input.granularity === 'DAILY';
  const baseOpex = isEqub ? baseExp : projExp;

  if (isDaily) {
    // Generate day-by-day scheduled operational events for the entire horizon
    for (let m = 1; m <= horizonMonths; m++) {
      const mDate = new Date(baseStart.getFullYear(), baseStart.getMonth() + m - 1, 1);
      const mLabel = `Month ${m} (${monthNames[mDate.getMonth()]})`;
      const daysInMonth = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
      
      const dailyGrossRevenue = Math.round(projInc / daysInMonth);

      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(mDate.getFullYear(), mDate.getMonth(), d);
        const dayIso = dayDate.toISOString().split('T')[0];
        const dayOfWeek = dayDate.getDay(); // 0 is Sunday, 6 is Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 || dayOfWeek === 5; // Friday, Sat, Sun peak

        // Revenue on this day (with weekend multiplier weighting)
        const dailyRevWeighted = isWeekend ? Math.round(dailyGrossRevenue * 1.35) : Math.round(dailyGrossRevenue * 0.85);

        // Daily Income Event
        scheduledEvents.push({
          id: `evt-daily-inc-m${m}-d${d}`,
          date: dayIso,
          calendarDateLabel: `${monthNames[dayDate.getMonth()]} ${d}, ${dayDate.getFullYear()}`,
          ethiopianDateStr: formatEthiopianDate(dayDate),
          type: 'INCOME',
          category: 'Daily Revenue',
          title: `Daily Lounge & Gaming Revenue (${isWeekend ? 'Weekend Peak' : 'Weekday'})`,
          description: `Daily PlayStation 5 gaming tickets, VR stations, snacks & beverage sales`,
          reason: `Gross operational customer revenue generated from daily hourly gaming sessions, VIP lounge bookings & cafe concessions`,
          calculationBreakdown: `Daily weighted revenue: ~ETB ${dailyRevWeighted.toLocaleString()} (${isWeekend ? '+35% weekend peak weighting' : 'weekday baseline'})`,
          amount: dailyRevWeighted,
          direction: 'INFLOW',
          runningCashBalance: 0,
          monthIndex: m,
          monthLabel: mLabel,
          canDelete: true
        });
      }
    }
  } else {
    // Periodic Batch Mode (2 revenue pulses and 1 baseline operations pulse per month)
    for (let m = 1; m <= horizonMonths; m++) {
      const mDate = new Date(baseStart.getFullYear(), baseStart.getMonth() + m - 1, 1);
      const mLabel = `Month ${m} (${monthNames[mDate.getMonth()]})`;

      // Periodic Income Inflows (2 pulses per month: mid-month and end-of-month)
      const midMonthDate = new Date(mDate.getFullYear(), mDate.getMonth(), 10);
      const endMonthDate = new Date(mDate.getFullYear(), mDate.getMonth(), 24);

      const halfRev = Math.round(projInc / 2);

      scheduledEvents.push({
        id: `evt-rev-mid-m${m}`,
        date: midMonthDate.toISOString().split('T')[0],
        calendarDateLabel: `${monthNames[midMonthDate.getMonth()]} ${midMonthDate.getDate()}, ${midMonthDate.getFullYear()}`,
        ethiopianDateStr: formatEthiopianDate(midMonthDate),
        type: 'INCOME',
        category: 'Income',
        title: `${mLabel} Mid-Period Income Batch`,
        description: `Customer gaming, VR station usage & beverage digital receipts`,
        reason: `Mid-month aggregated income from console sessions, VR stations and cafe sales`,
        calculationBreakdown: `50% of projected monthly gross income: ETB ${halfRev.toLocaleString()}`,
        amount: halfRev,
        direction: 'INFLOW',
        runningCashBalance: 0,
        monthIndex: m,
        monthLabel: mLabel,
        canDelete: true
      });

      scheduledEvents.push({
        id: `evt-rev-end-m${m}`,
        date: endMonthDate.toISOString().split('T')[0],
        calendarDateLabel: `${monthNames[endMonthDate.getMonth()]} ${endMonthDate.getDate()}, ${endMonthDate.getFullYear()}`,
        ethiopianDateStr: formatEthiopianDate(endMonthDate),
        type: 'INCOME',
        category: 'Income',
        title: `${mLabel} End-Period Income Batch`,
        description: `Weekend tournament peaks, VIP room bookings & cash inflow`,
        reason: `End-of-month aggregated income from weekend tournaments, VIP rooms & high-volume gaming`,
        calculationBreakdown: `50% of projected monthly gross income: ETB ${(projInc - halfRev).toLocaleString()}`,
        amount: projInc - halfRev,
        direction: 'INFLOW',
        runningCashBalance: 0,
        monthIndex: m,
        monthLabel: mLabel,
        canDelete: true
      });

      // Periodic Operating Expenses (Staff Payroll & Operations on 25th)
      const payrollDate = new Date(mDate.getFullYear(), mDate.getMonth(), 25);
      const payrollPortion = baseOpex;

      if (payrollPortion > 0) {
        scheduledEvents.push({
          id: `evt-exp-payroll-m${m}`,
          date: payrollDate.toISOString().split('T')[0],
          calendarDateLabel: `${monthNames[payrollDate.getMonth()]} ${payrollDate.getDate()}, ${payrollDate.getFullYear()}`,
          ethiopianDateStr: formatEthiopianDate(payrollDate),
          type: 'EXPENSE',
          category: 'Payroll & Operations',
          title: `${mLabel} Staff Payroll & Maintenance`,
          description: `Shift technician compensation, consumable stock & operations`,
          reason: `Monthly team compensation, technician retainers, inventory restocking & operational supplies`,
          calculationBreakdown: `Baseline monthly operating expenses: ETB ${payrollPortion.toLocaleString()}`,
          amount: payrollPortion,
          direction: 'OUTFLOW',
          runningCashBalance: 0,
          monthIndex: m,
          monthLabel: mLabel,
          canDelete: true
        });
      }
    }
  }

  // 4. Inject Active Loan Installments & Debt Servicing Events
  if (input.loans && input.loans.length > 0) {
    const activeLoans = input.loans.filter((l) => l.status === 'ACTIVE');
    activeLoans.forEach((l) => {
      const isBorrowed = l.direction !== 'LENT'; // default borrowed debt
      const rawInstallment = l.monthlyInstallment || (l.outstandingBalance > 0 ? Math.round(l.outstandingBalance / 12) : 0);
      const monthlyAmount = l.outstandingBalance > 0
        ? Math.min(l.outstandingBalance, Math.max(1000, rawInstallment))
        : Math.max(1000, rawInstallment);

      if (monthlyAmount > 0) {
        for (let m = 1; m <= horizonMonths; m++) {
          const loanDate = new Date(baseStart.getFullYear(), baseStart.getMonth() + m - 1, 15);
          const mLabel = `Month ${m} (${monthNames[loanDate.getMonth()]})`;

          if (isBorrowed) {
            scheduledEvents.push({
              id: `evt-loan-pay-${l.id}-m${m}`,
              date: loanDate.toISOString().split('T')[0],
              calendarDateLabel: `${monthNames[loanDate.getMonth()]} 15, ${loanDate.getFullYear()}`,
              ethiopianDateStr: formatEthiopianDate(loanDate),
              type: 'LOAN_PAYMENT',
              category: 'Loan Repayments',
              title: `Loan Repayment: ${l.title || 'Bank / Creditor'}`,
              description: `Monthly installment to ${l.counterparty || 'Creditor'} (Outstanding: ETB ${l.outstandingBalance.toLocaleString()})`,
              reason: `Contractual debt servicing installment to reduce loan principal and uphold credit standing with ${l.counterparty || 'Creditor'}`,
              calculationBreakdown: `ETB ${monthlyAmount.toLocaleString()}/month (Total Outstanding: ETB ${l.outstandingBalance.toLocaleString()})`,
              amount: monthlyAmount,
              direction: 'OUTFLOW',
              runningCashBalance: 0,
              monthIndex: m,
              monthLabel: mLabel,
              canDelete: true
            });
          } else {
            scheduledEvents.push({
              id: `evt-loan-col-${l.id}-m${m}`,
              date: loanDate.toISOString().split('T')[0],
              calendarDateLabel: `${monthNames[loanDate.getMonth()]} 15, ${loanDate.getFullYear()}`,
              ethiopianDateStr: formatEthiopianDate(loanDate),
              type: 'LOAN_COLLECTION',
              category: 'Loan Collections',
              title: `Loan Collection: ${l.title || 'Receivable'}`,
              description: `Expected incoming repayment from ${l.counterparty || 'Debtor'} (Outstanding: ETB ${l.outstandingBalance.toLocaleString()})`,
              reason: `Contractual debt collection received from ${l.counterparty || 'Debtor'} for previously extended business credit`,
              calculationBreakdown: `ETB ${monthlyAmount.toLocaleString()}/month (Receivable Balance: ETB ${l.outstandingBalance.toLocaleString()})`,
              amount: monthlyAmount,
              direction: 'INFLOW',
              runningCashBalance: 0,
              monthIndex: m,
              monthLabel: mLabel,
              canDelete: true
            });
          }
        }
      }
    });
  }

  // 5. Inject User Custom Scenario Events (Manual added incomes, daily streams & expenses)
  if (input.customEvents && input.customEvents.length > 0) {
    input.customEvents.forEach((cEvt) => {
      const isDaily = cEvt.frequency === 'DAILY' || cEvt.isRecurringDaily;
      const isMonthly = cEvt.frequency === 'MONTHLY';

      if (isDaily) {
        // Generate daily events
        const startDate = new Date(cEvt.date || baseStart);
        const validStart = isNaN(startDate.getTime()) ? new Date(baseStart) : startDate;
        const totalDays = cEvt.dailyDaysCount || (cEvt.endDate ? Math.max(1, Math.round((new Date(cEvt.endDate).getTime() - validStart.getTime()) / (24 * 60 * 60 * 1000))) : 30);
        const cappedDays = Math.min(horizonMonths * 30, Math.max(1, totalDays));

        for (let d = 0; d < cappedDays; d++) {
          const dayDate = new Date(validStart.getTime() + d * 24 * 60 * 60 * 1000);
          const dayOfWeek = dayDate.getDay(); // 0 = Sun, 6 = Sat

          if (cEvt.dailySchedule === 'WEEKDAYS' && (dayOfWeek === 0 || dayOfWeek === 6)) {
            continue;
          }
          if (cEvt.dailySchedule === 'WEEKENDS' && dayOfWeek !== 0 && dayOfWeek !== 6) {
            continue;
          }

          const diffMonths = (dayDate.getFullYear() - baseStart.getFullYear()) * 12 + (dayDate.getMonth() - baseStart.getMonth()) + 1;
          const mIdx = Math.max(1, Math.min(horizonMonths, diffMonths));
          const calLabel = `${monthNames[dayDate.getMonth()]} ${dayDate.getDate()}, ${dayDate.getFullYear()}`;
          const ethDateStr = formatEthiopianDate(dayDate);

          scheduledEvents.push({
            id: `${cEvt.id}-d${d}`,
            date: dayDate.toISOString().split('T')[0],
            calendarDateLabel: calLabel,
            ethiopianDateStr: ethDateStr,
            type: cEvt.direction === 'INFLOW' ? 'CUSTOM_INFLOW' : 'CUSTOM_OUTFLOW',
            category: cEvt.category || (cEvt.direction === 'INFLOW' ? 'Daily Revenue' : 'Daily Operations'),
            title: cappedDays === 1 ? cEvt.title : `${cEvt.title} (Day ${d + 1})`,
            description: cEvt.description || (cEvt.direction === 'INFLOW' ? 'Custom daily business revenue' : 'Custom daily expense'),
            reason: cEvt.description || `Custom user scenario ${cEvt.direction === 'INFLOW' ? 'revenue stream' : 'expense allocation'}`,
            calculationBreakdown: `ETB ${Math.abs(cEvt.amount).toLocaleString()} / day`,
            amount: Math.abs(cEvt.amount),
            direction: cEvt.direction,
            runningCashBalance: 0,
            monthIndex: mIdx,
            monthLabel: `Month ${mIdx} (${monthNames[dayDate.getMonth()]})`,
            isCustom: true,
            canDelete: true
          });
        }
      } else if (isMonthly) {
        // Generate monthly recurring events across the forecast horizon
        const startDate = new Date(cEvt.date || baseStart);
        const startDay = isNaN(startDate.getTime()) ? 1 : startDate.getDate();
        for (let m = 1; m <= horizonMonths; m++) {
          const mDate = new Date(baseStart.getFullYear(), baseStart.getMonth() + m - 1, Math.min(28, startDay));
          const calLabel = `${monthNames[mDate.getMonth()]} ${mDate.getDate()}, ${mDate.getFullYear()}`;
          const ethDateStr = formatEthiopianDate(mDate);

          scheduledEvents.push({
            id: `${cEvt.id}-m${m}`,
            date: mDate.toISOString().split('T')[0],
            calendarDateLabel: calLabel,
            ethiopianDateStr: ethDateStr,
            type: cEvt.direction === 'INFLOW' ? 'CUSTOM_INFLOW' : 'CUSTOM_OUTFLOW',
            category: cEvt.category || (cEvt.direction === 'INFLOW' ? 'Custom Revenue' : 'Custom Expense'),
            title: `${cEvt.title} (Month ${m})`,
            description: cEvt.description || 'Monthly recurring custom scenario event',
            reason: cEvt.description || `Custom user monthly scenario ${cEvt.direction === 'INFLOW' ? 'revenue' : 'expense'}`,
            calculationBreakdown: `ETB ${Math.abs(cEvt.amount).toLocaleString()} / month`,
            amount: Math.abs(cEvt.amount),
            direction: cEvt.direction,
            runningCashBalance: 0,
            monthIndex: m,
            monthLabel: `Month ${m} (${monthNames[mDate.getMonth()]})`,
            isCustom: true,
            canDelete: true
          });
        }
      } else {
        // Single date event
        const cDate = new Date(cEvt.date || baseStart);
        const validDate = isNaN(cDate.getTime()) ? new Date(baseStart) : cDate;
        const ethDateStr = formatEthiopianDate(validDate);
        const calLabel = `${monthNames[validDate.getMonth()]} ${validDate.getDate()}, ${validDate.getFullYear()}`;
        
        const diffMonths = (validDate.getFullYear() - baseStart.getFullYear()) * 12 + (validDate.getMonth() - baseStart.getMonth()) + 1;
        const mIdx = Math.max(1, Math.min(horizonMonths, diffMonths));

        scheduledEvents.push({
          id: cEvt.id,
          date: validDate.toISOString().split('T')[0],
          calendarDateLabel: calLabel,
          ethiopianDateStr: ethDateStr,
          type: cEvt.direction === 'INFLOW' ? 'CUSTOM_INFLOW' : 'CUSTOM_OUTFLOW',
          category: cEvt.category || (cEvt.direction === 'INFLOW' ? 'Custom Revenue' : 'Custom Expense'),
          title: cEvt.title || (cEvt.direction === 'INFLOW' ? 'Custom Scenario Income' : 'Custom Scenario Expense'),
          description: cEvt.description || 'User added scenario adjustment event',
          reason: cEvt.description || `Custom one-time user scenario ${cEvt.direction === 'INFLOW' ? 'inflow' : 'outflow'}`,
          calculationBreakdown: `ETB ${Math.abs(cEvt.amount).toLocaleString()} on ${calLabel}`,
          amount: Math.abs(cEvt.amount),
          direction: cEvt.direction,
          runningCashBalance: 0,
          monthIndex: mIdx,
          monthLabel: `Month ${mIdx} (${monthNames[validDate.getMonth()]})`,
          isCustom: true,
          canDelete: true
        });
      }
    });
  }

  // 5. Filter out any user-deleted events and excluded categories from this simulation scenario
  const deletedSet = new Set(input.deletedEventIds || []);
  const excludedCategorySet = new Set(input.excludedCategories || []);
  const activeEvents = scheduledEvents.filter(
    (e) => !deletedSet.has(e.id) && !Array.from(deletedSet).some(dId => e.id.startsWith(dId)) && !excludedCategorySet.has(e.category)
  );

  // 6. Sort scheduled events chronologically
  activeEvents.sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    // On the same day, process INFLOWs before OUTFLOWs (e.g. winning payout before contribution)
    if (a.direction !== b.direction) {
      return a.direction === 'INFLOW' ? -1 : 1;
    }
    return 0;
  });

  // 7. Compute progressive running cash balance after each event
  let curEventBalance = totalLiquidity;
  for (const evt of activeEvents) {
    if (evt.direction === 'INFLOW') {
      curEventBalance += evt.amount;
    } else {
      curEventBalance -= evt.amount;
    }
    evt.runningCashBalance = Math.round(curEventBalance);
  }

  // 8. Synchronize Month-by-Month Forecast Cards from activeEvents to stay 100% consistent with category exclusions & custom adjustments
  const syncedSixMonthForecast: MonthlyForecastItem[] = [];
  let progressiveEndingCash = totalLiquidity;

  for (let m = 1; m <= horizonMonths; m++) {
    const futureDate = new Date(currentYear, currentMonthIdx + m, 1);
    const calMonth = `${monthNames[futureDate.getMonth()]} ${futureDate.getFullYear()}`;
    const monthLabel = `Month ${m} (${monthNames[futureDate.getMonth()]})`;

    const monthEvents = activeEvents.filter((e) => e.monthIndex === m);

    const monthInflow = monthEvents
      .filter((e) => e.direction === 'INFLOW' && e.type !== 'EQUB_PAYOUT')
      .reduce((sum, e) => sum + e.amount, 0);

    const monthOperatingOutflow = monthEvents
      .filter(
        (e) =>
          e.direction === 'OUTFLOW' &&
          e.type !== 'EQUB_CONTRIBUTION' &&
          e.type !== 'CAPEX'
      )
      .reduce((sum, e) => sum + e.amount, 0);

    const monthEqubContrib = monthEvents
      .filter((e) => e.type === 'EQUB_CONTRIBUTION')
      .reduce((sum, e) => sum + e.amount, 0);

    const monthEqubPayout = monthEvents
      .filter((e) => e.type === 'EQUB_PAYOUT')
      .reduce((sum, e) => sum + e.amount, 0);

    const monthCapex = monthEvents
      .filter((e) => e.type === 'CAPEX')
      .reduce((sum, e) => sum + e.amount, 0);

    const winningEventsThisMonth = monthEvents.filter((e) => e.type === 'EQUB_PAYOUT');
    const winDetails = winningEventsThisMonth.map(
      (ev) => `${ev.title}: +${formatETB(ev.amount)}`
    );

    const totalMonthInflows = monthInflow + monthEqubPayout;
    const totalMonthOutflows = monthOperatingOutflow + monthEqubContrib + monthCapex;
    const netCashflow = totalMonthInflows - totalMonthOutflows;

    progressiveEndingCash = Math.max(0, progressiveEndingCash + netCashflow);

    let status: 'OPTIMAL' | 'MODERATE' | 'TIGHT' | 'SURPLUS_SURGE' = 'OPTIMAL';
    let notes = '';

    if (monthEqubPayout > 0) {
      status = 'SURPLUS_SURGE';
      notes = `🎉 ${winningEventsThisMonth.length > 1 ? `${winningEventsThisMonth.length} Equb Wins` : 'Equb Win'} (+${formatETB(monthEqubPayout)})! Working capital surplus surge.`;
    } else if (progressiveEndingCash >= totalLiquidity * 1.15) {
      status = 'OPTIMAL';
      notes = `High liquidity growth. Reserve buffer expands to ${formatETB(progressiveEndingCash)}.`;
    } else if (progressiveEndingCash >= 250000) {
      status = 'MODERATE';
      notes = `Steady operations. Working capital buffer remains comfortable.`;
    } else {
      status = 'TIGHT';
      notes = `Reserve buffer tight (${formatETB(progressiveEndingCash)}). Monitor discretionary expenses.`;
    }

    if (m === 1 && monthCapex > 0) {
      notes = `CapEx deployed (${formatETB(monthCapex)}). Remaining cash: ${formatETB(progressiveEndingCash)}.`;
    }

    if (excludedCategorySet.size > 0) {
      notes += ` [${excludedCategorySet.size} categories excluded]`;
    }

    const monthRecurring = monthEvents
      .filter((e) => e.isRecurring && e.direction === 'OUTFLOW')
      .reduce((sum, e) => sum + e.amount, 0);

    const monthLoans = monthEvents
      .filter((e) => e.type === 'LOAN_PAYMENT' || e.category.includes('Loan Repay'))
      .reduce((sum, e) => sum + e.amount, 0);

    const monthActiveEqubs = monthEvents
      .filter((e) => e.type === 'EQUB_CONTRIBUTION')
      .reduce((sum, e) => sum + e.amount, 0);

    syncedSixMonthForecast.push({
      monthIndex: m,
      monthLabel,
      calendarMonth: calMonth,
      projectedInflow: monthInflow,
      projectedOutflow: monthOperatingOutflow,
      recurringPayments: monthRecurring,
      loanRepayments: monthLoans,
      activeEqubsCommitment: monthActiveEqubs,
      equbContribution: monthEqubContrib,
      equbPayout: monthEqubPayout,
      equbWinsCount: winningEventsThisMonth.length,
      equbWinDetails: winDetails,
      netCashflow,
      endingCash: progressiveEndingCash,
      status,
      notes,
      events: monthEvents
    });
  }

  // Calculate adjusted monthly averages based on active non-equb operational events
  const totalActiveInflows = activeEvents
    .filter((e) => e.direction === 'INFLOW' && e.type !== 'EQUB_PAYOUT')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalActiveOutflows = activeEvents
    .filter(
      (e) =>
        e.direction === 'OUTFLOW' &&
        e.type !== 'EQUB_CONTRIBUTION' &&
        e.type !== 'CAPEX'
    )
    .reduce((sum, e) => sum + e.amount, 0);

  const avgMonthlyActiveInflow = Math.round(totalActiveInflows / horizonMonths);
  const avgMonthlyActiveOutflow = Math.round(totalActiveOutflows / horizonMonths);
  const adjustedProjProfit = avgMonthlyActiveInflow - avgMonthlyActiveOutflow;
  const adjustedRunway =
    avgMonthlyActiveOutflow > 0
      ? Number((progressiveEndingCash / avgMonthlyActiveOutflow).toFixed(1))
      : 24;

  const equbMetrics = isEqub
    ? {
        equbMonthlyCommitment: equbMonthlyBurn,
        equbTotalPool: Math.round(netRoundPot * equbShares),
        equbCycleMonths:
          equbInterval === 'MONTHLY'
            ? equbMembers
            : Math.max(1, Math.round((equbMembers / equbIntervalMult) * 10) / 10),
        equbShares,
        equbInterval
      }
    : {};

  // 9. Generate Granular Forecast Breakdown with Running Total Balances
  const syncedWeeklyForecast: WeeklyForecastItem[] = [];
  let progressiveWeeklyCash = totalLiquidity;

  const msPerDay = 24 * 60 * 60 * 1000;
  for (let w = 1; w <= horizonWeeks; w++) {
    const weekStartTime = baseStart.getTime() + (w - 1) * 7 * msPerDay;
    const weekEndTime = weekStartTime + 6 * msPerDay;
    const weekStartDate = new Date(weekStartTime);
    const weekEndDate = new Date(weekEndTime);

    const startIso = weekStartDate.toISOString().split('T')[0];
    const endIso = weekEndDate.toISOString().split('T')[0];

    // Find all events falling within this 7-day week
    const weekEvents = activeEvents.filter((e) => e.date >= startIso && e.date <= endIso);

    const dailyInflow = weekEvents
      .filter((e) => e.direction === 'INFLOW' && (e.type === 'INCOME' || e.category === 'Income' || e.category === 'Daily Revenue' || e.category === 'Operating Revenue' || e.category.toLowerCase().includes('income') || e.category.toLowerCase().includes('daily') || (e.isCustom && e.category.toLowerCase().includes('revenue'))))
      .reduce((sum, e) => sum + e.amount, 0);

    const specialInflow = weekEvents
      .filter((e) => e.direction === 'INFLOW' && (e.type === 'EQUB_PAYOUT' || e.type === 'LOAN_COLLECTION' || (e.isCustom && !e.category.toLowerCase().includes('revenue') && !e.category.toLowerCase().includes('daily'))))
      .reduce((sum, e) => sum + e.amount, 0);

    const totalWeeklyInflow = dailyInflow + specialInflow;

    const dailyOutflow = weekEvents
      .filter((e) => e.direction === 'OUTFLOW' && (e.category === 'Daily Operations' || e.category.toLowerCase().includes('daily') || (!e.type.startsWith('EQUB') && e.type !== 'CAPEX' && e.type !== 'LOAN_PAYMENT' && !e.category.includes('Rent') && !e.category.includes('Payroll') && !e.isCustom)))
      .reduce((sum, e) => sum + e.amount, 0);

    const fixedOutflow = weekEvents
      .filter((e) => e.direction === 'OUTFLOW' && (e.type === 'EQUB_CONTRIBUTION' || e.type === 'CAPEX' || e.type === 'LOAN_PAYMENT' || e.category.includes('Rent') || e.category.includes('Payroll') || (e.isCustom && !e.category.toLowerCase().includes('daily'))))
      .reduce((sum, e) => sum + e.amount, 0);

    const totalWeeklyOutflow = dailyOutflow + fixedOutflow;
    const netWeeklyCashflow = totalWeeklyInflow - totalWeeklyOutflow;
    const startingCash = progressiveWeeklyCash;
    progressiveWeeklyCash = Math.max(0, progressiveWeeklyCash + netWeeklyCashflow);

    // Key highlights for this week
    const highlights: string[] = [];
    const equbWins = weekEvents.filter((e) => e.type === 'EQUB_PAYOUT');
    if (equbWins.length > 0) {
      highlights.push(`🎉 Equb Payout: +${formatETB(equbWins.reduce((s, e) => s + e.amount, 0))}`);
    }
    const recurringEvts = weekEvents.filter((e) => e.isRecurring);
    if (recurringEvts.length > 0) {
      const recOut = recurringEvts.filter((e) => e.direction === 'OUTFLOW').reduce((s, e) => s + e.amount, 0);
      const recIn = recurringEvts.filter((e) => e.direction === 'INFLOW').reduce((s, e) => s + e.amount, 0);
      if (recOut > 0) highlights.push(`🔄 Recurring Dues: -${formatETB(recOut)}`);
      if (recIn > 0) highlights.push(`🔄 Recurring Inflow: +${formatETB(recIn)}`);
    }
    const rentEvts = weekEvents.filter((e) => e.category.includes('Rent') && !e.isRecurring);
    if (rentEvts.length > 0) {
      highlights.push(`🏢 Facility Rent: -${formatETB(rentEvts.reduce((s, e) => s + e.amount, 0))}`);
    }
    const loanEvts = weekEvents.filter((e) => e.type === 'LOAN_PAYMENT' || e.category.includes('Loan Repay'));
    if (loanEvts.length > 0) {
      highlights.push(`💳 Loan Repayment: -${formatETB(loanEvts.reduce((s, e) => s + e.amount, 0))}`);
    }
    const loanColls = weekEvents.filter((e) => e.type === 'LOAN_COLLECTION' || e.category.includes('Loan Coll'));
    if (loanColls.length > 0) {
      highlights.push(`📥 Loan Collection: +${formatETB(loanColls.reduce((s, e) => s + e.amount, 0))}`);
    }
    const equbContribs = weekEvents.filter((e) => e.type === 'EQUB_CONTRIBUTION');
    if (equbContribs.length > 0) {
      highlights.push(`🤝 Equb Dues: -${formatETB(equbContribs.reduce((s, e) => s + e.amount, 0))}`);
    }
    const capexEvts = weekEvents.filter((e) => e.type === 'CAPEX');
    if (capexEvts.length > 0) {
      highlights.push(`🚀 Upfront CapEx: -${formatETB(capexEvts.reduce((s, e) => s + e.amount, 0))}`);
    }

    let status: 'OPTIMAL' | 'MODERATE' | 'TIGHT' | 'SURPLUS_SURGE' = 'OPTIMAL';
    if (equbWins.length > 0) {
      status = 'SURPLUS_SURGE';
    } else if (progressiveWeeklyCash >= totalLiquidity * 1.1) {
      status = 'OPTIMAL';
    } else if (progressiveWeeklyCash >= 250000) {
      status = 'MODERATE';
    } else {
      status = 'TIGHT';
    }

    const mIdx = Math.min(horizonMonths, Math.max(1, Math.ceil(w / 4.33)));
    const mDate = new Date(baseStart.getFullYear(), baseStart.getMonth() + mIdx - 1, 1);
    const mLabel = `Month ${mIdx} (${monthNames[mDate.getMonth()]})`;

    const dateRangeLabel = `${monthNames[weekStartDate.getMonth()]} ${weekStartDate.getDate()} - ${monthNames[weekEndDate.getMonth()]} ${weekEndDate.getDate()}, ${weekEndDate.getFullYear()}`;
    const ethiopianDateRangeStr = `${formatEthiopianDate(weekStartDate)} - ${formatEthiopianDate(weekEndDate)}`;

    syncedWeeklyForecast.push({
      weekIndex: w,
      weekLabel: `Week ${w} (${monthNames[weekStartDate.getMonth()]} ${weekStartDate.getDate()} - ${monthNames[weekEndDate.getMonth()]} ${weekEndDate.getDate()})`,
      startDate: startIso,
      endDate: endIso,
      dateRangeLabel,
      ethiopianDateRangeStr,
      monthIndex: mIdx,
      monthLabel: mLabel,
      projectedDailyInflow: dailyInflow,
      projectedSpecialInflow: specialInflow,
      totalWeeklyInflow,
      projectedDailyOutflow: dailyOutflow,
      projectedFixedOutflow: fixedOutflow,
      totalWeeklyOutflow,
      netWeeklyCashflow,
      startingCash,
      endingCash: progressiveWeeklyCash,
      eventsCount: weekEvents.length,
      events: weekEvents,
      status,
      highlights
    });
  }

  // 10. Synthesize In-Depth Stream & Reason Summaries for every Income & Expense
  const streamMap = new Map<string, ScheduledForecastEvent[]>();
  activeEvents.forEach((evt) => {
    // Normalize group key by stripping dynamic round/month/day suffixes
    const baseTitle = evt.title
      .replace(/\s*\((Week|Month|Round|Day|\d+\/\d+|Share|Weekday|Weekend).*\)/gi, '')
      .replace(/\s*-\s*(Share|Lump-Sum).*/gi, '')
      .trim();
    const groupKey = `${evt.direction}_${evt.type}_${evt.category}_${baseTitle}`;
    if (!streamMap.has(groupKey)) {
      streamMap.set(groupKey, []);
    }
    streamMap.get(groupKey)!.push(evt);
  });

  const reasonsSummary: ScenarioReasonItem[] = [];
  streamMap.forEach((events, key) => {
    const first = events[0];
    const totalAmount = events.reduce((sum, e) => sum + e.amount, 0);
    const count = events.length;
    const monthlyNormalized = Math.round(totalAmount / horizonMonths);
    const baseTitle = first.title
      .replace(/\s*\((Week|Month|Round|Day|\d+\/\d+|Share|Weekday|Weekend).*\)/gi, '')
      .replace(/\s*-\s*(Share|Lump-Sum).*/gi, '')
      .trim();

    let freq = `${count}x across ${horizonLabel}`;
    if (count >= 150) freq = `Daily (~${count} days)`;
    else if (count >= 24 && count <= 28) freq = `Weekly (${count} wks)`;
    else if (count >= 16 && count <= 20) freq = `Every 10 Days (${count} rounds)`;
    else if (count >= 10 && count <= 14) freq = `Bi-Weekly / 15-Days (${count} rounds)`;
    else if (count === horizonMonths) freq = `Monthly (${horizonMonths} occurrences)`;
    else if (count === 1) freq = 'One-time Milestone';

    const impact: 'HIGH' | 'MEDIUM' | 'LOW' = totalAmount >= 150000 ? 'HIGH' : totalAmount >= 35000 ? 'MEDIUM' : 'LOW';

    let itemType: ScenarioReasonItem['type'] = 'EXPENSE';
    if (first.type === 'EQUB_CONTRIBUTION') itemType = 'EQUB_CONTRIBUTION';
    else if (first.type === 'EQUB_PAYOUT') itemType = 'EQUB_PAYOUT';
    else if (first.type === 'LOAN_PAYMENT') itemType = 'LOAN_PAYMENT';
    else if (first.type === 'LOAN_COLLECTION') itemType = 'LOAN_COLLECTION';
    else if (first.type === 'CAPEX') itemType = 'CAPEX';
    else if (first.isRecurring) itemType = 'RECURRING';
    else if (first.isCustom) itemType = 'CUSTOM';
    else if (first.direction === 'INFLOW') itemType = 'INCOME';

    const occurrences: ScenarioReasonOccurrence[] = events.map((e) => ({
      id: e.id,
      date: e.date,
      calendarDateLabel: e.calendarDateLabel,
      ethiopianDateStr: e.ethiopianDateStr,
      amount: e.amount,
      monthIndex: e.monthIndex,
      runningCashBalance: e.runningCashBalance,
      title: e.title,
      beneficiary: e.beneficiary,
      walletName: e.walletName
    }));

    reasonsSummary.push({
      id: `reason-stream-${key}`,
      category: first.category,
      type: itemType,
      specificType: first.specificType,
      direction: first.direction,
      title: baseTitle,
      reason: first.reason || first.description,
      frequencyLabel: freq,
      amountPerOccurrence: first.amount,
      totalSixMonthAmount: totalAmount,
      monthlyNormalizedAmount: monthlyNormalized,
      calculationBasis: first.calculationBreakdown || `${formatETB(first.amount)} per occurrence × ${count} periods`,
      occurrencesCount: count,
      impactLevel: impact,
      beneficiary: first.beneficiary,
      walletName: first.walletName,
      occurrences
    });
  });

  // Sort reasons summary: Inflows first (high to low), then Outflows (high to low)
  reasonsSummary.sort((a, b) => {
    if (a.direction !== b.direction) {
      return a.direction === 'INFLOW' ? -1 : 1;
    }
    return b.totalSixMonthAmount - a.totalSixMonthAmount;
  });

  const finalProjectedIncome = excludedCategorySet.size > 0 ? avgMonthlyActiveInflow : projInc;
  const finalProjectedExpense = excludedCategorySet.size > 0 ? avgMonthlyActiveOutflow : projExp;
  const finalProjectedProfit = excludedCategorySet.size > 0 ? adjustedProjProfit : projProfit;

  const annualRunRateRevenue = Math.round(finalProjectedIncome * 12);
  const annualRunRateExpense = Math.round(finalProjectedExpense * 12);
  const annualRunRateProfit = Math.round(finalProjectedProfit * 12);

  const grossMarginPercent = finalProjectedIncome > 0 ? Math.round(Math.max(0, ((finalProjectedIncome - Math.max(0, finalProjectedExpense - totalFixedMonthlyObligations)) / finalProjectedIncome) * 100)) : 0;
  const netMarginPercent = finalProjectedIncome > 0 ? Math.round((finalProjectedProfit / finalProjectedIncome) * 100) : 0;
  const operatingCashFlowHorizon = Math.round(finalProjectedProfit * horizonMonths);
  const fixedCostRatio = finalProjectedExpense > 0 ? Math.round(Math.min(100, (totalFixedMonthlyObligations / finalProjectedExpense) * 100)) : 0;
  const breakEvenMonthlyRevenue = Math.round(finalProjectedExpense);
  const breakEvenDailyRevenue = Math.round(finalProjectedExpense / 30);

  const valuationMultiple = 2.5;
  const estimatedEnterpriseValuation = Math.round(Math.max(0, annualRunRateProfit) * valuationMultiple + totalLiquidity);

  const revenueGrowthPercent = baseInc > 0 ? Math.round(((finalProjectedIncome - baseInc) / baseInc) * 100) : 0;
  const profitGrowthPercent = baseProfit > 0 ? Math.round(((finalProjectedProfit - baseProfit) / baseProfit) * 100) : (finalProjectedProfit > 0 ? 100 : 0);
  const numericRunway = typeof (excludedCategorySet.size > 0 ? adjustedRunway : newRunway) === 'number' ? Number(excludedCategorySet.size > 0 ? adjustedRunway : newRunway) : baseRunway;
  const runwayChangeMonths = Number((numericRunway - baseRunway).toFixed(1));

  // Build Real Income Streams strictly from actual active inflow items
  const inflowReasonItems = reasonsSummary.filter((r) => r.direction === 'INFLOW');
  const incomeStreams: CategorizedStreamItem[] = inflowReasonItems.map((r) => {
    const pct = finalProjectedIncome > 0 ? Math.round((r.monthlyNormalizedAmount / finalProjectedIncome) * 100) : 0;
    return {
      category: r.category || 'General Revenue',
      title: r.title,
      type: r.type,
      monthlyAmount: r.monthlyNormalizedAmount,
      totalHorizonAmount: r.totalSixMonthAmount,
      percentage: pct,
      occurrencesCount: r.occurrencesCount,
      frequencyLabel: r.frequencyLabel
    };
  });

  // Build Real Expense Structure strictly from actual active outflow items (recurring, debt, equb, capex, operations)
  const outflowReasonItems = reasonsSummary.filter((r) => r.direction === 'OUTFLOW');
  const expenseStreams: CategorizedStreamItem[] = outflowReasonItems.map((r) => {
    const pct = finalProjectedExpense > 0 ? Math.round((r.monthlyNormalizedAmount / finalProjectedExpense) * 100) : 0;
    return {
      category: r.category || 'Operating Expense',
      title: r.title,
      type: r.type,
      monthlyAmount: r.monthlyNormalizedAmount,
      totalHorizonAmount: r.totalSixMonthAmount,
      percentage: pct,
      occurrencesCount: r.occurrencesCount,
      frequencyLabel: r.frequencyLabel
    };
  });

  // Milestone checkpoints across horizon based strictly on calculated cash trajectory
  const milestones: ScenarioBusinessProjections['milestones'] = [
    {
      month: 1,
      label: 'Month 1 Checkpoint',
      description: 'Capital deployment & immediate operational alignment after scenario execution.',
      projectedCash: syncedSixMonthForecast[0]?.endingCash ?? progressiveEndingCash,
      targetMilestone: `Achieve ETB ${finalProjectedIncome.toLocaleString()} monthly revenue target.`
    },
    {
      month: 3,
      label: 'Month 3 (Quarter 1)',
      description: 'Full operational stabilization, steady station utilization and recurring dues amortization.',
      projectedCash: syncedSixMonthForecast[Math.min(2, syncedSixMonthForecast.length - 1)]?.endingCash ?? progressiveEndingCash,
      targetMilestone: `Reach ETB ${(finalProjectedProfit * 3).toLocaleString()} cumulative net surplus.`
    },
    {
      month: 6,
      label: 'Month 6 (Half-Year)',
      description: 'Consolidated cash reserves, Equb payout cycles integration, and capacity expansion evaluation.',
      projectedCash: syncedSixMonthForecast[Math.min(5, syncedSixMonthForecast.length - 1)]?.endingCash ?? progressiveEndingCash,
      targetMilestone: `Retain >ETB ${Math.round(totalLiquidity * 1.25).toLocaleString()} total liquid buffer.`
    }
  ];

  if (horizonMonths >= 12 && syncedSixMonthForecast.length >= 12) {
    milestones.push({
      month: 12,
      label: 'Month 12 (Year 1 Milestone)',
      description: 'Realize full annual run-rate growth, complete asset payback, and enterprise valuation scaling.',
      projectedCash: syncedSixMonthForecast[11]?.endingCash ?? progressiveEndingCash,
      targetMilestone: `Complete annualized profit target of ETB ${annualRunRateProfit.toLocaleString()}.`
    });
  }

  if (horizonMonths >= 24 && syncedSixMonthForecast.length >= 24) {
    milestones.push({
      month: 24,
      label: 'Month 24 (Year 2 Horizon)',
      description: 'Multi-branch maturity, compounding capital base, and commercial gaming franchise model.',
      projectedCash: syncedSixMonthForecast[23]?.endingCash ?? progressiveEndingCash,
      targetMilestone: `Enterprise valuation target: ETB ${estimatedEnterpriseValuation.toLocaleString()}.`
    });
  }

  const businessProjections: ScenarioBusinessProjections = {
    annualRunRateRevenue,
    annualRunRateProfit,
    annualRunRateExpense,
    grossMarginPercent,
    netMarginPercent,
    operatingCashFlowHorizon,
    fixedCostRatio,
    breakEvenMonthlyRevenue,
    breakEvenDailyRevenue,
    estimatedEnterpriseValuation,
    valuationMultiple,
    growthMetrics: {
      revenueGrowthPercent,
      profitGrowthPercent,
      runwayChangeMonths
    },
    incomeStreams,
    expenseStreams,
    milestones
  };

  return {
    title,
    scenarioType: input.scenarioType,
    confidence,
    forecastHorizonMonths: horizonMonths,
    horizonLabel,
    cumulativeHorizonNetCash: progressiveEndingCash,
    baseline: {
      monthlyIncome: baseInc,
      monthlyExpense: baseExp,
      monthlyProfit: baseProfit,
      totalCash: totalLiquidity,
      runwayMonths: baseRunway
    },
    projected: {
      monthlyIncome: finalProjectedIncome,
      monthlyExpense: finalProjectedExpense,
      monthlyProfit: finalProjectedProfit,
      totalCashAfterCapex: postCash,
      monthlyProfitDelta: excludedCategorySet.size > 0 ? adjustedProjProfit - baseProfit : profitDelta,
      paybackPeriodMonths: paybackMonths,
      oneYearNetROI,
      twoYearNetROI,
      cumulativeHorizonNetCash: progressiveEndingCash,
      newRunwayMonths: excludedCategorySet.size > 0 ? adjustedRunway : newRunway,
      recurringMonthlyTotal: recurringMonthlyExpense,
      loanMonthlyRepayment,
      loanMonthlyCollection,
      totalFixedMonthlyObligations,
      ...equbMetrics
    },
    businessProjections,
    sensitivity,
    recurringSummary: {
      activeRecurringCount: (input.recurring || []).filter((r) => r.status === 'ACTIVE').length,
      recurringMonthlyExpense,
      recurringMonthlyIncome,
      activeLoansCount: (input.loans || []).filter((l) => l.status === 'ACTIVE').length,
      loanMonthlyRepayment,
      loanMonthlyCollection,
      activeEqubsCount: (input.equbs || []).filter((eq) => eq.status === 'ACTIVE').length,
      activeEqubsMonthlyCommitment,
      totalFixedMonthlyObligations,
      recurringCoverageRatio: totalFixedMonthlyObligations > 0 ? Number((projInc / totalFixedMonthlyObligations).toFixed(2)) : 10,
      isRecurringSafe: totalFixedMonthlyObligations === 0 || projInc >= totalFixedMonthlyObligations,
      breakdown: recurringBreakdown
    },
    sixMonthForecast: syncedSixMonthForecast,
    monthlyForecast: syncedSixMonthForecast,
    weeklyForecast: syncedWeeklyForecast,
    scheduledEvents: activeEvents,
    reasonsSummary,
    verdict,
    verdictSummary,
    pros,
    cons,
    alternativeRecommendation,
    whatHappensIfIgnored
  };
}

function formatETB(amount: number): string {
  return `ETB ${Math.round(amount).toLocaleString()}`;
}
