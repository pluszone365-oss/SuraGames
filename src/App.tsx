import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import {
  initPwaServiceWorker,
  initFileHandlingConsumer,
  extractShareTargetPayload,
  extractProtocolUrl,
  isNoteTakingAction,
  extractShortcut
} from './lib/pwaSync';
import { Header } from './components/layout/Header';
import { BottomNav, TabType } from './components/layout/BottomNav';
import { QuickEntryModal } from './components/modals/QuickEntryModal';
import { TransferModal } from './components/modals/TransferModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { WalletsView } from './components/wallets/WalletsView';
import { EqubView } from './components/equb/EqubView';
import { MoreHubView, SubViewType } from './components/more/MoreHubView';
import { ChatView } from './components/chat/ChatView';
import { AiAssistantWidget } from './components/ai/AiAssistantWidget';
import { LoginPage } from './components/auth/LoginPage';
import { OnboardingTour, ONBOARDING_STORAGE_KEY } from './components/onboarding/OnboardingTour';
import { PageHelpModal } from './components/help/PageHelpModal';
import { getPageTourSteps, FULL_APP_TOUR_STEPS, TourStep } from './components/onboarding/onboardingSteps';
import { FirestoreQuotaBanner } from './components/common/FirestoreQuotaBanner';

import {
  ERPState,
  loadInitialState,
  saveStateToStorage,
  DEFAULT_TRANSACTIONS,
  calculateWalletBalance,
  isTransactionEditable,
  formatETB,
  mergeListById,
  mergeChatMessages,
  syncReceivablesLateStatus,
  getWalletNickname,
  consolidateEqubSplitTransactions,
  isEqubContributionTransaction,
  isEqubPayoutTransaction,
  findMatchingEqub,
  revertEqubForDeletedContribution,
  revertEqubForDeletedPayout,
  getTransactionDisplayTitle,
  isCanonicalTransactionId,
  syncRecurringWithTransaction,
  syncEqubWithTransaction
} from './lib/store';
import { calculateNextEthiopianDueDate } from './lib/ethiopianCalendar';
import {
  subscribeToFirebaseState,
  syncStateToFirebase,
  syncStateToFirebaseNow,
  fetchLatestFirebaseState,
  fetchRealtimeChatMessages,
  clearQuotaExceeded,
  isFirestoreQuotaExceeded,
  sendChatMessageToFirebase,
  updateChatMessageReactionInFirebase,
  subscribeToRealtimeChatMessages,
  seedInitialChatMessagesIfEmpty
} from './lib/firebase';
import {
  sendChatMessageImmediately,
  updateChatReactionImmediately,
  deleteChatMessageImmediately,
  registerChatEventListener
} from './lib/realtimeChat';
import { Transaction, Transfer, Wallet, UserProfile, TransactionType, Equb, NavTab, Receivable, Loan, LoanPayment, AdminApprovalRequest, ChatMessage, ChatMessageReaction, ChatChannel, AuditLogEntry, ShopOperatingHours } from './types';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { triggerHaptic } from './lib/haptics';
import { SessionLockModal } from './components/auth/SessionLockModal';
import { AppSplashScreen } from './components/common/AppSplashScreen';
import { sendExternalNotification, formatRelativeNotifTime, playNotificationSound } from './lib/notifications';
import {
  saveAuthSession,
  getActiveAuthSession,
  clearAuthSession,
  updateAuthSessionUser
} from './lib/authSession';

export default function App() {
  const [showSplashScreen, setShowSplashScreen] = useState<boolean>(true);
  const [state, setState] = useState<ERPState>(() => loadInitialState());
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [moreSubView, setMoreSubView] = useState<SubViewType>('HUB');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const session = getActiveAuthSession();
    if (!session) return false;
    if (session.name === 'Suraphel' || session.username === 'suraphel') {
      return true;
    }
    clearAuthSession();
    return false;
  });
  const [isSessionLocked, setIsSessionLocked] = useState<boolean>(false);

  const handleLogout = useCallback(() => {
    clearAuthSession();
    setIsLoggedIn(false);
    setIsSessionLocked(false);
  }, []);

  // Validate active auth session against current state users
  useEffect(() => {
    if (isLoggedIn) {
      const session = getActiveAuthSession();
      if (!session) {
        setIsLoggedIn(false);
        return;
      }
      const matched = state.users.find(
        (u) =>
          u.id === session.userId ||
          (session.email && u.email?.toLowerCase() === session.email.toLowerCase())
      );
      if (matched) {
        if (matched.active === false || matched.isApproved === false) {
          clearAuthSession();
          setIsLoggedIn(false);
        } else if (state.currentUser.id !== matched.id) {
          setState((prev) => ({ ...prev, currentUser: matched }));
        }
      } else if (session.user) {
        // If matched user is not yet in state.users, preserve remembered session user profile
        setState((prev) => ({
          ...prev,
          currentUser: session.user!,
          users: prev.users.some(u => u.id === session.user!.id) ? prev.users : [...prev.users, session.user!]
        }));
      }
    }
  }, [isLoggedIn, state.users, state.currentUser.id]);
  const [lastSeenChatTime, setLastSeenChatTime] = useState<number>(() => {
    const saved = localStorage.getItem('pgz_last_read_chat_time');
    return saved ? parseInt(saved, 10) : Date.now();
  });

  const markChatAsRead = useCallback(() => {
    const now = Date.now();
    setLastSeenChatTime(now);
    try {
      localStorage.setItem('pgz_last_read_chat_time', now.toString());
    } catch (e) {}
  }, []);

  const handleNavigateTab = (tab: TabType, subView?: SubViewType | string) => {
    setActiveTab(tab);
    if (tab === 'chat') {
      markChatAsRead();
    }
    if (tab === 'more') {
      const raw = subView || 'HUB';
      const upper = raw.toUpperCase() as SubViewType;
      setMoreSubView(upper);
    }
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      markChatAsRead();
    }
  }, [activeTab, state.chatMessages?.length, markChatAsRead]);

  // Modals
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [quickEntryWalletId, setQuickEntryWalletId] = useState<string | undefined>(undefined);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [sharedSmsPrefill, setSharedSmsPrefill] = useState<string | null>(null);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiAssistantPrompt, setAiAssistantPrompt] = useState<string | undefined>(undefined);
  const [aiAssistantMode, setAiAssistantMode] = useState<'chat' | 'simulator'>('chat');

  const handleOpenAiAssistant = (
    prompt?: string,
    initialMode: 'chat' | 'simulator' = 'chat'
  ) => {
    setAiAssistantPrompt(prompt);
    setAiAssistantMode(initialMode);
    setShowAiAssistant(true);
  };

  // Auto Refresh State
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Onboarding Spotlight Tour & Help State
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [tourStepIndex, setTourStepIndex] = useState<number>(0);
  const [activeTourSteps, setActiveTourSteps] = useState<TourStep[] | undefined>(undefined);
  const [activeTourTitle, setActiveTourTitle] = useState<string | undefined>(undefined);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

  const handleOpenHelp = useCallback((tabOrSubView?: any, maybeSubView?: string) => {
    setIsHelpModalOpen(false);
    triggerHaptic('medium');

    let targetTab: NavTab = activeTab;
    let targetSubView: string = moreSubView;

    if (typeof tabOrSubView === 'string') {
      if (['dashboard', 'transactions', 'wallets', 'equb', 'chat', 'more'].includes(tabOrSubView)) {
        targetTab = tabOrSubView as NavTab;
        if (maybeSubView !== undefined) targetSubView = maybeSubView;
      } else {
        targetTab = activeTab;
        targetSubView = tabOrSubView;
      }
    }

    const { steps, title } = getPageTourSteps(targetTab, targetSubView);
    setActiveTourSteps(steps);
    setActiveTourTitle(title);
    setTourStepIndex(0);
    setIsTourActive(true);
  }, [activeTab, moreSubView]);

  const handleStartTour = useCallback(() => {
    setActiveTourSteps(undefined);
    setActiveTourTitle('Dashboard Walkthrough');
    setTourStepIndex(0);
    setActiveTab('dashboard');
    setIsTourActive(true);
  }, []);

  const handleStartPageTour = useCallback((tab: NavTab, subView?: string) => {
    setIsHelpModalOpen(false);
    handleNavigateTab(tab, subView);
    const { steps, title } = getPageTourSteps(tab, subView);
    setActiveTourSteps(steps);
    setActiveTourTitle(title);
    setTourStepIndex(0);
    setIsTourActive(true);
  }, []);

  const handleStartFullAppTour = useCallback(() => {
    setIsHelpModalOpen(false);
    handleNavigateTab('dashboard');
    setActiveTourSteps(FULL_APP_TOUR_STEPS);
    setActiveTourTitle('Full PlusZone Business Tour');
    setTourStepIndex(0);
    setIsTourActive(true);
  }, []);

  const handleCloseTour = useCallback(() => {
    setIsTourActive(false);
  }, []);

  const handleCompleteTour = useCallback(() => {
    setIsTourActive(false);
    try {
      localStorage.setItem(`has_seen_onboarding_${state.currentUser.id}`, 'true');
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch (e) {}
    setState(prev => ({
      ...prev,
      currentUser: {
        ...prev.currentUser,
        has_seen_onboarding: true
      },
      users: prev.users.map(u => u.id === prev.currentUser.id ? { ...u, has_seen_onboarding: true } : u)
    }));
  }, [state.currentUser.id]);

  // First-time onboarding tour auto-trigger check for newly logged-in users
  useEffect(() => {
    if (isLoggedIn && !isSessionLocked && !showSplashScreen) {
      const storedSeen = localStorage.getItem(`has_seen_onboarding_${state.currentUser.id}`) || localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!state.currentUser.has_seen_onboarding && !storedSeen) {
        const timer = setTimeout(() => {
          setIsTourActive(true);
          setTourStepIndex(0);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoggedIn, isSessionLocked, showSplashScreen, state.currentUser.id, state.currentUser.has_seen_onboarding]);

  // Specific Confirmation Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Periodic ticker so relative notification times and time-sensitive alerts auto-update automatically
  const [autoNotificationTicker, setAutoNotificationTicker] = useState<number>(() => Date.now());
  useEffect(() => {
    const ticker = setInterval(() => {
      setAutoNotificationTicker(Date.now());
    }, 10000);
    return () => clearInterval(ticker);
  }, []);

  // Dismissed Notifications Tracking (Persisted in localStorage so seen notifications stay removed)
  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pluszone_dismissed_notif_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Banking Inactivity Auto-Lock Timeout logic (0 = disabled to preserve continuous active session)
  const [sessionTimeoutMins, setSessionTimeoutMins] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pluszone_session_timeout_mins');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const lastActivityRef = React.useRef<number>(Date.now());
  const lastCollectRef = React.useRef<{ id: string; amount: number; time: number } | null>(null);

  // Listen for session timeout settings changes
  useEffect(() => {
    const handleTimeoutChange = () => {
      try {
        const saved = localStorage.getItem('pluszone_session_timeout_mins');
        if (saved !== null) setSessionTimeoutMins(parseInt(saved, 10));
      } catch (err) {
        console.warn('Error reading session timeout config', err);
      }
    };
    window.addEventListener('sessionTimeoutChanged', handleTimeoutChange);
    return () => window.removeEventListener('sessionTimeoutChanged', handleTimeoutChange);
  }, []);

  // Monitor user activity and auto-lock after timeout
  useEffect(() => {
    if (!isLoggedIn || isSessionLocked || sessionTimeoutMins <= 0) return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      const elapsedMins = (Date.now() - lastActivityRef.current) / 60000;
      if (elapsedMins >= sessionTimeoutMins) {
        setIsSessionLocked(true);
        triggerHaptic('warning');
        setToastMessage(`Banking Session Locked: ${sessionTimeoutMins} min inactivity timeout.`);
        setTimeout(() => setToastMessage(null), 5000);
      }
    }, 5000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetActivity));
      clearInterval(checkInterval);
    };
  }, [isLoggedIn, isSessionLocked, sessionTimeoutMins]);

  useEffect(() => {
    try {
      localStorage.setItem('pluszone_dismissed_notif_ids', JSON.stringify(dismissedNotifIds));
    } catch (err) {
      console.warn('Failed to save dismissed notifications to storage', err);
    }
  }, [dismissedNotifIds]);

  const handleDismissNotification = React.useCallback((id: string) => {
    setDismissedNotifIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  // Active sync on mount: Immediately push pristine clean baseline to Firebase Firestore ({ merge: false })
  useEffect(() => {
    syncStateToFirebaseNow(state, true);
  }, []);

  // Real-time Firebase Firestore Subscription & Chat Notifications
  const prevChatCountRef = useRef<number>(0);
  const prevTxCountRef = useRef<number>(0);
  const locallySentMsgIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Ensure any stale quota lockout is cleared so multi-device sync connects immediately
    clearQuotaExceeded();

    const unsubscribe = subscribeToFirebaseState((remoteState) => {
      if (remoteState && typeof remoteState === 'object') {
        setState(prev => {
          const remoteDeletedIds = (Array.isArray(remoteState.deletedEntityIds) ? remoteState.deletedEntityIds : []).filter(id => !isCanonicalTransactionId(id));
          const localDeletedIds = (Array.isArray(prev.deletedEntityIds) ? prev.deletedEntityIds : []).filter(id => !isCanonicalTransactionId(id));
          const combinedDeletedIds = Array.from(new Set([...localDeletedIds, ...remoteDeletedIds]));

          const mergedUsers = mergeListById(prev.users, remoteState.users, combinedDeletedIds);
          const mergedWallets = mergeListById(prev.wallets, remoteState.wallets, combinedDeletedIds)
            .filter((w: Wallet) => !['w-telebirr', 'w-cbe', 'w-ebirr', 'w-cash', 'w-savings'].includes(w.id));
          const mergedTransactions = mergeListById(prev.transactions, remoteState.transactions, combinedDeletedIds)
            .filter((t: Transaction) => !t.id?.startsWith('tx-start-') && !t.id?.startsWith('tx-20261019'));
          const mergedTransfers = mergeListById(prev.transfers, remoteState.transfers, combinedDeletedIds);
          const mergedEqubs = mergeListById(prev.equbs, remoteState.equbs, combinedDeletedIds);
          const mergedLoans = mergeListById(prev.loans, remoteState.loans, combinedDeletedIds);
          const mergedAssets = mergeListById(prev.assets, remoteState.assets, combinedDeletedIds);
          const mergedGoals = mergeListById(prev.goals, remoteState.goals, combinedDeletedIds);
          const mergedRecurring = mergeListById(prev.recurring, remoteState.recurring, combinedDeletedIds);
          const mergedReceivables = syncReceivablesLateStatus(mergeListById(prev.receivables, remoteState.receivables, combinedDeletedIds));
          const mergedCategories = mergeListById(prev.categories, remoteState.categories, combinedDeletedIds);
          const mergedAuditLogs = mergeListById(prev.auditLogs, remoteState.auditLogs, combinedDeletedIds);
          const mergedPending = mergeListById(prev.pendingReviewTransactions, remoteState.pendingReviewTransactions, combinedDeletedIds);
          const mergedChatMessages = mergeChatMessages(
            prev.chatMessages || [],
            remoteState.chatMessages || []
          );
          const mergedChatChannels = mergeListById(
            prev.chatChannels || [],
            remoteState.chatChannels || [],
            combinedDeletedIds
          );

          const activeUser = (prev.currentUser?.email
            ? mergedUsers.find(u => u.email.toLowerCase() === prev.currentUser.email.toLowerCase())
            : null) || (prev.currentUser?.id
            ? mergedUsers.find(u => u.id === prev.currentUser.id)
            : null) || prev.currentUser;

          const userCalPref = (typeof window !== 'undefined' ? localStorage.getItem('pluszone_calendar_user_choice') : null) as 'ETHIOPIAN' | 'GREGORIAN' | null;
          const calType = userCalPref || prev.calendarType || remoteState.calendarType || 'GREGORIAN';

          // Check for new chat messages from other team members
          const incomingMsgs = mergedChatMessages || [];
          if (incomingMsgs.length > prevChatCountRef.current && prevChatCountRef.current > 0) {
            const latestMsg = incomingMsgs[incomingMsgs.length - 1];
            if (latestMsg && latestMsg.senderId !== activeUser.id) {
              playNotificationSound('chat');
              triggerHaptic('medium');
              sendExternalNotification(`Team Chat • ${latestMsg.senderName}`, {
                body: latestMsg.text || 'Sent an attachment or financial reference.',
                tag: `chat-${latestMsg.id}`
              });
            }
          }
          prevChatCountRef.current = incomingMsgs.length;

          // Check for newly logged transactions from other team members
          const incomingTxs = mergedTransactions || [];
          if (prevTxCountRef.current > 0 && incomingTxs.length > prevTxCountRef.current) {
            const prevIds = new Set(prev.transactions.map(t => t.id));
            const newTxs = incomingTxs.filter(t => !prevIds.has(t.id));
            if (newTxs.length > 0) {
              const latestTx = newTxs[0];
              if (latestTx.creatorName !== activeUser.name) {
                playNotificationSound('alert');
                triggerHaptic('medium');
                sendExternalNotification(`PlusZone ERP • New Transaction 💰`, {
                  body: `${latestTx.creatorName}: ${latestTx.description} (${latestTx.type === 'INCOME' ? '+' : '-'}${formatETB(latestTx.amount)})`,
                  tag: `tx-${latestTx.id}`
                });
                triggerToast(`🔔 Live Ledger: ${latestTx.type === 'INCOME' ? '+' : '-'}${formatETB(latestTx.amount)} by ${latestTx.creatorName}`);
              }
            }
          }
          prevTxCountRef.current = incomingTxs.length;

          return {
            ...prev,
            ...remoteState,
            deletedEntityIds: combinedDeletedIds,
            transactions: mergedTransactions,
            wallets: mergedWallets,
            receivables: mergedReceivables,
            equbs: mergedEqubs,
            loans: mergedLoans,
            assets: mergedAssets,
            goals: mergedGoals,
            recurring: mergedRecurring,
            categories: mergedCategories,
            transfers: mergedTransfers,
            auditLogs: mergedAuditLogs,
            pendingReviewTransactions: mergedPending,
            chatMessages: mergedChatMessages,
            chatChannels: mergedChatChannels,
            calendarType: calType,
            users: mergedUsers,
            currentUser: activeUser
          };
        });
      }
    });

    // Dedicated real-time instant Firestore subscription for live Team Chat
    const unsubscribeChat = subscribeToRealtimeChatMessages((liveMessages) => {
      if (Array.isArray(liveMessages) && liveMessages.length > 0) {
        setState((prev) => {
          const currentMsgs = prev.chatMessages || [];
          const existingIds = new Set(currentMsgs.map((m) => m.id));
          const brandNewMsgs = liveMessages.filter((m) => !existingIds.has(m.id));

          // When a new message from another user arrives live: chime and notify!
          if (brandNewMsgs.length > 0) {
            const incomingFromOtherDevice = brandNewMsgs.filter(
              m => !locallySentMsgIdsRef.current.has(m.id) && m.senderId !== prev.currentUser.id
            );
            if (incomingFromOtherDevice.length > 0) {
              const latestNew = incomingFromOtherDevice[incomingFromOtherDevice.length - 1];
              playNotificationSound('chat');
              triggerHaptic('medium');
              sendExternalNotification(`Team Chat • ${latestNew.senderName}`, {
                body: latestNew.text || 'Sent an attachment or financial reference.',
                tag: `chat-${latestNew.id}`
              });
            }
          }

          const merged = mergeChatMessages(currentMsgs, liveMessages);

          prevChatCountRef.current = merged.length;
          const updatedState = {
            ...prev,
            chatMessages: merged
          };
          saveStateToStorage(updatedState);
          return updatedState;
        });
      }
    });

    // Dedicated 0ms cross-tab/cross-window broadcast channel listener for multi-user testing
    const unsubscribeBroadcast = registerChatEventListener((event) => {
      if (event.type === 'NEW_MESSAGE') {
        const incomingMsg = event.message;
        setState((prev) => {
          const currentMsgs = prev.chatMessages || [];
          if (currentMsgs.some((m) => m.id === incomingMsg.id)) {
            return prev;
          }

          // If incoming from another user, chime and notify immediately
          if (incomingMsg.senderId !== prev.currentUser.id) {
            playNotificationSound('chat');
            triggerHaptic('medium');
            sendExternalNotification(`Team Chat • ${incomingMsg.senderName}`, {
              body: incomingMsg.text || 'Sent an attachment or financial reference.',
              tag: `chat-${incomingMsg.id}`
            });
          }

          const merged = mergeChatMessages(currentMsgs, [incomingMsg]);
          const updatedState = { ...prev, chatMessages: merged };
          saveStateToStorage(updatedState);
          return updatedState;
        });
      } else if (event.type === 'UPDATE_REACTIONS') {
        setState((prev) => {
          const currentMsgs = prev.chatMessages || [];
          const updated = currentMsgs.map((m) =>
            m.id === event.messageId ? { ...m, reactions: event.reactions } : m
          );
          const updatedState = { ...prev, chatMessages: updated };
          saveStateToStorage(updatedState);
          return updatedState;
        });
      } else if (event.type === 'DELETE_MESSAGE') {
        setState((prev) => {
          const currentMsgs = prev.chatMessages || [];
          const updated = currentMsgs.filter((m) => m.id !== event.messageId);
          const updatedState = { ...prev, chatMessages: updated };
          saveStateToStorage(updatedState);
          return updatedState;
        });
      }
    });

    // Immediately fetch full cloud chat history from Firestore on app load
    fetchRealtimeChatMessages().then((cloudMsgs) => {
      if (Array.isArray(cloudMsgs) && cloudMsgs.length > 0) {
        setState((prev) => {
          const merged = mergeChatMessages(prev.chatMessages || [], cloudMsgs);
          const updatedState = { ...prev, chatMessages: merged };
          saveStateToStorage(updatedState);
          return updatedState;
        });
      }
    }).catch(() => {});

    // Reconcile and seed existing local chat messages to Firestore if missing
    if (state.chatMessages && state.chatMessages.length > 0) {
      seedInitialChatMessagesIfEmpty(state.chatMessages);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeChat) unsubscribeChat();
      if (unsubscribeBroadcast) unsubscribeBroadcast();
    };
  }, []);

  // Sync state to local storage, Firebase, and document root theme class on change
  useEffect(() => {
    saveStateToStorage(state);
    syncStateToFirebase(state);
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // PWA Service Worker, Background Sync & Native APIs (File Handlers, Share Target, Protocol Handlers)
  useEffect(() => {
    const unbind = initPwaServiceWorker((tag) => {
      triggerToast(`⚡ Background Sync executed: ${tag}`);
    });

    // File Handling API consumer:
    initFileHandlingConsumer((file, content, ext) => {
      if (ext === 'json') {
        try {
          const parsed = JSON.parse(content);
          if (parsed.transactions && Array.isArray(parsed.transactions)) {
            setState((prev) => ({
              ...prev,
              transactions: mergeListById(prev.transactions, parsed.transactions)
            }));
            triggerToast(`📁 File Handler imported ${parsed.transactions.length} transactions from ${file.name}`);
          }
        } catch {
          triggerToast(`⚠️ Could not parse JSON file: ${file.name}`);
        }
      } else {
        triggerToast(`📁 File Handler opened: ${file.name}`);
      }
    });

    // Web Share Target: incoming SMS or receipt text
    const sharePayload = extractShareTargetPayload();
    if (sharePayload && sharePayload.text) {
      setSharedSmsPrefill(sharePayload.text);
      setShowQuickEntry(true);
      triggerToast('📲 Incoming payment SMS received via Share Target!');
    }

    // App Shortcuts
    const shortcut = extractShortcut();
    if (shortcut === 'transaction') {
      setShowQuickEntry(true);
    } else if (shortcut === 'gaming') {
      setActiveTab('dashboard');
    } else if (shortcut === 'wallets') {
      setActiveTab('wallets');
    }

    // Protocol Handlers (web+pluszone://..., web+equb://...)
    const protocolUrl = extractProtocolUrl();
    if (protocolUrl) {
      if (protocolUrl.includes('equb')) {
        setActiveTab('equb');
      } else {
        setActiveTab('transactions');
      }
      triggerToast(`🔗 Custom protocol link: ${protocolUrl}`);
    }

    // Quick Note Taking (?action=new-note)
    if (isNoteTakingAction()) {
      setActiveTab('more');
      setMoreSubView('CATEGORIES');
      triggerToast('📝 Quick note taking launched');
    }

    return () => {
      unbind();
    };
  }, []);

  // Auto Refresh Execution
  const performRefresh = async (isManual = false) => {
    setIsRefreshing(true);
    if (isManual) triggerHaptic('light');

    // If Firestore quota is exceeded and this is a background automated refresh, skip remote query
    if (isFirestoreQuotaExceeded() && !isManual) {
      setLastRefreshedAt(new Date());
      setIsRefreshing(false);
      return;
    }

    // 1. Fetch latest remote state and real-time chat messages directly from Firebase Firestore
    const [remoteState, remoteChatMessages] = await Promise.all([
      fetchLatestFirebaseState(),
      fetchRealtimeChatMessages()
    ]);

    if (remoteState && typeof remoteState === 'object') {
      setState(prev => {
        const remoteDeletedIds = Array.isArray(remoteState.deletedEntityIds) ? remoteState.deletedEntityIds : [];
        const localDeletedIds = Array.isArray(prev.deletedEntityIds) ? prev.deletedEntityIds : [];
        const combinedDeletedIds = Array.from(new Set([...localDeletedIds, ...remoteDeletedIds]));

        const mergedUsers = mergeListById(prev.users, remoteState.users, combinedDeletedIds);
        const mergedWallets = mergeListById(prev.wallets, remoteState.wallets, combinedDeletedIds)
          .filter((w: Wallet) => !['w-telebirr', 'w-cbe', 'w-ebirr', 'w-cash', 'w-savings'].includes(w.id));
        const mergedTransactions = mergeListById(prev.transactions, remoteState.transactions, combinedDeletedIds)
          .filter((t: Transaction) => !t.id?.startsWith('tx-start-') && !t.id?.startsWith('tx-20261019'));
        const mergedTransfers = mergeListById(prev.transfers, remoteState.transfers, combinedDeletedIds);
        const mergedEqubs = mergeListById(prev.equbs, remoteState.equbs, combinedDeletedIds);
        const mergedLoans = mergeListById(prev.loans, remoteState.loans, combinedDeletedIds);
        const mergedAssets = mergeListById(prev.assets, remoteState.assets, combinedDeletedIds);
        const mergedGoals = mergeListById(prev.goals, remoteState.goals, combinedDeletedIds);
        const mergedRecurring = mergeListById(prev.recurring, remoteState.recurring, combinedDeletedIds);
        const mergedReceivables = syncReceivablesLateStatus(mergeListById(prev.receivables, remoteState.receivables, combinedDeletedIds));
        const mergedCategories = mergeListById(prev.categories, remoteState.categories, combinedDeletedIds);
        const mergedAuditLogs = mergeListById(prev.auditLogs, remoteState.auditLogs, combinedDeletedIds);
        const mergedPending = mergeListById(prev.pendingReviewTransactions, remoteState.pendingReviewTransactions, combinedDeletedIds);
        const mergedChat = mergeChatMessages(
          prev.chatMessages || [],
          remoteChatMessages && remoteChatMessages.length > 0
            ? remoteChatMessages
            : remoteState.chatMessages || []
        );

        const activeUser = (prev.currentUser?.email
          ? mergedUsers.find(u => u.email.toLowerCase() === prev.currentUser.email.toLowerCase())
          : null) || (prev.currentUser?.id
          ? mergedUsers.find(u => u.id === prev.currentUser.id)
          : null) || prev.currentUser;
        const userCalPref = (typeof window !== 'undefined' ? localStorage.getItem('pluszone_calendar_user_choice') : null) as 'ETHIOPIAN' | 'GREGORIAN' | null;
        const calType = userCalPref || prev.calendarType || remoteState.calendarType || 'GREGORIAN';

        const updated = {
          ...prev,
          ...remoteState,
          deletedEntityIds: combinedDeletedIds,
          users: mergedUsers,
          wallets: mergedWallets,
          transactions: mergedTransactions,
          transfers: mergedTransfers,
          equbs: mergedEqubs,
          loans: mergedLoans,
          assets: mergedAssets,
          goals: mergedGoals,
          recurring: mergedRecurring,
          receivables: mergedReceivables,
          categories: mergedCategories,
          auditLogs: mergedAuditLogs,
          pendingReviewTransactions: mergedPending,
          chatMessages: mergedChat,
          calendarType: calType,
          currentUser: activeUser
        };
        saveStateToStorage(updated);
        return updated;
      });
    } else if (remoteChatMessages && remoteChatMessages.length > 0) {
      setState(prev => {
        const mergedChat = mergeChatMessages(prev.chatMessages || [], remoteChatMessages);
        const updated = { ...prev, chatMessages: mergedChat };
        saveStateToStorage(updated);
        return updated;
      });
    }

    // 2. Auto-check for active recurring templates due today or earlier and auto-process if enabled
    const todayStr = new Date().toISOString().split('T')[0];
    setState(prev => {
      let updatedTransactions = [...prev.transactions];
      let updatedAudit = [...prev.auditLogs];
      let updatedRecurring = [...prev.recurring];
      let processedAny = false;

      updatedRecurring = updatedRecurring.map(rec => {
        if (rec.status === 'ACTIVE' && rec.autoProcess && rec.nextDueDate <= todayStr) {
          processedAny = true;
          const newTx: Transaction = {
            id: `tx-auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: todayStr,
            type: rec.type,
            amount: rec.amount,
            walletId: rec.walletId,
            category: rec.category,
            description: `Auto-Processed Recurring: ${rec.title}`,
            creatorId: 'system',
            creatorName: 'Automated System',
            branch: prev.currentUser.branch
          };
          updatedTransactions.unshift(newTx);

          const nextDateObj = calculateNextEthiopianDueDate(rec.nextDueDate || todayStr, rec.frequency);

          return {
            ...rec,
            lastProcessedDate: todayStr,
            nextDueDate: nextDateObj.toISOString().split('T')[0]
          };
        }
        return rec;
      });

      if (processedAny) {
        updatedAudit.unshift({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'PROCESS_RECURRING',
          entity: 'RecurringTemplate',
          entityId: 'auto',
          diffAfter: { processedAt: todayStr },
          branch: prev.currentUser.branch
        });

        const updated = {
          ...prev,
          transactions: updatedTransactions,
          recurring: updatedRecurring,
          auditLogs: updatedAudit
        };
        saveStateToStorage(updated);
        if (!isFirestoreQuotaExceeded()) {
          syncStateToFirebaseNow(updated);
        }
        return updated;
      }
      return prev;
    });

    setLastRefreshedAt(new Date());
    setIsRefreshing(false);
  };

  // Background Auto-Refresh Timer (every 60 seconds, paused during quota limit)
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      if (isFirestoreQuotaExceeded()) return;
      performRefresh(false);
    }, 60000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled]);

  // 1. Post Transaction (Supports standard Income/Expense, Equb Contributions & Sale on Credit / Customer Debt)
  const handlePostTransaction = (data: {
    type: TransactionType;
    amount: number;
    walletId: string;
    category: string;
    description: string;
    date: string;
    isCreditSale?: boolean;
    customerName?: string;
    dueDate?: string;
    expenseScope?: 'BUSINESS' | 'PERSONAL';
    refType?: Transaction['refType'];
    refId?: string;
    splits?: Array<{ walletId: string; amount: number }>;
  }) => {
    const targetWallet = state.wallets.find(w => w.id === data.walletId);

    // If Sale on Credit is toggled, only record the Receivable debt entry without posting uncollected money to the wallet ledger
    if (data.isCreditSale && data.customerName) {
      const newReceivable: Receivable = {
        id: `rcv-${Date.now()}`,
        customerName: data.customerName,
        description: data.description || `Credit Sale - ${data.category}`,
        amountOwed: data.amount,
        amountCollected: 0,
        status: 'OUTSTANDING',
        dueDate: data.dueDate || new Date(Date.now() + 86400000 * 14).toISOString(),
        createdDate: data.date || new Date().toISOString(),
        walletId: undefined
      };

      const newAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorId: state.currentUser.id,
        actorName: state.currentUser.name,
        action: 'CREATE_RECEIVABLE',
        entity: 'Receivable',
        entityId: newReceivable.id,
        diffAfter: {
          customerName: data.customerName,
          amountOwed: data.amount,
          category: data.category,
          dueDate: newReceivable.dueDate,
          isCreditSale: true
        },
        branch: state.currentUser.branch
      };

      setState(prev => ({
        ...prev,
        receivables: [newReceivable, ...prev.receivables],
        auditLogs: [newAuditLog, ...prev.auditLogs]
      }));

      triggerToast(`📋 Credit Sale recorded for ${data.customerName}! Saved to Receivables ledger (Wallet balance unchanged until collected).`);
      sendExternalNotification('PlusZone ERP - Credit Sale 📋', {
        body: `Credit Sale of ${formatETB(data.amount)} recorded for customer ${data.customerName}. Money will enter wallet when collected.`
      });
      performRefresh(true);
      return;
    }

    const determinedScope = data.type === 'EXPENSE'
      ? (data.expenseScope || 'BUSINESS')
      : undefined;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: data.date,
      type: data.type,
      amount: data.amount,
      walletId: data.walletId,
      category: data.category,
      description: data.description,
      expenseScope: determinedScope,
      creatorId: state.currentUser.id,
      creatorName: state.currentUser.name,
      branch: state.currentUser.branch,
      refType: data.refType,
      refId: data.refId,
      splits: data.splits && data.splits.length > 0 ? data.splits : undefined
    };

    const targetEqub = data.refType === 'EQUB' && data.refId ? state.equbs.find(e => e.id === data.refId) : undefined;
    const targetLoan = data.refType === 'LOAN' && data.refId ? state.loans.find(l => l.id === data.refId) : undefined;

    const newAuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      action: data.refType === 'EQUB' ? 'EQUB_CONTRIBUTION' : data.refType === 'LOAN' ? 'LOAN_REPAYMENT' : 'POST_TRANSACTION',
      entity: data.refType === 'EQUB' ? 'Equb' : data.refType === 'LOAN' ? 'Loan' : 'Transaction',
      entityId: data.refId || newTx.id,
      diffAfter: {
        amount: data.amount,
        category: data.category,
        wallet: targetWallet?.name,
        isCreditSale: data.isCreditSale,
        expenseScope: determinedScope,
        refType: data.refType,
        refId: data.refId,
        splits: data.splits,
        equbName: targetEqub?.name,
        loanTitle: targetLoan?.title
      },
      branch: state.currentUser.branch
    };

    let matchedRecInfo: { title: string; nextDueDate: string; periodsCovered: number } | null = null;

    setState(prev => {
      // 1. Synchronize Equb circle progress (tracks completedRounds and status)
      const { updatedEqubs } = syncEqubWithTransaction(newTx, prev.equbs);

      // 2. Synchronize Recurring payments (e.g. advance rent payments, utilities)
      const { updatedRecurring, matchedTemplate, periodsCovered } = syncRecurringWithTransaction(newTx, prev.recurring);
      if (matchedTemplate && periodsCovered > 0) {
        matchedRecInfo = {
          title: matchedTemplate.title,
          nextDueDate: matchedTemplate.nextDueDate,
          periodsCovered
        };
      }

      const updatedLoans = data.refType === 'LOAN' && data.refId
        ? prev.loans.map(l => {
            if (l.id !== data.refId) return l;
            const newBal = Math.max(0, l.outstandingBalance - data.amount);
            const loanSplits = data.splits && data.splits.length > 0
              ? data.splits
              : [{ walletId: data.walletId, amount: data.amount }];
            const newRecords: LoanPayment[] = loanSplits.map((s, idx) => ({
              id: `lp-tx-${Date.now()}-${idx}`,
              loanId: data.refId!,
              date: data.date,
              amount: s.amount,
              principal: s.amount,
              interest: 0,
              walletId: s.walletId
            }));
            return {
              ...l,
              outstandingBalance: newBal,
              status: (newBal <= 0 ? 'PAID' : 'ACTIVE') as 'ACTIVE' | 'PAID',
              payments: [...newRecords, ...l.payments]
            };
          })
        : prev.loans;

      const updatedState = {
        ...prev,
        transactions: [newTx, ...prev.transactions],
        equbs: updatedEqubs,
        loans: updatedLoans,
        recurring: updatedRecurring,
        auditLogs: [newAuditLog, ...prev.auditLogs]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    if (matchedRecInfo) {
      const info = matchedRecInfo as { title: string; nextDueDate: string; periodsCovered: number };
      triggerToast(`🔄 Recurring schedule updated for ${info.title}! Paid in advance until ${new Date(info.nextDueDate).toLocaleDateString()} (${info.periodsCovered} cycle${info.periodsCovered > 1 ? 's' : ''}). Trajectory updated.`);
    }

    if (targetEqub) {
      triggerToast(`🤝 ${formatETB(data.amount)} Equb contribution recorded for ${targetEqub.name} (Round #${targetEqub.currentRound})!`);
      sendExternalNotification('PlusZone ERP - Equb Contribution 🤝', {
        body: `Paid ${formatETB(data.amount)} Equb round contribution for ${targetEqub.name}.`
      });
    } else if (targetLoan) {
      const isLent = targetLoan.direction === 'LENT';
      triggerToast(
        isLent
          ? `Collected ${formatETB(data.amount)} loan repayment from ${targetLoan.counterparty}!`
          : `Paid ${formatETB(data.amount)} loan installment to ${targetLoan.counterparty}!`
      );
      sendExternalNotification('PlusZone ERP - Loan Repayment 🏦', {
        body: `${isLent ? 'Collected' : 'Paid'} ${formatETB(data.amount)} for loan "${targetLoan.title}".`
      });
    } else {
      const scopeLabel = data.type === 'EXPENSE' && determinedScope === 'PERSONAL' ? ' (Personal Expense)' : '';
      triggerToast(`${formatETB(data.amount)} ${(data.type || '').toLowerCase()}${scopeLabel} logged to ${targetWallet?.name || 'wallet'}`);
      sendExternalNotification(`PlusZone ERP - ${data.type === 'INCOME' ? 'Income' : (determinedScope === 'PERSONAL' ? 'Personal Expense' : 'Expense')} Logged 💰`, {
        body: `${formatETB(data.amount)} ${data.type.toLowerCase()}${scopeLabel} logged to ${targetWallet?.name || 'wallet'} (${data.category}).`
      });
    }
    performRefresh(true);
  };

  const handleAddGamingIncome = (amount: number, category: string, description: string) => {
    const mainWallet = state.wallets[0] || { id: 'w1', name: 'Main Cash Drawer' };
    const newTx: Transaction = {
      id: `tx-game-${Date.now()}`,
      type: 'INCOME',
      category: category || 'Gaming & Entertainment',
      amount,
      date: new Date().toISOString(),
      walletId: mainWallet.id,
      description,
      creatorId: state.currentUser.id,
      creatorName: state.currentUser.name,
      branch: state.currentUser.branch
    };
    setState(prev => {
      const updatedState = {
        ...prev,
        transactions: [newTx, ...prev.transactions]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });
    triggerToast(`🎮 ${formatETB(amount)} PS5 Gaming revenue logged to ${mainWallet.name}!`);
    sendExternalNotification('PlusZone ERP - Gaming Revenue 🎮', {
      body: `PS5 Revenue ${formatETB(amount)} logged (${category}) to ${mainWallet.name}.`
    });
    performRefresh(true);
  };

  // 1b. Batch Post Multiple Transactions (Daily Income / Expense across all wallets)
  const handleBatchPostTransactions = (items: Array<{
    type: TransactionType;
    amount: number;
    walletId: string;
    category: string;
    description: string;
    date: string;
    expenseScope?: 'BUSINESS' | 'PERSONAL';
    refType?: Transaction['refType'];
    refId?: string;
  }>) => {
    const timestamp = Date.now();
    const newTxs: Transaction[] = items.map((item, idx) => ({
      id: `tx-${timestamp}-${idx}`,
      date: item.date,
      type: item.type,
      amount: item.amount,
      walletId: item.walletId,
      category: item.category,
      description: item.description,
      expenseScope: item.type === 'EXPENSE' ? (item.expenseScope || 'BUSINESS') : undefined,
      creatorId: state.currentUser.id,
      creatorName: state.currentUser.name,
      branch: state.currentUser.branch,
      refType: item.refType,
      refId: item.refId
    }));

    if (newTxs.length > 1) {
      const allBatchIds = newTxs.map(t => t.id);
      newTxs.forEach(t => {
        t.siblingTxIds = allBatchIds.filter(id => id !== t.id);
      });
    }

    const totalAmount = items.reduce((acc, i) => acc + i.amount, 0);
    const equbRef = items.find(i => i.refType === 'EQUB' && i.refId);
    const targetEqub = equbRef ? state.equbs.find(e => e.id === equbRef.refId) : undefined;
    const loanRef = items.find(i => i.refType === 'LOAN' && i.refId);
    const targetLoan = loanRef ? state.loans.find(l => l.id === loanRef.refId) : undefined;

    const newAuditLog = {
      id: `aud-${timestamp}`,
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      action: equbRef ? 'EQUB_CONTRIBUTION' : loanRef ? 'LOAN_REPAYMENT' : 'POST_BATCH_TRANSACTIONS',
      entity: equbRef ? 'Equb' : loanRef ? 'Loan' : 'Transaction',
      entityId: equbRef ? equbRef.refId! : loanRef ? loanRef.refId! : `batch-${timestamp}`,
      diffAfter: { count: items.length, totalAmount, refType: equbRef?.refType || loanRef?.refType, refId: equbRef?.refId || loanRef?.refId },
      branch: state.currentUser.branch
    };

    setState(prev => {
      const updatedEqubs = equbRef && equbRef.refId
        ? prev.equbs.map(e => {
            if (e.id !== equbRef.refId) return e;
            const nextRound = e.currentRound + 1;
            const completed = (e.completedRounds ?? Math.max(0, e.currentRound - 1)) + 1;
            const isFinished = nextRound > e.totalRounds || completed >= e.totalRounds;
            return {
              ...e,
              currentRound: Math.min(e.totalRounds, nextRound),
              completedRounds: Math.min(e.totalRounds, completed),
              isOverdue: false,
              status: (isFinished ? 'COMPLETED' : 'ACTIVE') as 'ACTIVE' | 'COMPLETED'
            };
          })
        : prev.equbs;

      const updatedLoans = loanRef && loanRef.refId
        ? prev.loans.map(l => {
            if (l.id !== loanRef.refId) return l;
            const loanSplits = items.filter(i => i.refType === 'LOAN' && i.refId === loanRef.refId);
            const loanTotalRepaid = loanSplits.reduce((acc, i) => acc + i.amount, 0);
            const newBal = Math.max(0, l.outstandingBalance - loanTotalRepaid);
            const newPaymentRecords: LoanPayment[] = loanSplits.map((item, idx) => ({
              id: `lp-batch-${timestamp}-${idx}`,
              loanId: loanRef.refId!,
              date: item.date,
              amount: item.amount,
              principal: item.amount,
              interest: 0,
              walletId: item.walletId
            }));
            return {
              ...l,
              outstandingBalance: newBal,
              status: (newBal <= 0 ? 'PAID' : 'ACTIVE') as 'ACTIVE' | 'PAID',
              payments: [...newPaymentRecords, ...l.payments]
            };
          })
        : prev.loans;

      let currentRecurring = prev.recurring;
      let currentEqubs = updatedEqubs;
      for (const tx of newTxs) {
        const recRes = syncRecurringWithTransaction(tx, currentRecurring);
        currentRecurring = recRes.updatedRecurring;
        const eqRes = syncEqubWithTransaction(tx, currentEqubs);
        currentEqubs = eqRes.updatedEqubs;
      }

      const updatedState = {
        ...prev,
        transactions: [...newTxs, ...prev.transactions],
        equbs: currentEqubs,
        loans: updatedLoans,
        recurring: currentRecurring,
        auditLogs: [newAuditLog, ...prev.auditLogs]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    if (targetEqub) {
      triggerToast(`🤝 ${formatETB(totalAmount)} Equb contribution split across ${items.length} wallets for ${targetEqub.name}!`);
    } else if (targetLoan) {
      const isLent = targetLoan.direction === 'LENT';
      triggerToast(
        isLent
          ? `Collected ${formatETB(totalAmount)} loan repayment split across ${items.length} wallets for ${targetLoan.counterparty}!`
          : `Paid ${formatETB(totalAmount)} installment split across ${items.length} wallets to ${targetLoan.counterparty}!`
      );
    } else {
      triggerToast(`✨ Successfully posted ${items.length} entries (${formatETB(totalAmount)}) across wallets!`);
    }
    sendExternalNotification('PlusZone ERP - Financial Update 💸', {
      body: `${items.length} transactions posted totaling ${formatETB(totalAmount)} by ${state.currentUser.name}.`
    });
    performRefresh(true);
  };

  // 2. Execute Transfer
  const handleExecuteTransfer = (data: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    reason: string;
  }) => {
    const fromW = state.wallets.find(w => w.id === data.fromWalletId);
    const toW = state.wallets.find(w => w.id === data.toWalletId);

    const newTransfer: Transfer = {
      id: `tr-${Date.now()}`,
      date: new Date().toISOString(),
      fromWalletId: data.fromWalletId,
      toWalletId: data.toWalletId,
      amount: data.amount,
      reason: data.reason,
      creatorId: state.currentUser.id,
      creatorName: state.currentUser.name
    };

    const newAuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      action: 'POST_TRANSFER',
      entity: 'Transfer',
      entityId: newTransfer.id,
      diffAfter: { amount: data.amount, from: fromW?.name, to: toW?.name },
      branch: state.currentUser.branch
    };

    setState(prev => {
      const updatedState = {
        ...prev,
        transfers: [newTransfer, ...prev.transfers],
        auditLogs: [newAuditLog, ...prev.auditLogs]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`${formatETB(data.amount)} transferred from ${fromW?.name} to ${toW?.name}`);
    sendExternalNotification('PlusZone ERP - Wallet Transfer 🔄', {
      body: `Transferred ${formatETB(data.amount)} from ${fromW?.name || 'Wallet'} to ${toW?.name || 'Wallet'} (${data.reason}).`
    });
    performRefresh(true);
  };

  // 2.1 Update Transfer (Transfer CRUD)
  const handleUpdateTransfer = (
    transferId: string,
    data: {
      fromWalletId: string;
      toWalletId: string;
      amount: number;
      reason: string;
    }
  ) => {
    const fromW = state.wallets.find(w => w.id === data.fromWalletId);
    const toW = state.wallets.find(w => w.id === data.toWalletId);
    const oldTransfer = state.transfers.find(t => t.id === transferId);
    if (!oldTransfer) return;

    const newAuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      action: 'UPDATE_TRANSFER',
      entity: 'Transfer',
      entityId: transferId,
      diffAfter: {
        amount: data.amount,
        from: fromW?.name,
        to: toW?.name,
        reason: data.reason
      },
      branch: state.currentUser.branch
    };

    setState(prev => {
      const updatedState = {
        ...prev,
        transfers: prev.transfers.map(t =>
          t.id === transferId
            ? {
                ...t,
                fromWalletId: data.fromWalletId,
                toWalletId: data.toWalletId,
                amount: data.amount,
                reason: data.reason
              }
            : t
        ),
        auditLogs: [newAuditLog, ...prev.auditLogs]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`Transfer updated: ${formatETB(data.amount)} from ${fromW?.name} to ${toW?.name}`);
    performRefresh(true);
  };

  // 2.2 Delete Transfer (Transfer CRUD)
  const handleDeleteTransfer = (transferId: string) => {
    const targetTransfer = state.transfers.find(t => t.id === transferId);
    if (!targetTransfer) return;

    const fromW = state.wallets.find(w => w.id === targetTransfer.fromWalletId);
    const toW = state.wallets.find(w => w.id === targetTransfer.toWalletId);

    const newAuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      action: 'DELETE_TRANSFER',
      entity: 'Transfer',
      entityId: transferId,
      diffAfter: { amount: targetTransfer.amount, from: fromW?.name, to: toW?.name },
      branch: state.currentUser.branch
    };

    setState(prev => {
      const updatedState = {
        ...prev,
        transfers: prev.transfers.filter(t => t.id !== transferId),
        auditLogs: [newAuditLog, ...prev.auditLogs]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`Transfer of ${formatETB(targetTransfer.amount)} reversed/deleted successfully.`);
    performRefresh(true);
  };

  // 3. Reverse Transaction
  const handleReverseTransaction = (txId: string) => {
    let affectedEqubName = '';
    let restoredRound: number | null = null;

    setState(prev => {
      const consolidated = consolidateEqubSplitTransactions(prev.transactions, prev.wallets);
      const target = prev.transactions.find(t => t.id === txId) || consolidated.find(t => t.id === txId);

      const idsToReverse = new Set<string>([txId]);
      if (target) {
        idsToReverse.add(target.id);
        const batchPrefix = target.id.replace(/-\d+$/, '');
        if (batchPrefix !== target.id) {
          prev.transactions.forEach(t => {
            if (t.id.startsWith(batchPrefix)) idsToReverse.add(t.id);
          });
        }
      }

      let updatedEqubs = prev.equbs;
      const isEqubContribution = target ? isEqubContributionTransaction(target) : false;
      const isEqubPayout = target ? isEqubPayoutTransaction(target) : false;
      const targetEqub = target && (isEqubContribution || isEqubPayout) ? findMatchingEqub(target, prev.equbs) : undefined;

      if (targetEqub && target && isEqubContribution) {
        const { updatedEqub, restoredRound: newR } = revertEqubForDeletedContribution(targetEqub, target);
        affectedEqubName = targetEqub.name;
        restoredRound = newR;
        updatedEqubs = prev.equbs.map(e => e.id === targetEqub.id ? updatedEqub : e);
      } else if (targetEqub && isEqubPayout) {
        affectedEqubName = targetEqub.name;
        updatedEqubs = prev.equbs.map(e => e.id === targetEqub.id ? revertEqubForDeletedPayout(e) : e);
      }

      const updatedTxs = prev.transactions.map(t =>
        idsToReverse.has(t.id) ? { ...t, reversed: true, reversedAt: new Date().toISOString() } : t
      );

      const newAuditLog: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorId: prev.currentUser.id,
        actorName: prev.currentUser.name,
        action: 'REVERSE_TRANSACTION',
        entity: 'Transaction',
        entityId: txId,
        diffAfter: {
          reversed: true,
          amount: target?.amount,
          equbUpdated: affectedEqubName ? { name: affectedEqubName, newRound: restoredRound } : undefined
        },
        branch: prev.currentUser.branch
      };

      const auditLogs = [newAuditLog, ...prev.auditLogs];
      if (targetEqub && isEqubContribution && restoredRound !== null) {
        auditLogs.unshift({
          id: `aud-eq-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'UPDATE_EQUB',
          entity: 'Equb',
          entityId: targetEqub.id,
          diffBefore: { currentRound: targetEqub.currentRound, status: targetEqub.status },
          diffAfter: { currentRound: restoredRound, status: 'ACTIVE', reason: `Contribution transaction ${txId} reversed` },
          branch: prev.currentUser.branch
        });
      }

      const updatedState = {
        ...prev,
        transactions: updatedTxs,
        equbs: updatedEqubs,
        auditLogs
      };

      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    if (affectedEqubName && restoredRound !== null) {
      triggerToast(`↩️ Equb contribution reversed. ${affectedEqubName} updated back to Round #${restoredRound}!`);
    } else {
      triggerToast(`Transaction reversed in ledger.`);
    }
    performRefresh(true);
  };

  // 3.1 Update Transaction (CRUD Edit with full Split Payment support)
  const handleUpdateTransaction = (
    txId: string,
    updatedData: {
      date: string;
      amount: number;
      type: TransactionType;
      category: string;
      description: string;
      walletId: string;
      expenseScope?: 'BUSINESS' | 'PERSONAL';
      splits?: Array<{ walletId: string; amount: number }>;
      refType?: Transaction['refType'];
      refId?: string;
    }
  ) => {
    const consolidatedList = consolidateEqubSplitTransactions(state.transactions, state.wallets);
    const existingTx = state.transactions.find(t => t.id === txId) || consolidatedList.find(t => t.id === txId);
    if (!existingTx) return;

    if (!isTransactionEditable(existingTx.date) && state.currentUser.role !== 'SuperAdmin' && state.currentUser.role !== 'Admin') {
      triggerToast(`⚠️ Can't be edited: transaction is older than 1 week!`);
      return;
    }

    setState(prev => {
      // Find explicit sibling IDs to remove if updating a consolidated group
      const consolidated = consolidateEqubSplitTransactions(prev.transactions, prev.wallets);
      const isConsolidated = consolidated.find(c => c.id === txId);
      
      const siblingIdsToRemove = new Set<string>();
      if (isConsolidated?.siblingTxIds && Array.isArray(isConsolidated.siblingTxIds)) {
        isConsolidated.siblingTxIds.forEach(id => siblingIdsToRemove.add(id));
      }
      if (existingTx.siblingTxIds && Array.isArray(existingTx.siblingTxIds)) {
        existingTx.siblingTxIds.forEach(id => siblingIdsToRemove.add(id));
      }

      // If txId is explicitly a batch-split Equb or Loan payment (e.g. tx-eq-<ts>-<idx> or tx-lp-<ts>-<idx>)
      const eqBatchMatch = txId.match(/^(tx-eq-\d+)-\d+$/);
      if (eqBatchMatch) {
        prev.transactions.forEach(t => {
          if (t.id !== txId && t.id.startsWith(`${eqBatchMatch[1]}-`)) {
            siblingIdsToRemove.add(t.id);
          }
        });
      }
      const lpBatchMatch = txId.match(/^(tx-lp-\d+)-\d+$/);
      if (lpBatchMatch) {
        prev.transactions.forEach(t => {
          if (t.id !== txId && t.id.startsWith(`${lpBatchMatch[1]}-`)) {
            siblingIdsToRemove.add(t.id);
          }
        });
      }
      const txBatchMatch = txId.match(/^(tx-\d+)-\d+$/);
      if (txBatchMatch) {
        prev.transactions.forEach(t => {
          if (t.id !== txId && t.id.startsWith(`${txBatchMatch[1]}-`)) {
            siblingIdsToRemove.add(t.id);
          }
        });
      }

      const updatedItem: Transaction = {
        ...existingTx,
        ...updatedData,
        id: txId,
        refType: updatedData.refType !== undefined ? updatedData.refType : existingTx.refType,
        refId: updatedData.refId !== undefined ? updatedData.refId : existingTx.refId,
        splits: updatedData.splits && updatedData.splits.length > 0 ? updatedData.splits : undefined,
        expenseScope: updatedData.type === 'EXPENSE'
          ? (updatedData.expenseScope || 'BUSINESS')
          : undefined
      };

      let replaced = false;
      const mapped = prev.transactions
        .filter(t => !siblingIdsToRemove.has(t.id))
        .map(t => {
          if (t.id === txId) {
            replaced = true;
            return updatedItem;
          }
          return t;
        });

      const updatedTxs = (replaced ? mapped : [updatedItem, ...mapped])
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const targetWallet = prev.wallets.find(w => w.id === updatedData.walletId);
      const newAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorId: prev.currentUser.id,
        actorName: prev.currentUser.name,
        action: 'UPDATE_TRANSACTION',
        entity: 'Transaction',
        entityId: txId,
        diffAfter: {
          amount: updatedData.amount,
          category: updatedData.category,
          date: updatedData.date,
          wallet: targetWallet?.name,
          splits: updatedData.splits
        },
        branch: prev.currentUser.branch
      };

      const { updatedRecurring } = syncRecurringWithTransaction(updatedItem, prev.recurring);
      const { updatedEqubs } = syncEqubWithTransaction(updatedItem, prev.equbs);

      const updatedState = {
        ...prev,
        transactions: updatedTxs,
        equbs: updatedEqubs,
        recurring: updatedRecurring,
        auditLogs: [newAuditLog, ...prev.auditLogs]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    if (updatedData.splits && updatedData.splits.length > 1) {
      triggerToast(`Split payment successfully updated across ${updatedData.splits.length} wallets!`);
    } else {
      triggerToast(`Transaction successfully updated!`);
    }
    performRefresh(true);
  };

  // 3.1b Full Ledger Refresh and Synchronization with Cloud Firestore
  const handleRefreshTransactions = async () => {
    triggerHaptic('medium');
    try {
      const latestRemote = await fetchLatestFirebaseState();
      setState(prev => {
        const canonicalMap = new Map<string, Transaction>();
        DEFAULT_TRANSACTIONS.forEach(t => canonicalMap.set(t.id, t));
        if (latestRemote?.transactions && Array.isArray(latestRemote.transactions)) {
          latestRemote.transactions.forEach(t => {
            if (t && t.id) canonicalMap.set(t.id, t);
          });
        }
        prev.transactions.forEach(t => {
          if (t && t.id) canonicalMap.set(t.id, t);
        });
        const allTxs = Array.from(canonicalMap.values())
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const next: ERPState = {
          ...prev,
          transactions: allTxs,
          deletedEntityIds: (prev.deletedEntityIds || []).filter(id => !isCanonicalTransactionId(id))
        };
        saveStateToStorage(next);
        syncStateToFirebaseNow(next);
        return next;
      });
      triggerToast('✅ All transactions refreshed and synchronized with Cloud Ledger');
    } catch (err) {
      console.error('Failed to refresh transactions', err);
      triggerToast('⚠️ Ledger refreshed from local verified state');
    }
  };

  // 3.2 Delete Transaction (Direct deletion authority for Admin and SuperAdmin)
  const handleDeleteTransaction = (txId: string) => {
    const consolidated = consolidateEqubSplitTransactions(state.transactions, state.wallets);
    const existingTx = state.transactions.find(t => t.id === txId) || consolidated.find(t => t.id === txId);
    if (!existingTx) return;

    if (state.currentUser.role !== 'SuperAdmin' && state.currentUser.role !== 'Admin') {
      if (!isTransactionEditable(existingTx.date)) {
        triggerToast(`⚠️ Admin authorization required: transaction is older than 1 week!`);
        return;
      }
    }

    let affectedEqubName = '';
    let restoredRound: number | null = null;

    setState(prev => {
      // Find all IDs to delete (handle split batches or sibling IDs)
      const idsToDelete = new Set<string>([txId, existingTx.id]);
      
      // If it's a split equb batch or sibling transaction
      const batchPrefix = existingTx.id.replace(/-\d+$/, '');
      if (batchPrefix !== existingTx.id) {
        prev.transactions.forEach(t => {
          if (t.id.startsWith(batchPrefix)) {
            idsToDelete.add(t.id);
          }
        });
      }

      // Check if it matches an Equb contribution or payout
      const isEqubContribution = isEqubContributionTransaction(existingTx);
      const isEqubPayout = isEqubPayoutTransaction(existingTx);
      
      let updatedEqubs = prev.equbs;
      const targetEqub = (isEqubContribution || isEqubPayout) ? findMatchingEqub(existingTx, prev.equbs) : undefined;

      if (targetEqub && isEqubContribution) {
        const { updatedEqub, restoredRound: newR } = revertEqubForDeletedContribution(targetEqub, existingTx);
        affectedEqubName = targetEqub.name;
        restoredRound = newR;

        updatedEqubs = prev.equbs.map(e => e.id === targetEqub.id ? updatedEqub : e);
      } else if (targetEqub && isEqubPayout) {
        affectedEqubName = targetEqub.name;
        updatedEqubs = prev.equbs.map(e => e.id === targetEqub.id ? revertEqubForDeletedPayout(e) : e);
      }

      const updatedTxs = prev.transactions.filter(t => !idsToDelete.has(t.id));
      const newDeletedIds = Array.from(new Set([...(prev.deletedEntityIds || []), ...Array.from(idsToDelete)]));

      const newAuditLog: AuditLogEntry = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorId: prev.currentUser.id,
        actorName: prev.currentUser.name,
        action: 'DELETE_TRANSACTION',
        entity: 'Transaction',
        entityId: txId,
        diffBefore: existingTx,
        diffAfter: {
          deleted: true,
          description: existingTx.description,
          equbUpdated: affectedEqubName ? { name: affectedEqubName, newRound: restoredRound } : undefined
        },
        branch: prev.currentUser.branch
      };

      const auditLogs = [newAuditLog, ...prev.auditLogs];
      if (targetEqub && isEqubContribution && restoredRound !== null) {
        auditLogs.unshift({
          id: `aud-eq-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'UPDATE_EQUB',
          entity: 'Equb',
          entityId: targetEqub.id,
          diffBefore: { currentRound: targetEqub.currentRound, status: targetEqub.status },
          diffAfter: { currentRound: restoredRound, status: 'ACTIVE', reason: `Contribution transaction ${txId} deleted` },
          branch: prev.currentUser.branch
        });
      }

      const updatedState = {
        ...prev,
        transactions: updatedTxs,
        equbs: updatedEqubs,
        deletedEntityIds: newDeletedIds,
        auditLogs
      };

      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    if (affectedEqubName && restoredRound !== null) {
      triggerToast(`🗑️ Equb contribution deleted. ${affectedEqubName} updated back to Round #${restoredRound}!`);
    } else {
      triggerToast(`🗑️ Transaction deleted from ledger.`);
    }
    performRefresh(true);
  };

  // 3.3 Clear All Transactions
  const handleClearAllTransactions = () => {
    setState(prev => {
      const newAuditLog = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorId: prev.currentUser.id,
        actorName: prev.currentUser.name,
        action: 'CLEAR_ALL_TRANSACTIONS',
        entity: 'Transaction',
        entityId: 'all',
        diffAfter: { clearedCount: prev.transactions.length },
        branch: prev.currentUser.branch
      };
      const updatedState = {
        ...prev,
        transactions: [],
        auditLogs: [newAuditLog, ...prev.auditLogs]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });
    triggerToast(`🗑️ All transactions cleared! You can now add entries manually.`);
    performRefresh(true);
  };

  // 4. Pay Equb Round (Supports Single & Split Payments across multiple wallets)
  const handlePayEqubRound = (
    equbId: string,
    splits: Array<{ walletId: string; amount: number }>,
    customDate?: string
  ) => {
    const targetEqub = state.equbs.find(e => e.id === equbId);
    if (!targetEqub || splits.length === 0) return;

    const totalPaid = splits.reduce((sum, s) => sum + s.amount, 0);
    const dateToUse = customDate || new Date().toISOString();
    const primaryWalletId = splits[0].walletId;

    const splitSummary = splits.map(s => {
      const w = state.wallets.find(wal => wal.id === s.walletId);
      return `${getWalletNickname(w?.name)}: ${formatETB(s.amount)}`;
    }).join(', ');

    const newTx: Transaction = {
      id: `tx-eq-${Date.now()}`,
      date: dateToUse,
      type: 'EXPENSE',
      amount: totalPaid,
      walletId: primaryWalletId,
      category: 'Equb Contribution',
      description: splits.length > 1
        ? `${targetEqub.name} Round #${targetEqub.currentRound} payment (Split: ${splitSummary})`
        : `${targetEqub.name} Round #${targetEqub.currentRound} payment`,
      creatorId: state.currentUser.id,
      creatorName: state.currentUser.name,
      branch: state.currentUser.branch,
      refType: 'EQUB',
      refId: equbId,
      splits: splits.length > 1 ? splits : undefined
    };

    const newAuditLog: AuditLogEntry = {
      id: `aud-eq-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      action: 'PAY_EQUB_ROUND',
      entity: 'Equb',
      entityId: equbId,
      diffAfter: {
        equbName: targetEqub.name,
        round: targetEqub.currentRound,
        amount: totalPaid,
        date: dateToUse,
        splits: splits.length > 1 ? splits : [{ walletId: primaryWalletId, amount: totalPaid }]
      },
      branch: state.currentUser.branch
    };

    setState(prev => {
      const updatedEqubs = prev.equbs.map(e => {
        if (e.id !== equbId) return e;
        const nextRound = e.currentRound + 1;
        const completed = (e.completedRounds ?? Math.max(0, e.currentRound - 1)) + 1;
        const isFinished = nextRound > e.totalRounds || completed >= e.totalRounds;
        return {
          ...e,
          currentRound: Math.min(e.totalRounds, nextRound),
          completedRounds: Math.min(e.totalRounds, completed),
          isOverdue: false,
          status: (isFinished ? 'COMPLETED' : 'ACTIVE') as 'ACTIVE' | 'COMPLETED'
        };
      });

      const updatedState = {
        ...prev,
        transactions: consolidateEqubSplitTransactions([newTx, ...prev.transactions], prev.wallets),
        equbs: updatedEqubs,
        auditLogs: [newAuditLog, ...(prev.auditLogs || [])]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    if (splits.length > 1) {
      triggerToast(`Split payment of ${formatETB(totalPaid)} processed across ${splits.length} wallets!`);
    } else {
      const targetW = state.wallets.find(w => w.id === splits[0]?.walletId);
      triggerToast(`${formatETB(totalPaid)} Equb contribution paid via ${targetW?.name || 'wallet'}`);
    }
    sendExternalNotification('PlusZone ERP - Equb Contribution 🤝', {
      body: `Paid ${formatETB(totalPaid)} Equb round contribution for ${targetEqub.name}.`
    });
    performRefresh(true);
  };

  // 5. Claim Equb Payout
  const handleClaimEqubPayout = (equbId: string, walletId: string, netPool: number) => {
    const targetEqub = state.equbs.find(e => e.id === equbId);
    const targetWallet = state.wallets.find(w => w.id === walletId);

    const newTx: Transaction = {
      id: `tx-payout-eq-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'INCOME',
      amount: netPool,
      walletId,
      category: 'Equb Payout',
      description: `Winnings Payout: ${targetEqub?.name}`,
      creatorId: state.currentUser.id,
      creatorName: state.currentUser.name,
      branch: state.currentUser.branch,
      refType: 'EQUB',
      refId: equbId
    };

    setState(prev => {
      const updatedState = {
        ...prev,
        transactions: [newTx, ...prev.transactions],
        equbs: prev.equbs.map(e => e.id === equbId ? { ...e, payoutsClaimed: (e.payoutsClaimed || 0) + 1 } : e)
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`🎉 ${formatETB(netPool)} Equb Payout credited to ${targetWallet?.name}!`);
    sendExternalNotification('PlusZone ERP - Equb Payout Claimed 🎉', {
      body: `${formatETB(netPool)} Equb payout claimed & credited to ${targetWallet?.name || 'wallet'}!`
    });
    performRefresh(true);
  };

  // 6. Add, Update & Delete Wallet
  const handleAddWallet = (newW: Omit<Wallet, 'id' | 'totalIn' | 'totalOut'>) => {
    const created: Wallet = {
      ...newW,
      id: `w-${Date.now()}`,
      openingBalance: Number(newW.openingBalance) || 0,
      totalIn: 0,
      totalOut: 0
    };

    const newAuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      action: 'CREATE_WALLET',
      entity: 'Wallet',
      entityId: created.id,
      diffAfter: { name: created.name, type: created.type, openingBalance: created.openingBalance },
      branch: state.currentUser.branch
    };

    setState(prev => {
      const updated = {
        ...prev,
        wallets: [...prev.wallets, created],
        auditLogs: [newAuditLog, ...(prev.auditLogs || [])]
      };
      saveStateToStorage(updated);
      syncStateToFirebaseNow(updated);
      return updated;
    });

    triggerToast(`✓ Wallet "${created.name}" initialized.`);
    performRefresh(true);
  };

  const handleUpdateWallet = (walletId: string, updates: Partial<Wallet>) => {
    const target = state.wallets.find(w => w.id === walletId);
    const newAuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      action: 'UPDATE_WALLET',
      entity: 'Wallet',
      entityId: walletId,
      diffBefore: target,
      diffAfter: { ...target, ...updates },
      branch: state.currentUser.branch
    };

    setState(prev => {
      const updated = {
        ...prev,
        wallets: prev.wallets.map(w => w.id === walletId ? { ...w, ...updates } : w),
        auditLogs: [newAuditLog, ...(prev.auditLogs || [])]
      };
      saveStateToStorage(updated);
      syncStateToFirebaseNow(updated);
      return updated;
    });
    triggerToast(`Wallet "${updates.name || target?.name || 'settings'}" updated.`);
    performRefresh(true);
  };

  const handleDeleteWallet = (walletId: string) => {
    const targetWallet = state.wallets.find(w => w.id === walletId);
    if (!targetWallet) return;

    if (state.currentUser.role !== 'SuperAdmin' && state.currentUser.role !== 'Admin') {
      triggerToast(`⚠️ Admin authorization required to remove wallets.`);
      return;
    }

    const newAuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      action: 'DELETE_WALLET',
      entity: 'Wallet',
      entityId: walletId,
      diffAfter: { deleted: true, name: targetWallet.name },
      branch: state.currentUser.branch
    };

    setState(prev => {
      const newDeletedIds = Array.from(new Set([...(prev.deletedEntityIds || []), walletId]));
      const updated = {
        ...prev,
        wallets: prev.wallets.filter(w => w.id !== walletId),
        deletedEntityIds: newDeletedIds,
        auditLogs: [newAuditLog, ...(prev.auditLogs || [])]
      };
      saveStateToStorage(updated);
      syncStateToFirebaseNow(updated);
      return updated;
    });

    triggerToast(`🗑️ Wallet "${targetWallet.name}" removed.`);
    performRefresh(true);
  };

  // 7. Add Equb
  const handleCreateEqub = (eq: Omit<Equb, 'id' | 'currentRound' | 'computedEndingDate' | 'status'> & {
    computedEndingDate?: string;
    advanceMonthsPrepaid?: number;
    initialCompletedRounds?: number;
    recordAdvanceTransaction?: boolean;
    advancePaymentWalletId?: string;
  }) => {
    let daysPerRound = 7;
    let roundsPerMonth = 4;
    if (eq.interval === 'EVERY_10_DAYS') {
      daysPerRound = 10;
      roundsPerMonth = 3;
    } else if (eq.interval === 'EVERY_15_DAYS') {
      daysPerRound = 15;
      roundsPerMonth = 2;
    } else if (eq.interval === 'MONTHLY') {
      daysPerRound = 30;
      roundsPerMonth = 1;
    }

    const start = new Date(eq.startDate || Date.now());
    const endingDate = eq.computedEndingDate || new Date(start.getTime() + 86400000 * daysPerRound * Math.max(0, eq.totalRounds - 1)).toISOString();

    const advanceMonths = Number(eq.advanceMonthsPrepaid) || 0;
    const prepaidRoundsFromMonths = advanceMonths > 0 ? Math.min(eq.totalRounds, Math.round(advanceMonths * roundsPerMonth)) : 0;
    const completedRounds = typeof eq.initialCompletedRounds === 'number'
      ? eq.initialCompletedRounds
      : prepaidRoundsFromMonths;
    const startRound = Math.min(eq.totalRounds, completedRounds + 1);
    const isFinished = completedRounds >= eq.totalRounds;

    const prepaidUntilDate = advanceMonths > 0
      ? new Date(start.getTime() + advanceMonths * 30 * 86400000).toISOString()
      : undefined;

    const created: Equb = {
      ...eq,
      id: `eq-${Date.now()}`,
      currentRound: startRound,
      completedRounds,
      mySlots: eq.mySlots || 1,
      payoutsClaimed: 0,
      computedEndingDate: endingDate,
      status: isFinished ? 'COMPLETED' : 'ACTIVE',
      prepaidUntilDate,
      advanceMonthsPrepaid: advanceMonths > 0 ? advanceMonths : undefined
    };

    let newTx: Transaction | null = null;
    if (eq.recordAdvanceTransaction !== false && completedRounds > 0) {
      const advanceAmount = completedRounds * eq.contributionPerRound * (eq.mySlots || 1);
      const targetWId = eq.advancePaymentWalletId || eq.walletId;
      newTx = {
        id: `tx-eq-adv-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'EXPENSE',
        amount: advanceAmount,
        walletId: targetWId,
        category: 'Equb Contribution',
        description: `${created.name} Equb advance payment for ${advanceMonths > 0 ? `${advanceMonths} month${advanceMonths > 1 ? 's' : ''}` : `${completedRounds} rounds`} (${completedRounds} rounds prepaid upfront)`,
        expenseScope: 'BUSINESS',
        refType: 'EQUB',
        refId: created.id
      };
    }

    setState(prev => {
      const updatedState = {
        ...prev,
        equbs: [...prev.equbs, created],
        transactions: newTx ? [newTx, ...prev.transactions] : prev.transactions
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`Equb circle "${created.name}" launched${completedRounds > 0 ? ` (${completedRounds} rounds prepaid in advance)` : ''}.`);
    performRefresh(true);
    return created;
  };

  // 7b. Update Shop Operating Hours
  const handleUpdateShopHours = (updated: ShopOperatingHours) => {
    setState(prev => {
      const updatedState = {
        ...prev,
        shopHours: updated
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(
      updated.manualOverrideStatus === 'OPEN'
        ? 'Shop status manually set to OPEN'
        : updated.manualOverrideStatus === 'CLOSED'
        ? 'Shop status manually set to CLOSED'
        : 'Shop operating schedule updated (6:00 AM – 6:00 PM GMT)'
    );
  };

  // 8. Create Loan (Lent or Borrowed)
  const handleCreateLoan = (newLoan: Omit<Loan, 'id' | 'outstandingBalance' | 'status' | 'payments'>) => {
    const created: Loan = {
      ...newLoan,
      id: `ln-${Date.now()}`,
      outstandingBalance: newLoan.initialAmount,
      status: 'ACTIVE',
      payments: []
    };

    const isLent = created.direction === 'LENT';
    const tx: Transaction = {
      id: `tx-ln-${Date.now()}`,
      date: new Date().toISOString(),
      type: isLent ? 'EXPENSE' : 'INCOME',
      amount: created.initialAmount,
      walletId: created.walletId,
      category: isLent ? 'Loan Payment' : 'Sales Revenue',
      description: isLent
        ? `Lent money issued to ${created.counterparty}: ${created.title}`
        : `Loan capital received from ${created.counterparty}: ${created.title}`,
      creatorId: state.currentUser.id,
      creatorName: state.currentUser.name,
      branch: state.currentUser.branch,
      refType: 'LOAN',
      refId: created.id
    };

    setState(prev => {
      const updatedState = {
        ...prev,
        loans: [created, ...prev.loans],
        transactions: [tx, ...prev.transactions]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(isLent ? `Lent loan recorded for ${created.counterparty}` : `Borrowed loan "${created.title}" recorded.`);
    sendExternalNotification('PlusZone ERP - Loan Activity 🏦', {
      body: `${isLent ? 'Lent' : 'Borrowed'} loan of ${formatETB(created.initialAmount)} recorded (${created.counterparty}).`
    });
    performRefresh(true);
  };

  // 9. Repay / Collect Loan
  const handleRepayLoan = (
    loanId: string,
    walletId: string,
    amount: number,
    splits?: Array<{ walletId: string; amount: number }>,
    paymentDate?: string
  ) => {
    const targetLoan = state.loans.find(l => l.id === loanId);
    if (!targetLoan) return;

    const effectiveSplits = splits && splits.length > 0
      ? splits.filter(s => s.amount > 0)
      : [{ walletId, amount }];

    const totalAmount = effectiveSplits.reduce((sum, s) => sum + s.amount, 0);

    // Validation: Loan repayment cannot be less than 1k (ETB 1,000) unless remaining balance is less than 1k
    if (targetLoan.outstandingBalance >= 1000 && totalAmount < 1000) {
      triggerToast('⚠️ Loan repayment cannot be less than ETB 1,000 (1k).');
      return;
    }
    if (targetLoan.outstandingBalance < 1000 && totalAmount < targetLoan.outstandingBalance) {
      triggerToast(`⚠️ Repayment must be at least ETB ${targetLoan.outstandingBalance.toLocaleString()} to settle the loan.`);
      return;
    }

    const isLent = targetLoan.direction === 'LENT';
    const newBal = Math.max(0, targetLoan.outstandingBalance - totalAmount);
    const isPaid = newBal <= 0;
    const nowIso = paymentDate ? new Date(`${paymentDate}T12:00:00.000Z`).toISOString() : new Date().toISOString();
    const batchTimestamp = Date.now();

    const paymentRecords: LoanPayment[] = effectiveSplits.map((s, idx) => ({
      id: `lp-${batchTimestamp}-${idx}`,
      loanId,
      date: nowIso,
      amount: s.amount,
      principal: s.amount,
      interest: 0,
      walletId: s.walletId
    }));

    const splitSummary = effectiveSplits.map(s => {
      const splitW = state.wallets.find(w => w.id === s.walletId);
      return `${getWalletNickname(splitW?.name)}: ${formatETB(s.amount)}`;
    }).join(', ');

    const newTransactions: Transaction[] = [
      {
        id: `tx-lp-${batchTimestamp}`,
        date: nowIso,
        type: isLent ? 'INCOME' : 'EXPENSE',
        amount: totalAmount,
        walletId: effectiveSplits[0].walletId,
        category: 'Loan Payment',
        description: isLent
          ? `Collected loan repayment from ${targetLoan.counterparty}${effectiveSplits.length > 1 ? ` (Split: ${splitSummary})` : ''}`
          : `Paid loan installment to ${targetLoan.counterparty}${effectiveSplits.length > 1 ? ` (Split: ${splitSummary})` : ''}`,
        creatorId: state.currentUser.id,
        creatorName: state.currentUser.name,
        branch: state.currentUser.branch,
        refType: 'LOAN',
        refId: loanId,
        splits: effectiveSplits.length > 1 ? effectiveSplits : undefined
      }
    ];

    const newAuditLog = {
      id: `aud-${batchTimestamp}`,
      timestamp: new Date().toISOString(),
      actorId: state.currentUser.id,
      actorName: state.currentUser.name,
      action: isLent ? 'COLLECT_LOAN_REPAYMENT' : 'PAY_LOAN_REPAYMENT',
      entity: 'Loan',
      entityId: loanId,
      diffAfter: {
        totalAmount,
        splitsCount: effectiveSplits.length,
        remainingBalance: newBal,
        isPaid
      },
      branch: state.currentUser.branch
    };

    setState(prev => {
      const updatedState = {
        ...prev,
        loans: prev.loans.map(l =>
          l.id === loanId
            ? {
                ...l,
                outstandingBalance: newBal,
                status: (isPaid ? 'PAID' : 'ACTIVE') as 'ACTIVE' | 'PAID',
                payments: [...paymentRecords, ...l.payments]
              }
            : l
        ),
        transactions: [...newTransactions, ...prev.transactions],
        auditLogs: [newAuditLog, ...prev.auditLogs]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(
      isLent
        ? `Collected ${formatETB(totalAmount)} loan repayment from ${targetLoan.counterparty}${effectiveSplits.length > 1 ? ` across ${effectiveSplits.length} wallets` : ''}!`
        : `Paid ${formatETB(totalAmount)} installment to ${targetLoan.counterparty}${effectiveSplits.length > 1 ? ` split across ${effectiveSplits.length} wallets` : ''}!`
    );
    sendExternalNotification('PlusZone ERP - Loan Payment 💳', {
      body: isLent
        ? `Collected ${formatETB(totalAmount)} loan repayment from ${targetLoan.counterparty}.`
        : `Paid ${formatETB(totalAmount)} loan installment to ${targetLoan.counterparty}.`
    });
    performRefresh(true);
  };

  // 10. Create Receivable
  const handleCreateReceivable = (newRcv: Omit<Receivable, 'id' | 'amountCollected' | 'status' | 'createdDate'>) => {
    const created: Receivable = {
      ...newRcv,
      id: `rcv-${Date.now()}`,
      walletId: newRcv.walletId,
      amountCollected: 0,
      status: 'OUTSTANDING',
      createdDate: new Date().toISOString()
    };

    setState(prev => {
      const updatedState = {
        ...prev,
        receivables: [created, ...prev.receivables]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`Receivable invoice for ${created.customerName} recorded.`);
    performRefresh(true);
  };

  // 11. Collect Receivable
  const handleCollectReceivable = (receivableId: string, walletId: string, amount: number) => {
    // 1. Debounce guard: check if this exact receivable was collected in the last 2.5 seconds
    const now = Date.now();
    if (
      lastCollectRef.current &&
      lastCollectRef.current.id === receivableId &&
      lastCollectRef.current.amount === amount &&
      now - lastCollectRef.current.time < 2500
    ) {
      console.warn('Blocked duplicate receivable collection event within 2.5s');
      return;
    }
    lastCollectRef.current = { id: receivableId, amount, time: now };

    const target = state.receivables.find(r => r.id === receivableId);
    if (!target) return;

    // Resolve target wallet with safe fallback
    const targetWallet = state.wallets.find(w => w.id === walletId) || state.wallets.find(w => w.isDefault) || state.wallets[0];
    const resolvedWalletId = targetWallet?.id || walletId || 'w-cash';
    const walletName = targetWallet?.name || 'Wallet';

    const txId = `tx-rcv-${receivableId}-${now}`;
    const auditId = `aud-${receivableId}-${now}`;
    const isoDate = new Date(now).toISOString();

    const newTx: Transaction = {
      id: txId,
      date: isoDate,
      type: 'INCOME',
      amount,
      walletId: resolvedWalletId,
      category: 'Daily Income / Collected',
      description: `Collected from ${target.customerName}`,
      creatorId: state.currentUser.id,
      creatorName: state.currentUser.name,
      branch: state.currentUser.branch,
      refType: 'RECEIVABLE',
      refId: receivableId
    };

    let customerName = target.customerName;

    setState(prev => {
      const currentTarget = prev.receivables.find(r => r.id === receivableId);
      if (!currentTarget) return prev;
      customerName = currentTarget.customerName;

      // Duplicate check: verify if a transaction for this receivable and amount already exists in the last 10 seconds
      const alreadyCollected = prev.transactions.some(
        t => t.refType === 'RECEIVABLE' && t.refId === receivableId && t.amount === amount && (now - new Date(t.date).getTime() < 10000)
      );
      if (alreadyCollected) {
        return prev;
      }

      const newCollected = (currentTarget.amountCollected || 0) + amount;
      const isFull = newCollected >= currentTarget.amountOwed;

      const newAuditLog: AuditLogEntry = {
        id: auditId,
        timestamp: isoDate,
        actorId: prev.currentUser.id,
        actorName: prev.currentUser.name,
        action: 'COLLECT_RECEIVABLE',
        entity: 'Receivable',
        entityId: receivableId,
        diffAfter: {
          amountCollected: amount,
          totalCollected: newCollected,
          walletId: resolvedWalletId,
          walletName,
          customerName: currentTarget.customerName,
          isFullyPaid: isFull
        },
        branch: prev.currentUser.branch
      };

      const updatedReceivables = syncReceivablesLateStatus(prev.receivables.map(r =>
        r.id === receivableId
          ? {
              ...r,
              amountCollected: newCollected,
              status: isFull ? ('COLLECTED' as const) : ('OUTSTANDING' as const),
              lastPaymentDate: isoDate
            }
          : r
      ));

      const updatedState = {
        ...prev,
        receivables: updatedReceivables,
        transactions: [newTx, ...prev.transactions],
        auditLogs: [newAuditLog, ...(prev.auditLogs || [])]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`✓ Collected ${formatETB(amount)} from ${customerName} → Recorded in ${walletName}!`);
    sendExternalNotification('PlusZone ERP - Receivable Collected 💰', {
      body: `Collected from ${customerName}: ${formatETB(amount)} deposited into ${walletName}.`
    });
  };

  // 12. Update & Delete Equb
  const handleUpdateEqub = (equbId: string, updates: Partial<Equb>) => {
    const targetEqub = state.equbs.find(e => e.id === equbId);
    if (!targetEqub) return;

    setState(prev => {
      const updatedState = {
        ...prev,
        equbs: prev.equbs.map(e => e.id === equbId ? { ...e, ...updates } : e),
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: prev.currentUser.id,
            actorName: prev.currentUser.name,
            action: 'UPDATE_EQUB',
            entity: 'Equb',
            entityId: equbId,
            diffAfter: updates,
            branch: prev.currentUser.branch
          },
          ...prev.auditLogs
        ]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`Equb circle "${updates.name || targetEqub.name}" updated.`);
    performRefresh(true);
  };

  const handleDeleteEqub = (equbId: string) => {
    const targetEqub = state.equbs.find(e => e.id === equbId);
    if (!targetEqub) return;

    if (state.currentUser.role !== 'SuperAdmin' && state.currentUser.role !== 'Admin') {
      triggerToast(`⚠️ Admin authorization required to delete equb circles.`);
      return;
    }

    setState(prev => {
      const newDeletedIds = Array.from(new Set([...(prev.deletedEntityIds || []), equbId]));
      const updatedState = {
        ...prev,
        equbs: prev.equbs.filter(e => e.id !== equbId),
        deletedEntityIds: newDeletedIds,
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: prev.currentUser.id,
            actorName: prev.currentUser.name,
            action: 'DELETE_EQUB',
            entity: 'Equb',
            entityId: equbId,
            diffAfter: { deleted: true, name: targetEqub.name },
            branch: prev.currentUser.branch
          },
          ...prev.auditLogs
        ]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`🗑️ Equb circle "${targetEqub.name}" deleted.`);
    performRefresh(true);
  };

  // 13. Update & Delete Loan
  const handleUpdateLoan = (loanId: string, updates: Partial<Loan>) => {
    const targetLoan = state.loans.find(l => l.id === loanId);
    if (!targetLoan) return;

    setState(prev => {
      const updatedState = {
        ...prev,
        loans: prev.loans.map(l => l.id === loanId ? { ...l, ...updates } : l),
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: prev.currentUser.id,
            actorName: prev.currentUser.name,
            action: 'UPDATE_LOAN',
            entity: 'Loan',
            entityId: loanId,
            diffAfter: updates,
            branch: prev.currentUser.branch
          },
          ...prev.auditLogs
        ]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`Loan contract "${updates.title || targetLoan.title}" updated.`);
    performRefresh(true);
  };

  const handleDeleteLoan = (loanId: string) => {
    const targetLoan = state.loans.find(l => l.id === loanId);
    if (!targetLoan) return;

    if (state.currentUser.role !== 'SuperAdmin' && state.currentUser.role !== 'Admin') {
      triggerToast(`⚠️ Admin authorization required to delete loan contracts.`);
      return;
    }

    setState(prev => {
      const newDeletedIds = Array.from(new Set([...(prev.deletedEntityIds || []), loanId]));
      const updatedState = {
        ...prev,
        loans: prev.loans.filter(l => l.id !== loanId),
        deletedEntityIds: newDeletedIds,
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: prev.currentUser.id,
            actorName: prev.currentUser.name,
            action: 'DELETE_LOAN',
            entity: 'Loan',
            entityId: loanId,
            diffAfter: { deleted: true, title: targetLoan.title },
            branch: prev.currentUser.branch
          },
          ...prev.auditLogs
        ]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`🗑️ Loan contract "${targetLoan.title}" deleted.`);
    performRefresh(true);
  };

  const handleUpdateReceivable = (receivableId: string, updates: Partial<Receivable>) => {
    const targetRcv = (state.receivables || []).find(r => r.id === receivableId);
    if (!targetRcv) return;

    setState(prev => {
      const updatedReceivables = syncReceivablesLateStatus((prev.receivables || []).map(r =>
        r.id === receivableId ? { ...r, ...updates } : r
      ));
      const updatedState = {
        ...prev,
        receivables: updatedReceivables,
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: prev.currentUser.id,
            actorName: prev.currentUser.name,
            action: 'UPDATE_RECEIVABLE',
            entity: 'Receivable',
            entityId: receivableId,
            diffBefore: targetRcv,
            diffAfter: { ...targetRcv, ...updates },
            branch: prev.currentUser.branch
          },
          ...(prev.auditLogs || [])
        ]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`Customer receivable for "${updates.customerName || targetRcv.customerName}" updated.`);
    performRefresh(true);
  };

  const handleDeleteReceivable = (receivableId: string) => {
    const targetRcv = (state.receivables || []).find(r => r.id === receivableId);
    if (!targetRcv) return;

    if (state.currentUser.role !== 'SuperAdmin' && state.currentUser.role !== 'Admin') {
      triggerToast(`⚠️ Admin authorization required to delete receivables.`);
      return;
    }

    setState(prev => {
      const newDeletedIds = Array.from(new Set([...(prev.deletedEntityIds || []), receivableId]));
      const updatedState = {
        ...prev,
        receivables: (prev.receivables || []).filter(r => r.id !== receivableId),
        deletedEntityIds: newDeletedIds,
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: prev.currentUser.id,
            actorName: prev.currentUser.name,
            action: 'DELETE_RECEIVABLE',
            entity: 'Receivable',
            entityId: receivableId,
            diffAfter: { deleted: true, customerName: targetRcv.customerName },
            branch: prev.currentUser.branch
          },
          ...(prev.auditLogs || [])
        ]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`🗑️ Customer receivable for "${targetRcv.customerName}" deleted.`);
    performRefresh(true);
  };

  // 14. Approval Request Handlers
  const handleCreateApprovalRequest = (reqData: Omit<AdminApprovalRequest, 'id' | 'createdAt' | 'requestedBy' | 'requestedByName' | 'status'>) => {
    const reasonText = reqData.reason || `Co-admin authorization requested for ${reqData.actionType.replace(/_/g, ' ')}`;
    const newReq: AdminApprovalRequest = {
      ...reqData,
      reason: reasonText,
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
      requestedBy: state.currentUser.id,
      requestedByName: state.currentUser.name,
      status: 'PENDING'
    };

    const chatMsg: ChatMessage = {
      id: `msg-appr-${Date.now()}`,
      channelId: 'financial-approvals',
      senderId: state.currentUser.id,
      senderName: state.currentUser.name,
      senderRole: state.currentUser.role,
      text: `📋 **New Approval Request Submitted**\n• **Item:** ${newReq.targetTitle}\n• **Action:** ${newReq.actionType.replace(/_/g, ' ')}\n• **Reason:** ${reasonText}\n• **Requested By:** ${newReq.requestedByName}${newReq.targetAdminName ? `\n• **Assigned Co-Admin:** ${newReq.targetAdminName}` : ''}`,
      timestamp: new Date().toISOString(),
      reference: {
        type: 'APPROVAL',
        id: newReq.id,
        title: `Approval Request: ${newReq.targetTitle}`,
        subtitle: `Action: ${newReq.actionType.replace(/_/g, ' ')}`,
        reason: reasonText,
        status: 'PENDING'
      }
    };

    // Realtime chat broadcast for approvals channel
    sendChatMessageImmediately(chatMsg);

    setState(prev => {
      const updatedState = {
        ...prev,
        approvalRequests: [newReq, ...(prev.approvalRequests || [])],
        chatMessages: [...(prev.chatMessages || []), chatMsg]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`📋 Approval request with reason posted to live chat.`);
    performRefresh(true);
  };

  const handleResetAllData = async () => {
    try {
      const { createInitialState } = await import('./lib/store');
      const clean = createInitialState();
      await syncStateToFirebaseNow(clean, true);
      localStorage.clear();
    } catch (_) {}
    window.location.reload();
  };

  const handleApproveRequest = (reqId: string, approvalNote?: string) => {
    const req = (state.approvalRequests || []).find(r => r.id === reqId);
    if (!req) return;

    const activeOtherUsers = (state.users || []).filter(u => u.id !== state.currentUser.id && u.active !== false);
    if (req.requestedBy === state.currentUser.id && activeOtherUsers.length > 0) {
      triggerToast(`⚠️ 2-User Rule: Requests must be approved by a different admin or user!`);
      return;
    }

    triggerHaptic('success');

    const effectiveReason = approvalNote || req.reason || 'Verified and approved by co-admin';
    const approveMsg: ChatMessage = {
      id: `msg-appr-ok-${Date.now()}`,
      channelId: 'financial-approvals',
      senderId: state.currentUser.id,
      senderName: state.currentUser.name,
      senderRole: state.currentUser.role,
      text: `✅ **Approval Granted & Executed**\n• **Item:** ${req.targetTitle}\n• **Action:** ${req.actionType.replace(/_/g, ' ')}\n• **Reason for Approval:** ${effectiveReason}\n• **Approved By:** ${state.currentUser.name}`,
      timestamp: new Date().toISOString(),
      reference: {
        type: 'APPROVAL',
        id: req.id,
        title: `Approved: ${req.targetTitle}`,
        subtitle: `Action: ${req.actionType.replace(/_/g, ' ')}`,
        reason: effectiveReason,
        status: 'APPROVED'
      }
    };

    let toastText = `✅ Approval granted for "${req.targetTitle}". Change automatically executed!`;

    sendChatMessageToFirebase(approveMsg);

    setState(prev => {
      let updatedTransactions = prev.transactions;
      let updatedEqubs = prev.equbs;
      let updatedLoans = prev.loans;
      let updatedReceivables = prev.receivables || [];
      let updatedWallets = prev.wallets;
      let updatedUsers = prev.users;
      let updatedCategories = prev.categories;
      let updatedAssets = prev.assets || [];
      let updatedDeletedEntityIds = prev.deletedEntityIds || [];
      const newAuditLogs: AuditLogEntry[] = [];

      if (req.actionType === 'DELETE_TRANSACTION') {
        const consolidated = consolidateEqubSplitTransactions(prev.transactions, prev.wallets);
        const deletedTx = prev.transactions.find(t => t.id === req.targetId) || consolidated.find(t => t.id === req.targetId);
        const idsToDelete = new Set<string>([req.targetId]);
        if (deletedTx) {
          idsToDelete.add(deletedTx.id);
          const batchPrefix = deletedTx.id.replace(/-\d+$/, '');
          if (batchPrefix !== deletedTx.id) {
            prev.transactions.forEach(t => {
              if (t.id.startsWith(batchPrefix)) idsToDelete.add(t.id);
            });
          }
          if (isEqubContributionTransaction(deletedTx)) {
            const targetEqub = findMatchingEqub(deletedTx, prev.equbs);
            if (targetEqub) {
              const { updatedEqub, restoredRound } = revertEqubForDeletedContribution(targetEqub, deletedTx);
              updatedEqubs = prev.equbs.map(e => e.id === targetEqub.id ? updatedEqub : e);
              toastText = `🗑️ Equb contribution deleted. ${targetEqub.name} updated back to Round #${restoredRound}!`;
            }
          } else if (isEqubPayoutTransaction(deletedTx)) {
            const targetEqub = findMatchingEqub(deletedTx, prev.equbs);
            if (targetEqub) {
              updatedEqubs = prev.equbs.map(e => e.id === targetEqub.id ? revertEqubForDeletedPayout(e) : e);
            }
          }
        }
        updatedTransactions = prev.transactions.filter(t => !idsToDelete.has(t.id));
        updatedDeletedEntityIds = Array.from(new Set([...updatedDeletedEntityIds, ...Array.from(idsToDelete)]));
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_TRANSACTION',
          entity: 'Transaction',
          entityId: req.targetId,
          diffBefore: deletedTx,
          diffAfter: { deleted: true },
          branch: prev.currentUser.branch
        });
        if (!toastText.includes('Equb')) {
          toastText = `🗑️ Transaction deleted from financial ledger.`;
        }
      } else if (req.actionType === 'EDIT_TRANSACTION' && req.payload) {
        const existingTx = prev.transactions.find(t => t.id === req.targetId) ||
          consolidateEqubSplitTransactions(prev.transactions, prev.wallets).find(t => t.id === req.targetId);
        const siblingIdsToRemove = new Set<string>();
        if (existingTx?.siblingTxIds && Array.isArray(existingTx.siblingTxIds)) {
          existingTx.siblingTxIds.forEach(id => siblingIdsToRemove.add(id));
        }
        const updatedItem = {
          ...(existingTx || {}),
          ...req.payload,
          id: req.targetId,
          splits: req.payload.splits && req.payload.splits.length > 0 ? req.payload.splits : undefined
        } as Transaction;

        let found = false;
        const mapped = prev.transactions
          .filter(t => !siblingIdsToRemove.has(t.id))
          .map(t => {
            if (t.id === req.targetId) {
              found = true;
              return updatedItem;
            }
            return t;
          });
        updatedTransactions = (found ? mapped : [updatedItem, ...mapped])
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'UPDATE_TRANSACTION',
          entity: 'Transaction',
          entityId: req.targetId,
          diffBefore: existingTx,
          diffAfter: req.payload,
          branch: prev.currentUser.branch
        });
        toastText = `✏️ Transaction updated in financial ledger.`;
      } else if (req.actionType === 'REVERSE_TRANSACTION') {
        const consolidated = consolidateEqubSplitTransactions(prev.transactions, prev.wallets);
        const existingTx = prev.transactions.find(t => t.id === req.targetId) || consolidated.find(t => t.id === req.targetId);
        const idsToReverse = new Set<string>([req.targetId]);
        if (existingTx) {
          idsToReverse.add(existingTx.id);
          const batchPrefix = existingTx.id.replace(/-\d+$/, '');
          if (batchPrefix !== existingTx.id) {
            prev.transactions.forEach(t => {
              if (t.id.startsWith(batchPrefix)) idsToReverse.add(t.id);
            });
          }
          if (isEqubContributionTransaction(existingTx)) {
            const targetEqub = findMatchingEqub(existingTx, prev.equbs);
            if (targetEqub) {
              const { updatedEqub, restoredRound } = revertEqubForDeletedContribution(targetEqub, existingTx);
              updatedEqubs = prev.equbs.map(e => e.id === targetEqub.id ? updatedEqub : e);
              toastText = `↩️ Equb contribution reversed. ${targetEqub.name} updated back to Round #${restoredRound}!`;
            }
          } else if (isEqubPayoutTransaction(existingTx)) {
            const targetEqub = findMatchingEqub(existingTx, prev.equbs);
            if (targetEqub) {
              updatedEqubs = prev.equbs.map(e => e.id === targetEqub.id ? revertEqubForDeletedPayout(e) : e);
            }
          }
        }
        updatedTransactions = prev.transactions.map(t =>
          idsToReverse.has(t.id) ? { ...t, reversed: true, reversedAt: new Date().toISOString() } : t
        );
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'REVERSE_TRANSACTION',
          entity: 'Transaction',
          entityId: req.targetId,
          diffBefore: existingTx,
          diffAfter: { reversed: true, reversedAt: new Date().toISOString() },
          branch: prev.currentUser.branch
        });
        if (!toastText.includes('Equb')) {
          toastText = `↩️ Transaction reversed in financial ledger.`;
        }
      } else if (req.actionType === 'DELETE_EQUB') {
        const targetEqub = prev.equbs.find(e => e.id === req.targetId);
        updatedEqubs = prev.equbs.filter(e => e.id !== req.targetId);
        if (req.targetId && !updatedDeletedEntityIds.includes(req.targetId)) {
          updatedDeletedEntityIds = [...updatedDeletedEntityIds, req.targetId];
        }
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_EQUB',
          entity: 'Equb',
          entityId: req.targetId,
          diffBefore: targetEqub,
          diffAfter: { deleted: true, name: targetEqub?.name },
          branch: prev.currentUser.branch
        });
        toastText = `🗑️ Equb circle "${targetEqub?.name || req.targetTitle}" deleted.`;
      } else if (req.actionType === 'EDIT_EQUB' && req.payload) {
        const targetEqub = prev.equbs.find(e => e.id === req.targetId);
        updatedEqubs = prev.equbs.map(e => e.id === req.targetId ? { ...e, ...req.payload } : e);
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'UPDATE_EQUB',
          entity: 'Equb',
          entityId: req.targetId,
          diffBefore: targetEqub,
          diffAfter: req.payload,
          branch: prev.currentUser.branch
        });
        toastText = `✏️ Equb circle "${targetEqub?.name || req.targetTitle}" updated.`;
      } else if (req.actionType === 'DELETE_LOAN') {
        const targetLoan = prev.loans.find(l => l.id === req.targetId);
        updatedLoans = prev.loans.filter(l => l.id !== req.targetId);
        if (req.targetId && !updatedDeletedEntityIds.includes(req.targetId)) {
          updatedDeletedEntityIds = [...updatedDeletedEntityIds, req.targetId];
        }
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_LOAN',
          entity: 'Loan',
          entityId: req.targetId,
          diffBefore: targetLoan,
          diffAfter: { deleted: true, title: targetLoan?.title },
          branch: prev.currentUser.branch
        });
        toastText = `🗑️ Loan contract "${targetLoan?.title || req.targetTitle}" deleted.`;
      } else if (req.actionType === 'EDIT_LOAN' && req.payload) {
        const targetLoan = prev.loans.find(l => l.id === req.targetId);
        updatedLoans = prev.loans.map(l => l.id === req.targetId ? { ...l, ...req.payload } : l);
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'UPDATE_LOAN',
          entity: 'Loan',
          entityId: req.targetId,
          diffBefore: targetLoan,
          diffAfter: req.payload,
          branch: prev.currentUser.branch
        });
        toastText = `✏️ Loan contract "${targetLoan?.title || req.targetTitle}" updated.`;
      } else if (req.actionType === 'DELETE_RECEIVABLE') {
        const targetRcv = (prev.receivables || []).find(r => r.id === req.targetId);
        updatedReceivables = (prev.receivables || []).filter(r => r.id !== req.targetId);
        if (req.targetId && !updatedDeletedEntityIds.includes(req.targetId)) {
          updatedDeletedEntityIds = [...updatedDeletedEntityIds, req.targetId];
        }
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_RECEIVABLE',
          entity: 'Receivable',
          entityId: req.targetId,
          diffBefore: targetRcv,
          diffAfter: { deleted: true, customerName: targetRcv?.customerName },
          branch: prev.currentUser.branch
        });
        toastText = `🗑️ Customer receivable for "${targetRcv?.customerName || req.targetTitle}" deleted.`;
      } else if (req.actionType === 'EDIT_RECEIVABLE' && req.payload) {
        const targetRcv = (prev.receivables || []).find(r => r.id === req.targetId);
        updatedReceivables = syncReceivablesLateStatus(
          (prev.receivables || []).map(r => r.id === req.targetId ? { ...r, ...req.payload } : r)
        );
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'UPDATE_RECEIVABLE',
          entity: 'Receivable',
          entityId: req.targetId,
          diffBefore: targetRcv,
          diffAfter: req.payload,
          branch: prev.currentUser.branch
        });
        toastText = `✏️ Customer receivable for "${targetRcv?.customerName || req.targetTitle}" updated.`;
      } else if (req.actionType === 'DELETE_WALLET') {
        const targetWallet = prev.wallets.find(w => w.id === req.targetId);
        updatedWallets = prev.wallets.filter(w => w.id !== req.targetId);
        if (req.targetId && !updatedDeletedEntityIds.includes(req.targetId)) {
          updatedDeletedEntityIds = [...updatedDeletedEntityIds, req.targetId];
        }
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_WALLET',
          entity: 'Wallet',
          entityId: req.targetId,
          diffBefore: targetWallet,
          diffAfter: { deleted: true, name: targetWallet?.name },
          branch: prev.currentUser.branch
        });
        toastText = `🗑️ Wallet "${targetWallet?.name || req.targetTitle}" deleted.`;
      } else if (req.actionType === 'EDIT_WALLET' && req.payload) {
        const targetWallet = prev.wallets.find(w => w.id === req.targetId);
        updatedWallets = prev.wallets.map(w => w.id === req.targetId ? { ...w, ...req.payload } : w);
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'UPDATE_WALLET',
          entity: 'Wallet',
          entityId: req.targetId,
          diffBefore: targetWallet,
          diffAfter: req.payload,
          branch: prev.currentUser.branch
        });
        toastText = `✏️ Wallet "${targetWallet?.name || req.targetTitle}" updated.`;
      } else if (req.actionType === 'DELETE_USER') {
        const targetUser = prev.users.find(u => u.id === req.targetId);
        updatedUsers = prev.users.filter(u => u.id !== req.targetId);
        if (req.targetId && !updatedDeletedEntityIds.includes(req.targetId)) {
          updatedDeletedEntityIds = [...updatedDeletedEntityIds, req.targetId];
        }
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_USER',
          entity: 'User',
          entityId: req.targetId,
          diffBefore: targetUser,
          diffAfter: { deleted: true, name: targetUser?.name },
          branch: prev.currentUser.branch
        });
        toastText = `🗑️ User profile "${targetUser?.name || req.targetTitle}" deleted.`;
      } else if ((req.actionType as string) === 'DELETE_CATEGORY') {
        const targetCat = prev.categories.find(c => c.id === req.targetId);
        updatedCategories = prev.categories.filter(c => c.id !== req.targetId);
        if (req.targetId && !updatedDeletedEntityIds.includes(req.targetId)) {
          updatedDeletedEntityIds = [...updatedDeletedEntityIds, req.targetId];
        }
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_CATEGORY',
          entity: 'Category',
          entityId: req.targetId,
          diffBefore: targetCat,
          diffAfter: { deleted: true, name: targetCat?.name },
          branch: prev.currentUser.branch
        });
        toastText = `🗑️ Category "${targetCat?.name || req.targetTitle}" deleted.`;
      } else if (req.actionType === 'DELETE_ASSET') {
        const targetAsset = (prev.assets || []).find(a => a.id === req.targetId);
        updatedAssets = (prev.assets || []).filter(a => a.id !== req.targetId);
        if (req.targetId && !updatedDeletedEntityIds.includes(req.targetId)) {
          updatedDeletedEntityIds = [...updatedDeletedEntityIds, req.targetId];
        }
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_ASSET',
          entity: 'Asset',
          entityId: req.targetId,
          diffBefore: targetAsset,
          diffAfter: { deleted: true, name: targetAsset?.name },
          branch: prev.currentUser.branch
        });
        toastText = `🗑️ Asset "${targetAsset?.name || req.targetTitle}" deleted.`;
      } else if (req.actionType === 'CLEAR_ALL_TRANSACTIONS') {
        updatedTransactions = [];
        newAuditLogs.push({
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'CLEAR_ALL_TRANSACTIONS',
          entity: 'Transaction',
          entityId: 'all',
          diffAfter: { clearedCount: prev.transactions.length },
          branch: prev.currentUser.branch
        });
        toastText = `🗑️ All transactions cleared from ledger.`;
      } else if (req.actionType === 'RESTORE_BACKUP' && req.payload) {
        const restoredState = req.payload;
        const updatedState = {
          ...prev,
          ...restoredState,
          approvalRequests: (prev.approvalRequests || []).map(r => r.id === reqId ? {
            ...r,
            status: 'APPROVED' as const,
            approvedBy: prev.currentUser.id,
            approvedByName: prev.currentUser.name,
            approvedAt: new Date().toISOString()
          } : r),
          chatMessages: [...(prev.chatMessages || []), approveMsg]
        };
        saveStateToStorage(updatedState);
        syncStateToFirebaseNow(updatedState);
        return updatedState;
      } else if (req.actionType === 'SYSTEM_RESET') {
        localStorage.clear();
        window.location.reload();
        return prev;
      }

      const updatedState = {
        ...prev,
        deletedEntityIds: updatedDeletedEntityIds,
        transactions: updatedTransactions,
        equbs: updatedEqubs,
        loans: updatedLoans,
        receivables: updatedReceivables,
        wallets: updatedWallets,
        users: updatedUsers,
        categories: updatedCategories,
        assets: updatedAssets,
        auditLogs: [...newAuditLogs, ...(prev.auditLogs || [])],
        approvalRequests: (prev.approvalRequests || []).map(r => r.id === reqId ? {
          ...r,
          status: 'APPROVED' as const,
          approvedBy: prev.currentUser.id,
          approvedByName: prev.currentUser.name,
          approvedAt: new Date().toISOString()
        } : r),
        chatMessages: [...(prev.chatMessages || []), approveMsg]
      };

      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(toastText);
    performRefresh(true);
  };

  const handleRejectRequest = (reqId: string, rejectionNote?: string) => {
    const req = (state.approvalRequests || []).find(r => r.id === reqId);
    if (!req) return;

    const effectiveReason = rejectionNote || req.reason || 'Denied by co-admin';
    const rejectMsg: ChatMessage = {
      id: `msg-appr-rej-${Date.now()}`,
      channelId: 'financial-approvals',
      senderId: state.currentUser.id,
      senderName: state.currentUser.name,
      senderRole: state.currentUser.role,
      text: `❌ **Approval Request Rejected**\n• **Item:** ${req.targetTitle}\n• **Action:** ${req.actionType.replace(/_/g, ' ')}\n• **Reason for Rejection:** ${effectiveReason}\n• **Rejected By:** ${state.currentUser.name}`,
      timestamp: new Date().toISOString(),
      reference: {
        type: 'APPROVAL',
        id: req.id,
        title: `Rejected: ${req.targetTitle}`,
        subtitle: `Action: ${req.actionType.replace(/_/g, ' ')}`,
        reason: effectiveReason,
        status: 'REJECTED'
      }
    };

    sendChatMessageToFirebase(rejectMsg);

    setState(prev => {
      const updatedState = {
        ...prev,
        approvalRequests: (prev.approvalRequests || []).map(r => r.id === reqId ? {
          ...r,
          status: 'REJECTED' as const,
          approvedBy: prev.currentUser.id,
          approvedByName: prev.currentUser.name,
          approvedAt: new Date().toISOString()
        } : r),
        chatMessages: [...(prev.chatMessages || []), rejectMsg]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });

    triggerToast(`❌ Approval request rejected and status posted to live chat.`);
    performRefresh(true);
  };

  const headerNotifications = React.useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      message: string;
      type: 'HIGH' | 'MEDIUM' | 'INFO';
      time: string;
      timestamp: number;
      actionTab?: NavTab;
    }> = [];

    // Pending Approval Requests for Admins & SuperAdmins
    const pendingReqs = (state.approvalRequests || []).filter(r => r.status === 'PENDING');
    if (pendingReqs.length > 0 && (state.currentUser.role === 'SuperAdmin' || state.currentUser.role === 'Admin')) {
      const latestReq = pendingReqs[0];
      const reqTime = latestReq.createdAt ? new Date(latestReq.createdAt).getTime() : Date.now();
      list.push({
        id: `notif-approval-summary-${latestReq.id}`,
        title: `⚠️ ${pendingReqs.length} Action(s) Pending Admin Approval`,
        message: `Major changes requested by ${latestReq.requestedByName} (${latestReq.actionType.replace(/_/g, ' ')}) need sign-off.`,
        type: 'HIGH',
        time: formatRelativeNotifTime(reqTime),
        timestamp: reqTime,
        actionTab: 'equb'
      });
    }

    // Recent Transactions (include top 5 latest transactions)
    const sortedTxs = [...state.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (sortedTxs.length > 0) {
      sortedTxs.slice(0, 5).forEach(tx => {
        const txTime = new Date(tx.date).getTime();
        list.push({
          id: `notif-tx-${tx.id}`,
          title: `Ledger Entry: ${tx.category}`,
          message: `${getTransactionDisplayTitle(tx, state.receivables)} (${tx.type === 'INCOME' ? '+' : '-'}${formatETB(tx.amount)}) by ${tx.creatorName}`,
          type: 'INFO',
          time: formatRelativeNotifTime(txTime),
          timestamp: txTime,
          actionTab: 'transactions'
        });
      });
    }

    // Active Equb Round Dues
    state.equbs.filter(e => e.status === 'ACTIVE').forEach(eq => {
      const eqTime = new Date(eq.startDate).getTime() || Date.now();
      list.push({
        id: `notif-eq-${eq.id}-r${eq.currentRound}`,
        title: `Equb Round #${eq.currentRound} Due`,
        message: `${eq.name} contribution of ${formatETB(eq.contributionPerRound)} is due.`,
        type: 'MEDIUM',
        time: 'Today',
        timestamp: eqTime + 100,
        actionTab: 'equb'
      });
    });

    // Active Loan Notifications
    state.loans.filter(l => l.status === 'ACTIVE').forEach(l => {
      const loanTime = new Date(l.dueDate).getTime() || Date.now();
      list.push({
        id: `notif-loan-${l.id}`,
        title: `Loan Repayment Scheduled`,
        message: `${l.counterparty || l.title} payment of ${formatETB(l.monthlyInstallment || l.outstandingBalance)}. Rem: ${formatETB(l.outstandingBalance)}.`,
        type: 'HIGH',
        time: 'Upcoming',
        timestamp: loanTime + 200,
        actionTab: 'more'
      });
    });

    // Uncollected Receivables Alert
    const uncollectedReceivablesTotal = (state.receivables || [])
      .filter(r => r.status === 'OUTSTANDING')
      .reduce((sum, r) => sum + (r.amountOwed - r.amountCollected), 0);
    if (uncollectedReceivablesTotal > 0) {
      list.push({
        id: 'notif-rcv-total',
        title: 'Outstanding Debtors & Invoices',
        message: `${formatETB(uncollectedReceivablesTotal)} waiting for customer collection.`,
        type: 'MEDIUM',
        time: 'Pending',
        timestamp: Date.now() - 3600000,
        actionTab: 'more'
      });
    }

    // Unread Team Chat Messages & Announcements
    const unreadMsgs = (state.chatMessages || []).filter(
      m => m.senderId !== state.currentUser.id && new Date(m.timestamp).getTime() > lastSeenChatTime
    );
    if (unreadMsgs.length > 0) {
      const latestUnread = unreadMsgs[unreadMsgs.length - 1];
      const msgTime = new Date(latestUnread.timestamp).getTime();
      list.push({
        id: `notif-chat-summary-${latestUnread.id}`,
        title: latestUnread.isAnnouncement ? `📢 Announcement • ${latestUnread.senderName}` : `💬 ${latestUnread.senderName} (${unreadMsgs.length} new msg${unreadMsgs.length > 1 ? 's' : ''})`,
        message: latestUnread.text || 'Shared a media attachment or financial reference in team chat.',
        type: latestUnread.isAnnouncement ? 'HIGH' : 'MEDIUM',
        time: formatRelativeNotifTime(msgTime),
        timestamp: msgTime + 400,
        actionTab: 'chat'
      });
    }

    // Filter out dismissed notifications & float alerts so seen ones stay removed!
    const unreadList = list.filter(n =>
      !dismissedNotifIds.includes(n.id) &&
      !n.title.toLowerCase().includes('float') &&
      !n.message.toLowerCase().includes('float')
    );

    // Sort descending by timestamp (LATEST FIRST)
    return unreadList.sort((a, b) => b.timestamp - a.timestamp);
  }, [state.equbs, state.loans, state.wallets, state.transactions, state.transfers, state.approvalRequests, state.receivables, state.chatMessages, state.currentUser, dismissedNotifIds, lastSeenChatTime, autoNotificationTicker]);

  const handleClearAllNotifications = React.useCallback(() => {
    const allIds = headerNotifications.map(n => n.id);
    setDismissedNotifIds(prev => Array.from(new Set([...prev, ...allIds])));
  }, [headerNotifications]);

  // Chat handlers
  const unreadChatCount = activeTab === 'chat'
    ? 0
    : (state.chatMessages || []).filter(
        m => m.senderId !== state.currentUser.id && new Date(m.timestamp).getTime() > lastSeenChatTime
      ).length;

  const handleSendMessage = (msgData: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    playNotificationSound('chat');
    triggerHaptic('light');

    const newMsg: ChatMessage = {
      ...msgData,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };

    locallySentMsgIdsRef.current.add(newMsg.id);

    // 1. Immediate optimistic UI update (0ms local delay)
    setState(prev => {
      const currentMsgs = prev.chatMessages || [];
      const updatedMsgs = [...currentMsgs, newMsg];
      const updatedState = {
        ...prev,
        chatMessages: updatedMsgs
      };
      saveStateToStorage(updatedState);
      return updatedState;
    });

    // 2. Immediate 0ms cross-tab broadcast + direct concurrent Firestore write
    sendChatMessageImmediately(newMsg);
  };

  const handleDeleteChatMessage = (messageId: string) => {
    triggerHaptic('warning');

    // 1. Immediate optimistic UI update (0ms local delay)
    setState(prev => {
      const currentMsgs = prev.chatMessages || [];
      const updatedMsgs = currentMsgs.filter(m => m.id !== messageId);
      const updatedState = {
        ...prev,
        chatMessages: updatedMsgs
      };
      saveStateToStorage(updatedState);
      return updatedState;
    });

    // 2. Immediate 0ms cross-tab broadcast + direct Firestore deletion
    deleteChatMessageImmediately(messageId);
  };

  const handleAddChatReaction = (messageId: string, emoji: string) => {
    setState(prev => {
      let finalReactions: ChatMessageReaction[] = [];
      const updatedMsgs = (prev.chatMessages || []).map(msg => {
        if (msg.id !== messageId) return msg;

        const currentReactions = msg.reactions ? [...msg.reactions] : [];
        const existingIdx = currentReactions.findIndex(r => r.emoji === emoji);

        if (existingIdx >= 0) {
          const react = currentReactions[existingIdx];
          const hasReacted = react.users.includes(prev.currentUser.id);

          if (hasReacted) {
            const newUsers = react.users.filter(u => u !== prev.currentUser.id);
            if (newUsers.length === 0) {
              currentReactions.splice(existingIdx, 1);
            } else {
              currentReactions[existingIdx] = {
                ...react,
                count: newUsers.length,
                users: newUsers
              };
            }
          } else {
            currentReactions[existingIdx] = {
              ...react,
              count: react.count + 1,
              users: [...react.users, prev.currentUser.id]
            };
          }
        } else {
          currentReactions.push({
            emoji,
            count: 1,
            users: [prev.currentUser.id]
          });
        }

        finalReactions = currentReactions;
        return { ...msg, reactions: currentReactions };
      });

      // Push real-time reaction update to 0ms cross-tab broadcast and Firestore
      if (finalReactions) {
        updateChatReactionImmediately(messageId, finalReactions);
      }

      const updatedState = { ...prev, chatMessages: updatedMsgs };
      saveStateToStorage(updatedState);
      return updatedState;
    });
  };

  const handleCreateChatChannel = (channelData: Omit<ChatChannel, 'id' | 'createdDate'>) => {
    const newChan: ChatChannel = {
      ...channelData,
      id: channelData.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      createdDate: new Date().toISOString()
    };

    setState(prev => {
      const existing = (prev.chatChannels || []).find(c => c.id === newChan.id);
      if (existing) return prev;

      const updatedChans = [...(prev.chatChannels || []), newChan];
      const updatedState = { ...prev, chatChannels: updatedChans };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });
  };

  const handleRegisterUser = (newUser: UserProfile) => {
    setState((prev) => {
      const userExists = prev.users.some(
        (u) =>
          u.id === newUser.id ||
          (newUser.email && u.email?.toLowerCase() === newUser.email.toLowerCase()) ||
          (newUser.username && u.username?.toLowerCase() === newUser.username.toLowerCase())
      );
      const updatedUsers = userExists
        ? prev.users.map((u) =>
            u.id === newUser.id ||
            (newUser.email && u.email?.toLowerCase() === newUser.email.toLowerCase()) ||
            (newUser.username && u.username?.toLowerCase() === newUser.username.toLowerCase())
              ? { ...u, ...newUser, active: true, isApproved: true }
              : u
          )
        : [...prev.users, newUser];
      const regTx: Transaction = {
        id: `tx-reg-${newUser.id}`,
        date: new Date().toISOString(),
        type: 'INCOME',
        category: 'Genesis / Setup',
        amount: 0,
        walletId: 'w-cash',
        description: `Member Account Registered: ${newUser.name} (@${newUser.username || newUser.email}) [${newUser.role}]`,
        creatorName: newUser.name,
        creatorId: newUser.id,
        refId: newUser.id
      };
      const txAlreadyExists = prev.transactions.some((t) => t.id === regTx.id || t.refId === newUser.id);
      const updatedTransactions = txAlreadyExists ? prev.transactions : [regTx, ...prev.transactions];

      const updatedState = {
        ...prev,
        users: updatedUsers,
        transactions: updatedTransactions,
        auditLogs: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorId: newUser.id,
            actorName: newUser.name,
            action: 'CREATE_USER_REGISTERED',
            entity: 'UserProfile',
            entityId: newUser.id,
            diffAfter: { name: newUser.name, email: newUser.email, role: newUser.role, isApproved: true },
            branch: newUser.branch
          },
          ...prev.auditLogs
        ]
      };
      saveStateToStorage(updatedState);
      syncStateToFirebaseNow(updatedState);
      return updatedState;
    });
  };

  if (showSplashScreen) {
    return <AppSplashScreen onFinish={() => setShowSplashScreen(false)} />;
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        allUsers={state.users}
        currentUser={state.currentUser}
        onLogin={(selectedUser: UserProfile, rememberSession: boolean = true) => {
          saveAuthSession(selectedUser, rememberSession);
          setState((prev) => {
            const userExists = prev.users.some(
              (u) =>
                u.id === selectedUser.id ||
                (selectedUser.email && u.email?.toLowerCase() === selectedUser.email.toLowerCase())
            );
            const updatedUsers = userExists
              ? prev.users.map((u) =>
                  u.id === selectedUser.id ||
                  (selectedUser.email && u.email?.toLowerCase() === selectedUser.email.toLowerCase())
                    ? selectedUser
                    : u
                )
              : [...prev.users, selectedUser];
            const txAlreadyExists = prev.transactions.some((t) => t.id === `tx-reg-${selectedUser.id}` || t.refId === selectedUser.id);
            const updatedTransactions = (!userExists && !txAlreadyExists)
              ? [
                  {
                    id: `tx-reg-${selectedUser.id}`,
                    date: new Date().toISOString(),
                    type: 'INCOME' as const,
                    category: 'Genesis / Setup',
                    amount: 0,
                    walletId: 'w-cash',
                    description: `Member Account Registered: ${selectedUser.name} (@${selectedUser.username || selectedUser.email}) [${selectedUser.role}]`,
                    creatorName: selectedUser.name,
                    creatorId: selectedUser.id,
                    refId: selectedUser.id
                  },
                  ...prev.transactions
                ]
              : prev.transactions;
            const updated = {
              ...prev,
              currentUser: selectedUser,
              users: updatedUsers,
              transactions: updatedTransactions
            };
            saveStateToStorage(updated);
            syncStateToFirebaseNow(updated);
            return updated;
          });
          setIsLoggedIn(true);

          // Check if first-time onboarding tour should auto-trigger
          const storedSeen = localStorage.getItem(`has_seen_onboarding_${selectedUser.id}`) || localStorage.getItem(ONBOARDING_STORAGE_KEY);
          if (!selectedUser.has_seen_onboarding && !storedSeen) {
            setTimeout(() => {
              setIsTourActive(true);
              setTourStepIndex(0);
            }, 650);
          }
        }}
        onRegisterUser={handleRegisterUser}
        theme={state.theme}
        onToggleTheme={() =>
          setState((prev) => ({
            ...prev,
            theme: prev.theme === 'dark' ? 'light' : 'dark'
          }))
        }
      />
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${state.theme === 'dark' ? 'dark bg-[#0A0E1A] text-[#F0F4FF]' : 'bg-[#F8FAFC] text-slate-900'}`}>
      
      {/* Cloud Firestore Free Tier Quota Alert Banner */}
      <FirestoreQuotaBanner state={state} />

      {/* Specific Confirmation Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#00D4AA] text-[#0A0E1A] font-bold text-xs px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#0A0E1A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        currentUser={state.currentUser}
        allUsers={state.users}
        onSwitchUser={(user: UserProfile) => {
          setState(prev => ({ ...prev, currentUser: user }));
          updateAuthSessionUser(user);
        }}
        onLogout={handleLogout}
        onLockSession={() => setIsSessionLocked(true)}
        theme={state.theme}
        onToggleTheme={() => setState(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))}
        hideBalances={state.hideBalances}
        onToggleHideBalances={() => setState(prev => ({ ...prev, hideBalances: !prev.hideBalances }))}
        onNavigateTab={(tab: any, subView?: any) => handleNavigateTab(tab, subView)}
        notifications={headerNotifications}
        onDismissNotification={handleDismissNotification}
        onClearAllNotifications={handleClearAllNotifications}
        lastRefreshedAt={lastRefreshedAt}
        isRefreshing={isRefreshing}
        autoRefreshEnabled={autoRefreshEnabled}
        calendarType={state.calendarType || 'GREGORIAN'}
        onToggleCalendarType={(type) => {
          if (typeof window !== 'undefined') localStorage.setItem('pluszone_calendar_user_choice', type);
          setState(prev => ({ ...prev, calendarType: type }));
        }}
        onToggleAutoRefresh={() => setAutoRefreshEnabled(prev => !prev)}
        onManualRefresh={() => performRefresh(true)}
        unreadChatCount={unreadChatCount}
      />

      {/* Main Screen Container */}
      <main className="max-w-md md:max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-28">
        {activeTab === 'dashboard' && (
          <DashboardView
            currentUser={state.currentUser}
            wallets={state.wallets}
            transactions={state.transactions}
            transfers={state.transfers}
            equbs={state.equbs}
            loans={state.loans}
            recurring={state.recurring}
            receivables={state.receivables}
            shopHours={state.shopHours}
            onUpdateShopHours={handleUpdateShopHours}
            hideBalances={state.hideBalances}
            calendarType={state.calendarType || 'GREGORIAN'}
            dismissedNotifIds={dismissedNotifIds}
            onDismissNotification={handleDismissNotification}
            onClearAllNotifications={handleClearAllNotifications}
            onToggleHideBalances={() => setState(prev => ({ ...prev, hideBalances: !prev.hideBalances }))}
            onOpenQuickEntry={() => setShowQuickEntry(true)}
            onOpenTransferModal={() => setShowTransferModal(true)}
            onNavigateTab={(tab, subView) => handleNavigateTab(tab, subView)}
            onAddIncome={handleAddGamingIncome}
            onOpenAiAssistant={handleOpenAiAssistant}
            onStartTour={handleStartTour}
            onOpenHelp={handleOpenHelp}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={state.transactions}
            transfers={state.transfers}
            receivables={state.receivables}
            loans={state.loans}
            equbs={state.equbs}
            assets={state.assets}
            recurring={state.recurring}
            wallets={state.wallets}
            categories={state.categories}
            currentUser={state.currentUser}
            users={state.users}
            hideBalances={state.hideBalances}
            calendarType={state.calendarType || 'GREGORIAN'}
            onReverseTransaction={handleReverseTransaction}
            onRefreshTransactions={handleRefreshTransactions}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onClearAllTransactions={handleClearAllTransactions}
            onRequestApproval={handleCreateApprovalRequest}
            onNavigateTab={(tab, subView) => handleNavigateTab(tab, subView)}
            onOpenHelp={handleOpenHelp}
          />
        )}

        {activeTab === 'wallets' && (
          <WalletsView
            wallets={state.wallets}
            transactions={state.transactions}
            transfers={state.transfers}
            receivables={state.receivables}
            users={state.users}
            currentUser={state.currentUser}
            hideBalances={state.hideBalances}
            autoImportSettings={state.autoImportSettings}
            pendingReviewTransactions={state.pendingReviewTransactions}
            onUpdateState={setState}
            onOpenTransferModal={() => setShowTransferModal(true)}
            onOpenQuickEntry={(wId) => {
              setQuickEntryWalletId(wId);
              setShowQuickEntry(true);
            }}
            onAddWallet={handleAddWallet}
            onUpdateWallet={handleUpdateWallet}
            onDeleteWallet={handleDeleteWallet}
            onAddTransaction={handlePostTransaction}
            onBatchPostTransactions={handleBatchPostTransactions}
            onOpenHelp={handleOpenHelp}
          />
        )}

        {activeTab === 'equb' && (
          <EqubView
            equbs={state.equbs}
            transactions={state.transactions}
            loans={state.loans}
            receivables={state.receivables}
            wallets={state.wallets}
            currentUser={state.currentUser}
            users={state.users}
            approvalRequests={state.approvalRequests}
            hideBalances={state.hideBalances}
            calendarType={state.calendarType || 'GREGORIAN'}
            onToggleCalendarType={(type) => {
              if (typeof window !== 'undefined') localStorage.setItem('pluszone_calendar_user_choice', type);
              setState(prev => ({ ...prev, calendarType: type }));
            }}
            onPayRound={handlePayEqubRound}
            onClaimPayout={handleClaimEqubPayout}
            onCreateEqub={handleCreateEqub}
            onUpdateEqub={handleUpdateEqub}
            onDeleteEqub={handleDeleteEqub}
            onCreateLoan={handleCreateLoan}
            onUpdateLoan={handleUpdateLoan}
            onDeleteLoan={handleDeleteLoan}
            onRepayLoan={handleRepayLoan}
            onCreateReceivable={handleCreateReceivable}
            onUpdateReceivable={handleUpdateReceivable}
            onCollectReceivable={handleCollectReceivable}
            onDeleteReceivable={handleDeleteReceivable}
            onRequestApproval={handleCreateApprovalRequest}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
            onOpenAiAdvisor={handleOpenAiAssistant}
            onOpenHelp={handleOpenHelp}
          />
        )}

        {activeTab === 'chat' && (
          <ChatView
            state={state}
            onSendMessage={handleSendMessage}
            onAddReaction={handleAddChatReaction}
            onDeleteMessage={handleDeleteChatMessage}
            onNavigateTab={(tab) => handleNavigateTab(tab)}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
            onMarkRead={markChatAsRead}
            onOpenHelp={handleOpenHelp}
            onSwitchUser={(user: UserProfile) => {
              setState(prev => ({ ...prev, currentUser: user }));
              updateAuthSessionUser(user);
            }}
            onRegisterUser={handleRegisterUser}
          />
        )}

        {activeTab === 'more' && (
          <MoreHubView
            state={state}
            onUpdateState={setState}
            onOpenAiAssistant={(prompt, mode) => handleOpenAiAssistant(prompt, mode || 'simulator')}
            onLogout={handleLogout}
            initialSubView={moreSubView}
            onNavigateTab={(tab) => handleNavigateTab(tab)}
            onCollectReceivable={handleCollectReceivable}
            onReplayTour={handleStartTour}
            onOpenHelp={handleOpenHelp}
          />
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => handleNavigateTab(tab)}
        onOpenQuickEntry={() => {
          setQuickEntryWalletId(undefined);
          setShowQuickEntry(true);
        }}
        unreadChatCount={unreadChatCount}
        onDismissNotification={handleDismissNotification}
        onClearAllNotifications={handleClearAllNotifications}
        onNavigateTab={(tab) => handleNavigateTab(tab)}
      />

      {/* Quick Entry Sheet Modal */}
      <QuickEntryModal
        isOpen={showQuickEntry}
        onClose={() => {
          setShowQuickEntry(false);
          setSharedSmsPrefill(null);
        }}
        wallets={state.wallets}
        categories={state.categories}
        currentUser={state.currentUser}
        defaultWalletId={quickEntryWalletId}
        transactions={state.transactions}
        transfers={state.transfers}
        equbs={state.equbs}
        loans={state.loans}
        recurring={state.recurring}
        onSubmitTransaction={handlePostTransaction}
        onBatchSubmitTransactions={handleBatchPostTransactions}
        onCreateEqub={handleCreateEqub}
        prefilledText={sharedSmsPrefill || undefined}
      />

      {/* Inter-Wallet Transfer Modal */}
      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        wallets={state.wallets}
        transactions={state.transactions}
        transfers={state.transfers}
        onExecuteTransfer={handleExecuteTransfer}
        onUpdateTransfer={handleUpdateTransfer}
        onDeleteTransfer={handleDeleteTransfer}
      />

      {/* Persistent Floating AI Assistant Bubble (Present on Every Page) */}
      <button
        onClick={() => {
          triggerHaptic('medium');
          setShowAiAssistant(prev => !prev);
        }}
        aria-label="Open Gemini Chatbot"
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#0F172A]/95 hover:bg-[#1E293B] border border-[#00D4AA]/60 text-[#00D4AA] shadow-xl hover:shadow-[#00D4AA]/25 backdrop-blur-md hover:scale-105 active:scale-95 transition-all cursor-pointer group flex items-center justify-center"
      >
        <div className="relative flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#00D4AA] transition-transform group-hover:rotate-12" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#00D4AA] rounded-full border-2 border-[#0F172A]" />
        </div>
      </button>

      {/* AI Assistant Floating Chat Widget */}
      <AiAssistantWidget
        isOpen={showAiAssistant}
        onClose={() => {
          setShowAiAssistant(false);
          setAiAssistantPrompt(undefined);
        }}
        state={state}
        initialPrompt={aiAssistantPrompt}
        initialMode={aiAssistantMode}
        onCreateEqub={handleCreateEqub}
        onAddGoal={(goal) => {
          setState((prev) => {
            const updated = {
              ...prev,
              goals: [goal, ...(prev.goals || [])],
              auditLogs: [
                {
                  id: `aud-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  actorId: prev.currentUser.id,
                  actorName: prev.currentUser.name,
                  action: 'CREATE_GOAL',
                  entity: 'Goal',
                  entityId: goal.id,
                  diffAfter: goal,
                  branch: prev.currentUser.branch
                },
                ...prev.auditLogs
              ]
            };
            saveStateToStorage(updated);
            syncStateToFirebaseNow(updated);
            return updated;
          });
          triggerToast(`🎯 Goal "${goal.title}" saved to your Roadmap Goals!`);
        }}
        onNavigateTab={(tab) => handleNavigateTab(tab as any)}
        onShowToast={triggerToast}
      />

      {/* Session Lock Screen Password & PIN Unlock Modal */}
      <SessionLockModal
        isOpen={isSessionLocked}
        onClose={() => setIsSessionLocked(false)}
        userEmail={state.currentUser.email}
        userName={state.currentUser.name}
        currentUserPassword={state.currentUser.password || 'password123'}
        onSuccess={() => setIsSessionLocked(false)}
        onLogout={handleLogout}
        mode="SESSION_UNLOCK"
      />

      {/* Page Help & Guides Modal */}
      <PageHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        currentTab={activeTab}
        currentSubView={moreSubView}
        onStartPageTour={handleStartPageTour}
        onStartFullAppTour={handleStartFullAppTour}
      />

      {/* Interactive Spotlight Tour */}
      <OnboardingTour
        isOpen={isTourActive}
        onClose={handleCloseTour}
        onCompleted={handleCompleteTour}
        activeTab={activeTab}
        moreSubView={moreSubView}
        onNavigateTab={(tab, subView) => handleNavigateTab(tab, subView)}
        userId={state.currentUser.id}
        initialStepIndex={tourStepIndex}
        customSteps={activeTourSteps}
        tourTitle={activeTourTitle}
      />

      {/* Non-intrusive Offline Connectivity Indicator */}
      <OfflineIndicator />

    </div>
  );
}
