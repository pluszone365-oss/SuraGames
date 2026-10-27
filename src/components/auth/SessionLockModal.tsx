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
import { UserProfile } from '../../types';
import { verifyPassword } from '../../lib/auth';

export interface SessionLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile;
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
  currentUser,
  userEmail,
  userName,
  currentUserPassword,
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

  const effectiveEmail = userEmail || currentUser?.email || 'admin@pluszone.et';
  const effectiveName = userName || currentUser?.name || 'Administrator';
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

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = passwordInput.trim();
    if (!cleanInput) {
      triggerHaptic('warning');
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsVerifyingPassword(true);
    setErrorMessage(null);

    try {
      // 1. Verify with backend sensitive endpoint
      let isAuthorized = false;
      try {
        const resp = await fetch('/api/auth/verify-sensitive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: cleanInput,
            identifier: effectiveEmail
          })
        });
        const data = await resp.json();
        if (resp.ok && data.authorized) {
          isAuthorized = true;
        }
      } catch (_) {}

      // 2. Fallback to cryptographic client verification if offline
      if (!isAuthorized && currentUser) {
        isAuthorized = await verifyPassword(cleanInput, currentUser);
      }

      // 3. Fallback PIN check if set by user
      if (!isAuthorized) {
        const storedPin = localStorage.getItem('pluszone_security_pin');
        if (storedPin && cleanInput === storedPin) {
          isAuthorized = true;
        }
      }

      if (isAuthorized) {
        triggerHaptic('heavy');
        setIsSuccess(true);
        setIsVerifyingPassword(false);
        setFailedAttempts(0);
        setTimeout(() => {
          onSuccess(effectiveEmail);
        }, 400);
      } else {
        triggerHaptic('warning');
        setIsVerifyingPassword(false);
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= 5) {
          setErrorMessage('Too many failed authorization attempts. Please re-authenticate.');
        } else {
          setErrorMessage(`Invalid credentials (${5 - newAttempts} attempt${5 - newAttempts === 1 ? '' : 's'} remaining).`);
        }
        setPasswordInput('');
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
        }
      }
    } catch (err: any) {
      setIsVerifyingPassword(false);
      setErrorMessage('Verification failed. Please try again.');
    }
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
      <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl text-center relative overflow-hidden">
        {/* Glow ambient background effect */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close or Log Out Button */}
        {isSessionLock ? (
          <button
            onClick={onLogout || onClose}
            title="Log Out of Session"
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Modal Header */}
        <div className="space-y-1.5 pt-1">
          <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-1 border border-cyan-500/20">
            {isSuccess ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-bounce" />
            ) : isSessionLock ? (
              <Lock className="w-6 h-6 text-cyan-400" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
            )}
          </div>

          <h3 className="text-base font-extrabold text-white">
            {actionTitle || (isSessionLock ? 'Session Inactivity Locked' : 'Administrative Authorization')}
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            {actionSubtitle ||
              (isSessionLock
                ? 'Your session timed out for protection. Enter your account password to resume.'
                : 'Please verify your authorization credentials to proceed with this sensitive operation.')}
          </p>
        </div>

        {/* User Card */}
        <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-left">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {effectiveName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{effectiveName}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{effectiveEmail}</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center gap-1">
            <UserCheck className="w-3 h-3" />
            <span>Active</span>
          </span>
        </div>

        {/* Password Form */}
        <form onSubmit={handleUnlock} className="space-y-3.5 text-left">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-300">
              Account Password
            </label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password..."
                autoComplete="current-password"
                disabled={isVerifyingPassword || isSuccess}
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 text-center font-bold flex items-center justify-center gap-1.5 animate-fadeIn">
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
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] text-white shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {isVerifyingPassword ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying Authorization...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Authorized Successfully</span>
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
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onLogout || onClose}
              className="w-full py-2 rounded-xl text-slate-400 hover:text-rose-400 font-bold text-xs hover:bg-rose-950/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
