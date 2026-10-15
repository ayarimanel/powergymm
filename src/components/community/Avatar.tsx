import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { colors } from '../../theme';

const PALETTE = [
  { bg: colors.brandSoft, fg: colors.brandDark },
  { bg: colors.green.soft, fg: '#166534' },
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#EDE9FE', fg: '#5B21B6' },
  { bg: colors.flameSoft, fg: colors.flameText },
  { bg: '#CCFBF1', fg: '#115E59' },
];

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

interface Props {
  name: string;
  url?: string;
  size?: number;
  /** Golden ring = member has coach-validated records. */
  gold?: boolean;
  /** Green dot = actually present right now (e.g. a floor coach who's checked in as "here"). */
  online?: boolean;
}

/** Profile photo, or a coloured initial when the member has no photo yet. */
export const Avatar: React.FC<Props> = ({ name, url, size = 40, gold, online }) => {
  const c = PALETTE[hash(name || '?') % PALETTE.length];
  const ring = gold ? 3 : 0;
  const inner = size - ring * 2 - (gold ? 2 : 0);
  const dotSize = Math.max(10, Math.round(size * 0.28));
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
        gold && { borderWidth: ring, borderColor: colors.gold.bar },
      ]}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
      ) : (
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: c.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.fg, fontWeight: '800', fontSize: inner * 0.42 }}>{(name || '?').charAt(0).toUpperCase()}</Text>
        </View>
      )}
      {online && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: colors.green.bar,
            borderWidth: 2,
            borderColor: colors.white,
          }}
        />
      )}
    </View>
  );
};

export const CoachBadge: React.FC = () => (
  <View style={styles.coach}>
    <Text style={styles.coachText}>Coach</Text>
  </View>
);

const styles = StyleSheet.create({
  coach: { backgroundColor: colors.text, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1 },
  coachText: { color: '#FBBF24', fontSize: 12, fontWeight: '800' },
});
