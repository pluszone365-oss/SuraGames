import React, { useState } from 'react';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  Target,
  Briefcase,
  ShieldCheck,
  Zap,
  Repeat,
  DollarSign,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Sparkles,
  Info,
  Check
} from 'lucide-react';
import { ScenarioSimulationResult } from '../../lib/aiDecisionEngine';
import { formatETB } from '../../lib/store';

interface BusinessProjectionViewProps {
  scenarioResult: ScenarioSimulationResult;
  totalBalance: number;
  horizonMonths: 6 | 12 | 24;
  onSaveAsGoal?: (title: string, targetAmount: number, targetDate: string) => void;
  onDeepDiveInChat?: (scenarioTitle: string) => void;
}

export const BusinessProjectionView: React.FC<BusinessProjectionViewProps> = ({
  scenarioResult,
  totalBalance,
  horizonMonths,
  onSaveAsGoal,
  onDeepDiveInChat
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'STREAMS' | 'EXPENSES' | 'TRAJECTORY' | 'MILESTONES'>('OVERVIEW');
  const proj = scenarioResult.businessProjections;

  if (!proj) {
    return null;
  }

  const {
    annualRunRateRevenue,
    annualRunRateProfit,
    annualRunRateExpense,
    grossMarginPercent,
    netMarginPercent,
    operatingCashFlowHorizon,
    fixedCostRatio,
    breakEvenMonthlyRevenue,
    breakEvenDailyRevenue,
    estimatedEnterpriseValuation,
    valuationMultiple,
    growthMetrics,
    incomeStreams,
    expenseStreams,
    milestones
  } = proj;

  const totalIncomeSum = incomeStreams.reduce((s, x) => s + x.monthlyAmount, 0) || scenarioResult.projected.monthlyIncome || 1;
  const totalExpenseSum = expenseStreams.reduce((s, x) => s + x.monthlyAmount, 0) || scenarioResult.projected.monthlyExpense || 1;

  return (
    <div className="space-y-4 font-sans text-white">
      {/* Projection Navigation Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-[#1E2D40]/80">
        <div className="flex items-center gap-1 p-1 bg-[#0A0E17] border border-[#1E2D40] rounded-xl overflow-x-auto no-scrollbar scrollbar-none max-w-full touch-pan-x">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'OVERVIEW'
                ? 'bg-[#00D4AA] text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Overview</span>
            <span className="hidden sm:inline">Executive Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('STREAMS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'STREAMS'
                ? 'bg-[#00D4AA] text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Inflows ({incomeStreams.length})</span>
            <span className="hidden sm:inline">Recorded Income Streams ({incomeStreams.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EXPENSES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'EXPENSES'
                ? 'bg-[#00D4AA] text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Costs ({expenseStreams.length})</span>
            <span className="hidden sm:inline">Cost Structure ({expenseStreams.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TRAJECTORY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'TRAJECTORY'
                ? 'bg-[#00D4AA] text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Trajectory</span>
            <span className="hidden sm:inline">Multi-Month Trajectory</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MILESTONES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'MILESTONES'
                ? 'bg-[#00D4AA] text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Milestones ({milestones.length})</span>
            <span className="hidden sm:inline">Strategic Milestones ({milestones.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#00D4AA]" />
            {horizonMonths}M Projection Horizon
          </span>
        </div>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-3.5">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="p-3 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Annualized Revenue (ARR)</span>
              <div className="text-base sm:text-lg font-black text-emerald-400">
                ETB {annualRunRateRevenue.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 block">
                ETB {scenarioResult.projected.monthlyIncome.toLocaleString()} / mo
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Annualized Net Profit</span>
              <div className={`text-base sm:text-lg font-black ${annualRunRateProfit >= 0 ? 'text-[#00D4AA]' : 'text-rose-400'}`}>
                ETB {annualRunRateProfit.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 block">
                Net Margin: {netMarginPercent}%
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">{horizonMonths}-Mo Net Surplus</span>
              <div className="text-base sm:text-lg font-black text-white">
                ETB {operatingCashFlowHorizon.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 block">
                Cumulative cash flow
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase font-sans font-bold">Estimated Enterprise Value</span>
              <div className="text-base sm:text-lg font-black text-indigo-400">
                ETB {estimatedEnterpriseValuation.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 block">
                Based on {valuationMultiple}x ARR Profit + Liquid Assets
              </span>
            </div>
          </div>

          {/* Unit Economics & Break-Even Metric Row */}
          <div className="p-3.5 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                <Scale className="w-3.5 h-3.5 text-[#00D4AA] shrink-0" />
                <span>Operating Margin & Break-Even Thresholds</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">
                Derived directly from actual recorded cash velocity & recurring dues
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-[#141C2B] border border-[#1E2D40] space-y-1">
                <span className="text-[9px] text-slate-400 block uppercase">Net Profit Margin</span>
                <span className="text-base font-bold text-emerald-400 block">{netMarginPercent}%</span>
                <span className="text-[9px] text-slate-500 block">Surplus after all costs</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#141C2B] border border-[#1E2D40] space-y-1">
                <span className="text-[9px] text-slate-400 block uppercase">Fixed Cost Ratio</span>
                <span className="text-base font-bold text-orange-300 block">{fixedCostRatio}%</span>
                <span className="text-[9px] text-slate-500 block">Recurring dues & commitments</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#141C2B] border border-[#1E2D40] space-y-1">
                <span className="text-[9px] text-slate-400 block uppercase">Monthly Break-Even</span>
                <span className="text-base font-bold text-[#00D4AA] block">ETB {breakEvenMonthlyRevenue.toLocaleString()}</span>
                <span className="text-[9px] text-slate-500 block">Zero-loss monthly target</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#141C2B] border border-[#1E2D40] space-y-1">
                <span className="text-[9px] text-slate-400 block uppercase">Daily Break-Even</span>
                <span className="text-base font-bold text-[#00D4AA] block">ETB {breakEvenDailyRevenue.toLocaleString()}/day</span>
                <span className="text-[9px] text-slate-500 block">Required daily run-rate</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#141C2B]/60 border border-[#1E2D40] flex items-start gap-2.5 text-xs text-slate-300">
              <Info className="w-4 h-4 text-[#00D4AA] shrink-0 mt-0.5" />
              <div className="space-y-1 text-[11px] leading-relaxed">
                <p>
                  <strong>Health Summary:</strong> With a projected net margin of <span className="text-emerald-400 font-bold font-mono">{netMarginPercent}%</span> and fixed cost burden of <span className="text-amber-400 font-bold font-mono">{fixedCostRatio}%</span>, the business is projected to generate <span className="text-[#00D4AA] font-bold font-mono">ETB {scenarioResult.projected.monthlyProfit.toLocaleString()}</span> monthly discretionary surplus after servicing all active loans, Equb rounds, and recurring dues.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Dual Preview: Real Income Streams vs Cost Structure */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Real Income Streams Preview */}
            <div className="p-3.5 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                  <Layers className="w-3.5 h-3.5 text-[#00D4AA]" />
                  Recorded Income Streams ({incomeStreams.length})
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('STREAMS')}
                  className="text-[10px] text-[#00D4AA] hover:underline font-mono cursor-pointer"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-2.5">
                {incomeStreams.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No active income streams recorded.</p>
                ) : (
                  incomeStreams.slice(0, 4).map((stream, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-300 truncate max-w-[180px]">{stream.title}</span>
                        <span className="text-white font-bold">ETB {stream.monthlyAmount.toLocaleString()} ({stream.percentage}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1E2D40] rounded-full overflow-hidden">
                        <div className="h-full bg-[#00D4AA] rounded-full" style={{ width: `${Math.min(100, Math.max(5, stream.percentage))}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cost Mix Preview */}
            <div className="p-3.5 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                  <PieChart className="w-3.5 h-3.5 text-rose-400" />
                  Monthly Outflows & Dues ({expenseStreams.length})
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('EXPENSES')}
                  className="text-[10px] text-[#00D4AA] hover:underline font-mono cursor-pointer"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-2.5">
                {expenseStreams.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No active outflow commitments recorded.</p>
                ) : (
                  expenseStreams.slice(0, 4).map((stream, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-300 truncate max-w-[180px]">{stream.title}</span>
                        <span className="text-white font-bold">ETB {stream.monthlyAmount.toLocaleString()} ({stream.percentage}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1E2D40] rounded-full overflow-hidden">
                        <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(100, Math.max(5, stream.percentage))}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REVENUE STREAMS BREAKDOWN (100% Real Recorded Streams) */}
      {activeTab === 'STREAMS' && (
        <div className="p-3.5 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#1E2D40]">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                <Layers className="w-4 h-4 text-[#00D4AA]" />
                Actual Recorded Income Streams ({incomeStreams.length})
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Directly calculated from your actual transactions, regular customer revenues, and scenario delta.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              Total Monthly: ETB {scenarioResult.projected.monthlyIncome.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {incomeStreams.length === 0 ? (
              <div className="sm:col-span-2 p-8 text-center bg-[#141C2B] rounded-xl border border-[#1E2D40] text-slate-400 text-xs">
                No individual income streams found in current active filters.
              </div>
            ) : (
              incomeStreams.map((stream, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#141C2B] border border-[#1E2D40] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5 truncate max-w-[200px]">
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#00D4AA]" />
                      {stream.title}
                    </span>
                    <span className="text-[10px] font-mono text-[#00D4AA] font-bold">
                      {stream.percentage}% of Inflow
                    </span>
                  </div>
                  <div className="text-lg font-black font-mono text-white">
                    ETB {stream.monthlyAmount.toLocaleString()} <span className="text-xs font-normal text-slate-400">/ mo</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Category: {stream.category}</span>
                    <span className="font-mono text-slate-300">{stream.frequencyLabel}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-[#1E2D40] flex justify-between">
                    <span>{horizonMonths}-Month Horizon:</span>
                    <span className="text-white font-bold">ETB {stream.totalHorizonAmount.toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COST STRUCTURE & EXPENSES (100% Real Recorded Streams) */}
      {activeTab === 'EXPENSES' && (
        <div className="p-3.5 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#1E2D40]">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                <PieChart className="w-4 h-4 text-rose-400" />
                Actual Recorded Outflow Commitments ({expenseStreams.length})
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Exact breakdown of real monthly rent, active loans, Equb contributions, and operational expenses.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-full">
              Total Monthly: ETB {scenarioResult.projected.monthlyExpense.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expenseStreams.length === 0 ? (
              <div className="sm:col-span-3 p-8 text-center bg-[#141C2B] rounded-xl border border-[#1E2D40] text-slate-400 text-xs">
                No individual expense commitments found in current active filters.
              </div>
            ) : (
              expenseStreams.map((stream, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#141C2B] border border-[#1E2D40] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5 truncate max-w-[180px]">
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                      {stream.title}
                    </span>
                    <span className="text-[10px] font-mono text-rose-400 font-bold">
                      {stream.percentage}%
                    </span>
                  </div>
                  <div className="text-lg font-black font-mono text-white">
                    ETB {stream.monthlyAmount.toLocaleString()} <span className="text-xs font-normal text-slate-400">/ mo</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{stream.category}</span>
                    <span className="font-mono text-slate-300">{stream.frequencyLabel}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-[#1E2D40] flex justify-between">
                    <span>{horizonMonths}-Month Horizon:</span>
                    <span className="text-white font-bold">ETB {stream.totalHorizonAmount.toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MULTI-MONTH TRAJECTORY TABLE */}
      {activeTab === 'TRAJECTORY' && (() => {
        const startCash = totalBalance;
        const endCash = scenarioResult.monthlyForecast[scenarioResult.monthlyForecast.length - 1]?.endingCash ?? totalBalance;
        const netGrowth = endCash - startCash;
        const pctGrowth = startCash > 0 ? (netGrowth / startCash) * 100 : 0;
        const lowestMonth = scenarioResult.monthlyForecast.reduce((min, m) => m.endingCash < min.endingCash ? m : min, scenarioResult.monthlyForecast[0]);
        const surplusMonths = scenarioResult.monthlyForecast.filter(m => m.netCashflow >= 0).length;

        return (
          <div className="p-3.5 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#1E2D40]">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                  <TrendingUp className="w-4 h-4 text-[#00D4AA]" />
                  {horizonMonths}-Month Financial Trajectory Breakdown
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Month-by-month projected cash in, cash out, monthly operating surplus, and progressive cash reserve balances.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-white bg-[#141C2B] border border-[#1E2D40] px-2.5 py-1 rounded-full">
                Starting Cash: ETB {totalBalance.toLocaleString()}
              </span>
            </div>

            {/* TRAJECTORY SHORT SUMMARY CARD */}
            <div className="p-3 rounded-xl bg-[#141C2B] border border-[#1E2D40] space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-[#00D4AA]/15 text-[#00D4AA] flex items-center justify-center font-bold">
                    <TrendingUp className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Trajectory Short Summary
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    netGrowth >= 0
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>
                    {netGrowth >= 0 ? 'Expansion Trajectory' : 'Managed Burn Trajectory'}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {horizonMonths}-Month Horizon
                </span>
              </div>

              {/* 4 Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2 rounded-lg bg-[#0A0E17] border border-[#1E2D40]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    Net Trajectory
                  </span>
                  <span className={`text-xs font-bold font-mono block mt-0.5 ${netGrowth >= 0 ? 'text-[#00D4AA]' : 'text-rose-400'}`}>
                    {netGrowth >= 0 ? '+' : ''}ETB {netGrowth.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {pctGrowth > 0 ? '+' : ''}{pctGrowth.toFixed(1)}% delta
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#0A0E17] border border-[#1E2D40]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    Projected Ending Cash
                  </span>
                  <span className="text-xs font-bold font-mono text-white block mt-0.5">
                    ETB {endCash.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Month {horizonMonths} balance
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#0A0E17] border border-[#1E2D40]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    Lowest Cash Point
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-200 block mt-0.5">
                    ETB {lowestMonth?.endingCash?.toLocaleString() ?? 0}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Trough at {lowestMonth?.monthLabel ?? 'M1'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-[#0A0E17] border border-[#1E2D40]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    Surplus Months
                  </span>
                  <span className="text-xs font-bold font-mono text-emerald-400 block mt-0.5">
                    {surplusMonths} of {scenarioResult.monthlyForecast.length}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Cashflow positive
                  </span>
                </div>
              </div>

              {/* 1-Sentence Summary */}
              <div className="p-2 rounded-lg bg-[#0A0E17] border border-[#00D4AA]/20 text-[11px] text-slate-300 leading-relaxed flex items-start gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00D4AA] shrink-0 mt-0.5" />
                <p>
                  Over this {horizonMonths}-month horizon, your cash trajectory is projected to {netGrowth >= 0 ? 'expand by +' : 'contract by '}
                  <strong className="text-white">ETB {Math.abs(netGrowth).toLocaleString()} ({pctGrowth > 0 ? '+' : ''}{pctGrowth.toFixed(1)}%)</strong>, ending at <strong className="text-white">ETB {endCash.toLocaleString()}</strong> across {surplusMonths} surplus months. Lowest liquidity buffer occurs in {lowestMonth?.monthLabel} (ETB {lowestMonth?.endingCash?.toLocaleString()}).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar scrollbar-none touch-pan-x">
              <table className="w-full text-left text-xs font-mono min-w-[540px]">
                <thead>
                  <tr className="border-b border-[#1E2D40] text-slate-400 text-[10px] uppercase">
                    <th className="pb-2 pl-2">Period</th>
                    <th className="pb-2 text-right">Projected Inflow</th>
                    <th className="pb-2 text-right">Projected Outflow</th>
                    <th className="pb-2 text-right">Fixed Dues</th>
                    <th className="pb-2 text-right">Net Flow</th>
                    <th className="pb-2 text-right pr-2">Ending Cash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2D40]/50">
                  {scenarioResult.monthlyForecast.map((m) => (
                    <tr key={m.monthIndex} className="hover:bg-[#141C2B]/50 transition-colors">
                      <td className="py-2.5 pl-2 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00D4AA]" />
                          <span>{m.monthLabel}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block font-normal">{m.calendarMonth}</span>
                      </td>
                      <td className="py-2.5 text-right text-emerald-400 font-bold">
                        +ETB {m.projectedInflow.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-rose-400 font-bold">
                        -ETB {m.projectedOutflow.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-slate-300">
                        ETB {((m.recurringPayments || 0) + (m.loanRepayments || 0) + (m.activeEqubsCommitment || 0)).toLocaleString()}
                      </td>
                      <td className={`py-2.5 text-right font-bold ${m.netCashflow >= 0 ? 'text-[#00D4AA]' : 'text-rose-400'}`}>
                        {m.netCashflow >= 0 ? '+' : ''}ETB {m.netCashflow.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right pr-2 font-black text-white">
                        ETB {m.endingCash.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* TAB 5: STRATEGIC MILESTONES */}
      {activeTab === 'MILESTONES' && (
        <div className="p-3.5 rounded-xl bg-[#0A0E17] border border-[#1E2D40] space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#1E2D40]">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                <Target className="w-4 h-4 text-[#00D4AA]" />
                Horizon Strategic Milestones & Target Checkpoints
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Target milestones and projected cash reserves to monitor across execution stages.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-1 rounded-full">
              {milestones.length} Strategic Checkpoints
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {milestones.map((ms, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#141C2B] border border-[#1E2D40] hover:border-[#00D4AA]/40 transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white flex items-center gap-1.5 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00D4AA]" />
                    {ms.label}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Month {ms.month}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {ms.description}
                </p>

                <div className="p-2 rounded-lg bg-[#0A0E17] border border-[#1E2D40] space-y-1 text-[10px] font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Projected Cash Reserve:</span>
                    <span className="text-white font-bold">ETB {ms.projectedCash.toLocaleString()}</span>
                  </div>
                  <div className="text-indigo-300 font-medium pt-0.5 border-t border-[#1E2D40]/60">
                    🎯 {ms.targetMilestone}
                  </div>
                </div>

                {onSaveAsGoal && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetDate = new Date(Date.now() + ms.month * 30 * 24 * 60 * 60 * 1000).toISOString();
                      onSaveAsGoal(`${scenarioResult.title}: ${ms.label}`, ms.projectedCash, targetDate);
                    }}
                    className="w-full py-1.5 bg-[#0A0E17] hover:bg-[#1E2D40] border border-[#1E2D40] hover:border-[#00D4AA]/40 text-slate-200 hover:text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all font-mono"
                  >
                    <Target className="w-3 h-3 text-[#00D4AA]" />
                    <span>Save Checkpoint as ERP Goal</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
