import { Platform } from 'react-native';

/**
 * Who owns a horizontal drag: the card under the finger, or the tab swipe.
 *
 * Anything that moves sideways on its own (a carousel, a chip row, a chart you
 * scrub) claims the gesture the moment the finger lands on it. The app-wide tab
 * swipe then leaves that gesture alone, so swiping a card never changes section.
 *
 * Claims are timestamped rather than reset: the card's handlers and the app's
 * run during the same touch-start, in an order React Native does not promise.
 */
let lastClaim = 0;
let gestureStart = 0;
/** A claim this close to the start of the gesture belongs to it. */
const SAME_GESTURE_MS = 150;

/** Called by a horizontal component when a touch starts on it. */
export const claimSwipe = () => {
  lastClaim = Date.now();
};

/** Called by the tab swipe when any touch starts. */
export const startSwipe = () => {
  gestureStart = Date.now();
};

/** True when the current gesture started on something that scrolls or drags sideways. */
export const swipeClaimed = () => lastClaim >= gestureStart - SAME_GESTURE_MS;

/**
 * Web: true when the touch started inside an element that can scroll sideways.
 * Covers every horizontal ScrollView / FlatList, even ones nobody wired up.
 */
export const startsInHorizontalScroller = (target: unknown): boolean => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  let el = target as HTMLElement | null;
  while (el && el !== document.body) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const o = window.getComputedStyle(el).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
};
