import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { colors, fonts, radius } from '../../theme';

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Monday-based index (0 = Monday) of the days this week that have a check-in. */
export const visitedDaysThisWeek = (checkInTimes: string[], now = new Date()): number[] => {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = new Set<number>();
  for (const iso of checkInTimes) {
    const d = new Date(iso);
    const diff = Math.floor((d.getTime() - monday.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) days.add(diff);
  }
  return [...days].sort();
};

interface Props {
  /** Days this week with a visit (0 = Monday). */
  visited: number[];
  /** Sessions the member aims for each week. */
  goal: number;
}

/** "Objectif de la semaine" (Figma inspiration): visits this week against the member's usual rhythm. */
export const WeeklyGoalCard: React.FC<Props> = ({ visited, goal }) => {
  const done = visited.length;
  const ratio = Math.min(1, done / Math.max(1, goal));
  const reached = done >= goal;
  const today = (new Date().getDay() + 6) % 7;
  return (
    <View style={s.card} accessibilityLabel={`Objectif de la semaine : ${done} séances sur ${goal}`}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>Objectif de la semaine</Text>
          <View style={s.countRow}>
            <Text style={s.count}>{done}</Text>
            <Text style={s.of}>/ {goal} séances</Text>
          </View>
        </View>
        <View style={[s.badge, reached && s.badgeOn]}>
          <Icon name={reached ? 'trophy' : 'barbell-outline'} size={24} color={reached ? colors.white : colors.text} />
        </View>
      </View>

      <View style={s.track}>
        <View style={[s.fill, { width: `${ratio * 100}%` }]} />
      </View>

      <View style={s.days}>
        {DAY_LETTERS.map((l, i) => {
          const on = visited.includes(i);
          return (
            <View key={i} style={[s.day, on && s.dayOn, i === today && !on && s.dayToday]}>
              <Text style={[s.dayText, on && { color: colors.white }]}>{l}</Text>
            </View>
          );
        })}
      </View>
      <Text style={s.sub}>{reached ? 'Objectif atteint, bravo !' : `Encore ${goal - done} séance${goal - done > 1 ? 's' : ''} cette semaine`}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  card: { padding: 20, gap: 14, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textSecondary },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  count: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 40, lineHeight: 42, color: colors.text },
  of: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  badge: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' },
  badgeOn: { backgroundColor: colors.brand },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.brand },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.brand },
  dayToday: { borderWidth: 1.5, borderColor: colors.text },
  dayText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  sub: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
