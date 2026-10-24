/**
 * PWA Service Worker & Advanced Manifest Capabilities Coordinator
 * 
 * Manages:
 * - Service Worker registration & cache verification
 * - Background Sync API ('sync' & 'periodicsync' queues)
 * - File Handlers API (window.launchQueue)
 * - Share Target API (incoming SMS/Receipt shares)
 * - Protocol Handlers (web+pluszone, web+equb)
 * - Note Taking capability
 * - Windows / Edge widgets & side-panel integration
 */

export interface QueuedOfflineItem {
  id: string;
  type: 'TRANSACTION' | 'AUDIT_LOG' | 'TRANSFER' | 'EQUB_PAYMENT';
  payload: any;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = 'pgz_offline_sync_queue';

export function getQueuedOfflineItems(): QueuedOfflineItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function queueOfflineItem(item: Omit<QueuedOfflineItem, 'id' | 'timestamp'>): QueuedOfflineItem {
  const fullItem: QueuedOfflineItem = {
    ...item,
    id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now()
  };
  const list = getQueuedOfflineItems();
  list.push(fullItem);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(list));
  
  // Attempt to trigger background sync if online or supported
  triggerBackgroundSync('sync-transactions');
  
  return fullItem;
}

export function removeQueuedOfflineItem(id: string): void {
  const list = getQueuedOfflineItems().filter(i => i.id !== id);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(list));
}

export function clearQueuedOfflineItems(): void {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

/**
 * Trigger Background Sync API with graceful fallback to online event
 */
export async function triggerBackgroundSync(tag: string = 'sync-transactions'): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'sync' in reg) {
        await (reg as any).sync.register(tag);
        console.log(`[PWA Sync] Background Sync registered for tag: ${tag}`);
        return true;
      }
    } catch (err) {
      console.warn('[PWA Sync] Background Sync registration failed, falling back:', err);
    }
  }

  // Fallback: If network is currently online, dispatch a custom sync event
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    window.dispatchEvent(new CustomEvent('pwa-sync-fallback', { detail: { tag } }));
    return true;
  }
  return false;
}

/**
 * Register the Service Worker and configure client message channel
 */
export function initPwaServiceWorker(onSyncTriggered?: (tag: string) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[PWA] Service Worker registered with scope:', registration.scope);
      // Immediately check for newer service worker on load
      registration.update().catch(() => {});

      // Check for periodic sync support
      if ('periodicSync' in registration) {
        (registration as any).periodicSync.register('sync-rates-and-balances', {
          minInterval: 24 * 60 * 60 * 1000 // Once a day
        }).catch(() => {
          // May require PWA install or permission
        });
      }
    })
    .catch((err) => {
      console.warn('[PWA] Service Worker registration failed:', err);
    });

  const handleMessage = (event: MessageEvent) => {
    if (!event.data) return;

    if (event.data.type === 'BACKGROUND_SYNC_TRIGGERED' || event.data.type === 'PERIODIC_SYNC_TRIGGERED') {
      console.log('[PWA] Background sync message from SW:', event.data);
      if (onSyncTriggered) {
        onSyncTriggered(event.data.tag || 'sync-transactions');
      }
    }
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);

  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
  };
}

/**
 * Listen for File Handlers API (files opened via OS or file manager)
 * Supported: .json, .csv, .xlsx, .txt
 */
export function initFileHandlingConsumer(
  onFileReceived: (file: File, content: string, extension: string) => void
): void {
  if (typeof window === 'undefined') return;

  const w = window as any;
  if ('launchQueue' in w && typeof w.launchQueue?.setConsumer === 'function') {
    w.launchQueue.setConsumer(async (launchParams: any) => {
      if (!launchParams.files || !launchParams.files.length) return;

      for (const handle of launchParams.files) {
        try {
          const file = await handle.getFile();
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          
          if (ext === 'json' || ext === 'csv' || ext === 'txt') {
            const text = await file.text();
            onFileReceived(file, text, ext);
          } else if (ext === 'xlsx') {
            onFileReceived(file, '', ext);
          }
        } catch (err) {
          console.error('[PWA File Handler] Error reading launched file:', err);
        }
      }
    });
  }
}

/**
 * Parsed Share Target structure
 */
export interface ShareTargetPayload {
  title?: string;
  text?: string;
  url?: string;
}

/**
 * Inspects URL for incoming Web Share Target payloads
 * e.g., sharing a CBE / Telebirr SMS confirmation to PlusZone ERP
 */
export function extractShareTargetPayload(): ShareTargetPayload | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');

  if (action === 'share-target' || params.has('text') || params.has('title')) {
    const title = params.get('title') || undefined;
    const text = params.get('text') || undefined;
    const url = params.get('url') || undefined;

    if (title || text || url) {
      return { title, text, url };
    }
  }

  return null;
}

/**
 * Inspects URL for protocol handlers (web+pluszone://... or web+equb://...)
 */
export function extractProtocolUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('protocol_url') || params.get('equb_url') || params.get('payment_url') || null;
}

/**
 * Inspects URL for quick note taking intent (?action=new-note)
 */
export function isNoteTakingAction(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('action') === 'new-note';
}

/**
 * Inspects URL for file handler launch (?action=open-file)
 */
export function isOpenFileAction(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('action') === 'open-file';
}

/**
 * Inspects URL for app shortcuts (?shortcut=transaction | gaming | wallets)
 */
export function extractShortcut(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('shortcut');
}

/**
 * Comprehensive PWA status report for verification
 */
export interface PwaStatusReport {
  isServiceWorkerSupported: boolean;
  isServiceWorkerActive: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  isBackgroundSyncSupported: boolean;
  isPeriodicSyncSupported: boolean;
  isPushSupported: boolean;
  isFileHandlersSupported: boolean;
  isShareTargetSupported: boolean;
  isProtocolHandlersSupported: boolean;
  isLaunchHandlerSupported: boolean;
  isWidgetsSupported: boolean;
  isEdgeSidePanelSupported: boolean;
  isNoteTakingSupported: boolean;
  isScopeExtensionsConfigured: boolean;
  isIarcRatingRegistered: boolean;
  queuedOfflineCount: number;
}

export async function getPwaStatusReport(): Promise<PwaStatusReport> {
  const isSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  let isSWActive = false;
  let isBgSync = false;
  let isPerSync = false;

  if (isSW) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      isSWActive = Boolean(reg && reg.active);
      isBgSync = Boolean(reg && 'sync' in reg);
      isPerSync = Boolean(reg && 'periodicSync' in reg);
    } catch {
      // ignore
    }
  }

  const isStandalone = typeof window !== 'undefined' ? (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  ) : false;

  const queuedCount = getQueuedOfflineItems().length;

  return {
    isServiceWorkerSupported: isSW,
    isServiceWorkerActive: isSWActive,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isStandalone,
    isBackgroundSyncSupported: isBgSync || ('SyncManager' in window),
    isPeriodicSyncSupported: isPerSync || ('PeriodicSyncManager' in window),
    isPushSupported: typeof window !== 'undefined' && ('Notification' in window) && ('PushManager' in window),
    isFileHandlersSupported: typeof window !== 'undefined' && ('launchQueue' in window),
    isShareTargetSupported: true, // Configured via manifest and URL target
    isProtocolHandlersSupported: typeof navigator !== 'undefined' && ('registerProtocolHandler' in navigator),
    isLaunchHandlerSupported: true, // Supported via manifest client_mode
    isWidgetsSupported: true, // Configured in manifest & /api/pwa/widget-data
    isEdgeSidePanelSupported: true, // Configured in manifest (preferred_width: 480)
    isNoteTakingSupported: true, // Configured in manifest (new_note_url: /?action=new-note)
    isScopeExtensionsConfigured: true, // Configured in manifest
    isIarcRatingRegistered: true, // e84b072d-71b3-4d3e-86ae-31a8ce4e53b7
    queuedOfflineCount: queuedCount,
  };
}
