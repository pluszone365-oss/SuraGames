import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Calendar as CalendarIcon,
  Wallet as WalletIcon,
  Tag,
  Zap,
  TrendingUp,
  TrendingDown,
  FileCheck,
  Coins,
  FileText,
  Layers,
  Sparkles,
  Calculator,
  User,
  Briefcase,
  Building2,
  Users,
  CheckCircle2,
  DollarSign,
  HandCoins,
  Repeat,
  Plus,
  Clock
} from 'lucide-react';
import { Wallet, Category, TransactionType, UserProfile, Transaction, Transfer, Equb, Loan, RecurringTemplate } from '../../types';
import { formatETB, parseSummedAmount, calculateWalletBalance, getWalletNickname, isOverdraftAllowed, isWalletActive, validateTransactionPosting } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import { ModernDateInput } from '../common/ModernDateInput';

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  categories: Category[];
  currentUser: UserProfile;
  defaultWalletId?: string;
  transactions?: Transaction[];
  transfers?: Transfer[];
  equbs?: Equb[];
  loans?: Loan[];
  recurring?: RecurringTemplate[];
  onSubmitTransaction: (data: {
    type: TransactionType;
    amount: number;
    walletId: string;
    category: string;
    description: string;
    date: string;
    isCreditSale?: boolean;
    customerName?: string;
    dueDate?: string;
    expenseScope?: 'BUSINESS' | 'PERSONAL';
    refType?: 'LOAN' | 'RECEIVABLE' | 'EQUB' | 'TRANSFER' | 'SPLIT_SUB_ENTRY' | 'RECURRING';
    refId?: string;
    splits?: Array<{ walletId: string; amount: number }>;
  }) => void;
  onBatchSubmitTransactions?: (items: Array<{
    type: TransactionType;
    amount: number;
    walletId: string;
    category: string;
    description: string;
    date: string;
    expenseScope?: 'BUSINESS' | 'PERSONAL';
    refType?: 'LOAN' | 'RECEIVABLE' | 'EQUB' | 'TRANSFER' | 'SPLIT_SUB_ENTRY' | 'RECURRING';
    refId?: string;
  }>) => void;
  onCreateEqub?: (eq: Omit<Equb, 'id' | 'currentRound' | 'computedEndingDate' | 'status'> & {
    computedEndingDate?: string;
    advanceMonthsPrepaid?: number;
    initialCompletedRounds?: number;
    recordAdvanceTransaction?: boolean;
    advancePaymentWalletId?: string;
  }) => Equb | void;
  prefilledText?: string;
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  wallets,
  categories,
  currentUser,
  defaultWalletId,
  transactions = [],
  transfers = [],
  equbs = [],
  loans = [],
  recurring = [],
  onSubmitTransaction,
  onBatchSubmitTransactions,
  onCreateEqub,
  prefilledText
}) => {
  const [entryMode, setEntryMode] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [batchMode, setBatchMode] = useState<'single' | 'batch'>('single');
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [expenseScope, setExpenseScope] = useState<'BUSINESS' | 'PERSONAL'>('BUSINESS');
  const [selectedEqubId, setSelectedEqubId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedRecurringId, setSelectedRecurringId] = useState<string | null>(null);

  // Equb Registration Form inside Quick Entry
  const [showRegisterEqub, setShowRegisterEqub] = useState(false);
  const [newEqubName, setNewEqubName] = useState('');
  const [newEqubContribution, setNewEqubContribution] = useState('');
  const [newEqubInterval, setNewEqubInterval] = useState<'EVERY_10_DAYS' | 'WEEKLY' | 'EVERY_15_DAYS' | 'MONTHLY'>('EVERY_10_DAYS');
  const [newEqubTotalRounds, setNewEqubTotalRounds] = useState('27');
  const [newEqubSlots, setNewEqubSlots] = useState('1');
  const [newEqubWalletId, setNewEqubWalletId] = useState(defaultWalletId || wallets[0]?.id || '');
  const [newEqubAdvanceMonths, setNewEqubAdvanceMonths] = useState<number>(0);
  const [newEqubCustomMonths, setNewEqubCustomMonths] = useState('');
  const [newEqubRecordPayment, setNewEqubRecordPayment] = useState(true);

  // Advance months selection for existing selected Equb
  const [advanceMonthsForSelected, setAdvanceMonthsForSelected] = useState<number>(0);

  // Single mode state
  const [amountStr, setAmountStr] = useState('');
  const [walletId, setWalletId] = useState(defaultWalletId || wallets[0]?.id || '');
  const [category, setCategory] = useState(categories.find(c => c.type === 'INCOME')?.name || 'Daily Income');
  const [description, setDescription] = useState('');

  // Handle incoming PWA Share Target / SMS prefill
  useEffect(() => {
    if (prefilledText && isOpen) {
      setDescription(prefilledText);
      const match = prefilledText.match(/(?:ETB|credited with|received|amount:?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
                    prefilledText.match(/([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:ETB|birr)/i);
      if (match && match[1]) {
        const cleaned = match[1].replace(/,/g, '');
        if (Number(cleaned) > 0) {
          setAmountStr(cleaned);
        }
      }
      if (prefilledText.toLowerCase().includes('telebirr')) {
        const tb = wallets.find(w => w.type === 'TELEBIRR' || w.name.toLowerCase().includes('telebirr'));
        if (tb) setWalletId(tb.id);
      } else if (prefilledText.toLowerCase().includes('cbe') || prefilledText.toLowerCase().includes('commercial bank')) {
        const cbe = wallets.find(w => w.type === 'CBE_BANK' || w.name.toLowerCase().includes('cbe'));
        if (cbe) setWalletId(cbe.id);
      }
    }
  }, [prefilledText, isOpen, wallets]);

  // Active Equbs list & detection
  const activeEqubs = (equbs || []).filter(e => e.status === 'ACTIVE');
  const isEqubContribution = entryMode === 'EXPENSE' && (
    category === 'Equb Contribution' ||
    category.toLowerCase().includes('equb') ||
    category.toLowerCase().includes('ekub')
  );
  const selectedEqub = activeEqubs.find(e => e.id === selectedEqubId);

  const handleSelectEqub = (eq: Equb) => {
    triggerHaptic('medium');
    setSelectedEqubId(eq.id);
    setSelectedLoanId(null);
    setCategory('Equb Contribution');
    const roundDue = eq.contributionPerRound * (eq.mySlots || 1);
    setAmountStr(roundDue.toString());
    if (eq.walletId && wallets.some(w => w.id === eq.walletId && isWalletActive(w))) {
      setWalletId(eq.walletId);
    }
    setAdvanceMonthsForSelected(0);
    setDescription(`${eq.name} — Round #${eq.currentRound} contribution`);
  };

  const getRoundsPerMonth = (interval: string): number => {
    switch (interval) {
      case 'EVERY_10_DAYS': return 3;
      case 'WEEKLY': return 4;
      case 'EVERY_15_DAYS': return 2;
      case 'MONTHLY': return 1;
      case 'DAILY': return 30;
      default: return 3;
    }
  };

  const effectiveAdvanceMonths = newEqubAdvanceMonths === -1
    ? (parseFloat(newEqubCustomMonths) || 0)
    : newEqubAdvanceMonths;
  const newEqubTotalRoundsNum = Math.max(1, parseInt(newEqubTotalRounds, 10) || 12);
  const newEqubSlotsNum = Math.max(1, parseInt(newEqubSlots, 10) || 1);
  const newEqubContribNum = parseFloat(newEqubContribution) || 0;
  const newEqubRoundsPerMo = getRoundsPerMonth(newEqubInterval);
  const newEqubPrepaidRounds = effectiveAdvanceMonths > 0
    ? Math.min(newEqubTotalRoundsNum, Math.round(effectiveAdvanceMonths * newEqubRoundsPerMo))
    : 0;
  const newEqubAdvanceTotal = newEqubPrepaidRounds * newEqubContribNum * newEqubSlotsNum;
  const newEqubStartingRound = Math.min(newEqubTotalRoundsNum, newEqubPrepaidRounds + 1);

  const handleRegisterEqubSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newEqubName.trim() || !newEqubContribution || newEqubContribNum <= 0) return;
    triggerHaptic('success');

    if (onCreateEqub) {
      const created = onCreateEqub({
        name: newEqubName.trim(),
        contributionPerRound: newEqubContribNum,
        interval: newEqubInterval,
        totalRounds: newEqubTotalRoundsNum,
        mySlots: newEqubSlotsNum,
        walletId: newEqubWalletId || walletId,
        startDate: new Date().toISOString(),
        advanceMonthsPrepaid: effectiveAdvanceMonths > 0 ? effectiveAdvanceMonths : undefined,
        initialCompletedRounds: newEqubPrepaidRounds,
        recordAdvanceTransaction: newEqubRecordPayment && newEqubPrepaidRounds > 0,
        advancePaymentWalletId: newEqubWalletId || walletId,
        members: []
      });

      if (created && (created as Equb).id) {
        setSelectedEqubId((created as Equb).id);
        const roundCost = (created as Equb).contributionPerRound * ((created as Equb).mySlots || 1);
        setAmountStr(roundCost.toString());
        setCategory('Equb Contribution');
        setDescription(`${(created as Equb).name} Round #${(created as Equb).currentRound} contribution`);
      }
    }

    setShowRegisterEqub(false);
    setNewEqubName('');
    setNewEqubContribution('');
    setNewEqubAdvanceMonths(0);
    setNewEqubCustomMonths('');
  };

  const handleApplyAdvanceForSelectedEqub = (months: number) => {
    triggerHaptic('light');
    if (!selectedEqub) return;
    setAdvanceMonthsForSelected(months);

    const singleRoundDue = selectedEqub.contributionPerRound * (selectedEqub.mySlots || 1);
    const roundsPerMo = getRoundsPerMonth(selectedEqub.interval);
    const completed = typeof selectedEqub.completedRounds === 'number'
      ? selectedEqub.completedRounds
      : Math.max(0, selectedEqub.currentRound - 1);
    const roundsRemaining = Math.max(1, selectedEqub.totalRounds - completed);

    if (months === 0) {
      // 1 single round
      setAmountStr(singleRoundDue.toString());
      setDescription(`${selectedEqub.name} Round #${selectedEqub.currentRound} contribution`);
    } else {
      const roundsToPay = Math.min(roundsRemaining, Math.max(1, Math.round(months * roundsPerMo)));
      const totalAdvance = roundsToPay * singleRoundDue;
      setAmountStr(totalAdvance.toString());
      setDescription(`${selectedEqub.name} advance contribution for ${months} month${months > 1 ? 's' : ''} (${roundsToPay} rounds prepaid)`);
    }
  };

  // Active Loans list & detection
  const activeLoans = (loans || []).filter(l => l.status === 'ACTIVE' && l.outstandingBalance > 0);
  const isLoanPayment = category === 'Loan Payment' || category.toLowerCase().includes('loan');
  const selectedLoan = activeLoans.find(l => l.id === selectedLoanId);

  const handleSelectLoan = (loan: Loan) => {
    triggerHaptic('medium');
    setSelectedLoanId(loan.id);
    setSelectedEqubId(null);
    setCategory('Loan Payment');
    const isLent = loan.direction === 'LENT';
    setEntryMode(isLent ? 'INCOME' : 'EXPENSE');
    const targetAmt = loan.monthlyInstallment || Math.min(1000, loan.outstandingBalance);
    setAmountStr(targetAmt.toString());
    if (loan.walletId && wallets.some(w => w.id === loan.walletId && isWalletActive(w))) {
      setWalletId(loan.walletId);
    }
    setDescription(
      isLent
        ? `Collected loan repayment from ${loan.counterparty} (${loan.title})`
        : `Paid loan installment to ${loan.counterparty} (${loan.title})`
    );
  };

  // Active Recurring Templates list & detection
  const activeRecurring = (recurring || []).filter(r => r.status === 'ACTIVE' && r.type === entryMode);
  const isRecurringPayment = entryMode === 'EXPENSE' && (
    selectedRecurringId !== null ||
    category === 'Rent & Lease' ||
    category === 'Rent' ||
    category === 'Utilities & Internet' ||
    category.toLowerCase().includes('rent') ||
    category.toLowerCase().includes('utilit')
  );
  const selectedRecurring = (recurring || []).find(r => r.id === selectedRecurringId);

  const handleSelectRecurring = (rec: RecurringTemplate) => {
    triggerHaptic('medium');
    setSelectedRecurringId(rec.id);
    setSelectedEqubId(null);
    setSelectedLoanId(null);
    setCategory(rec.category || 'Rent & Lease');
    setExpenseScope('BUSINESS');
    setAmountStr(rec.amount.toString());
    if (rec.walletId && wallets.some(w => w.id === rec.walletId && isWalletActive(w))) {
      setWalletId(rec.walletId);
    }
    setDescription(`${rec.title} payment`);
  };

  // Date helper functions
  const isSuperAdmin = currentUser.role === 'SuperAdmin';
  const isAdminOrSuperAdmin = currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin';
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getMinDateStr = () => {
    const d = new Date();
    if (isAdminOrSuperAdmin) {
      // SuperAdmin & Admin can select dates going back to the start of previous month
      const firstDayPrevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      return firstDayPrevMonth.toISOString().split('T')[0];
    }
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  };
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };
  const getLastMonthEndStr = () => {
    const d = new Date();
    const prevMonthEnd = new Date(d.getFullYear(), d.getMonth(), 0);
    return prevMonthEnd.toISOString().split('T')[0];
  };

  const [postingDate, setPostingDate] = useState<string>(getTodayStr());

  // Credit Sale fields
  const [customerName, setCustomerName] = useState('');
  const [creditDaysOption, setCreditDaysOption] = useState<7 | 14 | 30 | 60>(14);

  // Multi-wallet batch state
  const [batchAmounts, setBatchAmounts] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setAmountStr('');
    setBatchAmounts({});
    setDescription('');
    setCustomerName('');
    setIsCreditSale(false);
    setExpenseScope('BUSINESS');
    setSelectedEqubId(null);
    setSelectedLoanId(null);
    setSelectedRecurringId(null);
    setValidationError(null);
    setPostingDate(getTodayStr());
    const defaultCat = categories.find(c => c.type === entryMode && c.active);
    if (defaultCat) setCategory(defaultCat.name);
  };

  // Reset all input fields whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      if (defaultWalletId && wallets.some(w => w.id === defaultWalletId)) {
        setWalletId(defaultWalletId);
      } else if (wallets.length > 0) {
        setWalletId(wallets[0].id);
      }
    }
  }, [isOpen, defaultWalletId]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const currentType: TransactionType = entryMode;

  const handleModeSwitch = (mode: 'INCOME' | 'EXPENSE') => {
    triggerHaptic('light');
    setValidationError(null);
    setEntryMode(mode);
    setIsCreditSale(false);
    setSelectedEqubId(null);
    setExpenseScope('BUSINESS');
    const targetCat = categories.find(c => c.type === mode && c.active);
    if (targetCat) setCategory(targetCat.name);
  };

  const handleBatchAmountChange = (wId: string, val: string) => {
    setValidationError(null);
    setBatchAmounts(prev => ({
      ...prev,
      [wId]: val
    }));
  };

  // Calculate batch totals using smart parseSummedAmount
  const batchEntries: Array<{ walletId: string; amount: number; count: number }> = Object.keys(batchAmounts)
    .map((wId) => {
      const parsed = parseSummedAmount(batchAmounts[wId] || '');
      return { walletId: wId, amount: parsed.total, count: parsed.count };
    })
    .filter(item => item.amount > 0);

  const totalBatchAmount = batchEntries.reduce((sum, item) => sum + item.amount, 0);

  // Live parsed single amount for auto-sum expression
  const parsedSingle = parseSummedAmount(amountStr);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const txDate = new Date(`${postingDate}T12:00:00.000Z`).toISOString();

    // Handling Batch Multi-Wallet Income / Expense Submission
    if (batchMode === 'batch') {
      if (batchEntries.length === 0) {
        triggerHaptic('heavy');
        setValidationError(`Please enter ${entryMode === 'INCOME' ? 'an income' : 'an expense'} amount for at least one wallet.`);
        return;
      }

      // Check each batch entry against balance & wallet rules
      for (const entry of batchEntries) {
        const targetW = wallets.find(w => w.id === entry.walletId);
        if (!targetW || !isWalletActive(targetW)) {
          triggerHaptic('heavy');
          setValidationError(`Cannot post to inactive/archived wallet "${targetW?.name || entry.walletId}". Wallet must be active.`);
          return;
        }

        if (entryMode === 'EXPENSE') {
          const valRes = validateTransactionPosting(targetW, 'EXPENSE', entry.amount, transactions, transfers);
          if (!valRes.valid) {
            triggerHaptic('heavy');
            setValidationError(valRes.error || `Insufficient balance in ${targetW.name}`);
            return;
          }
        }
      }

      // Loan validation for batch mode
      if (isLoanPayment && selectedLoan) {
        if (selectedLoan.outstandingBalance >= 1000 && totalBatchAmount < 1000) {
          triggerHaptic('heavy');
          setValidationError('Total split repayment cannot be less than ETB 1,000 (1k).');
          return;
        }
        if (selectedLoan.outstandingBalance < 1000 && totalBatchAmount < selectedLoan.outstandingBalance) {
          triggerHaptic('heavy');
          setValidationError(`Total split repayment must be at least ETB ${selectedLoan.outstandingBalance.toLocaleString()} to settle the loan.`);
          return;
        }
        if (totalBatchAmount > selectedLoan.outstandingBalance) {
          triggerHaptic('heavy');
          setValidationError(`Total split repayment cannot exceed outstanding balance of ETB ${selectedLoan.outstandingBalance.toLocaleString()}.`);
          return;
        }
      }

      triggerHaptic('success');

      if (batchEntries.length > 1) {
        const splitSummary = batchEntries.map(e => {
          const targetW = wallets.find(w => w.id === e.walletId);
          return `${getWalletNickname(targetW?.name)}: ${formatETB(e.amount)}`;
        }).join(', ');

        const defaultDesc = isEqubContribution && selectedEqub
          ? `${selectedEqub.name} Round #${selectedEqub.currentRound} payment (Split: ${splitSummary})`
          : isLoanPayment && selectedLoan
          ? `${selectedLoan.title} Repayment (Split: ${splitSummary})`
          : `Split ${entryMode === 'INCOME' ? 'Income' : 'Payment'} (Split: ${splitSummary})`;

        const finalDesc = description
          ? `${description.trim()} (Split: ${splitSummary})`
          : defaultDesc;

        onSubmitTransaction({
          type: entryMode as TransactionType,
          amount: totalBatchAmount,
          walletId: batchEntries[0].walletId,
          category: category || (entryMode === 'INCOME' ? 'Daily Income' : (isEqubContribution ? 'Equb Contribution' : isLoanPayment ? 'Loan Payment' : 'Daily Expense')),
          description: finalDesc,
          date: txDate,
          expenseScope: entryMode === 'EXPENSE' ? expenseScope : undefined,
          refType: isEqubContribution && selectedEqubId ? ('EQUB' as const) : isLoanPayment && selectedLoanId ? ('LOAN' as const) : selectedRecurringId ? ('RECURRING' as const) : undefined,
          refId: isEqubContribution && selectedEqubId ? selectedEqubId : isLoanPayment && selectedLoanId ? selectedLoanId : selectedRecurringId || undefined,
          splits: batchEntries.map(e => ({ walletId: e.walletId, amount: e.amount }))
        });
      } else if (batchEntries.length === 1) {
        const singleEntry = batchEntries[0];
        const targetW = wallets.find(w => w.id === singleEntry.walletId);
        onSubmitTransaction({
          type: entryMode as TransactionType,
          amount: singleEntry.amount,
          walletId: singleEntry.walletId,
          category: category || (entryMode === 'INCOME' ? 'Daily Income' : (isEqubContribution ? 'Equb Contribution' : isLoanPayment ? 'Loan Payment' : 'Daily Expense')),
          description: description || (entryMode === 'INCOME' ? 'Daily Income' : `Payment - ${targetW?.name || 'Wallet'}`),
          date: txDate,
          expenseScope: entryMode === 'EXPENSE' ? expenseScope : undefined,
          refType: isEqubContribution && selectedEqubId ? ('EQUB' as const) : isLoanPayment && selectedLoanId ? ('LOAN' as const) : selectedRecurringId ? ('RECURRING' as const) : undefined,
          refId: isEqubContribution && selectedEqubId ? selectedEqubId : isLoanPayment && selectedLoanId ? selectedLoanId : selectedRecurringId || undefined
        });
      }

      resetForm();
      onClose();
      return;
    }

    // Single Entry Submission using parseSummedAmount
    const parsedAmount = parsedSingle.total;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      triggerHaptic('heavy');
      setValidationError('Please enter a valid amount greater than ETB 0 (e.g. 90 or 40,50).');
      return;
    }

    // Loan validation for single entry mode
    if (isLoanPayment && selectedLoan) {
      if (selectedLoan.outstandingBalance >= 1000 && parsedAmount < 1000) {
        triggerHaptic('heavy');
        setValidationError('Loan repayment cannot be less than ETB 1,000 (1k).');
        return;
      }
      if (selectedLoan.outstandingBalance < 1000 && parsedAmount < selectedLoan.outstandingBalance) {
        triggerHaptic('heavy');
        setValidationError(`Repayment must be at least ETB ${selectedLoan.outstandingBalance.toLocaleString()} to settle the loan.`);
        return;
      }
      if (parsedAmount > selectedLoan.outstandingBalance) {
        triggerHaptic('heavy');
        setValidationError(`Repayment cannot exceed outstanding balance of ETB ${selectedLoan.outstandingBalance.toLocaleString()}.`);
        return;
      }
    }

    const targetWallet = wallets.find(w => w.id === walletId);
    const postValidation = validateTransactionPosting(
      targetWallet,
      currentType,
      parsedAmount,
      transactions,
      transfers
    );

    if (!postValidation.valid) {
      triggerHaptic('heavy');
      setValidationError(postValidation.error || 'Transaction posting validation failed.');
      return;
    }

    if (entryMode === 'INCOME' && isCreditSale && !customerName.trim()) {
      triggerHaptic('heavy');
      setValidationError('Please enter the customer / buyer name for this credit sale.');
      return;
    }

    triggerHaptic('success');

    const calculatedDueDate = new Date(Date.now() + 86400000 * creditDaysOption).toISOString();
    const activeCreditSale = entryMode === 'INCOME' && isCreditSale;

    onSubmitTransaction({
      type: currentType,
      amount: parsedAmount,
      walletId,
      category,
      description: description || (activeCreditSale ? `Credit Sale to ${customerName}` : (entryMode === 'INCOME' ? 'Daily Income' : `${category} record`)),
      date: txDate,
      isCreditSale: activeCreditSale,
      customerName: activeCreditSale ? customerName.trim() : undefined,
      dueDate: activeCreditSale ? calculatedDueDate : undefined,
      expenseScope: currentType === 'EXPENSE' ? expenseScope : undefined,
      refType: isEqubContribution && selectedEqubId ? 'EQUB' : isLoanPayment && selectedLoanId ? 'LOAN' : selectedRecurringId ? 'RECURRING' : undefined,
      refId: isEqubContribution && selectedEqubId ? selectedEqubId : isLoanPayment && selectedLoanId ? selectedLoanId : selectedRecurringId || undefined
    });

    resetForm();
    onClose();
  };

  const filteredCategories = categories.filter(c => c.type === currentType && c.active);

  const sampleCustomers = [
    'Solomon Retailers',
    'Abebe Exporters',
    'Keba Trading PLC',
    'Tigist Pharmacy',
    'Bole Mart'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E2D40] w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-5 text-slate-900 dark:text-[#F0F4FF] max-h-[92vh] overflow-y-auto shadow-2xl space-y-4 animate-slideUp relative">
        
        {/* Dynamic Glow Header Accent Line */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 rounded-full opacity-80 transition-all ${
            batchMode === 'batch'
              ? entryMode === 'INCOME'
                ? 'bg-gradient-to-r from-transparent via-[#A78BFA] to-transparent'
                : 'bg-gradient-to-r from-transparent via-rose-500 to-transparent'
              : isCreditSale && entryMode === 'INCOME'
              ? 'bg-gradient-to-r from-transparent via-[#3B82F6] to-transparent'
              : entryMode === 'INCOME'
              ? 'bg-gradient-to-r from-transparent via-emerald-500 dark:via-[#00D4AA] to-transparent'
              : 'bg-gradient-to-r from-transparent via-[#EF4444] to-transparent'
          }`}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1E2D40]">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-lg transition-colors ${
              batchMode === 'batch'
                ? entryMode === 'INCOME'
                  ? 'bg-purple-500/10 dark:bg-[#A78BFA]/20 text-purple-600 dark:text-[#A78BFA] border border-purple-300 dark:border-[#A78BFA]/40 shadow-purple-500/10'
                  : 'bg-rose-500/10 dark:bg-red-500/20 text-rose-600 dark:text-red-400 border border-rose-300 dark:border-red-500/40 shadow-rose-500/10'
                : isCreditSale && entryMode === 'INCOME'
                ? 'bg-blue-500/10 dark:bg-[#3B82F6]/20 text-blue-600 dark:text-[#3B82F6] border border-blue-300 dark:border-[#3B82F6]/40 shadow-blue-500/10'
                : entryMode === 'INCOME'
                ? 'bg-emerald-500/10 dark:bg-[#00D4AA]/20 text-emerald-600 dark:text-[#00D4AA] border border-emerald-300 dark:border-[#00D4AA]/40 shadow-emerald-500/10'
                : 'bg-rose-500/10 dark:bg-red-500/20 text-rose-600 dark:text-red-400 border border-rose-300 dark:border-red-500/40 shadow-red-500/10'
            }`}>
              {batchMode === 'batch' ? <Layers className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>{batchMode === 'batch' ? 'Split Payment' : 'Quick Transaction'}</span>
                <span className="text-[10px] bg-slate-100 dark:bg-[#1E2D40] text-slate-600 dark:text-[#8899BB] px-2 py-0.5 rounded-full font-mono font-semibold uppercase">
                  {batchMode === 'batch' ? 'SPLIT PAYMENT' : 'DIRECT ENTRY'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8899BB]">
                {batchMode === 'batch'
                  ? `Split payment across Telebirr, CBE Birr, Cash & Banks`
                  : 'Log single income, expense, or customer credit sales'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              handleClose();
            }}
            className="p-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#1E2D40] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Validation Error Alert */}
          {validationError && (
            <div className="p-3 bg-rose-50 text-rose-800 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/60 dark:text-rose-100 rounded-xl text-xs flex items-start gap-2 animate-shake">
              <span className="font-bold">⚠️</span>
              <div>
                <p className="font-bold text-rose-900 dark:text-rose-100">Transaction Blocked</p>
                <p className="text-[11px] mt-0.5 text-rose-800 dark:text-rose-200">{validationError}</p>
              </div>
            </div>
          )}

          {/* Primary Mode Switcher: Income vs Expense */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-[#131926] p-1.5 rounded-2xl border border-slate-200 dark:border-[#1E2D40]">
            <button
              type="button"
              onClick={() => handleModeSwitch('INCOME')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                entryMode === 'INCOME'
                  ? 'bg-emerald-600 dark:bg-[#00D4AA] text-white dark:text-[#0A0E1A] shadow-md shadow-emerald-500/20'
                  : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Income (+ ETB)</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeSwitch('EXPENSE')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                entryMode === 'EXPENSE'
                  ? 'bg-rose-600 dark:bg-[#EF4444] text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              <span>Expense (- ETB)</span>
            </button>
          </div>

          {/* Expense Classification: Business vs Personal Expense */}
          {entryMode === 'EXPENSE' && (
            <div className="p-3.5 rounded-2xl border bg-slate-50/80 dark:bg-[#131926] border-slate-200 dark:border-[#1E2D40] space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    expenseScope === 'PERSONAL'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                  }`}>
                    {expenseScope === 'PERSONAL' ? <User className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Expense Classification</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                        expenseScope === 'PERSONAL'
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                          : 'bg-indigo-500/20 text-indigo-800 dark:text-indigo-300'
                      }`}>
                        {expenseScope === 'PERSONAL' ? 'Personal' : 'Business'}
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">
                      {expenseScope === 'PERSONAL'
                        ? 'Personal withdrawals, home expenses & private spending'
                        : 'Official business operations, rent, utilities & equipment'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setExpenseScope('BUSINESS');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    expenseScope === 'BUSINESS'
                      ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 shadow-sm'
                      : 'bg-white dark:bg-[#0A0E1A] border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Business Expense</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setExpenseScope('PERSONAL');
                    const personalCat = categories.find(c => c.type === 'EXPENSE' && (c.name.toLowerCase().includes('withdrawal') || c.name.toLowerCase().includes('home') || c.name.toLowerCase().includes('food')));
                    if (personalCat) setCategory(personalCat.name);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    expenseScope === 'PERSONAL'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-white dark:bg-[#0A0E1A] border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Personal Expense</span>
                </button>
              </div>
            </div>
          )}

          {/* Sub-Type Switcher: Single Entry vs Split Payment (Multi-Wallet) */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#0A0E1A] p-1 rounded-xl border border-slate-200 dark:border-[#1E2D40]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setBatchMode('single');
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  batchMode === 'single'
                    ? 'bg-white dark:bg-[#1C2333] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-[#334155]'
                    : 'text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Single Account Entry
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setBatchMode('batch');
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  batchMode === 'batch'
                    ? entryMode === 'INCOME'
                      ? 'bg-purple-600 dark:bg-[#A78BFA] text-white dark:text-[#0A0E1A] shadow-md font-black'
                      : 'bg-rose-600 dark:bg-[#EF4444] text-white shadow-md font-black'
                    : entryMode === 'INCOME'
                    ? 'text-purple-600 dark:text-[#A78BFA] hover:text-purple-700'
                    : 'text-rose-600 dark:text-[#EF4444] hover:text-rose-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Split Payment</span>
              </button>
            </div>

            {/* Single Income: Sale on Credit Toggle */}
            {entryMode === 'INCOME' && batchMode === 'single' && (
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  isCreditSale
                    ? 'bg-blue-50 dark:bg-[#3B82F6]/10 border-blue-300 dark:border-[#3B82F6]/50 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-50 dark:bg-[#131926] border-slate-200 dark:border-[#1E2D40]'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isCreditSale ? 'bg-blue-600 dark:bg-[#3B82F6] text-white' : 'bg-slate-200 dark:bg-[#1C2333] text-slate-600 dark:text-[#8899BB]'
                      }`}>
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>Sale on Credit (Customer Debt)</span>
                          {isCreditSale && (
                            <span className="text-[9px] bg-blue-600 dark:bg-[#3B82F6] text-white px-1.5 py-0.2 rounded font-mono font-bold">
                              ACTIVE
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">
                          Customer buys now and pays later (logged to Receivables)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('medium');
                        const nextVal = !isCreditSale;
                        setIsCreditSale(nextVal);
                        if (nextVal) {
                          const salesCat = categories.find(c => c.type === 'INCOME' && c.name.toLowerCase().includes('sale'));
                          if (salesCat) setCategory(salesCat.name);
                        }
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                        isCreditSale ? 'bg-blue-600 dark:bg-[#3B82F6]' : 'bg-slate-300 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40]'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform transform ${
                        isCreditSale ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* Credit Sale Customer Details */}
                  {isCreditSale && (
                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-[#3B82F6]/30 space-y-3 animate-fadeIn">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] block mb-1">
                          Customer / Buyer Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={isCreditSale}
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          placeholder="Customer name"
                          className="w-full bg-white dark:bg-[#0A0E1A] border border-blue-300 dark:border-[#3B82F6]/50 focus:border-blue-500 dark:focus:border-[#3B82F6] rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white outline-none"
                        />

                        <div className="flex items-center gap-1 mt-1.5 overflow-x-auto no-scrollbar pb-0.5">
                          <span className="text-[10px] text-slate-500 dark:text-[#8899BB] shrink-0">Recent:</span>
                          {sampleCustomers.map((cName) => (
                            <button
                              key={cName}
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setCustomerName(cName);
                              }}
                              className="text-[10px] bg-slate-100 dark:bg-[#1C2333] hover:bg-blue-50 dark:hover:bg-[#3B82F6]/20 hover:text-blue-600 text-slate-600 dark:text-[#8899BB] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-[#1E2D40] shrink-0 cursor-pointer transition-colors"
                            >
                              + {cName}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] block mb-1">
                          Repayment Due Term
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { days: 7, label: '+7 Days' },
                            { days: 14, label: '+14 Days' },
                            { days: 30, label: '+30 Days' },
                            { days: 60, label: '+60 Days' }
                          ].map((opt) => (
                            <button
                              key={opt.days}
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setCreditDaysOption(opt.days as any);
                              }}
                              className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                creditDaysOption === opt.days
                                  ? 'bg-blue-600 dark:bg-[#3B82F6] border-blue-600 dark:border-[#3B82F6] text-white shadow-md'
                                  : 'bg-white dark:bg-[#0A0E1A] border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* MULTI-WALLET SPLIT PAYMENT MODE BODY */}
          {batchMode === 'batch' ? (
            <div className="space-y-4 animate-fadeIn">
              
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                entryMode === 'INCOME'
                  ? 'bg-purple-50 dark:bg-[#A78BFA]/10 border-purple-200 dark:border-[#A78BFA]/30'
                  : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/30'
              }`}>
                <div>
                  <h4 className={`text-xs font-bold flex items-center gap-1.5 ${
                    entryMode === 'INCOME' ? 'text-purple-900 dark:text-white' : 'text-rose-900 dark:text-white'
                  }`}>
                    <Sparkles className={`w-4 h-4 ${entryMode === 'INCOME' ? 'text-purple-600 dark:text-[#A78BFA]' : 'text-rose-600 dark:text-rose-400'}`} />
                    <span>{entryMode === 'INCOME' ? 'Split Income Across Accounts' : 'Split Payment Across Accounts'}</span>
                  </h4>
                  <p className={`text-[11px] mt-0.5 ${
                    entryMode === 'INCOME' ? 'text-purple-700 dark:text-[#8899BB]' : 'text-rose-700 dark:text-[#8899BB]'
                  }`}>
                    {entryMode === 'INCOME'
                      ? 'Enter the amount received in each wallet'
                      : 'Enter the amount paid out from each wallet'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setBatchAmounts({});
                  }}
                  className={`text-[10px] underline cursor-pointer ${
                    entryMode === 'INCOME' ? 'text-purple-600 dark:text-[#8899BB]' : 'text-rose-600 dark:text-[#8899BB]'
                  }`}
                >
                  Clear All
                </button>
              </div>

              {/* Wallet Amount Rows List */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {wallets.map((w) => {
                  const val = batchAmounts[w.id] || '';
                  const liveBalance = calculateWalletBalance(w, transactions, transfers);
                  const active = isWalletActive(w);
                  const creditOk = isOverdraftAllowed(w);
                  return (
                    <div
                      key={w.id}
                      className={`bg-slate-50 dark:bg-[#131926] border rounded-2xl p-3 transition-colors space-y-2 ${
                        !active
                          ? 'opacity-60 border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-[#0B0F19]'
                          : entryMode === 'INCOME'
                          ? 'border-slate-200 dark:border-[#1E2D40] hover:border-purple-300 dark:hover:border-[#A78BFA]/50'
                          : 'border-slate-200 dark:border-[#1E2D40] hover:border-rose-300 dark:hover:border-rose-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: w.color }}
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{getWalletNickname(w.name)}</span>
                          <span className="text-[9px] bg-slate-200 dark:bg-[#1E2D40] text-slate-600 dark:text-[#8899BB] px-1.5 py-0.2 rounded font-mono">
                            {w.type}
                          </span>
                          {!active && (
                            <span className="text-[9px] bg-rose-500/10 text-rose-600 font-bold px-1.5 py-0.2 rounded border border-rose-500/20">
                              {w.status || 'INACTIVE'}
                            </span>
                          )}
                          {creditOk && active && (
                            <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.2 rounded border border-blue-500/20">
                              Overdraft OK
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] font-mono font-bold ${liveBalance < 0 ? 'text-rose-500' : 'text-slate-500 dark:text-[#8899BB]'}`}>
                          Bal: {formatETB(liveBalance)}
                        </span>
                      </div>

                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold ${
                            entryMode === 'INCOME' ? 'text-purple-600 dark:text-[#A78BFA]' : 'text-rose-600 dark:text-rose-400'
                          }`}>ETB</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={!active}
                            value={val}
                            onChange={(e) => handleBatchAmountChange(w.id, e.target.value)}
                            placeholder={active ? '0.00' : 'Wallet inactive'}
                            className={`w-full bg-white dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] rounded-xl py-2 px-3 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none disabled:bg-slate-200 dark:disabled:bg-slate-900 disabled:cursor-not-allowed ${
                              entryMode === 'INCOME' ? 'focus:border-purple-500 dark:focus:border-[#A78BFA]' : 'focus:border-rose-500 dark:focus:border-rose-400'
                            }`}
                          />
                        </div>

                        {/* Batch Row Sum Badge if user enters multiple values (e.g. 40,50) */}
                        {(() => {
                          const parsedRow = parseSummedAmount(val);
                          if (parsedRow.count > 1) {
                            return (
                              <div className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg flex items-center justify-between border ${
                                entryMode === 'INCOME'
                                  ? 'text-purple-700 dark:text-[#A78BFA] bg-purple-50 dark:bg-[#A78BFA]/15 border-purple-200 dark:border-[#A78BFA]/30'
                                  : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30'
                              }`}>
                                <span>Sum ({parsedRow.count} items): {parsedRow.formattedExpression}</span>
                                <span className="font-black text-slate-900 dark:text-white">= {formatETB(parsedRow.total)}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Summary Banner */}
              <div className="bg-slate-900 dark:bg-[#0A0E1A] border border-purple-500/40 rounded-2xl p-3.5 flex items-center justify-between text-white">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-[#8899BB] uppercase tracking-wider block">
                    Combined Split {entryMode === 'INCOME' ? 'Income' : 'Payment'} Total
                  </span>
                  <span className={`text-xs font-medium ${
                    entryMode === 'INCOME' ? 'text-purple-300 dark:text-[#A78BFA]' : 'text-rose-300 dark:text-rose-400'
                  }`}>
                    {batchEntries.length} {batchEntries.length === 1 ? 'account' : 'accounts'} {entryMode === 'INCOME' ? 'receiving funds' : 'paying split'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-mono font-black text-white">
                    {formatETB(totalBatchAmount)}
                  </span>
                </div>
              </div>

            </div>
          ) : (
            /* SINGLE AMOUNT INPUT HERO CARD */
            <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
              isCreditSale && entryMode === 'INCOME'
                ? 'bg-blue-50/50 dark:bg-[#3B82F6]/5 border-blue-200 dark:border-[#3B82F6]/30'
                : entryMode === 'INCOME'
                ? 'bg-emerald-50/50 dark:bg-[#00D4AA]/5 border-emerald-200 dark:border-[#00D4AA]/30'
                : 'bg-rose-50/50 dark:bg-red-500/5 border-rose-200 dark:border-red-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600 dark:text-[#00D4AA]" />
                  <span>Transaction Amount</span>
                  <span className="text-[10px] text-emerald-700 dark:text-[#00D4AA] font-normal font-mono bg-emerald-500/10 dark:bg-[#00D4AA]/15 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Type 40,50 or 40+50
                  </span>
                </label>
                <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-[#8899BB]">
                  Currency: <span className="text-slate-900 dark:text-white">ETB</span>
                </span>
              </div>

              <div className="relative flex items-center">
                <span className={`text-2xl font-mono font-bold mr-2 ${
                  isCreditSale && entryMode === 'INCOME' ? 'text-blue-600 dark:text-[#3B82F6]' : entryMode === 'INCOME' ? 'text-emerald-600 dark:text-[#00D4AA]' : 'text-rose-600 dark:text-red-400'
                }`}>
                  ETB
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  required={batchMode === 'single'}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent text-3xl font-mono font-black text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-[#334155] no-scrollbar overflow-hidden resize-none"
                />
              </div>

              {/* Multi-Amount Sum Calculator Pill */}
              {parsedSingle.count > 1 && (
                <div className="p-2.5 bg-white dark:bg-[#0A0E1A] border border-emerald-400/40 dark:border-[#00D4AA]/40 rounded-xl flex items-center justify-between shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-[#00D4AA] flex items-center justify-center font-bold text-xs shrink-0">
                      <Calculator className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-[#8899BB] block">
                        Auto Calculated Sum ({parsedSingle.count} items)
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        {parsedSingle.formattedExpression}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-slate-400 block font-mono">TOTAL REGISTERED</span>
                    <span className="text-base font-mono font-black text-emerald-600 dark:text-[#00D4AA]">
                      {formatETB(parsedSingle.total)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wallet Selection Grid for Single Entry Mode (Hidden for Credit Sales/IOUs) */}
          {batchMode === 'single' && !isCreditSale && (
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5">
                  <WalletIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00D4AA]" />
                  <span>Source / Destination Wallet</span>
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {wallets.map((w) => {
                  const isSelected = walletId === w.id;
                  const liveBalance = calculateWalletBalance(w, transactions, transfers);
                  const active = isWalletActive(w);
                  const creditOk = isOverdraftAllowed(w);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      disabled={!active}
                      onClick={() => {
                        triggerHaptic('light');
                        setWalletId(w.id);
                      }}
                      style={{
                        borderColor: isSelected ? w.color : undefined,
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        !active
                          ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          : isSelected
                          ? 'bg-slate-100 dark:bg-slate-800/50 cursor-pointer hover:scale-[1.01] ring-1 ring-blue-500/50'
                          : 'bg-slate-50 dark:bg-[#131926] border-slate-200 dark:border-[#1E2D40] cursor-pointer hover:scale-[1.01]'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {getWalletNickname(w.name)}
                          </p>
                          {!active && (
                            <span className="text-[8px] bg-rose-500/10 text-rose-600 font-bold px-1 rounded">
                              OFF
                            </span>
                          )}
                          {creditOk && active && (
                            <span className="text-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-1 rounded">
                              CR
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] font-mono font-bold mt-0.5 ${liveBalance < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-[#00D4AA]'}`}>
                          Bal: {formatETB(liveBalance)}
                        </p>
                      </div>
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: w.color }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Informational notice when Sale on Credit / IOU is active */}
          {batchMode === 'single' && isCreditSale && entryMode === 'INCOME' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
              <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Customer Credit IOU (Receivables Entry)</p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300/90 leading-relaxed">
                  This credit IOU will be recorded in <strong>Receivables</strong> for <strong>{customerName || 'the customer'}</strong>.
                </p>
                <p className="text-[11px] text-blue-800 dark:text-blue-200 bg-blue-100/60 dark:bg-blue-900/40 p-2 rounded-lg border border-blue-200/50 dark:border-blue-800/40">
                  ℹ️ <strong>Summed in Transaction Total:</strong> Included in overall business work and revenue totals to reflect business production, but <strong>not added to wallets</strong> until the customer pays.
                </p>
              </div>
            </div>
          )}

          {/* Category Tag Pills */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] flex items-center gap-1.5 mb-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00D4AA]" />
              <span>Category Tag</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 border border-slate-200 dark:border-[#1E2D40] rounded-2xl bg-slate-50 dark:bg-[#0A0E1A]">
              {filteredCategories.map((c) => {
                const isEqubCat = c.name === 'Equb Contribution' || c.name.toLowerCase().includes('equb') || c.name.toLowerCase().includes('ekub');
                const isLoanCat = c.name === 'Loan Payment' || c.name.toLowerCase().includes('loan');
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setCategory(c.name);
                      if (isEqubCat) {
                        setSelectedLoanId(null);
                        if (activeEqubs.length > 0 && !selectedEqubId) {
                          handleSelectEqub(activeEqubs[0]);
                        }
                      } else if (isLoanCat) {
                        setSelectedEqubId(null);
                        if (activeLoans.length > 0 && !selectedLoanId) {
                          handleSelectLoan(activeLoans[0]);
                        }
                      } else {
                        setSelectedEqubId(null);
                        setSelectedLoanId(null);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                      category === c.name
                        ? isEqubCat
                          ? 'bg-purple-600 dark:bg-purple-500 text-white font-bold shadow-md'
                          : isLoanCat
                          ? 'bg-indigo-600 dark:bg-indigo-500 text-white font-bold shadow-md'
                          : 'bg-emerald-600 dark:bg-[#00D4AA] text-white dark:text-[#0A0E1A] font-bold shadow-md'
                        : 'bg-white dark:bg-[#131926] text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>

            {/* Active Loans Selection Grid - shown when Loan Payment category is selected */}
            {isLoanPayment && (
              <div className="mt-3 p-3.5 rounded-2xl border bg-gradient-to-br from-indigo-50/80 to-slate-50 dark:from-indigo-950/30 dark:to-[#131926] border-indigo-200 dark:border-indigo-800/50 space-y-3 animate-fadeIn shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-xs">
                      <HandCoins className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>Active Loans (Borrow / Lent)</span>
                        <span className="text-[9px] bg-indigo-600 dark:bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-mono font-bold">
                          {activeLoans.length} Active
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">
                        Select loan to pay — use single wallet or Equb-style split payment across multiple wallets
                      </p>
                    </div>
                  </div>

                  {selectedLoanId && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedLoanId(null);
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      Deselect
                    </button>
                  )}
                </div>

                {activeLoans.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <span>⚠️ No Active Loans Available</span>
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                      All registered loans are settled or none exist yet. You can create loans in the Loans & Debt hub.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeLoans.map((loan) => {
                      const isSelected = selectedLoanId === loan.id;
                      const isLent = loan.direction === 'LENT';
                      const linkedW = wallets.find(w => w.id === loan.walletId);

                      return (
                        <button
                          key={loan.id}
                          type="button"
                          onClick={() => handleSelectLoan(loan)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-indigo-100/80 dark:bg-indigo-900/45 border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/40 shadow-sm'
                              : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-[#1E2D40] hover:border-indigo-300 dark:hover:border-indigo-700/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 pr-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {loan.title}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                  isLent
                                    ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400'
                                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                }`}>
                                  {isLent ? 'LENT (COLLECT)' : 'BORROW (REPAY)'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                                Party: <span className="font-semibold text-slate-900 dark:text-white">{loan.counterparty}</span>
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono font-black text-indigo-700 dark:text-indigo-300">
                                {formatETB(loan.outstandingBalance)}
                              </span>
                              <span className="text-[9px] text-slate-400 dark:text-[#8899BB] block font-mono">
                                remaining
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1E2D40] flex items-center justify-between text-[10px] text-slate-500 dark:text-[#8899BB]">
                            <span>
                              Due: <strong className="text-slate-700 dark:text-slate-300">{loan.dueDate ? loan.dueDate.split('T')[0] : 'N/A'}</strong>
                              {loan.monthlyInstallment ? ` • ${formatETB(loan.monthlyInstallment)}/mo` : ''}
                            </span>
                            {linkedW && (
                              <span className="truncate max-w-[110px] text-[9px] font-medium bg-slate-100 dark:bg-[#1C2333] px-1.5 py-0.5 rounded">
                                💼 {getWalletNickname(linkedW.name)}
                              </span>
                            )}
                          </div>

                          {isSelected && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold bg-indigo-600 dark:bg-indigo-500 text-white px-1.5 py-0.5 rounded-full shadow-xs">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>SELECTED</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedLoan && (
                  <div className="p-2.5 bg-indigo-100/70 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-700/60 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
                    <div className="min-w-0 pr-2">
                      <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                        <span>✅ Selected: {selectedLoan.title} ({selectedLoan.counterparty})</span>
                      </p>
                      <p className="text-[10px] text-indigo-700 dark:text-indigo-300/90 mt-0.5">
                        Outstanding: <strong>{formatETB(selectedLoan.outstandingBalance)}</strong>. Min ETB 1,000. Equb-style split payment enabled!
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {selectedLoan.monthlyInstallment && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setAmountStr(selectedLoan.monthlyInstallment!.toString());
                          }}
                          className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
                        >
                          Fill Installment {formatETB(selectedLoan.monthlyInstallment)}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setAmountStr(selectedLoan.outstandingBalance.toString());
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
                      >
                        Fill Full {formatETB(selectedLoan.outstandingBalance)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active Equbs Selection Grid & In-Modal Registration - ONLY shown when Equb Contribution is selected from category */}
            {isEqubContribution && (
              <div className="mt-3 p-3.5 rounded-2xl border bg-gradient-to-br from-purple-50/80 to-slate-50 dark:from-purple-950/30 dark:to-[#131926] border-purple-200 dark:border-purple-800/50 space-y-3 animate-fadeIn shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center shadow-xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>Active Equbs to Choose From</span>
                        <span className="text-[9px] bg-purple-600 dark:bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-mono font-bold">
                          {activeEqubs.length} Active
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">
                        Select an active circle or register a new one with prepaid advance months
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onCreateEqub && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setShowRegisterEqub(prev => !prev);
                        }}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-xs ${
                          showRegisterEqub
                            ? 'bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200 hover:bg-purple-300'
                            : 'bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>{showRegisterEqub ? 'Close' : 'Register New Equb'}</span>
                      </button>
                    )}

                    {selectedEqubId && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedEqubId(null);
                          setAdvanceMonthsForSelected(0);
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                      >
                        Deselect
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Equb Circle Registration Form */}
                {showRegisterEqub && (
                  <div className="p-3.5 bg-white dark:bg-[#131926] border border-purple-300 dark:border-purple-700/70 rounded-2xl space-y-3 animate-fadeIn shadow-xs">
                    <div className="flex items-center justify-between border-b border-purple-100 dark:border-[#1E2D40] pb-2">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <h5 className="text-xs font-black text-slate-900 dark:text-white">Register New Equb Circle</h5>
                      </div>
                      <span className="text-[9px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-mono font-bold">
                        Quick Launch
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                          Equb Name *
                        </label>
                        <input
                          type="text"
                          value={newEqubName}
                          onChange={e => setNewEqubName(e.target.value)}
                          placeholder="e.g. Agerye Equb 2, Leli 3"
                          className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-purple-500 rounded-xl p-2 text-xs text-slate-900 dark:text-white font-medium outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                          Contribution / Round (ETB) *
                        </label>
                        <input
                          type="number"
                          value={newEqubContribution}
                          onChange={e => setNewEqubContribution(e.target.value)}
                          placeholder="e.g. 5000"
                          className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-purple-500 rounded-xl p-2 text-xs text-slate-900 dark:text-white font-mono font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                          Interval
                        </label>
                        <select
                          value={newEqubInterval}
                          onChange={e => setNewEqubInterval(e.target.value as any)}
                          className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-purple-500 rounded-xl p-2 text-xs text-slate-900 dark:text-white font-medium outline-none"
                        >
                          <option value="EVERY_10_DAYS">Every 10 Days</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="EVERY_15_DAYS">Every 15 Days</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                          Total Rounds
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={newEqubTotalRounds}
                          onChange={e => setNewEqubTotalRounds(e.target.value)}
                          placeholder="27"
                          className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-purple-500 rounded-xl p-2 text-xs text-slate-900 dark:text-white font-mono font-bold outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                          Your Slots
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={newEqubSlots}
                          onChange={e => setNewEqubSlots(e.target.value)}
                          placeholder="1"
                          className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-purple-500 rounded-xl p-2 text-xs text-slate-900 dark:text-white font-mono font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                        Default Payment Wallet
                      </label>
                      <select
                        value={newEqubWalletId}
                        onChange={e => setNewEqubWalletId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-purple-500 rounded-xl p-2 text-xs text-slate-900 dark:text-white font-medium outline-none"
                      >
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({formatETB(calculateWalletBalance(w, transactions, transfers))})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* How long is it paid in advance in months? */}
                    <div className="pt-2.5 border-t border-purple-100 dark:border-[#1E2D40] space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>How long is it paid in advance (in months)?</span>
                        </label>
                        <span className="text-[9px] bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-mono font-bold px-1.5 py-0.5 rounded">
                          Prepayment Option
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-[#8899BB] leading-tight">
                        Choose how many months have already been settled upfront. Future cashflow forecasts will pause deductions during this period.
                      </p>

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        {[
                          { label: '0 Mo (None)', val: 0 },
                          { label: '1 Month', val: 1 },
                          { label: '2 Months', val: 2 },
                          { label: '3 Months', val: 3 },
                          { label: '6 Months', val: 6 },
                          { label: 'Custom', val: -1 },
                        ].map(chip => {
                          const isSelected = newEqubAdvanceMonths === chip.val;
                          return (
                            <button
                              key={chip.val}
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setNewEqubAdvanceMonths(chip.val);
                              }}
                              className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center ${
                                isSelected
                                  ? 'bg-purple-600 dark:bg-purple-500 text-white border-purple-600 shadow-xs ring-1 ring-purple-400'
                                  : 'bg-slate-50 dark:bg-[#1C2333] text-slate-700 dark:text-[#8899BB] border-slate-200 dark:border-[#1E2D40] hover:border-purple-400'
                              }`}
                            >
                              {chip.label}
                            </button>
                          );
                        })}
                      </div>

                      {newEqubAdvanceMonths === -1 && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={newEqubCustomMonths}
                            onChange={e => setNewEqubCustomMonths(e.target.value)}
                            placeholder="Enter months (e.g. 4 or 5)"
                            className="w-full bg-slate-50 dark:bg-[#1C2333] border border-purple-300 dark:border-purple-600 rounded-xl p-2 text-xs text-slate-900 dark:text-white font-bold outline-none"
                          />
                          <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB] shrink-0">
                            Months
                          </span>
                        </div>
                      )}

                      {/* Advance Breakdown Banner */}
                      {newEqubPrepaidRounds > 0 && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-xs space-y-1.5 animate-fadeIn">
                          <div className="flex justify-between items-center text-[11px] font-bold text-purple-950 dark:text-purple-100">
                            <span>Prepaid Rounds:</span>
                            <span className="font-mono text-purple-700 dark:text-purple-300">
                              {newEqubPrepaidRounds} rounds ({effectiveAdvanceMonths} mo)
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] font-bold text-purple-950 dark:text-purple-100">
                            <span>Total Advance Amount:</span>
                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                              {formatETB(newEqubAdvanceTotal)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-purple-800 dark:text-purple-200 pt-1 border-t border-purple-200 dark:border-purple-800/60">
                            <span>Starting Active Round:</span>
                            <span className="font-bold">
                              Round #{newEqubStartingRound} of {newEqubTotalRoundsNum}
                            </span>
                          </div>

                          <label className="flex items-center gap-2 pt-1 text-[10px] text-purple-900 dark:text-purple-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newEqubRecordPayment}
                              onChange={e => setNewEqubRecordPayment(e.target.checked)}
                              className="rounded accent-purple-600"
                            />
                            <span>Record {formatETB(newEqubAdvanceTotal)} advance expense now in ledger</span>
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100 dark:border-[#1E2D40]">
                      <button
                        type="button"
                        onClick={() => setShowRegisterEqub(false)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1E2D40] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:bg-slate-100 dark:hover:bg-[#1C2333] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegisterEqubSubmit()}
                        disabled={!newEqubName.trim() || !newEqubContribution || newEqubContribNum <= 0}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {newEqubPrepaidRounds > 0
                          ? `Register & Pay ${formatETB(newEqubAdvanceTotal)}`
                          : 'Register Equb Circle'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing Active Equbs Grid */}
                {activeEqubs.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <span>⚠️ No Active Equbs Available</span>
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                      All registered Equbs are completed or none have been created yet. Click "+ Register New Equb" above to launch a new circle.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeEqubs.map((eq) => {
                      const isSelected = selectedEqubId === eq.id;
                      const roundDue = eq.contributionPerRound * (eq.mySlots || 1);
                      const linkedW = wallets.find(w => w.id === eq.walletId);
                      const intervalLabel = eq.interval === 'EVERY_10_DAYS'
                        ? 'Every 10 Days'
                        : eq.interval === 'EVERY_15_DAYS'
                        ? 'Every 15 Days'
                        : eq.interval === 'WEEKLY'
                        ? 'Weekly'
                        : 'Monthly';

                      return (
                        <button
                          key={eq.id}
                          type="button"
                          onClick={() => handleSelectEqub(eq)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-purple-100/80 dark:bg-purple-900/45 border-purple-500 dark:border-purple-400 ring-2 ring-purple-500/40 shadow-sm'
                              : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-[#1E2D40] hover:border-purple-300 dark:hover:border-purple-700/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 pr-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {eq.name}
                                </span>
                                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold">
                                  ACTIVE
                                </span>
                              </div>
                              <p className="text-[10px] text-purple-700 dark:text-purple-300 font-mono font-semibold mt-0.5">
                                Round #{eq.currentRound} of {eq.totalRounds}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono font-black text-purple-700 dark:text-purple-300">
                                {formatETB(roundDue)}
                              </span>
                              <span className="text-[9px] text-slate-400 dark:text-[#8899BB] block font-mono">
                                / round
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1E2D40] flex items-center justify-between text-[10px] text-slate-500 dark:text-[#8899BB]">
                            <span className="flex items-center gap-1">
                              <span>⏱️ {intervalLabel}</span>
                              {eq.mySlots && eq.mySlots > 1 && (
                                <span className="text-purple-600 dark:text-purple-400 font-bold">({eq.mySlots} slots)</span>
                              )}
                            </span>
                            {linkedW && (
                              <span className="truncate max-w-[110px] text-[9px] font-medium bg-slate-100 dark:bg-[#1C2333] px-1.5 py-0.5 rounded">
                                💼 {getWalletNickname(linkedW.name)}
                              </span>
                            )}
                          </div>

                          {isSelected && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold bg-purple-600 dark:bg-purple-500 text-white px-1.5 py-0.5 rounded-full shadow-xs">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>SELECTED</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Selected Equb Action & Advance Months Options */}
                {selectedEqub && (() => {
                  const roundAmount = selectedEqub.contributionPerRound * (selectedEqub.mySlots || 1);
                  const rpm = getRoundsPerMonth(selectedEqub.interval);
                  const completedRounds = typeof selectedEqub.completedRounds === 'number'
                    ? selectedEqub.completedRounds
                    : Math.max(0, selectedEqub.currentRound - 1);
                  const remaining = Math.max(1, selectedEqub.totalRounds - completedRounds);

                  return (
                    <div className="p-3 bg-purple-100/70 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-700/60 rounded-xl space-y-2.5 text-xs animate-fadeIn">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="min-w-0 pr-2">
                          <p className="text-[11px] font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1">
                            <span>✅ Selected: {selectedEqub.name} (Round #{selectedEqub.currentRound} of {selectedEqub.totalRounds})</span>
                          </p>
                          <p className="text-[10px] text-purple-700 dark:text-purple-300/90 mt-0.5">
                            {advanceMonthsForSelected > 0
                              ? `Advance payment for ${advanceMonthsForSelected} month(s) (${Math.min(remaining, Math.round(advanceMonthsForSelected * rpm))} rounds). Submitting advances ${selectedEqub.name} to Round #${Math.min(selectedEqub.totalRounds, selectedEqub.currentRound + Math.min(remaining, Math.round(advanceMonthsForSelected * rpm)))}.`
                              : `Submitting will record single round contribution and advance ${selectedEqub.name} to Round #${Math.min(selectedEqub.totalRounds, selectedEqub.currentRound + 1)}.`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplyAdvanceForSelectedEqub(0)}
                          className="text-[10px] bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 text-white font-bold px-2.5 py-1 rounded-lg shrink-0 cursor-pointer transition-colors"
                        >
                          Fill Single Round ({formatETB(roundAmount)})
                        </button>
                      </div>

                      {/* Advance Option Selector for Selected Equb */}
                      <div className="pt-2 border-t border-purple-200 dark:border-purple-700/60">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                            <span>Pay in advance for how long (in months)?</span>
                          </span>
                          {advanceMonthsForSelected > 0 && (
                            <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                              {advanceMonthsForSelected} Mo Advance
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { label: '1 Round', months: 0, rounds: 1 },
                            { label: '1 Month', months: 1, rounds: Math.min(remaining, rpm) },
                            { label: '2 Months', months: 2, rounds: Math.min(remaining, rpm * 2) },
                            { label: '3 Months', months: 3, rounds: Math.min(remaining, rpm * 3) }
                          ].map(opt => {
                            const isAct = advanceMonthsForSelected === opt.months;
                            const optTotal = opt.rounds * roundAmount;
                            return (
                              <button
                                key={opt.months}
                                type="button"
                                onClick={() => handleApplyAdvanceForSelectedEqub(opt.months)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                  isAct
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-1 ring-purple-400'
                                    : 'bg-white dark:bg-[#131926] text-purple-900 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:border-purple-500'
                                }`}
                              >
                                <span>{opt.label}</span>
                                {opt.months > 0 && (
                                  <span className="ml-1 opacity-80 font-mono text-[9px]">
                                    ({opt.rounds} rnds • {formatETB(optTotal)})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Recurring Bills & Advance Rent Selection Card */}
            {isRecurringPayment && (
              <div className="mt-3 p-3.5 rounded-2xl border bg-gradient-to-br from-blue-50/80 to-slate-50 dark:from-blue-950/30 dark:to-[#131926] border-blue-200 dark:border-blue-800/50 space-y-3 animate-fadeIn shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shadow-xs">
                      <Repeat className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>Recurring Bills & Advance Payments</span>
                        <span className="text-[9px] bg-blue-600 dark:bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-mono font-bold">
                          {activeRecurring.length} Active
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">
                        Paying rent or bills in advance automatically advances the next due date and pauses trajectory deductions.
                      </p>
                    </div>
                  </div>

                  {selectedRecurringId && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedRecurringId(null);
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      Deselect
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeRecurring.map((rec) => {
                    const isSelected = selectedRecurringId === rec.id;
                    const isPrepaid = rec.nextDueDate && new Date(rec.nextDueDate).getTime() > Date.now();

                    return (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => handleSelectRecurring(rec)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-blue-100/80 dark:bg-blue-900/45 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/40 shadow-sm'
                            : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-[#1E2D40] hover:border-blue-300 dark:hover:border-blue-700/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 pr-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {rec.title}
                              </span>
                              {isPrepaid && (
                                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold">
                                  PREPAID
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-blue-700 dark:text-blue-300 font-mono mt-0.5">
                              Next Due: {rec.nextDueDate ? new Date(rec.nextDueDate).toLocaleDateString() : 'Now'}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-300">
                              {formatETB(rec.amount)}
                            </span>
                            <span className="text-[9px] text-slate-400 dark:text-[#8899BB] block font-mono">
                              /{rec.frequency.toLowerCase().replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold bg-blue-600 dark:bg-blue-500 text-white px-1.5 py-0.5 rounded-full shadow-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>SELECTED</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedRecurring && (
                  <div className="p-2.5 bg-blue-100/70 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700/60 rounded-xl flex items-center justify-between text-xs animate-fadeIn flex-wrap gap-2">
                    <div className="min-w-0 pr-2">
                      <p className="text-[11px] font-bold text-blue-900 dark:text-blue-200">
                        ✅ Selected: {selectedRecurring.title}
                      </p>
                      <p className="text-[10px] text-blue-700 dark:text-blue-300/90 mt-0.5">
                        Base rate: {formatETB(selectedRecurring.amount)} due on {selectedRecurring.nextDueDate ? new Date(selectedRecurring.nextDueDate).toLocaleDateString() : 'Scheduled'}. Advance payment extends due date and pauses trajectory burn.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setAmountStr(selectedRecurring.amount.toString());
                        }}
                        className="text-[10px] bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
                      >
                        1 Cycle ({formatETB(selectedRecurring.amount)})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setAmountStr((selectedRecurring.amount * 3).toString());
                        }}
                        className="text-[10px] bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded-lg cursor-pointer transition-colors"
                      >
                        3 Mo Advance ({formatETB(selectedRecurring.amount * 3)})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description & Reference Note */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] flex items-center gap-1 mb-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Notes / Reference (Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isEqubContribution && selectedEqub
                  ? `${selectedEqub.name} Round #${selectedEqub.currentRound} contribution`
                  : isLoanPayment && selectedLoan
                  ? `${selectedLoan.direction === 'LENT' ? 'Collected repayment for' : 'Repaid installment for'} ${selectedLoan.title} (${selectedLoan.counterparty})`
                  : entryMode === 'EXPENSE'
                  ? (expenseScope === 'PERSONAL' ? 'e.g. Personal withdrawal, home supplies, shopping' : 'e.g. Electricity bill, equipment repair, lounge supplies')
                  : (isCreditSale ? 'e.g. Credit sale details or customer invoice ref' : 'Note or reference')
              }
              className="w-full bg-slate-50 dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] focus:border-emerald-500 dark:focus:border-[#00D4AA] rounded-xl py-2.5 px-3 text-xs text-slate-900 dark:text-[#F0F4FF] outline-none"
            />
          </div>

          {/* Date Selector */}
          <div className="space-y-2">
            <ModernDateInput
              label="Posting Date"
              sublabel="Select date for this entry"
              min={getMinDateStr()}
              max={getTodayStr()}
              value={postingDate}
              onChange={(newVal) => {
                if (newVal) {
                  triggerHaptic('light');
                  setPostingDate(newVal);
                }
              }}
              accentColor={isEqubContribution ? 'purple' : isLoanPayment ? 'indigo' : (entryMode === 'INCOME' ? 'emerald' : 'amber')}
              presets={[
                { label: 'Today', value: getTodayStr() },
                { label: 'Yesterday', value: getYesterdayStr() },
                ...(isAdminOrSuperAdmin ? [{ label: 'Last Month', value: getLastMonthEndStr() }] : [])
              ]}
              helperText="Click anywhere in the box to open calendar picker."
            />
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer hover:opacity-95 ${
              batchMode === 'batch'
                ? entryMode === 'INCOME'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-800 dark:from-[#A78BFA] dark:to-[#8B5CF6] text-white dark:text-[#0A0E1A] shadow-purple-500/25'
                  : isEqubContribution && selectedEqub
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-700 dark:from-purple-600 dark:to-indigo-600 text-white shadow-purple-500/25'
                  : isLoanPayment && selectedLoan
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-700 dark:from-indigo-600 dark:to-blue-600 text-white shadow-indigo-500/25'
                  : 'bg-gradient-to-r from-rose-600 to-rose-800 dark:from-rose-500 dark:to-rose-700 text-white shadow-rose-500/25'
                : isCreditSale && entryMode === 'INCOME'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 dark:from-[#3B82F6] dark:to-[#2563EB] text-white shadow-blue-500/25'
                : isEqubContribution && selectedEqub
                ? 'bg-gradient-to-r from-purple-600 to-indigo-700 dark:from-purple-600 dark:to-indigo-600 text-white shadow-purple-500/25'
                : isLoanPayment && selectedLoan
                ? 'bg-gradient-to-r from-indigo-600 to-blue-700 dark:from-indigo-600 dark:to-blue-600 text-white shadow-indigo-500/25'
                : entryMode === 'INCOME'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 dark:from-[#00D4AA] dark:to-[#00B894] text-white dark:text-[#0A0E1A] shadow-emerald-500/20'
                : 'bg-gradient-to-r from-rose-600 to-red-700 dark:from-[#EF4444] dark:to-[#DC2626] text-white shadow-rose-500/20'
            }`}
          >
            <Check className="w-5 h-5" />
            <span>
              {batchMode === 'batch'
                ? isEqubContribution && selectedEqub
                  ? `Post ${selectedEqub.name} Equb Split across ${batchEntries.length} ${batchEntries.length === 1 ? 'Wallet' : 'Wallets'} (${formatETB(totalBatchAmount)})`
                  : isLoanPayment && selectedLoan
                  ? `Post ${selectedLoan.title} Split Repayment across ${batchEntries.length} ${batchEntries.length === 1 ? 'Wallet' : 'Wallets'} (${formatETB(totalBatchAmount)})`
                  : `Post Split ${entryMode === 'INCOME' ? 'Income' : 'Payment'} across ${batchEntries.length} ${batchEntries.length === 1 ? 'Wallet' : 'Wallets'} (${formatETB(totalBatchAmount)})`
                : isCreditSale && entryMode === 'INCOME'
                ? `Record Credit Sale for ${customerName || 'Customer'}`
                : isEqubContribution && selectedEqub
                ? `Post Equb Contribution (${selectedEqub.name} Round #${selectedEqub.currentRound})`
                : isLoanPayment && selectedLoan
                ? `Post ${selectedLoan.title} Repayment (${formatETB(parsedSingle.total)})`
                : `Post ${entryMode === 'INCOME' ? 'Income' : 'Expense'} to Ledger`}
            </span>
          </button>

        </form>
      </div>
    </div>
  );
};
