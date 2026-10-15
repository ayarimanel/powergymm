import React, { forwardRef, useState } from 'react';
import { TextInput as RNTextInput, StyleProp, StyleSheet, TextInputProps, View, ViewStyle } from 'react-native';
import { Text, TextInput } from './Text';
import { Icon, IconName } from './Icon';
import { colors, radius } from '../../theme';

/** Labelled input of the new design (design-ref Q2Infos / Connexion): 56px, radius 16, surface + border. */
interface Props extends TextInputProps {
  /** Small uppercase label above the field. */
  label?: string;
  icon?: IconName;
  error?: string | null;
  /** Anything at the end of the field (show/hide button…). */
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const TextField = forwardRef<RNTextInput, Props>(({ label, icon, error, right, containerStyle, style, onFocus, onBlur, ...rest }, ref) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.wrap, containerStyle]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.field, focused && s.focused, !!error && s.errored]}>
        {icon ? <Icon name={icon} size={20} color={colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.brand}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          {...rest}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e => { setFocused(false); onBlur?.(e); }}
          style={[s.input, style]}
        />
        {right}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
});
TextField.displayName = 'TextField';

const s = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: colors.textSecondary, textTransform: 'uppercase' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 18, borderRadius: radius.input, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  focused: { borderColor: colors.textMuted },
  errored: { borderColor: colors.red.bar },
  input: { flex: 1, height: '100%', color: colors.text, fontSize: 15, fontWeight: '700' },
  error: { fontSize: 13, fontWeight: '600', color: colors.red.text },
});
