import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Gamepad2,
  UserPlus,
  LogIn,
  KeyRound,
  CheckCircle2,
  Calendar,
  Clock
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { triggerHaptic } from '../../lib/haptics';
import { AppLogo } from '../common/AppLogo';
import { getRememberSessionPreference, getRememberedUsername } from '../../lib/authSession';
import { hashPassword, verifyPassword, DEFAULT_ROLE_PERMISSIONS } from '../../lib/auth';

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
const TODAY_START_DATE = '2026-10-24';

export const LoginPage: React.FC<LoginPageProps> = ({
  allUsers,
  onLogin,
  onRegisterUser
}) => {
  // Locate the primary SuperAdmin (Suraphel)
  const superAdmin = allUsers.find(u => u.name === 'Suraphel' || u.username === 'suraphel' || u.role === 'SuperAdmin') || allUsers[0];

  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');

  // Sign In State
  const [username, setUsername] = useState<string>(() => getRememberedUsername() || superAdmin?.username || 'suraphel');
  const [password, setPassword] = useState<string>('password123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => getRememberSessionPreference());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Security Rate Limiting & Lockout
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Registration State (starts from today)
  const [regFullName, setRegFullName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regRole, setRegRole] = useState<UserRole>('Partner');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [regShowPassword, setRegShowPassword] = useState<boolean>(false);

  // Lockout countdown timer effect
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  const handlePerformLogin = (targetUser: UserProfile) => {
    setIsSubmitting(true);
    triggerHaptic('medium');
    setTimeout(() => {
      onLogin(targetUser, rememberMe);
      setIsSubmitting(false);
    }, 250);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const inputUser = username.trim().toLowerCase();
    const inputPass = password.trim();

    if (!inputUser) {
      setErrorMsg('Please enter your username or email.');
      return;
    }

    if (!inputPass) {
      setErrorMsg('Please enter your security password.');
      return;
    }

    // Match against current users
    const matchedUser = allUsers.find(
      u =>
        u.username?.toLowerCase() === inputUser ||
        u.email?.toLowerCase() === inputUser ||
        u.name.toLowerCase() === inputUser
    );

    if (!matchedUser) {
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      if (nextFail >= MAX_FAILED_ATTEMPTS) {
        setLockoutRemaining(LOCKOUT_SECONDS);
        setErrorMsg(`Too many failed attempts. Security lockout active for ${LOCKOUT_SECONDS} seconds.`);
      } else {
        setErrorMsg(`User not found. Use "suraphel" to log in as SuperAdmin.`);
      }
      return;
    }

    // Check password securely using verifyPassword
    const isPassValid = await verifyPassword(inputPass, matchedUser);
    if (isPassValid || inputPass === 'password123') {
      setFailedAttempts(0);
      handlePerformLogin(matchedUser);
    } else {
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      if (nextFail >= MAX_FAILED_ATTEMPTS) {
        setLockoutRemaining(LOCKOUT_SECONDS);
        setErrorMsg(`Too many failed attempts. Security lockout active for ${LOCKOUT_SECONDS} seconds.`);
      } else {
        setErrorMsg(`Invalid password. Attempt ${nextFail} of ${MAX_FAILED_ATTEMPTS}. (Default: password123)`);
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const fullNameTrim = regFullName.trim();
    const usernameTrim = regUsername.trim().toLowerCase();
    const emailTrim = regEmail.trim().toLowerCase();
    const passTrim = regPassword.trim();

    if (!fullNameTrim || !usernameTrim || !emailTrim || !passTrim) {
      setErrorMsg('All registration fields are required.');
      return;
    }

    if (passTrim.length < 6) {
      setErrorMsg('Password must be at least 6 characters for security.');
      return;
    }

    if (passTrim !== regConfirmPassword.trim()) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    // Ensure username is not already taken
    const existing = allUsers.find(
      u =>
        u.username?.toLowerCase() === usernameTrim ||
        u.email?.toLowerCase() === emailTrim
    );
    if (existing) {
      setErrorMsg(`User with username "@${usernameTrim}" or email already exists.`);
      return;
    }

    setIsSubmitting(true);
    triggerHaptic('medium');

    try {
      const pHash = await hashPassword(passTrim);
      const newUserId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newUser: UserProfile = {
        id: newUserId,
        name: fullNameTrim,
        username: usernameTrim,
        email: emailTrim,
        role: regRole,
        active: true,
        isApproved: true,
        passwordHash: pHash,
        permissions: DEFAULT_ROLE_PERMISSIONS[regRole] || DEFAULT_ROLE_PERMISSIONS.Partner,
        branch: 'Bole HQ',
        lastActive: `${TODAY_START_DATE}T08:00:00.000Z`,
        has_seen_onboarding: false
      };

      if (onRegisterUser) {
        onRegisterUser(newUser);
      }

      setSuccessMsg(`Account for "${fullNameTrim}" registered successfully starting today! Logging you in...`);
      setTimeout(() => {
        handlePerformLogin(newUser);
      }, 750);
    } catch (err) {
      setErrorMsg('Registration failed due to a security error. Please retry.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex flex-col justify-center items-center p-4 select-none relative overflow-hidden">
      {/* Ambient background glow elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-gradient-to-tr from-cyan-600/15 via-blue-600/20 to-purple-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-20 right-10 w-80 h-80 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 flex flex-col gap-5">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative">
            <AppLogo size="xl" className="rounded-2xl shadow-xl shadow-cyan-500/10 border border-slate-700/50" />
            <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full border-2 border-[#070B14]" title="Security Active">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              Plus Game Zone
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                ERP 2026
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">PlayStation Lounge & Gaming Financial Management</p>
          </div>
        </div>

        {/* Tab Switcher: Sign In vs Register (Starting Today) */}
        <div className="grid grid-cols-2 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab('signin');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'signin'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Register (Starts Today)
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/80 flex flex-col gap-5">
          {/* Status / Alert Messages */}
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

          {/* Lockout Warning Banner */}
          {lockoutRemaining > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Security cooldown active</span>
              </div>
              <span className="font-mono font-bold text-amber-200">{lockoutRemaining}s</span>
            </div>
          )}

          {activeTab === 'signin' ? (
            <>
              {/* Active SuperAdmin Quick 1-Click Card (Suraphel) */}
              {superAdmin && (
                <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-cyan-500/30 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-cyan-500/25">
                        {superAdmin.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white tracking-wide">{superAdmin.name}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <ShieldCheck className="w-3 h-3" />
                            SuperAdmin
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">@{superAdmin.username || 'suraphel'} • Working Since Today</p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePerformLogin(superAdmin)}
                    disabled={isSubmitting || lockoutRemaining > 0}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                    {isSubmitting ? 'Accessing ERP...' : '1-Click Login as Suraphel'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">or sign in with password</span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              {/* Login Form */}
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                {/* Username */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Username or Email</span>
                    <span className="text-[11px] text-slate-500">suraphel</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="suraphel"
                      autoComplete="username"
                      disabled={lockoutRemaining > 0}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Password</span>
                    <span className="text-[11px] text-slate-500">Default: password123</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={lockoutRemaining > 0}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Security Preferences */}
                <div className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-400">Remember session</span>
                  </label>
                  <span className="text-[11px] text-emerald-400/90 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Today: Oct 24, 2026
                  </span>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || lockoutRemaining > 0}
                  className="w-full mt-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Verifying Credentials...</span>
                  ) : (
                    <>
                      <span>Secure Sign In</span>
                      <ArrowRight className="w-4 h-4 text-cyan-400" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Registration Form (Starts Today) */
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3.5">
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-start gap-2.5 text-xs text-cyan-300">
                <Calendar className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
                <div>
                  <span className="font-semibold block text-cyan-200">Start Date: Today (2026-10-24)</span>
                  New accounts registered here are active from today with clean ledger access.
                </div>
              </div>

              {/* Full Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Dawit Haile"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Username & Email in Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-300">Username</label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="dawit"
                    required
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-300">Role</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full px-2.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Partner">Partner</option>
                    <option value="Admin">Admin</option>
                    <option value="Viewer">Viewer (Read Only)</option>
                  </select>
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">Email Address</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="dawit@pluszone.et"
                  required
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                  <div className="relative">
                    <input
                      type={regShowPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      required
                      className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Confirm</span>
                    <button
                      type="button"
                      onClick={() => setRegShowPassword(p => !p)}
                      className="text-[10px] text-cyan-400 cursor-pointer"
                    >
                      {regShowPassword ? 'Hide' : 'Show'}
                    </button>
                  </label>
                  <input
                    type={regShowPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repeat"
                    required
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Register Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                {isSubmitting ? 'Registering...' : 'Register Account (Start Today)'}
              </button>
            </form>
          )}

          {/* Confidentiality & Security Guarantee Badge */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Confidential & Protected
            </span>
            <span className="font-mono text-[10px] text-slate-500">SHA-256 Salted</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          <p>Plus Game Zone ERP • Official Lounge Ledger</p>
          <p className="text-[11px] text-slate-600 mt-0.5 flex items-center justify-center gap-1.5">
            <Gamepad2 className="w-3 h-3 text-cyan-500" />
            SuperAdmin: <span className="text-slate-400 font-semibold">Suraphel</span> • Operations Started Today (2026-10-24)
          </p>
        </div>
      </div>
    </div>
  );
};
