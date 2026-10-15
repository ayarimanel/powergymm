import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface Props {
  message: string | null;
  onHide: () => void;
}

/** Small transient message above the FAB (e.g. "Déjà validé aujourd'hui"). */
export const Toast: React.FC<Props> = ({ message, onHide }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onHide();
      });
    }, 2200);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { opacity }]}
    >
      <Ionicons name="checkmark-circle" size={18} color={colors.nightSuccess} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 76,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  text: { color: colors.onInverse, fontSize: 14, fontWeight: '600' },
});
