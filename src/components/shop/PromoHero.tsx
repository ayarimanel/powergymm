import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { MarketplaceProduct } from '../../types/database';
import { discountPct, formatPrice } from '../../services/shopService';
import { colors } from '../../theme';
import { cardShadow } from '../../theme';
import { ProductImage } from './ProductImage';

interface Props {
  products: MarketplaceProduct[]; // promo products, best first
  onPress: (p: MarketplaceProduct) => void;
}

const nativeDriver = Platform.OS !== 'web';
const ROTATE_MS = 5000;

/** Auto-rotating carousel of promo products — the "wow" hero at the top, like the Floor live card. */
export const PromoHero: React.FC<Props> = ({ products, onPress }) => {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (products.length < 2) return;
    const id = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 240, easing: Easing.in(Easing.ease), useNativeDriver: nativeDriver }),
      ]).start(() => {
        setIndex(i => (i + 1) % products.length);
        Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: nativeDriver }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [products.length, fade]);

  if (products.length === 0) return null;
  const p = products[Math.min(index, products.length - 1)];
  const pct = discountPct(p);
  const saved = p.originalPriceTnd ? p.originalPriceTnd - p.priceTnd : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.tagRow}>
        <View style={styles.tag}>
          <Ionicons name="flash" size={12} color={colors.red.text} />
          <Text style={styles.tagText}>PROMO DU MOMENT</Text>
        </View>
        {products.length > 1 && (
          <View style={styles.dots}>
            {products.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>
        )}
      </View>

      <Pressable onPress={() => onPress(p)} accessibilityRole="button" accessibilityLabel={`${p.name}, -${pct}%`} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
        <Animated.View style={{ opacity: fade, flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14 }}>
          <View style={styles.imageWrap}>
            <ProductImage uri={p.imageUrls[0]} style={styles.image} />
            <View style={styles.pctBadge}><Text style={styles.pctBadgeText}>-{pct}%</Text></View>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={styles.category}>{p.category}</Text>
            <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatPrice(p.priceTnd)}</Text>
              <Text style={styles.oldPrice}>{formatPrice(p.originalPriceTnd!)}</Text>
            </View>
            {saved > 0 && (
              <View style={styles.savedRow}>
                <Ionicons name="checkmark-circle" size={13} color={colors.green.text} />
                <Text style={styles.savedText}>Tu économises {formatPrice(saved)}</Text>
              </View>
            )}
          </View>

          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  tagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: colors.red.soft },
  tagText: { fontSize: 10, fontWeight: '800', color: colors.red.text, letterSpacing: 0.5 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.red.bar, width: 16 },

  card: { backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.red.soft, ...cardShadow },
  imageWrap: { width: 96, height: 96, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.track },
  image: { width: '100%', height: '100%' },
  pctBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.red.bar, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  pctBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },

  category: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 15, fontWeight: '800', color: colors.text, lineHeight: 19 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  price: { fontSize: 22, fontWeight: '900', color: colors.red.text },
  oldPrice: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'line-through' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  savedText: { fontSize: 12, fontWeight: '700', color: colors.green.text },
});
