import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { CommunityPost, MemberProfile } from '../../types/database';
import { colors } from '../../theme';
import { Avatar } from './Avatar';
import { claimSwipe } from '../../navigation/swipeGuard';

interface Props {
  records: CommunityPost[]; // PRs with prDetails, newest first
  profiles: Record<string, MemberProfile>;
  onOpen: (index: number) => void;
}

const SIZE = 66;
const STROKE = 3;

const GoldRing: React.FC<{ approved: boolean }> = ({ approved }) => {
  const r = (SIZE - STROKE) / 2;
  return (
    <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="prRing" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.gold.border} />
          <Stop offset="0.5" stopColor={colors.gold.bar} />
          <Stop offset="1" stopColor={colors.gold.deep} />
        </LinearGradient>
      </Defs>
      <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={approved ? 'url(#prRing)' : colors.border} strokeWidth={STROKE} strokeDasharray={approved ? undefined : '4 4'} fill="none" />
    </Svg>
  );
};

/** Stories-style rail of recent records at the top of the Mur. Gold ring = coach-validated. */
export const PrStoriesRow: React.FC<Props> = ({ records, profiles, onOpen }) => {
  if (records.length === 0) return null;
  return (
    <View>
      <View style={styles.head}>
        <Ionicons name="trophy" size={16} color={colors.gold.deep} />
        <Text style={styles.title}>Records du club</Text>
      </View>
      <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={styles.row}>
        {records.map((r, i) => {
          const approved = r.prApproval?.status === 'approved';
          const p = profiles[r.userId];
          return (
            <Pressable
              key={r.id}
              onPress={() => onOpen(i)}
              accessibilityRole="button"
              accessibilityLabel={`${r.userName}, ${r.prDetails!.exercise}, ${r.prDetails!.weightKg} kilos${approved ? ', validé' : ', en attente'}`}
              style={styles.item}
            >
              <View style={styles.circleWrap}>
                <GoldRing approved={approved} />
                <View style={styles.inner}>
                  <Avatar name={r.userName} url={p?.avatarUrl} size={SIZE - 14} />
                </View>
                <View style={[styles.badge, approved ? styles.badgeGold : styles.badgePending]}>
                  <Ionicons name={approved ? 'shield-checkmark' : 'hourglass'} size={11} color={colors.white} />
                </View>
              </View>
              <Text style={styles.weight} numberOfLines={1}>{r.prDetails!.weightKg} kg</Text>
              <Text style={styles.exercise} numberOfLines={1}>{r.prDetails!.exercise}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  row: { paddingHorizontal: 16, gap: 14 },
  item: { alignItems: 'center', width: SIZE + 6 },
  circleWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  inner: { width: SIZE - 10, height: SIZE - 10, borderRadius: (SIZE - 10) / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', bottom: -1, right: -1, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  badgeGold: { backgroundColor: colors.gold.bar },
  badgePending: { backgroundColor: colors.textMuted },
  weight: { fontSize: 13, fontWeight: '900', color: colors.gold.text, marginTop: 5 },
  exercise: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
});
