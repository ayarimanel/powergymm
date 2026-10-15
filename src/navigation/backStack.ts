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

// Web: history entries we pushed that are still in the browser history.
let depth = 0;
// Traversals we started ourselves (history.go) and still expect a popstate for.
let pendingSilentPops = 0;
let traversing = false;
let scheduled = false;

/**
 * Bring the browser history in line with the open entries, once per tick.
 *
 * history.back() is asynchronous and history.pushState() is not: closing one sheet and
 * opening the next in the same tick (scanner → muscle pick → success) used to pop the
 * new sheet's entry and leave one "back" too many, which could leave the app. Settling
 * after the tick makes such a swap cost nothing, and only ever moves by the difference.
 */
function settle() {
  scheduled = false;
  if (traversing) return; // the popstate of our own traversal settles again
  const want = stack.length;
  if (depth > want) {
    const n = depth - want;
    depth = want;
    traversing = true;
    pendingSilentPops++;
    window.history.go(-n);
  } else {
    while (depth < want) {
      window.history.pushState({ gymBack: depth + 1 }, '');
      depth++;
    }
  }
}

function scheduleSettle() {
  if (!isWeb || scheduled) return;
  scheduled = true;
  setTimeout(settle, 0);
}

if (isWeb) {
  window.addEventListener('popstate', () => {
    if (pendingSilentPops > 0) {
      pendingSilentPops--;
      traversing = false;
      scheduleSettle();
      return;
    }
    // A real back (browser button, phone gesture): it consumed one of our entries.
    depth = Math.max(0, depth - 1);
    const top = stack.pop();
    top?.run();
    scheduleSettle();
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
  scheduleSettle();
  return id;
}

/** Remove an entry that closed by itself (its own button, a swipe…), and drop its history entry. */
function unregister(id: number) {
  const i = stack.findIndex(e => e.id === id);
  if (i === -1) return; // already consumed by a back press
  stack.splice(i, 1);
  scheduleSettle();
}

/** Trigger "back" programmatically (the in-app edge swipe on native). Returns false if nothing was open. */
export function goBack(): boolean {
  if (isWeb) {
    if (!stack.length) return false;
    // Its history entry may not be pushed yet (opened this very tick): close it directly.
    if (depth < stack.length || traversing) {
      stack.pop()?.run();
      scheduleSettle();
      return true;
    }
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
