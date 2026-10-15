import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from './Text';
import { clubTheme, colors, fonts } from '../../theme';

/** The text logo: main word + accent word in the club color, small spaced line under it. Words come from clubTheme.wordmark. */
export const Wordmark: React.FC<{ size?: number; style?: StyleProp<ViewStyle> }> = ({ size = 28, style }) => {
  const w = clubTheme.wordmark;
  return (
    <View style={[s.wrap, style]} accessible accessibilityRole="image" accessibilityLabel={clubTheme.clubName}>
      <Text style={[s.main, { fontSize: size, lineHeight: Math.round(size * 1.05) }]}>
        {w.main}
        <Text style={[s.main, { color: colors.brand }]}>{w.accent}</Text>
      </Text>
      {w.sub ? <Text style={[s.sub, { fontSize: Math.max(9, Math.round(size * 0.36)), letterSpacing: Math.round(size * 0.21) }]}>{w.sub}</Text> : null}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  main: { fontFamily: fonts.display, fontWeight: 'normal', color: colors.text },
  sub: { fontWeight: '800', color: colors.textSecondary, marginTop: 2 },
});
