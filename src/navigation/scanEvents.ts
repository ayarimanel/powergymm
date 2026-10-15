import { useEffect, useRef } from 'react';

/**
 * The navbar's Scan button lives in App, the scan flow (scanner, check-in, streak)
 * lives in the Accueil screen. App asks for a scan here; Accueil answers by running
 * its own openScanner. The request is kept until Accueil reads it, because Accueil
 * may not be mounted yet when Scan is tapped from another tab.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let pending = false;

export const requestScan = () => {
  pending = true;
  listeners.forEach(l => l());
};

/** Runs `open` once for every scan request, including one made just before mounting. */
export function useScanRequests(open: () => void) {
  const latest = useRef(open);
  latest.current = open;
  useEffect(() => {
    const l: Listener = () => {
      if (!pending) return;
      pending = false;
      latest.current();
    };
    listeners.add(l);
    l(); // a request made while this screen was not mounted
    return () => {
      listeners.delete(l);
    };
  }, []);
}
