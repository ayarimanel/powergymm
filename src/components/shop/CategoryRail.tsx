import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORY_META, PROMO_TINT, ProductCategory } from '../../shop/categoryMeta';
import { colors } from '../../theme';
import { haptics } from '../../utils/haptics';
import { claimSwipe } from '../../navigation/swipeGuard';

type Filter = 'all' | 'promo' | ProductCategory;

interface Props {
  active: Filter;
  counts: Record<Filter, number>;
  onSelect: (f: Filter) => void;
}

const nativeDriver = Platform.OS !== 'web';
const SIZE = 62;

const Bubble: React.FC<{
  label: string;
  icon: string;
  count: number;
  on: boolean;
  bar: string;
  soft: string;
  text: string;
  delay: number;
  onPress: () => void;
}> = ({ label, icon, count, on, bar, soft, text, delay, onPress }) => {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: 380, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: nativeDriver }).start();
  }, [pop, delay]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Pressable onPress={() => { haptics.select(); onPress(); }} accessibilityRole="button" accessibilityLabel={`${label}, ${count} produit${count > 1 ? 's' : ''}`} style={styles.item}>
      <Animated.View style={[styles.circle, { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: soft, borderColor: on ? bar : 'transparent', transform: [{ scale }] }]}>
        <Ionicons name={icon as any} size={26} color={bar} />
        {count > 0 && (
          <View style={styles.count}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </Animated.View>
      <Text style={[styles.label, on && { color: text, fontWeight: '800' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
};

const AllBubble: React.FC<{ on: boolean; count: number; onPress: () => void; delay: number }> = ({ on, count, onPress, delay }) => {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: 380, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: nativeDriver }).start();
  }, [pop, delay]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <Pressable onPress={() => { haptics.select(); onPress(); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={styles.item}>
      <Animated.View style={[styles.circle, styles.allCircle, on && styles.allCircleOn, { transform: [{ scale }] }]}>
        <Ionicons name="apps" size={24} color={on ? colors.white : colors.text} />
      </Animated.View>
      <Text style={[styles.label, on && { color: colors.text, fontWeight: '800' }]}>Tout</Text>
    </Pressable>
  );
};

export const CategoryRail: React.FC<Props> = ({ active, counts, onSelect }) => {
  const cats: [ProductCategory, ReturnType<typeof getMeta>][] = (Object.keys(CATEGORY_META) as ProductCategory[]).map(c => [c, getMeta(c)]);
  const promoCount = counts.promo;

  return (
    <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <AllBubble on={active === 'all'} count={counts.all} onPress={() => onSelect('all')} delay={0} />
      {promoCount > 0 && (
        <Bubble
          label="Promos"
          icon="pricetag"
          count={promoCount}
          on={active === 'promo'}
          bar={PROMO_TINT.bar}
          soft={PROMO_TINT.soft}
          text={PROMO_TINT.text}
          delay={70}
          onPress={() => onSelect('promo')}
        />
      )}
      {cats.map(([c, meta], i) => (
        <Bubble
          key={c}
          label={meta.short}
          icon={meta.icon}
          count={counts[c] ?? 0}
          on={active === c}
          bar={meta.tint.bar}
          soft={meta.tint.soft}
          text={meta.tint.text}
          delay={(promoCount > 0 ? 140 : 70) + i * 60}
          onPress={() => onSelect(c)}
        />
      ))}
    </ScrollView>
  );
};

const getMeta = (c: ProductCategory) => CATEGORY_META[c];

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'flex-start' },
  item: { alignItems: 'center', gap: 6, width: 66 },
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  allCircle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
  allCircleOn: { backgroundColor: colors.text, borderColor: colors.text, borderStyle: 'solid' },
  count: { position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.header },
  countText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  label: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textAlign: 'center', maxWidth: 72 },
});
