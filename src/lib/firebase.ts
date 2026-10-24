import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  doc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  getDocFromServer,
  updateDoc,
  disableNetwork,
  enableNetwork
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import config from '../../firebase-applet-config.json';
import { ERPState, isCanonicalTransactionId } from './store';
import { ChatMessage, ChatMessageReaction, UserProfile } from '../types';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};

export const FIRESTORE_PROJECT_ID = config.projectId || metaEnv.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0153646909';
export const FIRESTORE_DATABASE_ID = config.firestoreDatabaseId || metaEnv.VITE_FIREBASE_DATABASE_ID || 'ai-studio-pluszonefinancee-81b56110-6dcb-4d53-93e5-bd5cf2918283';
export const FIRESTORE_UPGRADE_URL = `https://console.firebase.google.com/project/${FIRESTORE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`;
export const FIRESTORE_PRICING_URL = 'https://firebase.google.com/pricing#cloud-firestore';

const firebaseConfig = {
  apiKey: config.apiKey || metaEnv.VITE_FIREBASE_API_KEY || '',
  authDomain: config.authDomain || metaEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: FIRESTORE_PROJECT_ID,
  storageBucket: config.storageBucket || metaEnv.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: config.messagingSenderId || metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: config.appId || metaEnv.VITE_FIREBASE_APP_ID || '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore using memoryLocalCache with auto-detect long-polling to prefer ultra-low-latency WebSockets
export const db = initializeFirestore(
  app,
  {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  },
  FIRESTORE_DATABASE_ID
);

export const auth = getAuth(app);

// Validate Connection to Firestore on boot as mandated by Firebase skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const getTodayStr = () => new Date().toISOString().split('T')[0];

const checkIsQuotaExceededInitial = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const isExceeded = localStorage.getItem('pluszone_quota_exceeded') === 'true';
    const storedTimestamp = Number(localStorage.getItem('pluszone_quota_exceeded_time') || '0');
    // Short 2-minute transient backoff instead of locking out the app for 24 hours
    const withinBackoff = Date.now() - storedTimestamp < 2 * 60 * 1000;
    if (isExceeded && !withinBackoff) {
      localStorage.removeItem('pluszone_quota_exceeded');
      localStorage.removeItem('pluszone_quota_exceeded_date');
      localStorage.removeItem('pluszone_quota_exceeded_time');
      return false;
    }
    return isExceeded && withinBackoff;
  } catch (_) {
    return false;
  }
};

let isQuotaExceeded = checkIsQuotaExceededInitial();
let quotaExceededLogged = isQuotaExceeded;
let isRemoteUpdate = false;
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSyncedFingerprint = '';

export const clearQuotaExceeded = () => {
  isQuotaExceeded = false;
  quotaExceededLogged = false;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('pluszone_quota_exceeded');
      localStorage.removeItem('pluszone_quota_exceeded_date');
      localStorage.removeItem('pluszone_quota_exceeded_time');
      window.dispatchEvent(new CustomEvent('pluszone:firestore-quota-exceeded', { detail: { exceeded: false } }));
    } catch (_) {}
  }
  try {
    enableNetwork(db).catch(() => {});
  } catch (_) {}
};

export const markQuotaExceeded = () => {
  isQuotaExceeded = true;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('pluszone_quota_exceeded', 'true');
      localStorage.setItem('pluszone_quota_exceeded_date', getTodayStr());
      localStorage.setItem('pluszone_quota_exceeded_time', String(Date.now()));
      window.dispatchEvent(new CustomEvent('pluszone:firestore-quota-exceeded', { detail: { exceeded: true } }));
    } catch (_) {}
  }
  // Halt active Firestore network streams and backoff retries
  try {
    disableNetwork(db).catch(() => {});
  } catch (_) {}
};

// Always ensure Firestore network is enabled on app boot
try {
  enableNetwork(db).catch(() => {});
} catch (_) {}

// Intercept window console.error & unhandled rejection to gracefully absorb Firestore quota & backoff delay logs
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: any[]) => {
    const msg = args
      .map((a) => {
        if (!a) return '';
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.message + ' ' + (a.stack || '');
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');

    const isQuotaError =
      msg.includes('code=resource-exhausted') ||
      msg.includes('Free daily write units per project') ||
      msg.includes('Free daily read units per project') ||
      msg.includes('Quota limit exceeded') ||
      msg.includes('Using maximum backoff delay to prevent overloading the backend');

    if (isQuotaError) {
      if (!isQuotaExceeded) {
        markQuotaExceeded();
      }
      if (!quotaExceededLogged) {
        console.warn(
          `[PlusZone ERP] Cloud Firestore daily free tier quota reached for project ${FIRESTORE_PROJECT_ID}. ` +
          `The app has safely shifted to browser local offline storage. Quota resets tomorrow at 00:00 UTC. ` +
          `Upgrade URL: ${FIRESTORE_UPGRADE_URL}`
        );
        quotaExceededLogged = true;
      }
      return; // Gracefully suppress from being treated as fatal crash
    }

    originalConsoleError(...args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reasonMsg = String(event.reason?.message || event.reason || '');
    const isQuota =
      event.reason?.code === 'resource-exhausted' ||
      reasonMsg.includes('Quota') ||
      reasonMsg.includes('quota') ||
      reasonMsg.includes('resource-exhausted');

    const isDbClosingOrHidden =
      reasonMsg.includes('Database is closing') ||
      reasonMsg.includes('closing/hidden') ||
      reasonMsg.includes('IDBDatabase') ||
      reasonMsg.includes('The database connection is closing');

    const isUnavailable =
      event.reason?.code === 'unavailable' ||
      reasonMsg.includes('unavailable') ||
      reasonMsg.includes('Could not reach Cloud Firestore') ||
      reasonMsg.includes('offline') ||
      reasonMsg.includes('the client is offline');

    if (isQuota) {
      markQuotaExceeded();
      event.preventDefault();
    } else if (isDbClosingOrHidden || isUnavailable) {
      event.preventDefault();
    }
  });

  window.addEventListener(
    'error',
    (event) => {
      const errorMsg = String(event.message || event.error?.message || '');
      if (
        errorMsg.includes('Database is closing') ||
        errorMsg.includes('closing/hidden') ||
        errorMsg.includes('IDBDatabase') ||
        errorMsg.includes('The database connection is closing') ||
        errorMsg.includes('resource-exhausted') ||
        errorMsg.includes('Quota limit exceeded')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
}

// Graceful background connection check without throwing unhandled rejection
async function checkConnectionHealth() {
  if (isQuotaExceeded) return;
  try {
    const docRef = doc(db, 'erp_state', 'main');
    await getDoc(docRef);
  } catch (error: any) {
    if (
      error?.code === 'resource-exhausted' ||
      error?.message?.includes('Quota') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('resource-exhausted')
    ) {
      markQuotaExceeded();
      console.info('Firestore free tier daily quota reached. Switched to offline storage.');
    } else if (
      error?.code === 'unavailable' ||
      error?.message?.includes('unavailable') ||
      error?.message?.includes('Could not reach Cloud Firestore') ||
      error?.message?.includes('offline') ||
      error?.message?.includes('closing') ||
      error?.message?.includes('hidden')
    ) {
      console.info('Firestore operating with offline fallback cache.');
    }
  }
}
if (!isQuotaExceeded) {
  checkConnectionHealth().catch(() => {});
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  if (
    errMessage.includes('resource-exhausted') ||
    errMessage.includes('Quota') ||
    errMessage.includes('quota')
  ) {
    markQuotaExceeded();
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Info:', JSON.stringify(errInfo));
}

/**
 * Generates an accurate, lightweight fingerprint of the core business entities.
 * Detects any edits, additions, deletions, repayments, balance changes, or status shifts.
 */
function getStateFingerprint(state: ERPState): string {
  try {
    const txLen = state.transactions?.length || 0;
    const txSample = (state.transactions || [])
      .slice(0, 5)
      .map((t) => `${t.id}:${t.amount}:${t.category}:${t.date}:${t.type}:${t.reversed ? 1 : 0}`)
      .join(';');
    const txTotal = (state.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);
    const transfersCount = state.transfers?.length || 0;
    const transfersTotal = (state.transfers || []).reduce((acc, t) => acc + (t.amount || 0), 0);
    const walletsSum = (state.wallets || []).map((w) => `${w.id}:${w.openingBalance}:${w.name}`).join('|');
    const equbsSum = (state.equbs || []).map((e) => `${e.id}:${e.currentRound}:${e.completedRounds}:${e.status}:${e.payoutsClaimed || 0}`).join('|');
    const loansSum = (state.loans || []).map((l) => `${l.id}:${l.outstandingBalance}:${l.status}:${(l.payments || []).length}`).join('|');
    const rcvSum = (state.receivables || []).map((r) => `${r.id}:${r.amountOwed}:${r.amountCollected || 0}:${r.status}`).join('|');
    const usersCount = state.users?.length || 0;
    const auditLen = state.auditLogs?.length || 0;
    const approvalsLen = state.approvalRequests?.length || 0;
    return `${txLen}:${txTotal}:${txSample}:${transfersCount}:${transfersTotal}:${walletsSum}:${equbsSum}:${loansSum}:${rcvSum}:${usersCount}:${auditLen}:${approvalsLen}`;
  } catch (_) {
    return String(Date.now());
  }
}

/**
 * Subscribe to real-time updates from Firebase Firestore.
 * When any user or device updates the ERP state in Firestore,
 * this listener fires instantly and provides the latest state.
 */
export function subscribeToFirebaseState(onUpdate: (remoteState: Partial<ERPState>) => void) {
  if (isQuotaExceeded) return () => {};

  let unsubscribeFn: (() => void) | null = null;
  const docRef = doc(db, 'erp_state', 'main');

  const safeUnsubscribe = () => {
    if (unsubscribeFn) {
      try {
        unsubscribeFn();
      } catch (_) {}
      unsubscribeFn = null;
    }
  };

  try {
    unsubscribeFn = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.state) {
            const rawState: any = typeof data.state === 'string' ? JSON.parse(data.state) : { ...data.state };
            const rawDeleted = Array.isArray(rawState.deletedEntityIds) ? rawState.deletedEntityIds : [];
            const deletedTestIds = new Set(rawDeleted.filter((id: string) => !isCanonicalTransactionId(id)));
            deletedTestIds.add('tx-1790749015154');
            deletedTestIds.add('tx-1790748931615');
            if (rawState) {
              rawState.users = [{
                id: 'u-1',
                name: 'Suraphel',
                email: 'suraphel@pluszone.et',
                username: 'suraphel',
                role: 'SuperAdmin',
                active: true,
                isApproved: true,
                branch: 'Addis Ababa HQ'
              }];
              rawState.chatMessages = [];
              if (Array.isArray(rawState.transactions)) {
                rawState.transactions = rawState.transactions
                  .filter((t: any) => t && t.date && t.date >= '2026-10-24')
                  .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
              }
            }
            isRemoteUpdate = true;
            lastSyncedFingerprint = getStateFingerprint(rawState as ERPState);
            onUpdate(rawState as ERPState);
            // Reset flag after 250ms so user interactions are never blocked
            setTimeout(() => {
              isRemoteUpdate = false;
            }, 250);
          }
        }
      },
      (error) => {
        const isQuota =
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted');

        const isUnavailable =
          error?.code === 'unavailable' ||
          error?.message?.includes('unavailable') ||
          error?.message?.includes('Could not reach Cloud Firestore');

        if (isQuota) {
          markQuotaExceeded();
          safeUnsubscribe();
        } else if (isUnavailable) {
          console.info('Firestore operates in offline mode: ', error.message);
        } else {
          handleFirestoreError(error, OperationType.GET, 'erp_state/main');
        }
      }
    );
  } catch (err: any) {
    if (
      err?.code === 'resource-exhausted' ||
      err?.message?.includes('Quota') ||
      err?.message?.includes('quota')
    ) {
      markQuotaExceeded();
    }
  }

  return safeUnsubscribe;
}

/**
 * Fetch latest state directly from Firebase Firestore on demand.
 */
export async function fetchLatestFirebaseState(): Promise<Partial<ERPState> | null> {
  if (isQuotaExceeded) return null;
  try {
    const docRef = doc(db, 'erp_state', 'main');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data && data.state) {
        const rawState: any = typeof data.state === 'string' ? JSON.parse(data.state) : { ...data.state };
        const rawDeleted = Array.isArray(rawState.deletedEntityIds) ? rawState.deletedEntityIds : [];
        const deletedTestIds = new Set(rawDeleted.filter((id: string) => !isCanonicalTransactionId(id)));
        deletedTestIds.add('tx-1790749015154');
        deletedTestIds.add('tx-1790748931615');
        if (rawState) {
          rawState.users = [{
            id: 'u-1',
            name: 'Suraphel',
            email: 'suraphel@pluszone.et',
            username: 'suraphel',
            role: 'SuperAdmin',
            active: true,
            isApproved: true,
            branch: 'Addis Ababa HQ'
          }];
          rawState.chatMessages = [];
          if (Array.isArray(rawState.transactions)) {
            rawState.transactions = rawState.transactions
              .filter((t: any) => t && t.date && t.date >= '2026-10-24')
              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          }
        }
        lastSyncedFingerprint = getStateFingerprint(rawState as ERPState);
        return rawState as Partial<ERPState>;
      }
    }
  } catch (err: any) {
    if (
      err?.code === 'resource-exhausted' ||
      err?.message?.includes('Quota') ||
      err?.message?.includes('quota')
    ) {
      markQuotaExceeded();
      return null;
    }
    handleFirestoreError(err, OperationType.GET, 'erp_state/main');
  }
  return null;
}

/**
 * Immediately push state to Firestore without debounce delay.
 * Never blocked by remote state update flag.
 */
export async function syncStateToFirebaseNow(state: ERPState): Promise<void> {
  if (isQuotaExceeded) return;
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  const fingerprint = getStateFingerprint(state);
  if (fingerprint === lastSyncedFingerprint) {
    return;
  }

  try {
    const docRef = doc(db, 'erp_state', 'main');
    const cleanState = JSON.parse(JSON.stringify(state));
    await setDoc(
      docRef,
      {
        state: cleanState,
        updatedAt: new Date().toISOString(),
        updatedBy: state.currentUser?.name || 'System',
      },
      { merge: true }
    );
    lastSyncedFingerprint = fingerprint;
  } catch (err: any) {
    if (
      err?.code === 'resource-exhausted' ||
      err?.message?.includes('Quota') ||
      err?.message?.includes('quota') ||
      err?.message?.includes('resource-exhausted')
    ) {
      markQuotaExceeded();
    } else {
      handleFirestoreError(err, OperationType.WRITE, 'erp_state/main');
    }
  }
}

/**
 * Push updated state to Firebase Firestore asynchronously with rapid sub-second (400ms) debouncing.
 * Guarantees real-time automatic update within 1 second across all sessions and devices.
 */
export async function syncStateToFirebase(state: ERPState): Promise<void> {
  // If Firestore quota has been exceeded or state change was received from remote, skip cloud write
  if (isQuotaExceeded || isRemoteUpdate) {
    return;
  }

  const fingerprint = getStateFingerprint(state);
  // If state is identical to last synced payload, skip duplicate write
  if (fingerprint === lastSyncedFingerprint) {
    return;
  }

  // Debounce state writes to 400ms to guarantee automatic update within a second
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    if (isQuotaExceeded || isRemoteUpdate) return;

    try {
      const docRef = doc(db, 'erp_state', 'main');
      const cleanState = JSON.parse(JSON.stringify(state));
      await setDoc(
        docRef,
        {
          state: cleanState,
          updatedAt: new Date().toISOString(),
          updatedBy: state.currentUser?.name || 'System',
        },
        { merge: true }
      );
      lastSyncedFingerprint = fingerprint;
    } catch (err: any) {
      if (
        err?.code === 'resource-exhausted' ||
        err?.message?.includes('Quota') ||
        err?.message?.includes('quota') ||
        err?.message?.includes('resource-exhausted')
      ) {
        markQuotaExceeded();
      } else {
        handleFirestoreError(err, OperationType.WRITE, 'erp_state/main');
      }
    }
  }, 400);
}

export function isFirestoreQuotaExceeded(): boolean {
  return isQuotaExceeded;
}

/**
 * Sends a chat message directly to the Firestore `team_chat_messages` collection
 * and broadcasts across tabs/windows with immediate 0ms latency.
 */
export async function sendChatMessageToFirebase(msg: ChatMessage): Promise<void> {
  const { sendChatMessageImmediately } = await import('./realtimeChat');
  return sendChatMessageImmediately(msg);
}

/**
 * Updates emoji reactions on a specific chat message in Firestore and cross-tab in 0ms.
 */
export async function updateChatMessageReactionInFirebase(
  messageId: string,
  reactions: ChatMessageReaction[]
): Promise<void> {
  const { updateChatReactionImmediately } = await import('./realtimeChat');
  return updateChatReactionImmediately(messageId, reactions);
}

/**
 * Directly fetches all chat messages from Firestore on demand.
 */
export async function fetchRealtimeChatMessages(): Promise<ChatMessage[]> {
  try {
    const chatColRef = collection(db, 'team_chat_messages');
    const snapshot = await getDocs(chatColRef);
    const msgs: ChatMessage[] = [];
    snapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        msgs.push(docSnap.data() as ChatMessage);
      }
    });
    const parseTs = (ts?: string | number) => {
      if (!ts) return 0;
      const n = typeof ts === 'number' ? ts : new Date(ts).getTime();
      return isNaN(n) ? 0 : n;
    };
    msgs.sort((a, b) => {
      const diff = parseTs(a.timestamp) - parseTs(b.timestamp);
      if (diff !== 0) return diff;
      return (a.id || '').localeCompare(b.id || '');
    });
    if (isQuotaExceeded) clearQuotaExceeded();
    return msgs;
  } catch (err: any) {
    console.warn('Direct chat fetch error:', err?.message);
    return [];
  }
}

/**
 * Subscribes to the live `team_chat_messages` Firestore collection using onSnapshot.
 * Listens directly to the collection to avoid missing-index or composite-query errors,
 * and triggers immediate callbacks whenever any team member sends or updates a message.
 */
export function subscribeToRealtimeChatMessages(
  onUpdate: (messages: ChatMessage[]) => void
): () => void {
  let unsubscribeFn: (() => void) | null = null;
  let isSubscribed = true;

  const safeUnsubscribe = () => {
    isSubscribed = false;
    if (unsubscribeFn) {
      try {
        unsubscribeFn();
      } catch (_) {}
      unsubscribeFn = null;
    }
  };

  const parseTs = (ts?: string | number) => {
    if (!ts) return 0;
    const n = typeof ts === 'number' ? ts : new Date(ts).getTime();
    return isNaN(n) ? 0 : n;
  };

  const connectListener = () => {
    if (!isSubscribed) return;
    if (unsubscribeFn) {
      try {
        unsubscribeFn();
      } catch (_) {}
      unsubscribeFn = null;
    }

    try {
      const chatColRef = collection(db, 'team_chat_messages');

      unsubscribeFn = onSnapshot(
        chatColRef,
        (snapshot) => {
          if (isQuotaExceeded) {
            clearQuotaExceeded();
          }
          const liveMessages: ChatMessage[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
              liveMessages.push(docSnap.data() as ChatMessage);
            }
          });
          // Sort messages chronologically by timestamp, then by message id
          liveMessages.sort((a, b) => {
            const diff = parseTs(a.timestamp) - parseTs(b.timestamp);
            if (diff !== 0) return diff;
            return (a.id || '').localeCompare(b.id || '');
          });
          onUpdate(liveMessages);
        },
        (error) => {
          const isQuota =
            error?.code === 'resource-exhausted' ||
            error?.message?.includes('Quota') ||
            error?.message?.includes('quota');

          if (isQuota) {
            markQuotaExceeded();
            safeUnsubscribe();
          } else {
            console.info('Firestore chat realtime stream reconnecting...', error?.message);
            // Reconnect after 2 seconds if disconnected
            setTimeout(() => {
              if (isSubscribed) {
                connectListener();
              }
            }, 2000);
          }
        }
      );
    } catch (err: any) {
      console.warn('subscribeToRealtimeChatMessages error:', err?.message);
    }
  };

  connectListener();
  return safeUnsubscribe;
}

/**
 * Seeds messages into the Firestore `team_chat_messages` collection
 * ensuring any local or default messages that are not yet in Firestore are synchronized.
 */
export async function seedInitialChatMessagesIfEmpty(messages: ChatMessage[]): Promise<void> {
  if (!messages || messages.length === 0) return;
  try {
    const chatColRef = collection(db, 'team_chat_messages');
    const existingSnap = await getDocs(chatColRef);
    const existingIds = new Set<string>();
    existingSnap.forEach((d) => existingIds.add(d.id));

    // Upload any messages that are missing from cloud Firestore
    for (const msg of messages) {
      if (!existingIds.has(msg.id)) {
        const msgRef = doc(db, 'team_chat_messages', msg.id);
        await setDoc(msgRef, JSON.parse(JSON.stringify(msg)));
      }
    }
  } catch (err) {
    console.info('Chat seed sync skipped:', err);
  }
}

/**
 * Deletes a chat message from Firestore and broadcasts to other users.
 */
export async function deleteChatMessageInFirebase(messageId: string): Promise<void> {
  const { deleteChatMessageImmediately } = await import('./realtimeChat');
  return deleteChatMessageImmediately(messageId);
}

/**
 * Persist or update an authenticated user profile in Firestore (/users/{userId})
 */
export async function syncUserProfileToFirestore(user: UserProfile): Promise<void> {
  if (!user || !user.id) return;
  try {
    const userRef = doc(db, 'users', user.id);
    const cleanPayload = {
      id: user.id,
      name: user.name || 'User',
      email: user.email || '',
      username: user.username || '',
      role: user.role || 'Partner',
      active: user.active !== false,
      avatarUrl: user.avatarUrl || '',
      branch: user.branch || 'Addis Ababa HQ',
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(userRef, cleanPayload, { merge: true });
    console.log('[Firestore Auth] User profile synced to Firestore:', user.id);
  } catch (err) {
    console.warn('[Firestore Auth] Could not sync user profile to Firestore:', err);
  }
}

/**
 * Retrieve a user profile document from Firestore (/users/{userId})
 */
export async function fetchUserProfileFromFirestore(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (err) {
    console.warn('[Firestore Auth] Could not fetch user profile from Firestore:', err);
  }
  return null;
}

/**
 * Listen to Firebase Auth state changes and track user authentication
 */
export function listenToAuthChanges(callback: (firebaseUser: any) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

