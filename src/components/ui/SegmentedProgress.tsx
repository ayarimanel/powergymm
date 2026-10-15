import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme';

/** The sign-up progress bar: `total` thin segments, the first `current` ones in red. */
export const SegmentedProgress: React.FC<{ current: number; total?: number; style?: StyleProp<ViewStyle> }> = ({ current, total = 6, style }) => (
  <View
    style={[s.row, style]}
    accessibilityRole="progressbar"
    accessibilityValue={{ min: 0, max: total, now: Math.min(current, total) }}
  >
    {Array.from({ length: total }, (_, i) => (
      <View key={i} style={[s.seg, i < current && s.on]} />
    ))}
  </View>
);

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.track },
  on: { backgroundColor: colors.brand },
});
