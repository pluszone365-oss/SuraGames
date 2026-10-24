import React, { useState, useEffect } from 'react';
import {
  CloudOff,
  ExternalLink,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Info
} from 'lucide-react';
import { ERPState } from '../../types';
import {
  isFirestoreQuotaExceeded,
  FIRESTORE_UPGRADE_URL,
  FIRESTORE_PRICING_URL,
  markQuotaExceeded
} from '../../lib/firebase';
import { triggerHaptic } from '../../lib/haptics';

interface FirestoreQuotaBannerProps {
  state: ERPState;
}

export const FirestoreQuotaBanner: React.FC<FirestoreQuotaBannerProps> = ({ state }) => {
  const [isExceeded, setIsExceeded] = useState<boolean>(() => isFirestoreQuotaExceeded());
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    const handleQuotaEvent = () => {
      setIsExceeded(true);
    };

    window.addEventListener('pluszone:firestore-quota-exceeded', handleQuotaEvent);
    // Periodic check
    const timer = setInterval(() => {
      setIsExceeded(isFirestoreQuotaExceeded());
    }, 5000);

    return () => {
      window.removeEventListener('pluszone:firestore-quota-exceeded', handleQuotaEvent);
      clearInterval(timer);
    };
  }, []);

  if (!isExceeded) {
    return null;
  }

  const handleExportBackup = () => {
    try {
      setIsExporting(true);
      triggerHaptic('medium');
      const backupData = {
        exportedAt: new Date().toISOString(),
        version: 'PlusZone-ERP-Backup-v1',
        totalTransactions: state.transactions.length,
        totalWallets: state.wallets.length,
        state: state
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pluszone-erp-full-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export JSON backup:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Completely hidden when dismissed (no floating banner or pill)
  if (isDismissed) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-amber-50 via-amber-100/70 to-orange-50 dark:from-amber-950/40 dark:via-amber-900/25 dark:to-orange-950/30 border-b border-amber-200 dark:border-amber-700/40 px-4 py-2.5 transition-all text-xs text-amber-900 dark:text-amber-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        
        {/* Left: Icon + Text */}
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
            <CloudOff className="w-4 h-4" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-amber-100">
                Firestore Free Tier Daily Quota Reached
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200/80 dark:bg-amber-800/60 text-amber-900 dark:text-amber-200">
                100% Offline Persistence Active
              </span>
            </div>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/85 leading-relaxed">
              Your free daily writes quota is exhausted for today. All changes, transactions, equbs, and loans are{' '}
              <strong className="font-semibold text-slate-900 dark:text-white">safely preserved in your browser local offline storage</strong>{' '}
              and will automatically sync to Firestore once the daily quota resets tomorrow at 00:00 UTC.
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-amber-300 dark:border-amber-700/60 text-slate-800 dark:text-slate-200 font-medium transition shadow-xs text-[11px]"
            title="Download full database snapshot as JSON"
          >
            <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{isExporting ? 'Exporting...' : 'Export JSON Backup'}</span>
          </button>

          <a
            href={FIRESTORE_UPGRADE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition shadow-xs text-[11px]"
            title="Open Firebase Console to upgrade Firestore plan"
          >
            <span>Upgrade Database</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <a
            href={FIRESTORE_PRICING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-amber-700 dark:text-amber-400 underline hover:text-amber-900 dark:hover:text-amber-300 transition hidden sm:inline"
          >
            Spark Quota Limits
          </a>

          <button
            onClick={() => {
              triggerHaptic('light');
              setIsDismissed(true);
            }}
            className="p-1 rounded-md text-amber-700 dark:text-amber-400 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 transition"
            title="Dismiss banner (collapses to offline badge)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
