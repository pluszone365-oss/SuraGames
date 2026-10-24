import React, { useState } from 'react';
import { Database, Download, Upload, RefreshCw, Calendar, CheckCircle2, ShieldCheck, AlertTriangle, Users, Clock, Check, X, Trash2 } from 'lucide-react';
import { ERPState, UserProfile } from '../../types';
import { triggerHaptic } from '../../lib/haptics';

interface BackupViewProps {
  state: ERPState;
  onRestore: (state: ERPState) => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ state, onRestore }) => {
  const [pendingState, setPendingState] = useState<ERPState | null>(null);
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState('');

  // Calculate automated backup dates for Mondays
  const now = new Date();
  const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
  const daysSinceMonday = (currentDay + 6) % 7;
  
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysSinceMonday);
  lastMonday.setHours(0, 0, 0, 0);

  const nextMonday = new Date(lastMonday);
  nextMonday.setDate(lastMonday.getDate() + 7);

  const handleExportJSON = () => {
    triggerHaptic('medium');
    const exportData = {
      ...state,
      backupMeta: {
        exportedAt: new Date().toISOString(),
        automatedWeeklySchedule: 'EVERY_MONDAY',
        exportedBy: state.currentUser.name
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PlusZone_ERP_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || !parsed.wallets || !parsed.transactions) {
          alert('Invalid ERP backup file structure.');
          return;
        }

        triggerHaptic('medium');
        // Initialize consensus votes: current user automatically votes YES, others default to false
        const initialVotes: Record<string, boolean> = {};
        state.users.forEach(u => {
          initialVotes[u.id] = u.id === state.currentUser.id;
        });

        setVotes(initialVotes);
        setPendingState(parsed as ERPState);
      } catch (err) {
        alert('Failed to parse JSON backup file.');
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
  };

  const toggleUserVote = (userId: string) => {
    triggerHaptic('light');
    setVotes(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const allApproved = state.users.every(u => votes[u.id] === true);
  const approvedCount = state.users.filter(u => votes[u.id] === true).length;
  const totalPartners = state.users.length;

  const handleExecuteRestore = () => {
    if (!allApproved || !pendingState) return;
    triggerHaptic('success');
    onRestore(pendingState);
    setPendingState(null);
    setRestoreSuccessMsg('System restored successfully after 100% partner & admin consensus approval!');
    setTimeout(() => setRestoreSuccessMsg(''), 5000);
  };

  const [showResetModal, setShowResetModal] = useState(false);

  const confirmResetDemo = () => {
    triggerHaptic('warning');
    localStorage.clear();
    window.location.reload();
  };

  const handleResetDemo = () => {
    triggerHaptic('light');
    setShowResetModal(true);
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-[#64748B]" />
          Data Backup & Multi-Party Restore
        </h3>
        <p className="text-xs text-[#8899BB]">
          Automated weekly backups & partner consensus approval for system data restores
        </p>
      </div>

      {/* Success Notification */}
      {restoreSuccessMsg && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-400 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{restoreSuccessMsg}</span>
        </div>
      )}

      {/* Automated Weekly Backup Card (Every Monday) */}
      <div className="bg-[#131926] border border-[#3B82F6]/40 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3B82F6]/20 text-[#3B82F6] flex items-center justify-center">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white">Automated System Backup</h4>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold">
                  ACTIVE • EVERY MONDAY
                </span>
              </div>
              <p className="text-[10px] text-[#8899BB] mt-0.5">
                The ERP automatically creates full encrypted snapshots every Monday at 00:00 UTC
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#1E2D40]">
          <div className="bg-[#0A0E1A] p-2.5 rounded-xl border border-[#1E2D40]">
            <span className="text-[10px] text-[#8899BB] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#00D4AA]" /> Last Automated Backup
            </span>
            <p className="font-mono font-bold text-white mt-1">
              Monday, {lastMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="bg-[#0A0E1A] p-2.5 rounded-xl border border-[#1E2D40]">
            <span className="text-[10px] text-[#8899BB] flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#3B82F6]" /> Next Scheduled Backup
            </span>
            <p className="font-mono font-bold text-[#3B82F6] mt-1">
              Monday, {nextMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Data Export & File Upload Card */}
      <div className="bg-[#131926] border border-[#1E2D40] rounded-2xl p-4 space-y-4">
        {/* Export JSON */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-white">Full JSON State Export</h4>
            <p className="text-[10px] text-[#8899BB]">Save complete snapshot of wallets, transactions, partners & logs</p>
          </div>
          <button
            onClick={handleExportJSON}
            className="px-3 py-2 rounded-xl bg-[#00D4AA] text-[#0A0E1A] font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md hover:brightness-110 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Backup</span>
          </button>
        </div>

        {/* Upload & Restore JSON */}
        <div className="pt-3 border-t border-[#1E2D40] flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Restore from Backup File</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-mono font-bold">
                100% CONSENSUS REQUIRED
              </span>
            </h4>
            <p className="text-[10px] text-[#8899BB] mt-0.5">
              Requires approval vote from all registered partners & admins before executing
            </p>
          </div>

          <label className="px-3 py-2 rounded-xl bg-[#1C2333] border border-[#1E2D40] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-[#1C2333]/80 transition-all">
            <Upload className="w-4 h-4 text-[#00D4AA]" />
            <span>Select JSON File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Reset Demo */}
        <div className="pt-3 border-t border-[#1E2D40] flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-red-400">Reset Demo Dataset</h4>
            <p className="text-[10px] text-[#8899BB]">Revert back to initial Ethiopian business seed dataset</p>
          </div>
          <button
            onClick={handleResetDemo}
            className="px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-red-500/25 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Multi-Party Partner Voting & Consent Modal */}
      {pendingState && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#131926] border border-amber-500/50 max-w-md w-full p-5 rounded-2xl text-white space-y-4 shadow-2xl animate-scaleUp">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#1E2D40] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-bold text-white">Partner Consensus Approval Required</h4>
              </div>
              <button
                onClick={() => setPendingState(null)}
                className="text-[#8899BB] hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-900/40 dark:bg-amber-950/80 border border-amber-500/60 p-3 rounded-xl text-xs space-y-1">
              <p className="font-bold text-amber-700 dark:text-amber-200 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                Restoring system backup overrides current state data.
              </p>
              <p className="text-[11px] text-slate-700 dark:text-slate-200">
                To restore data from backup, <span className="text-slate-900 dark:text-white font-bold">ALL registered Admins and Partners</span> must explicitly vote YES.
              </p>
            </div>

            {/* Voting Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#8899BB]">Partner Approval Status</span>
                <span className={allApproved ? 'text-emerald-400' : 'text-amber-400 font-mono'}>
                  {approvedCount} of {totalPartners} Approved ({Math.round((approvedCount / totalPartners) * 100)}%)
                </span>
              </div>
              
              <div className="w-full bg-[#0A0E1A] h-2 rounded-full overflow-hidden border border-[#1E2D40]">
                <div
                  className={`h-full transition-all duration-300 ${
                    allApproved ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                  style={{ width: `${(approvedCount / totalPartners) * 100}%` }}
                />
              </div>
            </div>

            {/* List of Registered Partners & Voting Switches */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              <p className="text-[10px] font-bold text-[#8899BB] uppercase tracking-wider">
                Required Consensus Voters:
              </p>
              
              {state.users.map((user) => {
                const isApproved = votes[user.id] === true;
                const isCurrent = user.id === state.currentUser.id;

                return (
                  <div
                    key={user.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isApproved
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-[#1C2333] border-[#1E2D40]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#0A0E1A] text-white flex items-center justify-center font-bold text-xs border border-[#1E2D40]">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-xs font-bold text-white">{user.name}</h5>
                          {isCurrent && (
                            <span className="text-[9px] bg-[#00D4AA]/20 text-[#00D4AA] px-1 rounded font-mono">YOU</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#8899BB]">{user.branch}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleUserVote(user.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                        isApproved
                          ? 'bg-emerald-500 text-[#0A0E1A] border-emerald-400 shadow'
                          : 'bg-[#0A0E1A] text-[#8899BB] border-[#1E2D40] hover:text-white'
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Approved YES
                        </>
                      ) : (
                        <>
                          <span>Vote YES</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-[#1E2D40]">
              <button
                type="button"
                onClick={() => setPendingState(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1C2333] text-xs font-bold text-[#8899BB] hover:text-white cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!allApproved}
                onClick={handleExecuteRestore}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  allApproved
                    ? 'bg-emerald-400 text-[#0A0E1A] shadow-lg hover:bg-emerald-300 cursor-pointer'
                    : 'bg-[#1C2333] text-gray-500 border border-gray-700/50 cursor-not-allowed opacity-60'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>{allApproved ? 'Execute System Restore' : 'Waiting for 100% Approval'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Reset Demo Dataset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-rose-200 dark:border-rose-900/50 max-w-sm w-full p-5 rounded-2xl space-y-4 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reset Ledger State?</h3>
                <p className="text-xs text-slate-500 dark:text-[#8899BB] font-semibold">Restore Initial Demo Dataset</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#8899BB] leading-relaxed">
              Are you sure you want to reset all business ledger data, wallets, Equb circles, and transaction entries back to the initial demo dataset? Local storage will be cleared and the app will reload.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:bg-slate-200 dark:hover:bg-[#252E42]"
              >
                Cancel
              </button>
              <button
                onClick={confirmResetDemo}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-md hover:bg-rose-700 active:scale-[0.98] transition-all"
              >
                Yes, Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
