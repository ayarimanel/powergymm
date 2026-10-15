import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { Title } from '../../ui/Title';
import { colors } from '../../../theme';

interface Props {
  onJoin: () => void;
}

/**
 * "Défi du club" banner at the top of Pour toi (design-ref Communauté).
 * DEMO CONTENT: the app has no challenges yet, so this card is static. Delete
 * this file and its one use in CommunityScreen when real challenges exist.
 */
export const ClubChallengeCard: React.FC<Props> = ({ onJoin }) => (
  <View style={s.card}>
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id="challenge" x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.brand} stopOpacity="0.55" />
          <Stop offset="0.55" stopColor={colors.brand} stopOpacity="0.12" />
          <Stop offset="1" stopColor={colors.night} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#challenge)" />
    </Svg>
    <View style={s.mark} pointerEvents="none">
      <Icon name="barbell" size={150} color={colors.text} />
    </View>

    <View style={s.tag}>
      <Text style={s.tagText}>Défi du club</Text>
    </View>
    <Title variant="card" size={32} style={s.title}>Défi deadlift samedi</Title>
    <View style={s.bottom}>
      <View style={s.lineRow}>
        <View style={s.lineMark} />
        <Text style={s.line}>Inscriptions à l’accueil · 1 mois offert au gagnant</Text>
      </View>
      <Pressable onPress={onJoin} accessibilityRole="button" style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}>
        <Text style={s.btnText}>Participer</Text>
      </Pressable>
    </View>
  </View>
);

const s = StyleSheet.create({
  card: { minHeight: 220, borderRadius: 24, overflow: 'hidden', padding: 20, justifyContent: 'flex-end', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  mark: { position: 'absolute', top: -10, right: -20, opacity: 0.08, transform: [{ rotate: '-20deg' }] },
  tag: { position: 'absolute', top: 18, left: 20, backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.white },
  title: { maxWidth: '75%' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineMark: { width: 3, height: 18, borderRadius: 2, marginTop: 1, backgroundColor: colors.brand },
  line: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20, color: colors.brandText },
  btn: { height: 46, paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '800', color: colors.onInverse },
});
