import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { MarketplaceProduct } from '../../types/database';
import { colors, fonts, ink } from '../../theme';
import { discountPct, formatPrice } from '../../services/shopService';
import { CATEGORY_META, ProductCategory } from '../../shop/categoryMeta';
import { ProductImage } from './ProductImage';

const metaFor = (c: string) => CATEGORY_META[c as ProductCategory] ?? CATEGORY_META['Accessoires'];

interface Props {
  product: MarketplaceProduct;
  isOwner: boolean;
  onPress: () => void;
  onEdit: () => void;
  onToggleStock: (inStock: boolean) => void;
}

/** One product (design-ref Boutique): photo, category, name, price, and a round "+" that opens it. */
export const ProductCard: React.FC<Props> = ({ product: p, isOwner, onPress, onEdit, onToggleStock }) => {
  const pct = discountPct(p);
  const meta = metaFor(p.category);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${formatPrice(p.priceTnd)}${p.inStock ? '' : ', rupture de stock'}`}
        style={({ pressed }) => pressed && { opacity: 0.88 }}
      >
        <View style={styles.imageBox}>
          <ProductImage uri={p.imageUrls[0]} style={[styles.image, !p.inStock && { opacity: 0.4 }]} />

          {pct > 0 && (
            <View style={styles.promo}>
              <Text style={styles.promoText}>-{pct}%</Text>
            </View>
          )}

          {!p.inStock && (
            <View style={styles.soldOutVeil}>
              <View style={styles.soldOutPill}>
                <Icon name="close-circle" size={14} color={colors.onInverse} />
                <Text style={styles.soldOutText}>Rupture</Text>
              </View>
            </View>
          )}

          {p.inStock && p.lowStock && (
            <View style={styles.lowStock}>
              <Icon name="flame" size={12} color={colors.amber.text} />
              <Text style={styles.lowStockText}>Presque plus</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.category} numberOfLines={1}>{p.category}</Text>
          <Text style={[styles.name, !p.inStock && { color: colors.textSecondary }]} numberOfLines={2}>{p.name}</Text>
          <View style={styles.priceRow}>
            <View style={styles.prices}>
              <Text style={[styles.price, !p.inStock && { color: colors.textSecondary }]}>{formatPrice(p.priceTnd)}</Text>
              {pct > 0 && <Text style={styles.oldPrice}>{formatPrice(p.originalPriceTnd!)}</Text>}
            </View>
            {p.inStock && !isOwner && (
              <View style={styles.plus} pointerEvents="none">
                <Icon name="add" size={22} color={colors.white} />
              </View>
            )}
          </View>
        </View>
      </Pressable>

      {isOwner && (
        <Pressable onPress={onEdit} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Modifier ${p.name}`} style={styles.editBtn}>
          <Icon name="create-outline" size={18} color={colors.white} />
        </Pressable>
      )}
      {isOwner && (
        <View style={styles.stockRow}>
          <Text style={styles.stockLabel}>{p.inStock ? 'En stock' : 'Rupture'}</Text>
          <Switch
            value={p.inStock}
            onValueChange={onToggleStock}
            trackColor={{ true: colors.green.bar, false: colors.disabled }}
            thumbColor={colors.white}
            accessibilityLabel={`Disponibilité de ${p.name}`}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { width: '48.5%', padding: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  imageBox: { position: 'relative', borderRadius: 14, overflow: 'hidden', backgroundColor: colors.track },
  image: { width: '100%', aspectRatio: 1 },

  promo: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.brand, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  promoText: { color: colors.white, fontSize: 12, fontWeight: '800' },

  soldOutVeil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  soldOutPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.text, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  soldOutText: { color: colors.onInverse, fontSize: 13, fontWeight: '800' },

  lowStock: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.amber.soft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  lowStockText: { color: colors.amber.text, fontSize: 11, fontWeight: '800' },

  editBtn: { position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: ink(0.6), alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: 4, paddingTop: 10, paddingBottom: 2, gap: 4 },
  category: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted },
  name: { fontSize: 14, fontWeight: '700', color: colors.text, minHeight: 36, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 },
  prices: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 22, lineHeight: 24, color: colors.brandText },
  oldPrice: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through', fontWeight: '600' },
  plus: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },

  stockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  stockLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
