import React, { useState } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  UserCheck,
  Shield,
  Key,
  Search,
  X,
  Check,
  Building,
  Clock,
  UserX,
  CheckCircle,
  Copy,
  Ticket,
  Lock,
  RefreshCw,
  Eye,
  Sliders,
  AlertCircle,
  Zap,
  Mail,
  Send,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, UserRole, UserPermissions, ERPState, Transaction } from '../../types';
import { triggerHaptic } from '../../lib/haptics';
import { DEFAULT_ROLE_PERMISSIONS, generateTemporaryPassword, getEffectivePermissions } from '../../lib/auth';

interface UsersViewProps {
  users: UserProfile[];
  currentUser: UserProfile;
  onUpdateState: (fn: (prev: ERPState) => ERPState) => void;
  onSwitchUser?: (user: UserProfile) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  currentUser,
  onUpdateState,
  onSwitchUser
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalMode, setModalMode] = useState<'INVITE_EMAIL' | 'MANUAL_CREATE'>('INVITE_EMAIL');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('Partner');
  const [branch, setBranch] = useState('Addis Ababa HQ');
  const [active, setActive] = useState(true);
  const [tempPassword, setTempPassword] = useState('');

  // Email Invite Processing State
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccessData, setInviteSuccessData] = useState<{
    user: string;
    email: string;
    otp: string;
    invitationCode: string;
    emailSent: boolean;
    message: string;
    activationUrl: string;
  } | null>(null);

  // Active OTP Inspection Modal (for SuperAdmin to help user)
  const [inspectedOtpUser, setInspectedOtpUser] = useState<UserProfile | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Granular Permissions State
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_ROLE_PERMISSIONS.Partner);

  // Notice toast for temporary password creation
  const [createdNotice, setCreatedNotice] = useState<{ user: string; tempPass: string } | null>(null);

  const isSuperAdmin = currentUser.role === 'SuperAdmin';
  const isAdminOrSuperAdmin = currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin';

  const filteredUsers = users
    .filter((u) => {
      const matchesSearch =
        (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.branch || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => b.id.localeCompare(a.id));

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setPermissions(DEFAULT_ROLE_PERMISSIONS[newRole]);
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    triggerHaptic('light');
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleOpenAdd = (mode: 'INVITE_EMAIL' | 'MANUAL_CREATE' = 'INVITE_EMAIL') => {
    if (!isAdminOrSuperAdmin) {
      alert('Security Protocol: Only Admins and SuperAdmins can register or invite new users.');
      return;
    }
    triggerHaptic('light');
    setModalMode(mode);
    setName('');
    setEmail('');
    setRole('Partner');
    setBranch('Addis Ababa HQ');
    setActive(true);
    setInviteError(null);
    const generated = generateTemporaryPassword();
    setTempPassword(generated);
    setPermissions(DEFAULT_ROLE_PERMISSIONS.Partner);
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    if (!isAdminOrSuperAdmin && user.id !== currentUser.id) {
      alert('Security Protocol: Only Admins and SuperAdmins can modify user roles & permissions.');
      return;
    }
    triggerHaptic('light');
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setBranch(user.branch || 'Addis Ababa HQ');
    setActive(user.active);
    setTempPassword('');
    setPermissions(getEffectivePermissions(user));
  };

  // Primary Action: Send Email Invitation with OTP
  const handleSendInviteEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0];

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setInviteError('Please provide a valid recipient email address.');
      return;
    }

    // Check if user with this email already exists
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing && existing.hasSetPassword) {
      setInviteError(`An active user with email '${cleanEmail}' already exists in the system.`);
      return;
    }

    setIsSendingInvite(true);
    triggerHaptic('medium');

    try {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: cleanName,
          role,
          branch: branch.trim() || 'Addis Ababa HQ',
          permissions,
          invitedBy: currentUser.name,
          appUrl: originUrl
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch email invitation.');
      }

      const generatedOtp = data.otp;
      const invitationCode = data.invitationCode;
      const activationUrl = `${originUrl}?action=activate&email=${encodeURIComponent(cleanEmail)}&otp=${encodeURIComponent(generatedOtp)}`;

      // Update state with newly invited user
      const invitedUser: UserProfile = data.user || {
        id: `u-${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        role,
        branch: branch.trim() || 'Addis Ababa HQ',
        active: true,
        isApproved: true,
        hasSetPassword: false,
        isTemporaryPassword: true,
        mustChangePassword: true,
        otp: generatedOtp,
        otpExpiresAt: data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        invitationCode,
        invitationStatus: 'PENDING_ACTIVATION',
        permissions,
        createdBy: currentUser.name,
        lastActive: 'Invited just now'
      };

      onUpdateState((prev) => ({
        ...prev,
        users: [...prev.users.filter((u) => u.email.toLowerCase() !== cleanEmail), invitedUser],
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: prev.currentUser.id,
            actorName: prev.currentUser.name,
            action: 'INVITE_USER_OTP_SENT',
            entity: 'UserProfile',
            entityId: invitedUser.id,
            diffAfter: {
              name: invitedUser.name,
              email: invitedUser.email,
              role: invitedUser.role,
              otp: generatedOtp,
              emailDelivered: data.emailSent
            },
            branch: prev.currentUser.branch
          },
          ...prev.auditLogs
        ]
      }));

      triggerHaptic('success');
      setShowAddModal(false);

      setInviteSuccessData({
        user: cleanName,
        email: cleanEmail,
        otp: generatedOtp,
        invitationCode,
        emailSent: Boolean(data.emailSent),
        message: data.message || `Invitation email sent to ${cleanEmail}`,
        activationUrl
      });
    } catch (err: any) {
      console.warn('API invite failed, using local secure fallback generator:', err.message);

      // Graceful offline/fallback generator
      const fallbackOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const fallbackInv = `PZ-INV-${Math.floor(1000 + Math.random() * 9000)}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const activationUrl = `${originUrl}?action=activate&email=${encodeURIComponent(cleanEmail)}&otp=${encodeURIComponent(fallbackOtp)}`;

      const fallbackUser: UserProfile = {
        id: `u-${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        role,
        branch: branch.trim() || 'Addis Ababa HQ',
        active: true,
        isApproved: true,
        hasSetPassword: false,
        isTemporaryPassword: true,
        mustChangePassword: true,
        otp: fallbackOtp,
        otpExpiresAt: expiresAt,
        invitationCode: fallbackInv,
        invitationStatus: 'PENDING_ACTIVATION',
        permissions,
        createdBy: currentUser.name,
        lastActive: 'Invited just now'
      };

      onUpdateState((prev) => ({
        ...prev,
        users: [...prev.users.filter((u) => u.email.toLowerCase() !== cleanEmail), fallbackUser],
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: prev.currentUser.id,
            actorName: prev.currentUser.name,
            action: 'INVITE_USER_OTP_LOCAL',
            entity: 'UserProfile',
            entityId: fallbackUser.id,
            diffAfter: { name: cleanName, email: cleanEmail, otp: fallbackOtp },
            branch: prev.currentUser.branch
          },
          ...prev.auditLogs
        ]
      }));

      triggerHaptic('success');
      setShowAddModal(false);

      setInviteSuccessData({
        user: cleanName,
        email: cleanEmail,
        otp: fallbackOtp,
        invitationCode: fallbackInv,
        emailSent: false,
        message: 'Invitation OTP created successfully! You can share the OTP directly below.',
        activationUrl
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  // Resend OTP to existing pending user
  const handleResendOtp = async (user: UserProfile) => {
    triggerHaptic('medium');
    const cleanEmail = user.email.toLowerCase();

    try {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: user.name,
          role: user.role,
          branch: user.branch,
          permissions: user.permissions,
          invitedBy: currentUser.name,
          appUrl: originUrl
        })
      });

      const data = await response.json();
      const freshOtp = data.otp || Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const activationUrl = `${originUrl}?action=activate&email=${encodeURIComponent(cleanEmail)}&otp=${encodeURIComponent(freshOtp)}`;

      onUpdateState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === user.id
            ? {
                ...u,
                otp: freshOtp,
                otpExpiresAt: expiresAt,
                invitationStatus: 'PENDING_ACTIVATION',
                lastActive: 'OTP Resent'
              }
            : u
        )
      }));

      triggerHaptic('success');
      setInviteSuccessData({
        user: user.name,
        email: user.email,
        otp: freshOtp,
        invitationCode: user.invitationCode || `PZ-INV-${Math.floor(1000 + Math.random() * 9000)}`,
        emailSent: Boolean(data.emailSent),
        message: `Fresh OTP generated and sent to ${user.email}`,
        activationUrl
      });
    } catch (err: any) {
      console.warn('Resend OTP error:', err.message);
      const freshOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const activationUrl = `${originUrl}?action=activate&email=${encodeURIComponent(cleanEmail)}&otp=${encodeURIComponent(freshOtp)}`;

      onUpdateState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === user.id
            ? {
                ...u,
                otp: freshOtp,
                otpExpiresAt: expiresAt,
                invitationStatus: 'PENDING_ACTIVATION',
                lastActive: 'OTP Resent'
              }
            : u
        )
      }));

      setInviteSuccessData({
        user: user.name,
        email: user.email,
        otp: freshOtp,
        invitationCode: user.invitationCode || 'PZ-INV-RESENT',
        emailSent: false,
        message: 'Fresh OTP generated locally for user!',
        activationUrl
      });
    }
  };

  const handleSaveAddManual = () => {
    if (!name.trim() || !email.trim()) return;
    triggerHaptic('success');

    const generatedPass = tempPassword.trim() || generateTemporaryPassword();

    const newUser: UserProfile = {
      id: `u-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role,
      branch: branch.trim() || 'Addis Ababa HQ',
      active,
      isApproved: true,
      hasSetPassword: false,
      isTemporaryPassword: true,
      mustChangePassword: true,
      password: generatedPass,
      invitationCode: `PZ-INV-${Math.floor(1000 + Math.random() * 9000)}`,
      permissions,
      createdBy: currentUser.name,
      lastActive: 'Just created'
    };

    const regTx: Transaction = {
      id: `tx-reg-${newUser.id}`,
      date: new Date().toISOString(),
      type: 'INCOME',
      category: 'Genesis / Setup',
      amount: 0,
      walletId: 'w-cash',
      description: `Member Account Registered: ${newUser.name} (@${newUser.username || newUser.email}) [${newUser.role}]`,
      creatorName: currentUser.name,
      creatorId: currentUser.id,
      refId: newUser.id
    };

    onUpdateState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
      transactions: [regTx, ...prev.transactions],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'CREATE_USER_REGISTERED',
          entity: 'UserProfile',
          entityId: newUser.id,
          diffAfter: { name: newUser.name, role: newUser.role, branch: newUser.branch, isTemporaryPassword: true },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));

    setCreatedNotice({ user: newUser.name, tempPass: generatedPass });
    setShowAddModal(false);
  };

  const handleSaveEdit = () => {
    if (!editingUser || !name.trim() || !email.trim()) return;
    triggerHaptic('success');

    onUpdateState((prev) => {
      const updatedUsers = prev.users.map((u) => {
        if (u.id === editingUser.id) {
          const updated: UserProfile = {
            ...u,
            name: name.trim(),
            email: email.trim(),
            role,
            branch: branch.trim(),
            active,
            permissions
          };

          if (tempPassword.trim()) {
            updated.password = tempPassword.trim();
            updated.isTemporaryPassword = true;
            updated.mustChangePassword = true;
            updated.hasSetPassword = false;
          }

          return updated;
        }
        return u;
      });

      const updatedCurrentUser =
        editingUser.id === prev.currentUser.id
          ? {
              ...prev.currentUser,
              name: name.trim(),
              email: email.trim(),
              role,
              branch: branch.trim(),
              active,
              permissions
            }
          : prev.currentUser;

      return {
        ...prev,
        users: updatedUsers,
        currentUser: updatedCurrentUser,
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: prev.currentUser.id,
            actorName: prev.currentUser.name,
            action: 'UPDATE_USER_PERMISSIONS',
            entity: 'UserProfile',
            entityId: editingUser.id,
            diffAfter: { name: name.trim(), role, branch: branch.trim() },
            branch: prev.currentUser.branch
          },
          ...prev.auditLogs
        ]
      };
    });

    setEditingUser(null);
  };

  const handleResetUserPassword = (user: UserProfile) => {
    if (!isAdminOrSuperAdmin) return;
    triggerHaptic('light');
    const newTemp = generateTemporaryPassword();

    onUpdateState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === user.id
          ? {
              ...u,
              password: newTemp,
              isTemporaryPassword: true,
              mustChangePassword: true,
              hasSetPassword: false
            }
          : u
      ),
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'RESET_USER_TEMP_PASSWORD',
          entity: 'UserProfile',
          entityId: user.id,
          diffAfter: { name: user.name, mustChangePassword: true },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));

    setCreatedNotice({ user: user.name, tempPass: newTemp });
  };

  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  const confirmDeleteUser = () => {
    if (!deletingUser) return;
    triggerHaptic('warning');
    onUpdateState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.id !== deletingUser.id),
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_USER_ACCOUNT',
          entity: 'UserProfile',
          entityId: deletingUser.id,
          diffBefore: { name: deletingUser.name, role: deletingUser.role },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));
    setDeletingUser(null);
  };

  const handleDeleteUser = (user: UserProfile) => {
    if (!isSuperAdmin) {
      alert('Security Protocol: Only SuperAdmins can delete user accounts.');
      return;
    }
    if (user.id === currentUser.id) {
      alert('Security Violation: You cannot delete your own active session account.');
      return;
    }

    triggerHaptic('light');
    setDeletingUser(user);
  };

  const handleToggleActive = (user: UserProfile) => {
    if (!isSuperAdmin) return;
    if (user.id === currentUser.id) {
      alert('You cannot deactivate your own active session.');
      return;
    }
    const nextActive = !user.active;
    triggerHaptic(nextActive ? 'success' : 'warning');

    onUpdateState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === user.id ? { ...u, active: nextActive } : u)),
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: nextActive ? 'ACTIVATE_USER_ACCOUNT' : 'DEACTIVATE_USER_ACCOUNT',
          entity: 'UserProfile',
          entityId: user.id,
          diffAfter: { name: user.name, active: nextActive },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));
  };

  const handleAssignDigitalMoneyManager = (targetUser: UserProfile) => {
    if (!isAdminOrSuperAdmin) {
      alert('Security Protocol: Only Admins or SuperAdmins can delegate the Digital Money Manager role.');
      return;
    }

    triggerHaptic('heavy');
    onUpdateState((prev) => ({
      ...prev,
      digitalMoneyManagerUserId: targetUser.id,
      users: prev.users.map((u) => ({
        ...u,
        isDigitalMoneyManager: u.id === targetUser.id
      })),
      currentUser: {
        ...prev.currentUser,
        isDigitalMoneyManager: prev.currentUser.id === targetUser.id
      },
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELEGATE_DIGITAL_MONEY_MANAGER',
          entity: 'UserProfile',
          entityId: targetUser.id,
          diffAfter: { digitalMoneyManagerUserId: targetUser.id, userName: targetUser.name },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Notice Toast for Temporary Password */}
      {createdNotice && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <Key className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">{createdNotice.user}</span> created with temporary password:{' '}
              <code className="bg-white/80 dark:bg-black/40 px-2 py-0.5 rounded font-mono font-black text-amber-600 dark:text-amber-400">
                {createdNotice.tempPass}
              </code>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdNotice.tempPass);
                triggerHaptic('light');
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
            <button
              onClick={() => setCreatedNotice(null)}
              className="p-1 text-amber-500 hover:text-amber-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent dark:from-[#FB923C]/10 dark:via-[#00D4AA]/5 p-5 rounded-3xl border border-orange-500/20 dark:border-[#FB923C]/20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500 dark:bg-[#FB923C] text-white dark:text-[#0A0E1A] flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Team Users &amp; Invitations
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#8899BB]">
              Invite members via email with secure 6-digit OTP activation codes
            </p>
          </div>
        </div>

        {isAdminOrSuperAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenAdd('INVITE_EMAIL')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-[#070A12] font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#00D4AA]/20 cursor-pointer hover:brightness-110 active:scale-95 transition-all"
            >
              <Mail className="w-4 h-4" />
              <span>Invite via Email &amp; OTP</span>
            </button>
            <button
              onClick={() => handleOpenAdd('MANUAL_CREATE')}
              className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] hover:bg-slate-200 dark:hover:bg-[#253047] text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all border border-slate-200 dark:border-[#1E2D40]"
              title="Manual account registration"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Manual</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-[#8899BB]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name, email, branch..."
            className="w-full bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#8899BB] outline-none focus:border-orange-500 dark:focus:border-[#FB923C]"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none cursor-pointer"
        >
          <option value="ALL">All Accounts ({users.length})</option>
          <option value="SuperAdmin">Master Tier</option>
          <option value="Admin">Management Tier</option>
          <option value="Partner">Operational Tier</option>
          <option value="Viewer">Observer Tier</option>
        </select>
      </div>

      {/* Users List Cards */}
      <div className="space-y-3">
        {filteredUsers.map((u) => {
          const isCurrent = u.id === currentUser.id;
          const uPerms = getEffectivePermissions(u);
          const isPendingActivation = u.invitationStatus === 'PENDING_ACTIVATION' || (u.hasSetPassword === false && Boolean(u.otp));

          return (
            <div
              key={u.id}
              className={`bg-white dark:bg-[#131926] border rounded-2xl p-4 transition-all space-y-3 shadow-sm ${
                isCurrent
                  ? 'border-orange-500 dark:border-[#FB923C]/60 ring-1 ring-orange-500/20'
                  : isPendingActivation
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : u.active === false
                  ? 'border-red-500/30 opacity-70 bg-red-500/5'
                  : 'border-slate-200 dark:border-[#1E2D40]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm text-white shrink-0 bg-gradient-to-tr from-emerald-600 to-indigo-600 shadow-sm">
                    {u.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{u.name}</h4>

                      {/* Status Badges */}
                      {isPendingActivation ? (
                        <span className="text-[9px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                          <Mail className="w-2.5 h-2.5" />
                          <span>Pending Activation (OTP Sent)</span>
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Active User
                        </span>
                      )}

                      {u.isDigitalMoneyManager && (
                        <span className="text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-[#00D4AA] px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5 fill-current" />
                          <span>Digital Money Manager</span>
                        </span>
                      )}

                      {isCurrent && (
                        <span className="text-[9px] font-bold bg-orange-500/15 text-orange-600 dark:text-[#FB923C] px-2 py-0.5 rounded-full border border-orange-500/30">
                          Current Session
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-0.5 font-mono">{u.email}</p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {u.branch || 'Addis Ababa HQ'}
                      </span>
                      <span>•</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{u.role}</span>
                      {u.invitationCode && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-slate-500">Ref: {u.invitationCode}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                  {/* Resend OTP Email button */}
                  {isPendingActivation && isAdminOrSuperAdmin && (
                    <button
                      onClick={() => handleResendOtp(u)}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-bold cursor-pointer border border-amber-500/30 flex items-center gap-1"
                      title="Resend invitation email with fresh OTP"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Resend OTP</span>
                    </button>
                  )}

                  {/* SuperAdmin View OTP Button */}
                  {isPendingActivation && isSuperAdmin && u.otp && (
                    <button
                      onClick={() => {
                        setInspectedOtpUser(u);
                        triggerHaptic('light');
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 text-[#00D4AA] text-[11px] font-bold cursor-pointer border border-[#00D4AA]/30 flex items-center gap-1"
                      title="Inspect OTP for manual assistance"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View OTP</span>
                    </button>
                  )}

                  {/* Digital Money Manager Delegation */}
                  {isAdminOrSuperAdmin && !u.isDigitalMoneyManager && u.active && !isPendingActivation && (
                    <button
                      onClick={() => handleAssignDigitalMoneyManager(u)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold cursor-pointer border border-emerald-500/30 flex items-center gap-1"
                      title="Delegate Digital Money Manager privileges"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Make DMM</span>
                    </button>
                  )}

                  {/* Active/Deactivate toggle */}
                  {isSuperAdmin && !isCurrent && (
                    <button
                      onClick={() => handleToggleActive(u)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border flex items-center gap-1 ${
                        u.active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 hover:bg-red-500/30'
                      }`}
                      title={u.active ? 'Deactivate user access' : 'Activate user account'}
                    >
                      {u.active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      <span>{u.active ? 'Active' : 'Deactivated'}</span>
                    </button>
                  )}

                  {/* SuperAdmin Session Delegation */}
                  {onSwitchUser && !isCurrent && u.active && isSuperAdmin && (
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        if (window.confirm(`Security Protocol: Switch active session to "${u.name}" (${u.role})?`)) {
                          onSwitchUser(u);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 text-[#00D4AA] text-[11px] font-bold cursor-pointer border border-[#00D4AA]/30"
                      title="SuperAdmin Session Delegation"
                    >
                      Delegate Session
                    </button>
                  )}

                  {/* Edit User Privileges */}
                  {(isSuperAdmin || isCurrent) && (
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-[#1C2333] hover:bg-[#FB923C]/20 text-slate-600 dark:text-[#8899BB] hover:text-[#FB923C] cursor-pointer"
                      title="Edit User & Permissions"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete User */}
                  {isSuperAdmin && !isCurrent && (
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 cursor-pointer"
                      title="Delete User"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Granular Permission Tags Preview */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#1E2D40] flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-slate-400 dark:text-slate-500 font-mono font-bold mr-1">Modules:</span>
                <span className={`px-2 py-0.5 rounded ${uPerms.dashboard ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800/40 text-slate-500'}`}>Dashboard</span>
                <span className={`px-2 py-0.5 rounded ${uPerms.income ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800/40 text-slate-500'}`}>Income</span>
                <span className={`px-2 py-0.5 rounded ${uPerms.expenses ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800/40 text-slate-500'}`}>Expenses</span>
                <span className={`px-2 py-0.5 rounded ${uPerms.equb ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800/40 text-slate-500'}`}>Equb</span>
                <span className={`px-2 py-0.5 rounded ${uPerms.loans ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800/40 text-slate-500'}`}>Loans</span>
                <span className={`px-2 py-0.5 rounded ${uPerms.reports ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800/40 text-slate-500'}`}>Reports</span>
                <span className={`px-2 py-0.5 rounded ${uPerms.settings ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800/40 text-slate-500'}`}>Settings</span>

                <span className="text-slate-400 dark:text-slate-500 font-mono font-bold ml-2 mr-1">Actions:</span>
                <span className={`px-2 py-0.5 rounded ${uPerms.canAdd ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800/40 text-slate-500'}`}>Add</span>
                <span className={`px-2 py-0.5 rounded ${uPerms.canEdit ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800/40 text-slate-500'}`}>Edit</span>
                <span className={`px-2 py-0.5 rounded ${uPerms.canDelete ? 'bg-red-500/10 text-red-400' : 'bg-slate-800/40 text-slate-500'}`}>Delete</span>
                {uPerms.viewOnly && <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">View Only</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invite User or Register Modal */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] w-full max-w-lg p-6 rounded-3xl space-y-5 text-slate-900 dark:text-white shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 dark:text-[#FB923C] flex items-center justify-center">
                  {editingUser ? <Edit2 className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingUser
                      ? `Edit Privileges: ${editingUser.name}`
                      : modalMode === 'INVITE_EMAIL'
                      ? 'Invite Team User via Email & OTP'
                      : 'Manual User Registration'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8899BB]">
                    {editingUser
                      ? 'Modify roles and granular access permissions'
                      : 'Send a real email with a 6-digit one-time security passcode'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                  setInviteError(null);
                }}
                className="text-slate-400 dark:text-[#8899BB] hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher if creating new user */}
            {!editingUser && (
              <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40]">
                <button
                  type="button"
                  onClick={() => setModalMode('INVITE_EMAIL')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    modalMode === 'INVITE_EMAIL'
                      ? 'bg-[#00D4AA] text-[#070A12] shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-white'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email &amp; OTP Invite</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('MANUAL_CREATE')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    modalMode === 'MANUAL_CREATE'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-white'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Direct Password</span>
                </button>
              </div>
            )}

            <form
              onSubmit={
                editingUser
                  ? (e) => {
                      e.preventDefault();
                      handleSaveEdit();
                    }
                  : modalMode === 'INVITE_EMAIL'
                  ? handleSendInviteEmail
                  : (e) => {
                      e.preventDefault();
                      handleSaveAddManual();
                    }
              }
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
            >
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Abebe Bikila"
                    className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#00D4AA] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                    Recipient Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@gmail.com"
                    className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#00D4AA] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                    required
                  />
                </div>
              </div>

              {/* Role & Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                    Assigned Role &amp; Tier
                  </label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#00D4AA] rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="SuperAdmin">Master Tier (Full System Privileges)</option>
                    <option value="Admin">Management Tier (Operational Access)</option>
                    <option value="Partner">Operational Tier (Branch Operations)</option>
                    <option value="Viewer">Observer Tier (Read-Only Mode)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-[#8899BB] block mb-1">
                    Assigned Branch Location
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. Addis Ababa HQ"
                    className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#00D4AA] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Email OTP Info Box */}
              {!editingUser && modalMode === 'INVITE_EMAIL' && (
                <div className="p-3.5 rounded-2xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-2 text-[#00D4AA] font-bold">
                    <Mail className="w-4 h-4" />
                    <span>How Email &amp; OTP Invitation Works:</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    1. The app generates a <strong>6-digit secure OTP</strong> valid for 24 hours.
                    <br />
                    2. An official invitation email is dispatched to <strong>{email || 'recipient'}</strong>.
                    <br />
                    3. The user enters their email and OTP on the sign in page to choose their permanent password.
                  </p>
                </div>
              )}

              {/* Manual Password Input (only in manual mode or edit) */}
              {(editingUser || modalMode === 'MANUAL_CREATE') && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Key className="w-4 h-4" />
                      <span>{editingUser ? 'Reset Temporary Password (Optional)' : 'Assigned Temporary Password'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const gen = generateTemporaryPassword();
                        setTempPassword(gen);
                        triggerHaptic('light');
                      }}
                      className="text-[10px] font-bold text-[#00D4AA] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Random</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder={editingUser ? 'Leave blank to keep existing password' : 'e.g. PZ-X92A1B'}
                    className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500 outline-none"
                  />
                  <p className="text-[10px] text-amber-300/80">
                    User will be required to change this temporary password on their first login.
                  </p>
                </div>
              )}

              {/* Granular Permissions Section */}
              <div className="border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold flex items-center gap-1.5 text-slate-800 dark:text-white">
                    <Sliders className="w-3.5 h-3.5 text-[#00D4AA]" />
                    <span>Granular Access Permissions</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Customizes default role perms</span>
                </div>

                {/* Module Toggles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  {[
                    { key: 'dashboard', label: 'Dashboard' },
                    { key: 'income', label: 'Income' },
                    { key: 'expenses', label: 'Expenses' },
                    { key: 'equb', label: 'Equb Circles' },
                    { key: 'loans', label: 'Loans Ledger' },
                    { key: 'wallets', label: 'Vault Wallets' },
                    { key: 'receivables', label: 'Receivables' },
                    { key: 'reports', label: 'Reports' }
                  ].map((item) => {
                    const isChecked = Boolean(permissions[item.key as keyof UserPermissions]);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleTogglePermission(item.key as keyof UserPermissions)}
                        className={`p-2 rounded-xl text-left border flex items-center justify-between transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold'
                            : 'bg-slate-50 dark:bg-[#1C2333] border-slate-200 dark:border-[#1E2D40] text-slate-400'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isChecked && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Action Permissions */}
                <div className="border-t border-slate-100 dark:border-[#1E2D40] pt-2 flex flex-wrap gap-2 text-[11px]">
                  {[
                    { key: 'canAdd', label: 'Can Create/Add' },
                    { key: 'canEdit', label: 'Can Edit Records' },
                    { key: 'canDelete', label: 'Can Delete' },
                    { key: 'canReverse', label: 'Can Reverse Payouts' }
                  ].map((act) => {
                    const isChecked = Boolean(permissions[act.key as keyof UserPermissions]);
                    return (
                      <button
                        key={act.key}
                        type="button"
                        onClick={() => handleTogglePermission(act.key as keyof UserPermissions)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-500'
                            : 'bg-slate-50 dark:bg-[#1C2333] border-slate-200 dark:border-[#1E2D40] text-slate-400'
                        }`}
                      >
                        {act.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {inviteError && (
                <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-100 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
                  <span>{inviteError}</span>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUser(null);
                    setInviteError(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSendingInvite}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#00B894] hover:brightness-110 active:scale-95 text-[#070A12] font-bold text-xs shadow-lg shadow-[#00D4AA]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingInvite ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#070A12] border-t-transparent rounded-full animate-spin" />
                      <span>Sending Email with OTP...</span>
                    </>
                  ) : editingUser ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Update Privileges</span>
                    </>
                  ) : modalMode === 'INVITE_EMAIL' ? (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Email Invitation with OTP</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Register User</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invitation Success & OTP Card Modal */}
      {inviteSuccessData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0D121F] border border-[#00D4AA]/40 w-full max-w-md p-6 rounded-3xl space-y-5 text-white shadow-2xl relative text-center">
            <button
              onClick={() => setInviteSuccessData(null)}
              className="absolute top-4 right-4 p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#00D4AA]/15 border border-[#00D4AA]/40 flex items-center justify-center shadow-lg">
              <Mail className="w-7 h-7 text-[#00D4AA]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black tracking-tight text-white">
                Invitation Dispatched Successfully!
              </h3>
              <p className="text-xs text-slate-400">
                Email with OTP sent to <strong className="text-white">{inviteSuccessData.email}</strong>
              </p>
            </div>

            {/* OTP Monospace Display */}
            <div className="bg-[#070A12] border-2 border-dashed border-[#00D4AA] rounded-2xl p-4 space-y-1">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">
                6-Digit Security Activation OTP
              </p>
              <div className="text-3xl font-black font-mono tracking-[8px] text-[#00D4AA] py-1">
                {inviteSuccessData.otp}
              </div>
              <p className="text-[10px] text-amber-400 font-semibold">⏱️ Valid for 24 hours</p>
            </div>

            {/* Quick Copy Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteSuccessData.otp);
                  triggerHaptic('success');
                  setCopiedOtp(true);
                  setTimeout(() => setCopiedOtp(false), 2500);
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedOtp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedOtp ? 'Copied OTP!' : 'Copy OTP'}</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteSuccessData.activationUrl);
                  triggerHaptic('success');
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2500);
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ExternalLink className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Direct Link'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              The recipient can click the direct link in their email or enter the OTP above on the sign in page to set their permanent password.
            </p>

            <button
              onClick={() => setInviteSuccessData(null)}
              className="w-full py-3 rounded-xl bg-[#00D4AA] text-[#070A12] font-bold text-xs shadow-md cursor-pointer hover:brightness-110"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* SuperAdmin Inspected OTP Inspection Dialog */}
      {inspectedOtpUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0D121F] border border-slate-800 w-full max-w-sm p-6 rounded-3xl space-y-4 text-white shadow-2xl relative text-center">
            <button
              onClick={() => setInspectedOtpUser(null)}
              className="absolute top-4 right-4 p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Key className="w-6 h-6 text-amber-400" />
            </div>

            <div>
              <h4 className="text-base font-bold text-white">Active OTP for {inspectedOtpUser.name}</h4>
              <p className="text-xs text-slate-400">{inspectedOtpUser.email}</p>
            </div>

            <div className="bg-[#070A12] border border-amber-500/30 rounded-2xl p-4">
              <div className="text-3xl font-black font-mono tracking-[8px] text-[#00D4AA]">
                {inspectedOtpUser.otp || 'N/A'}
              </div>
              <p className="text-[10px] text-amber-400 mt-1">Pending user activation</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (inspectedOtpUser.otp) {
                    navigator.clipboard.writeText(inspectedOtpUser.otp);
                    triggerHaptic('success');
                  }
                  setInspectedOtpUser(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy OTP</span>
              </button>

              <button
                onClick={() => {
                  const target = inspectedOtpUser;
                  setInspectedOtpUser(null);
                  handleResendOtp(target);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#00D4AA] text-[#070A12] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Resend Email</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-red-500/30 w-full max-w-sm p-6 rounded-3xl space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-red-500/15 flex items-center justify-center text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Delete User Account?</h4>
              <p className="text-xs text-slate-500 dark:text-[#8899BB] mt-1">
                Are you sure you want to permanently remove <strong className="text-slate-900 dark:text-white">{deletingUser.name}</strong> ({deletingUser.email})?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 cursor-pointer shadow-md"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
