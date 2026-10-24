import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  RotateCcw,
  X,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Wallet as WalletIcon,
  Tag,
  Edit3,
  Trash2,
  Lock,
  CheckCircle2,
  Calculator,
  FileText,
  FileSpreadsheet,
  Sparkles,
  ArrowRightLeft,
  FileCheck,
  User,
  Briefcase,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Layers,
  Plus,
  Moon,
  Coffee,
  CalendarOff,
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import { Transaction, Transfer, Receivable, Wallet, Category, UserProfile, TransactionType, ERPState, NavTab, Loan, Equb, Asset, RecurringTemplate } from '../../types';
import {
  formatETB,
  isTransactionEditable,
  isCreditSaleCollected,
  parseSummedAmount,
  computeAllWalletRunningBalances,
  getRelativeWalletBalancesForTx,
  getRelativeWalletBalancesForTransfer,
  getWalletNickname,
  consolidateEqubSplitTransactions,
  isEqubContributionTransaction,
  getTransactionDisplayTitle
} from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import { generatePDFReport, generateAuditPDFReport, generateExcelReport } from '../../lib/exports';
import { formatDateByCalendar } from '../../lib/ethiopianCalendar';
import { ModernDateInput } from '../common/ModernDateInput';

interface TransactionsViewProps {
  transactions: Transaction[];
  transfers?: Transfer[];
  receivables?: Receivable[];
  loans?: Loan[];
  equbs?: Equb[];
  assets?: Asset[];
  recurring?: RecurringTemplate[];
  wallets: Wallet[];
  categories: Category[];
  currentUser: UserProfile;
  hideBalances: boolean;
  calendarType?: 'ETHIOPIAN' | 'GREGORIAN';
  onReverseTransaction: (txId: string) => void;
  onRefreshTransactions?: () => void;
  onUpdateTransaction?: (txId: string, data: {
    date: string;
    amount: number;
    type: TransactionType;
    category: string;
    description: string;
    walletId: string;
    expenseScope?: 'BUSINESS' | 'PERSONAL';
    splits?: Array<{ walletId: string; amount: number }>;
    refType?: Transaction['refType'];
    refId?: string;
  }) => void;
  onDeleteTransaction?: (txId: string) => void;
  onClearAllTransactions?: () => void;
  users?: UserProfile[];
  onRequestApproval?: (req: Omit<import('../../types').AdminApprovalRequest, 'id' | 'createdAt' | 'requestedBy' | 'requestedByName' | 'status'>) => void;
  onNavigateTab?: (tab: NavTab, subView?: string) => void;
  onOpenHelp?: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  transfers = [],
  receivables = [],
  loans = [],
  equbs = [],
  assets = [],
  recurring = [],
  wallets,
  categories,
  currentUser,
  users = [],
  hideBalances,
  calendarType = 'GREGORIAN',
  onReverseTransaction,
  onRefreshTransactions,
  onUpdateTransaction,
  onDeleteTransaction,
  onClearAllTransactions,
  onRequestApproval,
  onNavigateTab,
  onOpenHelp
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'LOAN' | 'EQUB' | 'CREDIT_SALE'>('ALL');
  const [selectedScope, setSelectedScope] = useState<'ALL' | 'BUSINESS' | 'PERSONAL'>('ALL');
  const [activeTxDetail, setActiveTxDetail] = useState<Transaction | null>(null);
  const [activeCreditSaleDetail, setActiveCreditSaleDetail] = useState<Receivable | null>(null);
  const [confirmReversalTxId, setConfirmReversalTxId] = useState<string | null>(null);
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);


  // Inactive / Non-working days reminders & toggle
  const [showNonWorkingDays, setShowNonWorkingDays] = useState<boolean>(true);
  const [dayReminders, setDayReminders] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('pluszone_non_working_day_reminders_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [editingNoteModal, setEditingNoteModal] = useState<{ dateKey: string; dateLabel: string } | null>(null);
  const [noteInputText, setNoteInputText] = useState('');

  const handleOpenDayNoteModal = (dateKey: string, dateLabel: string) => {
    triggerHaptic('light');
    setEditingNoteModal({ dateKey, dateLabel });
    setNoteInputText(dayReminders[dateKey] || '');
  };

  const handleSaveDayNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingNoteModal) return;
    triggerHaptic('medium');
    const updated = { ...dayReminders };
    if (noteInputText.trim()) {
      updated[editingNoteModal.dateKey] = noteInputText.trim();
    } else {
      delete updated[editingNoteModal.dateKey];
    }
    setDayReminders(updated);
    try {
      localStorage.setItem('pluszone_non_working_day_reminders_v1', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save day reminder to localStorage:', err);
    }
    setEditingNoteModal(null);
    setNoteInputText('');
  };

  const handleClearDayNote = () => {
    if (!editingNoteModal) return;
    triggerHaptic('light');
    const updated = { ...dayReminders };
    delete updated[editingNoteModal.dateKey];
    setDayReminders(updated);
    try {
      localStorage.setItem('pluszone_non_working_day_reminders_v1', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to clear day reminder:', err);
    }
    setEditingNoteModal(null);
    setNoteInputText('');
  };

  // Edit modal state with full Split Payment support
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);
  const [editSplitRows, setEditSplitRows] = useState<Array<{ walletId: string; amount: string }>>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    date: string;
    amount: string;
    type: TransactionType;
    category: string;
    description: string;
    walletId: string;
    expenseScope: 'BUSINESS' | 'PERSONAL';
    refType?: Transaction['refType'];
    refId?: string;
  }>({
    date: '',
    amount: '',
    type: 'INCOME' as TransactionType,
    category: '',
    description: '',
    walletId: '',
    expenseScope: 'BUSINESS' as 'BUSINESS' | 'PERSONAL',
    refType: undefined,
    refId: undefined
  });

  // Helper to extract split allocations if already present on transaction or documented in description
  const extractSplitsFromTransaction = (
    tx: Transaction,
    availableWallets: Wallet[],
    allTransactions?: Transaction[]
  ): Array<{ walletId: string; amount: string }> | null => {
    // 1. If explicit splits array is already present with 2 or more wallets
    if (Array.isArray(tx.splits) && tx.splits.length >= 2) {
      return tx.splits.map(s => ({
        walletId: s.walletId,
        amount: Math.abs(s.amount).toString()
      }));
    }

    // 2. If explicit splits array is present but has only 1 item:
    // Only if remainder > 0 (meaning it was a partial split allocation), pair with another wallet.
    // If the single split equals the total transaction amount, it is a single-wallet payment, NOT a multi-wallet split.
    if (Array.isArray(tx.splits) && tx.splits.length === 1) {
      const firstSplit = tx.splits[0];
      const parsedFirst = Math.abs(firstSplit.amount);
      const targetAmt = tx.amount || parsedFirst;
      const remainder = targetAmt - parsedFirst;
      if (remainder > 0) {
        const secondW = availableWallets.find(w => w.id !== firstSplit.walletId)?.id || availableWallets[0]?.id;
        return [
          { walletId: firstSplit.walletId, amount: parsedFirst.toString() },
          { walletId: secondW, amount: remainder.toString() }
        ];
      }
      return null;
    }

    // 3. If transaction is a consolidated equb or loan payment with sibling transactions
    if (tx.siblingTxIds && tx.siblingTxIds.length > 0 && Array.isArray(allTransactions)) {
      const siblings = allTransactions.filter(t => tx.siblingTxIds!.includes(t.id));
      if (siblings.length > 0) {
        const rows: Array<{ walletId: string; amount: string }> = [
          { walletId: tx.walletId, amount: tx.amount.toString() },
          ...siblings.map(s => ({ walletId: s.walletId, amount: s.amount.toString() }))
        ];
        return rows;
      }
    }

    // 4. If transaction ID matches batch split format (tx-eq-<ts>-<idx>, tx-lp-<ts>-<idx>, tx-<ts>-<idx>)
    const batchMatch = tx.id.match(/^((?:tx-eq|tx-lp|tx)-\d+)-\d+$/);
    if (batchMatch && Array.isArray(allTransactions)) {
      const prefix = batchMatch[1];
      const siblings = allTransactions.filter(t => t.id.startsWith(`${prefix}-`));
      if (siblings.length >= 2) {
        return siblings.map(s => ({ walletId: s.walletId, amount: s.amount.toString() }));
      }
    }

    const desc = tx.description || '';
    const cat = tx.category || '';
    const isSplitMentioned = /split/i.test(desc) || /split/i.test(cat);

    if (isSplitMentioned) {
      const foundSplits: Array<{ walletId: string; amount: string }> = [];
      availableWallets.forEach(w => {
        const wName = w.name;
        const wNick = getWalletNickname(wName);
        const re1 = new RegExp(`(?:${wName}|${wNick})(?:\\s*split)?[\\s:]*(?:ETB\\s*)?([\\d,]+(?:\\.\\d+)?)`, 'i');
        const re2 = new RegExp(`(?:ETB\\s*)?([\\d,]+(?:\\.\\d+)?)\\s*(?:from|in|via)?\\s*(?:${wName}|${wNick})`, 'i');
        const match = desc.match(re1) || desc.match(re2);
        if (match) {
          const parsedVal = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(parsedVal) && parsedVal > 0) {
            foundSplits.push({ walletId: w.id, amount: parsedVal.toString() });
          }
        }
      });
      if (foundSplits.length >= 2) {
        return foundSplits;
      }
      if (foundSplits.length === 1) {
        const parsed1 = parseFloat(foundSplits[0].amount) || 0;
        const rem = Math.max(0, (tx.amount || 0) - parsed1);
        if (rem > 0) {
          const secondW = availableWallets.find(w => w.id !== foundSplits[0].walletId)?.id || availableWallets[0]?.id;
          return [
            foundSplits[0],
            { walletId: secondW, amount: rem.toString() }
          ];
        }
      }
      // If description explicitly mentions (Split: ...) with 2+ items, initialize split rows
      if (/\(Split:[^)]*\)/i.test(desc) || /\(Split\s*\d+\/\d+[^)]*\)/i.test(desc)) {
        const w1 = tx.walletId || availableWallets[0]?.id || '';
        const w2 = availableWallets.find(w => w.id !== w1)?.id || availableWallets[1]?.id || w1;
        const targetAmt = tx.amount || 0;
        const half1 = Math.round(targetAmt / 2);
        const half2 = Math.max(0, targetAmt - half1);
        return [
          { walletId: w1, amount: half1 > 0 ? half1.toString() : targetAmt.toString() },
          { walletId: w2, amount: half2 > 0 ? half2.toString() : '0' }
        ];
      }
    }

    return null;
  };

  const handleOpenEdit = (tx: Transaction) => {
    triggerHaptic('medium');
    setEditError(null);
    let formattedDate = '';
    try {
      const d = new Date(tx.date);
      formattedDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    } catch (e) {
      formattedDate = tx.date;
    }

    const defaultScope = tx.type === 'EXPENSE'
      ? (tx.expenseScope || 'BUSINESS')
      : 'BUSINESS';

    const detectedSplits = extractSplitsFromTransaction(tx, wallets, transactions);
    const hasSplits = detectedSplits !== null && detectedSplits.length >= 2;
    setIsSplitMode(hasSplits);

    if (hasSplits && detectedSplits) {
      setEditSplitRows(detectedSplits);
      const splitsSum = detectedSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      setEditForm({
        date: formattedDate,
        amount: splitsSum > 0 ? splitsSum.toString() : tx.amount.toString(),
        type: tx.type,
        category: tx.category,
        description: tx.description,
        walletId: detectedSplits[0]?.walletId || tx.walletId || wallets[0]?.id || '',
        expenseScope: defaultScope,
        refType: tx.refType,
        refId: tx.refId
      });
    } else {
      const w1 = tx.walletId || wallets[0]?.id || '';
      const w2 = wallets.find(w => w.id !== w1)?.id || wallets[1]?.id || w1;
      const targetAmt = tx.amount || 0;
      const half1 = Math.round(targetAmt / 2);
      const half2 = Math.max(0, targetAmt - half1);
      setEditSplitRows([
        { walletId: w1, amount: half1 > 0 ? half1.toString() : targetAmt.toString() },
        { walletId: w2, amount: half2 > 0 ? half2.toString() : '0' }
      ]);
      setEditForm({
        date: formattedDate,
        amount: tx.amount.toString(),
        type: tx.type,
        category: tx.category,
        description: tx.description,
        walletId: w1,
        expenseScope: defaultScope,
        refType: tx.refType,
        refId: tx.refId
      });
    }

    setEditingTx(tx);
  };

  const handleToggleSplitMode = (enableSplit: boolean) => {
    triggerHaptic('light');
    setIsSplitMode(enableSplit);
    setEditError(null);
    if (enableSplit) {
      const targetTotal = parseSummedAmount(editForm.amount).total || 0;
      const currentRowsSum = editSplitRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      if (editSplitRows.length < 2) {
        const w1 = editForm.walletId || editSplitRows[0]?.walletId || wallets[0]?.id || '';
        const w2 = wallets.find(w => w.id !== w1)?.id || wallets[1]?.id || w1;
        const half1 = Math.round(targetTotal / 2);
        const half2 = Math.max(0, targetTotal - half1);
        setEditSplitRows([
          { walletId: w1, amount: half1 > 0 ? half1.toString() : targetTotal.toString() },
          { walletId: w2, amount: half2 > 0 ? half2.toString() : '0' }
        ]);
      } else if (Math.abs(currentRowsSum - targetTotal) > 0.01 && targetTotal > 0) {
        const half1 = Math.round(targetTotal / 2);
        const half2 = Math.max(0, targetTotal - half1);
        setEditSplitRows(prev => [
          { walletId: prev[0]?.walletId || wallets[0]?.id, amount: half1.toString() },
          { walletId: prev[1]?.walletId || wallets[1]?.id || wallets[0]?.id, amount: half2.toString() },
          ...prev.slice(2).map(r => ({ ...r, amount: '0' }))
        ]);
      }
    }
  };

  const handleAddEditSplitRow = () => {
    triggerHaptic('light');
    setEditError(null);
    const usedWallets = editSplitRows.map(r => r.walletId);
    const unusedWallet = wallets.find(w => !usedWallets.includes(w.id)) || wallets[0];
    const targetTotal = parseSummedAmount(editForm.amount).total;
    const currentSum = editSplitRows.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
    const remainder = targetTotal > currentSum ? targetTotal - currentSum : 0;
    setEditSplitRows(prev => [...prev, { walletId: unusedWallet?.id || '', amount: remainder > 0 ? remainder.toString() : '0' }]);
  };

  const handleRemoveEditSplitRow = (index: number) => {
    if (editSplitRows.length <= 1) return;
    triggerHaptic('light');
    setEditError(null);
    setEditSplitRows(prev => {
      const next = prev.filter((_, i) => i !== index);
      const newTotal = next.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      setEditForm(f => ({ ...f, amount: newTotal > 0 ? newTotal.toString() : f.amount }));
      return next;
    });
  };

  const handleEditSplitRowChange = (index: number, field: 'walletId' | 'amount', value: string) => {
    setEditError(null);
    setEditSplitRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'amount') {
        const newTotal = next.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        setEditForm(f => ({ ...f, amount: newTotal > 0 ? newTotal.toString() : f.amount }));
      }
      return next;
    });
  };

  const handleAutoBalanceEditSplits = () => {
    triggerHaptic('medium');
    setEditError(null);
    const targetTotal = parseSummedAmount(editForm.amount).total;
    if (targetTotal <= 0 || editSplitRows.length < 2) return;
    const filledBeforeLast = editSplitRows.slice(0, -1).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const remainder = Math.max(0, targetTotal - filledBeforeLast);
    setEditSplitRows(prev => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], amount: remainder.toString() };
      return next;
    });
  };

  const handleDistributeEvenly = () => {
    triggerHaptic('medium');
    setEditError(null);
    const targetTotal = parseSummedAmount(editForm.amount).total;
    if (targetTotal <= 0 || editSplitRows.length === 0) return;
    const count = editSplitRows.length;
    const perWallet = Math.floor(targetTotal / count);
    const remainder = targetTotal - perWallet * (count - 1);
    setEditSplitRows(prev => prev.map((r, idx) => ({
      ...r,
      amount: (idx === count - 1 ? remainder : perWallet).toString()
    })));
  };

  const handleSyncAmountFromSplits = () => {
    triggerHaptic('light');
    setEditError(null);
    const sum = editSplitRows.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
    setEditForm(prev => ({ ...prev, amount: sum.toString() }));
  };

  const currentEditSplitTotal = useMemo(() => {
    return editSplitRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  }, [editSplitRows]);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !onUpdateTransaction) return;

    setEditError(null);
    let numAmount = parseSummedAmount(editForm.amount).total;
    let validSplits: Array<{ walletId: string; amount: number }> | undefined = undefined;

    if (isSplitMode) {
      const filtered = editSplitRows
        .map(r => ({ walletId: r.walletId, amount: parseFloat(r.amount) || 0 }))
        .filter(r => r.walletId && r.amount > 0);

      if (filtered.length === 0) {
        setEditError('Please specify funding wallets with valid amounts greater than 0.');
        return;
      }

      if (filtered.length === 1) {
        setEditError('A split payment requires at least two funding wallets with amounts greater than 0. Otherwise, switch to Single Wallet mode.');
        return;
      }

      const totalSplit = filtered.reduce((sum, r) => sum + r.amount, 0);
      if (totalSplit <= 0) {
        setEditError('Total split payment amount must be greater than 0.');
        return;
      }

      numAmount = totalSplit;
      validSplits = filtered;
    } else {
      if (isNaN(numAmount) || numAmount <= 0) {
        setEditError('Please enter a valid amount greater than 0.');
        return;
      }
    }

    triggerHaptic('success');

    let isoDate = editingTx.date;
    try {
      isoDate = new Date(editForm.date).toISOString();
    } catch (err) {
      isoDate = editingTx.date;
    }

    const finalScope = editForm.type === 'EXPENSE'
      ? (editForm.expenseScope || 'BUSINESS')
      : undefined;

    const finalWalletId = validSplits && validSplits.length > 0
      ? validSplits[0].walletId
      : editForm.walletId || wallets[0]?.id || '';

    // Synchronize split description if applicable
    let finalDescription = editForm.description || '';
    if (isSplitMode && validSplits && validSplits.length > 1) {
      const splitSummary = validSplits.map(s => {
        const w = wallets.find(wal => wal.id === s.walletId);
        return `${getWalletNickname(w?.name)}: ${formatETB(s.amount)}`;
      }).join(', ');

      if (/\(Split:[^)]*\)/i.test(finalDescription)) {
        finalDescription = finalDescription.replace(/\(Split:[^)]*\)/i, `(Split: ${splitSummary})`);
      } else if (/\(Cash split\)/i.test(finalDescription)) {
        finalDescription = finalDescription.replace(/\(Cash split\)/i, `(Split: ${splitSummary})`);
      } else if (/\(Split\s*\d+\/\d+[^)]*\)/i.test(finalDescription)) {
        finalDescription = finalDescription.replace(/\(Split\s*\d+\/\d+[^)]*\)/i, `(Split: ${splitSummary})`);
      } else {
        finalDescription = `${finalDescription.trim()} (Split: ${splitSummary})`;
      }
    } else if (!isSplitMode) {
      finalDescription = finalDescription
        .replace(/\s*\(Split:[^)]*\)/gi, '')
        .replace(/\s*\(Cash split\)/gi, '')
        .replace(/\s*\(Split\s*\d+\/\d+[^)]*\)/gi, '')
        .trim();
    }

    const isOld = !isTransactionEditable(editingTx.date);
    const activeOtherUsers = (users || []).filter(u => u.id !== currentUser.id && u.active !== false);
    const hasOtherUsers = activeOtherUsers.length > 0;

    const isPrivileged = currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin';
    if (isOld && hasOtherUsers && !isPrivileged && onRequestApproval) {
      onRequestApproval({
        actionType: 'EDIT_TRANSACTION',
        targetId: editingTx.id,
        targetTitle: `Edit Entry: ${editingTx.description || editingTx.category}`,
        reason: `Edit requested for ledger entry older than 7 days: ETB ${numAmount.toLocaleString()} (${editForm.category})`,
        payload: {
          date: isoDate,
          amount: numAmount,
          type: editForm.type,
          category: editForm.category || 'General',
          description: finalDescription,
          walletId: finalWalletId,
          expenseScope: finalScope,
          splits: validSplits
        }
      });
      setEditingTx(null);
      setActiveTxDetail(null);
      return;
    }

    onUpdateTransaction(editingTx.id, {
      date: isoDate,
      amount: numAmount,
      type: editForm.type,
      category: editForm.category || 'General',
      description: finalDescription,
      walletId: finalWalletId,
      expenseScope: finalScope,
      splits: validSplits,
      refType: editForm.refType,
      refId: editForm.refId
    });

    setEditingTx(null);
    setActiveTxDetail(null);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteTxId) {
      triggerHaptic('warning');
      const targetTx = consolidatedTransactions.find(t => t.id === confirmDeleteTxId) || transactions.find(t => t.id === confirmDeleteTxId);
      const isOld = targetTx ? !isTransactionEditable(targetTx.date) : false;
      const activeOtherUsers = (users || []).filter(u => u.id !== currentUser.id && u.active !== false);
      const hasOtherUsers = activeOtherUsers.length > 0;

      if ((isOld || currentUser.role === 'Partner' || currentUser.role === 'Viewer') && hasOtherUsers && onRequestApproval) {
        onRequestApproval({
          actionType: 'DELETE_TRANSACTION',
          targetId: confirmDeleteTxId,
          targetTitle: targetTx ? `${targetTx.description || targetTx.category} (ETB ${targetTx.amount.toLocaleString()})` : 'Transaction Deletion',
          reason: targetTx
            ? `Transaction deletion requested (${isOld ? 'older than 7 days' : 'authorization required'}): ${targetTx.category} - ${targetTx.description || 'No notes'}`
            : 'Transaction deletion authorization requested'
        });
        setConfirmDeleteTxId(null);
        setActiveTxDetail(null);
        return;
      }

      if (onDeleteTransaction) {
        onDeleteTransaction(confirmDeleteTxId);
      }
      setConfirmDeleteTxId(null);
      setActiveTxDetail(null);
    }
  };

  type LedgerItem =
    | { kind: 'TX'; id: string; date: string; time: number; tx: Transaction }
    | { kind: 'TRANSFER'; id: string; date: string; time: number; transfer: Transfer }
    | { kind: 'CREDIT_SALE'; id: string; date: string; time: number; receivable: Receivable };

  // Consolidate any sibling split Equb entries into unified entries with total amount and split breakdowns
  const consolidatedTransactions = React.useMemo(() => {
    return consolidateEqubSplitTransactions(transactions, wallets);
  }, [transactions, wallets]);

  const allLedgerItems: LedgerItem[] = React.useMemo(() => {
    const list: LedgerItem[] = [];
    consolidatedTransactions.forEach(tx => {
      const timeVal = new Date(tx.date).getTime();
      list.push({
        kind: 'TX',
        id: tx.id,
        date: tx.date,
        time: isNaN(timeVal) ? 0 : timeVal,
        tx
      });
    });
    (transfers || []).forEach(tr => {
      const timeVal = new Date(tr.date).getTime();
      list.push({
        kind: 'TRANSFER',
        id: tr.id,
        date: tr.date,
        time: isNaN(timeVal) ? 0 : timeVal,
        transfer: tr
      });
    });
    (receivables || []).forEach(rcv => {
      const timeVal = new Date(rcv.createdDate || rcv.dueDate || 0).getTime();
      list.push({
        kind: 'CREDIT_SALE',
        id: rcv.id,
        date: rcv.createdDate || rcv.dueDate || new Date().toISOString(),
        time: isNaN(timeVal) ? 0 : timeVal,
        receivable: rcv
      });
    });
    return list.sort((a, b) => {
      if (b.time !== a.time) return b.time - a.time;
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [consolidatedTransactions, transfers, receivables]);

  // Filter ledger items (strictly sorted latest first - all transactions always visible)
  const filtered = allLedgerItems.filter((item) => {

    if (item.kind === 'TX') {
      const tx = item.tx;
      if (selectedScope === 'PERSONAL') {
        if (tx.type !== 'EXPENSE' || tx.expenseScope !== 'PERSONAL') return false;
      } else if (selectedScope === 'BUSINESS') {
        if (tx.type === 'EXPENSE' && tx.expenseScope === 'PERSONAL') return false;
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchDesc = (tx.description || '').toLowerCase().includes(q);
        const matchCat = (tx.category || '').toLowerCase().includes(q);
        const matchCreator = (tx.creatorName || '').toLowerCase().includes(q);
        const matchNotes = (tx.notes || '').toLowerCase().includes(q);
        const matchId = (tx.id || '').toLowerCase().includes(q);
        const matchAmount = (tx.amount?.toString() || '').includes(q);
        const targetW = wallets.find(w => w.id === tx.walletId);
        const matchWallet = (targetW?.name || '').toLowerCase().includes(q) || (targetW?.accountNumber || '').toLowerCase().includes(q);
        const matchSplits = (tx.splits || []).some(s => {
          const sw = wallets.find(w => w.id === s.walletId);
          return (sw?.name || '').toLowerCase().includes(q) || (sw?.accountNumber || '').toLowerCase().includes(q) || (s.amount?.toString() || '').includes(q);
        });
        if (!matchDesc && !matchCat && !matchCreator && !matchNotes && !matchId && !matchAmount && !matchWallet && !matchSplits) return false;
      }
      if (selectedWalletId !== 'ALL' && tx.walletId !== selectedWalletId) {
        if (!tx.splits || !tx.splits.some(s => s.walletId === selectedWalletId)) {
          return false;
        }
      }
      if (selectedCategory !== 'ALL' && tx.category !== selectedCategory) return false;
      if (selectedType === 'CREDIT_SALE') return false;
      if (selectedType === 'INCOME' && tx.type !== 'INCOME') return false;
      if (selectedType === 'EXPENSE' && tx.type !== 'EXPENSE') return false;
      if (selectedType === 'LOAN') {
        const isLoan = tx.refType === 'LOAN' ||
          tx.category === 'Loans Received' ||
          tx.category === 'Loan Repayments' ||
          /loan/i.test(tx.description || '') ||
          /loan/i.test(tx.category || '');
        if (!isLoan) return false;
      }
      if (selectedType === 'EQUB') {
        const isEqub = tx.refType === 'EQUB' ||
          tx.category === 'Equb Contribution' ||
          tx.category === 'Equb Payout' ||
          isEqubContributionTransaction(tx) ||
          /e?kub/i.test(tx.description || '') ||
          /e?kub/i.test(tx.category || '');
        if (!isEqub) return false;
      }
      return true;
    } else if (item.kind === 'TRANSFER') {
      if (selectedScope === 'PERSONAL') return false;
      const tr = item.transfer;
      if (selectedType !== 'ALL') return false;
      if (selectedCategory !== 'ALL') return false;
      if (selectedWalletId !== 'ALL' && tr.fromWalletId !== selectedWalletId && tr.toWalletId !== selectedWalletId) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const fromW = wallets.find(w => w.id === tr.fromWalletId);
        const toW = wallets.find(w => w.id === tr.toWalletId);
        const matchReason = (tr.reason || '').toLowerCase().includes(q);
        const matchFrom = (fromW?.name || '').toLowerCase().includes(q);
        const matchTo = (toW?.name || '').toLowerCase().includes(q);
        if (!matchReason && !matchFrom && !matchTo) return false;
      }
      return true;
    } else {
      if (selectedScope === 'PERSONAL') return false;
      const rcv = item.receivable;
      if (selectedType !== 'ALL' && selectedType !== 'CREDIT_SALE' && selectedType !== 'INCOME') return false;
      // In the main "ALL" or "INCOME" transactions feed, if a credit sale is already COLLECTED, the actual income cash transaction
      // is already present in the ledger. Showing the settled credit note alongside it makes it look like it was registered twice.
      // All credit sales (both active and settled) can be viewed under the "CREDIT SALES" tab.
      if ((selectedType === 'ALL' || selectedType === 'INCOME') && rcv.status === 'COLLECTED') return false;
      if (selectedWalletId !== 'ALL' && rcv.walletId !== selectedWalletId) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = (rcv.customerName || '').toLowerCase().includes(q);
        const matchDesc = (rcv.description || '').toLowerCase().includes(q);
        const matchPhone = (rcv.phone || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchPhone) return false;
      }
      return true;
    }
  }).sort((a, b) => {
    if (b.time !== a.time) return b.time - a.time;
    return (b.id || '').localeCompare(a.id || '');
  });

  // Comprehensive Ledger Totals: Business Work Done (Cash + Credit Receivables) vs Expenses
  const ledgerSummary = useMemo(() => {
    let totalCashIncome = 0;
    let totalExpense = 0;
    let totalCreditWork = 0;

    filtered.forEach(item => {
      if (item.kind === 'TX' && !item.tx.reversed) {
        if (item.tx.type === 'INCOME') {
          totalCashIncome += item.tx.amount;
        } else if (item.tx.type === 'EXPENSE') {
          totalExpense += item.tx.amount;
        }
      } else if (item.kind === 'CREDIT_SALE') {
        const rcv = item.receivable;
        const uncollected = Math.max(0, (rcv.amountOwed || 0) - (rcv.amountCollected || 0));
        const creditAmt = selectedType === 'CREDIT_SALE'
          ? (rcv.amountOwed || 0)
          : uncollected;
        totalCreditWork += creditAmt;
      }
    });

    const totalBusinessWork = totalCashIncome + totalCreditWork;
    const netBusinessBalance = totalBusinessWork - totalExpense;

    return {
      totalBusinessWork,
      totalCashIncome,
      totalCreditWork,
      totalExpense,
      netBusinessBalance
    };
  }, [filtered, selectedType]);

  // Interface for timeline date grouping (including non-working / 0-transaction days)
  interface LedgerDateGroup {
    dateKey: string;
    dateLabel: string;
    time: number;
    items: LedgerItem[];
    isInactive: boolean;
    isSpecialHoliday?: boolean;
    holidayTitle?: string;
    reminderNote?: string;
  }

  // Group by date, including non-working days with reminder notes when appropriate
  const ledgerDateGroups = useMemo<LedgerDateGroup[]>(() => {
    // Group existing filtered items by YYYY-MM-DD
    const mapByDateKey: Record<string, LedgerItem[]> = {};
    filtered.forEach(item => {
      const dKey = item.date ? item.date.slice(0, 10) : '';
      if (!dKey) return;
      if (!mapByDateKey[dKey]) mapByDateKey[dKey] = [];
      mapByDateKey[dKey].push(item);
    });

    // If user has entered a search query, show only active matching days
    if (searchTerm.trim()) {
      return Object.entries(mapByDateKey)
        .map(([dKey, items]) => {
          const noonIso = `${dKey}T12:00:00.000Z`;
          return {
            dateKey: dKey,
            dateLabel: formatDateByCalendar(noonIso, calendarType, true),
            time: items[0] ? items[0].time : new Date(noonIso).getTime(),
            items,
            isInactive: false
          };
        })
        .sort((a, b) => b.time - a.time);
    }

    // Determine start and end date range for the timeline
    const todayStr = new Date().toISOString().slice(0, 10);
    let maxDateStr = filtered[0]?.date ? filtered[0].date.slice(0, 10) : todayStr;
    if (todayStr > maxDateStr) maxDateStr = todayStr;
    let minDateStr = '2026-07-01';

    if (filtered.length > 0) {
      filtered.forEach(item => {
        const d = item.date ? item.date.slice(0, 10) : '';
        if (d && d > maxDateStr) maxDateStr = d;
        if (d && d < minDateStr) minDateStr = d;
      });
    }

    const groups: LedgerDateGroup[] = [];
    const curr = new Date(`${maxDateStr}T12:00:00.000Z`);
    const end = new Date(`${minDateStr}T12:00:00.000Z`);

    // Iterate backwards chronologically from newest date to oldest date
    while (curr >= end) {
      const dKey = curr.toISOString().slice(0, 10);
      const items = mapByDateKey[dKey] || [];
      const noonIso = `${dKey}T12:00:00.000Z`;
      const dateLabel = formatDateByCalendar(noonIso, calendarType, true);

      if (items.length > 0) {
        groups.push({
          dateKey: dKey,
          dateLabel,
          time: items[0]?.time || curr.getTime(),
          items,
          isInactive: false
        });
      } else if (showNonWorkingDays && selectedType === 'ALL' && selectedWalletId === 'ALL' && selectedCategory === 'ALL' && selectedScope === 'ALL') {
        // Date with NO transactions / Non-working day
        const isSepNewYear = dKey === '2026-09-10' || dKey === '2026-09-11' || dKey === '2026-09-12';
        const customNote = dayReminders[dKey];

        let holidayTitle: string | undefined;
        let reminderNote: string;

        if (isSepNewYear) {
          holidayTitle = 'Ethiopian New Year (Enkutatash: Pagumē 5 – Meskerem 2)';
          reminderNote = customNote || 'Business was closed for Ethiopian New Year holiday. 0 transactions were recorded; wallet balances and total amounts remain 100% accurate and unaffected.';
        } else if (customNote) {
          reminderNote = customNote;
        } else {
          reminderNote = 'No transactions recorded on this date. The shop was closed or inactive. 0 ETB inflow • 0 ETB outflow. Wallets and total balances remain unaffected.';
        }

        groups.push({
          dateKey: dKey,
          dateLabel,
          time: curr.getTime(),
          items: [],
          isInactive: true,
          isSpecialHoliday: isSepNewYear,
          holidayTitle,
          reminderNote
        });
      }

      // Step back 1 day
      curr.setDate(curr.getDate() - 1);
    }

    return groups;
  }, [filtered, calendarType, showNonWorkingDays, dayReminders, searchTerm, selectedType, selectedWalletId, selectedCategory, selectedScope]);

  // Compute all relative wallet running balances chronologically
  const allWalletRunningBalancesMap = React.useMemo(() => {
    return computeAllWalletRunningBalances(wallets, consolidatedTransactions, transfers);
  }, [consolidatedTransactions, transfers, wallets]);

  const handleConfirmReversal = (txId: string) => {
    triggerHaptic('warning');
    const targetTx = consolidatedTransactions.find(t => t.id === txId);
    
    // If current user is Partner/Viewer or non-SuperAdmin requesting reversal on locked tx
    if ((currentUser.role === 'Partner' || currentUser.role === 'Viewer') && onRequestApproval) {
      onRequestApproval({
        actionType: 'REVERSE_TRANSACTION',
        targetId: txId,
        targetTitle: targetTx ? `${targetTx.description || targetTx.category} (ETB ${targetTx.amount.toLocaleString()})` : 'Transaction Reversal',
        reason: targetTx ? `Transaction reversal requested: ${targetTx.category} - ${targetTx.description || 'No notes'}` : 'Transaction reversal authorization requested'
      });
      setConfirmReversalTxId(null);
      setActiveTxDetail(null);
      return;
    }

    onReverseTransaction(txId);
    setConfirmReversalTxId(null);
    setActiveTxDetail(null);
  };

  return (
    <div className="space-y-4 pb-24">
      
      {/* Title & Quick Export */}
      <div id="tour-transactions-header" data-tour="transactions-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-[#F0F4FF]">Financial Ledger</h2>
          <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-0.5">{filtered.length} entries recorded</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
          {onRefreshTransactions && (
            <button
              type="button"
              id="btn-update-transactions"
              onClick={() => {
                triggerHaptic('medium');
                setIsRefreshing(true);
                onRefreshTransactions();
                setTimeout(() => setIsRefreshing(false), 900);
              }}
              disabled={isRefreshing}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-75"
              title="Update and synchronize transactions with Cloud Ledger"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Updating...' : 'Update Transactions'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              const fullReportState: any = {
                currentUser,
                wallets,
                transactions,
                transfers,
                equbs,
                loans,
                assets,
                receivables,
                users,
                categories,
                recurring,
                goals: [],
                auditLogs: [],
                savedReports: [],
                hideBalances,
                calendarType
              };
              const filteredTxs = filtered.filter(item => item.kind === 'TX').map(item => (item as any).tx);
              generatePDFReport({
                state: fullReportState,
                transactions: filteredTxs,
                dateRangeLabel: 'Filtered Ledger View',
                reportTitle: 'Financial Ledger & Transaction Creator Report'
              });
            }}
            className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer transition-all active:scale-95"
            title="Download PDF Financial Report"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              const fullReportState: any = {
                currentUser,
                wallets,
                transactions,
                transfers,
                equbs,
                loans,
                assets,
                receivables,
                users,
                categories,
                recurring,
                goals: [],
                auditLogs: [],
                savedReports: [],
                hideBalances,
                calendarType
              };
              const filteredTxs = filtered.filter(item => item.kind === 'TX').map(item => (item as any).tx);
              generateAuditPDFReport({
                state: fullReportState,
                transactions: filteredTxs
              });
            }}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer transition-all active:scale-95"
            title="Download 13-Column Transaction, Loan, Equb & Receivable Audit PDF"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audit PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('heavy');
              const fullReportState: any = {
                currentUser,
                wallets,
                transactions,
                transfers,
                equbs,
                loans,
                assets,
                receivables,
                users,
                categories,
                recurring,
                goals: [],
                auditLogs: [],
                savedReports: [],
                hideBalances,
                calendarType
              };
              const filteredTxs = filtered.filter(item => item.kind === 'TX').map(item => (item as any).tx);
              generateExcelReport({
                state: fullReportState,
                transactions: filteredTxs,
                dateRangeLabel: 'Filtered Ledger View',
                reportTitle: 'Banking & Financial Reporting Package'
              });
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 dark:bg-[#00D4AA] text-white dark:text-[#0A0E1A] font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer hover:brightness-110 transition-all active:scale-95"
            title="Download Multi-Tab Excel Workbook (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export xlsx</span>
          </button>

          {onOpenHelp && (
            <button
              type="button"
              id="btn-page-help-transactions"
              onClick={() => {
                triggerHaptic('light');
                onOpenHelp();
              }}
              title="Ledger Help (?)"
              aria-label="Help"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1A2232] dark:hover:bg-[#222C40] border border-slate-200 dark:border-[#243046] text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            >
              <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </button>
          )}
        </div>
      </div>

      {/* Transaction & Business Work Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8899BB] text-[10px] font-bold uppercase tracking-wider">
            <span>Total Business Work</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00D4AA]" />
          </div>
          <p className="text-sm sm:text-base font-black font-mono text-emerald-600 dark:text-[#00D4AA] mt-1 truncate">
            {hideBalances ? '••••••' : formatETB(ledgerSummary.totalBusinessWork)}
          </p>
          <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-[#8899BB] mt-0.5 font-mono truncate">
            <span>Cash: {hideBalances ? '•••' : formatETB(ledgerSummary.totalCashIncome, true)}</span>
            <span>•</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">Credit: {hideBalances ? '•••' : formatETB(ledgerSummary.totalCreditWork, true)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#131926] border border-blue-200 dark:border-blue-900/40 rounded-xl p-3 shadow-2xs bg-blue-50/20 dark:bg-blue-950/10">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Credit Work</span>
            <FileCheck className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-sm sm:text-base font-black font-mono text-blue-600 dark:text-blue-400 mt-1 truncate">
            {hideBalances ? '••••••' : formatETB(ledgerSummary.totalCreditWork)}
          </p>
          <p className="text-[9px] text-blue-600/80 dark:text-blue-400/80 mt-0.5 truncate font-medium">
            Summed in work • Not in wallets
          </p>
        </div>

        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8899BB] text-[10px] font-bold uppercase tracking-wider">
            <span>Total Expense</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <p className="text-sm sm:text-base font-black font-mono text-rose-600 dark:text-rose-400 mt-1 truncate">
            {hideBalances ? '••••••' : formatETB(ledgerSummary.totalExpense)}
          </p>
          <p className="text-[9px] text-slate-400 mt-0.5 truncate">
            Operational Outflow
          </p>
        </div>

        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8899BB] text-[10px] font-bold uppercase tracking-wider">
            <span>Net Work Margin</span>
            <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className={`text-sm sm:text-base font-black font-mono mt-1 truncate ${
            ledgerSummary.netBusinessBalance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {hideBalances ? '••••••' : formatETB(ledgerSummary.netBusinessBalance)}
          </p>
          <p className="text-[9px] text-slate-400 mt-0.5 truncate">
            Production Balance
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div id="tour-split-payments" data-tour="split-payments" className="space-y-2">
        
        {/* Search Bar */}
        <div id="tour-transactions-search" data-tour="transactions-search" className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#8899BB] absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search transactions..."
            className="w-full bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] focus:border-emerald-500 dark:focus:border-[#00D4AA] rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-[#F0F4FF] outline-none transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-3 text-slate-400 dark:text-[#8899BB] hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div id="tour-transactions-filters" data-tour="transactions-filters" className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          
          {/* Type filter */}
          <div className="flex items-center bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-1 text-xs shrink-0">
            {[
              { id: 'ALL', label: 'ALL' },
              { id: 'INCOME', label: 'INCOME' },
              { id: 'EXPENSE', label: 'EXPENSE' },
              { id: 'LOAN', label: 'LOANS' },
              { id: 'EQUB', label: 'EKUB' },
              { id: 'CREDIT_SALE', label: 'CREDIT SALES' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedType(btn.id as any);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs ${
                  selectedType === btn.id
                    ? 'bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-[#0A0E1A]'
                    : 'text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Wallet Filter */}
          <select
            value={selectedWalletId}
            onChange={(e) => setSelectedWalletId(e.target.value)}
            className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-[#8899BB] outline-none shrink-0 cursor-pointer"
          >
            <option value="ALL">All Wallets</option>
            {wallets.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-[#8899BB] outline-none shrink-0 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Scope Filter: All vs Business vs Personal */}
          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value as any)}
            className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#8899BB] outline-none shrink-0 cursor-pointer"
          >
            <option value="ALL">All Scopes</option>
            <option value="BUSINESS">🏢 Business</option>
            <option value="PERSONAL">👤 Personal</option>
          </select>

          {/* Toggle Non-Working Days */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowNonWorkingDays(prev => !prev);
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              showNonWorkingDays
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 shadow-2xs'
                : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-[#1E2D40] text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
            }`}
            title="When active, displays non-working dates and days with no transactions with reminder notes"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-500" />
            <span>Non-Working Days</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
              showNonWorkingDays ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200' : 'bg-slate-100 dark:bg-[#1E2D40] text-slate-400'
            }`}>
              {showNonWorkingDays ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* Grouped Transactions List */}
      <div id="tour-transactions-list" data-tour="transactions-list" className="space-y-4">
        {ledgerDateGroups.length === 0 ? (
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-8 text-center text-slate-500 dark:text-[#8899BB] space-y-2 shadow-sm">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-[#8899BB]/50" />
            <p className="text-xs font-bold text-slate-800 dark:text-[#F0F4FF]">No matching ledger entries</p>
            <p className="text-[11px]">Try clearing search or filters to see all transactions.</p>
          </div>
        ) : (
          ledgerDateGroups.map((group) => {
          if (group.isInactive) {
            return (
              <div key={group.dateKey} className="space-y-1.5">
                {/* Inactive / Non-working date header */}
                <div className="flex items-center justify-between px-1 py-1">
                  <h3 className="text-[11px] font-bold text-slate-500 dark:text-[#8899BB] uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{group.dateLabel}</span>
                    {group.isSpecialHoliday ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <span>🎉</span>
                        <span>Holiday Closure</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-[#1E2D40] text-slate-500 dark:text-[#8899BB] border border-slate-200 dark:border-[#2A3B54]">
                        No Activity
                      </span>
                    )}
                  </h3>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDayNoteModal(group.dateKey, group.dateLabel)}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium px-1.5 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer transition-colors"
                      title="Add or edit reason / reminder for this non-working day"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{dayReminders[group.dateKey] ? 'Edit Note' : 'Add Note'}</span>
                    </button>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      0 Txns
                    </span>
                  </div>
                </div>

                {/* Reminder card */}
                <div className={`rounded-2xl p-3.5 border transition-all ${
                  group.isSpecialHoliday
                    ? 'bg-amber-500/5 dark:bg-amber-950/15 border-amber-500/25 dark:border-amber-500/30'
                    : 'bg-slate-50/70 dark:bg-[#131926]/50 border-slate-200/80 dark:border-[#1E2D40]'
                }`}>
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base shadow-2xs ${
                        group.isSpecialHoliday
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-200/70 dark:bg-[#1C2333] text-slate-500 dark:text-slate-400'
                      }`}>
                        {group.isSpecialHoliday ? '🎉' : <Moon className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <span>{group.holidayTitle || (dayReminders[group.dateKey] ? 'Operational Note' : 'No Transactions Recorded')}</span>
                          {dayReminders[group.dateKey] && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-medium">
                              Saved Note
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#8899BB] mt-0.5 leading-relaxed">
                          {group.reminderNote}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 block">
                        0.00 ETB
                      </span>
                      <span className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider">
                        No Movement
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const sortedItemList = [...group.items].sort((a, b) => b.time - a.time);

          // Calculate daily total income (cash + credit receivables created) and expense
          const dayTxIncome = sortedItemList
            .filter(i => i.kind === 'TX' && !i.tx.reversed && i.tx.type === 'INCOME')
            .reduce((sum, i) => sum + (i.kind === 'TX' ? i.tx.amount : 0), 0);

          const dayCreditWork = sortedItemList
            .filter(i => i.kind === 'CREDIT_SALE')
            .reduce((sum, i) => {
              if (i.kind !== 'CREDIT_SALE') return sum;
              return sum + (i.receivable.amountOwed || 0);
            }, 0);

          const dayIncome = dayTxIncome + dayCreditWork;

          const dayExpense = sortedItemList
            .filter(i => i.kind === 'TX' && !i.tx.reversed && i.tx.type === 'EXPENSE')
            .reduce((sum, i) => sum + (i.kind === 'TX' ? i.tx.amount : 0), 0);

          return (
            <div key={group.dateKey} className="space-y-1.5">
              {/* Date Group Header with Daily Total Income & Expense */}
              <div className="flex items-center justify-between px-1 py-1">
                <h3 className="text-[11px] font-bold text-slate-500 dark:text-[#8899BB] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00D4AA]" />
                  <span>{group.dateLabel}</span>
                </h3>

                <div className="flex items-center gap-2 text-[10px] font-mono font-bold flex-wrap justify-end">
                  {dayIncome > 0 && (
                    <span
                      title={dayCreditWork > 0 ? `Cash Income: ${formatETB(dayTxIncome)} | Credit Work: ${formatETB(dayCreditWork)} (Not in wallets)` : 'Daily Business Income'}
                      className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1.5"
                    >
                      <span>+{hideBalances ? '••••' : formatETB(dayIncome, true)}</span>
                      {dayCreditWork > 0 && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-sans font-extrabold">
                          incl. {formatETB(dayCreditWork, true)} credit
                        </span>
                      )}
                    </span>
                  )}
                  {dayExpense > 0 && (
                    <span className="text-rose-700 dark:text-red-400 bg-rose-50 dark:bg-red-500/10 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-red-500/20">
                      -{hideBalances ? '••••' : formatETB(dayExpense, true)}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-[#1E2D40] rounded-2xl divide-y divide-slate-100 dark:divide-[#1E2D40] overflow-hidden shadow-sm">
                {sortedItemList.map((item) => {
                    if (item.kind === 'CREDIT_SALE') {
                      const rcv = item.receivable;
                      const isSettled = rcv.status === 'COLLECTED';
                      const isOverdue = rcv.status === 'OVERDUE' || (rcv.status === 'OUTSTANDING' && new Date(rcv.dueDate).getTime() < Date.now());
                      const remaining = Math.max(0, rcv.amountOwed - (rcv.amountCollected || 0));
                      const creditTargetWallet = wallets.find(w => w.id === rcv.walletId);

                      return (
                        <div
                          key={rcv.id}
                          onClick={() => {
                            triggerHaptic('light');
                            setActiveCreditSaleDetail(rcv);
                          }}
                          className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                            isSettled
                              ? 'bg-purple-50/40 dark:bg-purple-950/25 hover:bg-purple-50/70 dark:hover:bg-purple-950/40 border-l-4 border-l-purple-600 dark:border-l-purple-400'
                              : 'bg-blue-50/25 dark:bg-blue-950/10 hover:bg-blue-50/70 dark:hover:bg-blue-950/25 border-l-2 border-l-blue-500 dark:border-l-blue-400'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isSettled
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
                            }`}>
                              <FileCheck className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-bold text-slate-900 dark:text-[#F0F4FF] line-clamp-1">
                                  {rcv.customerName}
                                </p>
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                  isSettled
                                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-500/30'
                                    : 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                                }`}>
                                  Sale on Credit
                                </span>
                                {isSettled ? (
                                  <span className="text-[9px] bg-purple-600 text-white dark:bg-purple-500/30 dark:text-purple-300 font-extrabold px-1.5 py-0.2 rounded border border-purple-600 dark:border-purple-400/40 shrink-0 flex items-center gap-0.5">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Collected
                                  </span>
                                ) : isOverdue ? (
                                  <span className="text-[9px] bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 font-bold px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-500/30 shrink-0">
                                    Overdue
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-500/30 shrink-0">
                                    Pending Collection
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-[#8899BB] flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span>{rcv.description || 'Credit Sale'}</span>
                                {rcv.phone && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono">{rcv.phone}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span className={isSettled ? "text-purple-600 dark:text-purple-400 font-medium" : "text-blue-600 dark:text-blue-400 font-medium"}>
                                  Due: {formatDateByCalendar(rcv.dueDate, calendarType, true)}
                                </span>
                                <span>•</span>
                                <span className="text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-[#1C2333] px-1.5 py-0.2 rounded">
                                  💼 Wallet: {creditTargetWallet?.name || (wallets.find(w => w.isDefault)?.name || wallets[0]?.name || 'Main Cash Drawer')}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 ml-2">
                            <p className={`text-xs font-bold font-mono ${
                              isSettled ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {hideBalances ? '••••••' : formatETB(rcv.amountOwed)}
                            </p>

                            <div className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono mt-0.5 flex items-center justify-end gap-1">
                              {isSettled ? (
                                <span className="text-purple-600 dark:text-purple-400 font-bold text-[9px] flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Fully Collected
                                </span>
                              ) : rcv.amountCollected > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 text-[9px]">
                                  Rem: {hideBalances ? '••••' : formatETB(remaining)}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 text-[9px]">Uncollected Credit</span>
                              )}
                            </div>

                            <p className="text-[9px] text-slate-400 dark:text-[#8899BB]/70 mt-0.5">
                              {new Date(rcv.createdDate || rcv.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (item.kind === 'TRANSFER') {
                      const tr = item.transfer;
                      const relTransfer = getRelativeWalletBalancesForTransfer(
                        tr,
                        wallets,
                        allWalletRunningBalancesMap[tr.id]
                      );

                      return (
                        <div
                          key={tr.id}
                          className="p-3.5 flex items-center justify-between bg-blue-50/30 dark:bg-blue-950/10 hover:bg-blue-50/70 dark:hover:bg-blue-950/20 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 flex items-center justify-center shrink-0">
                              <ArrowRightLeft className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-900 dark:text-[#F0F4FF] line-clamp-1">
                                  {tr.reason || 'Inter-Wallet Transfer'}
                                </p>
                                <span className="text-[9px] bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 font-bold px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-500/30 shrink-0">
                                  Transfer
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-[#8899BB] flex items-center gap-1 mt-0.5 flex-wrap font-mono">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{relTransfer.fromWalletName}</span>
                                <span>→</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{relTransfer.toWalletName}</span>
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 ml-2">
                            <p className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
                              {hideBalances ? '••••••' : formatETB(tr.amount)}
                            </p>

                            {/* Source & Destination wallet balances after transfer */}
                            <div className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono mt-0.5 flex flex-wrap items-center justify-end gap-1">
                              <span className="flex items-center gap-0.5">
                                <span className="text-[9px] text-slate-400 dark:text-[#8899BB]/70">{relTransfer.fromWalletName}:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {hideBalances ? '••••••' : formatETB(relTransfer.fromBalance)}
                                </span>
                              </span>
                              <span className="text-slate-400 dark:text-slate-600 font-sans mx-0.5">|</span>
                              <span className="flex items-center gap-0.5">
                                <span className="text-[9px] text-slate-400 dark:text-[#8899BB]/70">{relTransfer.toWalletName}:</span>
                                <span className="font-semibold text-emerald-600 dark:text-[#00D4AA]">
                                  {hideBalances ? '••••••' : formatETB(relTransfer.toBalance)}
                                </span>
                              </span>
                            </div>

                            <p className="text-[9px] text-slate-400 dark:text-[#8899BB]/70 mt-0.5">
                              {new Date(tr.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const tx = item.tx;
                    const wallet = wallets.find(w => w.id === tx.walletId);
                    const isIncome = tx.type === 'INCOME';
                    const isCreditCollected = isCreditSaleCollected(tx);
                    const relWalletInfos = getRelativeWalletBalancesForTx(
                      tx,
                      wallets,
                      allWalletRunningBalancesMap[tx.id]
                    );

                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          triggerHaptic('light');
                          setActiveTxDetail(tx);
                        }}
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                          tx.reversed
                            ? 'opacity-50 line-through hover:bg-slate-50 dark:hover:bg-[#1C2333]/70'
                            : isCreditCollected
                            ? 'bg-purple-50/30 dark:bg-purple-950/20 hover:bg-purple-50/60 dark:hover:bg-purple-950/35 border-l-4 border-l-purple-600 dark:border-l-purple-400'
                            : 'hover:bg-slate-50 dark:hover:bg-[#1C2333]/70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isCreditCollected
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                              : isIncome
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-red-500/15 dark:text-red-400'
                          }`}>
                            {isCreditCollected ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : isIncome ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-slate-900 dark:text-[#F0F4FF] line-clamp-1">{getTransactionDisplayTitle(tx, receivables)}</p>
                              {tx.source === 'auto_sms_confirmation' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 flex items-center gap-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30">
                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>SMS Confirmed ({tx.provider?.toUpperCase()})</span>
                                  {tx.entries && tx.entries.length > 0 && (
                                    <span className="ml-0.5 font-mono text-[8px] bg-emerald-200/70 dark:bg-emerald-800/60 px-1 rounded-full">{tx.entries.length}</span>
                                  )}
                                </span>
                              )}
                              {tx.type === 'EXPENSE' && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 flex items-center gap-0.5 ${
                                  tx.expenseScope === 'PERSONAL'
                                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                                    : 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                                }`}>
                                  {tx.expenseScope === 'PERSONAL' ? '👤 Personal' : '🏢 Business'}
                                </span>
                              )}
                              {isCreditCollected && (
                                <span className="text-[9px] bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 px-1.5 py-0.2 rounded flex items-center gap-0.5 shrink-0 font-bold">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Daily Income / Collected
                                </span>
                              )}
                              {(tx.refType === 'LOAN' || tx.category === 'Loans Received' || tx.category === 'Loan Repayments' || /loan/i.test(tx.description || '')) && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 flex items-center gap-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30">
                                  <span>🤝 Loan</span>
                                </span>
                              )}
                              {(tx.refType === 'EQUB' || tx.category === 'Equb Contribution' || tx.category === 'Equb Payout' || isEqubContributionTransaction(tx) || /e?kub/i.test(tx.description || '')) && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 flex items-center gap-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-500/30">
                                  <span>👥 Ekub</span>
                                </span>
                              )}
                              {tx.category === 'Rent' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 flex items-center gap-0.5 bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/30">
                                  <span>🏠 Rent</span>
                                </span>
                              )}
                              {tx.category === 'Bad Debt' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 flex items-center gap-0.5 bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/30">
                                  <span>⚠️ Bad Debt Write-off</span>
                                </span>
                              )}
                              {!isTransactionEditable(tx.date) && !tx.reversed && currentUser.role !== 'SuperAdmin' && currentUser.role !== 'Admin' && (
                                <span title="Can't be edited: older than 1 week" className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-1.5 py-0.2 rounded flex items-center gap-0.5 shrink-0 font-medium">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span className="hidden xs:inline">Locked</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-[#8899BB] flex items-center gap-1 mt-0.5 flex-wrap">
                              <span className={isCreditCollected ? "text-purple-700 dark:text-purple-300 font-medium" : ""}>{tx.category}</span>
                              <span>•</span>
                              {tx.splits && tx.splits.length > 1 ? (
                                <span className="text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800/40 text-[9px]">
                                  Split ({tx.splits.length} Wallets)
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 font-mono font-medium ${isCreditCollected ? "text-purple-700 dark:text-purple-400" : "text-emerald-700 dark:text-[#00D4AA]"}`}>
                                  <span>{getWalletNickname(wallet?.name)}</span>
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-2">
                          <p className={`text-xs font-bold font-mono ${
                            isCreditCollected
                              ? 'text-purple-600 dark:text-purple-400 font-black'
                              : isIncome
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-red-400'
                          }`}>
                            {isIncome ? '+' : '-'}{hideBalances ? '••••••' : formatETB(Math.abs(
                              (tx.splits && tx.splits.length > 1)
                                ? tx.splits.reduce((sum, s) => sum + Math.abs(s.amount), 0)
                                : tx.amount
                            ))}
                          </p>

                          {/* Relative wallet balance(s) after transaction */}
                          <div className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono mt-0.5 flex flex-wrap items-center justify-end gap-1">
                            {relWalletInfos.map((relInfo, idx) => (
                              <span key={relInfo.walletId} className="flex items-center gap-0.5">
                                {idx > 0 && <span className="text-slate-400 dark:text-slate-600 font-sans mx-0.5">|</span>}
                                <span className="text-[9px] text-slate-400 dark:text-[#8899BB]/70">{relInfo.walletName}:</span>
                                <span className="font-semibold text-emerald-600 dark:text-[#00D4AA]">
                                  {hideBalances ? '••••••' : formatETB(relInfo.balance)}
                                </span>
                              </span>
                            ))}
                          </div>

                          <p className="text-[9px] text-slate-400 dark:text-[#8899BB]/70 mt-0.5">
                            {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Transaction Detail Sheet Modal */}
      {activeTxDetail && (() => {
        const isSuperAdmin = currentUser.role === 'SuperAdmin';
        const isAdmin = currentUser.role === 'Admin';
        const isPrivileged = isSuperAdmin || isAdmin;
        const activeOtherUsers = (users || []).filter(u => u.id !== currentUser.id && u.active !== false);
        const hasOtherUsers = activeOtherUsers.length > 0;
        const isWithin7Days = isTransactionEditable(activeTxDetail.date);
        const canDirectEdit = (isPrivileged || isWithin7Days || !hasOtherUsers) && !activeTxDetail.reversed;
        const isDetailCreditCollected = isCreditSaleCollected(activeTxDetail);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
            <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 text-slate-900 dark:text-[#F0F4FF] shadow-xl animate-slideUp">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1E2D40]">
                <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <span>Ledger Entry Audit</span>
                  {activeTxDetail.reversed ? (
                    <span className="text-[9px] bg-rose-100 text-rose-800 dark:bg-red-500/20 dark:text-red-400 border border-rose-200 dark:border-red-500/30 px-2 py-0.5 rounded-full font-bold">Reversed</span>
                  ) : canDirectEdit ? (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Direct Edit Enabled
                    </span>
                  ) : (
                    <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> 2-User Approval Protocol
                    </span>
                  )}
                </h3>
                <button onClick={() => setActiveTxDetail(null)} className="p-1 rounded-lg bg-slate-100 dark:bg-[#1C2333] text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className={`text-center py-3 rounded-2xl border relative ${
                  isDetailCreditCollected
                    ? 'bg-purple-50/40 dark:bg-purple-950/25 border-purple-200 dark:border-purple-800/50'
                    : 'bg-slate-50 dark:bg-[#0A0E1A] border-slate-200 dark:border-[#1E2D40]'
                }`}>
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    <p className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono uppercase">{activeTxDetail.type}</p>
                    {isDetailCreditCollected && (
                      <span className="text-[9px] bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 font-bold px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-500/30 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Daily Income / Collected
                      </span>
                    )}
                  </div>
                  <p className={`text-2xl font-black font-mono ${
                    isDetailCreditCollected
                      ? 'text-purple-600 dark:text-purple-400'
                      : activeTxDetail.type === 'INCOME'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-red-400'
                  }`}>
                    {activeTxDetail.type === 'INCOME' ? '+' : '-'}{formatETB(Math.abs(
                      (activeTxDetail.splits && activeTxDetail.splits.length > 1)
                        ? activeTxDetail.splits.reduce((sum, s) => sum + Math.abs(s.amount), 0)
                        : activeTxDetail.amount
                    ))}
                  </p>
                  <p className="text-xs text-slate-800 dark:text-[#F0F4FF] font-medium mt-1">{getTransactionDisplayTitle(activeTxDetail, receivables)}</p>
                </div>

                {/* Combined Split Wallet Breakdown */}
                {activeTxDetail.splits && activeTxDetail.splits.length > 1 && (() => {
                  const splitsTotal = activeTxDetail.splits.reduce((sum, s) => sum + Math.abs(s.amount), 0) || activeTxDetail.amount;
                  return (
                    <div className="bg-purple-50/70 dark:bg-[#1A182E] border border-purple-200 dark:border-purple-800/60 rounded-2xl p-3.5 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              Split Wallet Payment
                            </h4>
                            <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">
                              Multi-source deduction across {activeTxDetail.splits.length} funding wallets
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-700/50">
                          {activeTxDetail.splits.length} Wallets
                        </span>
                      </div>

                      {/* Proportional Split Bar */}
                      <div className="space-y-1">
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner">
                          {activeTxDetail.splits.map((s, idx) => {
                            const pct = Math.max(2, Math.round((Math.abs(s.amount) / Math.max(1, splitsTotal)) * 100));
                            const barColors = ['bg-purple-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                            return (
                              <div
                                key={idx}
                                style={{ width: `${pct}%` }}
                                className={`${barColors[idx % barColors.length]} h-full transition-all`}
                                title={`${getWalletNickname(wallets.find(w => w.id === s.walletId)?.name)}: ${pct}%`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Split Breakdown Rows */}
                      <div className="space-y-1.5">
                        {activeTxDetail.splits.map((s, idx) => {
                          const w = wallets.find(wal => wal.id === s.walletId);
                          const pct = Math.round((Math.abs(s.amount) / Math.max(1, splitsTotal)) * 100);
                          const dotColors = ['bg-purple-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                          return (
                            <div
                              key={s.walletId || idx}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#131926] border border-purple-100 dark:border-[#1E2D40] text-xs shadow-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${dotColors[idx % dotColors.length]} shrink-0`} />
                                <div>
                                  <p className="font-bold text-slate-900 dark:text-white leading-tight">
                                    {w ? w.name : 'Funding Wallet'}
                                  </p>
                                  <p className="text-[10px] text-slate-500 dark:text-[#8899BB] flex items-center gap-1">
                                    <span>{w?.type || 'Account'}</span>
                                    <span>•</span>
                                    <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">{pct}% contribution</span>
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-extrabold text-rose-600 dark:text-red-400">
                                  -{formatETB(Math.abs(s.amount))}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-purple-200/70 dark:border-purple-800/50 text-xs font-mono">
                        <span className="text-slate-600 dark:text-[#8899BB] font-medium">Combined Payment Total:</span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {formatETB(splitsTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Status Notice about Edit Rule */}
                {!isWithin7Days && hasOtherUsers && !activeTxDetail.reversed && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl flex items-start gap-2">
                    <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Past 7-Day Window (Approval Required)</p>
                      <p className="text-[10px] text-slate-600 dark:text-[#8899BB]">
                        Because other users exist and this entry is older than 7 days, modifications or deletions will generate an approval request for review.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 dark:bg-[#1C2333] p-2.5 rounded-xl border border-slate-100 dark:border-transparent">
                    <span className="text-[10px] text-slate-500 dark:text-[#8899BB]">Wallet Channel</span>
                    <p className="font-bold text-emerald-700 dark:text-[#00D4AA] mt-0.5">
                      {activeTxDetail.splits && activeTxDetail.splits.length > 1
                        ? `Split Payment (${activeTxDetail.splits.length} Wallets)`
                        : getWalletNickname(wallets.find(w => w.id === activeTxDetail.walletId)?.name)}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#1C2333] p-2.5 rounded-xl border border-slate-100 dark:border-transparent">
                    <span className="text-[10px] text-slate-500 dark:text-[#8899BB]">Category</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5">{activeTxDetail.category}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#1C2333] p-2.5 rounded-xl border border-slate-100 dark:border-transparent">
                    <span className="text-[10px] text-slate-500 dark:text-[#8899BB]">Posted By Partner</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5">{activeTxDetail.creatorName}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#1C2333] p-2.5 rounded-xl border border-slate-100 dark:border-transparent">
                    <span className="text-[10px] text-slate-500 dark:text-[#8899BB]">Branch Location</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5">{activeTxDetail.branch}</p>
                  </div>
                  {activeTxDetail.type === 'EXPENSE' && (
                    <div className="bg-slate-50 dark:bg-[#1C2333] p-2.5 rounded-xl border border-slate-100 dark:border-transparent sm:col-span-2 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 dark:text-[#8899BB]">Expense Scope</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        activeTxDetail.expenseScope === 'PERSONAL'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                      }`}>
                        {activeTxDetail.expenseScope === 'PERSONAL' ? <User className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                        <span>{activeTxDetail.expenseScope === 'PERSONAL' ? 'Personal Expense' : 'Business Expense'}</span>
                      </span>
                    </div>
                  )}
                  {activeTxDetail.source === 'auto_sms_confirmation' && (
                    <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 sm:col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Official Bank SMS Confirmed ({activeTxDetail.provider?.toUpperCase()})</span>
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                          Daily Aggregation Active
                        </span>
                      </div>
                      {activeTxDetail.entries && activeTxDetail.entries.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <p className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] uppercase tracking-wider">
                            Daily Verified Transactions ({activeTxDetail.entries.length})
                          </p>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                            {activeTxDetail.entries.map((entry, idx) => (
                              <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] text-[11px]">
                                <div className="min-w-0 pr-2">
                                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                                    Ref: {entry.reference}
                                  </div>
                                  {entry.payerName && (
                                    <div className="text-[9px] text-slate-500 dark:text-[#8899BB] truncate">
                                      Payer: {entry.payerName}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-bold text-emerald-600 dark:text-[#00D4AA]">
                                    +{formatETB(entry.amount)}
                                  </span>
                                  <div className="text-[9px] text-slate-400">
                                    {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Post-Transaction Relative Wallet Balances */}
                <div className="bg-emerald-50 dark:bg-[#1C2333] p-3 rounded-xl border border-emerald-200 dark:border-[#00D4AA]/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-[#8899BB] uppercase tracking-wider">
                      {activeTxDetail.splits && activeTxDetail.splits.length > 1
                        ? 'Split Wallet Balances After Transaction'
                        : `${getWalletNickname(wallets.find(w => w.id === activeTxDetail.walletId)?.name)} Balance After Transaction`}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono">
                      {formatDateByCalendar(activeTxDetail.date, calendarType, true)}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-0.5">
                    {getRelativeWalletBalancesForTx(
                      activeTxDetail,
                      wallets,
                      allWalletRunningBalancesMap[activeTxDetail.id]
                    ).map(rel => (
                      <div key={rel.walletId} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-[#1E2D40] text-xs">
                        <div className="flex items-center gap-1.5">
                          <WalletIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00D4AA]" />
                          <span className="font-bold text-slate-900 dark:text-white">{rel.walletName}</span>
                          {rel.amount !== undefined && activeTxDetail.splits && activeTxDetail.splits.length > 1 && (
                            <span className={`text-[10px] font-mono font-bold ${activeTxDetail.type === 'INCOME' ? 'text-emerald-600 dark:text-[#00D4AA]' : 'text-rose-600 dark:text-rose-400'}`}>
                              ({activeTxDetail.type === 'INCOME' ? '+' : '-'}{formatETB(rel.amount)})
                            </span>
                          )}
                        </div>
                        <span className="font-bold font-mono text-emerald-700 dark:text-[#00D4AA]">
                          {hideBalances ? '••••••' : formatETB(rel.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons: Edit & Delete */}
                <div className="space-y-2 pt-1">
                  {!activeTxDetail.reversed && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleOpenEdit(activeTxDetail)}
                        className="py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-[#00D4AA]/15 border border-emerald-200 dark:border-[#00D4AA]/40 dark:text-[#00D4AA] hover:bg-emerald-100 dark:hover:bg-[#00D4AA]/25 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{canDirectEdit ? 'Edit Details' : 'Request Edit'}</span>
                      </button>

                      <button
                        onClick={() => setConfirmDeleteTxId(activeTxDetail.id)}
                        className="py-2.5 px-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-red-500/15 border border-rose-200 dark:border-red-500/30 dark:text-red-400 hover:bg-rose-100 dark:hover:bg-red-500/25 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{canDirectEdit ? 'Delete Entry' : 'Request Delete'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Credit Sale Detail Sheet Modal */}
      {activeCreditSaleDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 text-slate-900 dark:text-[#F0F4FF] shadow-xl animate-slideUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1E2D40]">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Credit Sale Entry Audit</span>
              </h3>
              <button
                onClick={() => setActiveCreditSaleDetail(null)}
                className="p-1 rounded-lg bg-slate-100 dark:bg-[#1C2333] text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="text-center py-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800/40 relative">
                <p className="text-[10px] text-blue-600 dark:text-blue-300 font-mono uppercase font-bold">SALE ON CREDIT</p>
                <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                  {formatETB(activeCreditSaleDetail.amountOwed)}
                </p>
                <p className="text-xs text-slate-800 dark:text-[#F0F4FF] font-medium mt-1">
                  Customer: <strong>{activeCreditSaleDetail.customerName}</strong>
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#8899BB]">Ledger Classification:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">Receivable / Customer Credit</span>
                </div>
                <div className="flex justify-between items-center bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-xl border border-blue-200/50 dark:border-blue-900/40">
                  <span className="text-slate-600 dark:text-[#8899BB] flex items-center gap-1.5 font-medium">
                    <WalletIcon className="w-3.5 h-3.5 text-blue-500" />
                    {activeCreditSaleDetail.status === 'COLLECTED' ? 'Collected Deposit Wallet:' : 'Settlement Destination:'}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    {(() => {
                      if (activeCreditSaleDetail.status === 'COLLECTED' && activeCreditSaleDetail.walletId) {
                        const tw = wallets.find(w => w.id === activeCreditSaleDetail.walletId);
                        return (
                          <>
                            <span>{tw ? tw.name : 'Wallet'}</span>
                            {tw?.type && (
                              <span className="text-[10px] text-slate-500 font-normal">
                                ({tw.type})
                              </span>
                            )}
                          </>
                        );
                      }
                      return <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Selected on Collection</span>;
                    })()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#8899BB]">Wallet Cash Impact:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">ETB 0.00 (Uncollected)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#8899BB]">Registration Date:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {formatDateByCalendar(activeCreditSaleDetail.createdDate, calendarType, true)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#8899BB]">Payment Due Date:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                    {formatDateByCalendar(activeCreditSaleDetail.dueDate, calendarType, true)}
                  </span>
                </div>
                {activeCreditSaleDetail.phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-[#8899BB]">Customer Phone:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{activeCreditSaleDetail.phone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#8899BB]">Collected So Far:</span>
                  <span className="font-mono text-emerald-600 dark:text-[#00D4AA] font-bold">
                    {formatETB(activeCreditSaleDetail.amountCollected || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#8899BB]">Remaining Debt:</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                    {formatETB(Math.max(0, activeCreditSaleDetail.amountOwed - (activeCreditSaleDetail.amountCollected || 0)))}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200/80 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-blue-200">
                💡 <strong>Cash flow safety:</strong> Funds will be credited directly to <strong>{wallets.find(w => w.id === activeCreditSaleDetail.walletId)?.name || 'the collection wallet'}</strong> when collected in <strong>More &gt; Receivables</strong>.
              </div>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveCreditSaleDetail(null);
                    onNavigateTab('more', 'RECEIVABLES');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Open Receivables Hub to Collect</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#00D4AA]/40 max-w-md w-full max-h-[90vh] overflow-y-auto p-5 rounded-2xl text-slate-900 dark:text-[#F0F4FF] space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-600 dark:text-[#00D4AA]" />
                <span>Edit Transaction Entry</span>
                {isSplitMode && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Split ({editSplitRows.length})
                  </span>
                )}
              </h4>
              <button onClick={() => setEditingTx(null)} className="p-1 rounded-lg bg-slate-100 dark:bg-[#1C2333] text-slate-500 dark:text-[#8899BB] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              {/* Type Switcher */}
              <div>
                <label className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono block mb-1">TRANSACTION TYPE</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, type: 'INCOME' }))}
                    className={`py-2 rounded-xl font-bold text-xs border cursor-pointer ${
                      editForm.type === 'INCOME'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:border-emerald-500 dark:text-emerald-400'
                        : 'bg-slate-50 border-slate-200 dark:bg-[#1C2333] dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB]'
                    }`}
                  >
                    + Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, type: 'EXPENSE' }))}
                    className={`py-2 rounded-xl font-bold text-xs border cursor-pointer ${
                      editForm.type === 'EXPENSE'
                        ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-red-500/20 dark:border-red-500 dark:text-red-400'
                        : 'bg-slate-50 border-slate-200 dark:bg-[#1C2333] dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB]'
                    }`}
                  >
                    - Expense
                  </button>
                </div>
              </div>

              {/* Expense Scope Switcher for Expense editing */}
              {editForm.type === 'EXPENSE' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono block">EXPENSE CLASSIFICATION</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, expenseScope: 'BUSINESS' }))}
                      className={`py-1.5 px-2 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 cursor-pointer ${
                        editForm.expenseScope === 'BUSINESS'
                          ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200 dark:bg-[#1C2333] dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB]'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Business</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, expenseScope: 'PERSONAL' }))}
                      className={`py-1.5 px-2 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 cursor-pointer ${
                        editForm.expenseScope === 'PERSONAL'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-slate-50 border-slate-200 dark:bg-[#1C2333] dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB]'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Personal</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono block">
                    {isSplitMode ? 'TOTAL AMOUNT (ETB)' : 'AMOUNT (ETB)'}
                  </label>
                  <span className="text-[9px] text-emerald-600 dark:text-[#00D4AA] font-mono">
                    {isSplitMode ? 'Summed from split funding' : 'Supports 40,50 or 40+50'}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={editForm.amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] rounded-xl px-3 py-2 text-sm text-emerald-700 dark:text-[#00D4AA] font-mono font-bold focus:outline-none focus:border-emerald-500 dark:focus:border-[#00D4AA]"
                />
                {(() => {
                  const parsedEdit = parseSummedAmount(editForm.amount);
                  if (parsedEdit.count > 1) {
                    return (
                      <div className="p-2 bg-emerald-50 dark:bg-[#00D4AA]/15 border border-emerald-200 dark:border-[#00D4AA]/30 rounded-lg flex items-center justify-between text-xs text-emerald-700 dark:text-[#00D4AA] font-mono font-bold">
                        <span className="flex items-center gap-1">
                          <Calculator className="w-3.5 h-3.5" />
                          Sum: {parsedEdit.formattedExpression}
                        </span>
                        <span>= {formatETB(parsedEdit.total)}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Payment Funding: Single Wallet vs Split Payment Mode */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono block">
                    PAYMENT FUNDING METHOD
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    {isSplitMode ? 'Multi-Wallet Split' : 'Single Account'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-[#0A0E1A] rounded-xl border border-slate-200 dark:border-[#1E2D40]">
                  <button
                    type="button"
                    onClick={() => handleToggleSplitMode(false)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !isSplitMode
                        ? 'bg-white dark:bg-[#1E2D40] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <WalletIcon className="w-3.5 h-3.5" />
                    <span>Single Wallet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSplitMode(true)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSplitMode
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                        : 'text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Split Payment 🔀</span>
                  </button>
                </div>
              </div>

              {/* Single Wallet Select */}
              {!isSplitMode && (
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono block mb-1">FUNDING WALLET</label>
                  <select
                    value={editForm.walletId}
                    onChange={(e) => setEditForm(prev => ({ ...prev, walletId: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-[#00D4AA]"
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Split Payment Multi-Wallet Breakdown */}
              {isSplitMode && (
                <div className="space-y-2.5 p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-900 dark:text-purple-300 font-mono flex items-center gap-1">
                      <Layers className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                      <span>SPLIT FUNDING WALLETS ({editSplitRows.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleSyncAmountFromSplits}
                      className="text-[10px] text-purple-700 dark:text-purple-300 hover:underline font-medium cursor-pointer"
                      title="Set transaction amount to sum of splits"
                    >
                      Sum to Total
                    </button>
                  </div>

                  {/* Split Rows */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {editSplitRows.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white dark:bg-[#131926] p-2 rounded-xl border border-slate-200 dark:border-[#1E2D40]">
                        <select
                          value={row.walletId}
                          onChange={(e) => handleEditSplitRowChange(idx, 'walletId', e.target.value)}
                          className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white font-medium focus:outline-none"
                        >
                          {wallets.map(w => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.type})
                            </option>
                          ))}
                        </select>
                        <div className="relative w-28 shrink-0">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={row.amount}
                            onChange={(e) => handleEditSplitRowChange(idx, 'amount', e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold text-purple-700 dark:text-purple-300 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        {editSplitRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEditSplitRow(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 cursor-pointer shrink-0"
                            title="Remove funding wallet"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Row Button & Auto Balance */}
                  <div className="flex items-center justify-between pt-1">
                    {editSplitRows.length < wallets.length && (
                      <button
                        type="button"
                        onClick={handleAddEditSplitRow}
                        className="text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Wallet</span>
                      </button>
                    )}
                    {editSplitRows.length >= 2 && (
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={handleDistributeEvenly}
                          className="text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                          title="Split amount equally across all wallets"
                        >
                          ⚖️ Equal Split
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoBalanceEditSplits}
                          className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 cursor-pointer"
                          title="Auto-fill remainder on last wallet"
                        >
                          ⚡ Auto-Balance
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Live Split Total Comparison */}
                  {(() => {
                    const parsedTarget = parseSummedAmount(editForm.amount).total;
                    const diff = parsedTarget - currentEditSplitTotal;
                    const isBalanced = Math.abs(diff) < 0.01;
                    return (
                      <div className={`p-2 rounded-lg text-xs font-mono flex items-center justify-between border ${
                        isBalanced
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                      }`}>
                        <span>Splits Total: <strong>{formatETB(currentEditSplitTotal)}</strong></span>
                        <span>
                          {isBalanced ? (
                            <span className="font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              Balanced
                            </span>
                          ) : (
                            <span className="font-bold">
                              {diff > 0 ? `Remaining: ${formatETB(diff)}` : `Over by: ${formatETB(Math.abs(diff))}`}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Date & Time */}
              <ModernDateInput
                type="datetime-local"
                required
                label="Date & Time"
                value={editForm.date}
                onChange={(val) => setEditForm(prev => ({ ...prev, date: val }))}
                accentColor="emerald"
                helperText="Click anywhere in the box to adjust timestamp"
              />

              {/* Category */}
              <div>
                <label className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono block mb-1">CATEGORY</label>
                <input
                  type="text"
                  required
                  value={editForm.category}
                  onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Category name"
                  className="w-full bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-[#00D4AA]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono block mb-1">DESCRIPTION</label>
                <input
                  type="text"
                  required
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Notes or details"
                  className="w-full bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-[#00D4AA]"
                />
              </div>

              {/* Linked Equb Circle (Shown if Equb category or refType === 'EQUB') */}
              {(editForm.category.toLowerCase().includes('equb') || editForm.category.toLowerCase().includes('ekub') || editForm.refType === 'EQUB') && equbs && equbs.length > 0 && (
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-1.5">
                  <label className="text-[10px] text-purple-900 dark:text-purple-300 font-bold block flex items-center justify-between">
                    <span>👥 LINKED EQUB CIRCLE</span>
                    {editForm.refId && <span className="font-mono text-purple-600 dark:text-purple-400">ID: {editForm.refId}</span>}
                  </label>
                  <select
                    value={editForm.refId || ''}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setEditForm(prev => ({
                        ...prev,
                        refType: selId ? 'EQUB' : undefined,
                        refId: selId || undefined
                      }));
                    }}
                    className="w-full bg-white dark:bg-[#0A0E1A] border border-purple-300 dark:border-purple-700/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">-- Select Equb Circle --</option>
                    {equbs.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} ({formatETB(eq.contributionPerRound)} / round, Round {eq.currentRound})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] cursor-pointer hover:bg-slate-200 dark:hover:bg-[#253248]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-xs font-bold text-[#0A0E1A] cursor-pointer shadow-lg hover:brightness-110 active:scale-98 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDeleteTxId && (() => {
        const targetDeleteTx = consolidatedTransactions.find(t => t.id === confirmDeleteTxId) || transactions.find(t => t.id === confirmDeleteTxId);
        const isEqubContribution = targetDeleteTx ? isEqubContributionTransaction(targetDeleteTx) : false;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/80 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white dark:bg-[#131926] border border-rose-200 dark:border-red-500/40 max-w-xs w-full p-4 rounded-2xl text-center space-y-3 shadow-xl">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 dark:bg-red-500/20 dark:text-red-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Delete Ledger Entry?</h4>
              <p className="text-xs text-slate-500 dark:text-[#8899BB]">
                Are you sure you want to delete this transaction? This action will remove it from ledger calculation.
              </p>

              {isEqubContribution && (
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-[11px] text-purple-700 dark:text-purple-300 text-left font-medium space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>🤝 Equb Circle Sync</span>
                  </p>
                  <p className="leading-relaxed">
                    Deleting this contribution will automatically revert the Equb circle's round number so it can be re-contributed.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setConfirmDeleteTxId(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Day Reminder Note Modal */}
      {editingNoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] max-w-md w-full p-5 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Day Reminder & Note</h4>
                  <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">{editingNoteModal.dateLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingNoteModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2D40] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDayNote} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Why was there no transaction or business on this day?
                </label>
                <input
                  type="text"
                  value={noteInputText}
                  onChange={(e) => setNoteInputText(e.target.value)}
                  placeholder="e.g. Shop closed for maintenance, Staff day off, Holiday..."
                  className="w-full bg-slate-50 dark:bg-[#1A2232] border border-slate-200 dark:border-[#223147] rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              {/* Quick suggestions chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quick Reason Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Holiday / Closed',
                    'Staff Rest Day',
                    'Shop Maintenance',
                    'Power Outage / No Internet',
                    'Rainy Day / Inactive'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNoteInputText(preset)}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-[#1C2333] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-[#8899BB] hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-[#253246] transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#1E2D40]">
                {dayReminders[editingNoteModal.dateKey] ? (
                  <button
                    type="button"
                    onClick={handleClearDayNote}
                    className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Clear Note
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingNoteModal(null)}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm cursor-pointer"
                  >
                    Save Reminder
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
