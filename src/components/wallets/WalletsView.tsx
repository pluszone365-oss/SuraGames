import React, { useState } from 'react';
import {
  Wallet as WalletIcon,
  Plus,
  ArrowRightLeft,
  Building2,
  Smartphone,
  Banknote,
  Vault,
  CreditCard,
  History,
  Check,
  Globe,
  DollarSign,
  Palette,
  Trash2,
  Zap,
  ShieldCheck,
  Upload,
  Image,
  X,
  Lock,
  HelpCircle,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { Wallet, Transaction, Transfer, UserProfile, TransactionType, Receivable } from '../../types';
import {
  calculateWalletBalance,
  calculateWalletNetActivity,
  getAdjustedOpeningBalanceForTargetBalance,
  formatETB,
  isOverdraftAllowed,
  isWalletActive,
  isCreditSaleCollected,
  getTransactionDisplayTitle
} from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import { TelebirrIntegrationModal } from './TelebirrIntegrationModal';
import { ShegerPayVerificationModal } from './ShegerPayVerificationModal';
import { AutoImportHubModal } from './AutoImportHubModal';
import { BrandLogo } from '../common/BrandLogo';
import { AutoImportSettings, PendingReviewTransaction, ERPState } from '../../types';

interface WalletsViewProps {
  wallets: Wallet[];
  transactions: Transaction[];
  transfers: Transfer[];
  receivables?: Receivable[];
  users?: UserProfile[];
  currentUser: UserProfile;
  hideBalances: boolean;
  autoImportSettings?: AutoImportSettings;
  pendingReviewTransactions?: PendingReviewTransaction[];
  onUpdateState?: (fn: (prev: ERPState) => ERPState) => void;
  onOpenTransferModal: () => void;
  onOpenQuickEntry?: (walletId?: string) => void;
  onAddWallet: (wallet: Omit<Wallet, 'id' | 'totalIn' | 'totalOut'>) => void;
  onUpdateWallet?: (walletId: string, updates: Partial<Wallet>) => void;
  onDeleteWallet?: (walletId: string) => void;
  onAddTransaction?: (data: {
    type: TransactionType;
    amount: number;
    walletId: string;
    category: string;
    description: string;
    date: string;
  }) => void;
  onBatchPostTransactions?: (items: Array<{
    type: TransactionType;
    amount: number;
    walletId: string;
    category: string;
    description: string;
    date: string;
  }>) => void;
  onOpenHelp?: () => void;
}

const COLOR_PALETTE = [
  { name: 'Telebirr Cyan', hex: '#00D4AA' },
  { name: 'CBE Royal Blue', hex: '#3B82F6' },
  { name: 'Cash Emerald', hex: '#10B981' },
  { name: 'Gold Amber', hex: '#F5A623' },
  { name: 'Violet Purple', hex: '#8B5CF6' },
  { name: 'Crimson Red', hex: '#EF4444' },
  { name: 'Hot Pink', hex: '#EC4899' },
  { name: 'Bright Orange', hex: '#F97316' },
  { name: 'Deep Indigo', hex: '#6366F1' },
  { name: 'Ocean Cyan', hex: '#06B6D4' }
];

const DEFAULT_TYPE_COLORS: Record<Wallet['type'], string> = {
  CASH: '#F97316',      // Orange background
  CBE_BANK: '#8B5CF6',  // Purple background
  TELEBIRR: '#0EA5E9',  // Light Blue background
  EBIRR: '#10B981',     // Green background
  SAVINGS: '#3B82F6',
  OTHER: '#06B6D4',
  CREDIT_LINE: '#8B5CF6',
  LOAN: '#EC4899'
};

export const WalletsView: React.FC<WalletsViewProps> = ({
  wallets,
  transactions,
  transfers,
  receivables = [],
  users = [],
  currentUser,
  hideBalances,
  autoImportSettings,
  pendingReviewTransactions = [],
  onUpdateState,
  onOpenTransferModal,
  onOpenQuickEntry,
  onAddWallet,
  onUpdateWallet,
  onDeleteWallet,
  onAddTransaction,
  onBatchPostTransactions,
  onOpenHelp
}) => {
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(wallets[0]?.id || null);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'ACTIVE' | 'DIGITAL' | 'CASH' | 'CREDIT' | 'ARCHIVED'>('ALL');
  
  // Integration Modal state
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [showShegerModal, setShowShegerModal] = useState(false);
  const [showAutoImportHub, setShowAutoImportHub] = useState(false);
  
  // Create Wallet Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<Wallet['type']>('TELEBIRR');
  const [newWalletAccNum, setNewWalletAccNum] = useState('');
  const [newWalletBal, setNewWalletBal] = useState('');
  const [newWalletColor, setNewWalletColor] = useState('#00D4AA');
  const [newCustomLogoUrl, setNewCustomLogoUrl] = useState('');
  const [newWalletStatus, setNewWalletStatus] = useState<'ACTIVE' | 'ARCHIVED' | 'DISABLED'>('ACTIVE');
  const [newWalletAllowOverdraft, setNewWalletAllowOverdraft] = useState(false);
  const [newWalletIsCredit, setNewWalletIsCredit] = useState(false);

  // Reconcile Balances Modal state
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileBalances, setReconcileBalances] = useState<Record<string, string>>({});

  // Edit Wallet Modal state
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<Wallet['type']>('TELEBIRR');
  const [editColor, setEditColor] = useState('#00D4AA');
  const [editAccNum, setEditAccNum] = useState('');
  const [editCustomLogoUrl, setEditCustomLogoUrl] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'ARCHIVED' | 'DISABLED'>('ACTIVE');
  const [editAllowOverdraft, setEditAllowOverdraft] = useState(false);
  const [editIsCredit, setEditIsCredit] = useState(false);
  const [editOpeningBal, setEditOpeningBal] = useState('');
  const [editTargetBal, setEditTargetBal] = useState('');

  // Delete Wallet Confirmation Modal state
  const [deletingWallet, setDeletingWallet] = useState<Wallet | null>(null);
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');
  const [approvalConfirmed, setApprovalConfirmed] = useState<boolean>(false);
  const [approverPassword, setApproverPassword] = useState<string>('');
  const [approvalError, setApprovalError] = useState<string>('');

  const otherActiveUsers = users.filter(u => u.id !== currentUser.id && u.active);

  const openEditModal = (w: Wallet) => {
    triggerHaptic('light');
    setEditingWallet(w);
    setEditName(w.name);
    setEditType(w.type);
    setEditAccNum(w.accountNumber || '');
    setEditColor(w.color);
    setEditCustomLogoUrl(w.customLogoUrl || '');
    setEditStatus(w.status || (w.isArchived ? 'ARCHIVED' : 'ACTIVE'));
    setEditAllowOverdraft(!!(w.allowOverdraft || w.isCreditAccount || w.type === 'CREDIT_LINE' || w.type === 'LOAN'));
    setEditIsCredit(!!(w.isCreditAccount || w.type === 'CREDIT_LINE' || w.type === 'LOAN'));
    setEditOpeningBal(w.openingBalance !== undefined ? String(w.openingBalance) : '0');
    setEditTargetBal(String(calculateWalletBalance(w, transactions, transfers)));
  };

  const openDeleteModal = (w: Wallet) => {
    triggerHaptic('medium');
    setDeletingWallet(w);
    setSelectedApproverId(otherActiveUsers[0]?.id || '');
    setApprovalConfirmed(false);
    setApproverPassword('');
    setApprovalError('');
  };

  // Selected wallet for activity ledger
  const selectedWallet = wallets.find(w => w.id === selectedWalletId);
  const selectedBal = selectedWallet ? calculateWalletBalance(selectedWallet, transactions, transfers) : 0;

  // Wallet balances summary calculations
  const totalNetBalance = wallets.reduce(
    (sum, w) => sum + calculateWalletBalance(w, transactions, transfers),
    0
  );

  const digitalWallets = wallets.filter(w => w.type !== 'CASH');
  const cashWallets = wallets.filter(w => w.type === 'CASH');

  const totalDigitalAmount = digitalWallets.reduce(
    (sum, w) => sum + calculateWalletBalance(w, transactions, transfers),
    0
  );

  const totalCashAmount = cashWallets.reduce(
    (sum, w) => sum + calculateWalletBalance(w, transactions, transfers),
    0
  );

  // Canonical Cash Available Breakdown (Telebirr, CBE, eBirr, Cash, Saving wallet)
  const canonicalOrder = ['TELEBIRR', 'CBE_BANK', 'EBIRR', 'CASH', 'SAVINGS'];
  const cashAvailableWallets = [...wallets].sort((a, b) => {
    const idxA = canonicalOrder.indexOf(a.type);
    const idxB = canonicalOrder.indexOf(b.type);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  // Filter wallets for grid display
  const filteredWallets = wallets.filter(w => {
    if (categoryFilter === 'ACTIVE') return isWalletActive(w);
    if (categoryFilter === 'DIGITAL') return w.type !== 'CASH';
    if (categoryFilter === 'CASH') return w.type === 'CASH';
    if (categoryFilter === 'CREDIT') return isOverdraftAllowed(w);
    if (categoryFilter === 'ARCHIVED') return !isWalletActive(w);
    return true;
  });

  // Filter transactions for selected wallet (sorted latest first - all transactions always visible)
  const walletTxs = selectedWallet
    ? transactions
        .filter(tx => tx.walletId === selectedWallet.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const handleLogoFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setLogoUrl: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('File size must be under 3MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          triggerHaptic('success');
          setLogoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTypeChange = (type: Wallet['type']) => {
    setNewWalletType(type);
    setNewWalletColor(DEFAULT_TYPE_COLORS[type] || '#00D4AA');
    if (type === 'CREDIT_LINE' || type === 'LOAN') {
      setNewWalletIsCredit(true);
      setNewWalletAllowOverdraft(true);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;

    triggerHaptic('success');
    let defaultIcon = 'Building2';
    if (newWalletType === 'TELEBIRR') defaultIcon = 'Smartphone';
    else if (newWalletType === 'CASH') defaultIcon = 'Banknote';
    else if (newWalletType === 'EBIRR') defaultIcon = 'CreditCard';
    else if (newWalletType === 'SAVINGS') defaultIcon = 'Vault';

    onAddWallet({
      name: newWalletName.trim(),
      type: newWalletType,
      accountNumber: newWalletAccNum.trim() || undefined,
      openingBalance: parseFloat(newWalletBal) || 0,
      color: newWalletColor,
      iconName: defaultIcon,
      customLogoUrl: newCustomLogoUrl.trim() || undefined,
      status: newWalletStatus,
      isCreditAccount: newWalletIsCredit,
      allowOverdraft: newWalletAllowOverdraft || newWalletIsCredit,
      isArchived: newWalletStatus === 'ARCHIVED'
    });

    setShowAddModal(false);
    setNewWalletName('');
    setNewWalletAccNum('');
    setNewWalletBal('');
    setNewWalletColor('#00D4AA');
    setNewCustomLogoUrl('');
    setNewWalletStatus('ACTIVE');
    setNewWalletAllowOverdraft(false);
    setNewWalletIsCredit(false);
  };

  const handleSaveEditWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWallet || !onUpdateWallet) return;

    triggerHaptic('success');
    let defaultIcon = editingWallet.iconName;
    if (editType === 'TELEBIRR') defaultIcon = 'Smartphone';
    else if (editType === 'CASH') defaultIcon = 'Banknote';
    else if (editType === 'EBIRR') defaultIcon = 'CreditCard';
    else if (editType === 'SAVINGS') defaultIcon = 'Vault';
    else if (editType === 'CBE_BANK') defaultIcon = 'Building2';

    let finalOpeningBalance = editingWallet.openingBalance;
    const target = parseFloat(editTargetBal);
    if (!isNaN(target)) {
      finalOpeningBalance = getAdjustedOpeningBalanceForTargetBalance(editingWallet.id, target, transactions, transfers);
    } else {
      const op = parseFloat(editOpeningBal);
      if (!isNaN(op)) {
        finalOpeningBalance = op;
      }
    }

    onUpdateWallet(editingWallet.id, {
      name: editName.trim() || editingWallet.name,
      type: editType,
      color: editColor,
      openingBalance: finalOpeningBalance,
      accountNumber: editAccNum.trim() || undefined,
      iconName: defaultIcon,
      customLogoUrl: editCustomLogoUrl.trim() || undefined,
      status: editStatus,
      isCreditAccount: editIsCredit,
      allowOverdraft: editAllowOverdraft || editIsCredit,
      isArchived: editStatus === 'ARCHIVED'
    });

    setEditingWallet(null);
  };

  const getWalletIcon = (type: Wallet['type'], color: string, customLogoUrl?: string, size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md') => {
    return <BrandLogo type={type} size={size} customColor={color} customLogoUrl={customLogoUrl} />;
  };

  return (
    <div className="space-y-4 pb-24">
      
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-[#F0F4FF]">Business Wallets</h2>
          <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-0.5">Multi-account liquid capital breakdown</p>
        </div>

        <div id="tour-wallets-actions" data-tour="wallets-actions" className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          {currentUser.role === 'SuperAdmin' && (
            <>
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setShowShegerModal(true);
                }}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:brightness-110 transition-all border border-blue-400/30"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Verify ShegerPay FT</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setShowIntegrationModal(true);
                }}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:brightness-110 transition-all border border-emerald-400/30"
              >
                <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
                <span className="truncate">Bank Sync</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setShowAutoImportHub(true);
                }}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:brightness-110 transition-all border border-emerald-300/50 relative"
              >
                <Zap className="w-3.5 h-3.5 fill-current shrink-0 text-slate-950" />
                <span className="truncate">Auto-Import Hub</span>
                {pendingReviewTransactions.filter((p) => p.status === 'PENDING').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                    {pendingReviewTransactions.filter((p) => p.status === 'PENDING').length}
                  </span>
                )}
              </button>
            </>
          )}

          {(currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin') && (
            <button
              onClick={() => {
                triggerHaptic('medium');
                const initialMap: Record<string, string> = {};
                wallets.forEach(w => {
                  initialMap[w.id] = String(calculateWalletBalance(w, transactions, transfers));
                });
                setReconcileBalances(initialMap);
                setShowReconcileModal(true);
              }}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:brightness-110 transition-all border border-amber-400/30"
              title="Reconcile and set true current wallet balances to eliminate previous app discrepancies"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Set Real Balances</span>
            </button>
          )}

          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenTransferModal();
            }}
            className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:bg-blue-700 transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Transfer</span>
          </button>
          
          {(currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin') && (
            <button
              id="tour-add-wallet-btn"
              data-tour="add-wallet-btn"
              onClick={() => {
                triggerHaptic('light');
                setShowAddModal(true);
              }}
              className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-[#0A0E1A] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shadow-md hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Add New Wallet</span>
            </button>
          )}

          {onOpenHelp && (
            <button
              type="button"
              id="btn-page-help-wallets"
              onClick={() => {
                triggerHaptic('light');
                onOpenHelp();
              }}
              title="Wallets Help (?)"
              aria-label="Help"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1A2232] dark:hover:bg-[#222C40] border border-slate-200 dark:border-[#243046] text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            >
              <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </button>
          )}
        </div>
      </div>

      {/* Cash Available Snapshot Table & Card (User Canonical Breakdown) */}
      <div id="tour-wallets-overview" data-tour="wallets-overview" className="bg-white dark:bg-[#111622] border border-slate-200/90 dark:border-[#1C2638] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1E2D40] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-[#00D4AA] shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Cash Available</h3>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-[#00D4AA] px-2 py-0.5 rounded-full border border-emerald-500/30">
                  RECONCILED
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-0.5">Live balances across Telebirr, Banks, Cash Vault & Savings</p>
            </div>
          </div>

          <div className="flex items-baseline gap-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border border-emerald-500/30 px-4 py-2 rounded-xl self-start sm:self-auto">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Total:</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-700 dark:text-[#00D4AA]">
              {hideBalances ? '••••••••' : formatETB(totalNetBalance)}
            </span>
          </div>
        </div>

        {/* Clean, High-Contrast Wallet Breakdown Table */}
        <div className="overflow-hidden border border-slate-200/80 dark:border-[#1E2D40] rounded-xl bg-slate-50/40 dark:bg-[#0E131F]">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-[#151C2A] text-slate-600 dark:text-[#8899BB] font-bold border-b border-slate-200/80 dark:border-[#1E2D40]">
                <th className="py-2.5 px-4">Wallet</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-[#1A2436]">
              {cashAvailableWallets.map((w) => {
                const bal = calculateWalletBalance(w, transactions, transfers);
                const isSelected = w.id === selectedWalletId;
                return (
                  <tr
                    key={w.id}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedWalletId(w.id);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/25 font-semibold'
                        : 'hover:bg-slate-100/70 dark:hover:bg-[#151C2A]/70'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                        <span className="font-bold text-slate-900 dark:text-white">{w.name}</span>
                        {w.accountNumber && (
                          <span className="text-[10px] font-mono text-slate-400 dark:text-[#8899BB] hidden sm:inline">
                            ({w.accountNumber})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                      {hideBalances ? '••••••' : formatETB(bal)}
                    </td>
                  </tr>
                );
              })}
              {/* Total Row */}
              <tr className="bg-slate-100/90 dark:bg-[#151C2A] border-t-2 border-slate-200 dark:border-[#223046]">
                <td className="py-3 px-4 font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                  Total
                </td>
                <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-[#00D4AA] text-sm sm:text-base">
                  {hideBalances ? '••••••' : formatETB(totalNetBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Digital & Cash Capital Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Total Digital Money Summary Card */}
        <div className="bg-gradient-to-br from-[#00D4AA]/15 via-white to-slate-50 dark:via-[#131926] dark:to-[#0F172A] border border-[#00D4AA]/35 rounded-2xl p-3.5 space-y-2 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#00D4AA]/10 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#00D4AA]/20 border border-[#00D4AA]/40 flex items-center justify-center text-[#00D4AA]">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <span>Digital Money</span>
                  <span className="text-[9px] bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/30 px-1.5 py-0.2 rounded font-mono font-bold">
                    {digitalWallets.length} ACCTS
                  </span>
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Telebirr, CBE Bank, E-birr</p>
              </div>
            </div>
            <Globe className="w-4 h-4 text-[#00D4AA]/70" />
          </div>

          <div className="pt-1 relative z-10">
            <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Total Digital Capital</p>
            <p className="text-lg font-black font-mono text-[#00D4AA]">
              {hideBalances ? '••••••••' : formatETB(totalDigitalAmount)}
            </p>
          </div>
        </div>

        {/* Total Cash Money Summary Card */}
        <div id="tour-vault-section" data-tour="vault-section" className="bg-gradient-to-br from-emerald-500/15 via-white to-slate-50 dark:via-[#131926] dark:to-[#0F172A] border border-emerald-500/35 rounded-2xl p-3.5 space-y-2 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <span>Cash Money</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                    {cashWallets.length} CASH
                  </span>
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Physical register & drawer</p>
              </div>
            </div>
            <DollarSign className="w-4 h-4 text-emerald-600/70 dark:text-emerald-400/70" />
          </div>

          <div className="pt-1 relative z-10">
            <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Total Physical Cash</p>
            <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
              {hideBalances ? '••••••••' : formatETB(totalCashAmount)}
            </p>
          </div>
        </div>

        {/* Total Net Liquidity Card */}
        <div className="bg-gradient-to-br from-blue-500/15 via-white to-slate-50 dark:via-[#131926] dark:to-[#0F172A] border border-blue-500/35 rounded-2xl p-3.5 space-y-2 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Vault className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <span>Net Liquidity</span>
                  <span className="text-[9px] bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                    COMBINED
                  </span>
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Digital + Cash Liquid Pool</p>
              </div>
            </div>
          </div>

          <div className="pt-1 relative z-10">
            <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Grand Total Capital</p>
            <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
              {hideBalances ? '••••••••' : formatETB(totalNetBalance)}
            </p>
          </div>
        </div>

      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#131926] p-1 rounded-xl border border-slate-200 dark:border-[#1E2D40] w-fit flex-wrap">
        <button
          onClick={() => {
            triggerHaptic('light');
            setCategoryFilter('ALL');
          }}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            categoryFilter === 'ALL'
              ? 'bg-white dark:bg-[#1C2333] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-[#1E2D40]'
              : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All ({wallets.length})
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setCategoryFilter('ACTIVE');
          }}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
            categoryFilter === 'ACTIVE'
              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Check className="w-3 h-3" />
          <span>Active ({wallets.filter(w => isWalletActive(w)).length})</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setCategoryFilter('DIGITAL');
          }}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
            categoryFilter === 'DIGITAL'
              ? 'bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/40 shadow-sm'
              : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Smartphone className="w-3 h-3" />
          <span>Digital ({digitalWallets.length})</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setCategoryFilter('CASH');
          }}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
            categoryFilter === 'CASH'
              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 shadow-sm'
              : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Banknote className="w-3 h-3" />
          <span>Cash ({cashWallets.length})</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setCategoryFilter('CREDIT');
          }}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
            categoryFilter === 'CREDIT'
              ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-3 h-3" />
          <span>Credit / Loan ({wallets.filter(w => isOverdraftAllowed(w)).length})</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setCategoryFilter('ARCHIVED');
          }}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
            categoryFilter === 'ARCHIVED'
              ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/40 shadow-sm'
              : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Lock className="w-3 h-3" />
          <span>Archived ({wallets.filter(w => !isWalletActive(w)).length})</span>
        </button>
      </div>

      {/* Wallet Cards Grid with Custom Color Styling */}
      <div id="tour-wallets-grid" data-tour="wallets-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredWallets.map((w, index) => {
          const bal = calculateWalletBalance(w, transactions, transfers);
          const isSelected = w.id === selectedWalletId;
          const isDigital = w.type !== 'CASH';
          const active = isWalletActive(w);
          const creditAllowed = isOverdraftAllowed(w);

          return (
            <div
              key={w.id}
              id={index === 0 ? "tour-wallet-card" : undefined}
              data-tour={index === 0 ? "wallet-card" : undefined}
              onClick={() => {
                triggerHaptic('light');
                setSelectedWalletId(w.id);
              }}
              style={{
                borderColor: isSelected ? w.color : `${w.color}40`,
                boxShadow: isSelected ? `0 4px 20px ${w.color}25` : `0 2px 8px ${w.color}08`
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group hover:scale-[1.01] bg-white dark:bg-[#131926] ${
                isSelected ? 'ring-1' : ''
              } ${!active ? 'opacity-70 bg-slate-50 dark:bg-[#10141f]' : ''}`}
            >
              {/* Radial gradient glow tailored to wallet color */}
              <div
                className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-20 transition-opacity group-hover:opacity-35"
                style={{ backgroundColor: w.color }}
              />

              {/* Left accent color bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                style={{ backgroundColor: w.color }}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="shrink-0 transition-transform group-hover:scale-105">
                    {getWalletIcon(w.type, w.color, w.customLogoUrl, 'md')}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-[#F0F4FF]">{w.name}</h3>
                      <span
                        className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full border"
                        style={{
                          backgroundColor: isDigital ? '#00D4AA15' : '#22C55E15',
                          color: isDigital ? '#00D4AA' : '#16A34A',
                          borderColor: isDigital ? '#00D4AA35' : '#22C55E35'
                        }}
                      >
                        {isDigital ? 'DIGITAL' : 'CASH'}
                      </span>

                      {!active && (
                        <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                          {w.status || 'ARCHIVED'}
                        </span>
                      )}

                      {creditAllowed && (
                        <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-300 dark:border-purple-800" title="Overdraft permitted for this account">
                          Credit Allowed
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono mt-0.5">
                      {w.accountNumber || w.type}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Edit wallet button */}
                  {onUpdateWallet && (currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(w);
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Edit Wallet Settings"
                    >
                      <Palette className="w-3 h-3" style={{ color: w.color }} />
                    </button>
                  )}

                  {/* Delete wallet button */}
                  {onDeleteWallet && (currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(w);
                      }}
                      className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                      title="Delete / Remove Wallet"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  <div
                    className="w-3.5 h-3.5 rounded-full border border-slate-200 dark:border-white/30 shadow-sm"
                    style={{ backgroundColor: w.color }}
                    title={`Theme: ${w.color}`}
                  />
                </div>
              </div>

              <div className="mt-3.5 flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Computed Balance</p>
                  <p
                    className="text-lg font-black font-mono mt-0.5"
                    style={{ color: w.color }}
                  >
                    {hideBalances ? '••••••••' : formatETB(bal)}
                  </p>
                </div>

                {isSelected && (
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-800 dark:text-white flex items-center gap-1">
                    <Check className="w-3 h-3 text-[#00D4AA]" /> Selected
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Wallet Ledger History & Quick Actions */}
      {selectedWallet && (
        <div
          id="tour-wallets-ledger"
          data-tour="wallets-ledger"
          className="bg-white dark:bg-[#131926] border rounded-2xl p-4 space-y-3 transition-colors shadow-sm"
          style={{ borderColor: `${selectedWallet.color}40` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-2.5 gap-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-[#F0F4FF] flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ backgroundColor: `${selectedWallet.color}25` }}
              >
                <History className="w-3 h-3" style={{ color: selectedWallet.color }} />
              </div>
              <span>{selectedWallet.name} — Recent Activity ({walletTxs.length})</span>
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-50 dark:bg-[#1C2333] border"
                style={{ color: selectedWallet.color, borderColor: `${selectedWallet.color}30` }}
              >
                Current: {hideBalances ? '••••••••' : formatETB(selectedBal)}
              </span>

              {onOpenQuickEntry && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    onOpenQuickEntry(selectedWallet.id);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  title="Deposit or record money in this wallet"
                >
                  <Plus className="w-3 h-3" />
                  <span>Deposit / Record</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onOpenTransferModal();
                }}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                title="Transfer funds between wallets"
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>Transfer</span>
              </button>

              {onUpdateWallet && (currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin') && (
                <button
                  type="button"
                  onClick={() => openEditModal(selectedWallet)}
                  className="p-1 rounded-lg bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  title="Edit Wallet Settings"
                >
                  <Palette className="w-3 h-3" style={{ color: selectedWallet.color }} />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
            {walletTxs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-[#8899BB] py-4 text-center">
                No transactions recorded for this wallet.
              </p>
            ) : (
              walletTxs.map((tx) => {
                const isCreditCollected = isCreditSaleCollected(tx);
                return (
                  <div
                    key={tx.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                      isCreditCollected
                        ? 'bg-purple-50/40 dark:bg-purple-950/25 border-purple-200 dark:border-purple-800/40'
                        : 'bg-slate-50 dark:bg-[#1C2333] border-slate-200/80 dark:border-[#1E2D40]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-900 dark:text-[#F0F4FF]">{getTransactionDisplayTitle(tx, receivables)}</p>
                        {isCreditCollected && (
                          <span className="text-[8px] bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 font-bold px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-500/30 shrink-0">
                            Daily Income / Collected
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-[#8899BB] mt-0.5">
                        <span className={isCreditCollected ? "text-purple-700 dark:text-purple-300 font-semibold" : ""}>{tx.category}</span> • {new Date(tx.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`font-mono font-bold ${
                      isCreditCollected
                        ? 'text-purple-600 dark:text-purple-400 font-black'
                        : tx.type === 'INCOME'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-red-400'
                    }`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{formatETB(Math.abs(tx.amount))}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal: Create New Wallet with Custom Coloring */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] w-full max-w-md p-5 rounded-2xl space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#00D4AA]/20 text-[#00D4AA] flex items-center justify-center">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create Business Wallet</h3>
                  <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Choose custom coloring & account channel</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-600 dark:text-[#8899BB] block mb-1">Wallet Name</label>
                <input
                  type="text"
                  required
                  value={newWalletName}
                  onChange={e => setNewWalletName(e.target.value)}
                  placeholder="Wallet name"
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-[#00D4AA]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-[#8899BB] block mb-1">Account Type & Channel</label>
                <select
                  value={newWalletType}
                  onChange={e => handleTypeChange(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-[#00D4AA]"
                >
                  <option value="TELEBIRR">Telebirr Mobile Money [Digital]</option>
                  <option value="CBE_BANK">CBE Commercial Bank [Digital]</option>
                  <option value="EBIRR">E-birr Mobile Account [Digital]</option>
                  <option value="CASH">Cash Register / Physical Drawer [Cash]</option>
                  <option value="SAVINGS">Bank Reserve / Savings [Digital]</option>
                  <option value="OTHER">Other Custom Account [Digital]</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-[#8899BB] block mb-1">Account / Phone Number (Optional)</label>
                <input
                  type="text"
                  value={newWalletAccNum}
                  onChange={e => setNewWalletAccNum(e.target.value)}
                  placeholder="Account or phone"
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-[#00D4AA]"
                />
              </div>

              {/* Wallet Color Selection Palette */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00D4AA]" />
                    <span>Choose Wallet Theme Color</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-[#8899BB] uppercase">{newWalletColor}</span>
                </div>

                {/* Preset Color Swatches */}
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setNewWalletColor(c.hex);
                      }}
                      className={`h-8 rounded-xl flex items-center justify-center transition-transform cursor-pointer relative ${
                        newWalletColor === c.hex ? 'ring-2 ring-slate-900 dark:ring-white scale-105' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {newWalletColor === c.hex && (
                        <Check className="w-4 h-4 text-white drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Hex / Color Picker input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={newWalletColor}
                    onChange={e => setNewWalletColor(e.target.value)}
                    className="w-9 h-9 rounded-xl border-0 bg-transparent cursor-pointer"
                    title="Custom Color Picker"
                  />
                  <input
                    type="text"
                    value={newWalletColor}
                    onChange={e => setNewWalletColor(e.target.value)}
                    placeholder="#00D4AA"
                    className="flex-1 bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Custom Logo Upload Section */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#1E2D40]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00D4AA]" />
                    <span>Custom Brand Logo (Upload / URL)</span>
                  </label>
                  {newCustomLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setNewCustomLogoUrl('')}
                      className="text-[10px] text-rose-500 hover:underline flex items-center gap-0.5"
                    >
                      <X className="w-3 h-3" /> Reset Logo
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-slate-50 dark:bg-[#1C2333] border border-dashed border-slate-300 dark:border-[#1E2D40] hover:border-emerald-500 dark:hover:border-[#00D4AA] rounded-xl p-2.5 flex items-center justify-center gap-2 transition-colors">
                    <Upload className="w-4 h-4 text-emerald-600 dark:text-[#00D4AA]" />
                    <span className="text-xs text-slate-700 dark:text-[#F0F4FF] font-medium">
                      {newCustomLogoUrl ? 'Change Image File...' : 'Upload Logo File (PNG/JPG/SVG)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleLogoFileUpload(e, setNewCustomLogoUrl)}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 dark:text-[#8899BB]">Or Web URL:</span>
                  <input
                    type="text"
                    value={newCustomLogoUrl}
                    onChange={(e) => setNewCustomLogoUrl(e.target.value)}
                    placeholder="https://... / logo.png"
                    className="flex-1 bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-1.5 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Live Preview of Wallet Card */}
              <div className="pt-2">
                <p className="text-[10px] text-slate-500 dark:text-[#8899BB] mb-1 font-bold">Live Theme Preview:</p>
                <div
                  className="p-3 rounded-xl border flex items-center justify-between bg-slate-50 dark:bg-[#1C2333]"
                  style={{
                    borderColor: newWalletColor,
                    boxShadow: `0 4px 15px ${newWalletColor}20`
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0">
                      {getWalletIcon(newWalletType, newWalletColor, newCustomLogoUrl, 'sm')}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {newWalletName || 'Wallet Name Preview'}
                        </span>
                        <span
                          className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full border"
                          style={{
                            backgroundColor: newWalletType !== 'CASH' ? '#00D4AA15' : '#22C55E15',
                            color: newWalletType !== 'CASH' ? '#00D4AA' : '#22C55E',
                            borderColor: newWalletType !== 'CASH' ? '#00D4AA35' : '#22C55E35'
                          }}
                        >
                          {newWalletType !== 'CASH' ? 'DIGITAL' : 'CASH'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-[#8899BB] font-mono">
                        {newWalletAccNum || newWalletType}
                      </p>
                    </div>
                  </div>

                  <div
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: newWalletColor }}
                  />
                </div>
              </div>

              {/* Account Status & Overdraft Controls */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#1E2D40]">
                <label className="text-xs font-bold text-slate-900 dark:text-white block">
                  Account Governance & Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ACTIVE', 'ARCHIVED', 'DISABLED'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setNewWalletStatus(st);
                      }}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        newWalletStatus === st
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                          : 'bg-slate-50 dark:bg-[#1C2333] text-slate-600 dark:text-[#8899BB] border-slate-200 dark:border-[#1E2D40]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWalletIsCredit}
                      onChange={e => {
                        setNewWalletIsCredit(e.target.checked);
                        if (e.target.checked) setNewWalletAllowOverdraft(true);
                      }}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">Credit / Loan Facility</span>
                      <span className="text-slate-500 dark:text-[#8899BB]">Designates this wallet as a line of credit or loan account.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWalletAllowOverdraft}
                      onChange={e => setNewWalletAllowOverdraft(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">Permit Negative Balance (Overdraft)</span>
                      <span className="text-slate-500 dark:text-[#8899BB]">Bypasses strict zero-balance overdraft blocks during expenses and transfers.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-[#8899BB] block mb-1">Opening Balance (ETB)</label>
                <input
                  type="number"
                  value={newWalletBal}
                  onChange={e => setNewWalletBal(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-[#00D4AA]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[#0A0E1A] transition-colors shadow-lg"
                  style={{ backgroundColor: newWalletColor }}
                >
                  Create Wallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing Wallet (Full CRUD) */}
      {editingWallet && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] w-full max-w-md p-5 rounded-2xl space-y-4 shadow-2xl text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${editColor}25` }}
                >
                  <Palette className="w-4 h-4" style={{ color: editColor }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Wallet Details</h3>
                  <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">{editingWallet.name}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveEditWallet} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-600 dark:text-[#8899BB] block mb-1">Wallet Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Wallet name"
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-[#8899BB] block mb-1">Account Category / Type</label>
                <select
                  value={editType}
                  onChange={e => {
                    const newT = e.target.value as Wallet['type'];
                    setEditType(newT);
                    if (DEFAULT_TYPE_COLORS[newT]) {
                      setEditColor(DEFAULT_TYPE_COLORS[newT]);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none"
                >
                  <option value="TELEBIRR">Telebirr Merchant</option>
                  <option value="CBE_BANK">CBE Bank Account</option>
                  <option value="EBIRR">eBirr Agent Account</option>
                  <option value="CASH">Physical Cash Drawer</option>
                  <option value="SAVINGS">Bank Savings Account</option>
                  <option value="OTHER">Other Custom Account</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-[#8899BB] block mb-1">Account / IBAN Number</label>
                <input
                  type="text"
                  value={editAccNum}
                  onChange={e => setEditAccNum(e.target.value)}
                  placeholder="Account number"
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              {/* Live Balance & Baseline Recalibration */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1A2234] border border-slate-200 dark:border-[#223049] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-[#A0B0CB]">Current Live Balance:</span>
                  <span className="font-bold text-emerald-600 dark:text-[#00D4AA] font-mono">
                    {formatETB(calculateWalletBalance(editingWallet, transactions, transfers))}
                  </span>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-[#CBD5E1] block mb-1">
                    Set Real Current Balance (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editTargetBal}
                    onChange={e => {
                      setEditTargetBal(e.target.value);
                      const target = parseFloat(e.target.value);
                      if (!isNaN(target)) {
                        const newOp = getAdjustedOpeningBalanceForTargetBalance(editingWallet.id, target, transactions, transfers);
                        setEditOpeningBal(String(newOp));
                      }
                    }}
                    placeholder="Enter actual real balance"
                    className="w-full bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-lg p-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-[#8899BB] mt-1 leading-relaxed">
                    Adjusts this wallet to your real balance so tracking continues accurately from now on. (Calculated baseline: {formatETB(parseFloat(editOpeningBal) || 0)})
                  </p>
                </div>
              </div>

              {/* Color Swatches */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 dark:text-white block">Theme Color Palette</label>
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setEditColor(c.hex);
                      }}
                      className={`h-8 rounded-xl flex items-center justify-center transition-transform cursor-pointer ${
                        editColor === c.hex ? 'ring-2 ring-slate-900 dark:ring-white scale-105' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    >
                      {editColor === c.hex && (
                        <Check className="w-4 h-4 text-white drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    className="w-9 h-9 rounded-xl border-0 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2 text-xs font-mono text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Custom Logo Upload Section */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#1E2D40]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-purple-500" />
                    <span>Upload Custom Brand Logo</span>
                  </label>
                  {editCustomLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditCustomLogoUrl('')}
                      className="text-[10px] text-rose-500 hover:underline flex items-center gap-0.5"
                    >
                      <X className="w-3 h-3" /> Remove Custom Logo
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="shrink-0">
                    {getWalletIcon(editType, editColor, editCustomLogoUrl, 'md')}
                  </div>

                  <label className="flex-1 cursor-pointer bg-slate-50 dark:bg-[#1C2333] border border-dashed border-slate-300 dark:border-[#1E2D40] hover:border-purple-500 rounded-xl p-2.5 flex items-center justify-center gap-2 transition-colors">
                    <Upload className="w-4 h-4 text-purple-500" />
                    <span className="text-xs text-slate-700 dark:text-[#F0F4FF] font-medium">
                      {editCustomLogoUrl ? 'Replace Logo File...' : 'Choose Logo File (PNG/JPG/SVG)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleLogoFileUpload(e, setEditCustomLogoUrl)}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 dark:text-[#8899BB]">Or Web URL:</span>
                  <input
                    type="text"
                    value={editCustomLogoUrl}
                    onChange={(e) => setEditCustomLogoUrl(e.target.value)}
                    placeholder="https://... / logo.png"
                    className="flex-1 bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-1.5 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Account Status & Overdraft Controls */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#1E2D40]">
                <label className="text-xs font-bold text-slate-900 dark:text-white block">
                  Account Governance & Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ACTIVE', 'ARCHIVED', 'DISABLED'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setEditStatus(st);
                      }}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        editStatus === st
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                          : 'bg-slate-50 dark:bg-[#1C2333] text-slate-600 dark:text-[#8899BB] border-slate-200 dark:border-[#1E2D40]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsCredit}
                      onChange={e => {
                        setEditIsCredit(e.target.checked);
                        if (e.target.checked) setEditAllowOverdraft(true);
                      }}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">Credit / Loan Facility</span>
                      <span className="text-slate-500 dark:text-[#8899BB]">Designates this wallet as a line of credit or loan account.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editAllowOverdraft}
                      onChange={e => setEditAllowOverdraft(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">Permit Negative Balance (Overdraft)</span>
                      <span className="text-slate-500 dark:text-[#8899BB]">Bypasses strict zero-balance overdraft blocks during expenses and transfers.</span>
                    </div>
                  </label>
                </div>
              </div>

              {onDeleteWallet && (currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin') && (
                <div className="pt-2 border-t border-slate-200 dark:border-[#1E2D40]">
                  <button
                    type="button"
                    onClick={() => {
                      const w = editingWallet;
                      setEditingWallet(null);
                      openDeleteModal(w);
                    }}
                    className="w-full py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Wallet Option</span>
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWallet(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[#0A0E1A] shadow-md"
                  style={{ backgroundColor: editColor }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Wallet Confirmation (With Co-User Approval Flow) */}
      {deletingWallet && (() => {
        const canDeleteDirectly = otherActiveUsers.length === 0;
        const selectedApprover = otherActiveUsers.find(u => u.id === selectedApproverId);
        const isAuthorizedToConfirm = canDeleteDirectly || (selectedApprover && (approvalConfirmed || approverPassword.trim().length > 0));

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#131926] border border-rose-200 dark:border-rose-900/50 w-full max-w-md p-5 rounded-2xl space-y-4 shadow-2xl text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Wallet</h3>
                  <p className="text-xs text-slate-500 dark:text-[#8899BB]">{deletingWallet.name}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-[#8899BB]">Wallet Name:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{deletingWallet.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-[#8899BB]">Account / Type:</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{deletingWallet.accountNumber || deletingWallet.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-[#8899BB]">Current Balance:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-[#00D4AA]">
                    {formatETB(calculateWalletBalance(deletingWallet, transactions, transfers))}
                  </span>
                </div>
              </div>

              {/* User Availability & Multi-User Approval Logic */}
              {canDeleteDirectly ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                    <Check className="w-4 h-4" />
                    <span>Direct Deletion Authorized</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-[#8899BB] leading-relaxed">
                    No other active co-users are registered in the system. Direct deletion is authorized.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Co-User Approval Protocol Required</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold">
                      {otherActiveUsers.length} {otherActiveUsers.length === 1 ? 'co-user available' : 'co-users available'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-[#8899BB] leading-snug">
                    Because other active users exist in your workspace, deleting a company wallet requires approval or authorization sign-off from an available co-user.
                  </p>

                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-[#8899BB] block mb-1">
                        Select Approving Co-User
                      </label>
                      <select
                        value={selectedApproverId}
                        onChange={e => {
                          setSelectedApproverId(e.target.value);
                          setApprovalConfirmed(false);
                          setApprovalError('');
                        }}
                        className="w-full bg-white dark:bg-[#131926] border border-slate-300 dark:border-[#1E2D40] rounded-xl p-2 text-xs font-medium text-slate-900 dark:text-white outline-none"
                      >
                        {otherActiveUsers.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.branch})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedApprover && (
                      <div className="p-2.5 bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-[#8899BB]">Approver Name:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{selectedApprover.name}</span>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-[#8899BB] block mb-1">
                            Approver Password or Auth Code (Optional)
                          </label>
                          <input
                            type="password"
                            value={approverPassword}
                            onChange={e => {
                              setApproverPassword(e.target.value);
                              setApprovalError('');
                            }}
                            placeholder="Enter approver password or leave blank for sign-off"
                            className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none"
                          />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={approvalConfirmed}
                            onChange={e => {
                              triggerHaptic('light');
                              setApprovalConfirmed(e.target.checked);
                            }}
                            className="rounded border-slate-300 dark:border-slate-700 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                            I confirm that <strong>{selectedApprover.name}</strong> has granted authorization sign-off to remove this wallet.
                          </span>
                        </label>
                      </div>
                    )}

                    {approvalError && (
                      <p className="text-[11px] text-rose-500 font-bold">{approvalError}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingWallet(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isAuthorizedToConfirm}
                  onClick={() => {
                    if (!canDeleteDirectly && selectedApprover) {
                      if (approverPassword.trim() && selectedApprover.password) {
                        if (approverPassword.trim() !== selectedApprover.password) {
                          setApprovalError(`Invalid password for ${selectedApprover.name}. Please enter correct password or check sign-off.`);
                          return;
                        }
                      }
                      if (!approvalConfirmed && !approverPassword.trim()) {
                        setApprovalError(`Please confirm sign-off or enter password for ${selectedApprover.name}.`);
                        return;
                      }
                    }

                    triggerHaptic('medium');
                    if (onDeleteWallet) {
                      onDeleteWallet(deletingWallet.id);
                    }
                    if (selectedWalletId === deletingWallet.id) {
                      const remaining = wallets.filter(w => w.id !== deletingWallet.id);
                      setSelectedWalletId(remaining[0]?.id || null);
                    }
                    setDeletingWallet(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
                    isAuthorizedToConfirm
                      ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                      : 'bg-rose-400 dark:bg-rose-950/60 opacity-50 cursor-not-allowed'
                  }`}
                >
                  {canDeleteDirectly ? 'Yes, Remove Wallet' : 'Approve & Delete Wallet'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Telebirr, CBE & eBirr Integration Modal */}
      <TelebirrIntegrationModal
        isOpen={showIntegrationModal}
        onClose={() => setShowIntegrationModal(false)}
        wallets={wallets}
        transactions={transactions}
        transfers={transfers}
        onUpdateWallet={onUpdateWallet}
        onAddTransaction={onAddTransaction}
        onBatchPostTransactions={onBatchPostTransactions}
      />

      {/* ShegerPay & CBE FT Verification Modal */}
      <ShegerPayVerificationModal
        isOpen={showShegerModal}
        onClose={() => setShowShegerModal(false)}
        wallets={wallets}
        onAddTransaction={onAddTransaction}
      />

      {/* Auto-Import & Bank SMS Queue Hub Modal */}
      <AutoImportHubModal
        isOpen={showAutoImportHub}
        onClose={() => setShowAutoImportHub(false)}
        wallets={wallets}
        transactions={transactions}
        users={users}
        currentUser={currentUser}
        autoImportSettings={autoImportSettings}
        pendingReviewTransactions={pendingReviewTransactions}
        onUpdateState={onUpdateState || (() => {})}
        onAddTransaction={onAddTransaction}
      />

      {/* Modal: Full Multi-Wallet Reconciliation */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] w-full max-w-lg p-5 sm:p-6 rounded-2xl space-y-4 shadow-2xl text-slate-900 dark:text-white max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Reconcile Wallet Balances</h3>
                  <p className="text-xs text-slate-500 dark:text-[#8899BB]">
                    Sync your live balances to match your actual mobile money & cash
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReconcileModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E2D40] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <span>💡 Fix mismatches from previous apps or old imports</span>
              </p>
              <p className="text-[11px] leading-relaxed opacity-90">
                Enter your real current balances below. The system will recalibrate each wallet's initial baseline so your active balances match your real accounts going forward.
              </p>
            </div>

            <div className="space-y-3">
              {cashAvailableWallets.filter(w => isWalletActive(w)).map((w) => {
                const currentBal = calculateWalletBalance(w, transactions, transfers);
                const enteredVal = reconcileBalances[w.id] ?? String(currentBal);
                const targetBal = parseFloat(enteredVal) || 0;
                const diff = targetBal - currentBal;

                return (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#172033] border border-slate-200 dark:border-[#223049] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0">
                        {getWalletIcon(w.type, w.color, w.customLogoUrl, 'sm')}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {w.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-[#8899BB] truncate">
                          Current in app: <span className="font-semibold text-slate-700 dark:text-[#CBD5E1]">{formatETB(currentBal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          ETB
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={reconcileBalances[w.id] ?? ''}
                          onChange={(e) => {
                            setReconcileBalances(prev => ({
                              ...prev,
                              [w.id]: e.target.value
                            }));
                          }}
                          placeholder={String(currentBal)}
                          className="w-32 bg-white dark:bg-[#101623] border border-slate-300 dark:border-[#2A3B53] focus:border-amber-500 rounded-lg py-1.5 pl-9 pr-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none text-right"
                        />
                      </div>

                      {diff !== 0 && (
                        <span
                          className={`text-[10px] font-bold px-2 py-1 rounded-md shrink-0 ${
                            diff > 0
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-[#00D4AA]'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          {diff > 0 ? `+${diff.toFixed(0)}` : diff.toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-[#1E2D40] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  const resetMap: Record<string, string> = {};
                  wallets.forEach(w => {
                    resetMap[w.id] = String(calculateWalletBalance(w, transactions, transfers));
                  });
                  setReconcileBalances(resetMap);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8899BB] hover:bg-slate-100 dark:hover:bg-[#1E2D40] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Recorded</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8899BB] hover:bg-slate-100 dark:hover:bg-[#1E2D40] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('success');
                    if (onUpdateWallet) {
                      wallets.forEach(w => {
                        const valStr = reconcileBalances[w.id];
                        if (valStr !== undefined && valStr.trim() !== '') {
                          const target = parseFloat(valStr);
                          if (!isNaN(target)) {
                            const newOp = getAdjustedOpeningBalanceForTargetBalance(
                              w.id,
                              target,
                              transactions,
                              transfers
                            );
                            onUpdateWallet(w.id, { openingBalance: newOp });
                          }
                        }
                      });
                    }
                    setShowReconcileModal(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md transition-all cursor-pointer"
                >
                  Save & Apply Real Balances
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
