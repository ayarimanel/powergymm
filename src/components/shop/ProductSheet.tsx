import React, { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { MarketplaceProduct } from '../../types/database';
import { colors } from '../../theme';
import { discountPct, formatPrice } from '../../services/shopService';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { ProductImage } from './ProductImage';

interface Props {
  product: MarketplaceProduct | null;
  isOwner: boolean;
  onClose: () => void;
  onReserve: (product: MarketplaceProduct, quantity: number) => void;
  onEdit: (product: MarketplaceProduct) => void;
  onDelete: (product: MarketplaceProduct) => void;
}

const MAX_QTY = 5;

export const ProductSheet: React.FC<Props> = ({ product, isOwner, onClose, onReserve, onEdit, onDelete }) => {
  const [qty, setQty] = useState(1);
  const [imgIndex, setImgIndex] = useState(0);
  const [galleryW, setGalleryW] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Keep the last product while the sheet animates out
  const [shown, setShown] = useState<MarketplaceProduct | null>(product);
  useEffect(() => {
    if (product) {
      setShown(product);
      setQty(1);
      setImgIndex(0);
      setConfirmDelete(false);
    }
  }, [product?.id]);
  useEffect(() => {
    if (product) setShown(product); // reflect live edits (stock toggle etc.)
  }, [product]);

  const p = shown;
  const pct = p ? discountPct(p) : 0;

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (galleryW > 0) setImgIndex(Math.round(e.nativeEvent.contentOffset.x / galleryW));
  };

  return (
    <BottomSheet visible={!!product} onClose={onClose} snaps={[0.9]}>
      {() =>
        p ? (
          <View style={{ flex: 1 }}>
            <SheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              {/* Gallery */}
              <View onLayout={(e: LayoutChangeEvent) => setGalleryW(e.nativeEvent.layout.width)} style={styles.gallery}>
                <SheetScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={onGalleryScroll}
                  scrollEventThrottle={16}
                >
                  {(p.imageUrls.length ? p.imageUrls : [undefined]).map((u, i) => (
                    <ProductImage key={i} uri={u} iconSize={48} style={{ width: galleryW || 320, height: 240 }} />
                  ))}
                </SheetScrollView>
                {p.imageUrls.length > 1 && (
                  <View style={styles.dots}>
                    {p.imageUrls.map((_, i) => (
                      <View key={i} style={[styles.dot, i === imgIndex && styles.dotOn]} />
                    ))}
                  </View>
                )}
                {pct > 0 && (
                  <View style={styles.promo}>
                    <Text style={styles.promoText}>-{pct}%</Text>
                  </View>
                )}
              </View>

              <View style={styles.info}>
                <Text style={styles.category}>{p.category}</Text>
                <Text style={styles.name} accessibilityRole="header">
                  {p.name}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={[styles.price, pct > 0 && { color: colors.red.text }]}>{formatPrice(p.priceTnd)}</Text>
                  {pct > 0 && <Text style={styles.oldPrice}>{formatPrice(p.originalPriceTnd!)}</Text>}
                </View>

                <View style={[styles.stockPill, { backgroundColor: p.inStock ? colors.green.soft : colors.red.soft }]}>
                  <Ionicons
                    name={p.inStock ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={p.inStock ? colors.green.text : colors.red.text}
                  />
                  <Text style={[styles.stockText, { color: p.inStock ? colors.green.text : colors.red.text }]}>
                    {p.inStock ? 'Disponible au club' : 'Rupture de stock'}
                  </Text>
                </View>

                <Text style={styles.desc}>{p.description}</Text>

                {!isOwner && p.inStock && (
                  <View style={styles.pickupNote}>
                    <Ionicons name="storefront-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.pickupText}>Réserve maintenant, paie et retire à l’accueil du club.</Text>
                  </View>
                )}
              </View>
            </SheetScrollView>

            {/* Sticky footer */}
            <View style={styles.footer}>
              {isOwner ? (
                <View style={styles.ownerRow}>
                  <Pressable
                    onPress={() => (confirmDelete ? onDelete(p) : setConfirmDelete(true))}
                    accessibilityRole="button"
                    style={[styles.deleteBtn, confirmDelete && styles.deleteBtnArmed]}
                  >
                    <Ionicons name="trash-outline" size={20} color={confirmDelete ? colors.white : colors.red.text} />
                    {confirmDelete && <Text style={styles.deleteArmedText}>Confirmer</Text>}
                  </Pressable>
                  <Pressable onPress={() => onEdit(p)} accessibilityRole="button" style={styles.editBtn}>
                    <Ionicons name="create-outline" size={20} color={colors.onInverse} />
                    <Text style={[styles.footerBtnText, { color: colors.onInverse }]}>Modifier le produit</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.memberRow}>
                  {p.inStock && (
                    <View style={styles.stepper} accessibilityLabel={`Quantité ${qty}`}>
                      <Pressable
                        onPress={() => setQty(q => Math.max(1, q - 1))}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Diminuer la quantité"
                        style={styles.stepBtn}
                      >
                        <Ionicons name="remove" size={20} color={colors.text} />
                      </Pressable>
                      <Text style={styles.qty}>{qty}</Text>
                      <Pressable
                        onPress={() => setQty(q => Math.min(MAX_QTY, q + 1))}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Augmenter la quantité"
                        style={styles.stepBtn}
                      >
                        <Ionicons name="add" size={20} color={colors.text} />
                      </Pressable>
                    </View>
                  )}
                  <Pressable
                    disabled={!p.inStock}
                    onPress={() => onReserve(p, qty)}
                    accessibilityRole="button"
                    style={[styles.reserveBtn, !p.inStock && styles.reserveBtnOff]}
                  >
                    <Text style={styles.footerBtnText}>
                      {p.inStock ? `Réserver · ${formatPrice(p.priceTnd * qty)}` : 'Indisponible'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        ) : null
      }
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16 },
  gallery: { marginHorizontal: 0 },
  dots: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotOn: { backgroundColor: colors.white, width: 18 },
  promo: {
    position: 'absolute',
    top: 12,
    left: 16,
    backgroundColor: colors.red.bar,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  promoText: { color: colors.white, fontSize: 14, fontWeight: '800' },

  info: { paddingHorizontal: 20, paddingTop: 16 },
  category: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2, lineHeight: 28 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 },
  price: { fontSize: 26, fontWeight: '800', color: colors.text },
  oldPrice: { fontSize: 15, color: colors.textMuted, textDecorationLine: 'line-through' },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  stockText: { fontSize: 13, fontWeight: '700' },
  desc: { fontSize: 15, lineHeight: 22, color: colors.textSecondary, marginTop: 14 },
  pickupNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  pickupText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    height: 48,
  },
  stepBtn: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 22, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.text },
  // Brand blue = the one primary action
  reserveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reserveBtnOff: { backgroundColor: colors.disabled },
  footerBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },

  ownerRow: { flexDirection: 'row', gap: 12 },
  deleteBtn: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.red.bar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteBtnArmed: { backgroundColor: colors.red.bar },
  deleteArmedText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  editBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
