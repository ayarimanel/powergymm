import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** True when the OS asks for reduced motion → components fall back to fades only. */
export const useReduceMotion = () => {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => mounted && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
};

/**
 * Online/offline. Web uses the browser events; native assumes online
 * (swap in @react-native-community/netinfo for real detection on devices).
 */
export const useOnline = () => {
  const [online, setOnline] = useState(
    Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
};
