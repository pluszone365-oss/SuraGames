import React, { useState } from 'react';
import {
  FileCheck,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Edit2,
  Trash2,
  Plus,
  Search,
  X,
  UserCheck,
  Calendar,
  Layers,
  Wallet as WalletIcon
} from 'lucide-react';
import { Receivable, Wallet, UserProfile } from '../../types';
import { formatETB, evaluateReceivableStatus } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import { ModernDateInput } from '../common/ModernDateInput';

interface ReceivablesViewProps {
  receivables: Receivable[];
  wallets: Wallet[];
  currentUser?: UserProfile;
  onCollect: (receivableId: string, walletId: string, amount: number) => void;
  onUpdate?: (receivableId: string, updates: Partial<Receivable>) => void;
  onDelete?: (receivableId: string) => void;
  onCreate?: (data: Omit<Receivable, 'id' | 'amountCollected' | 'status' | 'createdDate'> & { createdDate?: string }) => void;
}

export const ReceivablesView: React.FC<ReceivablesViewProps> = ({
  receivables = [],
  wallets = [],
  currentUser,
  onCollect,
  onUpdate,
  onDelete,
  onCreate
}) => {
  const [filter, setFilter] = useState<'ALL' | 'OUTSTANDING' | 'LATE' | 'COLLECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Collect Modal State
  const [activeCollectModal, setActiveCollectModal] = useState<Receivable | null>(null);
  const [collectWalletId, setCollectWalletId] = useState(wallets[0]?.id || '');
  const [collectAmount, setCollectAmount] = useState('');
  const [isSubmittingCollect, setIsSubmittingCollect] = useState(false);

  // Edit Modal State
  const [editingReceivable, setEditingReceivable] = useState<Receivable | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAmountOwed, setEditAmountOwed] = useState('');
  const [editCreatedDate, setEditCreatedDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatus, setEditStatus] = useState<Receivable['status']>('OUTSTANDING');

  // Delete Confirmation Modal State
  const [deletingReceivable, setDeletingReceivable] = useState<Receivable | null>(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCustomerName, setCreateCustomerName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createAmountOwed, setCreateAmountOwed] = useState('');
  const [createCreatedDate, setCreateCreatedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [createDueDate, setCreateDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  const handleCollectSubmit = (rcv: Receivable) => {
    if (isSubmittingCollect) return;
    const amt = parseFloat(collectAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmittingCollect(true);
    triggerHaptic('success');
    const finalCollectWalletId = collectWalletId || rcv.walletId || wallets.find(w => w.isDefault)?.id || wallets[0]?.id || 'w-cash';
    onCollect(rcv.id, finalCollectWalletId, amt);
    setActiveCollectModal(null);
    setCollectAmount('');
    setTimeout(() => {
      setIsSubmittingCollect(false);
    }, 1500);
  };

  const handleStartEdit = (rcv: Receivable) => {
    triggerHaptic('light');
    setEditingReceivable(rcv);
    setEditCustomerName(rcv.customerName);
    setEditDescription(rcv.description || '');
    setEditAmountOwed(rcv.amountOwed.toString());
    setEditCreatedDate(rcv.createdDate ? rcv.createdDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditDueDate(rcv.dueDate ? rcv.dueDate.split('T')[0] : '');
    setEditStatus(rcv.status);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReceivable || !onUpdate) return;

    const amt = parseFloat(editAmountOwed);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    triggerHaptic('success');
    onUpdate(editingReceivable.id, {
      customerName: editCustomerName.trim() || editingReceivable.customerName,
      description: editDescription.trim(),
      amountOwed: amt,
      createdDate: editCreatedDate ? new Date(editCreatedDate).toISOString() : editingReceivable.createdDate,
      dueDate: editDueDate ? new Date(editDueDate).toISOString() : editingReceivable.dueDate,
      status: editStatus,
      walletId: editingReceivable.walletId
    });

    setEditingReceivable(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingReceivable || !onDelete) return;

    triggerHaptic('warning');
    onDelete(deletingReceivable.id);
    setDeletingReceivable(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreate) return;

    const amt = parseFloat(createAmountOwed);
    if (!createCustomerName.trim() || isNaN(amt) || amt <= 0) {
      alert('Please provide customer name and a valid amount.');
      return;
    }

    triggerHaptic('success');
    onCreate({
      customerName: createCustomerName.trim(),
      description: createDescription.trim() || 'Credit sale invoice',
      amountOwed: amt,
      createdDate: createCreatedDate ? new Date(createCreatedDate).toISOString() : new Date().toISOString(),
      dueDate: createDueDate ? new Date(createDueDate).toISOString() : new Date(Date.now() + 86400000 * 14).toISOString()
    });

    setShowCreateModal(false);
    setCreateCustomerName('');
    setCreateDescription('');
    setCreateAmountOwed('');
  };

  const calculateDaysAge = (r: Receivable) => {
    const createdTime = r.createdDate ? new Date(r.createdDate).getTime() : 0;
    const dueTime = r.dueDate ? new Date(r.dueDate).getTime() : 0;
    const refTime = dueTime || createdTime || Date.now();
    return Math.max(0, Math.floor((Date.now() - refTime) / (1000 * 60 * 60 * 24)));
  };

  const processedReceivables = (receivables || []).map(r => {
    const effectiveStatus = evaluateReceivableStatus(r);
    const ageDays = calculateDaysAge(r);
    return {
      ...r,
      effectiveStatus,
      ageDays,
      isLate: effectiveStatus === 'LATE' || ageDays >= 15
    };
  });

  const lateCount = processedReceivables.filter(r => r.isLate && r.effectiveStatus !== 'COLLECTED').length;
  const lateTotal = processedReceivables
    .filter(r => r.isLate && r.effectiveStatus !== 'COLLECTED')
    .reduce((sum, r) => sum + (r.amountOwed - r.amountCollected), 0);

  const outstandingTotal = processedReceivables
    .filter(r => r.effectiveStatus !== 'COLLECTED' && r.effectiveStatus !== 'WRITTEN_OFF')
    .reduce((sum, r) => sum + (r.amountOwed - r.amountCollected), 0);

  const collectedTotal = processedReceivables.reduce((sum, r) => sum + r.amountCollected, 0);

  const filteredReceivables = processedReceivables.filter(r => {
    if (filter === 'OUTSTANDING') {
      if (r.effectiveStatus !== 'OUTSTANDING') return false;
    } else if (filter === 'LATE') {
      if (!r.isLate || r.effectiveStatus === 'COLLECTED') return false;
    } else if (filter === 'COLLECTED') {
      if (r.effectiveStatus !== 'COLLECTED') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.customerName.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const sortedReceivables = [...filteredReceivables].sort((a, b) => {
    if (a.isLate !== b.isLate) return a.isLate ? -1 : 1;
    if (a.effectiveStatus !== b.effectiveStatus) {
      if (a.effectiveStatus === 'LATE') return -1;
      if (b.effectiveStatus === 'LATE') return 1;
      if (a.effectiveStatus === 'OUTSTANDING') return -1;
      return 1;
    }
    const dateA = new Date(a.createdDate || 0).getTime();
    const dateB = new Date(b.createdDate || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="space-y-4">
      {/* Header with Title and Create Button */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#3B82F6]" />
            <span>Customer Receivables & Credit IOUs</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#8899BB]">
            Manage credit balances. Unpaid receivables past 15 days automatically move to <span className="text-rose-500 font-bold">Late Payment</span>.
          </p>
        </div>

        {onCreate && (
          <button
            type="button"
            id="tour-receivables-add"
            data-tour="receivables-add"
            onClick={() => {
              triggerHaptic('medium');
              setShowCreateModal(true);
            }}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Record Credit</span>
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div id="tour-loans-receivables" data-tour="loans-receivables" className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-3 shadow-sm">
          <p className="text-[10px] text-slate-500 dark:text-[#8899BB] font-bold uppercase tracking-wider">Uncollected Work</p>
          <p className="text-sm font-black font-mono text-blue-600 dark:text-[#3B82F6]">{formatETB(outstandingTotal)}</p>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Summed in work • Not in wallets</p>
        </div>

        <div className={`bg-white dark:bg-[#131926] border rounded-2xl p-3 shadow-sm ${
          lateCount > 0 ? 'border-rose-300 dark:border-rose-500/40 bg-rose-500/5' : 'border-slate-200 dark:border-[#1E2D40]'
        }`}>
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400">Late (&gt;15 Days)</p>
          </div>
          <p className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">{formatETB(lateTotal)}</p>
        </div>

        <div className="bg-white dark:bg-[#131926] border border-purple-200 dark:border-purple-800/40 rounded-2xl p-3 shadow-sm">
          <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">Collected</p>
          <p className="text-sm font-black font-mono text-purple-600 dark:text-purple-400">{formatETB(collectedTotal)}</p>
        </div>
      </div>

      {/* Late Payment Warning Banner */}
      {lateCount > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
            <div>
              <p className="font-extrabold">{lateCount} Customer {lateCount === 1 ? 'Credit' : 'Credits'} Moved to Late Payment</p>
              <p className="text-[11px] opacity-90">Outstanding over 15 days without full settlement.</p>
            </div>
          </div>
          <button
            onClick={() => setFilter('LATE')}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg cursor-pointer transition-colors shrink-0"
          >
            View Late ({lateCount})
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name or description..."
            className="w-full bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {(['ALL', 'LATE', 'OUTSTANDING', 'COLLECTED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filter === tab
                  ? tab === 'LATE'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : tab === 'COLLECTED'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#1C2333] text-slate-600 dark:text-[#8899BB] hover:bg-slate-200 dark:hover:bg-[#252E42]'
              }`}
            >
              {tab === 'ALL' && `All (${processedReceivables.length})`}
              {tab === 'LATE' && `Late Payment (${lateCount})`}
              {tab === 'OUTSTANDING' && `Active Credit (${processedReceivables.filter(r => r.effectiveStatus === 'OUTSTANDING').length})`}
              {tab === 'COLLECTED' && `Collected (${processedReceivables.filter(r => r.effectiveStatus === 'COLLECTED').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Receivables List */}
      <div id="tour-receivables-list" data-tour="receivables-list" className="space-y-3">
        {sortedReceivables.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl">
            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-slate-500 dark:text-[#8899BB]">No receivables match this filter</p>
          </div>
        ) : (
          sortedReceivables.map((r) => {
            const outstanding = r.amountOwed - r.amountCollected;
            const isLate = r.isLate && r.effectiveStatus !== 'COLLECTED';

            const isCollected = r.effectiveStatus === 'COLLECTED';

            return (
              <div
                key={r.id}
                className={`bg-white dark:bg-[#131926] border rounded-2xl p-4 space-y-3 shadow-sm transition-all ${
                  isCollected
                    ? 'border-purple-300 dark:border-purple-500/40 bg-purple-500/[0.04]'
                    : isLate
                    ? 'border-rose-300 dark:border-rose-500/40 bg-rose-500/[0.02]'
                    : 'border-slate-200 dark:border-[#1E2D40]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 ${
                        isCollected
                          ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                          : isLate
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      }`}>
                        {isLate && <AlertTriangle className="w-2.5 h-2.5" />}
                        {isLate ? 'LATE PAYMENT' : r.effectiveStatus}
                      </span>

                      {isLate && (
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                          • {r.ageDays} days unpaid (&gt;15 day limit)
                        </span>
                      )}

                      {r.dueDate && (
                        <span className="text-[10px] text-slate-500 dark:text-[#8899BB] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Due: {new Date(r.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{r.customerName}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">{r.description || 'No description'}</p>

                    {/* Deposit Wallet info when collected */}
                    {r.status === 'COLLECTED' && r.walletId && (
                      <div className="flex items-center gap-1.5 text-[10px] mt-1.5 px-2.5 py-1 rounded-lg border w-fit bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-200/60 dark:border-emerald-800/50">
                        <WalletIcon className="w-3 h-3 shrink-0 text-emerald-500" />
                        <span className="font-medium">Collected to:</span>
                        <span className="font-bold">{wallets.find(w => w.id === r.walletId)?.name || 'Wallet'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Outstanding</p>
                      <p className={`text-sm font-black font-mono ${
                        isLate ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-[#3B82F6]'
                      }`}>
                        {formatETB(outstanding)}
                      </p>
                    </div>

                    {/* Action Buttons: Edit & Delete */}
                    <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-[#1E2D40]">
                      {onUpdate && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(r)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
                          title="Edit Receivable"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('warning');
                            setDeletingReceivable(r);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete Receivable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-[#1C2333] p-2.5 rounded-xl border border-slate-100 dark:border-transparent">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-[#8899BB]">Total Invoice</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-white">{formatETB(r.amountOwed)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-[#8899BB]">Collected so far</span>
                    <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatETB(r.amountCollected)}</p>
                  </div>
                </div>

                {outstanding > 0 && (
                  <button
                    onClick={() => {
                      triggerHaptic('medium');
                      setActiveCollectModal(r);
                      setCollectAmount(outstanding.toString());
                      setCollectWalletId(r.walletId && wallets.some(w => w.id === r.walletId) ? r.walletId : (wallets[0]?.id || ''));
                    }}
                    className={`w-full py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors ${
                      isLate ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Collect Payment to Wallet</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Edit Receivable */}
      {editingReceivable && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131926] border border-slate-300 dark:border-blue-500/50 w-full max-w-md p-5 rounded-2xl space-y-4 text-slate-900 dark:text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600 dark:text-[#3B82F6]" />
                <span>Edit Receivable Invoice</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingReceivable(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-[#8899BB] block mb-1">Customer / Debtor Name</label>
                <input
                  type="text"
                  required
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-[#8899BB] block mb-1">Description / Items</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="e.g. 5x PS5 Gaming Controller, Drinks, etc."
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-[#8899BB] block mb-1">Total Owed (ETB)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={editAmountOwed}
                  onChange={(e) => setEditAmountOwed(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <ModernDateInput
                    label="Created Date"
                    value={editCreatedDate}
                    onChange={(val) => setEditCreatedDate(val)}
                    accentColor="emerald"
                    size="sm"
                    presets={[
                      { label: 'Today', value: new Date().toISOString().split('T')[0] },
                      { label: 'Yesterday', value: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
                      { label: '-7d', value: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] }
                    ]}
                  />
                </div>

                <div>
                  <ModernDateInput
                    label="Due Date"
                    value={editDueDate}
                    onChange={(val) => setEditDueDate(val)}
                    accentColor="blue"
                    size="sm"
                    presets={[
                      { label: '+7d', value: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] },
                      { label: '+14d', value: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0] },
                      { label: '+30d', value: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] }
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-[#8899BB] block mb-1">Receivable Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as Receivable['status'])}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="OUTSTANDING">OUTSTANDING (Active)</option>
                  <option value="COLLECTED">COLLECTED (Fully Paid)</option>
                  <option value="LATE">LATE (&gt;15 Days)</option>
                  <option value="OVERDUE">OVERDUE</option>
                  <option value="WRITTEN_OFF">WRITTEN OFF</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingReceivable(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:bg-slate-200 dark:hover:bg-[#252E42] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md cursor-pointer transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Receivable Confirmation */}
      {deletingReceivable && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131926] border border-rose-300 dark:border-rose-500/50 w-full max-w-sm p-5 rounded-2xl space-y-4 text-slate-900 dark:text-white shadow-2xl">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Customer Receivable</h3>
              <p className="text-xs text-slate-500 dark:text-[#8899BB]">
                Are you sure you want to delete the credit invoice for <strong className="text-slate-900 dark:text-white font-bold">{deletingReceivable.customerName}</strong> ({formatETB(deletingReceivable.amountOwed)})?
              </p>
              <p className="text-[11px] text-rose-500 font-semibold pt-1">
                This action will remove the record from ledger and create an audit log entry.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingReceivable(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:bg-slate-200 dark:hover:bg-[#252E42] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-md cursor-pointer transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Receivable */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131926] border border-slate-300 dark:border-blue-500/50 w-full max-w-md p-5 rounded-2xl space-y-4 text-slate-900 dark:text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600 dark:text-[#3B82F6]" />
                <span>Record Customer Credit / Debt</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-[#8899BB] block mb-1">Customer / Debtor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abebe Bikila"
                  value={createCustomerName}
                  onChange={(e) => setCreateCustomerName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-[#8899BB] block mb-1">Description / Items</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Gaming Hours & Drinks"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-[#8899BB] block mb-1">Amount Owed (ETB)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="e.g. 1500"
                  value={createAmountOwed}
                  onChange={(e) => setCreateAmountOwed(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <ModernDateInput
                    label="Created Date"
                    value={createCreatedDate}
                    onChange={(val) => setCreateCreatedDate(val)}
                    accentColor="emerald"
                    size="sm"
                    presets={[
                      { label: 'Today', value: new Date().toISOString().split('T')[0] },
                      { label: 'Yesterday', value: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
                      { label: '-7d', value: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] },
                      { label: '-30d', value: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0] }
                    ]}
                  />
                </div>

                <div>
                  <ModernDateInput
                    label="Expected Due Date"
                    value={createDueDate}
                    onChange={(val) => setCreateDueDate(val)}
                    accentColor="blue"
                    size="sm"
                    presets={[
                      { label: '+7d', value: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] },
                      { label: '+14d', value: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0] },
                      { label: '+30d', value: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] }
                    ]}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:bg-slate-200 dark:hover:bg-[#252E42] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md cursor-pointer transition-colors"
                >
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {activeCollectModal && (() => {
        const selectedWallet = wallets.find(w => w.id === collectWalletId) || wallets[0];
        const currentBal = selectedWallet ? selectedWallet.openingBalance + selectedWallet.totalIn - selectedWallet.totalOut : 0;
        const enteredAmt = parseFloat(collectAmount) || 0;
        const afterBal = currentBal + enteredAmt;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] w-full max-w-sm p-5 rounded-2xl space-y-4 text-slate-900 dark:text-white shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span>Collect Receivable</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveCollectModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-[#8899BB]">
                Collecting payment for <span className="text-slate-900 dark:text-white font-bold">{activeCollectModal.customerName}</span> — recorded in ledger as <span className="text-purple-600 dark:text-purple-400 font-bold">Collected from {activeCollectModal.customerName}</span>
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-[#8899BB] block mb-1 flex items-center gap-1">
                  <WalletIcon className="w-3.5 h-3.5 text-blue-500" />
                  <span>Deposit To Wallet (Target)</span>
                </label>
                <select
                  value={collectWalletId}
                  onChange={e => setCollectWalletId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.type}) - Current: {formatETB(w.openingBalance + w.totalIn - w.totalOut)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-[#8899BB] block mb-1">Collection Amount (ETB)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={collectAmount}
                  onChange={e => setCollectAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Wallet Live Preview Balance Box */}
              {selectedWallet && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600 dark:text-[#8899BB]">
                    <span className="flex items-center gap-1">
                      <WalletIcon className="w-3 h-3 text-emerald-500" />
                      Target Wallet:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedWallet.name}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-[#8899BB]">
                    <span>Current Wallet Balance:</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{formatETB(currentBal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold pt-1 border-t border-emerald-200 dark:border-emerald-800/40">
                    <span>Balance After Deposit:</span>
                    <span className="font-mono">{formatETB(afterBal)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveCollectModal(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:bg-slate-200 dark:hover:bg-[#252E42] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingCollect}
                  onClick={() => handleCollectSubmit(activeCollectModal)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-colors ${
                    isSubmittingCollect
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                  }`}
                >
                  {isSubmittingCollect ? 'Processing...' : 'Post Collection'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
