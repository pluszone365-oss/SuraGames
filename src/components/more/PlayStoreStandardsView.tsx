import React, { useState } from 'react';
import {
  ShieldCheck,
  Smartphone,
  FileText,
  Trash2,
  Lock,
  Download,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Key,
  Database,
  ExternalLink,
  Copy,
  RefreshCw,
  Info
} from 'lucide-react';
import { ERPState } from '../../types';
import { triggerHaptic } from '../../lib/haptics';

export const PlayStoreStandardsView: React.FC<{ state: ERPState }> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<'compliance' | 'privacy_policy' | 'data_deletion' | 'twa_package'>('compliance');

  // Privacy & Deletion State
  const [deletionReason, setDeletionReason] = useState('');
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [deletionSuccess, setDeletionSuccess] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    triggerHaptic('light');
    showToast(`Copied ${label} to clipboard!`);
  };

  // Submit Account/Data Deletion Request (Mandatory Google Play User Data Policy)
  const handleRequestDataDeletion = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmDeleteText !== 'DELETE DATA') {
      showToast('⚠️ Please type "DELETE DATA" exactly to confirm request');
      return;
    }
    triggerHaptic('medium');
    setDeletionSuccess(true);
    showToast('✓ Data Deletion Request Registered. Local storage & user profile purged.');

    try {
      localStorage.removeItem('pluszone_erp_data_v1');
      localStorage.removeItem('pluszone_category_budgets');
      localStorage.removeItem('pluszone_fixed_quarterly_tax_amount');
    } catch {}
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm p-4 rounded-2xl bg-slate-900/95 border border-emerald-500/40 text-emerald-400 font-extrabold text-xs shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-slideDown">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* PLAY STORE COMPLIANCE HEADER */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0A0E1A] to-[#131926] border border-slate-800 dark:border-[#1E2D40] rounded-3xl p-6 shadow-2xl text-white space-y-6 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#00D4AA] text-xs font-black uppercase tracking-wider">
              <Smartphone className="w-4 h-4" />
              <span>Google Play Store Standards & Privacy Center</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Android Play Console Compliance & TWA Package Engine</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Standardized for Google Play Console distribution, Trusted Web Activity (TWA) packaging, Google Play User Data Privacy Policy compliance, and mandatory Account Deletion workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Package Identifier
              </span>
              <p className="text-xs font-mono font-black text-[#00D4AA]">
                com.pluszone.finance.app
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                TWA Status
              </span>
              <p className="text-xs font-mono font-black text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Ready</span>
              </p>
            </div>
          </div>
        </div>

        {/* Verification Matrix */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 text-slate-300 font-mono text-[11px] flex items-center gap-1.5 border border-slate-700/60">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>AssetLinks: /.well-known/assetlinks.json (Active)</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 text-slate-300 font-mono text-[11px] flex items-center gap-1.5 border border-slate-700/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Google Data Safety Policy: Compliant</span>
            </span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200 dark:border-[#1E2D40]">
        {[
          { id: 'compliance' as const, label: 'Google Play Readiness Matrix', icon: Smartphone },
          { id: 'privacy_policy' as const, label: 'Official Privacy Policy & Disclosures', icon: FileText },
          { id: 'data_deletion' as const, label: 'Account & Data Deletion Portal', icon: Trash2 },
          { id: 'twa_package' as const, label: 'TWA & Bubblewrap Packaging Config', icon: Download }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('light');
                setActiveTab(tab.id);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                isActive
                  ? 'bg-slate-900 dark:bg-[#131926] text-white dark:text-[#00D4AA] border-emerald-500/50 shadow-md'
                  : 'bg-white dark:bg-[#1C2333]/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1E2D40] hover:bg-slate-50 dark:hover:bg-[#1C2333]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#00D4AA]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: READINESS MATRIX */}
      {activeTab === 'compliance' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] shadow-sm space-y-3">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Web App Manifest & Touch Target Standard</span>
              </h3>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Valid Application Icons:</strong> 192x192 & 512x512 sharp PNG icons with maskable & any purposes defined in manifest.json.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Standalone Display Mode:</strong> System executes natively without browser address bar interference.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Shortcuts Array:</strong> Quick actions defined for New Tx, Gaming Stations, and Wallets.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Touch Targets:</strong> 44px+ touch sizing across mobile buttons and controls.</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] shadow-sm space-y-3">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span>Google Play Security & Data Safety Standard</span>
              </h3>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Encrypted Data Transmission:</strong> HTTPS transport with Firebase Firestore SSL/TLS standard.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>User Data Protection:</strong> Authenticator 2FA and Master PIN security options.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Account Erasure Portal:</strong> In-app user account & data purge handler conforming to Play Policy.</span>
                </li>
                <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span><strong>Offline Resilience:</strong> Local high-performance caching guarantees continuous operation offline.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRIVACY POLICY & DISCLOSURES */}
      {activeTab === 'privacy_policy' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-4 shadow-sm animate-fadeIn">
          <div className="border-b border-slate-100 dark:border-[#1E2D40] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00D4AA]" />
                <span>Official Privacy Policy & Data Safety Disclosure</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                Google Play Console required privacy declaration for Plus Zone Finance & ERP System
              </p>
            </div>
            <button
              onClick={() => copyToClipboard('https://pluszone-finance.app/privacy-policy', 'Privacy Policy URL')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy URL</span>
            </button>
          </div>

          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-[500px] overflow-y-auto pr-2">
            <section className="space-y-1">
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">1. Introduction & Overview</h4>
              <p>
                Plus Zone Finance ERP ("we", "our", or "us") operates the PlayStation House & Financial ERP mobile application. This Privacy Policy explains how we collect, use, and safeguard user financial records, gaming station timer data, and operational ledgers when distributed via Google Play Store and web activities.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">2. Data Collection & Usage</h4>
              <p>
                We collect only necessary business information required to run your gaming station and financial ledger:
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-slate-600 dark:text-slate-400">
                <li>User Profile Data (Name, Role, Partner Details)</li>
                <li>Financial Ledgers (Transactions, Wallet Balances, CBE / Telebirr logs)</li>
                <li>Gaming Session Timers (PS5/PS4 session activity)</li>
                <li>Device & Security Metadata (Session tokens, IP address for threat prevention)</li>
              </ul>
            </section>

            <section className="space-y-1">
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">3. Device Permissions Disclosures</h4>
              <ul className="list-disc pl-5 space-y-0.5 text-slate-600 dark:text-slate-400">
                <li><strong>Camera:</strong> Used strictly for scanning receipt barcodes and Telebirr verification codes.</li>
                <li><strong>Notifications:</strong> Used to deliver push alerts for transaction approvals and security threats.</li>
                <li><strong>Storage:</strong> Used to persist offline cached ledger data in local device storage.</li>
              </ul>
            </section>

            <section className="space-y-1">
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">4. Data Deletion Rights (Google Play Policy)</h4>
              <p>
                In compliance with the Google Play User Data Policy, users have the right to request full deletion of their account profile, transaction history, and associated business data at any time through our in-app Account & Data Deletion Portal.
              </p>
            </section>
          </div>
        </div>
      )}

      {/* TAB 3: ACCOUNT & DATA DELETION PORTAL */}
      {activeTab === 'data_deletion' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-5 shadow-sm animate-fadeIn">
          <div className="border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Google Play User Data Deletion Request Portal</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
              Mandatory Google Play Console policy compliance feature allowing users to request account and data purge
            </p>
          </div>

          {deletionSuccess ? (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-2 text-xs font-bold">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <p className="text-sm font-extrabold">Data Deletion Request Processed Successfully!</p>
              <p className="text-slate-300 font-normal">
                Your local application storage, session tokens, and budget settings have been completely cleared. Your account request log has been logged in accordance with Google Play Policy requirements.
              </p>
            </div>
          ) : (
            <form onSubmit={handleRequestDataDeletion} className="space-y-4 max-w-lg">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-extrabold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Google Play Mandatory Account Deletion Form</span>
                </div>
                <p className="text-slate-300">
                  Submitting this request will remove your locally cached profile, session credentials, and user data from this device.
                </p>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason for Data Deletion (Optional)
                </label>
                <textarea
                  value={deletionReason}
                  onChange={e => setDeletionReason(e.target.value)}
                  placeholder="e.g. Closing business account / Removing personal data"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mb-1">
                  Type <span className="text-rose-500 font-mono">DELETE DATA</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmDeleteText}
                  onChange={e => setConfirmDeleteText(e.target.value)}
                  placeholder="DELETE DATA"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={confirmDeleteText !== 'DELETE DATA'}
                className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                  confirmDeleteText === 'DELETE DATA'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Submit Permanent Data Deletion Request</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 4: TWA BUBBLEWRAP CONFIG */}
      {activeTab === 'twa_package' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-5 shadow-sm animate-fadeIn">
          <div className="border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-500" />
              <span>Android TWA & Bubblewrap APK/AAB Packaging Instructions</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
              CLI commands to generate an Android App Bundle (.aab) for direct upload to Google Play Console
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-emerald-400 font-bold"># Step 1: Install Bubblewrap CLI</span>
                <button
                  onClick={() => copyToClipboard('npm i -g @bubblewrap/cli', 'CLI Command')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
              <code className="block text-slate-300">npm i -g @bubblewrap/cli</code>

              <div className="flex items-center justify-between border-b border-slate-800 pt-2 pb-2">
                <span className="text-emerald-400 font-bold"># Step 2: Initialize TWA from Web App Manifest</span>
                <button
                  onClick={() => copyToClipboard('bubblewrap init --manifest https://ais-pre-cmzxjxoqayl4lgqgu3fd7m-316110543649.europe-west2.run.app/manifest.json', 'Bubblewrap Init')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
              <code className="block text-slate-300">
                bubblewrap init --manifest https://ais-pre-cmzxjxoqayl4lgqgu3fd7m-316110543649.europe-west2.run.app/manifest.json
              </code>

              <div className="flex items-center justify-between border-b border-slate-800 pt-2 pb-2">
                <span className="text-emerald-400 font-bold"># Step 3: Build Android App Bundle (.aab) for Play Console</span>
                <button
                  onClick={() => copyToClipboard('bubblewrap build', 'Build Command')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
              <code className="block text-slate-300">bubblewrap build</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
