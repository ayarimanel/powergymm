/**
 * One "back" for the whole app, the way phones expect it:
 * the Android back button/gesture, the browser back button, and the iOS/Android
 * edge swipe all close the top-most thing first (a sheet, then a previous tab).
 *
 * Anything that can be "backed out of" registers while it is open with
 * useBackHandler(open, close). The most recently opened wins.
 *
 * On web each registration pushes a browser history entry, so the phone's own
 * back gesture (which fires popstate) closes sheets instead of leaving the app.
 */
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

type Entry = { id: number; run: () => void };

const stack: Entry[] = [];
let nextId = 1;
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

// History entries we pushed and still expect a popstate for.
let pendingSilentPops = 0;

if (isWeb) {
  window.addEventListener('popstate', () => {
    if (pendingSilentPops > 0) {
      pendingSilentPops--;
      return;
    }
    const top = stack.pop();
    top?.run();
  });
} else {
  BackHandler.addEventListener('hardwareBackPress', () => {
    const top = stack.pop();
    if (!top) return false; // nothing open: let the OS close the app
    top.run();
    return true;
  });
}

function register(run: () => void): number {
  const id = nextId++;
  stack.push({ id, run });
  if (isWeb) window.history.pushState({ gymBack: id }, '');
  return id;
}

/** Remove an entry that closed by itself (its own button, a swipe…), and drop its history entry. */
function unregister(id: number) {
  const i = stack.findIndex(e => e.id === id);
  if (i === -1) return; // already consumed by a back press
  stack.splice(i, 1);
  if (isWeb) {
    pendingSilentPops++;
    window.history.back();
  }
}

/** Trigger "back" programmatically (the in-app edge swipe on native). Returns false if nothing was open. */
export function goBack(): boolean {
  if (isWeb) {
    if (!stack.length) return false;
    window.history.back();
    return true;
  }
  const top = stack.pop();
  if (!top) return false;
  top.run();
  return true;
}

/**
 * While `active`, a back press/swipe calls `onBack` (which should close the thing).
 * Change `key` to re-arm after a back was consumed while still active (e.g. tab history).
 */
export function useBackHandler(active: boolean, onBack: () => void, key: number = 0) {
  const latest = useRef(onBack);
  latest.current = onBack;

  useEffect(() => {
    if (!active) return;
    let consumed = false;
    const id = register(() => {
      consumed = true;
      latest.current();
    });
    return () => {
      if (!consumed) unregister(id);
    };
  }, [active, key]);
}
