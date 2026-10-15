import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { colors } from '../../theme';
import { haptics } from '../../utils/haptics';
import { claimSwipe } from '../../navigation/swipeGuard';

interface Props {
  onOpen: () => void;
  /** While the member scrolls down, tuck the tab away so only its grip peeks out. */
  collapsed?: boolean;
}

const nativeDriver = Platform.OS !== 'web';
const TUCK = -44; // leaves the grip visible at the screen edge

/**
 * Bottom-left edge tab for "Zones en direct" (which muscles are busy right now).
 * Tap it, or pull it to the right, to open the sheet.
 */
export const MuscleEdgeTab: React.FC<Props> = ({ onOpen, collapsed = false }) => {
  const drag = useRef(new Animated.Value(0)).current;
  const tuck = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(tuck, { toValue: collapsed ? TUCK : 0, useNativeDriver: nativeDriver, speed: 16, bounciness: 4 }).start();
  }, [collapsed, tuck]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // Pulling the tab out is its own drag, not a change of section.
        onPanResponderGrant: () => claimSwipe(),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, Math.min(56, g.dx))),
        onPanResponderRelease: (_, g) => {
          const isTap = Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6;
          Animated.spring(drag, { toValue: 0, useNativeDriver: nativeDriver }).start();
          if (isTap || g.dx > 24) {
            haptics.light();
            onOpen();
          }
        },
        onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: nativeDriver }).start(),
      }),
    [onOpen, drag]
  );

  return (
    <Animated.View
      {...pan.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Zones en direct : muscles occupés maintenant"
      style={[styles.tab, { transform: [{ translateX: Animated.add(tuck, drag) }] }]}
    >
      <Icon name="body-outline" size={22} color={colors.text} />
      <View style={styles.grip} />
      <Icon name="chevron-forward" size={14} color={colors.textMuted} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tab: {
    position: 'absolute',
    left: 0,
    bottom: 20,
    height: 48,
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  grip: { width: 3, height: 18, borderRadius: 2, backgroundColor: colors.disabled },
});
