import React from 'react';
import { Briefcase } from 'lucide-react';
import { Asset, Wallet } from '../../types';
import { formatETB } from '../../lib/store';

export const AssetsView: React.FC<{ assets: Asset[]; wallets: Wallet[] }> = ({ assets, wallets }) => {
  const sortedAssets = [...assets].sort((a, b) => {
    const dateA = new Date(a.purchaseDate || 0).getTime();
    const dateB = new Date(b.purchaseDate || 0).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-[#F5A623]" />
          Fixed Assets & Straight-Line Depreciation
        </h3>
        <p className="text-xs text-slate-500 dark:text-[#8899BB]">Generators, store fixtures, vehicles & equipment inventory</p>
      </div>

      <div className="space-y-3">
        {sortedAssets.map((a) => {
          const wallet = wallets.find(w => w.id === a.fundingWalletId);
          return (
            <div key={a.id} className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] bg-amber-500/10 dark:bg-[#F5A623]/20 text-amber-700 dark:text-[#F5A623] px-2 py-0.5 rounded font-mono font-bold">
                    {a.category}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{a.name}</h4>
                  <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Purchased {a.purchaseDate} via {wallet?.name}</p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] text-slate-500 dark:text-[#8899BB]">Book Value</p>
                  <p className="text-sm font-black font-mono text-amber-600 dark:text-[#F5A623]">{formatETB(a.currentValue)}</p>
                  <p className="text-[10px] text-slate-400 dark:text-[#8899BB]">Original: {formatETB(a.purchasePrice)}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#1C2333] p-2 rounded-xl text-[10px] text-slate-500 dark:text-[#8899BB] flex justify-between border border-slate-100 dark:border-transparent">
                <span>Depreciation Method: <strong className="text-slate-900 dark:text-white">{a.depreciationMethod}</strong></span>
                <span>Useful Life: <strong className="text-slate-900 dark:text-white">{a.usefulLifeYears} Years</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
