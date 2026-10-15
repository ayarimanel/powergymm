import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Text } from '../../components/ui/Text';
import { MuscleGroup } from '../../types/database';
import { Recovery } from '../journalLogic';
import { colors } from '../../theme';

/**
 * "Mon corps" (design-ref HANDOFF): face + dos photos side by side, each muscle's
 * recovery drawn as a soft glow on top — green Prêt, orange Récupération, red
 * Fatigué, nothing for Pas encore. Touching any part of a muscle opens its exercises.
 */
export type BodySex = 'femme' | 'homme';

const IMAGES = {
  femme: { face: require('../../../assets/body/femme-face.jpg'), dos: require('../../../assets/body/femme-dos.jpg') },
  homme: { face: require('../../../assets/body/homme-face.jpg'), dos: require('../../../assets/body/homme-dos.jpg') },
};

/** Glow / tap zones in % of the photo box: centre x, centre y, width, height. */
type Zone = { m: MuscleGroup; x: number; y: number; w: number; h: number };
const ZONES: Record<'face' | 'dos', Zone[]> = {
  face: [
    { m: 'chest', x: 50, y: 25, w: 56, h: 12 }, // HANDOFF
    { m: 'shoulders', x: 31, y: 20, w: 18, h: 10 },
    { m: 'shoulders', x: 69, y: 20, w: 18, h: 10 },
    { m: 'arms', x: 23, y: 36, w: 13, h: 17 },
    { m: 'arms', x: 77, y: 36, w: 13, h: 17 },
    { m: 'legs', x: 39, y: 58, w: 24, h: 20 }, // HANDOFF
    { m: 'legs', x: 61, y: 58, w: 24, h: 20 },
  ],
  dos: [
    { m: 'back', x: 50, y: 27, w: 58, h: 20 }, // HANDOFF
    { m: 'shoulders', x: 31, y: 20, w: 18, h: 10 },
    { m: 'shoulders', x: 69, y: 20, w: 18, h: 10 },
    { m: 'arms', x: 23, y: 36, w: 13, h: 17 },
    { m: 'arms', x: 77, y: 36, w: 13, h: 17 },
    { m: 'legs', x: 39, y: 62, w: 24, h: 20 }, // HANDOFF
    { m: 'legs', x: 61, y: 62, w: 24, h: 20 },
  ],
};

/**
 * Tap areas: the whole body is covered, so touching any part of a muscle opens it
 * (abs → pectoraux side of the torso, hips and glutes → jambes, forearms and hands → bras,
 * neck/traps from the back → dos). Rectangles in % of the photo itself (all four renders
 * share the same framing); drawn in order, so later ones win where they overlap.
 */
type Rect = { m: MuscleGroup; x0: number; x1: number; y0: number; y1: number };
const LIMBS: Rect[] = [
  { m: 'legs', x0: 31, x1: 69, y0: 45, y1: 99 },
  { m: 'arms', x0: 15, x1: 34, y0: 25, y1: 58 },
  { m: 'arms', x0: 66, x1: 85, y0: 25, y1: 58 },
];
const TAPS: Record<'face' | 'dos', Rect[]> = {
  face: [
    ...LIMBS,
    { m: 'chest', x0: 34, x1: 66, y0: 19, y1: 45 },
    { m: 'shoulders', x0: 24, x1: 40, y0: 18, y1: 28 },
    { m: 'shoulders', x0: 60, x1: 76, y0: 18, y1: 28 },
  ],
  dos: [
    ...LIMBS,
    { m: 'back', x0: 34, x1: 66, y0: 18, y1: 43 },
    { m: 'back', x0: 41, x1: 59, y0: 14, y1: 18 },
    { m: 'shoulders', x0: 24, x1: 40, y0: 18, y1: 28 },
    { m: 'shoulders', x0: 60, x1: 76, y0: 18, y1: 28 },
  ],
};
/** The photos are 768 × 1376, shown "cover" in a 0.47-wide box: same height, sides cropped. */
const PHOTO_RATIO = 768 / 1376;
const BOX_RATIO = 0.47;
const toBoxX = (x: number) => (x * PHOTO_RATIO) / BOX_RATIO - ((PHOTO_RATIO / BOX_RATIO - 1) * 100) / 2;

const GLOW: Record<Recovery['status'], string | null> = {
  ready: colors.green.bar,
  recovering: colors.amber.bar,
  tired: colors.brand,
  never: null,
};

const LABEL: Record<MuscleGroup, string> = {
  chest: 'pectoraux',
  back: 'dos',
  shoulders: 'épaules',
  arms: 'bras',
  legs: 'jambes',
  cardio: 'cardio',
};

interface Props {
  sex: BodySex;
  status: Record<MuscleGroup, Recovery['status']>;
  onMuscle: (id: MuscleGroup) => void;
}

const Photo: React.FC<Props & { side: 'face' | 'dos' }> = ({ sex, side, status, onMuscle }) => {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View style={s.photo} onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} accessibilityLabel={side === 'face' ? 'Corps de face' : 'Corps de dos'}>
      {/* Sized from the measured box: a plain absolute fill kept the photo at its natural size on web. */}
      {box.w > 0 && (
        <Image source={IMAGES[sex][side]} style={{ position: 'absolute', top: 0, left: 0, width: box.w, height: box.h }} resizeMode="cover" accessibilityIgnoresInvertColors />
      )}
      {box.w > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            {(['ready', 'recovering', 'tired'] as const).map(k => (
              <RadialGradient key={k} id={`glow-${side}-${k}`} cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={GLOW[k]!} stopOpacity={0.9} />
                <Stop offset="0.55" stopColor={GLOW[k]!} stopOpacity={0.45} />
                <Stop offset="1" stopColor={GLOW[k]!} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {ZONES[side].map((z, i) => {
            const st = status[z.m];
            if (!GLOW[st]) return null;
            return (
              <Ellipse
                key={i}
                cx={(z.x / 100) * box.w}
                cy={(z.y / 100) * box.h}
                rx={(z.w / 200) * box.w}
                ry={(z.h / 200) * box.h}
                fill={`url(#glow-${side}-${st})`}
              />
            );
          })}
        </Svg>
      )}
      {/* Tap areas over the whole body, invisible */}
      {TAPS[side].map((z, i) => {
        const left = Math.max(0, toBoxX(z.x0));
        const right = Math.min(100, toBoxX(z.x1));
        return (
          <Pressable
            key={i}
            onPress={() => onMuscle(z.m)}
            accessibilityRole="button"
            accessibilityLabel={`Exercices ${LABEL[z.m]}`}
            style={[s.zone, { left: `${left}%`, top: `${z.y0}%`, width: `${right - left}%`, height: `${z.y1 - z.y0}%` }]}
          />
        );
      })}
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
  photo: { flex: 1, aspectRatio: 0.47, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.black, borderWidth: 1, borderColor: colors.bg },
  zone: { position: 'absolute' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
});
