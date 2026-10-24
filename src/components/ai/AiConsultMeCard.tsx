import React from 'react';
import {
  Sparkles,
  Bot,
  Sliders,
  TrendingUp,
  Store,
  Percent,
  AlertTriangle,
  ArrowRight,
  Zap,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { RecencyAnalysis } from '../../lib/aiDecisionEngine';
import { formatETB } from '../../lib/store';
import { triggerHaptic } from '../../lib/haptics';

interface AiConsultMeCardProps {
  analysis: RecencyAnalysis;
  userName?: string;
  onOpenAiAssistant: (prompt?: string, initialMode?: 'chat' | 'simulator') => void;
}

export const AiConsultMeCard: React.FC<AiConsultMeCardProps> = ({
  analysis,
  userName = 'Partner',
  onOpenAiAssistant
}) => {
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const quickScenarios = [
    {
      label: '📈 What if prices +5%?',
      prompt: 'Gemini, what will be the exact projected outcome if I increase hourly PlayStation prices by 5%? Calculate customer churn elasticity, monthly revenue change, and profit delta.',
      mode: 'simulator' as const
    },
    {
      label: '🏢 What if 2nd branch in Bole?',
      prompt: 'Gemini, what if we open another branch in Addis Ababa (Bole or Megenagna) with ETB 450,000 CapEx and ETB 55,000 monthly overhead? Model the payback period and cash buffer impact.',
      mode: 'simulator' as const
    },
    {
      label: '⚠️ What if expenses rise 10%?',
      prompt: 'Gemini, what if our operating expenses increase by 10% over the next 3 months? Calculate how much our monthly profit and zero-revenue survival runway will shrink.',
      mode: 'simulator' as const
    },
    {
      label: '📉 What if revenue drops 20%?',
      prompt: 'Gemini stress-test: What if income decreases by 20% next month during school exams or rainy weeks? Will we remain cashflow positive?',
      mode: 'simulator' as const
    }
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#101726] to-[#0A0E1A] text-white border border-[#00D4AA]/30 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden space-y-4">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#00D4AA]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* HEADER STRIP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00D4AA] via-[#00B894] to-[#3B82F6] flex items-center justify-center text-slate-950 font-black shadow-lg shadow-[#00D4AA]/20 shrink-0">
            <Bot className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                Gemini Chatbot & Decision Simulator
              </h3>
              <span className="text-[9px] bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/40 px-2 py-0.5 rounded-full font-mono font-extrabold flex items-center gap-1">
                <Activity className="w-2.5 h-2.5 animate-pulse" />
                70% RECENCY WEIGHTED
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {getTimeGreeting()}, {userName}. Ask multi-turn strategic financial questions to Gemini or simulate business decisions before committing capital.
            </p>
          </div>
        </div>

        {/* TWO PRIMARY ACTIONS */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenAiAssistant(undefined, 'simulator');
            }}
            className="px-3.5 py-1.5 bg-[#182234] hover:bg-[#202E44] border border-[#1E2D40] hover:border-[#00D4AA]/50 text-slate-200 hover:text-[#00D4AA] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sliders className="w-3.5 h-3.5 text-[#00D4AA]" />
            <span>Business Decision Simulator</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenAiAssistant(undefined, 'chat');
            }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-[#00D4AA] text-slate-950 hover:opacity-95 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#00D4AA]/20"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Open Gemini Chat</span>
          </button>
        </div>
      </div>

      {/* QUICK STATUS STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs relative z-10">
        <div className="p-2.5 rounded-xl bg-[#141C2B]/90 border border-[#1E2D40] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Recency-Weighted Profit</span>
            <span className="text-sm font-black font-mono text-[#00D4AA]">
              {formatETB(analysis.recencyWeightedMonthlyProfit)}/mo
            </span>
          </div>
          <TrendingUp className="w-4 h-4 text-[#00D4AA]" />
        </div>

        <div className="p-2.5 rounded-xl bg-[#141C2B]/90 border border-[#1E2D40] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Next Month Inflow</span>
            <span className="text-sm font-black font-mono text-emerald-400">
              ETB {analysis.forecastNextMonthRange.min.toLocaleString()} – {analysis.forecastNextMonthRange.max.toLocaleString()}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {analysis.forecastNextMonthRange.confidence}% conf
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#141C2B]/90 border border-[#1E2D40] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Weekend Surge Velocity</span>
            <span className="text-sm font-black font-mono text-amber-400">
              +{analysis.weekendVsWeekdayRatio}% vs Weekdays
            </span>
          </div>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
      </div>

      {/* QUICK WHAT-IF SIMULATION CHIPS */}
      <div className="space-y-2 relative z-10">
        <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
          Simulate a Decision with 1 Click:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {quickScenarios.map((s, idx) => (
            <button
              key={idx}
              onClick={() => {
                triggerHaptic('medium');
                onOpenAiAssistant(s.prompt, s.mode);
              }}
              className="p-2.5 rounded-xl bg-[#131B2A] hover:bg-[#1C273B] border border-[#1E2D40] hover:border-[#00D4AA]/40 text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center justify-between text-left cursor-pointer group shadow-2xs"
            >
              <span className="truncate">{s.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#00D4AA] transition-transform group-hover:translate-x-0.5 shrink-0 ml-1" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
