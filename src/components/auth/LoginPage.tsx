import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  LogIn,
  KeyRound,
  CheckCircle2,
  Clock,
  Send,
  X,
  Building,
  HelpCircle
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { triggerHaptic } from '../../lib/haptics';
import { AppLogo } from '../common/AppLogo';
import { getRememberSessionPreference, getRememberedUsername } from '../../lib/authSession';
import { hashPassword, verifyPassword } from '../../lib/auth';
import { firebaseSignIn, firebaseSendPasswordReset } from '../../lib/firebase';

interface LoginPageProps {
  allUsers: UserProfile[];
  currentUser: UserProfile;
  onLogin: (selectedUser: UserProfile, rememberSession?: boolean) => void;
  onRegisterUser?: (newUser: UserProfile) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export const LoginPage: React.FC<LoginPageProps> = ({
  allUsers,
  onLogin
}) => {
  // Credentials input state - never prefill passwords
  const [identifier, setIdentifier] = useState<string>(() => getRememberedUsername() || '');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => getRememberSessionPreference());

  // Form states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Security Rate Limiting & Lockout
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('pz_login_failed_attempts');
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [lockoutRemaining, setLockoutRemaining] = useState<number>(() => {
    try {
      const lockUntil = localStorage.getItem('pz_login_lockout_until');
      if (lockUntil) {
        const remaining = Math.ceil((parseInt(lockUntil, 10) - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
      }
    } catch {}
    return 0;
  });

  // Modals
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotSubmitting, setForgotSubmitting] = useState<boolean>(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);
  const [forgotErrorMsg, setForgotErrorMsg] = useState<string | null>(null);

  const [showRequestAccessModal, setShowRequestAccessModal] = useState<boolean>(false);
  const [reqFullName, setReqFullName] = useState<string>('');
  const [reqEmail, setReqEmail] = useState<string>('');
  const [reqRole, setReqRole] = useState<UserRole>('Staff');
  const [reqBranch, setReqBranch] = useState<string>('Addis Ababa HQ');
  const [reqReason, setReqReason] = useState<string>('');
  const [reqSubmitting, setReqSubmitting] = useState<boolean>(false);
  const [reqSuccessMsg, setReqSuccessMsg] = useState<string | null>(null);
  const [reqErrorMsg, setReqErrorMsg] = useState<string | null>(null);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          try {
            localStorage.removeItem('pz_login_lockout_until');
            localStorage.setItem('pz_login_failed_attempts', '0');
          } catch {}
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  const handleApplyLockout = () => {
    const lockUntil = Date.now() + LOCKOUT_SECONDS * 1000;
    try {
      localStorage.setItem('pz_login_lockout_until', lockUntil.toString());
      localStorage.setItem('pz_login_failed_attempts', String(MAX_FAILED_ATTEMPTS));
    } catch {}
    setLockoutRemaining(LOCKOUT_SECONDS);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0 || isSubmitting) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanIdentifier) {
      setErrorMsg('Please enter your username or email address.');
      triggerHaptic('warning');
      return;
    }

    if (!cleanPassword) {
      setErrorMsg('Please enter your account password.');
      triggerHaptic('warning');
      return;
    }

    setIsSubmitting(true);
    triggerHaptic('medium');

    try {
      // 1. First, attempt backend authentication with server rate-limiting
      let backendSuccess = false;
      let authenticatedUser: UserProfile | null = null;

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: cleanIdentifier,
            password: cleanPassword,
            remember: rememberMe
          })
        });

        const data = await response.json();

        if (response.status === 429) {
          handleApplyLockout();
          setErrorMsg(data.error || `Too many failed attempts. Security lockout active.`);
          setIsSubmitting(false);
          return;
        }

        if (response.ok && data.success && data.user) {
          backendSuccess = true;
          // Match or construct user profile
          const existing = allUsers.find(
            (u) =>
              u.id === data.user.id ||
              u.email.toLowerCase() === data.user.email.toLowerCase() ||
              u.username?.toLowerCase() === data.user.username?.toLowerCase()
          );

          authenticatedUser = existing || {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            username: data.user.username,
            role: data.user.role,
            active: true,
            isApproved: true,
            branch: data.user.branch || 'Addis Ababa HQ',
            lastActive: 'Just now'
          };
        }
      } catch (backendErr) {
        console.warn('[Login] Backend verification failed, evaluating fallback auth:', backendErr);
      }

      // 2. If backend succeeded, proceed to login
      if (backendSuccess && authenticatedUser) {
        setFailedAttempts(0);
        try {
          localStorage.removeItem('pz_login_failed_attempts');
          localStorage.removeItem('pz_login_lockout_until');
        } catch {}

        // Also attempt Firebase Auth in background if email is configured
        if (authenticatedUser.email) {
          try {
            await firebaseSignIn(authenticatedUser.email, cleanPassword);
          } catch (_) {
            // Firebase Auth sync is non-blocking for ERP access
          }
        }

        setSuccessMsg('Authentication verified. Accessing ERP...');
        setTimeout(() => {
          onLogin(authenticatedUser!, rememberMe);
          setIsSubmitting(false);
        }, 300);
        return;
      }

      // 3. Fallback: Check local salted hash if offline/server disconnected
      const matchedLocal = allUsers.find(
        (u) =>
          u.username?.toLowerCase() === cleanIdentifier ||
          u.email.toLowerCase() === cleanIdentifier ||
          u.name.toLowerCase() === cleanIdentifier
      );

      if (matchedLocal) {
        const isValid = await verifyPassword(cleanPassword, matchedLocal);
        if (isValid) {
          setFailedAttempts(0);
          try {
            localStorage.removeItem('pz_login_failed_attempts');
          } catch {}
          setSuccessMsg('Authentication verified. Accessing ERP...');
          setTimeout(() => {
            onLogin(matchedLocal, rememberMe);
            setIsSubmitting(false);
          }, 300);
          return;
        }
      }

      // Failed authentication: Increment attempt counter and apply rate limiting
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      try {
        localStorage.setItem('pz_login_failed_attempts', String(nextFail));
      } catch {}

      if (nextFail >= MAX_FAILED_ATTEMPTS) {
        handleApplyLockout();
        setErrorMsg(`Too many failed attempts. Security cooldown active for ${LOCKOUT_SECONDS}s.`);
      } else {
        // GENERIC ERROR MESSAGE: Never reveal whether username or email exists in the system!
        setErrorMsg(`Invalid credentials. Please verify your username/email and password (${MAX_FAILED_ATTEMPTS - nextFail} attempt${MAX_FAILED_ATTEMPTS - nextFail === 1 ? '' : 's'} remaining).`);
      }
      triggerHaptic('warning');
      setIsSubmitting(false);

    } catch (err: any) {
      setErrorMsg('An unexpected authentication error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Password Recovery handler
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg(null);
    setForgotSuccessMsg(null);

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setForgotErrorMsg('Please provide a valid email address.');
      return;
    }

    setForgotSubmitting(true);
    triggerHaptic('medium');

    try {
      // 1. Dispatch Firebase Auth password reset
      try {
        await firebaseSendPasswordReset(cleanEmail);
      } catch (_) {}

      // 2. Dispatch backend password reset endpoint
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });

      // Always show generic success message (no user enumeration)
      setForgotSuccessMsg('If an authorized account is associated with this email, password recovery instructions have been dispatched.');
      setTimeout(() => {
        setForgotEmail('');
      }, 3000);
    } catch (err: any) {
      setForgotErrorMsg('Unable to dispatch recovery email at this time. Please contact your SuperAdmin.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  // Request Access handler (replaces open public registration)
  const handleRequestAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqErrorMsg(null);
    setReqSuccessMsg(null);

    const cleanName = reqFullName.trim();
    const cleanEmail = reqEmail.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !cleanEmail.includes('@')) {
      setReqErrorMsg('Full name and a valid email address are required.');
      return;
    }

    setReqSubmitting(true);
    triggerHaptic('medium');

    try {
      const response = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          requestedRole: reqRole,
          branch: reqBranch,
          reason: reqReason
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit access request');
      }

      setReqSuccessMsg(data.message || 'Access request received. Your SuperAdmin will review and dispatch an activation link.');
      setTimeout(() => {
        setReqFullName('');
        setReqEmail('');
        setReqReason('');
      }, 3000);
    } catch (err: any) {
      setReqErrorMsg(err.message || 'Unable to submit request. Please reach out to your administrator directly.');
    } finally {
      setReqSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex flex-col justify-center items-center p-4 select-none relative overflow-hidden">
      {/* Ambient gradient glow backdrop */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[340px] bg-gradient-to-tr from-cyan-600/15 via-blue-600/15 to-indigo-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-24 right-10 w-72 h-72 bg-emerald-500/10 blur-[110px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm sm:max-w-md relative z-10 flex flex-col gap-4">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2.5">
          <div className="relative">
            <AppLogo size="xl" className="rounded-2xl shadow-xl shadow-cyan-500/10 border border-slate-800" />
            <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full border-2 border-[#070B14]" title="Security Active">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              Plus Game Zone
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                ERP 2026
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Authorized Financial & Operations Management</p>
          </div>
        </div>

        {/* Compact Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-black/80 flex flex-col gap-4">
          {/* Status Messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Security Lockout Banner */}
          {lockoutRemaining > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Security cooldown active</span>
              </div>
              <span className="font-mono font-bold text-amber-200">{lockoutRemaining}s</span>
            </div>
          )}

          {/* Primary Sign In Form */}
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-3.5">
            {/* Username or Email Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. suraphel or user@pluszone.et"
                  autoComplete="username"
                  required
                  disabled={lockoutRemaining > 0 || isSubmitting}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotErrorMsg(null);
                    setForgotSuccessMsg(null);
                  }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  disabled={lockoutRemaining > 0 || isSubmitting}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Device Preference */}
            <div className="flex items-center justify-between py-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-slate-400">Remember this device</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">TLS 1.3 Active</span>
            </div>

            {/* Primary Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting || lockoutRemaining > 0}
              className="w-full mt-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-cyan-200" />
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 text-cyan-300" />
                </>
              )}
            </button>
          </form>

          {/* Request Access Link */}
          <div className="pt-3 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Need access to Plus Game Zone ERP?{' '}
              <button
                type="button"
                onClick={() => {
                  setShowRequestAccessModal(true);
                  setReqErrorMsg(null);
                  setReqSuccessMsg(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer transition-colors underline-offset-2 hover:underline"
              >
                Request access
              </button>
            </p>
          </div>

          {/* Security & RBAC Assurance Badge */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Role-Based Access Control
            </span>
            <span className="font-mono text-[10px] text-slate-500">Zero-Trust Secured</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500">
          <p>© 2026 Plus Game Zone • Official Business Ledger</p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Security audit & access policy strictly enforced. Unauthorized entry prohibited.
          </p>
        </div>
      </div>

      {/* Forgot Password Recovery Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-left space-y-1">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Password Recovery</h3>
              <p className="text-xs text-slate-400">
                Enter your registered email address to receive password reset instructions.
              </p>
            </div>

            {forgotErrorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotErrorMsg}</span>
              </div>
            )}

            {forgotSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{forgotSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <div className="flex flex-col gap-1 text-left">
                <label className="text-xs font-semibold text-slate-300">Email Address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@pluszone.et"
                  required
                  disabled={forgotSubmitting}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {forgotSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Link</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Access Modal (Replaces public self-registration) */}
      {showRequestAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm sm:max-w-md space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowRequestAccessModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-left space-y-1">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Request Access</h3>
              <p className="text-xs text-slate-400">
                Submit your details for SuperAdmin review. All ERP accounts require administrator authorization.
              </p>
            </div>

            {reqErrorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{reqErrorMsg}</span>
              </div>
            )}

            {reqSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{reqSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleRequestAccessSubmit} className="space-y-3 text-left">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={reqFullName}
                  onChange={(e) => setReqFullName(e.target.value)}
                  placeholder="e.g. Dawit Haile"
                  required
                  disabled={reqSubmitting}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-300">Email Address</label>
                  <input
                    type="email"
                    value={reqEmail}
                    onChange={(e) => setReqEmail(e.target.value)}
                    placeholder="dawit@pluszone.et"
                    required
                    disabled={reqSubmitting}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-300">Requested Role</label>
                  <select
                    value={reqRole}
                    onChange={(e) => setReqRole(e.target.value as UserRole)}
                    disabled={reqSubmitting}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Staff">Staff (Operations)</option>
                    <option value="Partner">Partner (Financial)</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">Branch / Station</label>
                <input
                  type="text"
                  value={reqBranch}
                  onChange={(e) => setReqBranch(e.target.value)}
                  placeholder="e.g. Addis Ababa HQ"
                  disabled={reqSubmitting}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">Reason / Note (Optional)</label>
                <textarea
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="e.g. Cashier shift duty, station supervisor..."
                  rows={2}
                  disabled={reqSubmitting}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestAccessModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={reqSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {reqSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
