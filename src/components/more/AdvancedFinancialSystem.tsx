import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Calculator,
  Scale,
  Percent,
  Clock,
  CheckCircle2,
  Sliders,
  Coins,
  Building2,
  Calendar,
  AlertCircle,
  FileCheck,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  RefreshCw,
  Layers,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Wallet,
  User,
  Car,
  Check,
  ShieldCheck,
  Info,
  ArrowRight,
  List,
  Grid,
  CalendarClock,
  CreditCard,
  Users,
  ChevronRight
} from 'lucide-react';
import { ERPState } from '../../types';
import { formatETB, calculateTotalBusinessBalance, calculateWalletBalance } from '../../lib/store';
import { formatEthiopianDate } from '../../lib/ethiopianCalendar';
import { triggerHaptic } from '../../lib/haptics';

export interface NextMonthExpenseDetail {
  id: string;
  title: string;
  category: string;
  categoryType: 'UTILITIES' | 'TRANSPORT' | 'EQUB' | 'LOAN' | 'OPERATIONS' | 'TAX' | 'MAINTENANCE' | 'RECURRING';
  amount: number;
  dateStr: string;
  calendarDateLabel: string;
  ethiopianDateStr: string;
  walletName: string;
  walletId?: string;
  beneficiary?: string;
  frequency: string;
  reason: string;
  calculationBasis: string;
  isEssential: boolean;
  notes?: string;
  status: 'SCHEDULED' | 'PENDING' | 'PAID';
}

interface CategoryBudget {
  category: string;
  monthlyLimit: number;
}

interface TaxQuarterRecord {
  quarterLabel: string;
  year: number;
  dueDate: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  paidDate?: string;
}

export const AdvancedFinancialSystem: React.FC<{ state: ERPState }> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'liquidity' | 'budgeting' | 'predictive' | 'fixed_tax' | 'yield_model'
  >('overview');

  // Budget Caps State
  const [budgets, setBudgets] = useState<CategoryBudget[]>(() => {
    try {
      const saved = localStorage.getItem('pluszone_category_budgets');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { category: 'Rent & Utilities', monthlyLimit: 45000 },
      { category: 'Salaries & Wages', monthlyLimit: 120000 },
      { category: 'PS5 & Gaming Hardware Maintenance', monthlyLimit: 25000 },
      { category: 'Inventory & Supplies', monthlyLimit: 60000 },
      { category: 'Marketing & Advertising', monthlyLimit: 15000 },
      { category: 'Miscellaneous Expense', monthlyLimit: 10000 }
    ];
  });

  const [newBudgetCat, setNewBudgetCat] = useState('');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');

  // Fixed Quarterly Tax State
  const [fixedQuarterlyTaxAmount, setFixedQuarterlyTaxAmount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pluszone_fixed_quarterly_tax_amount');
      if (saved) return Number(saved);
    } catch {}
    return 15000; // Default ETB 15,000 every 3 months
  });

  const [quarterlyTaxRecords, setQuarterlyTaxRecords] = useState<TaxQuarterRecord[]>(() => {
    try {
      const saved = localStorage.getItem('pluszone_quarterly_tax_records');
      if (saved) return JSON.parse(saved);
    } catch {}
    const curYear = new Date().getFullYear();
    return [
      { quarterLabel: 'Q1 (Jan - Mar)', year: curYear, dueDate: `${curYear}-03-30`, amount: 15000, status: 'PAID', paidDate: `${curYear}-03-25` },
      { quarterLabel: 'Q2 (Apr - Jun)', year: curYear, dueDate: `${curYear}-06-30`, amount: 15000, status: 'PAID', paidDate: `${curYear}-06-28` },
      { quarterLabel: 'Q3 (Jul - Sep)', year: curYear, dueDate: `${curYear}-09-30`, amount: 15000, status: 'PENDING' },
      { quarterLabel: 'Q4 (Oct - Dec)', year: curYear, dueDate: `${curYear}-12-30`, amount: 15000, status: 'PENDING' }
    ];
  });

  // Break-Even Calculator State
  const [fixedCostsInput, setFixedCostsInput] = useState<number>(75000);
  const [avgTicketPrice, setAvgTicketPrice] = useState<number>(250);
  const [varCostPerTicket, setVarCostPerTicket] = useState<number>(50);

  // Investment Yield Calculator State
  const [principalInput, setPrincipalInput] = useState<number>(100000);
  const [annualReturnRate, setAnnualReturnRate] = useState<number>(14.5);
  const [investmentYears, setInvestmentYears] = useState<number>(3);

  // Next Month Cashflow & Liquidity Filter States
  const [nextMonthCatFilter, setNextMonthCatFilter] = useState<string>('ALL');
  const [nextMonthSearch, setNextMonthSearch] = useState<string>('');
  const [nextMonthViewMode, setNextMonthViewMode] = useState<'cards' | 'table' | 'weekly'>('cards');
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Save budgets
  const handleSaveBudget = (cat: string, limit: number) => {
    triggerHaptic('medium');
    const updated = budgets.map(b => (b.category === cat ? { ...b, monthlyLimit: limit } : b));
    if (!updated.some(b => b.category === cat)) {
      updated.push({ category: cat, monthlyLimit: limit });
    }
    setBudgets(updated);
    try {
      localStorage.setItem('pluszone_category_budgets', JSON.stringify(updated));
    } catch {}
    showToast(`✓ Budget for ${cat} updated to ${formatETB(limit)}`);
  };

  const handleAddBudget = () => {
    if (!newBudgetCat.trim() || !newBudgetLimit || isNaN(Number(newBudgetLimit))) return;
    handleSaveBudget(newBudgetCat.trim(), Number(newBudgetLimit));
    setNewBudgetCat('');
    setNewBudgetLimit('');
  };

  // Update Fixed Quarterly Tax Amount
  const handleUpdateFixedTax = (newAmt: number) => {
    triggerHaptic('medium');
    setFixedQuarterlyTaxAmount(newAmt);
    try {
      localStorage.setItem('pluszone_fixed_quarterly_tax_amount', newAmt.toString());
    } catch {}

    // Update pending quarters with new amount
    const updatedRecords = quarterlyTaxRecords.map(r =>
      r.status === 'PENDING' ? { ...r, amount: newAmt } : r
    );
    setQuarterlyTaxRecords(updatedRecords);
    try {
      localStorage.setItem('pluszone_quarterly_tax_records', JSON.stringify(updatedRecords));
    } catch {}

    showToast(`✓ Fixed 3-Month Tax updated to ${formatETB(newAmt)}`);
  };

  // Toggle Quarterly Tax Payment Status
  const handleToggleTaxPaid = (index: number) => {
    triggerHaptic('medium');
    const updated = [...quarterlyTaxRecords];
    const rec = updated[index];
    if (rec.status === 'PAID') {
      rec.status = 'PENDING';
      delete rec.paidDate;
      showToast(`Quarter ${rec.quarterLabel} marked as Unpaid`);
    } else {
      rec.status = 'PAID';
      rec.paidDate = new Date().toISOString().split('T')[0];
      showToast(`✓ Quarter ${rec.quarterLabel} tax payment recorded (${formatETB(rec.amount)})`);
    }
    setQuarterlyTaxRecords(updated);
    try {
      localStorage.setItem('pluszone_quarterly_tax_records', JSON.stringify(updated));
    } catch {}
  };

  // 1. FINANCIAL METRICS COMPUTATION
  const totalLiquidity = useMemo(
    () => calculateTotalBusinessBalance(state.wallets, state.transactions, state.transfers),
    [state.wallets, state.transactions, state.transfers]
  );

  // Current Month Financials
  const currentMonthFinancials = useMemo(() => {
    const now = new Date();
    const curMonthTxs = state.transactions.filter(t => {
      if (t.reversed) return false;
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const income = curMonthTxs.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const expense = curMonthTxs.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    const netProfit = income - expense;
    const profitMarginPct = income > 0 ? (netProfit / income) * 100 : 0;

    // Receivables (Uncollected Customer Debts)
    const totalReceivablesOwed = state.receivables
      .filter(r => r.status !== 'COLLECTED')
      .reduce((acc, r) => acc + (r.amountOwed - r.amountCollected), 0);

    return { income, expense, netProfit, profitMarginPct, totalReceivablesOwed };
  }, [state.transactions, state.receivables]);

  // Monthly Expenses by Category
  const categoryExpensesMap = useMemo(() => {
    const now = new Date();
    const map: { [cat: string]: number } = {};
    state.transactions.forEach(t => {
      if (t.type === 'EXPENSE' && !t.reversed) {
        const d = new Date(t.date);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          map[t.category] = (map[t.category] || 0) + t.amount;
        }
      }
    });
    return map;
  }, [state.transactions]);

  // Financial Health Ratios
  const monthlyFixedTaxAllowance = fixedQuarterlyTaxAmount / 3;
  const monthlyAvgBurn = Math.max(1, currentMonthFinancials.expense + monthlyFixedTaxAllowance || 35000);
  const runwayMonths = Math.min(99, Math.max(0, totalLiquidity / monthlyAvgBurn));

  // Current Assets vs Liabilities
  const currentAssets = totalLiquidity + currentMonthFinancials.totalReceivablesOwed;
  const estimatedLiabilities = Math.max(1, currentMonthFinancials.expense + monthlyFixedTaxAllowance);
  const currentRatio = currentAssets / estimatedLiabilities;
  const quickRatio = totalLiquidity / estimatedLiabilities;

  // Next Pending Tax Payment Info
  const nextPendingQuarter = quarterlyTaxRecords.find(r => r.status === 'PENDING') || quarterlyTaxRecords[quarterlyTaxRecords.length - 1];

  // 1.5 NEXT MONTH CASHFLOW & DETAILED LIQUIDITY EXPENSE ENGINE
  const nextMonthLiquidityData = useMemo(() => {
    const now = new Date();
    const nextMonthYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const nextMonthIdx = (now.getMonth() + 1) % 12;
    const nextMonthDate = new Date(nextMonthYear, nextMonthIdx, 1);
    const daysInNextMonth = new Date(nextMonthYear, nextMonthIdx + 1, 0).getDate();

    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLabel = `${monthNamesEn[nextMonthIdx]} ${nextMonthYear}`;
    const ethiopianDateRangeStr = `${formatEthiopianDate(nextMonthDate)} - ${formatEthiopianDate(new Date(nextMonthYear, nextMonthIdx, daysInNextMonth))}`;

    const items: NextMonthExpenseDetail[] = [];

    // Helper to get wallet info
    const getWalletInfo = (walletId?: string, fallback = 'Telebirr Working Balance') => {
      if (!walletId) return { name: fallback, balance: 0 };
      const w = state.wallets.find(x => x.id === walletId);
      if (!w) return { name: fallback, balance: 0 };
      const bal = calculateWalletBalance(w, state.transactions, state.transfers);
      return { name: w.name, balance: bal };
    };

    const telebirrWallet = state.wallets.find(w => w.type === 'TELEBIRR' || w.name.toLowerCase().includes('telebirr')) || state.wallets[0];
    const telebirrName = telebirrWallet?.name || 'Telebirr Working Balance';

    const cbeWallet = state.wallets.find(w => w.type === 'CBE_BANK' || w.name.toLowerCase().includes('cbe')) || state.wallets[0];
    const cbeName = cbeWallet?.name || 'CBE Commercial Account';

    const cashWallet = state.wallets.find(w => w.type === 'CASH' || w.name.toLowerCase().includes('cash')) || state.wallets[0];
    const cashName = cashWallet?.name || 'Cash Vault';

    // 1. Staff Transportation Stipends (3 disbursements: 5th, 15th, 25th)
    const transportDays = [
      { day: 5, payee: 'Shift Tech #1 (Mobility Allowance)', amount: 1500, id: 'nm-trans-1' },
      { day: 15, payee: 'Shift Tech #2 (Mobility Allowance)', amount: 1500, id: 'nm-trans-2' },
      { day: 25, payee: 'Shift Tech #3 (Mobility Allowance)', amount: 1500, id: 'nm-trans-3' }
    ];

    transportDays.forEach(td => {
      const gDate = new Date(nextMonthYear, nextMonthIdx, td.day);
      items.push({
        id: td.id,
        title: `Staff Transport Stipend • Day ${td.day}`,
        category: 'Transportation',
        categoryType: 'TRANSPORT',
        amount: td.amount,
        dateStr: gDate.toISOString().split('T')[0],
        calendarDateLabel: `${monthNamesEn[nextMonthIdx]} ${td.day}, ${nextMonthYear}`,
        ethiopianDateStr: formatEthiopianDate(gDate),
        walletName: telebirrName,
        walletId: telebirrWallet?.id,
        beneficiary: td.payee,
        frequency: '3x Monthly (5th, 15th, 25th)',
        reason: 'Contractual technician transportation and mobility allowance ensuring on-time lounge shifts & opening continuity.',
        calculationBasis: 'Fixed operational travel stipend: ETB 1,500 / recipient',
        isEssential: true,
        notes: `Disbursed directly to ${td.payee} via Telebirr scheduled transfer.`,
        status: 'SCHEDULED'
      });
    });

    // 2. Dedicated Utility Commitments
    // a. Ethio Telecom High-Speed Fiber Internet (1st of month)
    const internetDate = new Date(nextMonthYear, nextMonthIdx, 1);
    items.push({
      id: 'nm-util-internet',
      title: 'Ethio Telecom Dedicated High-Speed Fiber Broadband',
      category: 'Utilities & Internet',
      categoryType: 'UTILITIES',
      amount: 1010,
      dateStr: internetDate.toISOString().split('T')[0],
      calendarDateLabel: `${monthNamesEn[nextMonthIdx]} 1, ${nextMonthYear}`,
      ethiopianDateStr: formatEthiopianDate(internetDate),
      walletName: telebirrName,
      walletId: telebirrWallet?.id,
      beneficiary: 'Ethio Telecom (Enterprise Fiber Division)',
      frequency: 'Monthly (1st)',
      reason: 'Dedicated high-speed fiber internet subscription for multiplayer PlayStation Network (PSN) gaming, live streaming, and cloud save synchronization.',
      calculationBasis: 'Monthly fixed ISP package tariff: ETB 1,010 / month',
      isEssential: true,
      notes: 'Required for multiplayer matches, firmware updates & patron Wi-Fi access.',
      status: 'SCHEDULED'
    });

    // b. Ethiopian Electric Utility (EEU) Commercial Power (10th of month)
    const elecDate = new Date(nextMonthYear, nextMonthIdx, 10);
    items.push({
      id: 'nm-util-electricity',
      title: 'Ethiopian Electric Utility (EEU) 3-Phase Commercial Power',
      category: 'Utilities & Internet',
      categoryType: 'UTILITIES',
      amount: 4200,
      dateStr: elecDate.toISOString().split('T')[0],
      calendarDateLabel: `${monthNamesEn[nextMonthIdx]} 10, ${nextMonthYear}`,
      ethiopianDateStr: formatEthiopianDate(elecDate),
      walletName: cbeName,
      walletId: cbeWallet?.id,
      beneficiary: 'Ethiopian Electric Utility (EEU)',
      frequency: 'Monthly (10th)',
      reason: 'Continuous commercial electrical supply powering 12+ PlayStation 5 stations, 4K HDR display arrays, and venue cooling.',
      calculationBasis: 'Metered commercial grid consumption rate: ~ETB 4,200 / month based on active gaming load',
      isEssential: true,
      notes: 'Direct post-paid bill settlement via CBE Corporate Banking.',
      status: 'SCHEDULED'
    });

    // c. Municipal Water & Sanitation Utility (12th of month)
    const waterDate = new Date(nextMonthYear, nextMonthIdx, 12);
    items.push({
      id: 'nm-util-water',
      title: 'Municipal Water & Sanitation Utility Subscription',
      category: 'Utilities & Internet',
      categoryType: 'UTILITIES',
      amount: 450,
      dateStr: waterDate.toISOString().split('T')[0],
      calendarDateLabel: `${monthNamesEn[nextMonthIdx]} 12, ${nextMonthYear}`,
      ethiopianDateStr: formatEthiopianDate(waterDate),
      walletName: telebirrName,
      walletId: telebirrWallet?.id,
      beneficiary: 'Addis Ababa Water & Sewerage Authority (AAWSA)',
      frequency: 'Monthly (12th)',
      reason: 'Lounge sanitation, patron restroom amenities, and cafe counter beverage preparation water supply.',
      calculationBasis: 'Standard commercial municipal water tariff: ETB 450 / month',
      isEssential: true,
      notes: 'Settled via Telebirr bill payment portal.',
      status: 'SCHEDULED'
    });

    // 3. Equb Circle Contributions for Next Month
    state.equbs.forEach((eq, eqIdx) => {
      if (eq.status === 'ACTIVE') {
        const nextRound = (eq.currentRound || 0) + 1;
        const totalRounds = eq.totalRounds || (eq.members ? eq.members.length : 10);
        if (nextRound <= totalRounds) {
          const eqDate = new Date(nextMonthYear, nextMonthIdx, 15);
          const eqWallet = getWalletInfo(eq.walletId, cbeName);
          const roundAmt = eq.contributionPerRound || 5000;
          const membersTotal = eq.members ? eq.members.length : 10;
          items.push({
            id: `nm-equb-${eq.id || eqIdx}`,
            title: `${eq.name} • Round #${nextRound} Contribution`,
            category: 'Equb Contribution',
            categoryType: 'EQUB',
            amount: roundAmt,
            dateStr: eqDate.toISOString().split('T')[0],
            calendarDateLabel: `${monthNamesEn[nextMonthIdx]} ${eqDate.getDate()}, ${nextMonthYear}`,
            ethiopianDateStr: formatEthiopianDate(eqDate),
            walletName: eqWallet.name,
            walletId: eq.walletId,
            beneficiary: `Equb Pool Admin (${eq.name})`,
            frequency: eq.interval || 'Monthly',
            reason: `Mandatory rotating savings commitment for Round #${nextRound}/${totalRounds} to maintain spotless credit standing and secure pool eligibility.`,
            calculationBasis: `Contractual slot contribution: ETB ${roundAmt.toLocaleString()} per round`,
            isEssential: true,
            notes: `Circle pool payout of ${formatETB(roundAmt * membersTotal)} expected on designated winning draw.`,
            status: 'SCHEDULED'
          });
        }
      }
    });

    // 4. Loan & Debt Repayment Installments for Next Month
    state.loans.forEach((ln, lnIdx) => {
      if (ln.status === 'ACTIVE' && ln.outstandingBalance > 0 && ln.direction !== 'LENT') {
        const lnDate = ln.dueDate ? new Date(ln.dueDate) : new Date(nextMonthYear, nextMonthIdx, 20);
        const lnWallet = getWalletInfo(ln.walletId, cbeName);
        const installment = ln.outstandingBalance >= 1000
          ? Math.min(Math.max(1000, ln.monthlyInstallment || 6000), ln.outstandingBalance)
          : ln.outstandingBalance;
        items.push({
          id: `nm-loan-${ln.id || lnIdx}`,
          title: `${ln.counterparty || ln.title || 'Commercial Facility'} • Loan Installment`,
          category: 'Debt Repayment',
          categoryType: 'LOAN',
          amount: installment,
          dateStr: lnDate.toISOString().split('T')[0],
          calendarDateLabel: `${monthNamesEn[nextMonthIdx]} ${lnDate.getDate()}, ${nextMonthYear}`,
          ethiopianDateStr: formatEthiopianDate(lnDate),
          walletName: lnWallet.name,
          walletId: ln.walletId,
          beneficiary: ln.counterparty || 'Commercial Lending Desk',
          frequency: 'Monthly (20th)',
          reason: `Contractual monthly principal and interest debt servicing. Remaining loan balance after payment: ETB ${(ln.outstandingBalance - installment).toLocaleString()}.`,
          calculationBasis: `Monthly amortized installment: ETB ${installment.toLocaleString()}`,
          isEssential: true,
          notes: `Helps maintain bank credit rating and avoid penalty interest surcharges.`,
          status: 'SCHEDULED'
        });
      }
    });

    // 5. Staff Salaries & Shift Operations (25th of month)
    const staffDate = new Date(nextMonthYear, nextMonthIdx, 25);
    items.push({
      id: 'nm-staff-operations',
      title: 'Lounge Technician Salaries, Shift Stipends & Operations',
      category: 'Salaries & Wages',
      categoryType: 'OPERATIONS',
      amount: 28000,
      dateStr: staffDate.toISOString().split('T')[0],
      calendarDateLabel: `${monthNamesEn[nextMonthIdx]} 25, ${nextMonthYear}`,
      ethiopianDateStr: formatEthiopianDate(staffDate),
      walletName: cbeName,
      walletId: cbeWallet?.id,
      beneficiary: 'PlusZone Floor Staff & Tech Crew',
      frequency: 'Monthly (25th)',
      reason: 'Compensation for senior gaming technicians, front-desk receptionists, cleaning crew, and shift supervisors.',
      calculationBasis: 'Core team monthly payroll budget: ETB 28,000 / month',
      isEssential: true,
      notes: 'Direct salary batch transfer to employee accounts on the 25th of each month.',
      status: 'SCHEDULED'
    });

    // 6. PS5 Hardware Maintenance & Consumables Reserve (18th of month)
    const maintDate = new Date(nextMonthYear, nextMonthIdx, 18);
    items.push({
      id: 'nm-hardware-maintenance',
      title: 'PlayStation 5 Controller Spares & Hardware Maintenance',
      category: 'PS5 & Gaming Hardware Maintenance',
      categoryType: 'MAINTENANCE',
      amount: 3500,
      dateStr: maintDate.toISOString().split('T')[0],
      calendarDateLabel: `${monthNamesEn[nextMonthIdx]} 18, ${nextMonthYear}`,
      ethiopianDateStr: formatEthiopianDate(maintDate),
      walletName: cashName,
      walletId: cashWallet?.id,
      beneficiary: 'Hardware Tech Supplies & Electronics Vendor',
      frequency: 'Monthly (18th)',
      reason: 'DualSense analog thumbstick replacements, conductive silicone button pads, compressed air dust clearance, and HDMI 2.1 cable spares.',
      calculationBasis: 'Monthly preventive maintenance reserve: ETB 3,500',
      isEssential: false,
      notes: 'Preserves high console uptime and responsive controller triggers for tournament play.',
      status: 'SCHEDULED'
    });

    // 7. Fixed Quarterly Tax Reserve Allocation (30th of month)
    const taxDate = new Date(nextMonthYear, nextMonthIdx, daysInNextMonth);
    const taxMonthly = Math.round(fixedQuarterlyTaxAmount / 3);
    items.push({
      id: 'nm-tax-reserve',
      title: 'Fixed 3-Month Tax Reserve Allocation (1/3 Quarterly Allowance)',
      category: 'Tax & Compliance',
      categoryType: 'TAX',
      amount: taxMonthly,
      dateStr: taxDate.toISOString().split('T')[0],
      calendarDateLabel: `${monthNamesEn[nextMonthIdx]} ${daysInNextMonth}, ${nextMonthYear}`,
      ethiopianDateStr: formatEthiopianDate(taxDate),
      walletName: cbeName,
      walletId: cbeWallet?.id,
      beneficiary: 'Ministry of Revenues (Fixed Category C Assessment)',
      frequency: 'Monthly Allocation (for 3-Month Cycle)',
      reason: `Systematic monthly reserve accumulation (ETB ${taxMonthly.toLocaleString()}/mo) to fully fund the upcoming ETB ${fixedQuarterlyTaxAmount.toLocaleString()} quarterly tax payment without liquidity strain.`,
      calculationBasis: `1/3 of fixed quarterly tax: ETB ${fixedQuarterlyTaxAmount.toLocaleString()} / 3 = ETB ${taxMonthly.toLocaleString()}`,
      isEssential: true,
      notes: 'Held in CBE working capital account for quarterly clearance.',
      status: 'SCHEDULED'
    });

    // 8. Any Other Active Custom Recurring Templates from state.recurring
    state.recurring.forEach((rec, rIdx) => {
      if (
        rec.status === 'ACTIVE' &&
        rec.type === 'EXPENSE' &&
        !rec.id.includes('rent') &&
        !items.some(i => i.title.toLowerCase().includes(rec.title.toLowerCase()))
      ) {
        const rDate = rec.nextDueDate ? new Date(rec.nextDueDate) : new Date(nextMonthYear, nextMonthIdx, 15);
        const rWallet = getWalletInfo(rec.walletId, telebirrName);
        items.push({
          id: `nm-custom-rec-${rec.id || rIdx}`,
          title: rec.title,
          category: rec.category || 'Recurring Expense',
          categoryType: 'RECURRING',
          amount: rec.amount,
          dateStr: rDate.toISOString().split('T')[0],
          calendarDateLabel: `${monthNamesEn[nextMonthIdx]} ${rDate.getDate()}, ${nextMonthYear}`,
          ethiopianDateStr: formatEthiopianDate(rDate),
          walletName: rWallet.name,
          walletId: rec.walletId,
          beneficiary: 'Vendor / Service Provider',
          frequency: rec.frequency || 'Monthly',
          reason: rec.notes || 'Scheduled recurring operational subscription or service fee.',
          calculationBasis: `Configured template amount: ETB ${rec.amount.toLocaleString()}`,
          isEssential: false,
          notes: rec.notes || 'Automated recurring commitment.',
          status: 'SCHEDULED'
        });
      }
    });

    // Sort items chronologically by date
    items.sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());

    // Compute Totals
    const totalOutflows = items.reduce((sum, item) => sum + item.amount, 0);

    const recent30dInflow = state.transactions
      .filter(t => t.type === 'INCOME' && !t.reversed)
      .reduce((s, t) => s + t.amount, 0);
    const projectedInflows = Math.max(recent30dInflow > 0 ? recent30dInflow : 145000, 145000);
    const netCashflow = projectedInflows - totalOutflows;
    const endingLiquidity = totalLiquidity + netCashflow;
    const nextMonthRunway = endingLiquidity / Math.max(1, totalOutflows);

    // Category Breakdown Map
    const catMap: { [cat: string]: { total: number; count: number } } = {};
    items.forEach(i => {
      if (!catMap[i.category]) {
        catMap[i.category] = { total: 0, count: 0 };
      }
      catMap[i.category].total += i.amount;
      catMap[i.category].count += 1;
    });

    // Wallet Breakdown Map
    const walletMap: { [w: string]: number } = {};
    items.forEach(i => {
      walletMap[i.walletName] = (walletMap[i.walletName] || 0) + i.amount;
    });

    // Weekly Buckets (Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-End)
    const week1 = items.filter(i => { const d = new Date(i.dateStr).getDate(); return d >= 1 && d <= 7; });
    const week2 = items.filter(i => { const d = new Date(i.dateStr).getDate(); return d >= 8 && d <= 14; });
    const week3 = items.filter(i => { const d = new Date(i.dateStr).getDate(); return d >= 15 && d <= 21; });
    const week4 = items.filter(i => { const d = new Date(i.dateStr).getDate(); return d >= 22; });

    return {
      monthLabel,
      ethiopianDateRangeStr,
      items,
      totalOutflows,
      projectedInflows,
      netCashflow,
      startingLiquidity: totalLiquidity,
      endingLiquidity,
      nextMonthRunway,
      catMap,
      walletMap,
      weeks: [
        { label: 'Week 1 (Days 1–7)', items: week1, total: week1.reduce((s, x) => s + x.amount, 0) },
        { label: 'Week 2 (Days 8–14)', items: week2, total: week2.reduce((s, x) => s + x.amount, 0) },
        { label: 'Week 3 (Days 15–21)', items: week3, total: week3.reduce((s, x) => s + x.amount, 0) },
        { label: 'Week 4 (Days 22–End)', items: week4, total: week4.reduce((s, x) => s + x.amount, 0) }
      ]
    };
  }, [state.wallets, state.transactions, state.transfers, state.recurring, state.equbs, state.loans, fixedQuarterlyTaxAmount, totalLiquidity]);

  // Compound Yield Calculator
  const projectedYield = useMemo(() => {
    const r = annualReturnRate / 100;
    const compound = principalInput * Math.pow(1 + r, investmentYears);
    const totalEarnings = compound - principalInput;
    return { finalAmount: compound, totalEarnings };
  }, [principalInput, annualReturnRate, investmentYears]);

  // Break-even Unit Calculation
  const marginPerUnit = avgTicketPrice - varCostPerTicket;
  const breakEvenUnits = marginPerUnit > 0 ? Math.ceil(fixedCostsInput / marginPerUnit) : 0;
  const breakEvenRevenue = breakEvenUnits * avgTicketPrice;

  // 3-Month Predictive Expense Forecasting Engine
  const predictiveBudgetData = useMemo(() => {
    const now = new Date();

    const getMonthDetails = (monthsBack: number) => {
      const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' })
      };
    };

    const m1 = getMonthDetails(1);
    const m2 = getMonthDetails(2);
    const m3 = getMonthDetails(3);

    const m1Expenses: { [cat: string]: number } = {};
    const m2Expenses: { [cat: string]: number } = {};
    const m3Expenses: { [cat: string]: number } = {};

    const categoriesSet = new Set<string>();
    budgets.forEach(b => categoriesSet.add(b.category));

    state.transactions.forEach(t => {
      if (t.type === 'EXPENSE' && !t.reversed) {
        const d = new Date(t.date);
        const ty = d.getFullYear();
        const tm = d.getMonth();

        categoriesSet.add(t.category);

        if (ty === m1.year && tm === m1.month) {
          m1Expenses[t.category] = (m1Expenses[t.category] || 0) + t.amount;
        } else if (ty === m2.year && tm === m2.month) {
          m2Expenses[t.category] = (m2Expenses[t.category] || 0) + t.amount;
        } else if (ty === m3.year && tm === m3.month) {
          m3Expenses[t.category] = (m3Expenses[t.category] || 0) + t.amount;
        }
      }
    });

    const categoryProjections = Array.from(categoriesSet).map(cat => {
      const v1 = m1Expenses[cat] || 0;
      const v2 = m2Expenses[cat] || 0;
      const v3 = m3Expenses[cat] || 0;

      let projectedAmt = 0;
      if (v1 > 0 && v2 > 0 && v3 > 0) {
        projectedAmt = v1 * 0.5 + v2 * 0.3 + v3 * 0.2;
      } else {
        const active = [v1, v2, v3].filter(v => v > 0);
        if (active.length > 0) {
          projectedAmt = active.reduce((a, b) => a + b, 0) / active.length;
        } else {
          const budgetObj = budgets.find(b => b.category === cat);
          projectedAmt = categoryExpensesMap[cat] || budgetObj?.monthlyLimit || 0;
        }
      }

      projectedAmt = Math.round(projectedAmt);

      const budgetObj = budgets.find(b => b.category === cat);
      const hasCap = !!budgetObj;
      const budgetCap = budgetObj ? budgetObj.monthlyLimit : 0;
      const discrepancy = hasCap ? projectedAmt - budgetCap : 0;
      const pctOfCap = hasCap && budgetCap > 0 ? (projectedAmt / budgetCap) * 100 : 0;

      let status: 'OVER_BUDGET' | 'HIGH_RISK' | 'ON_TRACK' | 'UNBUDGETED' = 'ON_TRACK';
      if (!hasCap && projectedAmt > 0) {
        status = 'UNBUDGETED';
      } else if (hasCap && discrepancy > 0) {
        status = 'OVER_BUDGET';
      } else if (hasCap && pctOfCap >= 85) {
        status = 'HIGH_RISK';
      }

      const prevAvg = (v2 + v3) / 2;
      let trendPct = 0;
      if (prevAvg > 0) {
        trendPct = Math.round(((v1 - prevAvg) / prevAvg) * 100);
      }

      return {
        category: cat,
        m1Amount: v1,
        m2Amount: v2,
        m3Amount: v3,
        projectedAmt,
        budgetCap,
        hasCap,
        discrepancy,
        pctOfCap,
        status,
        trendPct
      };
    });

    categoryProjections.sort((a, b) => {
      if (a.status === 'OVER_BUDGET' && b.status !== 'OVER_BUDGET') return -1;
      if (b.status === 'OVER_BUDGET' && a.status !== 'OVER_BUDGET') return 1;
      return b.discrepancy - a.discrepancy;
    });

    const totalProjected = categoryProjections.reduce((a, c) => a + c.projectedAmt, 0);
    const totalBudgeted = budgets.reduce((a, b) => a + b.monthlyLimit, 0);
    const netDiscrepancy = totalProjected - totalBudgeted;
    const overBudgetCount = categoryProjections.filter(c => c.status === 'OVER_BUDGET').length;

    return {
      m1Label: m1.label,
      m2Label: m2.label,
      m3Label: m3.label,
      categoryProjections,
      totalProjected,
      totalBudgeted,
      netDiscrepancy,
      overBudgetCount
    };
  }, [state.transactions, budgets, categoryExpensesMap]);

  const handleApplyProjectedBudgets = () => {
    triggerHaptic('success');
    const updatedBudgets: CategoryBudget[] = predictiveBudgetData.categoryProjections.map(cp => {
      const targetLimit = Math.max(5000, Math.ceil((cp.projectedAmt * 1.1) / 1000) * 1000);
      return {
        category: cp.category,
        monthlyLimit: targetLimit
      };
    });

    setBudgets(updatedBudgets);
    try {
      localStorage.setItem('pluszone_category_budgets', JSON.stringify(updatedBudgets));
    } catch {}
    showToast(`✓ Auto-adjusted ${updatedBudgets.length} category budget caps to 3-month projections (+10% buffer)`);
  };

  const handleUpdateSingleCap = (categoryName: string, newLimit: number) => {
    triggerHaptic('light');
    const updated = budgets.filter(b => b.category !== categoryName);
    updated.push({ category: categoryName, monthlyLimit: Math.max(0, newLimit) });
    setBudgets(updated);
    try {
      localStorage.setItem('pluszone_category_budgets', JSON.stringify(updated));
    } catch {}
    showToast(`Updated budget cap for ${categoryName}`);
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm p-4 rounded-2xl bg-slate-900/95 border border-emerald-500/40 text-emerald-400 font-extrabold text-xs shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-slideDown">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* EXECUTIVE FINANCIAL CONTROL HEADER */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0A0E1A] to-[#131926] border border-slate-800 dark:border-[#1E2D40] rounded-3xl p-6 shadow-2xl text-white space-y-6 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#00D4AA] text-xs font-black uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              <span>Enterprise Financial System & Treasury Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Financial Intelligence Hub & Cash Liquidity Matrix</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Real-time liquidity forecasting, cash runway burn analysis, category budget variance control, 3-month fixed quarterly tax assessment tracking, and break-even revenue modeler (ETB standard).
            </p>
          </div>

          {/* Quick Balance & Runway Metric Cards */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Total Vault Liquidity
              </span>
              <p className="text-lg font-black text-[#00D4AA] font-mono">
                {formatETB(totalLiquidity)}
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Cash Runway Buffer
              </span>
              <p className="text-lg font-black text-amber-400 font-mono flex items-center gap-1">
                <span>{runwayMonths.toFixed(1)} Months</span>
              </p>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 text-slate-300 font-mono text-[11px] flex items-center gap-1.5 border border-slate-700/60">
              <Scale className="w-3.5 h-3.5 text-indigo-400" />
              <span>Current Ratio: {currentRatio.toFixed(2)}x ({currentRatio >= 1.5 ? 'Optimal' : 'Caution'})</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 text-slate-300 font-mono text-[11px] flex items-center gap-1.5 border border-slate-700/60">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              <span>Net Profit Margin: {currentMonthFinancials.profitMarginPct.toFixed(1)}%</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 text-slate-300 font-mono text-[11px] flex items-center gap-1.5 border border-slate-700/60">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Fixed 3-Month Tax: {formatETB(fixedQuarterlyTaxAmount)} / Qtr</span>
            </span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200 dark:border-[#1E2D40]">
        {[
          { id: 'overview' as const, label: 'Financial Executive Overview', icon: BarChart3 },
          { id: 'liquidity' as const, label: 'Next Month Cashflow & Liquidity', icon: Scale },
          { id: 'budgeting' as const, label: 'Smart Category Budgeting', icon: Sliders },
          { id: 'predictive' as const, label: 'Predictive 3-Mo Budgeting', icon: Sparkles },
          { id: 'fixed_tax' as const, label: '3-Month Fixed Tax Schedule', icon: Calendar },
          { id: 'yield_model' as const, label: 'Investment Yield & Break-Even', icon: Calculator }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('light');
                setActiveTab(tab.id);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                isActive
                  ? 'bg-slate-900 dark:bg-[#131926] text-white dark:text-[#00D4AA] border-emerald-500/50 shadow-md'
                  : 'bg-white dark:bg-[#1C2333]/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1E2D40] hover:bg-slate-50 dark:hover:bg-[#1C2333]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#00D4AA]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB] flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Monthly Income</span>
              </span>
              <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {formatETB(currentMonthFinancials.income)}
              </p>
              <p className="text-[10px] text-emerald-500 font-bold">Gross Inflow across all wallets</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB] flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                <span>Monthly Expenses</span>
              </span>
              <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {formatETB(currentMonthFinancials.expense)}
              </p>
              <p className="text-[10px] text-rose-500 font-bold">Total Operating Outflows</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB] flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-indigo-500" />
                <span>Net Cash Profit</span>
              </span>
              <p
                className={`text-xl font-black font-mono ${
                  currentMonthFinancials.netProfit >= 0
                    ? 'text-emerald-600 dark:text-[#00D4AA]'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatETB(currentMonthFinancials.netProfit)}
              </p>
              <p className="text-[10px] text-slate-400">Net Profit Margin: {currentMonthFinancials.profitMarginPct.toFixed(1)}%</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB] flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-500" />
                <span>Uncollected Receivables</span>
              </span>
              <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {formatETB(currentMonthFinancials.totalReceivablesOwed)}
              </p>
              <p className="text-[10px] text-amber-500 font-bold">Outstanding customer credit debt</p>
            </div>
          </div>

          {/* Cash Flow Waterfall Breakdown */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#00D4AA]" />
              <span>Cash Flow Waterfall & Operating Margin Analysis</span>
            </h3>

            <div className="space-y-3">
              {/* Gross Income Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">1. Gross Revenue Inflow</span>
                  <span className="text-emerald-500 font-mono">{formatETB(currentMonthFinancials.income)}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>

              {/* Operating Expenses Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">2. Operating Outflows & Expenses</span>
                  <span className="text-rose-500 font-mono">-{formatETB(currentMonthFinancials.expense)}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        currentMonthFinancials.income > 0
                          ? (currentMonthFinancials.expense / currentMonthFinancials.income) * 100
                          : 0
                      )}%`
                    }}
                  />
                </div>
              </div>

              {/* Fixed Quarterly Tax Provision Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">3. Monthly Fixed Tax Allocation ({formatETB(fixedQuarterlyTaxAmount)} / 3 Months)</span>
                  <span className="text-amber-500 font-mono">-{formatETB(monthlyFixedTaxAllowance)}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        currentMonthFinancials.income > 0
                          ? (monthlyFixedTaxAllowance / currentMonthFinancials.income) * 100
                          : 0
                      )}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* NEXT MONTH QUICK GLANCE ACTION CARD */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-[#141C2B] to-[#1C2333] border border-[#00D4AA]/30 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[#00D4AA]/20 text-[#00D4AA] font-mono text-[10px] font-black uppercase">
                  Horizon Forecast
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {nextMonthLiquidityData.monthLabel} ({nextMonthLiquidityData.ethiopianDateRangeStr})
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#00D4AA]" />
                <span>Next Month Scheduled Outflows: {formatETB(nextMonthLiquidityData.totalOutflows)}</span>
              </h4>
              <p className="text-xs text-slate-300">
                {nextMonthLiquidityData.items.length} itemized obligations scheduled (Utilities, Equb, Salaries, Transport, Tax Reserve, Hardware).
              </p>
            </div>

            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('liquidity');
              }}
              className="px-4 py-2.5 rounded-xl bg-[#00D4AA] text-slate-950 font-black text-xs hover:bg-[#00c29b] transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-lg"
            >
              <span>View Every Expense Detail</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: LIQUIDITY & RUNWAY MATRIX */}
      {activeTab === 'liquidity' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Top Banking Ratios & Solvency Header */}
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-[#1E2D40] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-500" />
                  <span>Banking Liquidity Ratios & Cash Solvency Metrics</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                  Solvency endurance indicators based on real-time cash balances and scheduled outflows
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono text-[11px] font-bold">
                  {nextMonthLiquidityData.items.length} Next-Month Commitments Itemized
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
                <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB]">Current Ratio</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {currentRatio.toFixed(2)}x
                </p>
                <p className="text-[11px] text-slate-500">
                  Current Assets / Immediate Liabilities. <span className="font-bold text-emerald-500">Benchmark: &gt;1.5x</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
                <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB]">Quick Ratio (Acid Test)</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {quickRatio.toFixed(2)}x
                </p>
                <p className="text-[11px] text-slate-500">
                  Liquid Cash / Immediate Liabilities. <span className="font-bold text-emerald-500">Benchmark: &gt;1.0x</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
                <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB]">Solvency Buffer Runway</span>
                <p className="text-2xl font-black text-amber-500 font-mono">
                  {runwayMonths.toFixed(1)} Months
                </p>
                <p className="text-[11px] text-slate-500">
                  Cash buffer assuming $0 revenue at current burn rate
                </p>
              </div>
            </div>
          </div>

          {/* NEXT MONTH CASHFLOW & DETAILED LIQUIDITY EXPENSE MATRIX */}
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 shadow-sm space-y-6">
            {/* Header with Ethiopian Calendar Horizon */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1E2D40] pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] font-black text-[10px] uppercase tracking-wider">
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>Next Month Liquidity Matrix</span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Next Month Cash Flow Forecast & Every Expense Detail</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#8899BB]">
                  Target Period: <span className="font-bold text-slate-800 dark:text-slate-200">{nextMonthLiquidityData.monthLabel}</span> • Ethiopian Calendar: <span className="font-bold text-indigo-400 font-mono">{nextMonthLiquidityData.ethiopianDateRangeStr}</span>
                </p>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1C2333] p-1 rounded-xl border border-slate-200 dark:border-[#1E2D40] self-start md:self-auto">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setNextMonthViewMode('cards');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    nextMonthViewMode === 'cards'
                      ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Detailed Cards</span>
                </button>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setNextMonthViewMode('table');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    nextMonthViewMode === 'table'
                      ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Ledger Table</span>
                </button>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setNextMonthViewMode('weekly');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    nextMonthViewMode === 'weekly'
                      ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Weekly Buckets</span>
                </button>
              </div>
            </div>

            {/* Next Month 4-Step Cashflow Trajectory Waterfall */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Step 1: Starting Cash */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                  <span>1. Opening Cash Balance</span>
                </span>
                <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
                  {formatETB(nextMonthLiquidityData.startingLiquidity)}
                </p>
                <p className="text-[10px] text-slate-400">Total liquid reserves across all wallets</p>
              </div>

              {/* Step 2: Projected Inflow */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-[#1C2333] border border-emerald-500/30 space-y-1">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>2. Projected Inflow</span>
                </span>
                <p className="text-xl font-black text-emerald-500 font-mono">
                  +{formatETB(nextMonthLiquidityData.projectedInflows)}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Income</p>
              </div>

              {/* Step 3: Total Scheduled Outflows */}
              <div className="p-4 rounded-2xl bg-rose-500/5 dark:bg-[#1C2333] border border-rose-500/30 space-y-1">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                  <span>3. Total Scheduled Outflows</span>
                </span>
                <p className="text-xl font-black text-rose-500 font-mono">
                  -{formatETB(nextMonthLiquidityData.totalOutflows)}
                </p>
                <p className="text-[10px] text-rose-600 dark:text-rose-400">{nextMonthLiquidityData.items.length} itemized commitments</p>
              </div>

              {/* Step 4: Net Cash Flow & Ending Liquidity */}
              <div className={`p-4 rounded-2xl border space-y-1 ${
                nextMonthLiquidityData.netCashflow >= 0
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-500'
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>4. Net Cashflow / Ending</span>
                </span>
                <p className="text-xl font-black font-mono">
                  {nextMonthLiquidityData.netCashflow >= 0 ? '+' : ''}{formatETB(nextMonthLiquidityData.netCashflow)}
                </p>
                <p className="text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                  Ending: {formatETB(nextMonthLiquidityData.endingLiquidity)} ({nextMonthLiquidityData.nextMonthRunway.toFixed(1)} mo)
                </p>
              </div>
            </div>

            {/* Outflow Category Breakdown Bar & Wallet Share */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#00D4AA]" />
                  <span>Next Month Expense Category Distribution</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Total Outflow: <span className="font-extrabold text-slate-900 dark:text-white">{formatETB(nextMonthLiquidityData.totalOutflows)}</span>
                </span>
              </div>

              {/* Multi-segment visual bar */}
              <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                {Object.entries(nextMonthLiquidityData.catMap).map(([cat, data], idx) => {
                  const pct = (data.total / Math.max(1, nextMonthLiquidityData.totalOutflows)) * 100;
                  const colors = [
                    'bg-indigo-500',
                    'bg-cyan-500',
                    'bg-emerald-500',
                    'bg-amber-500',
                    'bg-purple-500',
                    'bg-rose-500',
                    'bg-pink-500'
                  ];
                  return (
                    <div
                      key={cat}
                      className={`h-full ${colors[idx % colors.length]} transition-all cursor-pointer`}
                      style={{ width: `${pct}%` }}
                      title={`${cat}: ${formatETB(data.total)} (${pct.toFixed(1)}%)`}
                      onClick={() => setNextMonthCatFilter(cat)}
                    />
                  );
                })}
              </div>

              {/* Category Legend Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {Object.entries(nextMonthLiquidityData.catMap).map(([cat, data], idx) => {
                  const pct = (data.total / Math.max(1, nextMonthLiquidityData.totalOutflows)) * 100;
                  const dotColors = [
                    'bg-indigo-500',
                    'bg-cyan-500',
                    'bg-emerald-500',
                    'bg-amber-500',
                    'bg-purple-500',
                    'bg-rose-500',
                    'bg-pink-500'
                  ];
                  return (
                    <button
                      key={cat}
                      onClick={() => setNextMonthCatFilter(nextMonthCatFilter === cat ? 'ALL' : cat)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-mono border flex items-center gap-1.5 transition-all cursor-pointer ${
                        nextMonthCatFilter === cat
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold border-slate-900 dark:border-white shadow-sm'
                          : 'bg-white dark:bg-[#141C2B] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1E2D40] hover:border-slate-400'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`} />
                      <span>{cat}</span>
                      <span className="font-extrabold opacity-80">{formatETB(data.total)}</span>
                      <span className="text-[10px] text-slate-400">({pct.toFixed(0)}%)</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search next month expenses by title, payee, wallet, or purpose..."
                  value={nextMonthSearch}
                  onChange={e => setNextMonthSearch(e.target.value)}
                  className="w-full pl-9.5 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#00D4AA]"
                />
                {nextMonthSearch && (
                  <button
                    onClick={() => setNextMonthSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Quick Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setNextMonthCatFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                    nextMonthCatFilter === 'ALL'
                      ? 'bg-[#00D4AA] text-slate-950 border-[#00D4AA] shadow-sm'
                      : 'bg-slate-100 dark:bg-[#1C2333] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1E2D40]'
                  }`}
                >
                  All ({nextMonthLiquidityData.items.length})
                </button>
                {['UTILITIES', 'TRANSPORT', 'EQUB', 'OPERATIONS', 'TAX', 'MAINTENANCE', 'LOAN'].map(type => {
                  const count = nextMonthLiquidityData.items.filter(i => i.categoryType === type).length;
                  if (count === 0) return null;
                  const labels: Record<string, string> = {
                    UTILITIES: '⚡ Utilities',
                    TRANSPORT: '🚗 Transport',
                    EQUB: '🤝 Equb',
                    OPERATIONS: '👥 Staff & Ops',
                    TAX: '🏛️ Fixed Tax',
                    MAINTENANCE: '🔧 Maintenance',
                    LOAN: '💳 Loans'
                  };
                  return (
                    <button
                      key={type}
                      onClick={() => setNextMonthCatFilter(type)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                        nextMonthCatFilter === type
                          ? 'bg-[#00D4AA] text-slate-950 border-[#00D4AA] shadow-sm'
                          : 'bg-slate-100 dark:bg-[#1C2333] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1E2D40]'
                      }`}
                    >
                      {labels[type] || type} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtered Expenses Renderer */}
            {(() => {
              const filtered = nextMonthLiquidityData.items.filter(item => {
                // Category Filter
                if (nextMonthCatFilter !== 'ALL') {
                  if (item.categoryType !== nextMonthCatFilter && item.category !== nextMonthCatFilter) {
                    return false;
                  }
                }
                // Text Search
                if (nextMonthSearch.trim()) {
                  const q = nextMonthSearch.toLowerCase();
                  const match =
                    item.title.toLowerCase().includes(q) ||
                    item.category.toLowerCase().includes(q) ||
                    item.walletName.toLowerCase().includes(q) ||
                    (item.beneficiary && item.beneficiary.toLowerCase().includes(q)) ||
                    item.reason.toLowerCase().includes(q) ||
                    (item.notes && item.notes.toLowerCase().includes(q)) ||
                    item.amount.toString().includes(q);
                  if (!match) return false;
                }
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No matching expense items found</h4>
                    <p className="text-xs text-slate-500">Try changing or clearing your search and category filters</p>
                    <button
                      onClick={() => {
                        setNextMonthCatFilter('ALL');
                        setNextMonthSearch('');
                      }}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-indigo-500 text-white font-extrabold text-xs cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                );
              }

              // VIEW MODE 1: DETAILED CARDS VIEW (DEFAULT)
              if (nextMonthViewMode === 'cards') {
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                      <span>Showing {filtered.length} of {nextMonthLiquidityData.items.length} Expense Commitments</span>
                      <span>Total: {formatETB(filtered.reduce((s, i) => s + i.amount, 0))}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {filtered.map(item => {
                        const isExpanded = expandedExpenseId === item.id;
                        const pctOfTotal = (item.amount / Math.max(1, nextMonthLiquidityData.totalOutflows)) * 100;

                        return (
                          <div
                            key={item.id}
                            className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-slate-300 dark:hover:border-[#00D4AA]/40 transition-all space-y-3 shadow-sm"
                          >
                            {/* Card Top Row: Title, Date, Amount */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                    {item.categoryType === 'TRANSPORT' ? (
                                      <Car className="w-4 h-4 text-emerald-500 shrink-0" />
                                    ) : item.categoryType === 'UTILITIES' ? (
                                      <Zap className="w-4 h-4 text-cyan-500 shrink-0" />
                                    ) : item.categoryType === 'EQUB' ? (
                                      <Users className="w-4 h-4 text-amber-500 shrink-0" />
                                    ) : item.categoryType === 'LOAN' ? (
                                      <CreditCard className="w-4 h-4 text-rose-500 shrink-0" />
                                    ) : item.categoryType === 'TAX' ? (
                                      <Calendar className="w-4 h-4 text-purple-500 shrink-0" />
                                    ) : (
                                      <DollarSign className="w-4 h-4 text-indigo-500 shrink-0" />
                                    )}
                                    <span>{item.title}</span>
                                  </h4>

                                  {/* Category Badge */}
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    {item.category}
                                  </span>

                                  {/* Frequency */}
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-[#141C2B] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#1E2D40]">
                                    {item.frequency}
                                  </span>

                                  {/* Essential Tag */}
                                  {item.isEssential && (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>Mandatory</span>
                                    </span>
                                  )}
                                </div>

                                {/* Calendar Dates */}
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>{item.calendarDateLabel}</span>
                                  </span>
                                  <span className="font-mono text-indigo-500 dark:text-indigo-400 bg-indigo-500/5 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                                    {item.ethiopianDateStr}
                                  </span>
                                </div>
                              </div>

                              {/* Amount Display */}
                              <div className="text-right shrink-0">
                                <p className="text-lg font-black text-rose-500 font-mono">
                                  -{formatETB(item.amount)}
                                </p>
                                <p className="text-[11px] text-slate-400 font-mono">
                                  {pctOfTotal.toFixed(1)}% of next mo outflow
                                </p>
                              </div>
                            </div>

                            {/* Middle Meta: Payee & Wallet */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                              <div className="p-2.5 rounded-xl bg-white dark:bg-[#141C2B] border border-slate-200 dark:border-[#1E2D40] text-xs space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                  <User className="w-3 h-3 text-[#00D4AA]" />
                                  <span>Designated Payee / Beneficiary</span>
                                </span>
                                <p className="font-bold text-slate-800 dark:text-slate-200 font-mono truncate">
                                  {item.beneficiary || 'Vendor Desk'}
                                </p>
                              </div>

                              <div className="p-2.5 rounded-xl bg-white dark:bg-[#141C2B] border border-slate-200 dark:border-[#1E2D40] text-xs space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                  <Wallet className="w-3 h-3 text-indigo-400" />
                                  <span>Disbursing Account / Wallet</span>
                                </span>
                                <p className="font-bold text-slate-800 dark:text-slate-200 font-mono truncate">
                                  {item.walletName}
                                </p>
                              </div>
                            </div>

                            {/* Reason & Calculation Formula Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              <div className="p-3 rounded-xl bg-white dark:bg-[#141C2B] border border-slate-200 dark:border-[#1E2D40] space-y-1">
                                <span className="text-[10px] font-bold text-[#00D4AA] uppercase font-mono flex items-center gap-1">
                                  <Info className="w-3 h-3" />
                                  <span>Operational Purpose & Financial Reason</span>
                                </span>
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                  {item.reason}
                                </p>
                              </div>

                              <div className="p-3 rounded-xl bg-white dark:bg-[#141C2B] border border-slate-200 dark:border-[#1E2D40] space-y-1">
                                <span className="text-[10px] font-bold text-indigo-400 uppercase font-mono flex items-center gap-1">
                                  <Calculator className="w-3 h-3" />
                                  <span>Calculation Basis & Policy Formula</span>
                                </span>
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono leading-relaxed">
                                  {item.calculationBasis}
                                </p>
                              </div>
                            </div>

                            {/* Collapsible Action Notes */}
                            {item.notes && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#101622] p-2.5 rounded-xl border border-slate-200 dark:border-[#1E2D40] flex items-center justify-between">
                                <span className="font-mono">📌 {item.notes}</span>
                                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                  Status: Scheduled
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // VIEW MODE 2: LEDGER TABLE VIEW
              if (nextMonthViewMode === 'table') {
                return (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#1E2D40]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-[#141C2B] border-b border-slate-200 dark:border-[#1E2D40] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3">Date (G.C. / E.C.)</th>
                          <th className="p-3">Expense Title & Purpose</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Payee / Beneficiary</th>
                          <th className="p-3">Wallet</th>
                          <th className="p-3 text-right">Amount (ETB)</th>
                          <th className="p-3 text-right">Share %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#1E2D40] bg-white dark:bg-[#131926]">
                        {filtered.map(item => {
                          const pctOfTotal = (item.amount / Math.max(1, nextMonthLiquidityData.totalOutflows)) * 100;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-[#1C2333]/80 transition-colors">
                              <td className="p-3 font-mono">
                                <div className="font-bold text-slate-900 dark:text-white">{item.calendarDateLabel}</div>
                                <div className="text-[10px] text-indigo-400">{item.ethiopianDateStr}</div>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900 dark:text-white">{item.title}</div>
                                <div className="text-[11px] text-slate-500 line-clamp-1">{item.reason}</div>
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  {item.category}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                                {item.beneficiary || '—'}
                              </td>
                              <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                                {item.walletName}
                              </td>
                              <td className="p-3 text-right font-mono font-black text-rose-500">
                                -{formatETB(item.amount)}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-500">
                                {pctOfTotal.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 dark:bg-[#141C2B] font-bold border-t border-slate-200 dark:border-[#1E2D40] text-slate-900 dark:text-white">
                          <td colSpan={5} className="p-3 uppercase text-[10px]">
                            Total Filtered Next Month Outflows ({filtered.length} Items)
                          </td>
                          <td className="p-3 text-right font-mono font-black text-rose-500 text-sm">
                            -{formatETB(filtered.reduce((s, i) => s + i.amount, 0))}
                          </td>
                          <td className="p-3 text-right font-mono text-xs">
                            {((filtered.reduce((s, i) => s + i.amount, 0) / Math.max(1, nextMonthLiquidityData.totalOutflows)) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              }

              // VIEW MODE 3: WEEKLY BREAKDOWN
              return (
                <div className="space-y-4">
                  {nextMonthLiquidityData.weeks.map((wk, wIdx) => {
                    const weekItems = wk.items.filter(item => {
                      if (nextMonthCatFilter !== 'ALL') {
                        if (item.categoryType !== nextMonthCatFilter && item.category !== nextMonthCatFilter) return false;
                      }
                      if (nextMonthSearch.trim()) {
                        const q = nextMonthSearch.toLowerCase();
                        return (
                          item.title.toLowerCase().includes(q) ||
                          item.category.toLowerCase().includes(q) ||
                          item.walletName.toLowerCase().includes(q) ||
                          (item.beneficiary && item.beneficiary.toLowerCase().includes(q)) ||
                          item.reason.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    });

                    if (weekItems.length === 0) return null;

                    const weekTotal = weekItems.reduce((s, i) => s + i.amount, 0);

                    return (
                      <div
                        key={wk.label}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-2">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span>{wk.label}</span>
                            <span className="text-[10px] font-normal text-slate-400 font-mono">({weekItems.length} expenses)</span>
                          </h4>
                          <span className="text-xs font-black text-rose-500 font-mono">
                            Subtotal: -{formatETB(weekTotal)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {weekItems.map(item => (
                            <div
                              key={item.id}
                              className="p-3 rounded-xl bg-white dark:bg-[#141C2B] border border-slate-200 dark:border-[#1E2D40] text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 dark:text-white text-xs">{item.title}</span>
                                <span className="font-mono font-black text-rose-500 text-xs">-{formatETB(item.amount)}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                                <span>{item.calendarDateLabel}</span>
                                <span className="text-[#00D4AA]">{item.walletName}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 3: SMART CATEGORY BUDGETING & VARIANCE */}
      {activeTab === 'budgeting' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-5 shadow-sm animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-500" />
                <span>Smart Category Budget Cap & Variance Engine</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                Monitor real-time spending vs monthly allocated thresholds across all categories
              </p>
            </div>

            {/* Quick Add Budget */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Category Name"
                value={newBudgetCat}
                onChange={e => setNewBudgetCat(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs font-bold text-slate-800 dark:text-slate-200"
              />
              <input
                type="number"
                placeholder="Limit ETB"
                value={newBudgetLimit}
                onChange={e => setNewBudgetLimit(e.target.value)}
                className="w-24 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
              />
              <button
                onClick={handleAddBudget}
                className="px-3 py-1.5 rounded-xl bg-[#00D4AA] text-slate-950 font-extrabold text-xs shadow-sm cursor-pointer hover:brightness-110"
              >
                + Add Cap
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {budgets.map(b => {
              const actualSpent = categoryExpensesMap[b.category] || 0;
              const pctUsed = Math.min(100, (actualSpent / Math.max(1, b.monthlyLimit)) * 100);
              const variance = b.monthlyLimit - actualSpent;
              const isOver = variance < 0;

              return (
                <div
                  key={b.category}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {b.category}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Actual: {formatETB(actualSpent)} / Budget Limit: {formatETB(b.monthlyLimit)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono border ${
                          isOver
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                            : pctUsed > 80
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                        }`}
                      >
                        {isOver
                          ? `OVER BUDGET BY ${formatETB(Math.abs(variance))}`
                          : `${formatETB(variance)} REMAINING`}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOver ? 'bg-rose-500' : pctUsed > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pctUsed}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3.5: PREDICTIVE 3-MONTH BUDGETING & EXPENSE PROJECTION ENGINE */}
      {activeTab === 'predictive' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-6 shadow-sm animate-fadeIn">
          {/* Header & Quick Action */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#1E2D40] pb-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 font-black text-[10px] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>3-Month History Trend Projection Engine</span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Predictive Expense Forecasting & Discrepancy Matrix</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#8899BB] max-w-xl">
                Uses transaction history from <span className="font-bold text-slate-700 dark:text-slate-300">{predictiveBudgetData.m3Label}</span>, <span className="font-bold text-slate-700 dark:text-slate-300">{predictiveBudgetData.m2Label}</span>, and <span className="font-bold text-slate-700 dark:text-slate-300">{predictiveBudgetData.m1Label}</span> to project next month's category spending and flag budget cap overruns.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleApplyProjectedBudgets}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00D4AA] to-emerald-500 text-slate-950 font-black text-xs shadow-md hover:brightness-110 flex items-center gap-2 cursor-pointer transition-all"
              >
                <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
                <span>Auto-Sync Caps to Predictions (+10%)</span>
              </button>
            </div>
          </div>

          {/* Top Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Total Projected Outflows
              </span>
              <p className="text-xl font-black text-indigo-500 font-mono">
                {formatETB(predictiveBudgetData.totalProjected)}
              </p>
              <p className="text-[10px] text-slate-400">Based on 3-mo weighted trend</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Allocated Monthly Budget Caps
              </span>
              <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {formatETB(predictiveBudgetData.totalBudgeted)}
              </p>
              <p className="text-[10px] text-slate-400">Sum of configured category limits</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Projected Net Variance
              </span>
              <p
                className={`text-xl font-black font-mono ${
                  predictiveBudgetData.netDiscrepancy > 0
                    ? 'text-rose-500'
                    : 'text-emerald-500'
                }`}
              >
                {predictiveBudgetData.netDiscrepancy > 0
                  ? `+${formatETB(predictiveBudgetData.netDiscrepancy)} (Deficit)`
                  : `${formatETB(Math.abs(predictiveBudgetData.netDiscrepancy))} (Surplus)`}
              </p>
              <p className="text-[10px] text-slate-400">Projection vs Budget Caps</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Budget Overrun Flags
              </span>
              <p
                className={`text-xl font-black font-mono flex items-center gap-1.5 ${
                  predictiveBudgetData.overBudgetCount > 0 ? 'text-amber-500' : 'text-emerald-500'
                }`}
              >
                {predictiveBudgetData.overBudgetCount > 0 && (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                )}
                <span>{predictiveBudgetData.overBudgetCount} Categories</span>
              </p>
              <p className="text-[10px] text-slate-400">Requiring limit increase or cuts</p>
            </div>
          </div>

          {/* Discrepancy Alert Banner if any category exceeds budget */}
          {predictiveBudgetData.overBudgetCount > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h4 className="font-extrabold text-amber-300">
                    Budget Discrepancy Warning
                  </h4>
                  <p className="text-[11px] text-amber-400/90 leading-tight">
                    {predictiveBudgetData.overBudgetCount} category limits are projected to be exceeded next month based on recent spend velocity.
                  </p>
                </div>
              </div>

              <button
                onClick={handleApplyProjectedBudgets}
                className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition-colors shrink-0 cursor-pointer"
              >
                Auto-Adjust All Caps
              </button>
            </div>
          )}

          {/* Detailed Category Prediction Matrix */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Category Trend & Prediction Breakdown</span>
              <span className="text-[10px] font-normal text-slate-400">
                Sorted by highest budget discrepancy
              </span>
            </h4>

            {predictiveBudgetData.categoryProjections.map(cp => {
              return (
                <div
                  key={cp.category}
                  className={`p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border transition-all ${
                    cp.status === 'OVER_BUDGET'
                      ? 'border-rose-500/40 bg-rose-500/5'
                      : cp.status === 'HIGH_RISK'
                      ? 'border-amber-500/40'
                      : cp.status === 'UNBUDGETED'
                      ? 'border-indigo-500/30'
                      : 'border-slate-200 dark:border-[#1E2D40]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left Info & Status Badge */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-xs font-black text-slate-900 dark:text-white">
                          {cp.category}
                        </h5>

                        {/* Status Badge */}
                        {cp.status === 'OVER_BUDGET' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>PROJECTED OVER BUDGET (+{formatETB(cp.discrepancy)})</span>
                          </span>
                        )}
                        {cp.status === 'HIGH_RISK' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/30">
                            HIGH UTILIZATION ({cp.pctOfCap.toFixed(0)}% OF CAP)
                          </span>
                        )}
                        {cp.status === 'UNBUDGETED' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                            NO BUDGET CAP DEFINED
                          </span>
                        )}
                        {cp.status === 'ON_TRACK' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                            WITHIN BUDGET ({cp.pctOfCap.toFixed(0)}%)
                          </span>
                        )}

                        {/* Trend direction badge */}
                        {cp.trendPct !== 0 && (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold flex items-center gap-0.5 ${
                              cp.trendPct > 0
                                ? 'bg-rose-500/10 text-rose-500'
                                : 'bg-emerald-500/10 text-emerald-500'
                            }`}
                          >
                            {cp.trendPct > 0 ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            <span>{Math.abs(cp.trendPct)}% vs prior avg</span>
                          </span>
                        )}
                      </div>

                      {/* Month History Pills */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
                        <span className="px-2 py-1 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                          {predictiveBudgetData.m3Label}: {formatETB(cp.m3Amount)}
                        </span>
                        <span className="px-2 py-1 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                          {predictiveBudgetData.m2Label}: {formatETB(cp.m2Amount)}
                        </span>
                        <span className="px-2 py-1 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold">
                          {predictiveBudgetData.m1Label}: {formatETB(cp.m1Amount)}
                        </span>
                        <span className="px-2 py-1 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 font-black border border-indigo-500/30">
                          Next Month Projection: {formatETB(cp.projectedAmt)}
                        </span>
                      </div>
                    </div>

                    {/* Right Budget Cap & Quick Setter */}
                    <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">
                          Current Budget Cap
                        </span>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
                          {cp.hasCap ? formatETB(cp.budgetCap) : 'Not set'}
                        </span>
                      </div>

                      <button
                        onClick={() =>
                          handleUpdateSingleCap(
                            cp.category,
                            Math.ceil((cp.projectedAmt * 1.1) / 1000) * 1000
                          )
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-extrabold transition-colors cursor-pointer"
                        title="Set Cap to Projection + 10%"
                      >
                        Set Cap = {formatETB(Math.ceil((cp.projectedAmt * 1.1) / 1000) * 1000)}
                      </button>
                    </div>
                  </div>

                  {/* Visual Comparison Progress Bar */}
                  {cp.hasCap && (
                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between text-[10px] font-extrabold text-slate-500">
                        <span>Predicted Usage ({cp.pctOfCap.toFixed(1)}%)</span>
                        <span>
                          {cp.discrepancy > 0
                            ? `Over Budget (+${formatETB(cp.discrepancy)})`
                            : `Under Budget (${formatETB(Math.abs(cp.discrepancy))} buffer)`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            cp.discrepancy > 0
                              ? 'bg-rose-500'
                              : cp.pctOfCap >= 85
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, cp.pctOfCap)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: 3-MONTH FIXED TAX SCHEDULE */}
      {activeTab === 'fixed_tax' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-5 shadow-sm animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span>3-Month Fixed Quarterly Tax Assessment Engine</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                Configurable fixed flat-rate tax paid every 3 months (quarterly cycle)
              </p>
            </div>

            {/* Set Fixed Amount */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Quarterly Fixed Rate (ETB):</span>
              <input
                type="number"
                value={fixedQuarterlyTaxAmount}
                onChange={e => handleUpdateFixedTax(Number(e.target.value))}
                className="w-32 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] font-mono text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Fixed 3-Month Tax Rate</span>
              <p className="text-xl font-black text-amber-500 font-mono">
                {formatETB(fixedQuarterlyTaxAmount)}
              </p>
              <p className="text-[10px] text-slate-400">Flat assessment fee per quarter</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Monthly Reserve Allocation</span>
              <p className="text-xl font-black text-indigo-400 font-mono">
                {formatETB(monthlyFixedTaxAllowance)}
              </p>
              <p className="text-[10px] text-slate-400">Monthly budget accrual ({formatETB(fixedQuarterlyTaxAmount)} ÷ 3)</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Next Assessment Status</span>
              <p className="text-xl font-black text-emerald-400 font-mono flex items-center gap-1.5">
                {nextPendingQuarter ? (
                  <span>{nextPendingQuarter.quarterLabel}</span>
                ) : (
                  <span>All Quarters Paid</span>
                )}
              </p>
              <p className="text-[10px] text-slate-400">
                {nextPendingQuarter ? `Due: ${nextPendingQuarter.dueDate}` : 'Fully compliant'}
              </p>
            </div>
          </div>

          {/* Quarterly Tax Schedule List */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Annual 3-Month Quarterly Payment Records
            </h4>

            {quarterlyTaxRecords.map((rec, idx) => (
              <div
                key={rec.quarterLabel}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {rec.quarterLabel} ({rec.year})
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        rec.status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {rec.status === 'PAID' ? 'PAID & CLEARED' : 'DUE / PENDING'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Fixed Tax Assessment: <span className="text-slate-800 dark:text-slate-200 font-bold">{formatETB(rec.amount)}</span> • Due Date: {rec.dueDate}
                    {rec.paidDate && ` • Cleared on: ${rec.paidDate}`}
                  </p>
                </div>

                <button
                  onClick={() => handleToggleTaxPaid(idx)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-all border shadow-sm ${
                    rec.status === 'PAID'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700'
                      : 'bg-emerald-500 text-slate-950 border-emerald-400 hover:brightness-110'
                  }`}
                >
                  {rec.status === 'PAID' ? 'Mark as Unpaid' : '✓ Mark Tax as Paid'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: INVESTMENT YIELD & BREAK-EVEN MODELER */}
      {activeTab === 'yield_model' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-5 shadow-sm animate-fadeIn">
          <div className="border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-500" />
              <span>Investment Compound Yield & Break-Even Modeler</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
              Calculate break-even units and compound interest yields for surplus reserve capital (ETB)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Break-Even Calculator */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-3">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                Break-Even Sales Revenue Modeler
              </h4>

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block">Fixed Overhead Costs (Monthly ETB)</label>
                  <input
                    type="number"
                    value={fixedCostsInput}
                    onChange={e => setFixedCostsInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-300 dark:border-[#2A3B53] text-xs font-mono font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block">Avg Ticket Price (ETB)</label>
                    <input
                      type="number"
                      value={avgTicketPrice}
                      onChange={e => setAvgTicketPrice(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-300 dark:border-[#2A3B53] text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block">Var Cost / Ticket (ETB)</label>
                    <input
                      type="number"
                      value={varCostPerTicket}
                      onChange={e => setVarCostPerTicket(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-300 dark:border-[#2A3B53] text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs font-bold text-indigo-400 space-y-1">
                <p>Break-Even Units: <span className="font-mono font-extrabold text-white">{breakEvenUnits} Sales</span></p>
                <p>Break-Even Revenue: <span className="font-mono font-extrabold text-white">{formatETB(breakEvenRevenue)}</span></p>
              </div>
            </div>

            {/* Compound Yield Calculator */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-3">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                Reserve Yield & Compound Growth Modeler
              </h4>

              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block">Principal Reserve Capital (ETB)</label>
                  <input
                    type="number"
                    value={principalInput}
                    onChange={e => setPrincipalInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-300 dark:border-[#2A3B53] text-xs font-mono font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block">Annual Rate (%)</label>
                    <input
                      type="number"
                      value={annualReturnRate}
                      onChange={e => setAnnualReturnRate(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-300 dark:border-[#2A3B53] text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block">Term (Years)</label>
                    <input
                      type="number"
                      value={investmentYears}
                      onChange={e => setInvestmentYears(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-300 dark:border-[#2A3B53] text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400 space-y-1">
                <p>Projected Capital Value: <span className="font-mono font-extrabold text-white">{formatETB(projectedYield.finalAmount)}</span></p>
                <p>Compound Earnings: <span className="font-mono font-extrabold text-white">+{formatETB(projectedYield.totalEarnings)}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
