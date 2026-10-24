import React, { useState } from 'react';
import {
  Smartphone,
  Building2,
  X,
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  FileText,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Bell,
  Sliders,
  Sparkles,
  Layers,
  Filter,
  CheckCheck,
  UserCheck,
  Info
} from 'lucide-react';
import {
  Wallet,
  Transaction,
  UserProfile,
  ERPState,
  AutoImportSettings,
  PendingReviewTransaction,
  TransactionType
} from '../../types';
import { parseBankMessage } from '../../lib/smsParser';
import { formatETB } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import { sendExternalNotification } from '../../lib/notifications';

interface AutoImportHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  transactions: Transaction[];
  users: UserProfile[];
  currentUser: UserProfile;
  autoImportSettings?: AutoImportSettings;
  pendingReviewTransactions?: PendingReviewTransaction[];
  onUpdateState: (fn: (prev: ERPState) => ERPState) => void;
  onAddTransaction?: (data: {
    type: TransactionType;
    amount: number;
    walletId: string;
    category: string;
    description: string;
    date: string;
    notes?: string;
  }) => void;
}

type TabType = 'PENDING_QUEUE' | 'SETTINGS' | 'SIMULATOR';

const SAMPLE_PRESETS = [
  {
    provider: 'CBE',
    label: 'CBE Credit SMS (Yegeta Fikadu)',
    text: 'Dear Yegeta Fikadu Hallu You have received ETB 225.00 from account 1********7384 (Natnael Anteneh Masresha) to your account 1********4559. Your current balance is ETB3,044.57. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-hfHCxG103s8MQ3phnBM6 for feedback: https://forms.gle/kGNGQpG3QCCk31D6.'
  },
  {
    provider: 'TELEBIRR',
    label: 'Telebirr 127 Income (DH92N708HE)',
    text: 'Dear YEGETA You have received ETB 70.00 from eshetu asahenafi(2519****5211) on 09/08/2026 11:25:14. Your transaction number is DH92N708HE. Your current E-Money Account balance is ETB 2,553,75. Thank you for using telebirr.'
  },
  {
    provider: 'EBIRR',
    label: 'COOPayEBIRR Payment (Ref: 2588362838)',
    text: 'Ethio relecom [-EBIRR-COOPay-] Ref: 2588362838 Confirmed. ETB140 Received from sukhtar mohamed maxamed (988237226), Date: 27/07/26 15:23:10, your new A/C balance is ETB280.09 https://receipt.ebirr.com/coopay/aNBoRJrfo0n_0035gYAtog'
  },
  {
    provider: 'CBE',
    label: 'CBE Debit SMS (Expense)',
    text: 'Dear Customer, your account 1000751694559 has been debited with ETB 4,200.00 to ETHIO TELECOM on 09-AUG-2026. Ref: FT2608094102. Available balance ETB 174,000.00. Commercial Bank of Ethiopia.'
  },
  {
    provider: 'TELEBIRR',
    label: 'Telebirr Personal Account Test',
    text: 'Dear YEGETA You have received ETB 500.00 from Friend Personal Transfer(251911998877) on 09/08/2026. Your transaction number is DH99XX8877. Your current E-Money Account balance is ETB 3,053.75.'
  }
];

export const AutoImportHubModal: React.FC<AutoImportHubModalProps> = ({
  isOpen,
  onClose,
  wallets,
  transactions,
  users,
  currentUser,
  autoImportSettings = {
    enabled: true,
    importMethod: 'BOTH',
    selectedProvider: 'ALL',
    autoCategorize: true,
    notifyOnNewPending: true,
    excludePersonalTelebirr: false,
    personalTelebirrAccountIdentifier: ''
  },
  pendingReviewTransactions = [],
  onUpdateState,
  onAddTransaction
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<TabType>('PENDING_QUEUE');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'DUPLICATE' | 'REJECTED'>('PENDING');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');

  // Simulator paste state
  const [pastedText, setPastedText] = useState('');
  const [pasteSource, setPasteSource] = useState<'SMS' | 'NOTIFICATION'>('SMS');

  // Find Digital Money Manager user
  const managerUser = users.find((u) => u.isDigitalMoneyManager) || users.find((u) => u.role === 'SuperAdmin') || currentUser;
  const isManager = currentUser.id === managerUser.id || currentUser.role === 'SuperAdmin';

  // Helper to find matching wallet for provider
  const getWalletForProvider = (provider: string) => {
    if (provider === 'CBE') return wallets.find((w) => w.type === 'CBE_BANK') || wallets[0];
    if (provider === 'TELEBIRR') return wallets.find((w) => w.type === 'TELEBIRR') || wallets[0];
    if (provider === 'EBIRR') return wallets.find((w) => w.type === 'EBIRR') || wallets[0];
    return wallets.find((w) => w.isDefault) || wallets[0];
  };

  // Helper to check duplicates
  const checkIsDuplicate = (refCode: string, amount: number) => {
    if (!refCode || refCode.startsWith('AUTO-')) return false;
    const cleanRef = refCode.trim().toUpperCase();

    // Check existing posted transactions
    const matchesLedger = transactions.some((t) => {
      const desc = (t.description || '').toUpperCase();
      const notes = (t.notes || '').toUpperCase();
      const ref = (t.refId || '').toUpperCase();
      return desc.includes(cleanRef) || notes.includes(cleanRef) || ref === cleanRef;
    });

    if (matchesLedger) return true;

    // Check existing pending reviews that are already approved or pending
    const matchesPending = pendingReviewTransactions.some(
      (p) => p.refCode && p.refCode.toUpperCase() === cleanRef && p.status !== 'REJECTED'
    );

    return matchesPending;
  };

  // Process incoming text into pending review queue
  const handleIngestMessage = (text: string, source: 'SMS' | 'NOTIFICATION') => {
    const parsed = parseBankMessage(text);
    if (!parsed || !parsed.amount) {
      alert('Could not extract a valid transaction amount from the text. Please check the SMS/Notification text format.');
      return;
    }

    const isDup = checkIsDuplicate(parsed.refCode, parsed.amount);
    const targetWallet = getWalletForProvider(parsed.provider);

    const isPersonalExcluded =
      autoImportSettings.excludePersonalTelebirr &&
      parsed.provider === 'TELEBIRR' &&
      autoImportSettings.personalTelebirrAccountIdentifier &&
      text.toLowerCase().includes(autoImportSettings.personalTelebirrAccountIdentifier.toLowerCase().trim());

    const newItem: PendingReviewTransaction = {
      id: `pending-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: new Date().toISOString(),
      refCode: parsed.refCode,
      amount: parsed.amount,
      type: parsed.type,
      senderOrCounterparty: parsed.senderOrCounterparty,
      standingBalance: parsed.standingBalance,
      rawText: parsed.rawText,
      source,
      provider: parsed.provider,
      suggestedCategory: parsed.suggestedCategory,
      suggestedWalletId: targetWallet ? targetWallet.id : wallets[0]?.id || '',
      createdAt: new Date().toISOString(),
      status: isPersonalExcluded ? 'REJECTED' : isDup ? 'DUPLICATE' : 'PENDING',
      notes: isPersonalExcluded
        ? `Excluded automatically as Personal Telebirr Account (${autoImportSettings.personalTelebirrAccountIdentifier})`
        : `Auto-ingested from ${source} (${parsed.provider})`
    };

    triggerHaptic(isDup ? 'warning' : 'success');

    onUpdateState((prev) => ({
      ...prev,
      pendingReviewTransactions: [newItem, ...(prev.pendingReviewTransactions || [])]
    }));

    if (autoImportSettings.notifyOnNewPending && !isDup) {
      sendExternalNotification(`New ${parsed.provider} Bank Transaction Pending Review`, {
        body: `${parsed.type === 'INCOME' ? 'Received' : 'Paid'} ETB ${parsed.amount.toLocaleString()} from ${parsed.senderOrCounterparty}. Tap to review.`
      });
    }

    setPastedText('');
    setActiveTab('PENDING_QUEUE');
  };

  // Approve a pending transaction
  const handleApprovePending = (item: PendingReviewTransaction) => {
    triggerHaptic('success');

    // 1. Post to ledger
    if (onAddTransaction) {
      onAddTransaction({
        type: item.type,
        amount: item.amount,
        walletId: item.suggestedWalletId || wallets[0]?.id || '',
        category: item.suggestedCategory,
        description: `${item.provider} ${item.type === 'INCOME' ? 'Credit' : 'Debit'}: ${item.senderOrCounterparty} [Ref: ${item.refCode}]`,
        date: new Date().toISOString().split('T')[0],
        notes: `SMS Ref: ${item.refCode} | Extracted Standing: ${item.standingBalance ? formatETB(item.standingBalance) : 'N/A'}`
      });
    }

    // 2. Mark item as APPROVED in pending array
    onUpdateState((prev) => ({
      ...prev,
      pendingReviewTransactions: (prev.pendingReviewTransactions || []).map((p) =>
        p.id === item.id ? { ...p, status: 'APPROVED' } : p
      )
    }));
  };

  // Batch approve all pending items
  const handleApproveAllPending = () => {
    const itemsToApprove = pendingReviewTransactions.filter((p) => p.status === 'PENDING');
    if (itemsToApprove.length === 0) {
      alert('No pending transactions available for batch approval.');
      return;
    }

    const confirmed = window.confirm(
      `Approve ${itemsToApprove.length} pending transactions?\n\nThis will post all valid transactions to their target bank/digital wallets immediately.`
    );
    if (!confirmed) return;

    triggerHaptic('success');

    itemsToApprove.forEach((item) => {
      if (onAddTransaction) {
        onAddTransaction({
          type: item.type,
          amount: item.amount,
          walletId: item.suggestedWalletId || wallets[0]?.id || '',
          category: item.suggestedCategory,
          description: `${item.provider} ${item.type === 'INCOME' ? 'Credit' : 'Debit'}: ${item.senderOrCounterparty} [Ref: ${item.refCode}]`,
          date: new Date().toISOString().split('T')[0],
          notes: `SMS Ref: ${item.refCode} | Standing: ${item.standingBalance ? formatETB(item.standingBalance) : 'N/A'}`
        });
      }
    });

    onUpdateState((prev) => ({
      ...prev,
      pendingReviewTransactions: (prev.pendingReviewTransactions || []).map((p) =>
        p.status === 'PENDING' ? { ...p, status: 'APPROVED' } : p
      )
    }));
  };

  // Reject / Dismiss pending transaction
  const handleRejectPending = (itemId: string) => {
    triggerHaptic('light');
    onUpdateState((prev) => ({
      ...prev,
      pendingReviewTransactions: (prev.pendingReviewTransactions || []).map((p) =>
        p.id === itemId ? { ...p, status: 'REJECTED' } : p
      )
    }));
  };

  // Toggle Auto-Import settings
  const handleUpdateSettings = (updates: Partial<AutoImportSettings>) => {
    triggerHaptic('light');
    onUpdateState((prev) => ({
      ...prev,
      autoImportSettings: {
        ...(prev.autoImportSettings || autoImportSettings),
        ...updates
      }
    }));
  };

  // Filtered queue items
  const pendingQueue = pendingReviewTransactions.filter((item) => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesProvider = providerFilter === 'ALL' || item.provider === providerFilter;
    return matchesStatus && matchesProvider;
  });

  const pendingCount = pendingReviewTransactions.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#161D2B] border-b border-slate-200 dark:border-[#1E2D40] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 font-black flex items-center justify-center shadow-md">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Bank SMS & Notification Auto-Importer Hub
                </h2>
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-[#00D4AA] border border-emerald-500/30">
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#8899BB] font-medium">
                Automatic transaction detection from CBE, Telebirr, eBirr & Bank Notification Listeners
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-200/60 dark:bg-[#1E2D40] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Digital Money Manager Role Banner */}
        <div className="px-4 sm:px-5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-[#00D4AA] shrink-0" />
            <span>
              Designated Digital Money Manager:{' '}
              <strong className="text-slate-900 dark:text-white font-bold">{managerUser.name}</strong>
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
            {isManager
              ? '⚡ You have full authorization to review & post bank transactions'
              : '🔒 View-Only Mode (Managed by ' + managerUser.name + ')'}
          </span>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-1 p-2 bg-slate-100/80 dark:bg-[#182030] border-b border-slate-200 dark:border-[#1E2D40] overflow-x-auto text-xs shrink-0">
          <button
            onClick={() => setActiveTab('PENDING_QUEUE')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'PENDING_QUEUE'
                ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Pending Review Queue</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'SETTINGS'
                ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Listener Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('SIMULATOR')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
              activeTab === 'SIMULATOR'
                ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Instant Paste & Tester</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: PENDING REVIEW QUEUE */}
          {activeTab === 'PENDING_QUEUE' && (
            <div className="space-y-4">
              {/* Queue Header & Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#161D2B] p-3 rounded-2xl border border-slate-200 dark:border-[#1E2D40]">
                {/* Status Filter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mr-1">Status:</span>
                  {(['ALL', 'PENDING', 'APPROVED', 'DUPLICATE', 'REJECTED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                        statusFilter === st
                          ? 'bg-slate-900 dark:bg-[#00D4AA] text-white dark:text-slate-950'
                          : 'bg-white dark:bg-[#1C2333] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#223044]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Batch Actions */}
                {pendingCount > 0 && isManager && (
                  <button
                    onClick={handleApproveAllPending}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Approve All Pending ({pendingCount})</span>
                  </button>
                )}
              </div>

              {/* Items List */}
              {pendingQueue.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-[#161D2B] rounded-2xl border border-dashed border-slate-200 dark:border-[#1E2D40] space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Transactions Found</h4>
                  <p className="text-xs text-slate-500 dark:text-[#8899BB] max-w-sm mx-auto">
                    All incoming bank SMS alerts and app notifications have been reviewed or processed. Use the "Instant Paste & Tester" tab to simulate incoming messages.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingQueue.map((item) => {
                    const isDup = item.status === 'DUPLICATE';
                    const isApproved = item.status === 'APPROVED';
                    const isRejected = item.status === 'REJECTED';

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          isApproved
                            ? 'bg-emerald-500/5 border-emerald-500/30'
                            : isRejected
                            ? 'bg-slate-500/5 border-slate-200 dark:border-slate-800 opacity-60'
                            : isDup
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-white dark:bg-[#161D2B] border-slate-200 dark:border-[#1E2D40] shadow-xs hover:border-emerald-500/40'
                        }`}
                      >
                        {/* Top Info Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-[#223044] pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Provider Badge */}
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-900 dark:bg-[#1C2333] text-white dark:text-[#00D4AA] border border-slate-700 dark:border-[#223044]">
                              {item.provider}
                            </span>

                            {/* Source Badge (SMS vs Notification) */}
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-[#223044] text-slate-600 dark:text-slate-300 flex items-center gap-1">
                              {item.source === 'SMS' ? <Smartphone className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                              <span>{item.source}</span>
                            </span>

                            {/* Ref Code */}
                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                              Ref: {item.refCode}
                            </span>

                            {/* Duplicate Warning Tag */}
                            {isDup && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>Duplicate Match Found</span>
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-slate-500 font-mono">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {/* Amount & Sender Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Counterparty / Sender
                            </span>
                            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                              {item.senderOrCounterparty}
                            </p>
                            {item.standingBalance && (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                                SMS Standing Bal: {formatETB(item.standingBalance)}
                              </span>
                            )}
                          </div>

                          <div className="sm:text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Extracted Amount
                            </span>
                            <p
                              className={`text-lg font-black font-mono ${
                                item.type === 'INCOME' ? 'text-emerald-600 dark:text-[#00D4AA]' : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {item.type === 'INCOME' ? '+' : '-'} {formatETB(item.amount)}
                            </p>
                          </div>
                        </div>

                        {/* Raw Message Text Snippet */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-100 dark:border-[#223044] text-xs font-mono text-slate-600 dark:text-slate-300">
                          "{item.rawText}"
                        </div>

                        {/* Balance Math Equation Verification Audit */}
                        {(() => {
                          const selectedWallet = wallets.find((w) => w.id === item.suggestedWalletId) || wallets[0];
                          const walletBal = selectedWallet ? (selectedWallet.openingBalance + selectedWallet.totalIn - selectedWallet.totalOut) : 0;
                          const expectedNewBal = item.type === 'INCOME' ? walletBal + item.amount : walletBal - item.amount;
                          const smsBal = item.standingBalance;
                          const diff = smsBal !== undefined ? smsBal - expectedNewBal : 0;

                          return (
                            <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-[#1C2333] border border-slate-200 dark:border-[#223044] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                                <ShieldCheck className={`w-4 h-4 shrink-0 ${smsBal !== undefined && Math.abs(diff) < 0.05 ? 'text-emerald-500' : 'text-amber-500'}`} />
                                <span>
                                  <strong>Balance Equation:</strong> Prev ({formatETB(walletBal)}) {item.type === 'INCOME' ? '+' : '-'} Recv ({formatETB(item.amount)}) = <strong className="text-slate-900 dark:text-white">{formatETB(expectedNewBal)}</strong>
                                </span>
                              </div>

                              {smsBal !== undefined ? (
                                Math.abs(diff) < 0.05 ? (
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-[#00D4AA] border border-emerald-500/30 shrink-0">
                                    ✓ Equation Verified (Matches SMS {formatETB(smsBal)})
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                      ⚠️ SMS: {formatETB(smsBal)} (Diff: {diff > 0 ? '+' : ''}{formatETB(diff)})
                                    </span>
                                    {isManager && selectedWallet && (
                                      <button
                                        onClick={() => {
                                          const neededInitial = smsBal - (item.type === 'INCOME' ? item.amount : -item.amount);
                                          onUpdateState((prev) => ({
                                            ...prev,
                                            wallets: prev.wallets.map((w) =>
                                              w.id === selectedWallet.id ? { ...w, initialBalance: neededInitial } : w
                                            )
                                          }));
                                          triggerHaptic('success');
                                        }}
                                        className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] cursor-pointer"
                                        title="Adjust wallet initial balance so equation matches SMS standing balance"
                                      >
                                        Auto-Reconcile Wallet
                                      </button>
                                    )}
                                  </div>
                                )
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">No SMS standing balance found</span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Wallet & Category Selection controls */}
                        {item.status === 'PENDING' && isManager && (
                          <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Target Wallet</label>
                              <select
                                value={item.suggestedWalletId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  onUpdateState((prev) => ({
                                    ...prev,
                                    pendingReviewTransactions: (prev.pendingReviewTransactions || []).map((p) =>
                                      p.id === item.id ? { ...p, suggestedWalletId: val } : p
                                    )
                                  }));
                                }}
                                className="w-full bg-slate-100 dark:bg-[#223044] border border-slate-200 dark:border-[#2A3B54] text-slate-900 dark:text-white rounded-xl text-xs p-2 font-bold focus:outline-none"
                              >
                                {wallets.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name} ({w.type})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Category</label>
                              <input
                                type="text"
                                value={item.suggestedCategory}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  onUpdateState((prev) => ({
                                    ...prev,
                                    pendingReviewTransactions: (prev.pendingReviewTransactions || []).map((p) =>
                                      p.id === item.id ? { ...p, suggestedCategory: val } : p
                                    )
                                  }));
                                }}
                                className="w-full bg-slate-100 dark:bg-[#223044] border border-slate-200 dark:border-[#2A3B54] text-slate-900 dark:text-white rounded-xl text-xs p-2 font-bold focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {/* Bottom Action Row */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#223044]">
                          <span className="text-[11px] font-bold text-slate-500">
                            Status:{' '}
                            <strong
                              className={
                                isApproved
                                  ? 'text-emerald-500'
                                  : isRejected
                                  ? 'text-slate-400'
                                  : isDup
                                  ? 'text-amber-500'
                                  : 'text-blue-500'
                              }
                            >
                              {item.status}
                            </strong>
                          </span>

                          {item.status === 'PENDING' && isManager && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRejectPending(item.id)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#223044] cursor-pointer"
                              >
                                Discard
                              </button>

                              <button
                                onClick={() => handleApprovePending(item)}
                                className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                                <span>Approve & Post to Ledger</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LISTENER SETTINGS */}
          {activeTab === 'SETTINGS' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#161D2B] border border-slate-200 dark:border-[#1E2D40] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Enable Automatic Bank Import</h4>
                    <p className="text-xs text-slate-500 dark:text-[#8899BB]">
                      Automatically extract incoming bank SMS alerts & app notifications into the review queue
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoImportSettings.enabled}
                    onChange={(e) => handleUpdateSettings({ enabled: e.target.checked })}
                    className="w-5 h-5 accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-[#223044]">
                  {/* Import Method */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Import Channel Mode
                    </label>
                    <select
                      value={autoImportSettings.importMethod}
                      onChange={(e) => handleUpdateSettings({ importMethod: e.target.value as any })}
                      className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#2A3B54] text-slate-900 dark:text-white rounded-xl text-xs p-2.5 font-bold"
                    >
                      <option value="SMS">1. SMS Reading Only (Bank SMS Monitor)</option>
                      <option value="NOTIFICATION">2. Notification Reading Only (App Notification Listener)</option>
                      <option value="BOTH">3. Both SMS & App Notifications (Recommended)</option>
                    </select>
                  </div>

                  {/* Provider Filter */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Target Bank Provider
                    </label>
                    <select
                      value={autoImportSettings.selectedProvider}
                      onChange={(e) => handleUpdateSettings({ selectedProvider: e.target.value as any })}
                      className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#2A3B54] text-slate-900 dark:text-white rounded-xl text-xs p-2.5 font-bold"
                    >
                      <option value="ALL">All Banks (CBE, Telebirr, eBirr, Awash, Dashen, BOA)</option>
                      <option value="CBE">Commercial Bank of Ethiopia (CBE)</option>
                      <option value="TELEBIRR">Telebirr Mobile Money</option>
                      <option value="EBIRR">eBirr Mobile Wallet</option>
                      <option value="AWASH">Awash Bank</option>
                      <option value="DASHEN">Dashen Bank / Amole</option>
                      <option value="BOA">Bank of Abyssinia</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#223044]">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">OS Push Alerts on New Incoming SMS</span>
                    <span className="text-[11px] text-slate-500">Trigger device notification when a new bank transaction is detected</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoImportSettings.notifyOnNewPending}
                    onChange={(e) => handleUpdateSettings({ notifyOnNewPending: e.target.checked })}
                    className="w-5 h-5 accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Personal Telebirr Account Exclusion Filter */}
                <div className="pt-3 border-t border-slate-200 dark:border-[#223044] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Exclude Personal Telebirr Account SMS
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Filter out incoming Telebirr SMS messages meant for your personal non-business account
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!autoImportSettings.excludePersonalTelebirr}
                      onChange={(e) => handleUpdateSettings({ excludePersonalTelebirr: e.target.checked })}
                      className="w-5 h-5 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {autoImportSettings.excludePersonalTelebirr && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Personal Telebirr Account Keyword / Phone / Name
                      </label>
                      <input
                        type="text"
                        value={autoImportSettings.personalTelebirrAccountIdentifier || ''}
                        onChange={(e) => handleUpdateSettings({ personalTelebirrAccountIdentifier: e.target.value })}
                        placeholder="e.g. 2519****5211 or Personal or YEGETA Personal"
                        className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#2A3B54] text-slate-900 dark:text-white rounded-xl text-xs p-2.5 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Technical Bridge Guide */}
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-300 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Android SMS Permission & Notification Listener Integration</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  When deployed as an Android app or Progressive Web App (PWA), the app utilizes native Android <code className="bg-blue-950 px-1 py-0.5 rounded text-blue-200 font-mono">RECEIVE_SMS</code> and <code className="bg-blue-950 px-1 py-0.5 rounded text-blue-200 font-mono">NotificationListenerService</code> APIs. Incoming bank SMS messages and notification intents are parsed instantly by the client engine and stored in the Digital Money Manager review queue.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: INSTANT PASTE & TESTER */}
          {activeTab === 'SIMULATOR' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#161D2B] border border-slate-200 dark:border-[#1E2D40] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    Instant SMS / App Notification Tester
                  </h4>

                  {/* Channel Switch */}
                  <div className="flex items-center bg-slate-200 dark:bg-[#1C2333] p-1 rounded-xl text-xs">
                    <button
                      onClick={() => setPasteSource('SMS')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        pasteSource === 'SMS'
                          ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      SMS
                    </button>
                    <button
                      onClick={() => setPasteSource('NOTIFICATION')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        pasteSource === 'NOTIFICATION'
                          ? 'bg-white dark:bg-[#00D4AA] text-slate-900 dark:text-slate-950'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      App Notification
                    </button>
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <textarea
                    rows={4}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={`Paste incoming ${pasteSource === 'SMS' ? 'Bank SMS' : 'Bank App Notification'} text here... (e.g. CBE, Telebirr, eBirr)`}
                    className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#223044] text-slate-900 dark:text-white rounded-2xl p-3 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    disabled={!pastedText.trim()}
                    onClick={() => handleIngestMessage(pastedText, pasteSource)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Parse & Ingest to Review Queue</span>
                  </button>
                </div>
              </div>

              {/* Sample Presets */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Test with Sample Bank Messages:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SAMPLE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setPastedText(preset.text);
                        triggerHaptic('light');
                      }}
                      className="p-3 rounded-xl bg-white dark:bg-[#161D2B] border border-slate-200 dark:border-[#1E2D40] hover:border-emerald-500/40 text-left transition-all text-xs space-y-1 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                        <span>{preset.label}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-[#00D4AA] group-hover:underline">Use Preset</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono line-clamp-2">
                        {preset.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
