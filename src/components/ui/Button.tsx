import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { buttonShadow, colors, light } from '../../theme';

/**
 * The club's buttons (design-ref Bienvenue / Q1Role):
 * - primary: red 56px pill with the red glow (the one main action of a screen)
 * - secondary: outline 1.5px, neutral
 * - ghost: text only
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Icon after the label (e.g. arrow-forward). */
  icon?: IconName;
  /** Icon before the label. */
  iconLeft?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** 44px instead of 56px. */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** On a dark photo (welcome screen): white label and outline, whatever the theme. */
  onDark?: boolean;
}

export const Button: React.FC<Props> = ({ label, onPress, variant = 'primary', icon, iconLeft, loading, disabled, small, style, accessibilityLabel, onDark }) => {
  const fg = variant === 'primary' ? colors.onBrand : onDark ? colors.white : colors.text;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        s.base,
        small && s.small,
        variant === 'primary' && s.primary,
        variant === 'primary' && !off && buttonShadow,
        variant === 'secondary' && s.secondary,
        variant === 'secondary' && onDark && { borderColor: light(0.45) },
        variant === 'ghost' && s.ghost,
        disabled && s.disabled,
        pressed && !off && (variant === 'primary' ? s.primaryPressed : s.pressed),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {iconLeft ? <Icon name={iconLeft} size={18} color={fg} /> : null}
          <Text style={[s.label, small && s.labelSmall, { color: fg }]} numberOfLines={1}>{label}</Text>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
        </>
      )}
    </Pressable>
  );
};

const s = StyleSheet.create({
  base: { height: 56, borderRadius: 999, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  small: { height: 44, paddingHorizontal: 18, gap: 8 },
  primary: { backgroundColor: colors.brand },
  primaryPressed: { backgroundColor: colors.brandDark },
  secondary: { borderWidth: 1.5, borderColor: colors.disabled },
  ghost: { paddingHorizontal: 12 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  label: { fontSize: 15, fontWeight: '800' },
  labelSmall: { fontSize: 14 },
});
