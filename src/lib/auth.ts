import { UserProfile, UserRole, UserPermissions } from '../types';

export const FULL_PERMISSIONS: UserPermissions = {
  dashboard: true,
  income: true,
  expenses: true,
  equb: true,
  loans: true,
  reports: true,
  analytics: true,
  partners: true,
  settings: true,
  wallets: true,
  receivables: true,
  assets: true,
  auditLogs: true,
  canAdd: true,
  canEdit: true,
  canDelete: true,
  canReverse: true,
  viewOnly: false
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  SuperAdmin: { ...FULL_PERMISSIONS },
  Admin: {
    ...FULL_PERMISSIONS,
    partners: true,
    settings: true,
    canDelete: true
  },
  Partner: {
    dashboard: true,
    income: true,
    expenses: true,
    equb: true,
    loans: true,
    reports: true,
    analytics: true,
    partners: false,
    settings: false,
    wallets: true,
    receivables: true,
    assets: true,
    auditLogs: false,
    canAdd: true,
    canEdit: true,
    canDelete: false,
    canReverse: false,
    viewOnly: false
  },
  Viewer: {
    dashboard: true,
    income: true,
    expenses: true,
    equb: true,
    loans: true,
    reports: true,
    analytics: true,
    partners: false,
    settings: false,
    wallets: true,
    receivables: true,
    assets: true,
    auditLogs: false,
    canAdd: false,
    canEdit: false,
    canDelete: false,
    canReverse: false,
    viewOnly: true
  }
};

export function getEffectivePermissions(user?: UserProfile | null): UserPermissions {
  if (!user) return DEFAULT_ROLE_PERMISSIONS.Viewer;
  if (user.role === 'SuperAdmin') return FULL_PERMISSIONS;
  if (user.role === 'Admin') {
    return {
      ...FULL_PERMISSIONS,
      ...(user.permissions || {}),
      canAdd: user.permissions?.canAdd !== false,
      canEdit: user.permissions?.canEdit !== false,
      canDelete: user.permissions?.canDelete !== false,
      canReverse: user.permissions?.canReverse !== false,
      viewOnly: Boolean(user.permissions?.viewOnly)
    };
  }

  const defaultRolePerms = DEFAULT_ROLE_PERMISSIONS[user.role || 'Partner'] || DEFAULT_ROLE_PERMISSIONS.Partner;
  const userPerms: Partial<UserPermissions> = user.permissions || {};

  return {
    ...defaultRolePerms,
    ...userPerms,
    canAdd: userPerms.canAdd !== false && !userPerms.viewOnly,
    canEdit: userPerms.canEdit !== false && !userPerms.viewOnly,
    canDelete: Boolean(userPerms.canDelete) && !userPerms.viewOnly,
    canReverse: Boolean(userPerms.canReverse) && !userPerms.viewOnly,
    viewOnly: Boolean(userPerms.viewOnly)
  };
}

export function hasModuleAccess(user: UserProfile | null | undefined, moduleName: keyof UserPermissions): boolean {
  if (!user) return false;
  if (!user.active) return false;
  if (user.role === 'SuperAdmin') return true;
  const perms = getEffectivePermissions(user);
  return Boolean(perms[moduleName]);
}

export function canPerformAction(
  user: UserProfile | null | undefined,
  action: 'add' | 'edit' | 'delete' | 'reverse'
): boolean {
  if (!user) return false;
  if (!user.active) return false;
  if (user.role === 'SuperAdmin') return true;
  const perms = getEffectivePermissions(user);
  if (perms.viewOnly && action !== 'add') return false;

  switch (action) {
    case 'add':
      return perms.canAdd && !perms.viewOnly;
    case 'edit':
      return perms.canEdit && !perms.viewOnly;
    case 'delete':
      return perms.canDelete && !perms.viewOnly;
    case 'reverse':
      return perms.canReverse && !perms.viewOnly;
    default:
      return false;
  }
}

// Simple deterministic hash for stored state simulation
export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText + '_pz_salt_2026_sec');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback simple hash string if Web Crypto unavailable
    let hash = 0;
    for (let i = 0; i < plainText.length; i++) {
      const char = plainText.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `hash_${Math.abs(hash)}`;
  }
}

export async function verifyPassword(plainText: string, user: UserProfile): Promise<boolean> {
  if (!plainText || !user) return false;
  const hash = await hashPassword(plainText);
  if (user.passwordHash && user.passwordHash === hash) return true;
  if (user.password && user.password === plainText) return true;
  return false;
}

export function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = 'PZ-';
  for (let i = 0; i < 6; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}
