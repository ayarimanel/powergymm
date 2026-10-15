import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { ProductReservation } from '../../types/database';
import { colors } from '../../theme';

interface Props {
  reservations: ProductReservation[]; // member's own, active
  onPress: () => void;
}

/** Ambient "you have orders to pick up" pill above the grid — same shape as the Floor presence strip. */
export const OrdersPill: React.FC<Props> = ({ reservations, onPress }) => {
  if (reservations.length === 0) return null;
  const ready = reservations.filter(r => r.status === 'ready').length;
  const pending = reservations.filter(r => r.status === 'pending').length;

  // Prioritise "ready" — it's the actionable one.
  const isReady = ready > 0;
  const tint = isReady ? colors.green : colors.amber;
  const count = isReady ? ready : pending;
  const label = isReady
    ? `${count} commande${count > 1 ? 's' : ''} prête${count > 1 ? 's' : ''} à retirer`
    : `${count} commande${count > 1 ? 's' : ''} en préparation`;
  const sub = isReady ? "Passe à l'accueil du club" : "L'équipe la prépare, on te prévient dès qu'elle est prête";

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.card, { borderColor: tint.bar + '40' }, pressed && { opacity: 0.9 }]}>
      <View style={[styles.iconWrap, { backgroundColor: tint.soft }]}>
        <Icon name={isReady ? 'bag-check' : 'time-outline'} size={22} color={tint.text} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderWidth: 1, borderRadius: 20, padding: 14 },
  iconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
