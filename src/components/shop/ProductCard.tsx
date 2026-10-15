import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { MarketplaceProduct } from '../../types/database';
import { card, colors } from '../../theme';
import { discountPct, formatPrice } from '../../services/shopService';
import { CATEGORY_META, ProductCategory } from '../../shop/categoryMeta';

const metaFor = (c: string) => CATEGORY_META[c as ProductCategory] ?? CATEGORY_META['Accessoires'];
import { ProductImage } from './ProductImage';

interface Props {
  product: MarketplaceProduct;
  isOwner: boolean;
  onPress: () => void;
  onEdit: () => void;
  onToggleStock: (inStock: boolean) => void;
}

export const ProductCard: React.FC<Props> = ({ product: p, isOwner, onPress, onEdit, onToggleStock }) => {
  const pct = discountPct(p);
  const meta = metaFor(p.category);
  const saved = p.originalPriceTnd ? p.originalPriceTnd - p.priceTnd : 0;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${formatPrice(p.priceTnd)}${p.inStock ? '' : ', rupture de stock'}`}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        <View style={styles.imageBox}>
          <ProductImage uri={p.imageUrls[0]} style={styles.image} />

          {/* Category pill (subtle, per-category color) */}
          <View style={[styles.catPill, { backgroundColor: meta.tint.soft }]}>
            <Ionicons name={meta.icon as any} size={11} color={meta.tint.bar} />
            <Text style={[styles.catPillText, { color: meta.tint.text }]}>{meta.short}</Text>
          </View>

          {pct > 0 && (
            <View style={styles.promo}>
              <Text style={styles.promoText}>-{pct}%</Text>
            </View>
          )}

          {!p.inStock && (
            <View style={styles.soldOutVeil}>
              <View style={styles.soldOutPill}>
                <Ionicons name="close-circle" size={14} color={colors.white} />
                <Text style={styles.soldOutText}>Rupture</Text>
              </View>
            </View>
          )}

          {p.inStock && p.lowStock && (
            <View style={styles.lowStock}>
              <Ionicons name="flame" size={12} color={colors.amber.text} />
              <Text style={styles.lowStockText}>Presque plus</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, pct > 0 && { color: colors.red.text }]}>{formatPrice(p.priceTnd)}</Text>
            {pct > 0 && <Text style={styles.oldPrice}>{formatPrice(p.originalPriceTnd!)}</Text>}
          </View>
          {pct > 0 && saved > 0 && (
            <Text style={styles.saved}>Économise {formatPrice(saved)}</Text>
          )}
        </View>
      </Pressable>

      {isOwner && (
        <Pressable
          onPress={onEdit}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Modifier ${p.name}`}
          style={styles.editBtn}
        >
          <Ionicons name="create-outline" size={18} color={colors.text} />
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
  card: { ...card, width: '48.5%', overflow: 'hidden', borderRadius: 20 },
  imageBox: { position: 'relative', backgroundColor: colors.track },
  image: { width: '100%', aspectRatio: 1.05 },

  catPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  catPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },

  promo: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.red.bar,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: colors.red.bar,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  promoText: { color: colors.white, fontSize: 12, fontWeight: '800' },

  soldOutVeil: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  soldOutText: { color: colors.white, fontSize: 13, fontWeight: '800' },

  lowStock: {
    position: 'absolute',
    bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.amber.soft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lowStockText: { color: colors.amber.text, fontSize: 11, fontWeight: '800' },

  editBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { padding: 12, gap: 4 },
  name: { fontSize: 14, fontWeight: '800', color: colors.text, minHeight: 36, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { fontSize: 17, fontWeight: '900', color: colors.text },
  oldPrice: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through', fontWeight: '600' },
  saved: { fontSize: 11, fontWeight: '700', color: colors.green.text },

  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.track,
  },
  stockLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
