import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ui/Text';
import { Icon, IconName } from './ui/Icon';
import { colors } from '../theme';

const nativeDriver = Platform.OS !== 'web';

/**
 * Collapse a floating button while the user scrolls down (reading), expand it again
 * as soon as they scroll up (looking for the action). Spread the result on a ScrollView.
 */
export const useCollapseOnScroll = (threshold = 10) => {
  const [collapsed, setCollapsed] = useState(false);
  const lastY = useRef(0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;
      if (Math.abs(dy) < threshold) return;
      setCollapsed(dy > 0 && y > 80);
      lastY.current = y;
    },
    [threshold]
  );
  return { collapsed, scrollProps: { onScroll, scrollEventThrottle: 16 } };
};

interface Props {
  icon: IconName;
  label: string;
  onPress: () => void;
  collapsed?: boolean;
  color?: string;
  accessibilityLabel?: string;
  /** Extra content after the label (e.g. a flame on the "Présent" state). */
  trailing?: React.ReactNode;
  /** Laid out by a parent row instead of pinned to the bottom-right corner. */
  inline?: boolean;
}

/** Extended FAB that folds into a round icon button; the label slides out, the icon stays put. */
export const CollapsibleFab: React.FC<Props> = ({ icon, label, onPress, collapsed = false, color = colors.brand, accessibilityLabel, trailing, inline }) => {
  const open = useRef(new Animated.Value(collapsed ? 0 : 1)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(open, { toValue: collapsed ? 0 : 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [collapsed, open]);

  const pressTo = (v: number) => Animated.spring(press, { toValue: v, useNativeDriver: nativeDriver, speed: 40, bounciness: 6 }).start();

  return (
    <Animated.View style={[styles.wrap, inline && styles.inline, { transform: [{ scale: press }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => pressTo(0.94)}
        onPressOut={() => pressTo(1)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        style={[styles.fab, { backgroundColor: color }]}
      >
        <Icon name={icon} size={22} color={colors.white} />
        <Animated.View
          style={{
            overflow: 'hidden',
            maxWidth: open.interpolate({ inputRange: [0, 1], outputRange: [0, 160] }),
            opacity: open,
            marginLeft: open.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }),
          }}
        >
          <View style={styles.labelRow}>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
            {trailing}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 28,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  /** Placed by a parent row (e.g. next to another floating button) instead of the screen corner. */
  inline: { position: 'relative', right: 0, bottom: 0 },
  fab: {
    height: 56,
    minWidth: 56,
    paddingHorizontal: 17,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
