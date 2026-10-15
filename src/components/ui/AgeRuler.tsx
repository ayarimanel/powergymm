import React, { useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, fonts } from '../../theme';

/**
 * Ruler age picker (design-ref Q3Genre): a big number, a ruler you slide sideways,
 * the red mark in the middle is the value. `value` null = not chosen yet: the ruler
 * shows `fallback` and only calls onChange once the member actually moves it.
 */
const MIN = 10;
const MAX = 99;
const STEP = 16; // px between two years

interface Props {
  value: number | null;
  fallback?: number;
  onChange: (age: number) => void;
  unit?: string;
}

export const AgeRuler: React.FC<Props> = ({ value, fallback = 25, onChange, unit = 'ans' }) => {
  const shown = Math.min(MAX, Math.max(MIN, value ?? fallback));
  const [width, setWidth] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const placed = useRef(false);

  // Put the ruler on the shown value once its width is known.
  useEffect(() => {
    if (!width || placed.current) return;
    placed.current = true;
    requestAnimationFrame(() => scroll.current?.scrollTo({ x: (shown - MIN) * STEP, animated: false }));
  }, [width, shown]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!placed.current) return;
    const age = Math.min(MAX, Math.max(MIN, MIN + Math.round(e.nativeEvent.contentOffset.x / STEP)));
    if (age !== shown) onChange(age);
  };

  const nudge = (d: number) => {
    const age = Math.min(MAX, Math.max(MIN, shown + d));
    onChange(age);
    scroll.current?.scrollTo({ x: (age - MIN) * STEP, animated: true });
  };

  const ticks = [];
  for (let a = MIN; a <= MAX; a++) {
    const major = a % 5 === 0;
    ticks.push(
      <View key={a} style={s.tickSlot}>
        <View style={[s.tick, major && s.tickMajor]} />
        {major ? <Text style={[s.tickLabel, a === shown && { color: colors.brand }]}>{a}</Text> : null}
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Âge"
      accessibilityValue={{ text: `${shown} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <View style={s.valueRow}>
        <Text style={[s.value, value == null && { color: colors.textSecondary }]}>{shown}</Text>
        <Text style={s.unit}>{unit}</Text>
      </View>

      <View style={s.rulerWrap} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <ScrollView
            ref={scroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={STEP}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={onScroll}
            contentContainerStyle={{ paddingHorizontal: width / 2 - STEP / 2 }}
          >
            {ticks}
          </ScrollView>
        )}
        <View pointerEvents="none" style={[s.center, { left: width / 2 - 1 }]} />
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  value: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 64, lineHeight: 66, color: colors.text },
  unit: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginBottom: 10 },
  rulerWrap: { height: 64, marginTop: 18 },
  tickSlot: { width: STEP, alignItems: 'center', height: 64 },
  tick: { width: 2, height: 16, marginTop: 14, borderRadius: 1, backgroundColor: colors.disabled },
  tickMajor: { height: 30, marginTop: 0, backgroundColor: colors.textMuted },
  tickLabel: { position: 'absolute', top: 40, width: 30, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.textMuted },
  center: { position: 'absolute', top: 0, width: 2, height: 32, borderRadius: 1, backgroundColor: colors.brand },
});
