import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '../../types/database';
import { useFloorSnapshot } from '../../floor/useFloorSnapshot';
import { LEVEL_LABEL } from '../../floor/crowd';
import { levelTint } from '../../floor/levelColors';
import { card, colors } from '../../theme';

interface Props {
  user: UserProfile;
  capacity: number;
}

/** Ambient "who's on the floor now" strip — the physical-gym hook at the top of the Mur. */
export const FloorPresenceStrip: React.FC<Props> = ({ user, capacity }) => {
  const { snapshot } = useFloorSnapshot(user, capacity);
  if (!snapshot || !snapshot.isOpen) return null;

  const tint = levelTint(snapshot.level);
  const free = snapshot.muscles.filter(m => m.level === 'calme').slice(0, 3);

  return (
    <View style={[styles.card, { borderColor: tint.bar + '40' }]}>
      <View style={[styles.dot, { backgroundColor: tint.bar }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title}>
          <Text style={styles.count}>{snapshot.presentCount}</Text> sur le plateau maintenant
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {free.length > 0 ? `Libre : ${free.map(m => m.label).join(', ')}` : 'Toutes les zones sont occupées'}
        </Text>
      </View>
      <View style={[styles.pill, { backgroundColor: tint.soft }]}>
        <Text style={[styles.pillText, { color: tint.text }]}>{LEVEL_LABEL[snapshot.level]}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { ...card, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  count: { fontSize: 17, fontWeight: '900', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  pill: { paddingHorizontal: 12, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 12, fontWeight: '800' },
});
