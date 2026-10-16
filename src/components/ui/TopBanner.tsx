import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme';
import { Wordmark } from './Wordmark';

/**
 * Colored band with the club logo in the middle, on top of every tab except Accueil
 * (Figma "Go Gym" header, in Power Gym colors). It also covers the phone's status bar area.
 */
export const TopBanner: React.FC<{ topInset: number }> = ({ topInset }) => (
  <View style={[s.band, { paddingTop: topInset + 8 }]} accessibilityRole="header">
    <Wordmark size={21} onDark tint={colors.white} style={{ alignSelf: 'center' }} />
  </View>
);

const s = StyleSheet.create({
  band: {
    paddingBottom: 10,
    minHeight: 50,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.topBar,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
});
