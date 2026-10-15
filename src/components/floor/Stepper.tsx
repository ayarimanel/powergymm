import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

/** Compact "−  6h  +" number input. */
export const Stepper: React.FC<{ value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string; label: string }> = ({
  value,
  min,
  max,
  onChange,
  suffix = 'h',
  label,
}) => (
  <View style={styles.stepper}>
    <Pressable
      onPress={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
      accessibilityRole="button"
      accessibilityLabel={`${label} moins`}
      style={[styles.stepBtn, value <= min && { opacity: 0.35 }]}
    >
      <Ionicons name="remove" size={16} color={colors.text} />
    </Pressable>
    <Text style={styles.stepValue} accessibilityLabel={`${label} : ${value}${suffix}`}>
      {value}
      {suffix}
    </Text>
    <Pressable
      onPress={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      accessibilityRole="button"
      accessibilityLabel={`${label} plus`}
      style={[styles.stepBtn, value >= max && { opacity: 0.35 }]}
    >
      <Ionicons name="add" size={16} color={colors.text} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 34, textAlign: 'center', fontSize: 14, fontWeight: '800', color: colors.text },
});
