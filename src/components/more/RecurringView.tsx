import React, { useState } from 'react';
import {
  Repeat,
  Plus,
  Trash2,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Calendar,
  Wallet as WalletIcon,
  X,
  Search,
  Tag,
  Gift,
  CreditCard,
  Zap,
  Droplets,
  Wifi,
  Building2,
  Shield,
  Car,
  Clock,
  ArrowUpRight,
  Info,
  Check,
  AlertCircle,
  Pencil,
  Save
} from 'lucide-react';
import { RecurringTemplate, Wallet, Category, RecurringFrequency, TransactionType, ERPState, Transaction } from '../../types';
import { formatETB } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import { formatDateByCalendar, evaluatePagumeExemption, calculateNextEthiopianDueDate } from '../../lib/ethiopianCalendar';
import { ModernDateInput } from '../common/ModernDateInput';

interface RecurringViewProps {
  recurring: RecurringTemplate[];
  wallets: Wallet[];
  categories?: Category[];
  calendarType?: 'ETHIOPIAN' | 'GREGORIAN';
  onUpdateState?: (fn: (prev: ERPState) => ERPState) => void;
}

export const RecurringView: React.FC<RecurringViewProps> = ({
  recurring,
  wallets,
  categories = [],
  calendarType = 'GREGORIAN',
  onUpdateState
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'DUE_SOON'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Edit Bill Modal state
  const [editingRec, setEditingRec] = useState<RecurringTemplate | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<TransactionType>('EXPENSE');
  const [editCategory, setEditCategory] = useState('Rent & Lease');
  const [editWalletId, setEditWalletId] = useState('');
  const [editFrequency, setEditFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [editNextDueDate, setEditNextDueDate] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE');
  const [editNotes, setEditNotes] = useState('');
  const [editBeneficiary, setEditBeneficiary] = useState('');

  // Pay Bill Modal state
  const [payingRec, setPayingRec] = useState<RecurringTemplate | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payWalletId, setPayWalletId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');

  // Delete modal state
  const [deletingRec, setDeletingRec] = useState<RecurringTemplate | null>(null);

  // Form state for Adding
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState('Rent & Lease');
  const [walletId, setWalletId] = useState(wallets[0]?.id || '');
  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [autoProcess, setAutoProcess] = useState(false);
  const [notes, setNotes] = useState('');

  // Calculate monthly recurring total
  const monthlyRecurringBurden = recurring
    .filter(r => r.type === 'EXPENSE' && r.status === 'ACTIVE')
    .reduce((sum, r) => {
      if (r.frequency === 'DAILY') return sum + r.amount * 30;
      if (r.frequency === 'WEEKLY') return sum + Math.round(r.amount * (52 / 12));
      if (r.frequency === 'ONE_TIME' || r.isOneTime) return sum;
      if (r.frequency === 'BIWEEKLY') return sum + Math.round(r.amount * 2);
      if (r.frequency === 'EVERY_3_WEEKS') return sum + Math.round(r.amount * (52 / 3 / 12));
      if (r.frequency === 'EVERY_4_WEEKS') return sum + Math.round(r.amount * (52 / 4 / 12));
      if (r.frequency === 'MONTHLY') return sum + r.amount;
      if (r.frequency === 'EVERY_2_MONTHS') return sum + Math.round(r.amount / 2);
      if (r.frequency === 'QUARTERLY') return sum + Math.round(r.amount / 3);
      if (r.frequency === 'YEARLY') return sum + Math.round(r.amount / 12);
      return sum + r.amount;
    }, 0);

  const getFrequencyLabel = (freq: RecurringFrequency) => {
    switch (freq) {
      case 'ONE_TIME': return 'One-Time Advance (Prepaid Upfront)';
      case 'DAILY': return 'Daily';
      case 'WEEKLY': return 'Weekly';
      case 'BIWEEKLY': return 'Bi-Weekly (14 Days)';
      case 'EVERY_3_WEEKS': return 'Every 3-4 Weeks (21 Days)';
      case 'EVERY_4_WEEKS': return 'Every 4 Weeks';
      case 'MONTHLY': return 'Monthly';
      case 'EVERY_2_MONTHS': return 'Every 2 Months (Bi-Monthly)';
      case 'QUARTERLY': return 'Every 3 Months (Upfront / Quarterly)';
      case 'YEARLY': return 'Yearly';
      default: return freq;
    }
  };

  const getBillIcon = (item: RecurringTemplate) => {
    const text = (item.title + ' ' + item.category).toLowerCase();
    if (text.includes('rent') || text.includes('lease') || text.includes('building')) {
      return <Building2 className="w-5 h-5 text-indigo-400" />;
    }
    if (text.includes('internet') || text.includes('wifi') || text.includes('fiber') || text.includes('telecom')) {
      return <Wifi className="w-5 h-5 text-sky-400" />;
    }
    if (text.includes('electr') || text.includes('power') || text.includes('generator')) {
      return <Zap className="w-5 h-5 text-amber-400" />;
    }
    if (text.includes('water')) {
      return <Droplets className="w-5 h-5 text-cyan-400" />;
    }
    if (text.includes('police') || text.includes('security') || text.includes('guard')) {
      return <Shield className="w-5 h-5 text-rose-400" />;
    }
    if (text.includes('transport') || text.includes('taxi') || text.includes('fuel')) {
      return <Car className="w-5 h-5 text-emerald-400" />;
    }
    return <Repeat className="w-5 h-5 text-[#A78BFA]" />;
  };

  const now = new Date();
  const ms7Days = 7 * 24 * 60 * 60 * 1000;

  const filteredRecurring = recurring
    .filter(r => {
      const matchSearch =
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (selectedFilter === 'ACTIVE') return r.status === 'ACTIVE';
      if (selectedFilter === 'PAUSED') return r.status === 'PAUSED';
      if (selectedFilter === 'DUE_SOON') {
        const dueDate = new Date(r.nextDueDate);
        return r.status === 'ACTIVE' && (dueDate.getTime() - now.getTime() <= ms7Days);
      }
      return true;
    })
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());

  const handleOpenAdd = () => {
    triggerHaptic('light');
    setTitle('');
    setAmount('');
    setType('EXPENSE');
    setCategory('Rent & Lease');
    setWalletId(wallets[0]?.id || '');
    setFrequency('MONTHLY');
    setNextDueDate(new Date().toISOString().split('T')[0]);
    setAutoProcess(false);
    setNotes('');
    setShowAddModal(true);
  };

  const applyPreset = (presetType: string) => {
    triggerHaptic('light');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (presetType === 'RENT_3MO') {
      setTitle('Commercial Space Rent (Paid in Advance One Time)');
      setAmount('69000');
      setType('EXPENSE');
      setCategory('Rent & Lease');
      setFrequency('ONE_TIME');
      setWalletId(wallets.find(w => w.type === 'CBE_BANK')?.id || wallets[0]?.id || '');
      setNotes('ETB 69,000 paid for 3 months in advance as a one-time upfront payment (prepaid until Dec 10, 2026).');
    } else if (presetType === 'INTERNET') {
      setTitle('Internet & Fiber Subscription');
      setAmount('1010');
      setType('EXPENSE');
      setCategory('Utilities & Internet');
      setFrequency('MONTHLY');
      setWalletId(wallets.find(w => w.type === 'TELEBIRR')?.id || wallets[0]?.id || '');
      setNotes('Monthly high-speed fiber internet subscription (ETB 1,010/mo).');
    } else if (presetType === 'ELECTRICITY') {
      setTitle('Electricity Prepaid Units (3-4 Weeks)');
      setAmount('2050');
      setType('EXPENSE');
      setCategory('Utilities & Internet');
      setFrequency('EVERY_3_WEEKS');
      setWalletId(wallets.find(w => w.type === 'TELEBIRR')?.id || wallets[0]?.id || '');
      setNotes('Electricity unit refill every 3 to 4 weeks (ETB 2,050).');
    } else if (presetType === 'WATER') {
      setTitle('Municipal Water Utility (Bi-Monthly)');
      setAmount('450');
      setType('EXPENSE');
      setCategory('Utilities & Internet');
      setFrequency('EVERY_2_MONTHS');
      setWalletId(wallets.find(w => w.type === 'TELEBIRR')?.id || wallets[0]?.id || '');
      setNotes('Municipal water utility bill payable every 2 months.');
    } else if (presetType === 'POLICE') {
      setTitle('Community Police & Security Dues (Bi-Monthly)');
      setAmount('500');
      setType('EXPENSE');
      setCategory('Rent & Lease');
      setFrequency('EVERY_2_MONTHS');
      setWalletId(wallets.find(w => w.type === 'CASH')?.id || wallets[0]?.id || '');
      setNotes('Community security & police contribution every 2 months.');
    } else if (presetType === 'TRANSPORT_P1') {
      setTitle('Staff Transport - Person 1 (Early Month)');
      setAmount('1000');
      setType('EXPENSE');
      setCategory('Payroll & Wages');
      setFrequency('MONTHLY');
      setWalletId(wallets.find(w => w.type === 'TELEBIRR')?.id || wallets[0]?.id || '');
      setNotes('Monthly transport stipend for Person 1 (Early Month - 5th).');
    } else if (presetType === 'TRANSPORT_P2') {
      setTitle('Staff Transport - Person 2 (Mid Month)');
      setAmount('1000');
      setType('EXPENSE');
      setCategory('Payroll & Wages');
      setFrequency('MONTHLY');
      setWalletId(wallets.find(w => w.type === 'TELEBIRR')?.id || wallets[0]?.id || '');
      setNotes('Monthly transport stipend for Person 2 (Mid Month - 15th).');
    } else if (presetType === 'TRANSPORT_P3') {
      setTitle('Staff Transport - Person 3 (End Month)');
      setAmount('1000');
      setType('EXPENSE');
      setCategory('Payroll & Wages');
      setFrequency('MONTHLY');
      setWalletId(wallets.find(w => w.type === 'TELEBIRR')?.id || wallets[0]?.id || '');
      setNotes('Monthly transport stipend for Person 3 (End Month - 25th).');
    }
  };

  const handleSaveAdd = () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0 || !onUpdateState) return;
    triggerHaptic('success');

    const newRecurring: RecurringTemplate = {
      id: `rec-${Date.now()}`,
      title: title.trim(),
      amount: parseFloat(amount),
      type,
      category,
      walletId,
      frequency,
      isOneTime: frequency === 'ONE_TIME',
      nextDueDate: new Date(nextDueDate).toISOString(),
      autoProcess: false, // Strictly manual payment confirmation
      status: 'ACTIVE',
      notes: notes.trim() || undefined
    };

    onUpdateState(prev => ({
      ...prev,
      recurring: [...prev.recurring, newRecurring],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'CREATE_RECURRING_BILL',
          entity: 'RecurringTemplate',
          entityId: newRecurring.id,
          diffAfter: { title: newRecurring.title, amount: newRecurring.amount, frequency },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));

    setShowAddModal(false);
  };

  const handleOpenEdit = (rec: RecurringTemplate) => {
    triggerHaptic('light');
    setEditingRec(rec);
    setEditTitle(rec.title);
    setEditAmount(rec.amount.toString());
    setEditType(rec.type);
    setEditCategory(rec.category);
    setEditWalletId(rec.walletId || wallets[0]?.id || '');
    setEditFrequency(rec.frequency);
    setEditNextDueDate(rec.nextDueDate ? new Date(rec.nextDueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditStatus(rec.status);
    setEditNotes(rec.notes || '');
    setEditBeneficiary(rec.beneficiary || '');
  };

  const handleSaveEdit = () => {
    if (!editingRec || !editTitle.trim() || !editAmount || parseFloat(editAmount) <= 0 || !onUpdateState) return;
    triggerHaptic('success');

    const updatedRec: RecurringTemplate = {
      ...editingRec,
      title: editTitle.trim(),
      amount: parseFloat(editAmount),
      type: editType,
      category: editCategory,
      walletId: editWalletId,
      frequency: editFrequency,
      isOneTime: editFrequency === 'ONE_TIME',
      nextDueDate: new Date(editNextDueDate).toISOString(),
      status: editStatus,
      notes: editNotes.trim() ? editNotes.trim() : undefined,
      beneficiary: editBeneficiary.trim() ? editBeneficiary.trim() : undefined,
      autoProcess: false
    };

    onUpdateState(prev => ({
      ...prev,
      recurring: prev.recurring.map(r => (r.id === editingRec.id ? updatedRec : r)),
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'UPDATE_RECURRING_BILL',
          entity: 'RecurringTemplate',
          entityId: editingRec.id,
          diffBefore: {
            title: editingRec.title,
            amount: editingRec.amount,
            frequency: editingRec.frequency,
            nextDueDate: editingRec.nextDueDate,
            walletId: editingRec.walletId,
            status: editingRec.status
          },
          diffAfter: {
            title: updatedRec.title,
            amount: updatedRec.amount,
            frequency: updatedRec.frequency,
            nextDueDate: updatedRec.nextDueDate,
            walletId: updatedRec.walletId,
            status: updatedRec.status
          },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));

    setEditingRec(null);
  };

  const handleOpenPay = (rec: RecurringTemplate) => {
    triggerHaptic('light');
    setPayingRec(rec);
    setPayAmount(rec.amount.toString());
    setPayWalletId(rec.walletId || wallets[0]?.id || '');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayNotes(rec.notes || '');
  };

  const handleConfirmPayment = () => {
    if (!payingRec || !payAmount || parseFloat(payAmount) <= 0 || !payWalletId || !onUpdateState) return;
    triggerHaptic('success');

    const paymentAmount = parseFloat(payAmount);
    const selectedWallet = wallets.find(w => w.id === payWalletId);
    const paymentDateIso = new Date(payDate).toISOString();

    // Advance next due date to next cycle
    const nextDateObj = calculateNextEthiopianDueDate(
      payingRec.nextDueDate || paymentDateIso,
      payingRec.frequency
    );

    const newTx: Transaction = {
      id: `tx-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: paymentDateIso,
      type: payingRec.type,
      amount: paymentAmount,
      walletId: payWalletId,
      category: payingRec.category,
      description: `${payingRec.title} (Settled Bill)`,
      notes: payNotes.trim() ? payNotes.trim() : `Manual recurring payment for ${payingRec.title}`,
      refType: 'RECURRING',
      refId: payingRec.id,
      creatorId: 'user',
      creatorName: 'Yegeta Huawei',
      branch: 'Main Lounge'
    };

    onUpdateState(prev => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
      recurring: prev.recurring.map(r =>
        r.id === payingRec.id
          ? {
              ...r,
              lastProcessedDate: paymentDateIso,
              nextDueDate: nextDateObj.toISOString(),
              status: 'ACTIVE'
            }
          : r
      ),
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'PAY_RECURRING_BILL',
          entity: 'RecurringTemplate',
          entityId: payingRec.id,
          diffAfter: {
            amount: paymentAmount,
            wallet: selectedWallet?.name,
            paidAt: paymentDateIso,
            nextDueDate: nextDateObj.toISOString()
          },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));

    setPayingRec(null);
  };

  const handleToggleStatus = (rec: RecurringTemplate) => {
    if (!onUpdateState) return;
    triggerHaptic('medium');

    onUpdateState(prev => ({
      ...prev,
      recurring: prev.recurring.map(r =>
        r.id === rec.id
          ? { ...r, status: r.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }
          : r
      )
    }));
  };

  const confirmDeleteRecurring = () => {
    if (!deletingRec || !onUpdateState) return;
    triggerHaptic('warning');

    onUpdateState(prev => ({
      ...prev,
      recurring: prev.recurring.filter(r => r.id !== deletingRec.id),
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_RECURRING_BILL',
          entity: 'RecurringTemplate',
          entityId: deletingRec.id,
          diffBefore: { title: deletingRec.title },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));
    setDeletingRec(null);
  };

  const handleDelete = (rec: RecurringTemplate) => {
    if (!onUpdateState) return;
    triggerHaptic('light');
    setDeletingRec(rec);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 dark:bg-[#111622] p-4 rounded-2xl border border-slate-200/80 dark:border-[#1C2638]">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Repeat className="w-5 h-5 text-[#A78BFA]" />
            Recurring Bills & Fixed Schedules
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-0.5">
            Rent, utilities, fiber internet, police dues & staff transport allowances
          </p>
        </div>

        {onUpdateState && (
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 rounded-xl bg-[#A78BFA] text-[#0A0E1A] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer hover:bg-[#A78BFA]/90 transition-all active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bill Schedule</span>
          </button>
        )}
      </div>

      {/* KPI Overview Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* KPI 1: Monthly Committed Burden */}
        <div className="bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-[#1E2D40] p-3.5 rounded-2xl">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] block">
            Effective Monthly Burden
          </span>
          <p className="text-base sm:text-lg font-black font-mono text-[#A78BFA] mt-1">
            {formatETB(monthlyRecurringBurden)}/mo
          </p>
          <span className="text-[10px] text-slate-400 dark:text-[#8899BB] mt-0.5 block">
            {recurring.filter(r => r.status === 'ACTIVE').length} active recurring commitments
          </span>
        </div>

        {/* KPI 2: Policy Notice */}
        <div className="bg-white dark:bg-[#131926] border border-emerald-500/30 dark:border-emerald-500/20 p-3.5 rounded-2xl bg-emerald-500/5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Manual Payment Flow Active
          </span>
          <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
            No Automatic Bank Debits
          </p>
          <span className="text-[10px] text-slate-500 dark:text-[#8899BB] mt-0.5 block">
            Bills appear on schedules & only deduct when explicitly paid.
          </span>
        </div>

        {/* KPI 3: Next Due Item */}
        <div className="bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-[#1E2D40] p-3.5 rounded-2xl">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#8899BB] block">
            Earliest Upcoming Bill
          </span>
          {filteredRecurring.length > 0 ? (
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate mt-1">
                {filteredRecurring[0].title}
              </p>
              <p className="text-[11px] font-mono font-bold text-amber-500">
                {formatETB(filteredRecurring[0].amount)} • {formatDateByCalendar(new Date(filteredRecurring[0].nextDueDate), calendarType, true)}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-1">No upcoming bills</p>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedFilter === 'ALL'
                ? 'bg-[#A78BFA] text-[#0A0E1A] shadow-xs'
                : 'bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-slate-400 hover:text-white'
            }`}
          >
            All Bills ({recurring.length})
          </button>
          <button
            onClick={() => setSelectedFilter('DUE_SOON')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              selectedFilter === 'DUE_SOON'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-slate-400 hover:text-amber-400'
            }`}
          >
            <Clock className="w-3 h-3" />
            Due Soon (7d)
          </button>
          <button
            onClick={() => setSelectedFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-slate-400 hover:text-white'
            }`}
          >
            Active ({recurring.filter(r => r.status === 'ACTIVE').length})
          </button>
          <button
            onClick={() => setSelectedFilter('PAUSED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedFilter === 'PAUSED'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-slate-400 hover:text-white'
            }`}
          >
            Paused ({recurring.filter(r => r.status === 'PAUSED').length})
          </button>
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8899BB]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search rent, telecom, electricity, transport..."
            className="w-full bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-[#8899BB]"
          />
        </div>
      </div>

      {/* Recurring Bills List */}
      <div className="space-y-3">
        {filteredRecurring.map((r) => {
          const wallet = wallets.find(w => w.id === r.walletId);
          const isPaused = r.status === 'PAUSED';
          const dueDateObj = new Date(r.nextDueDate);
          const ethDueDateStr = formatDateByCalendar(dueDateObj, calendarType, true);
          const pagumeRule = evaluatePagumeExemption(r.category || r.title, dueDateObj);
          const isDueOrPast = dueDateObj.getTime() <= now.getTime() + (24 * 60 * 60 * 1000);

          return (
            <div
              key={r.id}
              className={`bg-white dark:bg-[#131926] border rounded-2xl p-4 transition-all shadow-xs hover:border-[#A78BFA]/50 ${
                isPaused
                  ? 'border-amber-500/30 opacity-60'
                  : isDueOrPast
                  ? 'border-amber-400/40 dark:border-amber-500/40 bg-amber-500/5'
                  : 'border-slate-200/80 dark:border-[#1E2D40]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                      isPaused
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-[#A78BFA]/15 text-[#A78BFA]'
                    }`}
                  >
                    {getBillIcon(r)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                        {r.title}
                      </h4>
                      <span className="text-[9px] bg-[#A78BFA]/15 text-[#A78BFA] px-2 py-0.5 rounded-md font-mono font-bold">
                        {getFrequencyLabel(r.frequency)}
                      </span>
                      {pagumeRule.isExempt && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <Gift className="w-3 h-3 text-emerald-400" />
                          13th Month (Pagumē): FREE
                        </span>
                      )}
                      {isDueOrPast && !isPaused && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-500" />
                          Due Now
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-[#8899BB] mt-1 flex-wrap">
                      <span>
                        Category: <strong className="text-slate-800 dark:text-white font-semibold">{r.category}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Target Wallet: <strong className="text-slate-800 dark:text-white font-semibold">{wallet?.name || 'Default Wallet'}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#A78BFA]" />
                        Next Due: <strong className="text-slate-900 dark:text-white font-mono">{ethDueDateStr}</strong>
                      </span>
                    </div>

                    {r.notes && (
                      <p className="text-[10px] text-slate-400 dark:text-[#8899BB] mt-1 bg-slate-100/70 dark:bg-[#1A2233] px-2 py-1 rounded-lg w-max max-w-full">
                        {r.notes}
                      </p>
                    )}

                    {r.lastProcessedDate && (
                      <p className="text-[9px] text-emerald-500 mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Last settled: {formatDateByCalendar(new Date(r.lastProcessedDate), calendarType, false)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-[#1E2D40]">
                  <p className="text-sm sm:text-base font-mono font-black text-slate-900 dark:text-white">
                    {formatETB(r.amount)}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Pay Bill Action Button */}
                    <button
                      onClick={() => handleOpenPay(r)}
                      disabled={isPaused}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                      title="Pay bill manually and record in ledger"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pay Bill</span>
                    </button>

                    {/* Edit Bill Button */}
                    {onUpdateState && (
                      <button
                        onClick={() => handleOpenEdit(r)}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] hover:bg-[#A78BFA]/20 hover:text-[#A78BFA] text-slate-600 dark:text-[#8899BB] border border-slate-200 dark:border-[#1E2D40] cursor-pointer transition-colors"
                        title="Edit bill title, amount, frequency, wallet or dates"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Active / Pause toggle */}
                    {onUpdateState && (
                      <button
                        onClick={() => handleToggleStatus(r)}
                        className={`p-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 border cursor-pointer transition-colors ${
                          isPaused
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20'
                            : 'bg-slate-100 dark:bg-[#1C2333] text-slate-600 dark:text-[#8899BB] border-slate-200 dark:border-[#1E2D40] hover:text-white'
                        }`}
                        title={isPaused ? 'Resume schedule' : 'Pause schedule'}
                      >
                        {isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Delete button */}
                    {onUpdateState && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 cursor-pointer border border-rose-500/20"
                        title="Delete bill schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredRecurring.length === 0 && (
          <div className="text-center py-10 bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-6">
            <Repeat className="w-10 h-10 text-slate-300 dark:text-[#8899BB] mx-auto mb-2 opacity-50" />
            <p className="text-xs text-slate-500 dark:text-[#8899BB] font-semibold">No recurring bills matching your filter.</p>
            <button
              onClick={handleOpenAdd}
              className="mt-3 px-3 py-1.5 rounded-xl bg-[#A78BFA] text-[#0A0E1A] text-xs font-bold cursor-pointer"
            >
              Add a Bill Schedule
            </button>
          </div>
        )}
      </div>

      {/* Pay Bill Modal */}
      {payingRec && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-emerald-500/40 w-full max-w-md p-5 rounded-2xl space-y-4 text-slate-900 dark:text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Record Bill Payment
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">
                    {payingRec.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPayingRec(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Bill Frequency</span>
                  <span className="font-bold text-slate-800 dark:text-white">{getFrequencyLabel(payingRec.frequency)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Next Cycle Advance</span>
                  <span className="font-bold text-emerald-500">
                    Advances automatically after payment
                  </span>
                </div>
              </div>

              <div>
                <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">
                  Payment Amount (ETB)
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-emerald-500 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white outline-none font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">
                  Pay From Wallet / Account
                </label>
                <select
                  value={payWalletId}
                  onChange={e => setPayWalletId(e.target.value)}
                  className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-emerald-500 rounded-xl p-2.5 text-slate-900 dark:text-white outline-none"
                >
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <ModernDateInput
                    label="Payment Date"
                    value={payDate}
                    onChange={(val) => setPayDate(val)}
                    accentColor="emerald"
                    size="sm"
                  />
                </div>
                <div>
                  <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    disabled
                    value={payingRec.category}
                    className="w-full bg-slate-100 dark:bg-[#1C2333]/50 border border-slate-200 dark:border-[#1E2D40] rounded-xl px-3 py-2 text-slate-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">
                  Reference Note / Receipt Remarks
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="e.g., Receipt #10423, Paid via Telebirr transfer"
                  className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-emerald-500 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-[#1E2D40]">
              <button
                type="button"
                onClick={() => setPayingRec(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!payAmount || parseFloat(payAmount) <= 0 || !payWalletId}
                onClick={handleConfirmPayment}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Confirm & Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recurring Bill Modal */}
      {editingRec && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-[#A78BFA]/50 w-full max-w-lg p-5 rounded-2xl space-y-4 text-slate-900 dark:text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#A78BFA]/20 text-[#A78BFA] flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Edit Recurring Bill Schedule
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">
                    {editingRec.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingRec(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Template Switcher */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-[#8899BB] block mb-1.5">
                Quick Preset Apply (Optional)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle('Commercial Space Rent (Paid in Advance One Time)');
                    setEditAmount('69000');
                    setEditCategory('Rent & Lease');
                    setEditFrequency('ONE_TIME');
                    setEditWalletId(wallets.find(w => w.type === 'CBE_BANK')?.id || wallets[0]?.id || '');
                    setEditNotes('ETB 69,000 paid for 3 months in advance as a one-time upfront payment (prepaid until Dec 10, 2026).');
                  }}
                  className="p-1.5 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-indigo-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-indigo-500 block truncate">🏢 One-Time Advance Rent</span>
                  <span className="text-[9px] font-mono text-slate-400">69,000 ETB (Prepaid)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditTitle('Internet & Fiber Subscription');
                    setEditAmount('1010');
                    setEditCategory('Utilities & Internet');
                    setEditFrequency('MONTHLY');
                    setEditWalletId(wallets.find(w => w.type === 'TELEBIRR')?.id || wallets[0]?.id || '');
                    setEditNotes('Monthly high-speed fiber internet subscription (ETB 1,010/mo).');
                  }}
                  className="p-1.5 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-sky-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-sky-500 block truncate">🌐 Internet / Fiber</span>
                  <span className="text-[9px] font-mono text-slate-400">1,010 ETB</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditTitle('Electricity Prepaid Units (3-4 Weeks)');
                    setEditAmount('2050');
                    setEditCategory('Utilities & Internet');
                    setEditFrequency('EVERY_3_WEEKS');
                    setEditWalletId(wallets.find(w => w.type === 'TELEBIRR')?.id || wallets[0]?.id || '');
                    setEditNotes('Electricity unit refill every 3 to 4 weeks (ETB 2,050).');
                  }}
                  className="p-1.5 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-amber-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-amber-500 block truncate">⚡ Electricity Units</span>
                  <span className="text-[9px] font-mono text-slate-400">2,050 ETB</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditTitle('Municipal Water Utility (Bi-Monthly)');
                    setEditAmount('450');
                    setEditCategory('Utilities & Internet');
                    setEditFrequency('EVERY_2_MONTHS');
                    setEditWalletId(wallets.find(w => w.type === 'TELEBIRR')?.id || wallets[0]?.id || '');
                    setEditNotes('Municipal water utility bill payable every 2 months.');
                  }}
                  className="p-1.5 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-cyan-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-cyan-500 block truncate">💧 Water Utility</span>
                  <span className="text-[9px] font-mono text-slate-400">450 ETB</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditTitle('Community Police & Security Dues (Bi-Monthly)');
                    setEditAmount('500');
                    setEditCategory('Rent & Lease');
                    setEditFrequency('EVERY_2_MONTHS');
                    setEditWalletId(wallets.find(w => w.type === 'CASH')?.id || wallets[0]?.id || '');
                    setEditNotes('Community security & police contribution every 2 months.');
                  }}
                  className="p-1.5 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-rose-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-rose-500 block truncate">👮 Police / Security</span>
                  <span className="text-[9px] font-mono text-slate-400">500 ETB</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditTitle('Staff Transport Allowance');
                    setEditAmount('1000');
                    setEditCategory('Payroll & Wages');
                    setEditFrequency('MONTHLY');
                    setEditWalletId(wallets.find(w => w.type === 'TELEBIRR')?.id || wallets[0]?.id || '');
                    setEditNotes('Monthly staff transport allowance.');
                  }}
                  className="p-1.5 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-emerald-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-emerald-500 block truncate">🚗 Transport</span>
                  <span className="text-[9px] font-mono text-slate-400">1,000 ETB</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Bill Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="e.g., Commercial Lounge Rent, Electricity, Fiber Internet..."
                  className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Amount (ETB)</label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none font-mono font-bold"
                  />
                  {editAmount && !isNaN(parseFloat(editAmount)) && (
                    <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">
                      Preview: {formatETB(parseFloat(editAmount))}
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Frequency Cycle</label>
                  <select
                    value={editFrequency}
                    onChange={e => setEditFrequency(e.target.value as RecurringFrequency)}
                    className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl p-2 text-slate-900 dark:text-white outline-none font-medium"
                  >
                    <option value="ONE_TIME">One-Time Advance Payment (Prepaid Upfront - Rent)</option>
                    <option value="MONTHLY">Monthly (Every Month)</option>
                    <option value="EVERY_3_WEEKS">Every 3-4 Weeks (21 Days - Electricity)</option>
                    <option value="EVERY_2_MONTHS">Every 2 Months (Bi-Monthly - Water / Police)</option>
                    <option value="QUARTERLY">Every 3 Months (Upfront / Quarterly - Rent)</option>
                    <option value="BIWEEKLY">Bi-Weekly (14 Days)</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="DAILY">Daily</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl p-2 text-slate-900 dark:text-white outline-none"
                  >
                    {categories.length > 0 ? (
                      categories.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Rent & Lease">Rent & Lease</option>
                        <option value="Utilities & Internet">Utilities & Internet</option>
                        <option value="Payroll & Wages">Payroll & Wages</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Funding Wallet</label>
                  <select
                    value={editWalletId}
                    onChange={e => setEditWalletId(e.target.value)}
                    className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl p-2 text-slate-900 dark:text-white outline-none"
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <ModernDateInput
                    label="Next Due Date"
                    value={editNextDueDate}
                    onChange={(val) => setEditNextDueDate(val)}
                    accentColor="purple"
                    size="sm"
                  />
                </div>

                <div>
                  <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Schedule Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as 'ACTIVE' | 'PAUSED')}
                    className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl p-2 text-slate-900 dark:text-white outline-none font-medium"
                  >
                    <option value="ACTIVE">Active (Included in reminders)</option>
                    <option value="PAUSED">Paused (Temporarily muted)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Beneficiary / Staff Member (Optional)</label>
                <input
                  type="text"
                  value={editBeneficiary}
                  onChange={e => setEditBeneficiary(e.target.value)}
                  placeholder="e.g. Person 1, Person 2, Person 3, Landlord..."
                  className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Notes / Contract Remarks</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="e.g. Contract ref, payment cycle remarks"
                  className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#A78BFA] shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 dark:text-[#8899BB] leading-relaxed">
                  Modifying this recurring schedule updates future agenda alerts and projections immediately without altering previously settled transaction logs.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-[#1E2D40]">
              <button
                type="button"
                onClick={() => setEditingRec(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!editTitle.trim() || !editAmount || parseFloat(editAmount) <= 0}
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 rounded-xl bg-[#A78BFA] hover:bg-[#A78BFA]/90 text-xs font-extrabold text-[#0A0E1A] shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Recurring Bill Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-[#A78BFA]/40 w-full max-w-lg p-5 rounded-2xl space-y-4 text-slate-900 dark:text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <h3 className="text-sm font-black flex items-center gap-2 text-slate-900 dark:text-white">
                <Repeat className="w-4 h-4 text-[#A78BFA]" />
                Add Recurring Bill Schedule
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets Selection */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-[#8899BB] block mb-1.5">
                Quick Template Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('RENT_3MO')}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-indigo-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-indigo-500 block">🏢 One-Time Advance Rent</span>
                  <span className="text-[9px] font-mono text-slate-400">69,000 ETB (Prepaid)</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('INTERNET')}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-sky-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-sky-500 block">🌐 Internet / Fiber</span>
                  <span className="text-[9px] font-mono text-slate-400">1,010 ETB / month</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('ELECTRICITY')}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-amber-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-amber-500 block">⚡ Electricity Units</span>
                  <span className="text-[9px] font-mono text-slate-400">2,050 ETB / 3-4 wks</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('WATER')}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-cyan-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-cyan-500 block">💧 Water Utility</span>
                  <span className="text-[9px] font-mono text-slate-400">450 ETB / 2 months</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('POLICE')}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-rose-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-rose-500 block">👮 Police / Security</span>
                  <span className="text-[9px] font-mono text-slate-400">500 ETB / 2 months</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('TRANSPORT_P1')}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] hover:border-emerald-500 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-emerald-500 block">🚗 Staff Transport</span>
                  <span className="text-[9px] font-mono text-slate-400">1,000 ETB / Person</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Bill Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Commercial Lounge Rent, Electricity, Internet..."
                  className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Amount (ETB)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Frequency Cycle</label>
                  <select
                    value={frequency}
                    onChange={e => setFrequency(e.target.value as RecurringFrequency)}
                    className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl p-2 text-slate-900 dark:text-white outline-none font-medium"
                  >
                    <option value="ONE_TIME">One-Time Advance Payment (Prepaid Upfront - Rent)</option>
                    <option value="MONTHLY">Monthly (Every Month)</option>
                    <option value="EVERY_3_WEEKS">Every 3-4 Weeks (21 Days - Electricity)</option>
                    <option value="EVERY_2_MONTHS">Every 2 Months (Bi-Monthly - Water / Police)</option>
                    <option value="QUARTERLY">Every 3 Months (Upfront / Quarterly - Rent)</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="DAILY">Daily</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl p-2 text-slate-900 dark:text-white outline-none"
                  >
                    {categories.length > 0 ? (
                      categories.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Rent & Lease">Rent & Lease</option>
                        <option value="Utilities & Internet">Utilities & Internet</option>
                        <option value="Payroll & Wages">Payroll & Wages</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Default Funding Wallet</label>
                  <select
                    value={walletId}
                    onChange={e => setWalletId(e.target.value)}
                    className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl p-2 text-slate-900 dark:text-white outline-none"
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <ModernDateInput
                  label="First Due Date"
                  value={nextDueDate}
                  onChange={(val) => setNextDueDate(val)}
                  accentColor="purple"
                  size="sm"
                  presets={[
                    { label: 'Today', value: new Date().toISOString().split('T')[0] },
                    { label: '+1m', value: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] }
                  ]}
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-[#8899BB] font-bold block mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Contract ref, payment cycle notes"
                  className="w-full bg-white dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#A78BFA] rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>

              {/* No Automatic Deduction Explanation */}
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#A78BFA] shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 dark:text-[#8899BB] leading-relaxed">
                  <strong>Manual Confirmation Mode:</strong> When this bill schedule is due, it will be highlighted on your dashboard and agenda. It will only be deducted when you click <span className="text-emerald-500 font-bold">&quot;Pay Bill&quot;</span>.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-[#1E2D40]">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!title.trim() || !amount}
                onClick={handleSaveAdd}
                className="flex-1 py-2.5 rounded-xl bg-[#A78BFA] hover:bg-[#A78BFA]/90 text-xs font-extrabold text-[#0A0E1A] shadow-lg cursor-pointer disabled:opacity-50"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Recurring Confirmation Modal */}
      {deletingRec && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-rose-200 dark:border-rose-900/50 max-w-sm w-full p-5 rounded-2xl space-y-4 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Recurring Bill?</h3>
                <p className="text-xs text-slate-500 dark:text-[#8899BB] font-semibold">{deletingRec.title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#8899BB] leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 dark:text-white">&quot;{deletingRec.title}&quot;</strong>? Future bill reminders for this item will be removed from your calendar.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeletingRec(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:bg-slate-200 dark:hover:bg-[#252E42] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRecurring}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-md hover:bg-rose-700 active:scale-[0.98] transition-all cursor-pointer"
              >
                Yes, Delete Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
