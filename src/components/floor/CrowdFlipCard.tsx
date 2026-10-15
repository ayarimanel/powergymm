import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';
import { colors, radius } from '../../theme';
import { haptics } from '../../utils/haptics';
import { useReduceMotion } from '../../hooks/useDeviceState';
import { levelTint } from '../../floor/levelColors';

export type CrowdSide = 'gym' | 'muscles';

interface Props {
  /** Front: how full the whole gym is. Receives its header and footer to place inside its own card. */
  renderGym: (header: React.ReactNode, footer: React.ReactNode) => React.ReactNode;
  /** Back: which muscle zones are busy. */
  renderMuscles: (header: React.ReactNode, footer: React.ReactNode) => React.ReactNode;
}

const nativeDriver = Platform.OS !== 'web';
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
 * The live crowd as one card with two sides. The switch on top says there are
 * two sides and which one you are on; the button at the bottom turns it over.
 * The flip runs in two halves so each side keeps its own height.
 */
export const CrowdFlipCard: React.FC<Props> = ({ renderGym, renderMuscles }) => {
  const [side, setSide] = useState<CrowdSide>('gym');
  const [seenBack, setSeenBack] = useState(true);
  const turn = useRef(new Animated.Value(0)).current; // 0 = flat, 1 = edge-on
  const busy = useRef(false);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then(v => setSeenBack(v === '1'))
      .catch(() => setSeenBack(true));
  }, []);

  const flipTo = (next: CrowdSide) => {
    if (next === side || busy.current) return;
    busy.current = true;
    haptics.select();
    if (next === 'muscles' && !seenBack) {
      setSeenBack(true);
      AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
    }
    const half = reduceMotion ? 90 : 170;
    Animated.timing(turn, { toValue: 1, duration: half, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver }).start(() => {
      setSide(next);
      Animated.timing(turn, { toValue: 0, duration: half, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }).start(() => {
        busy.current = false;
      });
    });
  };

  const current = SIDES.find(s => s.id === side)!;
  const other = side === 'gym' ? 'muscles' : 'gym';

  const header = (
    <View style={styles.head}>
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
              style={[styles.switchBtn, on && styles.switchBtnOn]}
            >
              <Icon name={s.icon as any} size={15} color={on ? colors.onInverse : colors.textSecondary} />
              <Text style={[styles.switchText, on && styles.switchTextOn]} numberOfLines={1}>
                {s.label}
              </Text>
              {s.id === 'muscles' && !seenBack && !on && <View style={styles.newDot} />}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.explain}>{current.explain}</Text>
    </View>
  );

  const footer = (
    <View style={styles.foot}>
      <LevelLegend />
      <Pressable
        onPress={() => flipTo(other)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.flipBtn, pressed && { opacity: 0.8 }]}
      >
        <Icon name="sync-outline" size={16} color={colors.brandText} />
        <Text style={styles.flipText}>{side === 'gym' ? 'Voir quels muscles sont pris' : 'Revenir à toute la salle'}</Text>
        {side === 'gym' && !seenBack && (
          <View style={styles.newTag}>
            <Text style={styles.newTagText}>Nouveau</Text>
          </View>
        )}
      </Pressable>
    </View>
  );

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', side === 'gym' ? '90deg' : '-90deg'] });

  return (
    <Animated.View
      style={
        reduceMotion
          ? { opacity: turn.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
          : { transform: [{ perspective: 1200 }, { rotateY: rotate }] }
      }
    >
      {side === 'gym' ? renderGym(header, footer) : renderMuscles(header, footer)}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  head: { gap: 10 },
  switch: { flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, padding: 4 },
  switchBtn: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.pill, paddingHorizontal: 8 },
  switchBtnOn: { backgroundColor: colors.text },
  switchText: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
  switchTextOn: { color: colors.onInverse },
  newDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand, marginLeft: -2, marginTop: -8 },
  explain: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: colors.textSecondary },

  foot: { gap: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textSecondary },
  legendWord: { fontWeight: '800', color: colors.textSecondary },
  flipBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  flipText: { fontSize: 13, fontWeight: '800', color: colors.brandText },
  newTag: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  newTagText: { fontSize: 10, fontWeight: '800', color: colors.onBrand },
});
