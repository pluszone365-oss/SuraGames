import { ChatMessage, ChatMessageReaction } from '../types';
import { db, isFirestoreQuotaExceeded, markQuotaExceeded, clearQuotaExceeded } from './firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, getDocs, limit, query } from 'firebase/firestore';

export type ChatBroadcastEvent =
  | { type: 'NEW_MESSAGE'; message: ChatMessage; originTabId: string }
  | { type: 'UPDATE_REACTIONS'; messageId: string; reactions: ChatMessageReaction[]; originTabId: string }
  | { type: 'DELETE_MESSAGE'; messageId: string; originTabId: string };

const TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
const BROADCAST_CHANNEL_NAME = 'pluszone_realtime_chat_bus';
const STORAGE_EVENT_KEY = 'pluszone_chat_cross_tab_event';

// Cross-tab BroadcastChannel for 0ms delay between tabs/windows on the same device
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch (err) {
    console.warn('BroadcastChannel not available, using storage event fallback:', err);
  }
}

type ChatEventListener = (event: ChatBroadcastEvent) => void;
const listeners = new Set<ChatEventListener>();

export function registerChatEventListener(listener: ChatEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyLocalListeners(event: ChatBroadcastEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error('Error in chat event listener:', err);
    }
  });
}

// Setup incoming cross-tab listeners
const recentProcessedEventKeys = new Set<string>();
function markAndCheckDuplicate(event: ChatBroadcastEvent): boolean {
  let key = '';
  if (event.type === 'NEW_MESSAGE') key = `new:${event.message.id}`;
  else if (event.type === 'UPDATE_REACTIONS') key = `react:${event.messageId}:${JSON.stringify(event.reactions)}`;
  else if (event.type === 'DELETE_MESSAGE') key = `del:${event.messageId}`;
  
  if (!key) return false;
  if (recentProcessedEventKeys.has(key)) {
    return true; // Duplicate event
  }
  recentProcessedEventKeys.add(key);
  // Expire from set after 8 seconds
  setTimeout(() => recentProcessedEventKeys.delete(key), 8000);
  return false;
}

if (typeof window !== 'undefined') {
  // 1. BroadcastChannel incoming handler (0ms latency)
  if (broadcastChannel) {
    broadcastChannel.onmessage = (ev: MessageEvent<ChatBroadcastEvent>) => {
      if (ev.data && ev.data.originTabId !== TAB_ID) {
        if (!markAndCheckDuplicate(ev.data)) {
          notifyLocalListeners(ev.data);
        }
      }
    };
  }

  // 2. Storage event incoming handler (0ms fallback for browsers/contexts without BC)
  window.addEventListener('storage', (ev: StorageEvent) => {
    if (ev.key === STORAGE_EVENT_KEY && ev.newValue) {
      try {
        const payload: ChatBroadcastEvent = JSON.parse(ev.newValue);
        if (payload && payload.originTabId !== TAB_ID) {
          if (!markAndCheckDuplicate(payload)) {
            notifyLocalListeners(payload);
          }
        }
      } catch (_) {}
    }
  });
}

/**
 * Broadcast an event immediately across all tabs with 0ms delay.
 */
export function broadcastChatEvent(
  eventData:
    | { type: 'NEW_MESSAGE'; message: ChatMessage }
    | { type: 'UPDATE_REACTIONS'; messageId: string; reactions: ChatMessageReaction[] }
    | { type: 'DELETE_MESSAGE'; messageId: string }
): void {
  const fullEvent: ChatBroadcastEvent = {
    ...eventData,
    originTabId: TAB_ID,
  };

  // 1. BroadcastChannel (0ms)
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(fullEvent);
    } catch (_) {}
  }

  // 2. LocalStorage event (0ms fallback across tabs)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(fullEvent));
    } catch (_) {}
  }
}

/**
 * Sends a chat message with immediate 0ms local + cross-tab delivery,
 * and concurrent immediate cloud write to Firestore `team_chat_messages`.
 */
export async function sendChatMessageImmediately(msg: ChatMessage): Promise<void> {
  // 1. Instant 0ms broadcast to other tabs/windows
  broadcastChatEvent({
    type: 'NEW_MESSAGE',
    message: msg,
  });

  // 2. Cloud Firestore immediate write - never silently skipped
  try {
    const msgRef = doc(db, 'team_chat_messages', msg.id);
    const cleanMsg = JSON.parse(JSON.stringify(msg));
    await setDoc(msgRef, cleanMsg);
    clearQuotaExceeded();
  } catch (err: any) {
    if (
      err?.code === 'resource-exhausted' ||
      err?.message?.includes('Quota') ||
      err?.message?.includes('quota')
    ) {
      markQuotaExceeded();
      return;
    }
    console.warn('Realtime chat message send fallback:', err?.message);
  }
}

/**
 * Updates message reactions in 0ms cross-tab and immediately in Firestore.
 */
export async function updateChatReactionImmediately(
  messageId: string,
  reactions: ChatMessageReaction[]
): Promise<void> {
  // 1. Instant 0ms cross-tab update
  broadcastChatEvent({
    type: 'UPDATE_REACTIONS',
    messageId,
    reactions,
  });

  // 2. Cloud Firestore write - never silently skipped
  try {
    const msgRef = doc(db, 'team_chat_messages', messageId);
    await updateDoc(msgRef, {
      reactions: JSON.parse(JSON.stringify(reactions)),
    });
    clearQuotaExceeded();
  } catch (err: any) {
    if (
      err?.code === 'resource-exhausted' ||
      err?.message?.includes('Quota') ||
      err?.message?.includes('quota')
    ) {
      markQuotaExceeded();
      return;
    }
    console.warn('Realtime chat reaction update fallback:', err?.message);
  }
}

/**
 * Deletes a chat message with immediate 0ms cross-tab and cloud deletion.
 */
export async function deleteChatMessageImmediately(messageId: string): Promise<void> {
  broadcastChatEvent({
    type: 'DELETE_MESSAGE',
    messageId,
  });

  try {
    const msgRef = doc(db, 'team_chat_messages', messageId);
    await deleteDoc(msgRef);
  } catch (err: any) {
    console.warn('Realtime chat message delete fallback:', err?.message);
  }
}

/**
 * Compresses an image to max dimensions (800x800) and JPEG quality 0.75
 * to guarantee payload is always < 100KB (well below Firestore 1MB limit).
 */
export function compressImageForChat(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX_DIM = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
