import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from '../ui/Text';
import { colors, radius } from '../../theme';
import { haptics } from '../../utils/haptics';
import { levelTint } from '../../floor/levelColors';

export type CrowdSide = 'gym' | 'muscles';

interface Props {
  /** Front: how full the whole gym is. Receives its header and footer to place inside its own card. */
  renderGym: (header: React.ReactNode, footer: React.ReactNode) => React.ReactNode;
  /** Back: which muscle zones are busy. */
  renderMuscles: (header: React.ReactNode, footer: React.ReactNode) => React.ReactNode;
}

/** Remembers that the member has found the back of the card, so the "Nouveau" dot goes away. */
const SEEN_KEY = '@pg_crowd_flip_seen_v1';

const SIDES: { id: CrowdSide; label: string; icon: string; explain: string }[] = [
  {
    id: 'gym',
    label: 'Toute la salle',
    icon: 'business-outline',
    explain: 'Combien de membres sont au club en ce moment, et à quelle heure c’est le plus calme.',
  },
  {
    id: 'muscles',
    label: 'Par muscle',
    icon: 'body-outline',
    explain: 'Les zones où les membres s’entraînent maintenant. Choisis ton muscle pour savoir si c’est libre.',
  },
];

/** The three levels, in words a member understands without reading a manual. */
export const LevelLegend: React.FC = () => (
  <View style={styles.legend} accessibilityLabel="Calme : de la place. Moyen : un peu d'attente. Chargé : attente probable.">
    {([
      ['calme', 'Calme', 'de la place'],
      ['moyen', 'Moyen', 'un peu d’attente'],
      ['plein', 'Chargé', 'attente probable'],
    ] as const).map(([lvl, word, meaning]) => (
      <View key={lvl} style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: levelTint(lvl).bar }]} />
        <Text style={styles.legendText}>
          <Text style={styles.legendWord}>{word}</Text> {meaning}
        </Text>
      </View>
    ))}
  </View>
);

/**
 * The live crowd, two views (design-ref Affluence): the whole gym, or muscle by muscle.
 * The level legend and the switch sit at the bottom; switching is instant.
 */
export const CrowdFlipCard: React.FC<Props> = ({ renderGym, renderMuscles }) => {
  const [side, setSide] = useState<CrowdSide>('gym');
  const [seenBack, setSeenBack] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then(v => setSeenBack(v === '1'))
      .catch(() => setSeenBack(true));
  }, []);

  const flipTo = (next: CrowdSide) => {
    if (next === side) return;
    haptics.select();
    if (next === 'muscles' && !seenBack) {
      setSeenBack(true);
      AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
    }
    setSide(next);
  };

  const footer = (
    <View style={styles.foot}>
      <LevelLegend />
      <View style={styles.switch} accessibilityRole="tablist">
        {SIDES.map(s => {
          const on = s.id === side;
          return (
            <Pressable
              key={s.id}
              onPress={() => flipTo(s.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={s.label}
              accessibilityHint={s.explain}
              style={[styles.switchBtn, on && styles.switchBtnOn]}
            >
              <Text style={[styles.switchText, on && styles.switchTextOn]} numberOfLines={2}>
                {s.id === 'muscles' ? 'Par muscle · voir les zones prises' : s.label}
              </Text>
              {s.id === 'muscles' && !seenBack && !on && <View style={styles.newDot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return <View>{side === 'gym' ? renderGym(null, footer) : renderMuscles(null, footer)}</View>;
};

const styles = StyleSheet.create({
  head: { gap: 10 },
  switch: { flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, padding: 4 },
  switchBtn: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 56, borderRadius: radius.pill, paddingHorizontal: 14 },
  switchBtnOn: { backgroundColor: colors.text },
  switchText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  switchTextOn: { color: colors.onInverse, fontWeight: '800' },
  newDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand, marginLeft: -2, marginTop: -8 },
  explain: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: colors.textSecondary },

  foot: { gap: 18, marginTop: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 14, color: colors.textSecondary },
  legendWord: { fontWeight: '500', color: colors.textSecondary },
  flipBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  flipText: { fontSize: 13, fontWeight: '800', color: colors.brandText },
  newTag: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  newTagText: { fontSize: 10, fontWeight: '800', color: colors.onBrand },
});
