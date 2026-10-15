import { useEffect, useRef } from 'react';
import type { ScrollView } from 'react-native';

type Listener = (tab: string) => void;
const listeners = new Set<Listener>();

/** Called by the tab bar when the already-active tab is tapped again. */
export const emitTabReselect = (tab: string) => listeners.forEach(l => l(tab));

/**
 * Tapping the active tab again scrolls its screen back to the top (the iOS/Android
 * convention). Attach the returned ref to the screen's main ScrollView.
 */
export function useScrollToTopOnReselect(tab: string) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const l: Listener = t => {
      if (t === tab) ref.current?.scrollTo({ y: 0, animated: true });
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [tab]);
  return ref;
}
