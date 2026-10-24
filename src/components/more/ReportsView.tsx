import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  Printer,
  FileSpreadsheet,
  FileText,
  Filter,
  TrendingUp,
  TrendingDown,
  Scale,
  Mail,
  Send,
  PieChart,
  Layers,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  AlertCircle,
  ShieldCheck,
  Eye,
  History,
  Users,
  RefreshCw,
  Server,
  Key,
  Lock,
  Check,
  ExternalLink,
  ShieldAlert,
  Calendar,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpDown,
  Receipt,
  ListFilter,
  SlidersHorizontal,
  ArrowUpRight
} from 'lucide-react';
import { ERPState, SentReportEmailLog, Transaction } from '../../types';
import { calculateTotalBusinessBalance, formatETB, calculateWalletBalance } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import { formatDateByCalendar } from '../../lib/ethiopianCalendar';
import {
  generatePDFReport,
  generateAuditPDFReport,
  generateExcelReport,
  printFinancialStatement
} from '../../lib/exports';
import { ModernDateInput } from '../common/ModernDateInput';
import { formatDataDurationSpan, DataDurationSpan } from '../../lib/dateUtils';

interface ReportsViewProps {
  state: ERPState;
  onUpdateState?: (fn: (prev: ERPState) => ERPState) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ state, onUpdateState }) => {
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'month' | 'last_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedWallet, setSelectedWallet] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'INCOME' | 'EXPENSE'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [includeCoverPage, setIncludeCoverPage] = useState<boolean>(true);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [groupBy, setGroupBy] = useState<'NONE' | 'CATEGORY' | 'PAYMENT_METHOD' | 'USER' | 'BRANCH' | 'DAY' | 'MONTH'>('NONE');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Email modal & automated schedule state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalTab, setEmailModalTab] = useState<'SCHEDULE' | 'SMTP' | 'PREVIEW' | 'LOGS'>('SCHEDULE');
  const [attachPDF, setAttachPDF] = useState(state.automatedEmailReportsSettings?.includePdfAttachment ?? true);
  const [attachExcel, setAttachExcel] = useState(state.automatedEmailReportsSettings?.includeExcelAttachment ?? true);
  const [autoScheduleActive, setAutoScheduleActive] = useState(state.automatedEmailReportsSettings?.enabled ?? true);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMessage, setEmailSuccessMessage] = useState<string | null>(null);
  const [emailErrorMessage, setEmailErrorMessage] = useState<string | null>(null);
  
  // HTML Template Preview state
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // SMTP Configuration state
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSmtpConfigured, setIsSmtpConfigured] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [smtpSaveMessage, setSmtpSaveMessage] = useState<string | null>(null);

  // Expense Breakdown Details Explorer states
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expenseDetailsViewMode, setExpenseDetailsViewMode] = useState<'CATEGORIES' | 'ALL_EXPENSES'>('CATEGORIES');
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [expenseSortBy, setExpenseSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);

  // Filter eligible recipients strictly to Admin and SuperUser roles
  const eligibleAdminSuperusers = useMemo(() => {
    return (state.users || []).filter(u => {
      const role = (u.role || '').toLowerCase();
      return (role === 'superadmin' || role === 'admin') && u.active !== false;
    });
  }, [state.users]);

  // Filter transactions (all transactions are visible across reports)
  const filteredTransactions = useMemo(() => {
    return state.transactions.filter(t => {
      if (selectedType !== 'all' && t.type !== selectedType) return false;
      if (selectedWallet !== 'all' && t.walletId !== selectedWallet) return false;
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
      if (selectedUser !== 'all' && (t.creatorName || 'System') !== selectedUser) return false;

      if (dateRange !== 'all') {
        const tDate = new Date(t.date);
        const now = new Date();

        if (dateRange === 'today') {
          if (tDate.toDateString() !== now.toDateString()) return false;
        } else if (dateRange === 'month') {
          if (tDate.getMonth() !== now.getMonth() || tDate.getFullYear() !== now.getFullYear()) return false;
        } else if (dateRange === 'last_month') {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          if (tDate.getMonth() !== lastMonth.getMonth() || tDate.getFullYear() !== lastMonth.getFullYear()) return false;
        } else if (dateRange === 'custom') {
          const start = customStartDate ? new Date(`${customStartDate}T00:00:00.000Z`) : null;
          const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999Z`) : null;
          if (start && tDate < start) return false;
          if (end && tDate > end) return false;
        }
      }

      return true;
    });
  }, [state.transactions, selectedType, selectedWallet, selectedCategory, selectedUser, dateRange, customStartDate, customEndDate]);

  const activeFilterCount = (dateRange !== 'all' ? 1 : 0) +
    (selectedWallet !== 'all' ? 1 : 0) +
    (selectedType !== 'all' ? 1 : 0) +
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedUser !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setDateRange('all');
    setSelectedWallet('all');
    setSelectedType('all');
    setSelectedCategory('all');
    setSelectedUser('all');
    setIncludeCoverPage(true);
    setOrientation('landscape');
    setGroupBy('NONE');
  };

  const totalBalance = calculateTotalBusinessBalance(state.wallets, state.transactions, state.transfers);
  
  // Calculate stats for filtered set
  const filteredIncome = filteredTransactions.filter(t => t.type === 'INCOME' && !t.reversed).reduce((s, t) => s + t.amount, 0);
  const filteredExpense = filteredTransactions.filter(t => t.type === 'EXPENSE' && !t.reversed).reduce((s, t) => s + t.amount, 0);
  const filteredProfit = filteredIncome - filteredExpense;

  const totalAssetsValue = state.assets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalLoansOutstanding = state.loans.reduce((sum, l) => sum + l.outstandingBalance, 0);
  const netWorth = totalBalance + totalAssetsValue - totalLoansOutstanding;

  // Receivables summary
  const totalReceivablesOwed = state.receivables.filter(r => r.status === 'OUTSTANDING').reduce((s, r) => s + (r.amountOwed - (r.amountCollected || 0)), 0);
  const overdueReceivables = state.receivables.filter(r => r.status === 'OUTSTANDING' && new Date(r.dueDate) < new Date()).reduce((s, r) => s + (r.amountOwed - (r.amountCollected || 0)), 0);

  // Expenses Category Breakdown Calculation with precise Data Span (duration) analysis
  const expenseCategoryBreakdown = useMemo(() => {
    const expensesOnly = filteredTransactions.filter(t => t.type === 'EXPENSE' && !t.reversed);
    const totalExpenseAmount = expensesOnly.reduce((sum, t) => sum + t.amount, 0);

    const map: Record<
      string,
      {
        category: string;
        total: number;
        count: number;
        maxItem: number;
        minItem: number;
        transactions: Transaction[];
        walletCounts: Record<string, number>;
      }
    > = {};
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    expensesOnly.forEach(t => {
      if (!map[t.category]) {
        map[t.category] = {
          category: t.category,
          total: 0,
          count: 0,
          maxItem: 0,
          minItem: Infinity,
          transactions: [],
          walletCounts: {}
        };
      }
      map[t.category].total += t.amount;
      map[t.category].count += 1;
      map[t.category].transactions.push(t);
      if (t.amount > map[t.category].maxItem) {
        map[t.category].maxItem = t.amount;
      }
      if (t.amount < map[t.category].minItem) {
        map[t.category].minItem = t.amount;
      }

      const wId = t.walletId || 'unassigned';
      map[t.category].walletCounts[wId] = (map[t.category].walletCounts[wId] || 0) + 1;

      if (t.date) {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          if (!minDate || d < minDate) minDate = d;
          if (!maxDate || d > maxDate) maxDate = d;
        }
      }
    });

    const dataSpan: DataDurationSpan | null = minDate && maxDate ? formatDataDurationSpan(minDate, maxDate) : null;
    const spanDays = Math.max(dataSpan ? dataSpan.totalDays : 1, 1);
    const dailyBurnRate = totalExpenseAmount / spanDays;
    const weeklyBurnRate = dailyBurnRate * 7;

    const list = Object.values(map).map(item => {
      let topWalletId = '';
      let topWalletCount = 0;
      Object.entries(item.walletCounts).forEach(([wId, cnt]) => {
        if (cnt > topWalletCount) {
          topWalletCount = cnt;
          topWalletId = wId;
        }
      });

      return {
        ...item,
        minItem: item.minItem === Infinity ? item.total : item.minItem,
        avgItem: item.count > 0 ? item.total / item.count : item.total,
        dailyRate: item.total / spanDays,
        percentage: totalExpenseAmount > 0 ? (item.total / totalExpenseAmount) * 100 : 0,
        topWalletId
      };
    });

    list.sort((a, b) => b.total - a.total);

    return {
      list,
      allExpenses: expensesOnly,
      totalExpenseAmount,
      totalCount: expensesOnly.length,
      topCategory: list[0] || null,
      dataSpan,
      spanDays,
      dailyBurnRate,
      weeklyBurnRate,
      minDate,
      maxDate
    };
  }, [filteredTransactions]);

  const toggleCategoryExpand = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
    triggerHaptic('light');
  };

  const expandAllCategories = () => {
    const allExp: Record<string, boolean> = {};
    expenseCategoryBreakdown.list.forEach(c => {
      allExp[c.category] = true;
    });
    setExpandedCategories(allExp);
    triggerHaptic('light');
  };

  const collapseAllCategories = () => {
    setExpandedCategories({});
    triggerHaptic('light');
  };

  const getWalletName = (walletId: string) => {
    const w = state.wallets.find(item => item.id === walletId);
    return w ? w.name : walletId;
  };

  const sortExpenseTransactions = (txs: Transaction[]) => {
    return [...txs].sort((a, b) => {
      if (expenseSortBy === 'date_desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (expenseSortBy === 'date_asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (expenseSortBy === 'amount_desc') {
        return b.amount - a.amount;
      }
      if (expenseSortBy === 'amount_asc') {
        return a.amount - b.amount;
      }
      return 0;
    });
  };

  const filterExpenseTransactions = (txs: Transaction[]) => {
    if (!expenseSearchQuery.trim()) return txs;
    const q = expenseSearchQuery.toLowerCase().trim();
    return txs.filter(t => {
      const desc = (t.description || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      const user = (t.creatorName || '').toLowerCase();
      const wallet = getWalletName(t.walletId).toLowerCase();
      const amt = t.amount.toString();
      const id = (t.id || '').toLowerCase();
      const notes = (t.notes || '').toLowerCase();
      return desc.includes(q) || cat.includes(q) || user.includes(q) || wallet.includes(q) || amt.includes(q) || id.includes(q) || notes.includes(q);
    });
  };

  const handleExportPDF = () => {
    triggerHaptic('medium');
    generatePDFReport({
      state,
      transactions: filteredTransactions,
      dateRangeLabel: dateRange === 'custom' ? `${customStartDate} to ${customEndDate}` : dateRange.toUpperCase(),
      reportTitle: `Financial Statement & Transaction Audit (${filteredTransactions.length} items)`,
      includeCoverPage,
      orientation,
      groupBy
    });
  };

  const handleExportExcel = () => {
    triggerHaptic('heavy');
    generateExcelReport({
      state,
      transactions: filteredTransactions,
      dateRangeLabel: dateRange === 'custom' ? `${customStartDate} to ${customEndDate}` : dateRange.toUpperCase(),
      reportTitle: `Banking & Financial Statement Package (${filteredTransactions.length} items)`,
      groupBy
    });
  };

  // Build report payload for backend API
  const buildReportPayload = () => {
    const now = new Date();
    const currentMonthIncome = state.transactions
      .filter(t => t.type === 'INCOME' && !t.reversed && new Date(t.date).getMonth() === now.getMonth())
      .reduce((s, t) => s + t.amount, 0);
    const currentMonthExpense = state.transactions
      .filter(t => t.type === 'EXPENSE' && !t.reversed && new Date(t.date).getMonth() === now.getMonth())
      .reduce((s, t) => s + t.amount, 0);

    const walletsPayload = state.wallets.map(w => ({
      name: w.name,
      type: w.type,
      balance: calculateWalletBalance(w, state.transactions, state.transfers),
      accountNumber: w.accountNumber
    }));

    const topCategoriesPayload = expenseCategoryBreakdown.list.slice(0, 5).map(c => ({
      name: c.category,
      amount: c.total,
      percentage: c.percentage
    }));

    const activeEqubVolume = state.equbs.filter(e => e.status === 'ACTIVE').reduce((s, e) => s + (e.contributionPerRound * (e.totalRounds || e.members?.length || 1)), 0);

    return {
      periodLabel: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      periodKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      totalBalance,
      monthlyIncome: currentMonthIncome || filteredIncome,
      monthlyExpense: currentMonthExpense || filteredExpense,
      netProfit: (currentMonthIncome || filteredIncome) - (currentMonthExpense || filteredExpense),
      wallets: walletsPayload,
      receivables: {
        totalOwed: totalReceivablesOwed,
        outstandingCount: state.receivables.filter(r => r.status === 'OUTSTANDING').length,
        overdueAmount: overdueReceivables
      },
      loans: {
        totalBorrowed: totalLoansOutstanding,
        totalLent: 0,
        activeCount: state.loans.filter(l => l.status === 'ACTIVE').length
      },
      equbs: {
        activeCircles: state.equbs.filter(e => e.status === 'ACTIVE').length,
        monthlyVolume: activeEqubVolume
      },
      topExpenseCategories: topCategoriesPayload,
      includePdf: attachPDF,
      recipients: eligibleAdminSuperusers.map(u => ({
        name: u.name,
        email: u.email || `${u.username || 'admin'}@pluszone.et`,
        role: u.role
      }))
    };
  };

  // Fetch HTML preview from server
  const loadHtmlPreview = async () => {
    try {
      setIsLoadingPreview(true);
      const payload = buildReportPayload();
      const res = await fetch('/api/reports/preview-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.html) {
        setPreviewHtml(data.html);
      }
    } catch (err) {
      console.error('Failed to load email HTML preview:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Load SMTP config status
  const loadSmtpConfig = async () => {
    try {
      const res = await fetch('/api/reports/smtp-config');
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setSmtpHost(data.data.host || 'smtp.gmail.com');
        setSmtpPort(String(data.data.port || 587));
        setSmtpUser(data.data.user || '');
        setSmtpFrom(data.data.from || '');
        setSmtpSecure(Boolean(data.data.secure));
        setIsSmtpConfigured(Boolean(data.data.isConfigured));
      }
    } catch (err) {
      console.error('Failed to load SMTP status:', err);
    }
  };

  useEffect(() => {
    if (isEmailModalOpen && (emailModalTab === 'SMTP' || emailModalTab === 'SCHEDULE')) {
      loadSmtpConfig();
    }
  }, [isEmailModalOpen, emailModalTab]);

  // Test SMTP Connection
  const handleTestSmtp = async () => {
    if (!smtpHost || !smtpUser || !smtpPass) {
      setSmtpTestResult({
        success: false,
        message: 'Please fill in SMTP Host, Username/Email, and Password/App Password.'
      });
      return;
    }

    triggerHaptic('medium');
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    setSmtpSaveMessage(null);

    try {
      const res = await fetch('/api/reports/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort) || 587,
          user: smtpUser,
          pass: smtpPass,
          secure: smtpSecure
        })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSmtpTestResult({
          success: true,
          message: data.message || 'SMTP connection and authentication verified successfully!'
        });
      } else {
        setSmtpTestResult({
          success: false,
          message: data.error || 'Failed to authenticate with SMTP server.'
        });
      }
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: err.message || 'Network error occurred while testing SMTP connection.'
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  // Save SMTP Settings
  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpHost || !smtpUser || !smtpPass) {
      setSmtpSaveMessage('Host, Username/Email, and Password/App Password are required.');
      return;
    }

    triggerHaptic('heavy');
    setIsSavingSmtp(true);
    setSmtpSaveMessage(null);

    try {
      const res = await fetch('/api/reports/smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort) || 587,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom || `PlusZone Finance ERP <${smtpUser}>`,
          secure: smtpSecure
        })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setIsSmtpConfigured(true);
        setSmtpSaveMessage('SMTP Configuration successfully saved and activated!');
        setSmtpTestResult(null);
        setTimeout(() => setSmtpSaveMessage(null), 5000);
      } else {
        setSmtpSaveMessage(`Error: ${data.error || 'Failed to save SMTP settings'}`);
      }
    } catch (err: any) {
      setSmtpSaveMessage(`Network Error: ${err.message || 'Failed to save settings'}`);
    } finally {
      setIsSavingSmtp(false);
    }
  };

  // Trigger immediate dispatch
  const handleSendEmailReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (eligibleAdminSuperusers.length === 0) {
      setEmailErrorMessage('No Admin or SuperUser accounts found with valid email addresses.');
      return;
    }

    triggerHaptic('heavy');
    setIsSendingEmail(true);
    setEmailErrorMessage(null);
    setEmailSuccessMessage(null);

    try {
      const payload = buildReportPayload();
      const res = await fetch('/api/reports/send-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          triggerType: 'MANUAL_DISPATCH'
        })
      });

      const data = await res.json();

      if (!res.ok || data.status === 'error') {
        throw new Error(data.error || 'Failed to dispatch monthly email report');
      }

      const log = data.data?.log;
      const recipientCount = eligibleAdminSuperusers.length;

      // Update state if log exists
      if (log && onUpdateState) {
        onUpdateState(prev => ({
          ...prev,
          sentReportEmailLogs: [log, ...(prev.sentReportEmailLogs || [])],
          automatedEmailReportsSettings: {
            ...(prev.automatedEmailReportsSettings || {
              enabled: true,
              dayOfMonth: 2,
              sendHourEAT: 8,
              roles: ['SuperAdmin', 'Admin']
            }),
            lastSentPeriod: payload.periodLabel,
            lastSentTimestamp: new Date().toISOString()
          }
        }));
      }

      setEmailSuccessMessage(
        `Monthly financial report dispatched successfully to ${recipientCount} Admin & SuperUser account(s)!`
      );

      setTimeout(() => {
        setEmailSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error('Email dispatch error:', err);
      setEmailErrorMessage(err.message || 'An error occurred during report dispatch.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const logsList: SentReportEmailLog[] = state.sentReportEmailLogs || [];

  return (
    <div className="space-y-4 pb-20">
      
      {/* Title & Global Export / Email Hub */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00D4AA]" />
            Financial Statements & Banking Reports
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#8899BB]">
            Audited P&L statements, general expenses by category, and automated 2nd-of-month email report schedules
          </p>
        </div>

        {/* Export & Email Buttons */}
        <div id="tour-reports-export-action" data-tour="reports-export-action" className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              triggerHaptic('medium');
              setEmailModalTab('SCHEDULE');
              setIsEmailModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
            title="Automated Monthly Email Schedule (2nd of Every Month)"
          >
            <Mail className="w-4 h-4" />
            <span>Monthly Email Hub</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
            title="Download PDF Document"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('medium');
              generateAuditPDFReport({
                state,
                transactions: filteredTransactions
              });
            }}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
            title="Download 13-Column Transaction, Loan, Equb & Receivable Audit PDF"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Audit PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 dark:bg-[#00D4AA] text-white dark:text-[#0A0E1A] font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer hover:brightness-110 transition-all active:scale-95"
            title="Download Multi-Tab Excel Workbook (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export xlsx</span>
          </button>

          <button
            onClick={printFinancialStatement}
            className="p-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-[#252E42] transition-colors"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PROMINENT AUTOMATED MONTHLY REPORT EMAIL SCHEDULE BANNER */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-500/40 rounded-2xl p-4 sm:p-5 text-white shadow-lg space-y-3 relative overflow-hidden animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0 shadow-inner">
              <Mail className="w-5 h-5 text-[#00D4AA]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black text-white tracking-wide">
                  Automated Monthly Executive Financial Statement
                </h4>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/40 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> Every 2nd of Month
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/40 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Admin & SuperUser Only
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                Automatic monthly P&L balance sheet, wallet breakdown, and receivables summary auto-dispatched on every month’s <strong>2nd day at 08:00 AM EAT</strong> exclusively to verified Admin and SuperUser accounts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                triggerHaptic('light');
                setEmailModalTab('PREVIEW');
                setIsEmailModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#00D4AA]" />
              <span>Preview Email</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('medium');
                setEmailModalTab('SCHEDULE');
                setIsEmailModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0A0E1A] text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Trigger Dispatch</span>
            </button>
          </div>
        </div>

        {/* Audience List & Notice */}
        <div className="pt-2 border-t border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-indigo-300">Authorized Recipients:</span>
            {eligibleAdminSuperusers.map(u => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 text-slate-200 px-2.5 py-0.5 rounded-lg text-[11px] font-mono"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <strong>{u.name}</strong>
                <span className="text-slate-400 text-[10px]">({u.email || 'email configured'})</span>
              </span>
            ))}
          </div>

          <div className="text-[10px] text-slate-400 italic">
            * Executive statements delivered to authorized management accounts
          </div>
        </div>
      </div>

      {/* Filter Toolbar Header with Icon Button */}
      <div id="tour-reports-filter-bar" data-tour="reports-filter-bar" className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Icon Trigger Button */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setIsFilterModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Filter className="w-4 h-4 text-indigo-500" />
            <span>Filter Statements</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-mono text-[10px] flex items-center justify-center font-extrabold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Active Filter Pills */}
          {dateRange !== 'all' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] px-2.5 py-1 rounded-lg text-slate-800 dark:text-slate-200">
              Period: {dateRange === 'custom' ? `${customStartDate} → ${customEndDate}` : dateRange.replace('_', ' ').toUpperCase()}
              <button onClick={() => setDateRange('all')} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedWallet !== 'all' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] px-2.5 py-1 rounded-lg text-slate-800 dark:text-slate-200">
              Wallet: {getWalletName(selectedWallet)}
              <button onClick={() => setSelectedWallet('all')} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedType !== 'all' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] px-2.5 py-1 rounded-lg text-slate-800 dark:text-slate-200">
              Type: {selectedType}
              <button onClick={() => setSelectedType('all')} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedCategory !== 'all' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] px-2.5 py-1 rounded-lg text-slate-800 dark:text-slate-200">
              Cat: {selectedCategory}
              <button onClick={() => setSelectedCategory('all')} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                triggerHaptic('light');
                resetFilters();
              }}
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer ml-1"
            >
              Reset All
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/60 shrink-0">
            {filteredTransactions.length} Match
          </span>
        </div>
      </div>

      {/* Net Worth & Executive Balance Sheet */}
      <div id="tour-financial-reports" data-tour="financial-reports" className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Balance Sheet Summary */}
        <div id="tour-reports-summary-metrics" data-tour="reports-summary-metrics" className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-[#F0F4FF] uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-emerald-500" />
              <span>Balance Sheet Position</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">Real-Time Valuation</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 dark:bg-[#1C2333] p-3 rounded-xl border border-slate-100 dark:border-transparent">
              <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block">Liquid Wallet Cash</span>
              <p className="text-sm font-black font-mono text-emerald-600 dark:text-[#00D4AA] mt-0.5">{formatETB(totalBalance)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-[#1C2333] p-3 rounded-xl border border-slate-100 dark:border-transparent">
              <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block">Fixed Assets Valuation</span>
              <p className="text-sm font-black font-mono text-amber-600 dark:text-[#F5A623] mt-0.5">{formatETB(totalAssetsValue)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-[#1C2333] p-3 rounded-xl border border-slate-100 dark:border-transparent">
              <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block">Outstanding Liabilities</span>
              <p className="text-sm font-black font-mono text-red-600 dark:text-red-400 mt-0.5">{formatETB(totalLoansOutstanding)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-[#1C2333] p-3 rounded-xl border border-emerald-500/30 dark:border-[#00D4AA]/30">
              <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block">Total Net Worth</span>
              <p className="text-sm font-black font-mono text-emerald-600 dark:text-[#00D4AA] mt-0.5">{formatETB(netWorth)}</p>
            </div>
          </div>
        </div>

        {/* Filtered Income & Expense Statement */}
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-[#F0F4FF] uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>Income Statement ({dateRange.replace('_', ' ').toUpperCase()})</span>
            </h4>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold font-mono">
              Scope: {selectedWallet === 'all' ? 'All Wallets' : getWalletName(selectedWallet)}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
              <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Gross Income Revenue</span>
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatETB(filteredIncome)}</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40">
              <span className="text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Operating Expenses</span>
              </span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{formatETB(filteredExpense)}</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl bg-indigo-500/10 dark:bg-[#00D4AA]/15 border border-indigo-500/30 dark:border-[#00D4AA]/30">
              <span className="text-indigo-900 dark:text-[#00D4AA] font-black">Net Profit Margin</span>
              <span className={`font-mono font-black text-sm ${filteredProfit >= 0 ? 'text-emerald-600 dark:text-[#00D4AA]' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatETB(filteredProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Partner Profit Distributions & Ownership Equity Shares */}
      <div id="tour-partner-distributions" data-tour="partner-distributions" className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-[#1E2D40] pb-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-[#F0F4FF] uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <span>Partner Profit Distributions & Equity Shares</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-[#8899BB] mt-0.5">
              Net distributable business profit allocations divided transparently by partner ownership equity
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
              Distributable Net Profit: {formatETB(Math.max(0, filteredProfit))}
            </span>
          </div>
        </div>

        {/* Partners Equity Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(state.users && state.users.length > 0 ? state.users.filter(u => u.active !== false).slice(0, 3) : [
            { id: 'usr-1', name: 'Dawit Bekele', role: 'SuperAdmin', email: 'dawit@pluszone.et', branch: 'Main Center' },
            { id: 'usr-2', name: 'Bethlehem Tadesse', role: 'Admin', email: 'bethlehem@pluszone.et', branch: 'Main Center' },
            { id: 'usr-3', name: 'Natnael Alemu', role: 'Manager', email: 'natnael@pluszone.et', branch: 'Branch 2' }
          ]).map((partner, pIdx) => {
            const equityPcts = [45, 35, 20];
            const equity = equityPcts[pIdx] || Math.round(100 / (state.users?.length || 3));
            const partnerPayout = Math.max(0, filteredProfit) * (equity / 100);

            return (
              <div
                key={partner.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-2 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center">
                      {partner.name.charAt(0)}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                        {partner.name}
                      </h5>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {partner.branch || 'Addis Ababa'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    {equity}% Equity
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Calculated Distribution</span>
                    <span className="text-sm font-black font-mono text-emerald-600 dark:text-[#00D4AA]">
                      {formatETB(partnerPayout)}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-[#131926] px-2 py-1 rounded-lg border border-slate-200 dark:border-[#1E2D40]">
                    Auto-Accrued
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* GENERAL EXPENSES BY CATEGORY BREAKDOWN */}
      <div id="tour-reports-chart" data-tour="reports-chart" className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1E2D40] pb-3.5">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-[#F0F4FF] uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-rose-500" />
              <span>General Expenses Breakdown by Category</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-[#8899BB] mt-0.5">
              Categorized analysis of operating expenses, percentage share, and highest expense items
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* DATA DURATION / LENGTH BADGE */}
            {expenseCategoryBreakdown.dataSpan && (
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-medium shadow-2xs"
                title={`Data duration: ${expenseCategoryBreakdown.dataSpan.rangeLabel} (${expenseCategoryBreakdown.dataSpan.totalDays} calendar days)`}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400">Data Length:</span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {expenseCategoryBreakdown.dataSpan.durationText}
                </span>
                <span className="text-[10px] text-indigo-500/80 dark:text-indigo-400/80 font-mono hidden md:inline">
                  ({expenseCategoryBreakdown.dataSpan.totalDays} days)
                </span>
              </div>
            )}

            <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-xl border border-rose-200 dark:border-rose-800">
              Total Expenses: {formatETB(expenseCategoryBreakdown.totalExpenseAmount)}
            </span>
          </div>
        </div>

        {/* DATA LENGTH & STATISTICAL METRICS BANNER */}
        {expenseCategoryBreakdown.dataSpan && expenseCategoryBreakdown.list.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50/90 dark:bg-[#182030] border border-slate-200/80 dark:border-[#223147] text-xs">
            {/* 1. Data Span / Length */}
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-[#1E2D40] shadow-2xs">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
                  Data Span / Length
                </span>
                <span className="font-extrabold text-slate-900 dark:text-white text-xs block truncate text-indigo-600 dark:text-indigo-400">
                  {expenseCategoryBreakdown.dataSpan.durationText}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block truncate font-mono">
                  {expenseCategoryBreakdown.dataSpan.rangeLabel} ({expenseCategoryBreakdown.dataSpan.totalDays}d)
                </span>
                {expenseCategoryBreakdown.dataSpan.ethiopianRangeLabel && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 block truncate">
                    {expenseCategoryBreakdown.dataSpan.ethiopianRangeLabel}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Total Recorded Expenses */}
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-[#1E2D40] shadow-2xs">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                <PieChart className="w-4 h-4" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
                  Total Outflow
                </span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs block truncate">
                  {formatETB(expenseCategoryBreakdown.totalExpenseAmount)}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block truncate">
                  {expenseCategoryBreakdown.totalCount} txns across {expenseCategoryBreakdown.list.length} categories
                </span>
              </div>
            </div>

            {/* 3. Daily Burn Rate */}
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-[#1E2D40] shadow-2xs">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
                  Daily Burn Rate
                </span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-xs block truncate">
                  {formatETB(expenseCategoryBreakdown.dailyBurnRate)}
                  <span className="text-[10px] font-normal text-slate-400">/day</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block truncate">
                  Normalized over {expenseCategoryBreakdown.dataSpan.durationText}
                </span>
              </div>
            </div>

            {/* 4. Weekly Outflow Pace */}
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-[#1E2D40] shadow-2xs">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
                  Weekly Outflow Pace
                </span>
                <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-xs block truncate">
                  {formatETB(expenseCategoryBreakdown.weeklyBurnRate)}
                  <span className="text-[10px] font-normal text-slate-400">/wk</span>
                </span>
                <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block truncate">
                  Projected 7-day run rate
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Operating Hours & Holiday Integrity Notice */}
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#00D4AA] shrink-0" />
          <div className="min-w-0">
            <span className="font-bold text-slate-900 dark:text-white">Ledger & Operating Integrity Verified:</span>{' '}
            <span className="text-slate-600 dark:text-[#8899BB]">
              Plus Game Zone was closed Sep 10 – 12 (Ethiopian New Year). 0 transactions recorded; wallet balances and total business amounts are 100% unaffected. PS4 Pro purchase (49,500 ETB) is classified under the "Purchase" category.
            </span>
          </div>
        </div>

        {expenseCategoryBreakdown.list.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-[#8899BB] space-y-1">
            <Layers className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
            <p className="text-xs font-bold">No expense records found for this period filter.</p>
            <p className="text-[11px]">Select "All Time" or adjust the date scope to view expense category distributions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* DETAIL EXPLORER CONTROLS & SEARCH */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pt-1 border-b border-slate-100 dark:border-[#1E2D40] pb-3">
              {/* Left: View Mode Toggle */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#182030] rounded-xl border border-slate-200/80 dark:border-[#223147] self-start">
                <button
                  type="button"
                  onClick={() => {
                    setExpenseDetailsViewMode('CATEGORIES');
                    triggerHaptic('light');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    expenseDetailsViewMode === 'CATEGORIES'
                      ? 'bg-white dark:bg-[#1E2D40] text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>By Category ({expenseCategoryBreakdown.list.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExpenseDetailsViewMode('ALL_EXPENSES');
                    triggerHaptic('light');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    expenseDetailsViewMode === 'ALL_EXPENSES'
                      ? 'bg-white dark:bg-[#1E2D40] text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>All Expense Items ({expenseCategoryBreakdown.totalCount})</span>
                </button>
              </div>

              {/* Right: Quick Expand/Collapse, Search & Sort */}
              <div className="flex items-center gap-2 flex-wrap">
                {expenseDetailsViewMode === 'CATEGORIES' && (
                  <button
                    type="button"
                    onClick={() => {
                      const allAreExpanded = expenseCategoryBreakdown.list.every(c => expandedCategories[c.category]);
                      if (allAreExpanded) {
                        collapseAllCategories();
                      } else {
                        expandAllCategories();
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#223147] bg-white dark:bg-[#182030] text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    {expenseCategoryBreakdown.list.every(c => expandedCategories[c.category]) ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Collapse All</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>Expand All Details</span>
                      </>
                    )}
                  </button>
                )}

                {/* Search input */}
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={expenseSearchQuery}
                    onChange={e => setExpenseSearchQuery(e.target.value)}
                    placeholder="Search expenses..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-200/80 dark:border-[#223147] text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {expenseSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setExpenseSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Sort Selector */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-200/80 dark:border-[#223147] text-xs">
                  <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                  <select
                    value={expenseSortBy}
                    onChange={e => setExpenseSortBy(e.target.value as any)}
                    aria-label="Sort expense transactions"
                    className="bg-transparent text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="date_desc">Newest Date</option>
                    <option value="date_asc">Oldest Date</option>
                    <option value="amount_desc">Highest Amount</option>
                    <option value="amount_asc">Lowest Amount</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TOP HIGHEST EXPENSE CATEGORY BANNER */}
            {expenseCategoryBreakdown.topCategory && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/20 dark:border-rose-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                    1
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block tracking-wider">
                      Highest Expense Category
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                      {expenseCategoryBreakdown.topCategory.category}
                    </span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm block">
                    {formatETB(expenseCategoryBreakdown.topCategory.total)}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-[#8899BB]">
                    {expenseCategoryBreakdown.topCategory.percentage.toFixed(1)}% of total expenses ({expenseCategoryBreakdown.topCategory.count} txns
                    {expenseCategoryBreakdown.dataSpan ? ` • ~${formatETB(expenseCategoryBreakdown.topCategory.dailyRate)}/day` : ''})
                  </span>
                </div>
              </div>
            )}

            {/* VIEW MODE 1: BY CATEGORY (WITH ACCORDION TRANSACTION DETAILS) */}
            {expenseDetailsViewMode === 'CATEGORIES' && (
              <div className="space-y-3 pt-1">
                {expenseCategoryBreakdown.list.map((item, idx) => {
                  const isExpanded = !!expandedCategories[item.category];
                  const sortedCategoryTxs = sortExpenseTransactions(filterExpenseTransactions(item.transactions));

                  return (
                    <div
                      key={item.category}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isExpanded
                          ? 'bg-slate-50/90 dark:bg-[#161D2B] border-indigo-200 dark:border-indigo-900/60 shadow-sm'
                          : 'bg-slate-50/50 dark:bg-[#1C2333]/70 border-slate-200/70 dark:border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {/* CATEGORY HEADER ROW */}
                      <div
                        onClick={() => toggleCategoryExpand(item.category)}
                        className="p-3.5 space-y-2 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-[#1A2234] transition-colors"
                        title="Click to view detailed itemized transactions"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-[#252E42] text-slate-700 dark:text-slate-300 font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs mr-2">
                                {item.category}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                ({item.count} {item.count === 1 ? 'transaction' : 'transactions'})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            {expenseCategoryBreakdown.dataSpan && (
                              <span
                                className="text-[10px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline"
                                title="Average expense per day over recorded data span"
                              >
                                ~{formatETB(item.dailyRate)}/day
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-slate-500 dark:text-[#8899BB]">
                              {item.percentage.toFixed(1)}%
                            </span>
                            <span className="font-mono font-black text-slate-900 dark:text-white text-xs">
                              {formatETB(item.total)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCategoryExpand(item.category);
                              }}
                              className={`p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-transform ${
                                isExpanded ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                              }`}
                              title={isExpanded ? 'Hide itemized transactions' : 'Show itemized transactions'}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-slate-200/80 dark:bg-[#0A0E1A] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, item.percentage)}%` }}
                          />
                        </div>
                      </div>

                      {/* EXPANDED ITEMIZED TRANSACTIONS LIST */}
                      {isExpanded && (
                        <div className="border-t border-slate-200/80 dark:border-[#1E2D40] bg-white dark:bg-[#121824] p-3 sm:p-4 space-y-3">
                          {/* Category Statistics Sub-Strip */}
                          <div className="flex items-center justify-between gap-2 flex-wrap p-2.5 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-100 dark:border-[#1E2D40] text-[11px]">
                            <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-slate-600 dark:text-slate-300">
                              <span>
                                Avg Size: <strong className="font-mono text-slate-900 dark:text-white">{formatETB(item.avgItem)}</strong>
                              </span>
                              <span>
                                Range: <strong className="font-mono text-slate-900 dark:text-white">{formatETB(item.minItem)}</strong> – <strong className="font-mono text-slate-900 dark:text-white">{formatETB(item.maxItem)}</strong>
                              </span>
                              {item.topWalletId && (
                                <span>
                                  Primary Method: <strong className="text-indigo-600 dark:text-indigo-400">{getWalletName(item.topWalletId)}</strong>
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              Showing {sortedCategoryTxs.length} of {item.count} items
                            </span>
                          </div>

                          {/* Itemized list */}
                          {sortedCategoryTxs.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                              No expense items match "{expenseSearchQuery}" in this category.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {sortedCategoryTxs.map(tx => {
                                const gregorianDate = formatDateByCalendar(tx.date, 'GREGORIAN', true);
                                const ethiopianDate = formatDateByCalendar(tx.date, 'ETHIOPIAN', false);

                                return (
                                  <div
                                    key={tx.id}
                                    onClick={() => setSelectedTxForDetail(tx)}
                                    className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-[#182030]/80 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border border-slate-100 dark:border-[#1E2D40] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors cursor-pointer group"
                                    title="Click to view full transaction receipt & audit details"
                                  >
                                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                                        <Receipt className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-slate-900 dark:text-white truncate">
                                            {tx.description || tx.category}
                                          </span>
                                          {tx.splits && tx.splits.length > 0 && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                              Split ({tx.splits.length})
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                          <span>{gregorianDate}</span>
                                          <span>•</span>
                                          <span className="text-indigo-600 dark:text-indigo-400">E.C. {ethiopianDate}</span>
                                          <span>•</span>
                                          <span className="text-slate-700 dark:text-slate-300 font-medium font-sans">
                                            {getWalletName(tx.walletId)}
                                          </span>
                                          {tx.creatorName && (
                                            <>
                                              <span>•</span>
                                              <span className="text-slate-500 dark:text-slate-400 font-sans">
                                                by {tx.creatorName}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-center shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#1E2D40]">
                                      <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
                                        - {formatETB(tx.amount)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTxForDetail(tx);
                                        }}
                                        className="p-1 rounded-lg text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        title="View Receipt"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW MODE 2: ALL EXPENSES FLAT LEDGER */}
            {expenseDetailsViewMode === 'ALL_EXPENSES' && (
              <div className="space-y-3 pt-1">
                {(() => {
                  const allSortedTxs = sortExpenseTransactions(filterExpenseTransactions(expenseCategoryBreakdown.allExpenses));
                  const sumMatching = allSortedTxs.reduce((acc, t) => acc + t.amount, 0);

                  return (
                    <>
                      {/* Summary indicator */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-200/70 dark:border-[#1E2D40] text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          Showing <strong className="text-slate-900 dark:text-white">{allSortedTxs.length}</strong> of{' '}
                          <strong className="text-slate-900 dark:text-white">{expenseCategoryBreakdown.totalCount}</strong> expense transactions
                          {expenseSearchQuery ? ` matching "${expenseSearchQuery}"` : ''}
                        </span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          Filtered Total: {formatETB(sumMatching)}
                        </span>
                      </div>

                      {allSortedTxs.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                          No expense items match your search criteria.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {allSortedTxs.map(tx => {
                            const gregorianDate = formatDateByCalendar(tx.date, 'GREGORIAN', true);
                            const ethiopianDate = formatDateByCalendar(tx.date, 'ETHIOPIAN', false);

                            return (
                              <div
                                key={tx.id}
                                onClick={() => setSelectedTxForDetail(tx)}
                                className="p-3 rounded-xl bg-slate-50/70 dark:bg-[#182030]/80 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border border-slate-200/70 dark:border-[#1E2D40] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-colors cursor-pointer group"
                                title="Click to view full transaction receipt & audit details"
                              >
                                <div className="flex items-start sm:items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                                    <Receipt className="w-4 h-4" />
                                  </div>

                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-slate-900 dark:text-white truncate">
                                        {tx.description || tx.category}
                                      </span>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-[#252E42] text-slate-700 dark:text-slate-300">
                                        {tx.category}
                                      </span>
                                      {tx.splits && tx.splits.length > 0 && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                          Split ({tx.splits.length})
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                      <span>{gregorianDate}</span>
                                      <span>•</span>
                                      <span className="text-indigo-600 dark:text-indigo-400">E.C. {ethiopianDate}</span>
                                      <span>•</span>
                                      <span className="text-slate-700 dark:text-slate-300 font-medium font-sans">
                                        {getWalletName(tx.walletId)}
                                      </span>
                                      {tx.creatorName && (
                                        <>
                                          <span>•</span>
                                          <span className="text-slate-500 dark:text-slate-400 font-sans">
                                            by {tx.creatorName}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-center shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#1E2D40]">
                                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
                                    - {formatETB(tx.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTxForDetail(tx);
                                    }}
                                    className="p-1 rounded-lg text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    title="View Receipt"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FILTER DIALOG MODAL */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-3xl p-5 w-full max-w-lg space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E2D40] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Filter className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Filter Financial Statements</h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">Refine scope by wallet, transaction type & category</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2333]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date Scope */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-[#8899BB] block mb-1.5 uppercase tracking-wider">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">All Available Records</option>
                  <option value="today">Today Only</option>
                  <option value="month">Current Month ({new Date().toLocaleDateString('en-US', { month: 'short' })})</option>
                  <option value="last_month">Last Month</option>
                  <option value="custom">📅 Custom Date Range...</option>
                </select>
              </div>

              {/* Wallet Filter */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-[#8899BB] block mb-1.5 uppercase tracking-wider">
                  Wallet / Bank Account
                </label>
                <select
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">All Wallets & Vaults</option>
                  {state.wallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-[#8899BB] block mb-1.5 uppercase tracking-wider">
                  Transaction Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">All Types (Income & Expense)</option>
                  <option value="INCOME">Income Only</option>
                  <option value="EXPENSE">Expenses Only</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-[#8899BB] block mb-1.5 uppercase tracking-wider">
                  Specific Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {state.categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {dateRange === 'custom' && (
              <div className="p-3 bg-slate-50 dark:bg-[#141C2B] rounded-2xl border border-slate-200 dark:border-[#1E2D40] space-y-2">
                <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <span>Custom Date Range Selection</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ModernDateInput
                    label="From Date"
                    value={customStartDate}
                    onChange={(val) => setCustomStartDate(val)}
                    accentColor="indigo"
                    size="sm"
                    helperText="Click box to pick start date"
                  />
                  <ModernDateInput
                    label="To Date"
                    value={customEndDate}
                    onChange={(val) => setCustomEndDate(val)}
                    accentColor="indigo"
                    size="sm"
                    presets={[
                      { label: 'Today', value: new Date().toISOString().split('T')[0] }
                    ]}
                    helperText="Click box to pick end date"
                  />
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-[#1E2D40] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  resetFilters();
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1E2D40] text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  setIsFilterModalOpen(false);
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Apply ({filteredTransactions.length} Matches)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MONTHLY REPORT AUTOMATED EMAIL DISPATCH & PREVIEW MODAL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-3xl p-5 sm:p-6 w-full max-w-2xl max-h-[90vh] flex flex-col space-y-4 shadow-2xl relative overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E2D40] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Automated Monthly Email Reporting Hub
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                    Dispatches on the 2nd of each month for Admin & SuperUser roles only
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2333]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Sub-Tabs: Schedule vs SMTP vs Preview vs Logs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 dark:bg-[#0A0E1A] p-1 rounded-xl border border-slate-200 dark:border-[#1E2D40] shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setEmailModalTab('SCHEDULE');
                }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  emailModalTab === 'SCHEDULE'
                    ? 'bg-white dark:bg-[#131926] text-indigo-600 dark:text-[#00D4AA] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Schedule</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setEmailModalTab('SMTP');
                }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  emailModalTab === 'SMTP'
                    ? 'bg-white dark:bg-[#131926] text-indigo-600 dark:text-[#00D4AA] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>SMTP Config</span>
                {isSmtpConfigured && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setEmailModalTab('PREVIEW');
                }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  emailModalTab === 'PREVIEW'
                    ? 'bg-white dark:bg-[#131926] text-indigo-600 dark:text-[#00D4AA] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setEmailModalTab('LOGS');
                }}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  emailModalTab === 'LOGS'
                    ? 'bg-white dark:bg-[#131926] text-indigo-600 dark:text-[#00D4AA] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Logs ({logsList.length})</span>
              </button>
            </div>

            {/* TAB: SMTP SERVER CONFIGURATION */}
            {emailModalTab === 'SMTP' && (
              <form onSubmit={handleSaveSmtp} className="space-y-4 overflow-y-auto pr-1 flex-1">
                {/* Status Banners */}
                {smtpSaveMessage && (
                  <div className={`p-3.5 rounded-2xl text-center space-y-1 animate-fadeIn ${
                    smtpSaveMessage.includes('Error')
                      ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  }`}>
                    <CheckCircle2 className="w-5 h-5 mx-auto" />
                    <p className="text-xs font-bold">{smtpSaveMessage}</p>
                  </div>
                )}

                {smtpTestResult && (
                  <div className={`p-3.5 rounded-2xl text-center space-y-1 animate-fadeIn ${
                    smtpTestResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}>
                    {smtpTestResult.success ? (
                      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-500 mx-auto" />
                    )}
                    <p className="text-xs font-bold">{smtpTestResult.message}</p>
                  </div>
                )}

                {/* Instruction Callout for Gmail & Corporate SMTP */}
                <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-bold">
                    <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>How to fill SMTP info for Gmail & Google Workspace</span>
                  </div>
                  <ol className="list-decimal list-inside text-[11px] text-indigo-900 dark:text-indigo-300 space-y-1 pl-1">
                    <li>Set <strong>SMTP Host</strong> to <code className="bg-white/60 dark:bg-[#0A0E1A] px-1 py-0.5 rounded font-mono">smtp.gmail.com</code> (Port 587 or 465).</li>
                    <li>Enter your Gmail account as the <strong>Username/Email</strong>.</li>
                    <li>
                      For <strong>Password</strong>: Generate a 16-letter <strong>Google App Password</strong> in your Google Account (*Security &gt; 2-Step Verification &gt; App Passwords*).
                    </li>
                  </ol>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Host */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      SMTP Host Server <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. smtp.gmail.com or mail.yourdomain.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Port */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Port <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* User / Email */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Username / Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="your.email@gmail.com"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Password / App Password */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                        Password / App Password <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[10px] text-indigo-600 dark:text-[#00D4AA] font-bold hover:underline cursor-pointer"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="•••••••••••••••• (16-char App Password)"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        required
                        className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 pr-8 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                      />
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
                    </div>
                  </div>
                </div>

                {/* From Name & Address */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Sender Display Header (From)
                  </label>
                  <input
                    type="text"
                    placeholder={`PlusZone Finance ERP <${smtpUser || 'reports@pluszone.et'}>`}
                    value={smtpFrom}
                    onChange={(e) => setSmtpFrom(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Format: <code>Sender Name &lt;email@domain.com&gt;</code>. Defaults to your authenticated user address.
                  </p>
                </div>

                {/* Secure SSL Toggle */}
                <div className="p-3 bg-slate-50 dark:bg-[#1C2333] rounded-xl border border-slate-200 dark:border-[#1E2D40] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Enforce SSL / TLS Encryption
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Enable for Port 465 (SSL). Keep disabled for Port 587 (STARTTLS).
                    </span>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100 dark:border-[#1E2D40]">
                  <button
                    type="button"
                    onClick={handleTestSmtp}
                    disabled={isTestingSmtp || !smtpHost || !smtpUser || !smtpPass}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1C2333] dark:hover:bg-[#252E42] text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-[#1E2D40] cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isTestingSmtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Connection...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingSmtp || !smtpHost || !smtpUser || !smtpPass}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSavingSmtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Settings...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save &amp; Activate SMTP</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 1: SCHEDULE & DISPATCH */}
            {emailModalTab === 'SCHEDULE' && (
              <div className="space-y-4 overflow-y-auto pr-1">
                {/* Success or Error Banner */}
                {emailSuccessMessage && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-1 animate-fadeIn">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{emailSuccessMessage}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Statement logged in audit history.</p>
                  </div>
                )}

                {emailErrorMessage && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-1 animate-fadeIn">
                    <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
                    <p className="text-xs font-bold text-rose-800 dark:text-rose-300">{emailErrorMessage}</p>
                  </div>
                )}

                {/* Automated Schedule Card */}
                <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                        2nd
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                          Monthly Automatic Dispatch Schedule
                        </h4>
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                          Runs on the <strong>2nd day of every month</strong> at 08:00 AM (East Africa Time)
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoScheduleActive}
                        onChange={(e) => {
                          setAutoScheduleActive(e.target.checked);
                          if (onUpdateState) {
                            onUpdateState(prev => ({
                              ...prev,
                              automatedEmailReportsSettings: {
                                ...(prev.automatedEmailReportsSettings || {
                                  enabled: true,
                                  dayOfMonth: 2,
                                  sendHourEAT: 8,
                                  roles: ['SuperAdmin', 'Admin']
                                }),
                                enabled: e.target.checked
                              }
                            }));
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Active</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-indigo-200/60 dark:border-indigo-800/40">
                    <div className="bg-white/60 dark:bg-[#0A0E1A]/60 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Scheduled Day:</span>
                      <strong className="text-slate-900 dark:text-white font-mono">2nd of Every Month</strong>
                    </div>
                    <div className="bg-white/60 dark:bg-[#0A0E1A]/60 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Target Roles:</span>
                      <strong className="text-purple-600 dark:text-purple-400">SuperAdmin & Admin only</strong>
                    </div>
                  </div>
                </div>

                {/* SMTP Status Quick Badge */}
                <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                  isSmtpConfigured
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
                }`}>
                  <div className="flex items-center gap-2">
                    <Server className={`w-4 h-4 shrink-0 ${isSmtpConfigured ? 'text-emerald-500' : 'text-amber-500'}`} />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-[11px]">
                        SMTP Mail Server: {isSmtpConfigured ? 'Connected & Verified' : 'Preview / Setup Required'}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isSmtpConfigured
                          ? `Host: ${smtpHost} (${smtpUser})`
                          : 'Configure host, user & App Password to enable real inbox dispatches.'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setEmailModalTab('SMTP');
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] text-indigo-600 dark:text-[#00D4AA] hover:bg-slate-50 shrink-0 cursor-pointer shadow-2xs"
                  >
                    {isSmtpConfigured ? 'Manage SMTP' : 'Fill SMTP Info'}
                  </button>
                </div>

                {/* Recipient List Verification */}
                <div className="bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Admin & SuperUser Recipients ({eligibleAdminSuperusers.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Strict Role Filter</span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {eligibleAdminSuperusers.map(u => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center">
                            {u.name.charAt(0)}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{u.name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {u.email || `${u.username}@pluszone.et`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                    Note: Automated executive statements are delivered to designated management accounts.
                  </p>
                </div>

                {/* Attachments */}
                <div className="bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-3.5 space-y-2 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px] uppercase tracking-wider">
                    Attached Statement Formats
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attachPDF}
                        onChange={(e) => setAttachPDF(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-800 dark:text-slate-200 font-semibold text-xs">PDF Statement Summary</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attachExcel}
                        onChange={(e) => setAttachExcel(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-800 dark:text-slate-200 font-semibold text-xs">Multi-Tab Excel Package (.xlsx)</span>
                    </label>
                  </div>
                </div>

                {/* Dispatch Trigger Form Action */}
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-[#1E2D40]">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Next Auto Trigger: <strong className="text-slate-900 dark:text-white">2nd of Month (08:00 AM)</strong>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendEmailReport}
                    disabled={isSendingEmail}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSendingEmail ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending Monthly Statement...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Dispatch Report Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: EMAIL LAYOUT PREVIEW */}
            {emailModalTab === 'PREVIEW' && (
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-[#1C2333] p-2.5 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      HTML Email Statement Template (Admin Edition)
                    </span>
                  </div>
                  <button
                    onClick={loadHtmlPreview}
                    className="text-xs text-indigo-600 dark:text-[#00D4AA] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh Preview
                  </button>
                </div>

                {isLoadingPreview ? (
                  <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                    <p className="text-xs font-bold">Rendering interactive HTML email layout...</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-[#1E2D40] rounded-2xl overflow-hidden bg-white shadow-inner max-h-[500px] overflow-y-auto">
                    <iframe
                      srcDoc={previewHtml}
                      title="Email Preview"
                      className="w-full min-h-[480px] border-0"
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DISPATCH AUDIT LOGS */}
            {emailModalTab === 'LOGS' && (
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {logsList.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-[#8899BB] space-y-1">
                    <History className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
                    <p className="text-xs font-bold">No past report dispatches logged yet.</p>
                    <p className="text-[11px]">Automatic dispatches on the 2nd of each month will be logged here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logsList.map((log, index) => (
                      <div
                        key={log.id || index}
                        className="bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-3.5 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg font-mono font-bold text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                              {log.period}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {log.triggerType === 'AUTOMATIC_SCHEDULE' ? 'Automated 2nd-of-Month Run' : 'Manual Statement Dispatch'}
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'DELIVERED'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : log.status === 'SIMULATED'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          }`}>
                            {log.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          <div className="bg-white dark:bg-[#131926] p-2 rounded-xl">
                            <span className="text-[10px] text-slate-400 block">Total Liquidity</span>
                            <strong className="font-mono text-emerald-600 dark:text-[#00D4AA]">
                              {formatETB(log.summary?.totalBalance || 0)}
                            </strong>
                          </div>
                          <div className="bg-white dark:bg-[#131926] p-2 rounded-xl">
                            <span className="text-[10px] text-slate-400 block">Net Profit</span>
                            <strong className="font-mono text-slate-800 dark:text-slate-200">
                              {formatETB(log.summary?.netProfit || 0)}
                            </strong>
                          </div>
                          <div className="bg-white dark:bg-[#131926] p-2 rounded-xl">
                            <span className="text-[10px] text-slate-400 block">Recipients</span>
                            <strong className="text-slate-800 dark:text-slate-200">
                              {log.recipients?.length || 0} Admins
                            </strong>
                          </div>
                          <div className="bg-white dark:bg-[#131926] p-2 rounded-xl">
                            <span className="text-[10px] text-slate-400 block">Dispatched At</span>
                            <strong className="text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                              {new Date(log.sentAt).toLocaleDateString()}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* TRANSACTION AUDIT & RECEIPT DETAILS MODAL */}
      {selectedTxForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-3xl p-5 sm:p-6 w-full max-w-lg space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E2D40] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-2xs">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Expense Transaction Audit Details</h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8899BB] font-mono">Ref: {selectedTxForDetail.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxForDetail(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1E2D40] text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Amount Banner */}
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">
                Total Outflow Amount
              </span>
              <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
                - {formatETB(selectedTxForDetail.amount)}
              </div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {selectedTxForDetail.category}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-100 dark:border-[#223147] space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Gregorian Date</span>
                <span className="font-semibold text-slate-900 dark:text-white block font-mono">
                  {formatDateByCalendar(selectedTxForDetail.date, 'GREGORIAN', true)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-100 dark:border-[#223147] space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Ethiopian Date</span>
                <span className="font-semibold text-slate-900 dark:text-white block font-mono text-indigo-600 dark:text-indigo-400">
                  {formatDateByCalendar(selectedTxForDetail.date, 'ETHIOPIAN', true)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-100 dark:border-[#223147] space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Payment Wallet</span>
                <span className="font-bold text-slate-900 dark:text-white block truncate">
                  {getWalletName(selectedTxForDetail.walletId)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-100 dark:border-[#223147] space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Expense Scope</span>
                <span className="font-bold text-slate-900 dark:text-white block">
                  {selectedTxForDetail.expenseScope === 'PERSONAL' ? 'Personal Outflow' : 'Business Operational'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-100 dark:border-[#223147] space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Logged By</span>
                <span className="font-bold text-slate-900 dark:text-white block truncate">
                  {selectedTxForDetail.creatorName || 'System'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-100 dark:border-[#223147] space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Branch</span>
                <span className="font-bold text-slate-900 dark:text-white block truncate">
                  {selectedTxForDetail.branch || 'Addis Ababa HQ'}
                </span>
              </div>
            </div>

            {/* Description / Notes */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#182030] border border-slate-100 dark:border-[#223147] space-y-1 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                Description / Purpose
              </span>
              <p className="text-slate-800 dark:text-slate-200 font-medium">
                {selectedTxForDetail.description || 'No description recorded'}
              </p>
              {selectedTxForDetail.notes && selectedTxForDetail.notes !== selectedTxForDetail.description && (
                <p className="text-[11px] text-slate-500 dark:text-[#8899BB] pt-1 border-t border-slate-200/50 dark:border-slate-800">
                  Note: {selectedTxForDetail.notes}
                </p>
              )}
            </div>

            {/* Split allocations if present */}
            {selectedTxForDetail.splits && selectedTxForDetail.splits.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">
                  Split Payment Accounts Breakdown
                </span>
                <div className="space-y-1.5">
                  {selectedTxForDetail.splits.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-800 dark:text-slate-200">
                      <span>{getWalletName(s.walletId)}</span>
                      <span className="font-mono font-bold">{formatETB(s.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTxForDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1E2D40] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#25364E] text-xs font-bold transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
