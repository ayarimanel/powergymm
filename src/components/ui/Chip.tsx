import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { colors } from '../../theme';

/**
 * Selectable pill (filters, days, categories). Selected look:
 * - inverse (default): light fill, dark text, as on most mockup screens
 * - brand: red fill, as the shop categories
 */
interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  tone?: 'inverse' | 'brand';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const Chip: React.FC<Props> = ({ label, selected, onPress, icon, tone = 'inverse', style, accessibilityLabel }) => {
  const fg = selected ? (tone === 'brand' ? colors.onBrand : colors.onInverse) : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [s.chip, selected && (tone === 'brand' ? s.onBrand : s.onInverse), pressed && s.pressed, style]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={[s.label, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
};

const s = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexShrink: 0 },
  onInverse: { backgroundColor: colors.text, borderColor: colors.text },
  onBrand: { backgroundColor: colors.brand, borderColor: colors.brand },
  pressed: { opacity: 0.8 },
  label: { fontSize: 13, fontWeight: '700' },
});
