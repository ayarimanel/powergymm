import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { colors } from '../../theme';
import { WEEK_LABELS } from '../../services/floorViewModel';
import { WeeklyStreak } from '../../floor/weeklyStreak';
import { BottomSheet } from './BottomSheet';
import { Stepper } from '../floor/Stepper';

interface Props {
  visible: boolean;
  onClose: () => void;
  streak: WeeklyStreak;
  onChangeGoal: (goal: number) => void;
}

export const WeekStrip: React.FC<{ dots: boolean[]; todayIdx: number }> = ({ dots, todayIdx }) => (
  <View style={styles.week}>
    {WEEK_LABELS.map((label, i) => (
      <View key={i} style={styles.dayCol}>
        <View style={[styles.dot, dots[i] && styles.dotOn, i === todayIdx && !dots[i] && styles.dotToday]}>
          {dots[i] && <Icon name="flame" size={14} color={colors.white} />}
        </View>
        <Text style={[styles.dayLabel, i === todayIdx && styles.dayLabelToday]}>{label}</Text>
      </View>
    ))}
  </View>
);

/** Weekly streak detail: this week's sessions vs the goal, the goal itself (editable), and the freeze. */
export const StreakSheet: React.FC<Props> = ({ visible, onClose, streak, onChangeGoal }) => {
  const todayIdx = (new Date().getDay() + 6) % 7;
  const left = Math.max(0, streak.goal - streak.thisWeek);
  const weekWord = (n: number) => (n > 1 ? 'semaines' : 'semaine');

  let hint: string;
  if (streak.goalMetThisWeek) hint = 'Objectif de la semaine atteint. Chaque séance en plus, c’est du bonus.';
  else if (streak.current > 0) hint = `Ta série se termine dimanche. Encore ${left} séance${left > 1 ? 's' : ''} cette semaine pour la garder.`;
  else hint = `${left} séance${left > 1 ? 's' : ''} cette semaine pour lancer ta série.`;

  return (
    <BottomSheet visible={visible} onClose={onClose} snaps={[0.62]}>
      {() => (
        <View style={styles.content}>
          <Text style={styles.title} accessibilityRole="header">
            Ta série
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <View style={styles.statValueRow}>
                <Icon name="flame" size={26} color={colors.flame} />
                <Text style={styles.statValue}>{streak.current}</Text>
              </View>
              <Text style={styles.statLabel}>{weekWord(streak.current)} de suite</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {streak.thisWeek}/{streak.goal}
              </Text>
              <Text style={styles.statLabel}>séances cette semaine</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Cette semaine</Text>
          <WeekStrip dots={streak.weekDays} todayIdx={todayIdx} />

          <Text style={styles.hint}>{hint}</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Objectif par semaine</Text>
              <Text style={styles.rowSub}>Séances pour valider une semaine</Text>
            </View>
            <Stepper label="Objectif par semaine" value={streak.goal} min={1} max={7} suffix="" onChange={onChangeGoal} />
          </View>

          <View style={styles.row}>
            <Icon name="snow-outline" size={22} color={colors.brandDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {streak.freezesLeftThisMonth > 0 ? '1 joker dispo ce mois-ci' : 'Joker utilisé ce mois-ci'}
              </Text>
              <Text style={styles.rowSub}>Une semaine ratée par mois ne casse pas ta série.</Text>
            </View>
          </View>
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontSize: 32, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 13, color: colors.textSecondary },
  divider: { width: 1, height: 44, backgroundColor: colors.border },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 10 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6, flex: 1 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.flame },
  dotToday: { borderWidth: 2, borderColor: colors.flame, backgroundColor: colors.card },
  dayLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  dayLabelToday: { color: colors.text, fontWeight: '800' },
  hint: { fontSize: 14, color: colors.textSecondary, marginTop: 18, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 12, borderRadius: 14, backgroundColor: colors.bg },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
