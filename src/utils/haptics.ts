/**
 * Small, consistent touch feedback. Native uses the Taptic engine / vibrator
 * through expo-haptics; Android browsers get a very short vibration; iOS
 * Safari has no API, so it silently does nothing.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const webBuzz = (ms: number) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    // not allowed before the first user gesture: ignore
  }
};

const safe = (fn: () => Promise<void>) => {
  fn().catch(() => {});
};

export const haptics = {
  /** Switching tabs, toggling a chip. */
  select: () => (Platform.OS === 'web' ? webBuzz(5) : safe(() => Haptics.selectionAsync())),
  /** A like, a sheet snapping closed. */
  light: () => (Platform.OS === 'web' ? webBuzz(8) : safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))),
  /** Check-in validated, record approved. */
  success: () => (Platform.OS === 'web' ? webBuzz(20) : safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))),
};
