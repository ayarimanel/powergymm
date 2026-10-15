/**
 * Web Push hook for calm alerts and streak reminders — NOT wired yet.
 *
 * Why: a push has to be sent by a server. This app still keeps everything on the phone, so there
 * is no server to hold subscriptions or send at 17h. Until then, alerts fire in-app (see
 * HomeScreen's calm-alert check) and on native through NotificationService's local reminders.
 *
 * To finish it once the backend is live:
 *  1. Generate VAPID keys on the server; expose the public key as EXPO_PUBLIC_VAPID_PUBLIC_KEY.
 *  2. Call `subscribeToPush()` after the member taps "🔔 Me prévenir" and POST the subscription
 *     to the backend (e.g. POST /v1/push/web-subscriptions).
 *  3. A backend job checks active calm alerts every few minutes and sends when the level drops.
 *  4. public/sw.js already shows the notification in its `push` handler.
 */
import { Platform } from 'react-native';

export const webPushSupported = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

const urlBase64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

/** Returns the PushSubscription to send to the backend, or null if unsupported / not configured / denied. */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const key = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key || !webPushSupported()) return null;
  if ((await Notification.requestPermission()) !== 'granted') return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
}
