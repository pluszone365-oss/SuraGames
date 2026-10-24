import React, { useState } from 'react';
import {
  User,
  Camera,
  Mail,
  Shield,
  MapPin,
  Lock,
  CheckCircle2,
  KeyRound,
  Sparkles,
  Save,
  Image as ImageIcon,
  Check,
  Building,
  UserCheck
} from 'lucide-react';
import { ERPState, UserProfile } from '../../types';
import { triggerHaptic } from '../../lib/haptics';

interface ProfileViewProps {
  currentUser: UserProfile;
  onUpdateState: (fn: (prev: ERPState) => ERPState) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=250',
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onUpdateState
}) => {
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [username, setUsername] = useState(currentUser.username || '');
  const [branch, setBranch] = useState(currentUser.branch || 'Addis Ababa HQ');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [customAvatarInput, setCustomAvatarInput] = useState('');

  // Password change fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Status message
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result);
          triggerHaptic('medium');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword) {
      if (newPassword.length < 4) {
        setPasswordError('Password / PIN must be at least 4 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match');
        return;
      }
    }

    triggerHaptic('heavy');

    onUpdateState(prev => {
      const updatedUser: UserProfile = {
        ...prev.currentUser,
        name: name.trim(),
        email: email.trim(),
        username: username.trim(),
        branch: branch.trim(),
        avatarUrl: avatarUrl || undefined,
        ...(newPassword ? { password: newPassword, hasSetPassword: true } : {})
      };

      const updatedUsers = prev.users.map(u =>
        u.id === prev.currentUser.id ? updatedUser : u
      );

      return {
        ...prev,
        currentUser: updatedUser,
        users: updatedUsers
      };
    });

    setSuccessMsg('Profile and account preferences updated successfully!');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            {/* User Avatar Circle */}
            <div className="relative group shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-white/30 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white/20 border-4 border-white/30 flex items-center justify-center font-black text-2xl text-white shadow-lg">
                  {name ? name.substring(0, 2).toUpperCase() : 'US'}
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white cursor-pointer shadow-md transition-all active:scale-90 border border-white/20">
                <Camera className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <h2 className="text-xl font-black">{name || 'User Profile'}</h2>
              <p className="text-xs text-white/80 mt-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>{email || 'No email provided'}</span>
              </p>
              <p className="text-[11px] text-white/70 mt-0.5 flex items-center gap-1">
                <Building className="w-3 h-3" />
                <span>{branch}</span>
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 text-xs space-y-1 self-start sm:self-auto shrink-0">
            <span className="text-[10px] text-white/70 uppercase font-bold block">Account Status</span>
            <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
              <UserCheck className="w-4 h-4" />
              <span>Verified Partner</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-xs font-bold">{successMsg}</p>
        </div>
      )}

      {/* Profile Edit Form */}
      <form onSubmit={handleSaveProfile} className="space-y-5">
        {/* Profile Picture Selection */}
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <ImageIcon className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Profile Photo & Avatar
            </h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95">
                <Camera className="w-4 h-4" />
                <span>Upload New Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#1E2D40] text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  Remove Photo
                </button>
              )}
            </div>

            {/* Presets Grid */}
            <div>
              <span className="text-[11px] text-slate-500 dark:text-[#8899BB] font-semibold block mb-2">
                Or select from avatar presets:
              </span>
              <div className="flex items-center gap-3 flex-wrap">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setAvatarUrl(url);
                    }}
                    className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      avatarUrl === url
                        ? 'border-indigo-600 scale-105 shadow-md'
                        : 'border-slate-200 dark:border-[#1E2D40] hover:border-indigo-400'
                    }`}
                  >
                    <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    {avatarUrl === url && (
                      <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center text-white">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom URL input */}
            <div>
              <label className="text-[10px] text-slate-500 dark:text-[#8899BB] font-semibold block mb-1 uppercase">
                Image Web URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={customAvatarInput}
                  onChange={(e) => setCustomAvatarInput(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customAvatarInput) {
                      setAvatarUrl(customAvatarInput);
                      setCustomAvatarInput('');
                    }
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-200 dark:bg-[#1C2333] hover:bg-slate-300 dark:hover:bg-[#252E42] text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Set URL
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <User className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Account Profile Details
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. partner_john"
                className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Branch / Location
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="e.g. Addis Ababa HQ"
                className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Password & Security */}
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#1E2D40] pb-3">
            <Lock className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Security & Password
            </h3>
          </div>

          {passwordError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
              {passwordError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                New Password / PIN
              </label>
              <input
                type="password"
                placeholder="Leave blank to keep unchanged"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Save Submit Button */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 dark:bg-[#00D4AA] dark:hover:brightness-110 text-white dark:text-[#0A0E1A] font-extrabold text-xs flex items-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Profile Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
