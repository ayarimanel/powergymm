import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from './Text';
import { Title } from './Title';
import { colors } from '../../theme';

/** Big section title with an optional small red link on the right ("Voir", "Tout voir"). */
interface Props {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Anything else on the right instead of the link. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const SectionHeader: React.FC<Props> = ({ title, actionLabel, onAction, right, style }) => (
  <View style={[s.row, style]}>
    <Title variant="section" style={s.title} numberOfLines={1}>{title}</Title>
    {right ??
      (actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={s.link}>{actionLabel}</Text>
        </Pressable>
      ) : null)}
  </View>
);

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
  link: { fontSize: 13, fontWeight: '700', color: colors.brand },
});
