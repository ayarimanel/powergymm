import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { MuscleGroup } from '../../types/database';
import { MuscleLevel } from '../../floor/useFloorSnapshot';
import { levelTint } from '../../floor/levelColors';
import { colors } from '../../theme';
import { haptics } from '../../utils/haptics';
import { claimSwipe } from '../../navigation/swipeGuard';

interface Props {
  muscles: MuscleLevel[]; // already sorted calmest-first, "mine" pinned first by the hook
  myMuscle: MuscleGroup | null;
  selected: MuscleGroup | null;
  onSelect: (muscle: MuscleGroup | null) => void;
}

const DOT: Record<string, string> = { calme: '🟢', moyen: '🟠', plein: '🔴' };

/** One horizontal row of zone chips; the member's own muscle (if checked in) is bigger and first. */
export const MuscleChips: React.FC<Props> = ({ muscles, myMuscle, selected, onSelect }) => (
  <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
    {muscles.map(m => {
      const mine = m.muscle === myMuscle;
      const active = selected === m.muscle;
      const tint = levelTint(m.level);
      return (
        <Pressable
          key={m.muscle}
          onPress={() => {
            haptics.select();
            onSelect(active ? null : m.muscle);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          accessibilityLabel={`${mine ? 'Ton ' : ''}${m.label}, ${m.level}`}
          style={({ pressed }) => [
            styles.chip,
            mine && styles.chipMine,
            active && { borderColor: tint.text, backgroundColor: tint.soft },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.dot}>{DOT[m.level]}</Text>
          <Text style={[styles.label, mine && styles.labelMine, active && { color: tint.text }]}>
            {mine ? `Ton ${m.label.toLowerCase()}` : m.label}
          </Text>
        </Pressable>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipMine: { height: 42, paddingHorizontal: 16, borderColor: colors.text },
  dot: { fontSize: 12 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  labelMine: { fontSize: 15, fontWeight: '800', color: colors.text },
});
