import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Key,
  Smartphone,
  Clock,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  QrCode,
  Copy,
  RefreshCw,
  Trash2,
  Plus,
  Globe,
  Radio,
  Sliders,
  Send,
  Eye,
  EyeOff,
  Sparkles,
  Download,
  X,
  Server,
  Zap,
  Activity
} from 'lucide-react';
import { ERPState } from '../../types';
import { triggerHaptic } from '../../lib/haptics';
import {
  requestNotificationPermission,
  sendExternalNotification,
  getNotificationPermission
} from '../../lib/notifications';
import { PaymentFraudPreventionView } from './PaymentFraudPreventionView';

export interface SecuritySession {
  id: string;
  deviceName: string;
  browser: string;
  ipAddress: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  status: 'TRUSTED' | 'SUSPICIOUS' | 'REVOKED';
}

export interface SecurityEventLog {
  id: string;
  timestamp: string;
  event: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';
  ip: string;
  user: string;
  location: string;
}

export const SecuritySystemView: React.FC<{ state: ERPState }> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<
    'radar' | 'fraud_prevention' | 'sessions' | '2fa' | 'pin' | 'ip_geofence'
  >('radar');

  // Security 2FA State
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pluszone_2fa_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [twoFactorSecret] = useState('JBSWY3DPEHPK3PXP');
  const [otpInput, setOtpInput] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Security PIN State
  const [securityPin, setSecurityPin] = useState<string>(() => {
    try {
      return localStorage.getItem('pluszone_security_pin') || '1234';
    } catch {
      return '1234';
    }
  });
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [requirePinForTransfers, setRequirePinForTransfers] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pluszone_require_pin_transfers') === 'true';
    } catch {
      return true;
    }
  });

  // Emergency Lockdown State
  const [emergencyLockdown, setEmergencyLockdown] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pluszone_emergency_lockdown') === 'true';
    } catch {
      return false;
    }
  });

  // Session Timeout
  const [sessionTimeoutMins, setSessionTimeoutMins] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pluszone_session_timeout_mins');
      return saved ? parseInt(saved, 10) : 5;
    } catch {
      return 5;
    }
  });

  // Whitelisted IPs
  const [whitelistedIPs, setWhitelistedIPs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pluszone_whitelisted_ips');
      return saved ? JSON.parse(saved) : ['197.156.78.10/24', '10.0.4.15', '196.189.12.0/20'];
    } catch {
      return ['197.156.78.10/24', '10.0.4.15', '196.189.12.0/20'];
    }
  });
  const [newIpInput, setNewIpInput] = useState('');
  const [enforceIpRestriction, setEnforceIpRestriction] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pluszone_enforce_ip_restriction') === 'true';
    } catch {
      return false;
    }
  });

  // Active Sessions
  const [sessions, setSessions] = useState<SecuritySession[]>(() => {
    try {
      const saved = localStorage.getItem('pluszone_active_sessions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'sess-curr-1',
        deviceName: 'MacBook Pro 16" (M3 Max)',
        browser: 'Chrome 127.0.0',
        ipAddress: '197.156.78.14',
        location: 'Addis Ababa, Bole Sub-City, ET',
        lastActive: 'Just Now',
        isCurrent: true,
        status: 'TRUSTED'
      },
      {
        id: 'sess-mob-2',
        deviceName: 'Samsung Galaxy S24 Ultra',
        browser: 'Mobile Browser',
        ipAddress: '196.189.102.55',
        location: 'Addis Ababa, Kazanchis, ET',
        lastActive: '12 mins ago',
        isCurrent: false,
        status: 'TRUSTED'
      },
      {
        id: 'sess-pos-3',
        deviceName: 'Cashier Terminal POS-01',
        browser: 'PlusZone POS Kiosk',
        ipAddress: '10.0.4.15',
        location: 'Hawassa Branch POS',
        lastActive: '45 mins ago',
        isCurrent: false,
        status: 'TRUSTED'
      }
    ];
  });

  // Security Logs
  const [securityLogs, setSecurityLogs] = useState<SecurityEventLog[]>(() => {
    try {
      const saved = localStorage.getItem('pluszone_security_logs');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'log-1',
        timestamp: new Date().toISOString(),
        event: 'Master Security System Initialized with High Threat Shielding',
        severity: 'SUCCESS',
        ip: '197.156.78.14',
        user: state.currentUser.name,
        location: 'Addis Ababa, ET'
      },
      {
        id: 'log-2',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        event: 'Hardware Master Security PIN Initialized',
        severity: 'INFO',
        ip: '197.156.78.14',
        user: state.currentUser.name,
        location: 'Addis Ababa, ET'
      },
      {
        id: 'log-3',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        event: 'Automatic Session Timeout set to 5 Minutes Banking Standard',
        severity: 'INFO',
        ip: '197.156.78.14',
        user: state.currentUser.name,
        location: 'Addis Ababa, ET'
      }
    ];
  });

  const [logFilter, setLogFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS'>('ALL');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pluszone_2fa_enabled', is2FAEnabled.toString());
      localStorage.setItem('pluszone_security_pin', securityPin);
      localStorage.setItem('pluszone_require_pin_transfers', requirePinForTransfers.toString());
      localStorage.setItem('pluszone_emergency_lockdown', emergencyLockdown.toString());
      localStorage.setItem('pluszone_whitelisted_ips', JSON.stringify(whitelistedIPs));
      localStorage.setItem('pluszone_enforce_ip_restriction', enforceIpRestriction.toString());
      localStorage.setItem('pluszone_active_sessions', JSON.stringify(sessions));
      localStorage.setItem('pluszone_security_logs', JSON.stringify(securityLogs));
    } catch (err) {
      console.warn('Failed to save security settings', err);
    }
  }, [
    is2FAEnabled,
    securityPin,
    requirePinForTransfers,
    emergencyLockdown,
    whitelistedIPs,
    enforceIpRestriction,
    sessions,
    securityLogs
  ]);

  // Calculate System Security Score (0 to 100)
  const calculateSecurityScore = () => {
    let score = 0;
    if (is2FAEnabled) score += 30;
    if (securityPin && securityPin !== '1234') score += 25;
    if (sessionTimeoutMins > 0 && sessionTimeoutMins <= 10) score += 20;
    if (enforceIpRestriction) score += 15;
    if (!emergencyLockdown) score += 10;
    return Math.min(100, score);
  };

  const securityScore = calculateSecurityScore();

  const getScoreBadge = (score: number) => {
    if (score >= 85) {
      return {
        label: 'IRONCLAD PROTECTED',
        color: 'bg-emerald-500/15 text-emerald-600 dark:text-[#00D4AA] border-emerald-500/30'
      };
    } else if (score >= 50) {
      return {
        label: 'MODERATE PROTECTION',
        color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
      };
    }
    return {
      label: 'HIGH VULNERABILITY',
      color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
    };
  };

  const scoreBadge = getScoreBadge(securityScore);

  // Toggle Emergency Lockdown
  const handleToggleEmergencyLockdown = () => {
    triggerHaptic('heavy');
    const nextState = !emergencyLockdown;
    setEmergencyLockdown(nextState);

    const newLog: SecurityEventLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event: nextState
        ? '🔴 EMERGENCY SYSTEM LOCKDOWN ACTIVATED! Non-SuperAdmin sessions restricted.'
        : '🟢 Emergency System Lockdown Disarmed.',
      severity: nextState ? 'CRITICAL' : 'SUCCESS',
      ip: '197.156.78.14',
      user: state.currentUser.name,
      location: 'Addis Ababa, ET'
    };

    setSecurityLogs(prev => [newLog, ...prev]);
    showToast(
      nextState
        ? '⚠️ EMERGENCY SYSTEM LOCKDOWN ACTIVATED! Non-admin actions restricted.'
        : '✓ Emergency Lockdown disarmed successfully.'
    );
  };

  // 2FA Handlers
  const handleVerify2FA = () => {
    triggerHaptic('heavy');
    if (otpInput.trim().length === 6) {
      setIs2FAEnabled(true);
      setOtpVerified(true);
      const generatedCodes = Array.from({ length: 8 }, () =>
        Math.floor(10000000 + Math.random() * 90000000).toString()
      );
      setBackupCodes(generatedCodes);
      setShowBackupCodes(true);

      const newLog: SecurityEventLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        event: 'Two-Factor Authentication (2FA TOTP) Enabled Successfully',
        severity: 'SUCCESS',
        ip: '197.156.78.14',
        user: state.currentUser.name,
        location: 'Addis Ababa, ET'
      };
      setSecurityLogs(prev => [newLog, ...prev]);
      showToast('✓ Two-Factor Authentication (2FA) is now ACTIVE on your account!');
    } else {
      showToast('⚠️ Please enter a valid 6-digit authenticator verification code.');
    }
  };

  const handleDisable2FA = () => {
    triggerHaptic('warning');
    setIs2FAEnabled(false);
    setOtpVerified(false);
    setShowBackupCodes(false);

    const newLog: SecurityEventLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event: 'Two-Factor Authentication (2FA) Disabled by User',
      severity: 'WARNING',
      ip: '197.156.78.14',
      user: state.currentUser.name,
      location: 'Addis Ababa, ET'
    };
    setSecurityLogs(prev => [newLog, ...prev]);
    showToast('2FA has been disabled.');
  };

  // PIN Handlers
  const handleUpdatePin = () => {
    triggerHaptic('heavy');
    if (newPinInput.length < 4 || newPinInput.length > 6) {
      showToast('⚠️ Security PIN must be 4 to 6 digits long.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      showToast('⚠️ PIN confirmation does not match.');
      return;
    }

    setSecurityPin(newPinInput);
    setNewPinInput('');
    setConfirmPinInput('');

    const newLog: SecurityEventLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event: 'Master Transaction Authorization Security PIN Updated',
      severity: 'SUCCESS',
      ip: '197.156.78.14',
      user: state.currentUser.name,
      location: 'Addis Ababa, ET'
    };
    setSecurityLogs(prev => [newLog, ...prev]);
    showToast('✓ Master Transaction PIN updated successfully!');
  };

  // Session Management Handlers
  const handleRevokeSession = (sessionId: string) => {
    triggerHaptic('warning');
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    const newLog: SecurityEventLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event: `Session ${sessionId} Revoked & Terminated Remotely`,
      severity: 'WARNING',
      ip: '197.156.78.14',
      user: state.currentUser.name,
      location: 'Addis Ababa, ET'
    };
    setSecurityLogs(prev => [newLog, ...prev]);
    showToast('✓ Session revoked and logged out remotely.');
  };

  const handleKillAllOtherSessions = () => {
    triggerHaptic('heavy');
    setSessions(prev => prev.filter(s => s.isCurrent));
    const newLog: SecurityEventLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event: 'EMERGENCY: All Other Active Sessions Terminated Remotely',
      severity: 'CRITICAL',
      ip: '197.156.78.14',
      user: state.currentUser.name,
      location: 'Addis Ababa, ET'
    };
    setSecurityLogs(prev => [newLog, ...prev]);
    showToast('✓ All other device sessions terminated!');
  };

  // IP Whitelist Handlers
  const handleAddWhitelistedIp = () => {
    triggerHaptic('medium');
    if (!newIpInput.trim()) return;
    if (!whitelistedIPs.includes(newIpInput.trim())) {
      setWhitelistedIPs(prev => [...prev, newIpInput.trim()]);
      setNewIpInput('');
      showToast(`✓ IP CIDR ${newIpInput.trim()} added to trusted whitelist.`);
    }
  };

  const handleRemoveWhitelistedIp = (ip: string) => {
    triggerHaptic('warning');
    setWhitelistedIPs(prev => prev.filter(item => item !== ip));
    showToast(`Removed IP CIDR ${ip} from whitelist.`);
  };

  // Trigger Simulated Security Event
  const handleSimulateThreatEvent = () => {
    triggerHaptic('heavy');
    const simulatedEvents = [
      {
        event: 'Unrecognized Login Attempt from Suspicious IP 185.220.101.5 (Blocked by Threat Shield)',
        severity: 'CRITICAL' as const
      },
      {
        event: 'Failed Master PIN Entry Attempt (2 consecutive invalid tries)',
        severity: 'WARNING' as const
      },
      {
        event: 'High-Velocity Wallet Transfer Velocity Flagged for Review',
        severity: 'WARNING' as const
      },
      {
        event: 'User Password Policy Compliance Check Passed',
        severity: 'SUCCESS' as const
      }
    ];

    const pick = simulatedEvents[Math.floor(Math.random() * simulatedEvents.length)];
    const newLog: SecurityEventLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event: pick.event,
      severity: pick.severity,
      ip: '185.220.101.5',
      user: state.currentUser.name,
      location: 'Unknown Proxy IP'
    };

    setSecurityLogs(prev => [newLog, ...prev]);
    showToast(`Simulated Event Triggered: ${pick.event}`);
  };

  const filteredLogs = securityLogs.filter(
    l => logFilter === 'ALL' || l.severity === logFilter
  );

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Toast Banner */}
      {successMsg && (
        <div className="fixed top-20 right-4 z-50 max-w-sm p-4 rounded-2xl bg-slate-900/95 dark:bg-[#131926]/95 border border-emerald-500/40 text-emerald-400 font-extrabold text-xs shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-slideDown">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Emergency Lockdown Banner */}
      {emergencyLockdown && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border-2 border-rose-500 text-rose-200 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-400 shrink-0" />
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                🚨 Emergency System Lockdown Active
              </h3>
              <p className="text-xs text-rose-300">
                All outgoing financial transfers are paused and non-SuperAdmin actions are locked down.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleEmergencyLockdown}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md cursor-pointer transition-all whitespace-nowrap"
          >
            Disarm Lockdown Mode
          </button>
        </div>
      )}

      {/* HEADER: SOC CONTROL CENTER & THREAT SCORE METER */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0A0E1A] to-[#131926] border border-slate-800 dark:border-[#1E2D40] rounded-3xl p-6 shadow-2xl text-white space-y-6 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Left: Title & Subtitle */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#00D4AA] text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>SOC Enterprise Security System</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Security Operations & Threat Shield</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Multi-layered financial vault security featuring real-time risk scoring, 2FA TOTP authenticator keys, Master PIN security, session remote termination, and IP geo-fencing controls.
            </p>
          </div>

          {/* Right: Security Score Meter */}
          <div className="flex items-center gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 shadow-inner shrink-0">
            {/* Score Ring / Radial Display */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="currentColor"
                  strokeWidth="5"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeDasharray={163}
                  strokeDashoffset={163 - (163 * securityScore) / 100}
                  className={
                    securityScore >= 85
                      ? 'text-emerald-400'
                      : securityScore >= 50
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <span className="absolute text-sm font-black text-white">{securityScore}%</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Security Index
              </span>
              <span
                className={`text-xs font-black px-2.5 py-0.5 rounded-full border inline-block ${scoreBadge.color}`}
              >
                {scoreBadge.label}
              </span>
              <p className="text-[10px] text-slate-400">
                {securityScore === 100
                  ? 'All 6 security layers optimal'
                  : 'Enable 2FA & PIN to maximize shield'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Row: Panic Button & Status Badges */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 font-mono text-[11px] flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>{sessions.length} Active Sessions</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 font-mono text-[11px] flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>2FA: {is2FAEnabled ? 'Active' : 'Disabled'}</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 font-mono text-[11px] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>PIN: {securityPin ? 'Armed' : 'Default'}</span>
            </span>
          </div>

          <button
            onClick={handleToggleEmergencyLockdown}
            className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-all ${
              emergencyLockdown
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-rose-600/90 hover:bg-rose-600 text-white shadow-lg shadow-rose-600/30'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{emergencyLockdown ? 'Disarm Lockdown' : 'Emergency Lockdown Panic Button'}</span>
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200 dark:border-[#1E2D40]">
        {[
          { id: 'radar' as const, label: 'Threat Radar & Logs', icon: Activity },
          { id: 'fraud_prevention' as const, label: 'Bank SMS Fraud Prevention', icon: ShieldCheck, active: true },
          { id: 'sessions' as const, label: 'Active Devices', icon: Smartphone, badge: sessions.length },
          { id: '2fa' as const, label: '2FA Authenticator', icon: Key, active: is2FAEnabled },
          { id: 'pin' as const, label: 'Master Transaction PIN', icon: Lock },
          { id: 'ip_geofence' as const, label: 'IP Whitelist & Geo', icon: Globe }
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
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono">
                  {tab.badge}
                </span>
              )}
              {tab.active && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* TAB: BANK SMS PAYMENT FRAUD PREVENTION SYSTEM */}
      {activeTab === 'fraud_prevention' && (
        <PaymentFraudPreventionView state={state} />
      )}

      {/* TAB 1: THREAT RADAR & SECURITY AUDIT LOG */}
      {activeTab === 'radar' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Security Recommendations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] p-4 rounded-2xl space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB]">Two-Factor (2FA)</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${is2FAEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {is2FAEnabled ? 'ACTIVE' : 'RECOMMENDED'}
                </span>
              </div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                {is2FAEnabled ? 'TOTP Authenticator Shielded' : '2FA Not Yet Enabled'}
              </p>
              <button
                onClick={() => setActiveTab('2fa')}
                className="text-xs text-[#00D4AA] font-bold hover:underline cursor-pointer"
              >
                {is2FAEnabled ? 'Manage 2FA Settings →' : 'Enable 2FA Authenticator Now →'}
              </button>
            </div>

            <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] p-4 rounded-2xl space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB]">Transaction PIN</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                  PROTECTED
                </span>
              </div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                Master Security PIN Set
              </p>
              <button
                onClick={() => setActiveTab('pin')}
                className="text-xs text-[#00D4AA] font-bold hover:underline cursor-pointer"
              >
                Change Security PIN →
              </button>
            </div>

            <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] p-4 rounded-2xl space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-[#8899BB]">Inactivity Timeout</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">
                  {sessionTimeoutMins} MIN TIMEOUT
                </span>
              </div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                Banking Auto-Lock Active
              </p>
              <p className="text-[11px] text-slate-500">
                Session automatically locks when idle for {sessionTimeoutMins} minutes.
              </p>
            </div>
          </div>

          {/* Security Audit Feed */}
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1E2D40] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00D4AA]" />
                  <span>Real-Time Security Event Feed</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                  Immutable event registry tracking authorization attempts and threat flags
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <select
                  value={logFilter}
                  onChange={e => setLogFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">Critical Threats</option>
                  <option value="WARNING">Warnings</option>
                  <option value="INFO">Informational</option>
                  <option value="SUCCESS">Success</option>
                </select>

                <button
                  onClick={handleSimulateThreatEvent}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Test Threat Scan</span>
                </button>
              </div>
            </div>

            {/* Event List */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredLogs.map(log => {
                const getSeverityStyle = (sev: SecurityEventLog['severity']) => {
                  switch (sev) {
                    case 'CRITICAL':
                      return 'bg-rose-500/10 text-rose-500 border-rose-500/30';
                    case 'WARNING':
                      return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
                    case 'SUCCESS':
                      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
                    default:
                      return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30';
                  }
                };

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#1C2333]/80 border border-slate-200 dark:border-[#1E2D40] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] border ${getSeverityStyle(
                            log.severity
                          )}`}
                        >
                          {log.severity}
                        </span>
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {log.event}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#8899BB] font-mono">
                        User: {log.user} • IP: {log.ip} • Loc: {log.location}
                      </p>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE SESSIONS & DEVICE MANAGEMENT */}
      {activeTab === 'sessions' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-4 shadow-sm animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-500" />
                <span>Active Logged-In Device Sessions</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                Monitor real-time hardware devices connected to your financial account
              </p>
            </div>

            <button
              onClick={handleKillAllOtherSessions}
              disabled={sessions.length <= 1}
              className="px-3.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Revoke All Other Sessions</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {sessions.map(s => (
              <div
                key={s.id}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  s.isCurrent
                    ? 'bg-emerald-500/5 border-emerald-500/40'
                    : 'bg-slate-50 dark:bg-[#1C2333] border-slate-200 dark:border-[#1E2D40]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {s.deviceName}
                      </h4>
                      {s.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-[#00D4AA] text-[10px] font-black uppercase">
                          Current Device
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#8899BB] font-mono">
                      {s.browser} • IP: {s.ipAddress}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Location: {s.location} • Last Active: {s.lastActive}
                    </p>
                  </div>
                </div>

                {!s.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 cursor-pointer transition-all self-start sm:self-center"
                  >
                    Revoke Session
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TWO-FACTOR AUTHENTICATION (2FA) */}
      {activeTab === '2fa' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-5 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Two-Factor Authentication (TOTP Authenticator)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                  Require an authenticator code (Google Authenticator / Authy) on login
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                is2FAEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-[#00D4AA] border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              }`}
            >
              {is2FAEnabled ? '✓ 2FA ACTIVE' : '2FA DISABLED'}
            </span>
          </div>

          {!is2FAEnabled ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Step 1: Scan QR Code or Enter Secret Key
                </h4>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Simulated QR Code */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-300 shadow-md flex items-center justify-center">
                    <QrCode className="w-24 h-24 text-slate-900" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-600 dark:text-slate-300">
                      Scan this barcode with your authenticator app (e.g. Google Authenticator, 1Password, Authy).
                    </p>
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#0A0E1A] font-mono text-emerald-500 font-bold flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-800">
                      <span>Key: {twoFactorSecret}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(twoFactorSecret);
                          showToast('Secret key copied!');
                        }}
                        className="text-slate-400 hover:text-white p-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Step 2: Enter 6-Digit Authenticator Code
                </h4>
                <div className="flex items-center gap-3 max-w-sm">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-300 dark:border-[#2A3B53] text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#00D4AA]"
                  />
                  <button
                    onClick={handleVerify2FA}
                    className="px-4 py-2.5 rounded-xl bg-[#00D4AA] text-slate-950 font-extrabold text-xs shadow-md cursor-pointer hover:brightness-110 transition-all whitespace-nowrap"
                  >
                    Verify & Activate 2FA
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 space-y-2">
                <p className="font-extrabold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Two-Factor Authentication is actively safeguarding your account!</span>
                </p>
                <p className="text-slate-300">
                  Every sign-in request or high-value action requires an authenticator verification code from your trusted device.
                </p>
              </div>

              {/* Backup Codes Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Emergency Backup Recovery Codes
                  </h4>
                  <button
                    onClick={() => setShowBackupCodes(!showBackupCodes)}
                    className="text-xs text-[#00D4AA] font-bold cursor-pointer"
                  >
                    {showBackupCodes ? 'Hide Backup Codes' : 'Show Backup Codes'}
                  </button>
                </div>

                {showBackupCodes && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    {backupCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-white dark:bg-[#0A0E1A] border border-slate-200 dark:border-slate-800 font-mono text-center text-xs font-extrabold text-slate-800 dark:text-slate-200"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleDisable2FA}
                className="px-4 py-2 rounded-xl bg-rose-600/90 text-white font-extrabold text-xs cursor-pointer hover:bg-rose-600 transition-all"
              >
                Disable 2FA Protection
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MASTER TRANSACTION PIN */}
      {activeTab === 'pin' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-4 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Master Transaction Security PIN & Authorization Passcode
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                  Mandatory passcode required to approve wallet transfers, loan deletions, and system resets
                </p>
              </div>
            </div>

            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              ✓ MASTER PIN ENFORCED
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] space-y-4 max-w-md">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
              Update Master Security PIN
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  New 4-Digit or 6-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPinInput}
                  onChange={e => setNewPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-300 dark:border-[#2A3B53] text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#00D4AA]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPinInput}
                  onChange={e => setConfirmPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-300 dark:border-[#2A3B53] text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#00D4AA]"
                />
              </div>

              <button
                onClick={handleUpdatePin}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-md cursor-pointer transition-all"
              >
                Update Security PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: IP WHITELISTING & GEO-FENCING */}
      {activeTab === 'ip_geofence' && (
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-5 space-y-4 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  IP Address Whitelisting & Branch Network Controls
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                  Restrict partner or cashier access strictly to authorized corporate IP subnet CIDRs
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic('medium');
                setEnforceIpRestriction(!enforceIpRestriction);
                showToast(
                  !enforceIpRestriction
                    ? '✓ Enforcing IP restrictions.'
                    : 'IP restriction disarmed.'
                );
              }}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-xs cursor-pointer transition-all ${
                enforceIpRestriction
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-200 dark:bg-[#1C2333] text-slate-700 dark:text-slate-300'
              }`}
            >
              {enforceIpRestriction ? '✓ IP Restriction Active' : 'IP Restriction Off'}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                placeholder="e.g. 197.156.78.0/24 or 10.0.4.15"
                value={newIpInput}
                onChange={e => setNewIpInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                onClick={handleAddWhitelistedIp}
                className="px-4 py-2 rounded-xl bg-[#00D4AA] text-slate-950 font-extrabold text-xs shadow-md cursor-pointer whitespace-nowrap"
              >
                Add IP CIDR
              </button>
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                Trusted Whitelisted IP Networks:
              </h4>
              <div className="flex flex-wrap gap-2">
                {whitelistedIPs.map(ip => (
                  <div
                    key={ip}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] font-mono text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"
                  >
                    <span>{ip}</span>
                    <button
                      onClick={() => handleRemoveWhitelistedIp(ip)}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
