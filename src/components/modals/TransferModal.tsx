import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowRightLeft,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Lock,
  History,
  PlusCircle,
  Edit2,
  Trash2,
  Search,
  Calendar,
  Filter,
  Check,
  RotateCcw
} from 'lucide-react';
import { Wallet, Transfer } from '../../types';
import {
  calculateWalletBalance,
  formatETB,
  getWalletNickname,
  isOverdraftAllowed,
  isWalletActive,
  validateTransfer
} from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import { ModernDateInput } from '../common/ModernDateInput';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  transactions: any[];
  transfers: Transfer[];
  onExecuteTransfer: (data: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    reason: string;
    date?: string;
  }) => void;
  onUpdateTransfer?: (
    transferId: string,
    data: {
      fromWalletId: string;
      toWalletId: string;
      amount: number;
      reason: string;
      date?: string;
    }
  ) => void;
  onDeleteTransfer?: (transferId: string) => void;
  initialTab?: 'create' | 'history';
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  wallets,
  transactions,
  transfers = [],
  onExecuteTransfer,
  onUpdateTransfer,
  onDeleteTransfer,
  initialTab = 'create'
}) => {
  const activeWallets = wallets.filter(w => isWalletActive(w));

  // Active view tab: 'create' | 'history'
  const [activeTab, setActiveTab] = useState<'create' | 'history'>(initialTab);

  // --- Create Mode State ---
  const [fromWalletId, setFromWalletId] = useState(activeWallets[0]?.id || wallets[0]?.id || '');
  const [toWalletId, setToWalletId] = useState(
    activeWallets.find(w => w.id !== fromWalletId)?.id || activeWallets[1]?.id || ''
  );
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // --- History Mode State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWalletId, setFilterWalletId] = useState<string>('ALL');

  // --- Edit Mode State ---
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [editFromWalletId, setEditFromWalletId] = useState('');
  const [editToWalletId, setEditToWalletId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editValidationError, setEditValidationError] = useState<string | null>(null);

  // --- Delete Mode State ---
  const [deletingTransfer, setDeletingTransfer] = useState<Transfer | null>(null);

  const resetCreateForm = () => {
    setAmount('');
    setReason('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setValidationError(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetCreateForm();
      setActiveTab(initialTab);
      const currentActive = wallets.filter(w => isWalletActive(w));
      if (currentActive.length > 0) {
        setFromWalletId(currentActive[0].id);
        setToWalletId(currentActive.find(w => w.id !== currentActive[0].id)?.id || currentActive[1]?.id || '');
      }
    }
  }, [isOpen, initialTab, wallets]);

  const handleClose = () => {
    resetCreateForm();
    setEditingTransfer(null);
    setDeletingTransfer(null);
    onClose();
  };

  if (!isOpen) return null;

  // --- Calculations for Create ---
  const fromWallet = wallets.find(w => w.id === fromWalletId);
  const toWallet = wallets.find(w => w.id === toWalletId);
  const availableBalance = fromWallet
    ? calculateWalletBalance(fromWallet, transactions, transfers)
    : 0;
  const toAvailableBalance = toWallet
    ? calculateWalletBalance(toWallet, transactions, transfers)
    : 0;
  const numAmount = parseFloat(amount) || 0;
  const fromAllowsOverdraft = fromWallet ? isOverdraftAllowed(fromWallet) : false;

  // --- Calculations for Edit ---
  const editFromWallet = wallets.find(w => w.id === editFromWalletId);
  const editToWallet = wallets.find(w => w.id === editToWalletId);
  const editTransfersExcludingCurrent = editingTransfer
    ? transfers.filter(t => t.id !== editingTransfer.id)
    : transfers;
  const editFromBalance = editFromWallet
    ? calculateWalletBalance(editFromWallet, transactions, editTransfersExcludingCurrent)
    : 0;
  const editToBalance = editToWallet
    ? calculateWalletBalance(editToWallet, transactions, editTransfersExcludingCurrent)
    : 0;
  const editNumAmount = parseFloat(editAmount) || 0;

  // --- Filtered History ---
  const filteredTransfers = transfers.filter(tr => {
    if (filterWalletId !== 'ALL') {
      if (tr.fromWalletId !== filterWalletId && tr.toWalletId !== filterWalletId) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fromW = wallets.find(w => w.id === tr.fromWalletId);
      const toW = wallets.find(w => w.id === tr.toWalletId);
      const matchReason = (tr.reason || '').toLowerCase().includes(q);
      const matchFrom = (fromW?.name || '').toLowerCase().includes(q);
      const matchTo = (toW?.name || '').toLowerCase().includes(q);
      const matchAmt = tr.amount.toString().includes(q);
      const matchDate = (tr.date || '').toLowerCase().includes(q);
      return matchReason || matchFrom || matchTo || matchAmt || matchDate;
    }
    return true;
  });

  const totalTransferredVolume = transfers.reduce((sum, t) => sum + t.amount, 0);

  // --- Handlers ---
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setValidationError('Please enter a valid transfer amount greater than ETB 0.');
      triggerHaptic('warning');
      return;
    }

    const validation = validateTransfer(
      fromWallet,
      toWallet,
      transferAmount,
      transactions,
      transfers
    );

    if (!validation.valid) {
      triggerHaptic('warning');
      setValidationError(validation.error || 'Transfer validation failed.');
      return;
    }

    triggerHaptic('success');
    onExecuteTransfer({
      fromWalletId,
      toWalletId,
      amount: transferAmount,
      reason: reason.trim() || `Transfer to ${toWallet?.name || 'Wallet'}`,
      date: transferDate ? new Date(transferDate).toISOString() : new Date().toISOString()
    });

    resetCreateForm();
    onClose();
  };

  const handleStartEdit = (tr: Transfer) => {
    triggerHaptic('light');
    setEditingTransfer(tr);
    setEditFromWalletId(tr.fromWalletId);
    setEditToWalletId(tr.toWalletId);
    setEditAmount(tr.amount.toString());
    setEditReason(tr.reason || '');
    setEditDate(tr.date ? tr.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditValidationError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransfer || !onUpdateTransfer) return;

    setEditValidationError(null);
    const parsedAmt = parseFloat(editAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setEditValidationError('Please enter a valid transfer amount greater than ETB 0.');
      triggerHaptic('warning');
      return;
    }

    const validation = validateTransfer(
      editFromWallet,
      editToWallet,
      parsedAmt,
      transactions,
      transfers,
      editingTransfer.id
    );

    if (!validation.valid) {
      triggerHaptic('warning');
      setEditValidationError(validation.error || 'Transfer validation failed.');
      return;
    }

    triggerHaptic('success');
    onUpdateTransfer(editingTransfer.id, {
      fromWalletId: editFromWalletId,
      toWalletId: editToWalletId,
      amount: parsedAmt,
      reason: editReason.trim() || `Transfer to ${editToWallet?.name || 'Wallet'}`,
      date: editDate ? new Date(editDate).toISOString() : editingTransfer.date
    });

    setEditingTransfer(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingTransfer || !onDeleteTransfer) return;

    triggerHaptic('warning');
    onDeleteTransfer(deletingTransfer.id);
    setDeletingTransfer(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] w-full max-w-lg rounded-2xl p-5 text-slate-900 dark:text-[#F0F4FF] shadow-2xl animate-slideUp max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1E2D40] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-600 dark:text-[#3B82F6] flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Inter-Wallet Transfers</h2>
              <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Full CRUD management for balanced ledger transfers</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg bg-slate-100 dark:bg-[#1C2333] text-slate-500 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Create vs History */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-[#0D121F] rounded-xl my-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('create');
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md'
                : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Execute New Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('history');
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md'
                : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Transfer History & Records</span>
            <span className="text-[10px] bg-black/20 text-white px-1.5 py-0.2 rounded font-mono font-bold">
              {transfers.length}
            </span>
          </button>
        </div>

        {/* ================= TAB 1: CREATE TRANSFER ================= */}
        {activeTab === 'create' && (
          <div className="overflow-y-auto pr-1 space-y-4 flex-1">
            {/* Blocking Validation Alert */}
            {validationError && (
              <div className="p-3 bg-rose-50 text-rose-800 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/60 dark:text-rose-100 rounded-xl text-xs flex items-start gap-2 animate-shake">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900 dark:text-rose-100">Transfer Blocked</p>
                  <p className="text-[11px] mt-0.5 text-rose-800 dark:text-rose-200">{validationError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              {/* Transfer Date */}
              <div>
                <ModernDateInput
                  label="Transfer Date"
                  value={transferDate}
                  onChange={(val) => setTransferDate(val)}
                  accentColor="blue"
                  size="sm"
                  presets={[
                    { label: 'Today', value: new Date().toISOString().split('T')[0] },
                    { label: 'Yesterday', value: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
                    { label: '-3d', value: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0] },
                    { label: '-7d', value: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] }
                  ]}
                />
              </div>

              {/* From Wallet */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB]">
                    From Source Wallet (Debit)
                  </label>
                  {fromAllowsOverdraft ? (
                    <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.2 rounded border border-blue-500/20">
                      Credit Account (Overdraft Allowed)
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400 font-mono">
                      No Overdraft
                    </span>
                  )}
                </div>
                <select
                  value={fromWalletId}
                  onChange={(e) => {
                    setFromWalletId(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl py-2.5 px-3 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-semibold"
                >
                  {wallets.map(w => {
                    const active = isWalletActive(w);
                    return (
                      <option key={w.id} value={w.id} disabled={!active}>
                        {getWalletNickname(w.name)} {active ? `(Bal: ${formatETB(calculateWalletBalance(w, transactions, transfers))})` : `[${w.status || 'INACTIVE'} - Blocked]`}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Transfer Direction Indicator */}
              <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-[#3B82F6] my-1">
                <div className="h-px bg-slate-200 dark:bg-[#1E2D40] flex-1" />
                <div className="p-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div className="h-px bg-slate-200 dark:bg-[#1E2D40] flex-1" />
              </div>

              {/* To Wallet */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] block mb-1">
                  To Destination Wallet (Credit)
                </label>
                <select
                  value={toWalletId}
                  onChange={(e) => {
                    setToWalletId(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl py-2.5 px-3 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-semibold"
                >
                  {wallets.map(w => {
                    const active = isWalletActive(w);
                    return (
                      <option key={w.id} value={w.id} disabled={!active || w.id === fromWalletId}>
                        {getWalletNickname(w.name)} {w.id === fromWalletId ? '(Source Account)' : active ? `(Bal: ${formatETB(calculateWalletBalance(w, transactions, transfers))})` : `[${w.status || 'INACTIVE'} - Blocked]`}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB]">
                    Transfer Amount (ETB)
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                    Max available: <span className={`font-bold ${availableBalance < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-[#00D4AA]'}`}>{formatETB(availableBalance)}</span>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setValidationError(null);
                    }}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-blue-500 dark:focus:border-[#3B82F6] rounded-xl py-2.5 px-3 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 dark:text-[#8899BB]">ETB</span>
                </div>
              </div>

              {/* Two-Sided Balanced Transfer Preview Card */}
              {fromWallet && toWallet && (
                <div className="bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#1E2D40]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Two-Sided Ledger Preview</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-[#00D4AA] flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      Balanced (Δ ETB 0.00)
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="border-r border-slate-200 dark:border-[#1E2D40] pr-2">
                      <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block truncate">
                        Debit Leg: {getWalletNickname(fromWallet.name)}
                      </span>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">
                          -{formatETB(numAmount)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          → {formatETB(availableBalance - numAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="pl-2">
                      <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block truncate">
                        Credit Leg: {getWalletNickname(toWallet.name)}
                      </span>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="text-emerald-600 dark:text-[#00D4AA] font-mono font-bold">
                          +{formatETB(numAmount)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          → {formatETB(toAvailableBalance + numAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] block mb-1">
                  Transfer Purpose / Reason
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Bank deposit from Cash drawer"
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl py-2.5 px-3 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/20 cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm Balanced Inter-Wallet Transfer</span>
              </button>
            </form>
          </div>
        )}

        {/* ================= TAB 2: TRANSFER HISTORY & CRUD ACTIONS ================= */}
        {activeTab === 'history' && (
          <div className="overflow-y-auto pr-1 space-y-3 flex-1">
            {/* Search and Wallet Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reason or wallet..."
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={filterWalletId}
                onChange={(e) => setFilterWalletId(e.target.value)}
                className="bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
              >
                <option value="ALL">All Wallets</option>
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>
                    {getWalletNickname(w.name)}
                  </option>
                ))}
              </select>
            </div>

            {/* Overview Summary Cards */}
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0D121F] border border-slate-200 dark:border-[#1E2D40] text-xs">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block">Total Transfers</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  {filteredTransfers.length} Records
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 dark:text-[#8899BB] block">Total Transferred</span>
                <span className="font-mono font-bold text-blue-600 dark:text-[#3B82F6] text-sm">
                  {formatETB(totalTransferredVolume)}
                </span>
              </div>
            </div>

            {/* Transfer List */}
            {filteredTransfers.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-[#1E2D40] space-y-2">
                <RotateCcw className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                <p className="text-xs font-bold text-slate-600 dark:text-[#8899BB]">No Transfers Found</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {transfers.length === 0
                    ? 'No inter-wallet transfers have been made yet.'
                    : 'No transfers match your search or filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransfers.map((tr) => {
                  const fromW = wallets.find(w => w.id === tr.fromWalletId);
                  const toW = wallets.find(w => w.id === tr.toWalletId);
                  const dateFormatted = tr.date ? new Date(tr.date).toLocaleDateString() : 'N/A';

                  return (
                    <div
                      key={tr.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-blue-400/40 transition-all space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {getWalletNickname(fromW?.name || 'Source Wallet')}
                            </span>
                            <span className="text-blue-500 font-bold">➔</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {getWalletNickname(toW?.name || 'Destination Wallet')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-[#8899BB] mt-0.5">
                            {tr.reason || 'No description provided'}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-sm text-blue-600 dark:text-[#3B82F6]">
                            {formatETB(tr.amount)}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {dateFormatted}
                          </span>
                        </div>
                      </div>

                      {/* Footer with Creator and Action Buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-[#1E2D40]/60 text-[10px]">
                        <span className="text-slate-400 dark:text-[#8899BB]">
                          Recorded by <strong className="text-slate-600 dark:text-slate-300">{tr.creatorName || 'System'}</strong>
                        </span>

                        <div className="flex items-center gap-1">
                          {onUpdateTransfer && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(tr)}
                              className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-[#3B82F6] dark:hover:bg-blue-500/20 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Edit Transfer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}

                          {onDeleteTransfer && (
                            <button
                              type="button"
                              onClick={() => setDeletingTransfer(tr)}
                              className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Delete / Reverse Transfer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= MODAL: EDIT TRANSFER ================= */}
        {editingTransfer && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
            <div className="bg-white dark:bg-[#131926] border border-blue-500/50 w-full max-w-md p-5 rounded-2xl space-y-4 text-slate-900 dark:text-white shadow-2xl animate-slideUp">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-600 dark:text-[#3B82F6] flex items-center justify-center">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Inter-Wallet Transfer</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTransfer(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editValidationError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/60 text-rose-700 dark:text-rose-200 rounded-xl text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-semibold">{editValidationError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div>
                  <ModernDateInput
                    label="Transfer Date"
                    value={editDate}
                    onChange={(val) => setEditDate(val)}
                    accentColor="blue"
                    size="sm"
                    presets={[
                      { label: 'Today', value: new Date().toISOString().split('T')[0] },
                      { label: 'Yesterday', value: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
                      { label: '-7d', value: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] }
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] block mb-1">
                      From Wallet (Debit)
                    </label>
                    <select
                      value={editFromWalletId}
                      onChange={(e) => setEditFromWalletId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl py-2 px-2.5 text-xs text-slate-900 dark:text-white outline-none font-semibold"
                    >
                      {wallets.map(w => (
                        <option key={w.id} value={w.id}>
                          {getWalletNickname(w.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] block mb-1">
                      To Wallet (Credit)
                    </label>
                    <select
                      value={editToWalletId}
                      onChange={(e) => setEditToWalletId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl py-2 px-2.5 text-xs text-slate-900 dark:text-white outline-none font-semibold"
                    >
                      {wallets.map(w => (
                        <option key={w.id} value={w.id} disabled={w.id === editFromWalletId}>
                          {getWalletNickname(w.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB]">
                      Transfer Amount (ETB)
                    </label>
                    <span className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                      Available: <strong className="text-emerald-600 dark:text-[#00D4AA] font-mono">{formatETB(editFromBalance)}</strong>
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl py-2 px-3 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-[#8899BB] block mb-1">
                    Transfer Purpose / Reason
                  </label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingTransfer(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: DELETE CONFIRMATION ================= */}
        {deletingTransfer && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
            <div className="bg-white dark:bg-[#131926] border border-rose-500/50 w-full max-w-sm p-5 rounded-2xl space-y-4 text-slate-900 dark:text-white shadow-2xl animate-slideUp">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete & Reverse Transfer?</h3>
                <p className="text-xs text-slate-500 dark:text-[#8899BB]">
                  This action will delete the transfer record and reverse both wallet balances.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-[#8899BB]">Transfer Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatETB(deletingTransfer.amount)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Refund Source:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    +{formatETB(deletingTransfer.amount)} to {wallets.find(w => w.id === deletingTransfer.fromWalletId)?.name || 'Wallet'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Deduct Destination:</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    -{formatETB(deletingTransfer.amount)} from {wallets.find(w => w.id === deletingTransfer.toWalletId)?.name || 'Wallet'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingTransfer(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-600/20 cursor-pointer transition-all"
                >
                  Confirm Delete & Reverse
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
