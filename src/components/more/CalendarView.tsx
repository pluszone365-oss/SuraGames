import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Download,
  Filter,
  Globe,
  Grid,
  List,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Plus,
  Share2,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Building2,
  Repeat,
  FileCheck,
  CreditCard,
  TrendingDown,
  TrendingUp,
  BarChart3,
  PieChart,
  Coins
} from 'lucide-react';
import { Equb, Loan, RecurringTemplate, Receivable, Transaction } from '../../types';
import { formatETB, getTransactionDisplayTitle } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import {
  formatEthiopianDate,
  formatDateByCalendar,
  toEthiopianDate,
  evaluatePagumeExemption,
  calculateNextEthiopianDueDate,
  addEthiopianMonths
} from '../../lib/ethiopianCalendar';

export type CalendarViewMode = 'MONTH' | 'WEEK' | 'AGENDA';
export type EventTypeFilter = 'ALL' | 'EQUB' | 'LOAN' | 'RECURRING' | 'RECEIVABLE' | 'TRANSACTION';

export interface CalendarEventItem {
  id: string;
  title: string;
  amount: number;
  type: 'EQUB DUE' | 'LOAN DUE' | 'RECURRING BILL' | 'RECEIVABLE COLLECTION' | 'TRANSACTION';
  categoryKey: 'EQUB' | 'LOAN' | 'RECURRING' | 'RECEIVABLE' | 'TRANSACTION';
  dateObj: Date;
  dateStr: string; // YYYY-MM-DD
  color: string;
  status?: string;
  description?: string;
  direction: 'IN' | 'OUT';
  originalData?: any;
  isExemptInPagume?: boolean;
  pagumeReason?: string;
}

interface CalendarViewProps {
  equbs: Equb[];
  loans: Loan[];
  recurring: RecurringTemplate[];
  receivables: Receivable[];
  transactions?: Transaction[];
  defaultView?: CalendarViewMode;
  agendaOnly?: boolean;
  calendarType?: 'ETHIOPIAN' | 'GREGORIAN';
  onToggleCalendarType?: (type: 'ETHIOPIAN' | 'GREGORIAN') => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  equbs,
  loans,
  recurring,
  receivables,
  transactions = [],
  defaultView,
  agendaOnly = false,
  calendarType = 'GREGORIAN',
  onToggleCalendarType
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(
    defaultView || (agendaOnly ? 'AGENDA' : 'MONTH')
  );
  const [selectedType, setSelectedType] = useState<EventTypeFilter>('ALL');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [activeModalEvent, setActiveModalEvent] = useState<CalendarEventItem | null>(null);
  const [googleSyncConnected, setGoogleSyncConnected] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Helper to format Date as YYYY-MM-DD in local time
  const formatYMD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Compile all financial calendar events
  const allEvents = useMemo<CalendarEventItem[]>(() => {
    const list: CalendarEventItem[] = [];

    // 1. Equb Due Events
    equbs.forEach(e => {
      const d = calculateNextEthiopianDueDate(e.startDate || new Date(), e.interval || 'EVERY_10_DAYS');
      const pagumeCheck = evaluatePagumeExemption('Equb Contribution', d);
      list.push({
        id: `equb-${e.id}`,
        title: `${e.name} - Round #${e.currentRound}`,
        amount: e.contributionPerRound,
        type: 'EQUB DUE',
        categoryKey: 'EQUB',
        dateObj: d,
        dateStr: formatYMD(d),
        color: '#A78BFA',
        direction: 'OUT',
        description: `Equb contribution for ${e.name} (${(e.interval || '').toLowerCase()} frequency - calculated in Ethiopian Calendar)`,
        isExemptInPagume: pagumeCheck.isExempt,
        pagumeReason: pagumeCheck.reason
      });
    });

    // 2. Loan Installments
    loans.forEach(l => {
      if (l.status === 'ACTIVE') {
        const d = new Date(l.dueDate);
        const pagumeCheck = evaluatePagumeExemption('Loan Repayment', d);
        list.push({
          id: `loan-${l.id}`,
          title: `Loan Repayment: ${l.title}`,
          amount: l.monthlyInstallment || l.outstandingBalance,
          type: 'LOAN DUE',
          categoryKey: 'LOAN',
          dateObj: d,
          dateStr: formatYMD(d),
          color: '#FB923C',
          direction: 'OUT',
          status: `Remaining: ${formatETB(l.outstandingBalance)}`,
          description: `Scheduled loan payment to ${l.counterparty || l.title}`,
          isExemptInPagume: pagumeCheck.isExempt,
          pagumeReason: pagumeCheck.reason
        });
      }
    });

    // 3. Recurring Bills & Subscriptions
    recurring.forEach(r => {
      if (r.status === 'ACTIVE') {
        const d = new Date(r.nextDueDate);
        const pagumeCheck = evaluatePagumeExemption(r.category || r.title, d);
        list.push({
          id: `rec-${r.id}`,
          title: r.title,
          amount: r.amount,
          type: 'RECURRING BILL',
          categoryKey: 'RECURRING',
          dateObj: d,
          dateStr: formatYMD(d),
          color: '#6366F1',
          direction: r.type === 'EXPENSE' ? 'OUT' : 'IN',
          description: `Recurring ${(r.type || '').toLowerCase()} scheduled for ${r.frequency}`,
          isExemptInPagume: pagumeCheck.isExempt,
          pagumeReason: pagumeCheck.reason
        });
      }
    });

    // 4. Receivables & Customer Credit
    receivables.forEach(rcv => {
      const remaining = rcv.amountOwed - rcv.amountCollected;
      if (remaining > 0) {
        const d = new Date(rcv.dueDate);
        list.push({
          id: `rcv-${rcv.id}`,
          title: `Collect from ${rcv.customerName}`,
          amount: remaining,
          type: 'RECEIVABLE COLLECTION',
          categoryKey: 'RECEIVABLE',
          dateObj: d,
          dateStr: formatYMD(d),
          color: '#00D4AA',
          direction: 'IN',
          status: rcv.status,
          description: `Receivable collection for ${rcv.description || 'Sales invoice'}`
        });
      }
    });

    // 5. Logged Transactions (Historical & Recent)
    transactions.slice(0, 50).forEach(tx => {
      const d = new Date(tx.date);
      list.push({
        id: `tx-${tx.id}`,
        title: getTransactionDisplayTitle(tx, receivables) || tx.category,
        amount: tx.amount,
        type: 'TRANSACTION',
        categoryKey: 'TRANSACTION',
        dateObj: d,
        dateStr: formatYMD(d),
        color: tx.type === 'INCOME' ? '#10B981' : '#F43F5E',
        direction: tx.type === 'INCOME' ? 'IN' : 'OUT',
        status: 'LOGGED',
        description: `Category: ${tx.category} | Wallet: ${tx.walletId}`
      });
    });

    return list;
  }, [equbs, loans, recurring, receivables, transactions]);

  // Filter events by selected category
  const filteredEvents = useMemo(() => {
    if (selectedType === 'ALL') return allEvents;
    return allEvents.filter(e => e.categoryKey === selectedType);
  }, [allEvents, selectedType]);

  // Calendar month dates calculation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: Array<{
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const str = formatYMD(d);
      days.push({
        date: d,
        dateStr: str,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: str === formatYMD(new Date())
      });
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month, day);
      const str = formatYMD(d);
      days.push({
        date: d,
        dateStr: str,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: str === formatYMD(new Date())
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remainingGridCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingGridCells; i++) {
      const d = new Date(year, month + 1, i);
      const str = formatYMD(d);
      days.push({
        date: d,
        dateStr: str,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: str === formatYMD(new Date())
      });
    }

    return days;
  }, [currentDate]);

  // Events grouped by date YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventItem[]> = {};
    filteredEvents.forEach(ev => {
      if (!map[ev.dateStr]) {
        map[ev.dateStr] = [];
      }
      map[ev.dateStr].push(ev);
    });
    return map;
  }, [filteredEvents]);

  // Selected Date Events
  const selectedDayEvents = eventsByDate[selectedDateStr] || [];

  // Summary totals for selected day
  const selectedDaySummary = useMemo(() => {
    let dueIn = 0;
    let dueOut = 0;
    selectedDayEvents.forEach(ev => {
      if (ev.direction === 'IN') dueIn += ev.amount;
      else dueOut += ev.amount;
    });
    return { dueIn, dueOut, net: dueIn - dueOut };
  }, [selectedDayEvents]);

  // Month navigation
  const prevMonth = () => {
    triggerHaptic('light');
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    triggerHaptic('light');
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    triggerHaptic('medium');
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(formatYMD(today));
  };

  // Google Calendar dynamic link generator
  const getGoogleCalendarUrl = (ev: CalendarEventItem): string => {
    const title = encodeURIComponent(`[PlusZone Finance] ${ev.title}`);
    const details = encodeURIComponent(
      `${ev.description || ''}\nAmount: ${formatETB(ev.amount)}\nType: ${ev.type}\nOrganized via PlusZone Finance ERP.`
    );
    // Format start time YYYYMMDDTHHMMSSZ
    const d = ev.dateObj;
    const startStr = d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const endObj = new Date(d.getTime() + 60 * 60 * 1000); // 1 hr default duration
    const endStr = endObj.toISOString().replace(/-|:|\.\d\d\d/g, '');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=Ethiopia`;
  };

  // Export all upcoming calendar events to .ics file for Google / Apple Calendar
  const downloadIcsCalendar = () => {
    triggerHaptic('success');
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PlusZone Finance ERP//Financial Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:PlusZone Financial Obligations'
    ];

    filteredEvents.forEach(ev => {
      const d = ev.dateObj;
      const dateFormatted = d.toISOString().replace(/-|:|\.\d\d\d/g, '').substring(0, 8);
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:ev-${ev.id}@pluszone.finance`,
        `DTSTAMP:${dateFormatted}T090000Z`,
        `DTSTART;VALUE=DATE:${dateFormatted}`,
        `SUMMARY:[PlusZone ERP] ${ev.title}`,
        `DESCRIPTION:${ev.type} - Amount: ETB ${ev.amount}. ${ev.description || ''}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'PlusZone_Financial_Calendar.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calculate monthly expense and overall total expense metrics
  const expenseSummary = useMemo(() => {
    let currentMonthExpense = 0;
    let currentMonthIncome = 0;
    let grandTotalExpense = 0;
    let grandTotalIncome = 0;

    const curYear = currentDate.getFullYear();
    const curMonth = currentDate.getMonth();

    // Map by YYYY-MM
    const monthlyMap: Record<string, { year: number; monthIndex: number; label: string; expense: number; income: number }> = {};

    allEvents.forEach(ev => {
      const year = ev.dateObj.getFullYear();
      const monthIndex = ev.dateObj.getMonth();
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const label = `${monthNames[monthIndex].substring(0, 3)} ${year}`;

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          year,
          monthIndex,
          label,
          expense: 0,
          income: 0
        };
      }

      if (ev.direction === 'OUT') {
        grandTotalExpense += ev.amount;
        monthlyMap[monthKey].expense += ev.amount;
        if (year === curYear && monthIndex === curMonth) {
          currentMonthExpense += ev.amount;
        }
      } else if (ev.direction === 'IN') {
        grandTotalIncome += ev.amount;
        monthlyMap[monthKey].income += ev.amount;
        if (year === curYear && monthIndex === curMonth) {
          currentMonthIncome += ev.amount;
        }
      }
    });

    // Ensure current selected month exists in map
    const curKey = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    if (!monthlyMap[curKey]) {
      monthlyMap[curKey] = {
        year: curYear,
        monthIndex: curMonth,
        label: `${monthNames[curMonth].substring(0, 3)} ${curYear}`,
        expense: 0,
        income: 0
      };
    }

    const monthlyList = Object.keys(monthlyMap)
      .sort((a, b) => b.localeCompare(a)) // latest month first
      .map(k => monthlyMap[k]);

    return {
      currentMonthExpense,
      currentMonthIncome,
      grandTotalExpense,
      grandTotalIncome,
      monthlyList
    };
  }, [allEvents, currentDate]);

  return (
    <div className="space-y-4">
      {/* Top Expense KPI Cards & Monthly Expense Breakdown */}
      <div className="space-y-3">
        <div id="tour-calendar-kpis" data-tour="calendar-kpis" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Current Month Expense Card */}
          <div className="bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent dark:from-rose-500/20 dark:via-rose-950/20 dark:to-[#131926] border border-rose-200 dark:border-rose-900/40 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                <span>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()} Expense</span>
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/20">
                Monthly Total
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-mono font-black text-slate-900 dark:text-white">
                {formatETB(expenseSummary.currentMonthExpense)}
              </h2>
            </div>
            <div className="mt-2 pt-2 border-t border-rose-200/50 dark:border-rose-900/30 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-[#8899BB]">
              <span>Monthly Inflows:</span>
              <span className="font-bold text-emerald-600 dark:text-[#00D4AA]">
                {formatETB(expenseSummary.currentMonthIncome)}
              </span>
            </div>
          </div>

          {/* Grand Total All-Time Expense Card */}
          <div className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent dark:from-purple-500/20 dark:via-purple-950/20 dark:to-[#131926] border border-purple-200 dark:border-purple-900/40 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-[#A78BFA] flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-purple-500" />
                <span>Grand Total Expenses (All Months)</span>
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                All-Time Total
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-mono font-black text-slate-900 dark:text-white">
                {formatETB(expenseSummary.grandTotalExpense)}
              </h2>
            </div>
            <div className="mt-2 pt-2 border-t border-purple-200/50 dark:border-purple-900/30 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-[#8899BB]">
              <span>All-Time Inflows:</span>
              <span className="font-bold text-emerald-600 dark:text-[#00D4AA]">
                {formatETB(expenseSummary.grandTotalIncome)}
              </span>
            </div>
          </div>
        </div>

        {/* Monthly Expense Breakdown Bar / Fast Switcher */}
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-3 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Monthly Expense Breakdown (Click to jump to month)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {expenseSummary.monthlyList.length} months tracked
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {expenseSummary.monthlyList.map((m) => {
              const isSelected =
                currentDate.getFullYear() === m.year && currentDate.getMonth() === m.monthIndex;

              return (
                <button
                  key={`${m.year}-${m.monthIndex}`}
                  onClick={() => {
                    triggerHaptic('medium');
                    const targetDate = new Date(m.year, m.monthIndex, 1);
                    setCurrentDate(targetDate);
                    setSelectedDateStr(formatYMD(targetDate));
                  }}
                  className={`px-3 py-2 rounded-xl border flex flex-col items-start gap-0.5 shrink-0 transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
                      : 'bg-slate-50 dark:bg-[#1C2333] border-slate-200 dark:border-[#1E2D40] hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[11px] font-bold ${
                        isSelected ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {m.label}
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                    {formatETB(m.expense)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Header & Controls */}
      <div id="tour-calendar-header" data-tour="calendar-header" className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-[#6366F1] flex items-center justify-center font-bold">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Financial Calendar & Obligations</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-[#00D4AA] border border-emerald-500/20 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Google Calendar Sync Ready
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#8899BB]">
                  Interactive calendar for Equbs, Loan Installments, Recurring Bills & Credit Collections
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Export ICS & Google Sync */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={downloadIcsCalendar}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
              title="Download .ics Calendar File for Google / Apple Calendar"
            >
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden xs:inline">Export .ICS</span>
            </button>

            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-[#00D4AA] text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Google Calendar</span>
            </a>
          </div>
        </div>

        {/* View Mode Switcher & Category Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#1E2D40]">
          {/* View Modes */}
          {!agendaOnly ? (
            <div id="tour-calendar-modes" data-tour="calendar-modes" className="flex items-center gap-1 bg-slate-100 dark:bg-[#1C2333] p-1 rounded-xl">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setViewMode('MONTH');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'MONTH'
                    ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Month Grid</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('light');
                  setViewMode('AGENDA');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'AGENDA'
                    ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Agenda List</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <List className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200">Agenda List View</span>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'ALL' as EventTypeFilter, label: 'All Obligations', color: '#6366F1' },
              { id: 'EQUB' as EventTypeFilter, label: 'Equbs', color: '#A78BFA' },
              { id: 'LOAN' as EventTypeFilter, label: 'Loans', color: '#FB923C' },
              { id: 'RECURRING' as EventTypeFilter, label: 'Bills', color: '#6366F1' },
              { id: 'RECEIVABLE' as EventTypeFilter, label: 'Receivables', color: '#00D4AA' },
              { id: 'TRANSACTION' as EventTypeFilter, label: 'Transactions', color: '#10B981' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedType(f.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap border ${
                  selectedType === f.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm'
                    : 'bg-slate-50 dark:bg-[#1C2333] border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Month Navigation Control Bar */}
      <div id="tour-calendar-grid" data-tour="calendar-grid" className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] hover:bg-slate-200 dark:hover:bg-[#253047] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] hover:bg-slate-200 dark:hover:bg-[#253047] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-extrabold text-slate-900 dark:text-white ml-1 flex items-center gap-1.5">
            {calendarType === 'ETHIOPIAN' ? (
              <>
                <span>{toEthiopianDate(currentDate).monthNameEn} ({toEthiopianDate(currentDate).monthNameAm})</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-[#00D4AA] border border-emerald-500/20">
                  {toEthiopianDate(currentDate).year} E.C.
                </span>
              </>
            ) : (
              <>
                <span>{monthNames[currentDate.getMonth()]}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {currentDate.getFullYear()} G.C.
                </span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleCalendarType && (
            <div className="flex items-center bg-slate-100 dark:bg-[#1C2333] p-1 rounded-xl border border-slate-200 dark:border-[#1E2D40]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onToggleCalendarType('ETHIOPIAN');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  calendarType === 'ETHIOPIAN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🇪🇹 E.C.
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onToggleCalendarType('GREGORIAN');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  calendarType === 'GREGORIAN'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🌐 G.C.
              </button>
            </div>
          )}

          <button
            onClick={goToToday}
            className="px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-300 text-xs font-bold cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* VIEW MODE: MONTH GRID */}
      {viewMode === 'MONTH' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-3 shadow-sm overflow-hidden">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center border-b border-slate-100 dark:border-[#1E2D40] pb-2 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
              <div
                key={d}
                className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                  idx === 0 || idx === 6
                    ? 'text-purple-500 dark:text-[#A78BFA]'
                    : 'text-slate-400 dark:text-[#8899BB]'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((cell) => {
              const dayEvs = eventsByDate[cell.dateStr] || [];
              const isSelected = selectedDateStr === cell.dateStr;

              // Calculate total out/in for day
              let totalOut = 0;
              let totalIn = 0;
              dayEvs.forEach(ev => {
                if (ev.direction === 'OUT') totalOut += ev.amount;
                else totalIn += ev.amount;
              });

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedDateStr(cell.dateStr);
                  }}
                  className={`min-h-[72px] sm:min-h-[85px] p-1.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-[#1C2333] border-purple-500 dark:border-[#00D4AA] ring-2 ring-purple-500/20 dark:ring-[#00D4AA]/20 shadow-md'
                      : cell.isToday
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-600/50'
                      : cell.isCurrentMonth
                      ? 'bg-slate-50/60 dark:bg-[#0A0E1A]/60 border-slate-200/80 dark:border-[#1E2D40] hover:bg-slate-100 dark:hover:bg-[#1C2333]'
                      : 'bg-slate-50/20 dark:bg-[#0A0E1A]/20 border-slate-100 dark:border-[#131926] opacity-40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-emerald-600 text-white'
                          : isSelected
                          ? 'bg-purple-600 dark:bg-[#00D4AA] text-white dark:text-slate-900'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Count Pill */}
                    {dayEvs.length > 0 && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                        {dayEvs.length}
                      </span>
                    )}
                  </div>

                  {/* Closed Days Badge for Sep 10-12 */}
                  {(cell.dateStr === '2026-09-10' || cell.dateStr === '2026-09-11' || cell.dateStr === '2026-09-12') && (
                    <div className="my-1 px-1 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[8px] font-bold uppercase tracking-wider text-center">
                      Closed
                    </div>
                  )}

                  {/* Day Event Preview Dots & Amounts */}
                  <div className="space-y-1 my-1">
                    {dayEvs.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('medium');
                          setActiveModalEvent(ev);
                        }}
                        className="truncate text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-1 hover:scale-105 transition-transform"
                        style={{ backgroundColor: `${ev.color}25`, color: ev.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}

                    {dayEvs.length > 2 && (
                      <span className="text-[8px] font-bold text-slate-400 block text-right">
                        +{dayEvs.length - 2} more
                      </span>
                    )}
                  </div>

                  {/* Day Net Total Badge */}
                  {(totalIn > 0 || totalOut > 0) && (
                    <div className="text-[8px] font-mono font-bold text-slate-600 dark:text-[#8899BB] text-right truncate">
                      {totalOut > 0 && <span className="text-rose-500 dark:text-rose-400">-{Math.round(totalOut)} </span>}
                      {totalIn > 0 && <span className="text-emerald-500 dark:text-[#00D4AA]">+{Math.round(totalIn)}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SELECTED DATE BREAKDOWN & OBLIGATIONS CARD */}
      <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 border-b border-slate-100 dark:border-[#1E2D40] pb-2.5">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-[#A78BFA]">
              SELECTED DAY LEDGER
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {formatDateByCalendar(selectedDateStr, calendarType, true)}
            </h4>
          </div>

          {/* Daily Net Financial Summary */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#1C2333] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1E2D40] shrink-0">
            <div>
              <span className="text-[9px] text-slate-400 block font-mono">DUE IN</span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-[#00D4AA]">
                {formatETB(selectedDaySummary.dueIn)}
              </span>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-[#1E2D40]" />
            <div>
              <span className="text-[9px] text-slate-400 block font-mono">DUE OUT</span>
              <span className="text-xs font-mono font-bold text-rose-500 dark:text-rose-400">
                {formatETB(selectedDaySummary.dueOut)}
              </span>
            </div>
          </div>
        </div>

        {/* List of obligations on selected date */}
        {selectedDayEvents.length === 0 ? (
          (selectedDateStr === '2026-09-10' || selectedDateStr === '2026-09-11' || selectedDateStr === '2026-09-12') ? (
            <div className="p-6 text-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-xl shadow-xs">
                🎉
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Business Closed — Ethiopian New Year (Enkutatash: Pagumē 5 – Meskerem 2)</p>
              <p className="text-[11px] text-slate-600 dark:text-[#8899BB] max-w-md mx-auto leading-relaxed">
                Plus Game Zone was not open on this day; 0 transactions were recorded. Total amounts and wallet balances remain 100% accurate and unaffected.
              </p>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 dark:text-[#8899BB] space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Pending Obligations on this Day</p>
              <p className="text-[11px]">Clear schedule! No Equb, loan, bill, or receivable due.</p>
            </div>
          )
        ) : (
          <div className="space-y-2.5">
            {selectedDayEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={() => {
                  triggerHaptic('medium');
                  setActiveModalEvent(ev);
                }}
                className="bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-purple-400 dark:hover:border-[#00D4AA] rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: `${ev.color}25`, color: ev.color }}
                  >
                    {ev.categoryKey === 'EQUB' && <Building2 className="w-5 h-5" />}
                    {ev.categoryKey === 'LOAN' && <CreditCard className="w-5 h-5" />}
                    {ev.categoryKey === 'RECURRING' && <Repeat className="w-5 h-5" />}
                    {ev.categoryKey === 'RECEIVABLE' && <FileCheck className="w-5 h-5" />}
                    {ev.categoryKey === 'TRANSACTION' && (
                      ev.direction === 'IN' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.2 rounded"
                        style={{ backgroundColor: `${ev.color}20`, color: ev.color }}
                      >
                        {ev.type}
                      </span>
                      {ev.status && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-[#0A0E1A] text-slate-600 dark:text-[#8899BB]">
                          {ev.status}
                        </span>
                      )}
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white mt-1 group-hover:text-purple-600 dark:group-hover:text-[#00D4AA] transition-colors">
                      {ev.title}
                    </h5>
                    <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">{ev.description}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-xs font-mono font-bold block ${
                      ev.direction === 'IN' ? 'text-emerald-600 dark:text-[#00D4AA]' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {ev.direction === 'IN' ? '+' : '-'}{formatETB(ev.amount)}
                  </span>
                  <a
                    href={getGoogleCalendarUrl(ev)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                  >
                    <span>Add to Google</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VIEW MODE: AGENDA LIST VIEW */}
      {viewMode === 'AGENDA' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-4 shadow-sm space-y-3">
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Upcoming Financial Agenda ({filteredEvents.length} items)</span>
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-[#8899BB]">Sorted by due date</span>
          </h4>

          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-[#8899BB] space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Pending Agenda Items</p>
              <p className="text-[11px]">You have no upcoming financial obligations or events scheduled.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    triggerHaptic('medium');
                    setActiveModalEvent(ev);
                  }}
                  className="bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-indigo-400 dark:hover:border-indigo-500 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: `${ev.color}25`, color: ev.color }}
                    >
                      {ev.categoryKey === 'EQUB' && <Building2 className="w-5 h-5" />}
                      {ev.categoryKey === 'LOAN' && <CreditCard className="w-5 h-5" />}
                      {ev.categoryKey === 'RECURRING' && <Repeat className="w-5 h-5" />}
                      {ev.categoryKey === 'RECEIVABLE' && <FileCheck className="w-5 h-5" />}
                      {ev.categoryKey === 'TRANSACTION' && (
                        ev.direction === 'IN' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.2 rounded"
                          style={{ backgroundColor: `${ev.color}20`, color: ev.color }}
                        >
                          {ev.type}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-[#8899BB]">
                          {ev.dateStr}
                        </span>
                        {ev.status && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-[#0A0E1A] text-slate-600 dark:text-[#8899BB]">
                            {ev.status}
                          </span>
                        )}
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {ev.title}
                      </h5>
                      {ev.description && (
                        <p className="text-[10px] text-slate-500 dark:text-[#8899BB] truncate">{ev.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <p
                      className={`text-xs font-mono font-extrabold ${
                        ev.direction === 'IN' ? 'text-emerald-600 dark:text-[#00D4AA]' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {ev.direction === 'IN' ? '+' : '-'}{formatETB(ev.amount)}
                    </p>
                    <a
                      href={getGoogleCalendarUrl(ev)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-0.5 justify-end mt-1"
                    >
                      <span>Google Sync</span> <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EVENT DETAILS & GOOGLE CALENDAR MODAL */}
      {activeModalEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] w-full max-w-md p-5 rounded-2xl space-y-4 shadow-2xl text-slate-900 dark:text-white animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E2D40] pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: `${activeModalEvent.color}25`, color: activeModalEvent.color }}
                >
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase"
                    style={{ backgroundColor: `${activeModalEvent.color}20`, color: activeModalEvent.color }}
                  >
                    {activeModalEvent.type}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{activeModalEvent.title}</h3>
                </div>
              </div>

              <button
                onClick={() => setActiveModalEvent(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Event Details */}
            <div className="space-y-3 bg-slate-50 dark:bg-[#1C2333] p-3.5 rounded-xl border border-slate-200 dark:border-[#1E2D40]">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-[#8899BB]">Obligation Amount:</span>
                <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                  {formatETB(activeModalEvent.amount)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-[#8899BB]">Scheduled Date:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {activeModalEvent.dateStr}
                </span>
              </div>

              {activeModalEvent.description && (
                <div className="pt-2 border-t border-slate-200 dark:border-[#1E2D40]">
                  <span className="text-[10px] text-slate-400 block font-mono uppercase mb-0.5">Notes & Scope</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {activeModalEvent.description}
                  </p>
                </div>
              )}
            </div>

            {/* Google Calendar Quick Add Button */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-[#00D4AA] font-bold text-xs">
                <Globe className="w-4 h-4 text-emerald-600 dark:text-[#00D4AA]" />
                <span>Sync with Google Calendar</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-[#8899BB] leading-snug">
                Click below to auto-populate this financial obligation directly into your personal or company Google Calendar.
              </p>

              <a
                href={getGoogleCalendarUrl(activeModalEvent)}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <span>Open in Google Calendar</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <button
              onClick={() => setActiveModalEvent(null)}
              className="w-full py-2 bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] rounded-xl hover:bg-slate-200 transition-colors"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
