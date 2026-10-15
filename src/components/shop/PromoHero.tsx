import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { MarketplaceProduct } from '../../types/database';
import { discountPct, formatPrice } from '../../services/shopService';
import { colors, fonts } from '../../theme';
import { claimSwipe } from '../../navigation/swipeGuard';
import { ProductImage } from './ProductImage';

interface Props {
  products: MarketplaceProduct[]; // promo products, best first
  onPress: (p: MarketplaceProduct) => void;
}

/** "En solde" (design-ref Boutique): a row of sale cards you swipe sideways. */
export const PromoHero: React.FC<Props> = ({ products, onPress }) => {
  if (products.length === 0) return null;
  return (
    <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {products.map(p => {
        const pct = discountPct(p);
        const saved = p.originalPriceTnd ? p.originalPriceTnd - p.priceTnd : 0;
        return (
          <Pressable key={p.id} onPress={() => onPress(p)} accessibilityRole="button" accessibilityLabel={`${p.name}, -${pct}%`} style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}>
            <View style={styles.imageWrap}>
              <ProductImage uri={p.imageUrls[0]} style={styles.image} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={styles.pct}><Text style={styles.pctText}>-{pct}%</Text></View>
              <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatPrice(p.priceTnd)}</Text>
                <Text style={styles.oldPrice}>{formatPrice(p.originalPriceTnd!)}</Text>
              </View>
              {saved > 0 && <Text style={styles.saved} numberOfLines={1}>Tu économises {formatPrice(saved)}</Text>}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { gap: 12, paddingRight: 16 },
  card: { width: 290, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  imageWrap: { width: 96, height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.track },
  image: { width: '100%', height: '100%' },
  pct: { alignSelf: 'flex-start', backgroundColor: colors.brand, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  pctText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  price: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 26, lineHeight: 28, color: colors.brandText },
  oldPrice: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'line-through' },
  saved: { fontSize: 13, fontWeight: '600', color: colors.green.text },
});
