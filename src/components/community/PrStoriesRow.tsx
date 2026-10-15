import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { CommunityPost, MemberProfile } from '../../types/database';
import { colors, fonts } from '../../theme';
import { SectionHeader } from '../ui/SectionHeader';
import { Avatar } from './Avatar';
import { claimSwipe } from '../../navigation/swipeGuard';

interface Props {
  records: CommunityPost[]; // PRs with prDetails, newest first
  profiles: Record<string, MemberProfile>;
  onOpen: (index: number) => void;
}

const SIZE = 76;
const STROKE = 2.5;

const GoldRing: React.FC<{ approved: boolean }> = ({ approved }) => {
  const r = (SIZE - STROKE) / 2;
  return (
    <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="prRing" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.brand} />
          <Stop offset="1" stopColor={colors.brandText} />
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
      <SectionHeader title="Records du club" actionLabel="Tout voir" onAction={() => onOpen(0)} style={styles.head} />
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
                  <Icon name={approved ? 'shield-checkmark' : 'hourglass'} size={11} color={colors.white} />
                </View>
              </View>
              <Text style={styles.weight} numberOfLines={1}>{r.prDetails!.weightKg} kg</Text>
              <Text style={styles.exercise} numberOfLines={2}>{r.prDetails!.exercise}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  head: { marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  row: { paddingHorizontal: 16, gap: 16 },
  item: { alignItems: 'center', width: SIZE + 8 },
  circleWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  inner: { width: SIZE - 10, height: SIZE - 10, borderRadius: (SIZE - 10) / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', bottom: -1, right: -1, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.page },
  badgeGold: { backgroundColor: colors.brand },
  badgePending: { backgroundColor: colors.textMuted },
  weight: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 22, lineHeight: 25, color: colors.text, marginTop: 8 },
  exercise: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', textAlign: 'center', lineHeight: 17 },
});
