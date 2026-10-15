import { useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform } from 'react-native';

const nativeDriver = Platform.OS !== 'web';

/**
 * Drag-down-to-close for full-screen modals (scanner, forms). Spread `panHandlers`
 * on the area that should be draggable and apply `style` to what should move.
 * A long enough pull or a quick flick closes; anything less springs back.
 */
export function useSwipeToDismiss(onDismiss: () => void, opts: { distance?: number } = {}) {
  const y = useRef(new Animated.Value(0)).current;
  const latest = useRef(onDismiss);
  latest.current = onDismiss;
  const distance = opts.distance ?? 120;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > distance || g.vy > 0.9) {
            Animated.timing(y, { toValue: 900, duration: 180, useNativeDriver: nativeDriver }).start(() => {
              latest.current();
              y.setValue(0);
            });
          } else {
            Animated.spring(y, { toValue: 0, useNativeDriver: nativeDriver, bounciness: 6 }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(y, { toValue: 0, useNativeDriver: nativeDriver }).start(),
      }),
    [y, distance]
  );

  return { panHandlers: pan.panHandlers, style: { transform: [{ translateY: y }] } };
}
