import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { HourForecast } from '../../floor/crowd';
import { levelTint } from '../../floor/levelColors';
import { colors, ink } from '../../theme';
import { haptics } from '../../utils/haptics';
import { claimSwipe } from '../../navigation/swipeGuard';

interface Props {
  hourly: HourForecast[];
  nowHour: number; // decimal, e.g. 17.5
  bestHour: number | null;
  isOpen: boolean;
  /** Called with the scrubbed hour, or null once it snaps back to "now". */
  onScrub: (hour: number | null) => void;
  /** The finger was released on a future hour: offer "🔔 Me prévenir" for it. */
  onRemindMe: (hour: number) => void;
}

const HEIGHT = 40;
const SNAP_BACK_MS = 3000;
const hh = (h: number) => `${String(h).padStart(2, '0')}h`;

export const HeatStrip: React.FC<Props> = ({ hourly, nowHour, bestHour, isOpen, onScrub, onRemindMe }) => {
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [showRemind, setShowRemind] = useState<number | null>(null); // hour offered
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<View>(null);
  const n = hourly.length;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const indexAtX = useCallback((x: number) => {
    if (n === 0 || width <= 0) return null;
    return Math.max(0, Math.min(n - 1, Math.floor((x / width) * n)));
  }, [n, width]);

  const clearSnapTimer = () => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = null;
  };

  const scheduleSnapBack = useCallback(() => {
    clearSnapTimer();
    snapTimer.current = setTimeout(() => {
      setScrubIndex(null);
      onScrub(null);
    }, SNAP_BACK_MS);
  }, [onScrub]);

  useEffect(() => clearSnapTimer, []);

  const moveTo = useCallback((idx: number | null) => {
    setScrubIndex(prev => {
      if (prev !== idx && idx !== null) haptics.select();
      return idx;
    });
    onScrub(idx !== null ? hourly[idx]?.hour ?? null : null);
  }, [hourly, onScrub]);

  const release = useCallback((idx: number | null) => {
    if (idx !== null) {
      const hour = hourly[idx]?.hour;
      if (hour !== undefined && (!isOpen || hour > Math.floor(nowHour))) setShowRemind(hour);
      else setShowRemind(null);
    }
    scheduleSnapBack();
  }, [hourly, isOpen, nowHour, scheduleSnapBack]);

  // ---- Native touch (iOS/Android) ----
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: e => {
          claimSwipe();
          clearSnapTimer();
          setShowRemind(null);
          moveTo(indexAtX(e.nativeEvent.locationX));
        },
        onPanResponderMove: e => moveTo(indexAtX(e.nativeEvent.locationX)),
        onPanResponderRelease: e => release(indexAtX(e.nativeEvent.locationX)),
        onPanResponderTerminate: () => scheduleSnapBack(),
      }),
    [indexAtX, moveTo, release, scheduleSnapBack]
  );

  // ---- Web: pointer events cover mouse + touch in one path, plus arrow-key support ----
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = rootRef.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    let dragging = false;

    const xFrom = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return e.clientX - rect.left;
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      clearSnapTimer();
      setShowRemind(null);
      moveTo(indexAtX(xFrom(e)));
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      moveTo(indexAtX(xFrom(e)));
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      release(indexAtX(xFrom(e)));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      clearSnapTimer();
      const base = scrubIndex ?? hourly.findIndex(h => h.isNow);
      const next = Math.max(0, Math.min(n - 1, (base < 0 ? 0 : base) + (e.key === 'ArrowRight' ? 1 : -1)));
      moveTo(next);
      scheduleSnapBack();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexAtX, moveTo, release, scrubIndex, hourly, n]);

  if (n === 0) return null;

  const remindHourLabel = showRemind !== null ? hh(showRemind) : null;

  return (
    <View>
      <View
        ref={rootRef}
        onLayout={onLayout}
        {...(Platform.OS !== 'web' ? pan.panHandlers : {})}
        {...(Platform.OS === 'web' ? ({ tabIndex: 0 } as object) : {})}
        accessibilityRole="adjustable"
        accessibilityLabel="Affluence par heure aujourd'hui"
        accessibilityHint="Glissez ou utilisez les flèches pour voir une autre heure"
        style={styles.strip}
      >
        {hourly.map((h, i) => {
          const active = scrubIndex === i;
          const isBest = bestHour === h.hour;
          return (
            <View key={h.hour} style={[styles.segment, { backgroundColor: levelTint(h.level).bar, opacity: active ? 1 : 0.85 }]}>
              {h.isNow && scrubIndex === null && <View style={styles.nowMarker} />}
              {isBest && <Ionicons name="star" size={12} color={colors.white} style={styles.star} />}
            </View>
          );
        })}
      </View>

      <View style={styles.labelsRow}>
        <Text style={styles.edgeLabel}>{hh(hourly[0].hour)}</Text>
        {isOpen && <Text style={styles.nowLabel}>maintenant</Text>}
        <Text style={styles.edgeLabel}>{hh(hourly[hourly.length - 1].hour + 1)}</Text>
      </View>

      {remindHourLabel && (
        <Pressable
          onPress={() => {
            if (showRemind !== null) onRemindMe(showRemind);
            setShowRemind(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Me prévenir à ${remindHourLabel}`}
          style={({ pressed }) => [styles.remindPill, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="notifications" size={14} color={colors.onInverse} />
          <Text style={styles.remindText}>Me prévenir · {remindHourLabel}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    height: HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    gap: 2,
  },
  segment: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-start', position: 'relative' },
  nowMarker: {
    position: 'absolute',
    top: -6,
    width: 2,
    height: HEIGHT + 12,
    backgroundColor: ink(0.55),
  },
  star: { marginTop: 3 },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  edgeLabel: { fontSize: 11, fontWeight: '700', color: ink(0.45) },
  nowLabel: { fontSize: 11, fontWeight: '700', color: ink(0.55) },
  remindPill: {
    alignSelf: 'center',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.text,
  },
  remindText: { color: colors.onInverse, fontSize: 13, fontWeight: '800' },
});
