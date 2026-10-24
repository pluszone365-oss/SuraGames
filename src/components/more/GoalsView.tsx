import React, { useState } from 'react';
import { Target, Plus, Trophy, Sparkles, CheckCircle2, TrendingUp, Calendar, Trash2, Edit3, X, Check, DollarSign } from 'lucide-react';
import { Goal } from '../../types';
import { formatETB } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';
import { ModernDateInput } from '../common/ModernDateInput';

interface GoalsViewProps {
  goals: Goal[];
  onUpdateGoals?: (goals: Goal[]) => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ goals, onUpdateGoals }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  
  // New Goal Form State
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState<number>(100000);
  const [currentAmount, setCurrentAmount] = useState<number>(0);
  const [targetDate, setTargetDate] = useState(new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]);
  const [category, setCategory] = useState('Expansion');
  const [notes, setNotes] = useState('');

  // Quick Fund Modal State
  const [fundingGoal, setFundingGoal] = useState<Goal | null>(null);
  const [fundAddAmount, setFundAddAmount] = useState<number>(10000);

  const sortedGoals = [...goals].sort((a, b) => (b.createdDate || b.id).localeCompare(a.createdDate || a.id));

  const filteredGoals = sortedGoals.filter(g => {
    const isCompleted = g.currentAmount >= g.targetAmount || g.status === 'COMPLETED';
    if (filter === 'IN_PROGRESS') return !isCompleted;
    if (filter === 'COMPLETED') return isCompleted;
    return true;
  });

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    triggerHaptic('success');
    const newGoal: Goal = {
      id: `g-${Date.now()}`,
      title: title.trim(),
      targetAmount: Math.max(1000, Number(targetAmount)),
      currentAmount: Math.max(0, Number(currentAmount)),
      targetDate: targetDate || new Date().toISOString().split('T')[0],
      category,
      color: category === 'Equipment' ? '#00D4AA' : category === 'Expansion' ? '#3B82F6' : '#A78BFA',
      notes: notes.trim(),
      status: currentAmount >= targetAmount ? 'COMPLETED' : 'IN_PROGRESS',
      createdDate: new Date().toISOString().split('T')[0]
    };

    if (onUpdateGoals) {
      onUpdateGoals([newGoal, ...goals]);
    }

    setIsAddModalOpen(false);
    setTitle('');
    setTargetAmount(100000);
    setCurrentAmount(0);
    setNotes('');
  };

  const handleAddFunds = (goal: Goal) => {
    if (!onUpdateGoals || !fundAddAmount || fundAddAmount <= 0) return;
    triggerHaptic('success');
    const updatedGoals = goals.map(g => {
      if (g.id === goal.id) {
        const newCurrent = g.currentAmount + fundAddAmount;
        return {
          ...g,
          currentAmount: newCurrent,
          status: newCurrent >= g.targetAmount ? ('COMPLETED' as const) : g.status
        };
      }
      return g;
    });
    onUpdateGoals(updatedGoals);
    setFundingGoal(null);
  };

  const handleDeleteGoal = (id: string) => {
    if (!onUpdateGoals) return;
    triggerHaptic('medium');
    onUpdateGoals(goals.filter(g => g.id !== id));
  };

  return (
    <div className="space-y-5">
      {/* Header & Overview Stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-[#00D4AA]" />
            <span>Savings Goals & Reserve Targets</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#8899BB]">
            Track multi-year business expansions, hardware upgrades, and scenario-simulated funding targets.
          </p>
        </div>

        <button
          onClick={() => {
            triggerHaptic('light');
            setIsAddModalOpen(true);
          }}
          className="px-3.5 py-2 bg-gradient-to-r from-[#00D4AA] to-emerald-400 text-slate-950 font-black text-xs rounded-xl hover:opacity-95 shadow-md shadow-[#00D4AA]/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Aggregate Overview Card */}
      <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-[#334155] rounded-2xl p-4 text-white shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#00D4AA]/20 text-[#00D4AA]">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Total Funded Portfolio</p>
              <h4 className="text-base font-black font-mono text-white">
                {formatETB(totalSaved)} <span className="text-xs font-normal text-slate-400">/ {formatETB(totalTarget)}</span>
              </h4>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-mono font-black text-[#00D4AA]">{overallPct}%</span>
            <p className="text-[10px] text-slate-400 font-mono">Overall Progress</p>
          </div>
        </div>

        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-400 via-[#00D4AA] to-emerald-400 transition-all duration-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2">
        {[
          { key: 'ALL', label: `All Goals (${goals.length})` },
          { key: 'IN_PROGRESS', label: `In Progress (${goals.filter(g => g.currentAmount < g.targetAmount).length})` },
          { key: 'COMPLETED', label: `Achieved (${goals.filter(g => g.currentAmount >= g.targetAmount).length})` }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => {
              triggerHaptic('light');
              setFilter(f.key as any);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === f.key
                ? 'bg-[#00D4AA] text-slate-950 shadow-sm'
                : 'bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1E2D40] hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Goals Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredGoals.map((g) => {
          const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
          const isComplete = pct >= 100;
          const remaining = Math.max(0, g.targetAmount - g.currentAmount);

          return (
            <div
              key={g.id}
              className={`bg-white dark:bg-[#131926] border rounded-2xl p-4 space-y-3 shadow-sm transition-all relative ${
                isComplete
                  ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10'
                  : 'border-slate-200 dark:border-[#1E2D40]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {g.category}
                    </span>
                    {g.sourceScenario && (
                      <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        AI SCENARIO
                      </span>
                    )}
                    {isComplete && (
                      <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        ACHIEVED
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug">{g.title}</h4>
                </div>

                <div className="flex items-center gap-1">
                  {onUpdateGoals && (
                    <button
                      onClick={() => handleDeleteGoal(g.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Delete Goal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {g.notes && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0A0E17] p-2 rounded-xl border border-slate-100 dark:border-[#1E2D40]/50 leading-relaxed font-sans">
                  {g.notes}
                </p>
              )}

              {/* Progress Bar & Amounts */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="font-mono font-black text-teal-600 dark:text-[#00D4AA]">
                    {formatETB(g.currentAmount)}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Target: {formatETB(g.targetAmount)}
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-100 dark:bg-[#1C2333] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: g.color || '#00D4AA' }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-[#8899BB] font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Due {g.targetDate}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pct}% Funded {remaining > 0 && `(ETB ${remaining.toLocaleString()} left)`}
                  </span>
                </div>
              </div>

              {/* Quick Action to Fund Goal */}
              {onUpdateGoals && !isComplete && (
                <div className="pt-2 border-t border-slate-100 dark:border-[#1E2D40] flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Allocate revenue surplus:</span>
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setFundingGoal(g);
                      setFundAddAmount(Math.min(remaining, 10000));
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#1E2D40] dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-[#00D4AA]" />
                    <span>Add Funds</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredGoals.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white dark:bg-[#131926] border border-dashed border-slate-300 dark:border-[#1E2D40] rounded-2xl space-y-2">
            <Target className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No savings goals found in this view</p>
            <p className="text-[11px] text-slate-400">
              Run a scenario in the AI Simulator (6, 12, or 24 months) and click "Save as Goal", or create one manually!
            </p>
          </div>
        )}
      </div>

      {/* Manual Goal Creation Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <form onSubmit={handleCreateGoal} className="bg-[#0F172A] border border-[#1E2D40] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-[#00D4AA]" />
                <span>Create New Business Target</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Target Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5x PS5 Slim Console Upgrade"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-[#1E2D40] rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-[#00D4AA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Target (ETB)</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(Number(e.target.value))}
                    className="w-full bg-[#0A0E17] border border-[#1E2D40] rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-[#00D4AA]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Initial Balance</label>
                  <input
                    type="number"
                    min="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(Number(e.target.value))}
                    className="w-full bg-[#0A0E17] border border-[#1E2D40] rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-[#00D4AA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#0A0E17] border border-[#1E2D40] rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-[#00D4AA]"
                  >
                    <option value="Equipment">🎮 Equipment & Hardware</option>
                    <option value="Expansion">🏢 Branch Expansion</option>
                    <option value="Equb Accumulation">🤝 Equb Pool</option>
                    <option value="Emergency Fund">🛡️ Emergency Reserve</option>
                    <option value="Dividend Pool">💰 Partner Dividend</option>
                  </select>
                </div>
                <div>
                  <ModernDateInput
                    label="Target Date"
                    required
                    value={targetDate}
                    onChange={(val) => setTargetDate(val)}
                    accentColor="teal"
                    size="sm"
                    presets={[
                      { label: '+3m', value: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0] },
                      { label: '+6m', value: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0] },
                      { label: '+1y', value: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0] }
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Notes / Plan</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Funded by monthly PlayStation lounge operating surplus."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-[#1E2D40] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00D4AA]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1E2D40]">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-[#00D4AA] to-emerald-400 text-slate-950 font-black text-xs rounded-xl hover:opacity-95 shadow-md shadow-[#00D4AA]/20"
              >
                Create Goal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Fund Modal */}
      {fundingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#0F172A] border border-[#1E2D40] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#00D4AA]" />
                <span>Allocate Funds to Goal</span>
              </h3>
              <button
                onClick={() => setFundingGoal(null)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-300 font-bold">{fundingGoal.title}</p>
              <p className="text-slate-400 text-[11px]">
                Current: {formatETB(fundingGoal.currentAmount)} / {formatETB(fundingGoal.targetAmount)}
              </p>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Add Contribution (ETB)</label>
                <input
                  type="number"
                  min="100"
                  value={fundAddAmount}
                  onChange={(e) => setFundAddAmount(Number(e.target.value))}
                  className="w-full bg-[#0A0E17] border border-[#1E2D40] rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-[#00D4AA]"
                />
              </div>

              <div className="grid grid-cols-4 gap-1 pt-1">
                {[5000, 10000, 25000, 50000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFundAddAmount(amt)}
                    className="py-1 text-[10px] font-mono font-bold bg-[#0A0E17] border border-[#1E2D40] text-slate-300 rounded-lg hover:border-slate-500"
                  >
                    +{amt / 1000}k
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1E2D40]">
              <button
                onClick={() => setFundingGoal(null)}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddFunds(fundingGoal)}
                className="px-4 py-2 bg-gradient-to-r from-[#00D4AA] to-emerald-400 text-slate-950 font-black text-xs rounded-xl hover:opacity-95 shadow-md shadow-[#00D4AA]/20"
              >
                Confirm Allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
