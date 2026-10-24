import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  Clock,
  RefreshCw,
  Plus,
  Play,
  ArrowRight,
  ExternalLink,
  Search,
  Filter,
  AlertTriangle,
  Lock,
  Layers,
  Copy,
  ChevronRight,
  Check,
  Calendar,
  Zap
} from 'lucide-react';
import { ERPState, IncomePendingConfirmation, TransactionConfirmed } from '../../types';
import { triggerHaptic } from '../../lib/haptics';
import { formatETB } from '../../lib/store';
import { parseBankSms, SAMPLE_SMS_PAYLOADS } from '../../lib/smsFraudEngine';

interface PaymentFraudPreventionViewProps {
  state: ERPState;
}

export const PaymentFraudPreventionView: React.FC<PaymentFraudPreventionViewProps> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed' | 'simulator' | 'api_docs'>('confirmed');
  const [pendingList, setPendingList] = useState<IncomePendingConfirmation[]>([]);
  const [confirmedList, setConfirmedList] = useState<TransactionConfirmed[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New Pending Payment Form
  const [showNewPendingModal, setShowNewPendingModal] = useState(false);
  const [expectedAmount, setExpectedAmount] = useState('');
  const [customerRef, setCustomerRef] = useState('');
  const [targetProvider, setTargetProvider] = useState<'telebirr' | 'cbe' | 'ebirr' | ''>('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Simulator State
  const [simSender, setSimSender] = useState('telebirr');
  const [simBody, setSimBody] = useState(SAMPLE_SMS_PAYLOADS.telebirr[0]);
  const [simReceivedAt, setSimReceivedAt] = useState(new Date().toISOString().slice(0, 16));
  const [simResult, setSimResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Copied token state
  const [copiedKey, setCopiedKey] = useState(false);

  // Fetch pending and confirmed records
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pendingRes, confirmedRes] = await Promise.all([
        fetch('/api/income-pending').catch(() => null),
        fetch('/api/transactions-confirmed').catch(() => null)
      ]);

      if (pendingRes && pendingRes.ok) {
        const json = await pendingRes.json();
        if (json.data) setPendingList(json.data);
      }
      if (confirmedRes && confirmedRes.ok) {
        const json = await confirmedRes.json();
        if (json.data) setConfirmedList(json.data);
      }
    } catch (err) {
      console.warn('Could not fetch from server:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePending = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expectedAmount);
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    triggerHaptic('medium');
    try {
      const res = await fetch('/api/income-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedAmount: amountNum,
          customerRef: customerRef.trim() || undefined,
          targetProvider: targetProvider || undefined,
          customerPhone: customerPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          staffId: state.currentUser.id,
          staffName: state.currentUser.name
        })
      });

      if (res.ok) {
        triggerHaptic('success');
        setShowNewPendingModal(false);
        setExpectedAmount('');
        setCustomerRef('');
        setCustomerPhone('');
        setNotes('');
        setStatusMessage('Payment intent registered! Waiting for official Bank SMS.');
        setTimeout(() => setStatusMessage(null), 5000);
        loadData();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Failed to create payment intent');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    }
  };

  const handleRunSimulation = async () => {
    triggerHaptic('heavy');
    setIsSimulating(true);
    setSimResult(null);

    try {
      const res = await fetch('/api/confirmSms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sms-secret-key': 'pluszone-secure-sms-token'
        },
        body: JSON.stringify({
          sender: simSender,
          body: simBody,
          receivedAt: new Date(simReceivedAt).toISOString()
        })
      });

      const json = await res.json();
      setSimResult(json);

      if (json.success) {
        triggerHaptic('success');
        loadData();
      } else {
        triggerHaptic('warning');
      }
    } catch (err: any) {
      setSimResult({
        success: false,
        error: err.message || 'Simulation network failure'
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(true);
    triggerHaptic('light');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Top Banner Message */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-slideDown">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0A0E1A] to-[#131926] border border-slate-800 dark:border-[#1E2D40] rounded-3xl p-6 shadow-2xl text-white space-y-4 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#00D4AA] text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero-Trust Bank SMS Protection</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Payment Fraud Prevention System
            </h1>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Eliminates spoofed Telebirr / CBE / E-Birr screenshots. Incoming bank SMS confirmations automatically record verified income—cashiers do not need to manually enter intents in the ERP.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowNewPendingModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
              title="Manual intent is optional - incoming SMS automatically records income"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Manual Intent (Optional)</span>
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 cursor-pointer transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Security Rule Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-800/80">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-[#00D4AA] shrink-0" />
            <div>
              <span className="font-bold text-slate-200 block">Zero-Click Ingestion</span>
              <span className="text-[10px] text-slate-400">Cashier manual ERP entry skipped</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-200 block">Whitelisted Senders</span>
              <span className="text-[10px] text-slate-400">telebirr, CBE, eBirr, 127 only</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-200 block">Strict Provider Isolation</span>
              <span className="text-[10px] text-slate-400">Isolated daily ledger docs per provider</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#1E2D40] pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'confirmed' as const, label: 'Confirmed Bank SMS Log', count: confirmedList.length, icon: ShieldCheck },
          { id: 'pending' as const, label: 'Income Records / Intents', count: pendingList.length, icon: Clock },
          { id: 'simulator' as const, label: 'SMS Ingestion Simulator', icon: Play },
          { id: 'api_docs' as const, label: 'Android Webhook Setup', icon: Smartphone }
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
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border ${
                isActive
                  ? 'bg-slate-900 dark:bg-[#131926] text-white dark:text-[#00D4AA] border-emerald-500/40 shadow-sm'
                  : 'bg-white dark:bg-[#1C2333]/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#1E2D40] hover:bg-slate-50 dark:hover:bg-[#1C2333]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00D4AA]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PENDING & AUTO-RECORDED INCOME */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-400">
              Payments confirmed by official bank SMS. Income is automatically booked directly into the ledger when authentic bank alerts arrive.
            </span>
          </div>

          {pendingList.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-[#1E2D40] bg-white dark:bg-[#131926] space-y-3">
              <Clock className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Income Records Yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When an official bank SMS arrives, verified income is created here automatically. Cashiers do not have to type anything in the ERP.
                </p>
              </div>
              <button
                onClick={() => setShowNewPendingModal(true)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs shadow cursor-pointer"
              >
                Create Manual Intent (Optional)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingList.map(item => {
                const isPaid = item.status === 'paid';
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isPaid
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30'
                        : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-[#1E2D40] shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-mono font-black text-slate-900 dark:text-white">
                            {formatETB(item.expectedAmount)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-300 animate-pulse'
                          }`}>
                            {item.status}
                          </span>
                          {item.autoGenerated && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/40 uppercase flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" />
                              Auto Ingested
                            </span>
                          )}
                          {item.targetProvider && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                              {item.targetProvider}
                            </span>
                          )}
                        </div>

                        {item.customerRef && (
                          <p className="text-xs font-mono text-slate-600 dark:text-slate-300 font-bold mt-1">
                            Ref: {item.customerRef}
                          </p>
                        )}
                        {item.customerPhone && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Phone: {item.customerPhone}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">
                            "{item.notes}"
                          </p>
                        )}
                      </div>

                      <div className="text-right text-[10px] text-slate-400 space-y-1">
                        <div>{item.staffName || 'System Receiver'}</div>
                        <div>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        {isPaid && item.matchedConfirmationId && (
                          <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 justify-end">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Verified</span>
                          </div>
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

      {/* TAB 2: CONFIRMED BANK SMS LOG */}
      {activeTab === 'confirmed' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>
              Immutable bank audit trail. Incoming official SMS captured on your dedicated device and recorded directly in <span className="font-mono text-emerald-600 dark:text-emerald-400">transactions_confirmed</span>.
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Cashier Entry Skipped
            </span>
          </div>

          {confirmedList.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-[#1E2D40] bg-white dark:bg-[#131926] space-y-3">
              <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Confirmed SMS Yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Use the SMS Ingestion Simulator tab to test parsing real bank SMS from Telebirr, CBE, or E-Birr.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {confirmedList.map(sms => (
                <div
                  key={sms.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] shadow-sm space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-black text-emerald-600 dark:text-[#00D4AA]">
                          +{formatETB(sms.amount)}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                          {sms.provider}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#1C2333]">
                          Ref: {sms.referenceNumber}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                        Payer: <span className="font-bold">{sms.senderName}</span> {sms.senderPhone ? `(${sms.senderPhone})` : ''}
                      </p>
                    </div>

                    <div className="text-right text-[10px] text-slate-400 space-y-0.5">
                      <div className="font-mono">Sender: {sms.sender}</div>
                      <div>Date: {sms.transactionDate}</div>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified & Booked</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] font-mono text-[11px] text-slate-600 dark:text-slate-300 break-words">
                    {sms.rawSmsText}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SMS INGESTION SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/30 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5" />
              Live Cloud Function Webhook Simulator
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Sends an authentic bank SMS payload to <code className="font-mono bg-white dark:bg-[#131926] px-1 py-0.5 rounded">POST /confirmSms</code> using your secret API key. Tests regex extraction, fixed-point integer cents math, and automatic booking directly into confirmed income and ledger (cashier manual entry skipped).
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Input Form */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] space-y-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Simulated Incoming Bank SMS
              </h3>

              {/* Sample Selector Quick Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Load Official Sample Templates:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSimSender('telebirr');
                      setSimBody(SAMPLE_SMS_PAYLOADS.telebirr[0]);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                  >
                    Telebirr 1,500 ETB
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimSender('CBE');
                      setSimBody(SAMPLE_SMS_PAYLOADS.cbe[0]);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-pointer"
                  >
                    CBE 2,850 ETB
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimSender('eBirr');
                      setSimBody(SAMPLE_SMS_PAYLOADS.ebirr[0]);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 cursor-pointer"
                  >
                    E-Birr 750 ETB
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SMS Sender Header (Whitelisted)
                  </label>
                  <input
                    type="text"
                    value={simSender}
                    onChange={e => setSimSender(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40] font-mono text-slate-900 dark:text-white"
                    placeholder="e.g. telebirr, CBE, eBirr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Received Timestamp
                  </label>
                  <input
                    type="datetime-local"
                    value={simReceivedAt}
                    onChange={e => setSimReceivedAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40] font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Raw SMS Message Body
                  </label>
                  <textarea
                    rows={4}
                    value={simBody}
                    onChange={e => setSimBody(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40] font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSimulating}
                  onClick={handleRunSimulation}
                  className="w-full py-2.5 rounded-xl bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-slate-950 font-extrabold text-xs shadow cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isSimulating ? 'Processing SMS Webhook...' : 'Post to /confirmSms Webhook'}</span>
                </button>
              </div>
            </div>

            {/* Right: Server Response & Result */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] space-y-3 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">
                  Webhook Processing Result
                </h3>

                {simResult ? (
                  <div className="space-y-3">
                    <div className={`p-3 rounded-xl border text-xs ${
                      simResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
                    }`}>
                      <div className="font-extrabold flex items-center gap-1.5">
                        {simResult.success ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                        <span>Status: {simResult.status || (simResult.success ? 'SUCCESS' : 'REJECTED')}</span>
                      </div>
                      <p className="mt-1 text-[11px]">{simResult.message || simResult.error}</p>
                    </div>

                    {simResult.confirmation && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] text-xs space-y-1 font-mono">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Parsed Breakdown:</div>
                        <div>Provider: <span className="font-bold text-slate-900 dark:text-white">{simResult.confirmation.provider}</span></div>
                        <div>Amount: <span className="font-bold text-emerald-600 dark:text-[#00D4AA]">{formatETB(simResult.confirmation.amount)}</span></div>
                        <div>Ref: <span className="font-bold text-slate-900 dark:text-white">{simResult.confirmation.referenceNumber}</span></div>
                        <div>Payer: <span className="font-bold text-slate-900 dark:text-white">{simResult.confirmation.senderName}</span></div>
                        <div>Date: <span className="text-slate-600 dark:text-slate-400">{simResult.confirmation.transactionDate}</span></div>
                      </div>
                    )}

                    {simResult.ledgerAggregation && (
                      <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/30 text-xs space-y-1">
                        <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          <span>Ledger Daily Aggregation:</span>
                        </span>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          Appended to daily document for <strong className="font-mono">{simResult.ledgerAggregation.provider}</strong> on <strong className="font-mono">{simResult.ledgerAggregation.calendarDay}</strong> in wallet <strong className="font-mono">{simResult.ledgerAggregation.walletId}</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    Press "Post to /confirmSms Webhook" to view the live JSON response and validation result.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-[#1E2D40] text-[11px] text-slate-400 flex items-center justify-between">
                <span>Webhook Route: /api/confirmSms</span>
                <span className="text-emerald-500 font-bold">Port 3000 Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ANDROID WEBHOOK SETUP */}
      {activeTab === 'api_docs' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#00D4AA]" />
              <span>Dedicated Company Phone Configuration</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Install an SMS Webhook Forwarder (e.g. <em>SMS Forwarder</em> or <em>MacroDroid</em>) on your dedicated Android phone that holds the company SIM card receiving official Telebirr / CBE alerts.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Webhook Target URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    type="text"
                    value="https://ais-dev-cmzxjxoqayl4lgqgu3fd7m-316110543649.europe-west2.run.app/confirmSms"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40] font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={() => copyToClipboard('https://ais-dev-cmzxjxoqayl4lgqgu3fd7m-316110543649.europe-west2.run.app/confirmSms')}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Required Header: Secret Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    type="text"
                    value="x-sms-secret-key: pluszone-secure-sms-token"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40] font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={() => copyToClipboard('pluszone-secure-sms-token')}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Key</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  JSON Forwarding Template (HTTP POST)
                </label>
                <pre className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-[#1E2D40] font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto">
{`{
  "sender": "%from%",
  "body": "%msg%",
  "receivedAt": "%timestamp%"
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER PENDING CUSTOMER INTENT */}
      {showNewPendingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 text-slate-900 dark:text-[#F0F4FF] shadow-2xl animate-slideUp space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#1E2D40]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#00D4AA]" />
                <span>Register Customer Payment Intent</span>
              </h3>
              <button
                onClick={() => setShowNewPendingModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePending} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Expected Amount (ETB) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={expectedAmount}
                  onChange={e => setExpectedAmount(e.target.value)}
                  placeholder="e.g. 1500.00"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40] font-mono text-base font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Provider (Optional)
                </label>
                <select
                  value={targetProvider}
                  onChange={e => setTargetProvider(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40] font-bold text-slate-900 dark:text-white"
                >
                  <option value="">Any Provider</option>
                  <option value="telebirr">Telebirr</option>
                  <option value="cbe">CBE</option>
                  <option value="ebirr">E-Birr</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Reference / FT Number (Optional)
                </label>
                <input
                  type="text"
                  value={customerRef}
                  onChange={e => setCustomerRef(e.target.value)}
                  placeholder="e.g. FT26067ABC or Telebirr Trans ID"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40] font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 0911234567"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Order Details
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Invoice #1042 or Table 5"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-300 dark:border-[#1E2D40] text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPendingModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00D4AA] text-slate-950 font-black shadow cursor-pointer"
                >
                  Save Intent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
