import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme';

/** Small uppercase tag (INFO, PROMO, COURS, CARDIO…): tinted background + readable text. */
export type TagTone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'pink' | 'violet' | 'teal';

const TONES: Record<TagTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.track, fg: colors.text },
  brand: { bg: colors.brandSoft, fg: colors.brandText },
  info: { bg: colors.blue.soft, fg: colors.blue.text },
  success: { bg: colors.green.soft, fg: colors.green.text },
  warning: { bg: colors.amber.soft, fg: colors.amber.text },
  pink: { bg: colors.pink.soft, fg: colors.pink.text },
  violet: { bg: colors.violet.soft, fg: colors.violet.text },
  teal: { bg: colors.teal.soft, fg: colors.teal.text },
};

export const Tag: React.FC<{ label: string; tone?: TagTone; style?: StyleProp<ViewStyle> }> = ({ label, tone = 'neutral', style }) => {
  const t = TONES[tone];
  return (
    <View style={[s.tag, { backgroundColor: t.bg }, style]}>
      <Text style={[s.text, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  text: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
});
