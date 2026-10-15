import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';

/** Flat card of the new design: surface + 1px border, radius 24, no shadow. Pressable when given onPress. */
interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const Card: React.FC<Props> = ({ children, onPress, style, accessibilityLabel }) =>
  onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [s.card, pressed && s.pressed, style]}>
      {children}
    </Pressable>
  ) : (
    <View accessibilityLabel={accessibilityLabel} style={[s.card, style]}>
      {children}
    </View>
  );

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: 18 },
  pressed: { opacity: 0.85 },
});
