import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { Text, TextInput } from './Text';
import { colors, radius } from '../../theme';

/**
 * A code typed into a row of boxes that fill with dots (design-ref Q6Code).
 * The real input is invisible on top of the boxes, so the keyboard, paste and
 * autofill work as with any field. `slots` boxes (6 by default), growing to `max` as the code gets longer.
 */
interface Props {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  max?: number;
  /** Boxes shown before typing (the confirm row uses the chosen code's length). */
  slots?: number;
  error?: string | null;
  accessibilityLabel: string;
}

export const PinBoxes: React.FC<Props> = ({ label, value, onChangeText, max = 8, slots = 6, error, accessibilityLabel }) => {
  const input = useRef<RNTextInput>(null);
  const [focused, setFocused] = useState(false);
  const count = Math.min(max, Math.max(slots, value.length));

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <Pressable onPress={() => input.current?.focus()} style={s.row} accessible={false}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={[s.box, focused && i === value.length && s.boxActive, !!error && s.boxError]}>
            {i < value.length ? <View style={s.dot} /> : null}
          </View>
        ))}
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          maxLength={max}
          caretHidden
          autoComplete="off"
          accessibilityLabel={accessibilityLabel}
          style={s.hidden}
        />
      </Pressable>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { gap: 10 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: colors.textSecondary, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, height: 60, borderRadius: radius.input, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxActive: { borderWidth: 1.5, borderColor: colors.brand },
  boxError: { borderColor: colors.red.bar },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.text },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent' },
  error: { fontSize: 13, fontWeight: '600', color: colors.red.text },
});
