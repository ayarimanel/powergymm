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
import { Icon } from '../ui/Icon';
import { MarketplaceProduct } from '../../types/database';
import { buttonShadow, colors, fonts, light } from '../../theme';
import { Title } from '../ui/Title';
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
    <BottomSheet visible={!!product} onClose={onClose} snaps={[0.9]} pageMotion="fade">
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
                    <ProductImage key={i} uri={u} iconSize={48} style={{ width: galleryW || 320, height: 340 }} />
                  ))}
                </SheetScrollView>
                {p.imageUrls.length > 1 && (
                  <View style={styles.dots}>
                    {p.imageUrls.map((_, i) => (
                      <View key={i} style={[styles.dot, i === imgIndex && styles.dotOn]} />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.info}>
                <Text style={styles.category}>{p.category}</Text>
                <Title variant="section" size={32} style={{ marginTop: 6 }}>{p.name}</Title>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>{formatPrice(p.priceTnd)}</Text>
                  {pct > 0 && <Text style={styles.oldPrice}>{formatPrice(p.originalPriceTnd!)}</Text>}
                  {pct > 0 && (
                    <View style={styles.promo}>
                      <Text style={styles.promoText}>-{pct}%</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.stockPill, { backgroundColor: p.inStock ? colors.green.soft : colors.red.soft }]}>
                  <Icon
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
                    <Icon name="storefront-outline" size={18} color={colors.textSecondary} />
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
                    <Icon name="trash-outline" size={20} color={confirmDelete ? colors.white : colors.red.text} />
                    {confirmDelete && <Text style={styles.deleteArmedText}>Confirmer</Text>}
                  </Pressable>
                  <Pressable onPress={() => onEdit(p)} accessibilityRole="button" style={styles.editBtn}>
                    <Icon name="create-outline" size={20} color={colors.onInverse} />
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
                        <Icon name="remove" size={20} color={colors.text} />
                      </Pressable>
                      <Text style={styles.qty}>{qty}</Text>
                      <Pressable
                        onPress={() => setQty(q => Math.min(MAX_QTY, q + 1))}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Augmenter la quantité"
                        style={styles.stepBtn}
                      >
                        <Icon name="add" size={20} color={colors.text} />
                      </Pressable>
                    </View>
                  )}
                  <Pressable
                    disabled={!p.inStock}
                    onPress={() => onReserve(p, qty)}
                    accessibilityRole="button"
                    style={[styles.reserveBtn, !p.inStock && styles.reserveBtnOff]}
                  >
                    <Text style={styles.footerBtnText} numberOfLines={1}>
                      {p.inStock ? `Ajouter au panier · ${formatPrice(p.priceTnd * qty)}` : 'Indisponible'}
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
  dots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: light(0.5) },
  dotOn: { backgroundColor: colors.white, width: 18 },
  promo: { backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  promoText: { color: colors.white, fontSize: 14, fontWeight: '800' },

  info: { paddingHorizontal: 20, paddingTop: 20 },
  category: { fontSize: 12, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: colors.brandText },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2, lineHeight: 28 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  price: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 44, lineHeight: 46, color: colors.brandText },
  oldPrice: { fontSize: 16, color: colors.textMuted, textDecorationLine: 'line-through' },
  stockPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  stockText: { fontSize: 13, fontWeight: '700' },
  desc: { fontSize: 15, fontWeight: '500', lineHeight: 23, color: colors.textSecondary, marginTop: 14 },
  pickupNote: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  pickupText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 999, height: 56 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 28, textAlign: 'center', fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 22, color: colors.text },
  reserveBtn: { flex: 1, height: 56, borderRadius: 999, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...buttonShadow },
  reserveBtnOff: { backgroundColor: colors.disabled, shadowOpacity: 0, elevation: 0 },
  footerBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '700' },

  ownerRow: { flexDirection: 'row', gap: 12 },
  deleteBtn: { minWidth: 56, height: 56, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: colors.red.bar, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  deleteBtnArmed: { backgroundColor: colors.red.bar },
  deleteArmedText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  editBtn: { flex: 1, height: 56, borderRadius: 999, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
