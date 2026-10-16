import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { buttonShadow, colors, radius } from '../../theme';

const nativeDriver = Platform.OS !== 'web';

export interface BarTab {
  id: string;
  label: string;
  icon: IconName;
}

interface Props {
  /** Tabs left of Scan, then right of it. */
  left: BarTab[];
  right: BarTab[];
  active: string;
  onTab: (id: string) => void;
  bottomInset: number;
}

/**
 * Floating navbar (design-ref HANDOFF "Navbar"): 16px from the sides, 22px from the
 * bottom, 72px high, radius 28, surface + border. Active = red icon + small red dash.
 * Scan is the red circle in the middle.
 */
export const FloatingTabBar: React.FC<Props> = ({ left, right, active, onTab, bottomInset }) => (
  <View style={[s.wrap, { marginBottom: 22 + bottomInset }]}>
    <View style={s.bar} accessibilityRole="tablist">
      {left.map(t => <Item key={t.id} tab={t} active={active === t.id} onPress={() => onTab(t.id)} />)}
      {right.map(t => <Item key={t.id} tab={t} active={active === t.id} onPress={() => onTab(t.id)} />)}
    </View>
  </View>
);

/** One tab: icon + label, red with a short dash under it when active; a small bounce when pressed. */
function Item({ tab, active, onPress }: { tab: BarTab; active: boolean; onPress: () => void }) {
  const on = useRef(new Animated.Value(active ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(on, { toValue: active ? 1 : 0, useNativeDriver: nativeDriver, speed: 18, bounciness: 8 }).start();
  }, [active, on]);

  const pressTo = (v: number) => Animated.spring(press, { toValue: v, useNativeDriver: nativeDriver, speed: 40, bounciness: 10 }).start();
  const color = active ? colors.tabActive : colors.tabInactive;

  return (
    <Pressable
      style={[s.item, active && s.itemActive]}
      onPress={onPress}
      onPressIn={() => pressTo(0.86)}
      onPressOut={() => pressTo(1)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={{ transform: [{ scale: press }] }}>
        <Icon name={tab.icon} size={22} color={color} />
      </Animated.View>
      {/* As in the mockup: only the active tab spells its name (screen readers get it on every tab). */}
      {active ? <Text style={[s.label, { color }]} numberOfLines={1}>{tab.label}</Text> : null}
      <Animated.View style={[s.dash, { opacity: on, transform: [{ scaleX: on }] }]} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
  bar: {
    height: 72,
    borderRadius: 28,
    backgroundColor: colors.inverse,
    borderWidth: 1,
    borderColor: colors.inverse,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  itemActive: { flex: 1.45 },
  item: { flex: 1, minWidth: 48, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 7 },
  label: { fontSize: 11, fontWeight: '700' },
  dash: { width: 16, height: 3, borderRadius: 2, backgroundColor: colors.tabActive },
  scan: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  scanDone: { backgroundColor: colors.green.bar },
});
