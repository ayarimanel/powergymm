import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Body, { Slug } from 'react-native-body-highlighter';
import { Text } from '../../components/ui/Text';
import { MuscleGroup } from '../../types/database';
import { Recovery } from '../journalLogic';
import { colors } from '../../theme';

/**
 * "Mon corps": vector bodies (react-native-body-highlighter), face + dos side by side,
 * each muscle filled with its recovery color — green Prêt, orange Récupération, red
 * Fatigué, grey for Pas encore. Touching any part of a muscle opens its exercises.
 */
export type BodySex = 'femme' | 'homme';

/** Each drawn part of the vector body → the app's muscle group (no group = not tappable: head, hair). */
const PART: Partial<Record<Slug, MuscleGroup>> = {
  chest: 'chest', abs: 'chest', obliques: 'chest',
  deltoids: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearm: 'arms', hands: 'arms',
  'upper-back': 'back', 'lower-back': 'back', trapezius: 'back', neck: 'back',
  quadriceps: 'legs', hamstring: 'legs', calves: 'legs', gluteal: 'legs', adductors: 'legs', tibialis: 'legs', knees: 'legs', ankles: 'legs', feet: 'legs',
};
/** Parts that take a recovery color: the muscles (hands, feet, joints and neck stay neutral but still open their group). */
const ALL: Slug[] = [...(Object.keys(PART) as Slug[]), 'head', 'hair'];
const COLORED = (Object.keys(PART) as Slug[]).filter(x => !['hands', 'feet', 'knees', 'ankles', 'neck'].includes(x));

const GLOW: Record<Recovery['status'], string | null> = {
  ready: colors.green.bar,
  recovering: colors.amber.bar,
  tired: colors.brand,
  never: null,
};

interface Props {
  sex: BodySex;
  status: Record<MuscleGroup, Recovery['status']>;
  onMuscle: (id: MuscleGroup) => void;
}

const Photo: React.FC<Props & { side: 'face' | 'dos' }> = ({ sex, side, status, onMuscle }) => {
  const [w, setW] = useState(0);
  // A muscle takes its recovery color; not trained yet = the "Pas encore" grey of the legend.
  // Every part gets a color (the drawing's own parts default to a dark grey otherwise).
  const data = ALL.map(slug => ({ slug, color: (COLORED.includes(slug) && GLOW[status[PART[slug]!]]) || colors.disabled }));
  return (
    <View style={s.photo} onLayout={e => setW(e.nativeEvent.layout.width)} accessibilityLabel={side === 'face' ? 'Corps de face' : 'Corps de dos'}>
      {w > 0 && (
        <Body
          data={data}
          side={side === 'face' ? 'front' : 'back'}
          gender={sex === 'femme' ? 'female' : 'male'}
          scale={(w - 16) / 200}
          border="none"
          defaultFill={colors.disabled}
          onBodyPartPress={part => {
            const m = part.slug ? PART[part.slug] : undefined;
            if (m) onMuscle(m);
          }}
        />
      )}
    </View>
  );
};

export const BodyPhotos: React.FC<Props> = props => (
  <View style={s.row}>
    <Photo {...props} side="face" />
    <Photo {...props} side="dos" />
  </View>
);

/** Legend under the photos. */
export const BodyLegend: React.FC = () => (
  <View style={s.legend}>
    {[
      [colors.green.bar, 'Prêt'],
      [colors.amber.bar, 'Récup.'],
      [colors.brand, 'Fatigué'],
      [colors.disabled, 'Pas encore'],
    ].map(([c, l]) => (
      <View key={l} style={s.legendItem}>
        <View style={[s.legendDot, { backgroundColor: c }]} />
        <Text style={s.legendText}>{l}</Text>
      </View>
    ))}
  </View>
);

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  photo: { flex: 1, aspectRatio: 0.47, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
});
