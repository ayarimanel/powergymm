import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { CoachProfile } from '../../types/database';
import { isOnFloorNow } from '../../services/coachService';
import { Avatar } from '../community/Avatar';
import { card, colors } from '../../theme';

// ---------- Which coaches are actually on the floor right now ----------

interface OnFloorProps {
  coaches: CoachProfile[];
  onOpen: () => void;
}

/** Home/Floor screen widget: only shows when the club has at least one "coach plateau". */
export const OnFloorCoaches: React.FC<OnFloorProps> = ({ coaches, onOpen }) => {
  const floorCoaches = coaches.filter(c => c.onFloor && c.status !== 'pending');
  if (floorCoaches.length === 0) return null;
  const live = floorCoaches.filter(c => isOnFloorNow(c));

  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Coachs sur le plateau" style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
      <View style={styles.row}>
        <View style={styles.avatars}>
          {(live.length ? live : floorCoaches).slice(0, 4).map(c => (
            <View key={c.id} style={styles.avatarWrap}>
              <Avatar name={c.fullName} url={c.avatarUrl} size={40} online={isOnFloorNow(c)} />
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{live.length > 0 ? 'Sur le plateau maintenant' : 'Aucun coach sur le plateau'}</Text>
          <Text style={styles.sub}>
            {live.length > 0
              ? live.map(c => c.fullName).join(', ')
              : 'Ils reviennent selon leurs horaires habituels.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </Pressable>
  );
};

// ---------- Owner: console entry ----------

export const ConsoleCard: React.FC<{ todo: number; onOpen: () => void }> = ({ todo, onOpen }) => (
  <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Console du club, ${todo} à traiter`} style={({ pressed }) => [styles.card, styles.consoleCard, pressed && { opacity: 0.9 }]}>
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
        <Ionicons name="stats-chart" size={22} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.white }]}>Console du club</Text>
        <Text style={[styles.sub, { color: colors.disabled }]}>Affluence, relances, abonnements</Text>
      </View>
      {todo > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{todo} à traiter</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color={colors.disabled} />
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  card: { ...card, padding: 14 },
  consoleCard: { backgroundColor: colors.text, borderColor: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatars: { flexDirection: 'row', paddingRight: 8 },
  avatarWrap: { marginRight: -12, borderWidth: 2, borderColor: colors.card, borderRadius: 24 },
  iconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.textSecondary, marginTop: 2, lineHeight: 19 },
  helpBtn: { height: 48, borderRadius: 24, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 },
  helpText: { fontSize: 15, fontWeight: '800', color: colors.white },
  badge: { backgroundColor: colors.red.bar, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.white },
});
