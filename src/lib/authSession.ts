import { UserProfile } from '../types';

export const AUTH_SESSION_KEY = 'pluszone_auth_session';
export const AUTH_REMEMBER_KEY = 'pluszone_remember_session_pref';
export const AUTH_USERNAME_KEY = 'pluszone_remembered_username';
export const AUTH_USER_PROFILE_BACKUP = 'pluszone_remembered_user_profile';

export interface StoredAuthSession {
  userId: string;
  email: string;
  username?: string;
  name: string;
  role: string;
  loggedInAt: number;
  remember: boolean;
  user?: UserProfile;
}

export function sanitizeUserForStorage(user: UserProfile): UserProfile {
  const sanitized = { ...user };
  delete sanitized.password;
  delete sanitized.passwordHash;
  delete sanitized.otp;
  delete sanitized.otpExpiresAt;
  return sanitized;
}

/**
 * Save user authentication session to persistent localStorage and tab-scoped sessionStorage.
 * Confidentiality enforced: sensitive credentials (passwords, hashes, OTPs) are scrubbed before saving.
 * When remember = true, session is persisted across browser reloads, tab closures, and device restarts.
 */
export function saveAuthSession(user: UserProfile, remember: boolean = true): void {
  if (typeof window === 'undefined') return;

  const sanitizedUser = sanitizeUserForStorage(user);
  const session: StoredAuthSession = {
    userId: sanitizedUser.id,
    email: sanitizedUser.email,
    username: sanitizedUser.username,
    name: sanitizedUser.name,
    role: sanitizedUser.role,
    loggedInAt: Date.now(),
    remember,
    user: sanitizedUser
  };

  try {
    const raw = JSON.stringify(session);
    const userRaw = JSON.stringify(sanitizedUser);

    if (remember) {
      localStorage.setItem(AUTH_SESSION_KEY, raw);
      localStorage.setItem(AUTH_USER_PROFILE_BACKUP, userRaw);
      localStorage.setItem(AUTH_REMEMBER_KEY, 'true');
      if (sanitizedUser.username || sanitizedUser.email) {
        localStorage.setItem(AUTH_USERNAME_KEY, sanitizedUser.username || sanitizedUser.email);
      }
      // Also mirror to sessionStorage so active tab always has immediate zero-latency access
      sessionStorage.setItem(AUTH_SESSION_KEY, raw);

      // Set cookie as auxiliary fallback for iframe sandboxes
      try {
        document.cookie = `pz_session_active=1; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
    } else {
      sessionStorage.setItem(AUTH_SESSION_KEY, raw);
      localStorage.setItem(AUTH_REMEMBER_KEY, 'false');
      localStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(AUTH_USER_PROFILE_BACKUP);
    }
  } catch (err) {
    console.warn('Failed to save auth session to storage:', err);
  }
}

function isValidActiveSession(session: StoredAuthSession | null): boolean {
  if (!session || !session.userId) return false;
  // Primary SuperAdmin Suraphel is always valid
  if (session.name === 'Suraphel' || session.username === 'suraphel') return true;
  // Block any obsolete legacy accounts from previous periods
  const legacyNames = ['yegeta', 'huawei', 'legacy', 'lounge_admin'];
  if (legacyNames.some(legacy => session.name?.toLowerCase().includes(legacy) || session.username?.toLowerCase().includes(legacy))) {
    return false;
  }
  // User registered starting today (2026-10-24 onwards)
  return true;
}

/**
 * Retrieves the currently active authentication session from localStorage or sessionStorage.
 */
export function getActiveAuthSession(): StoredAuthSession | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Check tab sessionStorage first (active tab session, allowing concurrent multi-user testing in separate tabs/windows)
    const sessionRaw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (parsed && (parsed.userId || parsed.email)) {
        if (!isValidActiveSession(parsed)) {
          clearAuthSession();
          return null;
        }
        return parsed;
      }
    }

    // 2. Check persistent localStorage (remembered session across restarts)
    const localRaw = localStorage.getItem(AUTH_SESSION_KEY);
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (parsed && (parsed.userId || parsed.email)) {
        if (!isValidActiveSession(parsed)) {
          clearAuthSession();
          return null;
        }
        // Hydrate this tab's sessionStorage
        try {
          sessionStorage.setItem(AUTH_SESSION_KEY, localRaw);
        } catch (_) {}
        return parsed;
      }
    }

    // 3. Fallback: check stored user profile backup
    const profileBackup = localStorage.getItem(AUTH_USER_PROFILE_BACKUP);
    if (profileBackup) {
      const parsedUser = JSON.parse(profileBackup) as UserProfile;
      if (parsedUser && parsedUser.id) {
        const fallbackSession: StoredAuthSession = {
          userId: parsedUser.id,
          email: parsedUser.email,
          username: parsedUser.username,
          name: parsedUser.name,
          role: parsedUser.role,
          loggedInAt: Date.now(),
          remember: true,
          user: parsedUser
        };
        // Re-hydrate session storage
        try {
          sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(fallbackSession));
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(fallbackSession));
        } catch (_) {}
        return fallbackSession;
      }
    }
  } catch (err) {
    console.warn('Failed to read active auth session:', err);
  }
  return null;
}

/**
 * Retrieves the full user profile from the active or remembered session if available.
 */
export function getRememberedUserProfile(): UserProfile | null {
  const session = getActiveAuthSession();
  if (session?.user) return session.user;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_USER_PROFILE_BACKUP);
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch {}
  return null;
}

/**
 * Clear all authentication sessions from localStorage and sessionStorage (explicit user logout).
 */
export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_USER_PROFILE_BACKUP);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    try {
      document.cookie = 'pz_session_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    } catch {}
  } catch (err) {
    console.warn('Failed to clear auth session:', err);
  }
}

/**
 * Updates the user details inside the existing session (e.g. on profile switch or update).
 */
export function updateAuthSessionUser(user: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getActiveAuthSession();
    saveAuthSession(user, current ? current.remember !== false : true);
  } catch {}
}

/**
 * Check if the user has opted to remember session (default: true).
 */
export function getRememberSessionPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(AUTH_REMEMBER_KEY);
    return val !== null ? val === 'true' : true;
  } catch {
    return true;
  }
}

/**
 * Get pre-filled or remembered username / email for login screen.
 */
export function getRememberedUsername(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(AUTH_USERNAME_KEY) || '';
  } catch {
    return '';
  }
}

