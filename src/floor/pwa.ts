import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { clubTheme, colors } from '../theme';

const INSTALL_PROMPTED_KEY = '@gym_app_pwa_install_prompted_v1';

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredPrompt: BeforeInstallPromptEvent | null = null;

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

let initialized = false;

/** Adds the manifest + iOS home-screen tags without overriding Expo's HTML template. */
function injectHeadTags() {
  const head = document.head;
  const add = (tag: string, attrs: Record<string, string>) => {
    const selector = `${tag}[${Object.entries(attrs).slice(0, 1).map(([k, v]) => `${k}="${v}"`).join('')}]`;
    if (head.querySelector(selector)) return;
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    head.appendChild(el);
  };
  add('link', { rel: 'manifest', href: '/manifest.webmanifest' });
  add('link', { rel: 'apple-touch-icon', href: '/icons/icon.png' });
  add('meta', { name: 'theme-color', content: colors.brand });
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-title', content: clubTheme.clubName });
}

/** Registers the service worker and captures Android's install prompt. Safe to call more than once. */
export function initPwa() {
  if (!isWeb || initialized) return;
  initialized = true;
  injectHeadTags();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

/** Already running as an installed app (home-screen icon)? */
export function isStandalone(): boolean {
  if (!isWeb) return true; // the native app is already "installed"
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function isIos(): boolean {
  return isWeb && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Instagram's in-app browser can't install PWAs or keep a session well — suggest Safari/Chrome instead. */
export function isInstagramBrowser(): boolean {
  return isWeb && /Instagram/i.test(navigator.userAgent);
}

/** Android/Chrome only: shows the native install dialog if the browser offered one. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export const canPromptNatively = () => !!deferredPrompt;

/** Only after the first successful scan, never on first open, and only once. */
export async function shouldOfferInstall(): Promise<boolean> {
  if (!isWeb || isStandalone()) return false;
  try {
    return (await AsyncStorage.getItem(INSTALL_PROMPTED_KEY)) !== '1';
  } catch {
    return false;
  }
}

export async function markInstallOffered() {
  try {
    await AsyncStorage.setItem(INSTALL_PROMPTED_KEY, '1');
  } catch {
    // ignore
  }
}
