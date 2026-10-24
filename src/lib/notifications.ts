// System & Web Push Notification Helper for External OS / Browser Alerts & Audio Chimes

export function isNotificationSupported(): boolean {
  try {
    return typeof window !== 'undefined' && 'Notification' in window;
  } catch {
    return false;
  }
}

export function isNotificationConstructible(): boolean {
  try {
    if (!isNotificationSupported()) return false;
    // Notification constructor is safe if available and not blocked
    if (typeof Notification === 'function') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  try {
    return Notification.permission;
  } catch {
    return 'denied';
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  try {
    if (typeof Notification.requestPermission === 'function') {
      const permission = await Notification.requestPermission();
      return permission;
    }
    return 'denied';
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return 'denied';
  }
}

export interface ExternalNotificationOptions {
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
}

/**
 * Web Audio API synthesized tones for real-time notifications, chat messages, and authorization feedback
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playNotificationSound(type: 'chat' | 'alert' | 'success' | 'scan' | 'unlock' = 'chat') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'chat') {
      // Pleasant dual-tone chime for chat messages (880Hz -> 1320Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'alert') {
      // Attention chime for approvals / critical events
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'scan') {
      // Subtle pulse sound during authentication scan
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'unlock' || type === 'success') {
      // Uplifting harmonic chord for authorization unlock
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.14); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.21); // C6
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch {
    // Audio context may be blocked by autoplay policies until user interaction
  }
}

/**
 * Sends a notification that pops up OUTSIDE the web app (on OS / Mobile Notification Center)
 * Safe from "TypeError: Illegal constructor" across all browsers and devices.
 */
export async function sendExternalNotification(
  title: string,
  options: ExternalNotificationOptions
): Promise<boolean> {
  try {
    // Also play the corresponding in-app notification sound
    playNotificationSound(title.toLowerCase().includes('chat') ? 'chat' : 'alert');

    if (!isNotificationSupported()) return false;

    let permission = getNotificationPermission();
    if (permission === 'default') {
      permission = await requestNotificationPermission();
    }

    if (permission !== 'granted') {
      return false;
    }

    const iconUrl = options.icon || '/pwa-192.png';

    // 1. Try sending via active Service Worker if available (most reliable on Android & Mobile PWA)
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, {
            body: options.body,
            icon: iconUrl,
            badge: '/pwa-192.png',
            tag: options.tag || `pluszone-notif-${Date.now()}`,
            renotify: true,
            data: options.data || { url: '/' }
          } as NotificationOptions);

          if (reg.active) {
            reg.active.postMessage({
              type: 'SHOW_NOTIFICATION',
              payload: {
                title,
                body: options.body,
                icon: iconUrl,
                tag: options.tag,
                data: options.data
              }
            });
          }
          return true;
        }
      } catch (swErr) {
        // Fall through to window.Notification
      }
    }

    // 2. Direct Notification constructor fallback
    if (isNotificationConstructible()) {
      try {
        const notif = new (window as any).Notification(title, {
          body: options.body,
          icon: iconUrl,
          badge: '/pwa-192.png',
          tag: options.tag || `pluszone-notif-${Date.now()}`
        });

        notif.onclick = () => {
          try {
            window.focus();
            notif.close();
          } catch {}
        };

        return true;
      } catch (constructErr) {
        return false;
      }
    }

    return false;
  } catch (outerErr) {
    return false;
  }
}

/**
 * Format timestamp into human readable relative time string (e.g. "Just now", "2m ago", "1h ago")
 */
export function formatRelativeNotifTime(timestamp: number): string {
  if (!timestamp) return 'Recent';
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'Scheduled';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
