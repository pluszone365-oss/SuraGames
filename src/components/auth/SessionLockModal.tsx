import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { triggerHaptic } from '../../lib/haptics';

export interface SessionLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
  currentUserPassword?: string;
  onSuccess: (verifiedEmail: string) => void;
  onLogout?: () => void;
  mode?: 'LOGIN' | 'SESSION_UNLOCK' | 'ENROLL' | 'SENSITIVE_OPERATION' | 'PRIVATE_INFO' | 'PAYMENT_AUTHORIZE';
  actionTitle?: string;
  actionSubtitle?: string;
}

export const SessionLockModal: React.FC<SessionLockModalProps> = ({
  isOpen,
  onClose,
  userEmail = 'yegeta.huawei@gmail.com',
  userName = 'Yegeta Huawei',
  currentUserPassword = 'password123',
  onSuccess,
  onLogout,
  mode = 'SESSION_UNLOCK',
  actionTitle,
  actionSubtitle
}) => {
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const isSessionLock = mode === 'SESSION_UNLOCK';

  useEffect(() => {
    if (isOpen) {
      setPasswordInput('');
      setShowPassword(false);
      setIsVerifyingPassword(false);
      setErrorMessage(null);
      setIsSuccess(false);
      setTimeout(() => {
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = passwordInput.trim();
    if (!cleanInput) {
      triggerHaptic('warning');
      setErrorMessage('Please enter your account password or 4-digit Master PIN.');
      return;
    }

    setIsVerifyingPassword(true);
    setErrorMessage(null);

    setTimeout(() => {
      const storedSecurityPin = localStorage.getItem('pluszone_security_pin');

      // Strictly verify against user's actual password or configured security PIN
      const isValid =
        (currentUserPassword && cleanInput === currentUserPassword) ||
        (storedSecurityPin && cleanInput === storedSecurityPin);

      if (isValid) {
        triggerHaptic('heavy');
        setIsSuccess(true);
        setIsVerifyingPassword(false);
        setFailedAttempts(0);
        setTimeout(() => {
          onSuccess(userEmail);
        }, 500);
      } else {
        triggerHaptic('warning');
        setIsVerifyingPassword(false);
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= 5) {
          setErrorMessage('Too many failed attempts. For security, please log out and re-authenticate.');
        } else {
          setErrorMessage(`Invalid credentials (${5 - newAttempts} attempt${5 - newAttempts === 1 ? '' : 's'} remaining). Use your account password or PIN.`);
        }
        setPasswordInput('');
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
        }
      }
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (!isSessionLock && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl text-center relative overflow-hidden">
        {/* Glow ambient background effect */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Close or Log Out Button */}
        {isSessionLock ? (
          <button
            onClick={onLogout || onClose}
            title="Log Out of Session"
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1 text-[11px] font-bold"
          >
            <LogOut className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2333] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Modal Header */}
        <div className="space-y-2 pt-1">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-1 border border-indigo-100 dark:border-indigo-900/40">
            {isSuccess ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-500 animate-bounce" />
            ) : isSessionLock ? (
              <Lock className="w-7 h-7" />
            ) : (
              <ShieldCheck className="w-7 h-7" />
            )}
          </div>

          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            {actionTitle || (isSessionLock ? 'Banking Session Locked' : 'Security Verification')}
          </h3>

          <p className="text-xs text-slate-500 dark:text-[#8899BB] leading-relaxed">
            {actionSubtitle ||
              (isSessionLock
                ? 'Your session timed out for protection. Enter your account password or Master PIN to unlock.'
                : 'Please verify your authorization to proceed with this operation.')}
          </p>
        </div>

        {/* User Card */}
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#1C2333]/80 border border-slate-200/80 dark:border-[#1E2D40] flex items-center justify-between text-left">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-[#253248] flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userName}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{userEmail}</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0 flex items-center gap-1">
            <UserCheck className="w-3 h-3" />
            <span>Active</span>
          </span>
        </div>

        {/* Password / Master PIN Form */}
        <form onSubmit={handleUnlock} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Account Password or Master PIN
            </label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password or 4-digit PIN..."
                autoComplete="current-password"
                disabled={isVerifyingPassword || isSuccess}
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 text-center font-bold animate-shake flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifyingPassword || isSuccess || !passwordInput.trim()}
            className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {isVerifyingPassword ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Unlocked Successfully</span>
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isSessionLock ? 'Unlock Session' : 'Authorize Action'}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info & log out option */}
        {isSessionLock && (
          <div className="pt-2 border-t border-slate-100 dark:border-[#1E2D40]">
            <button
              type="button"
              onClick={onLogout || onClose}
              className="w-full py-2 rounded-xl text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out and exit</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
