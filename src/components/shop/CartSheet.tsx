import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { Title } from '../ui/Title';
import { MarketplaceProduct } from '../../types/database';
import { formatPrice } from '../../services/shopService';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { ProductImage } from './ProductImage';
import { buttonShadow, colors, fonts, radius } from '../../theme';

interface Props {
  visible: boolean;
  lines: { product: MarketplaceProduct; quantity: number }[];
  onClose: () => void;
  onSetQty: (productId: string, quantity: number) => void;
  onOrder: () => void;
  onOpenOrders: () => void;
}

/** "Panier" (design-ref Panier): what the member picked, quantities, total, then one "Commander". */
export const CartSheet: React.FC<Props> = ({ visible, lines, onClose, onSetQty, onOrder, onOpenOrders }) => {
  const orderable = lines.filter(l => l.product.inStock);
  const count = orderable.reduce((a, l) => a + l.quantity, 0);
  const total = orderable.reduce((a, l) => a + l.quantity * l.product.priceTnd, 0);

  return (
    <BottomSheet visible={visible} onClose={onClose} snaps={[0.92]} pageMotion="fade" header={<Title variant="section" size={26}>Panier</Title>}>
      {(_e, extraBottom) => (
        <View style={{ flex: 1 }}>
          <SheetScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 24 + extraBottom }]} showsVerticalScrollIndicator={false}>
            {lines.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><Icon name="bag-handle-outline" size={34} color={colors.textMuted} /></View>
                <Text style={styles.emptyTitle}>Ton panier est vide</Text>
                <Text style={styles.emptySub}>Choisis un produit et touche « Ajouter au panier ».</Text>
                <Pressable onPress={onOpenOrders} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.link}>Voir mes commandes</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Title variant="display" size={40}>{count} article{count > 1 ? 's' : ''}</Title>
                {lines.map(({ product: p, quantity }) => (
                  <View key={p.id} style={[styles.row, !p.inStock && { opacity: 0.55 }]}>
                    <ProductImage uri={p.imageUrls[0]} style={styles.thumb} iconSize={24} />
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
                      <Text style={styles.unit}>{p.inStock ? `${formatPrice(p.priceTnd)} / unité` : 'En rupture : pas commandé'}</Text>
                      <View style={styles.rowBottom}>
                        <View style={styles.stepper}>
                          <Pressable onPress={() => onSetQty(p.id, quantity - 1)} hitSlop={6} accessibilityRole="button" accessibilityLabel={quantity > 1 ? `Un ${p.name} de moins` : `Retirer ${p.name} du panier`} style={styles.stepBtn}>
                            <Icon name={quantity > 1 ? 'remove' : 'trash-outline'} size={18} color={colors.text} />
                          </Pressable>
                          <Text style={styles.qty} accessibilityLabel={`Quantité ${quantity}`}>{quantity}</Text>
                          <Pressable onPress={() => onSetQty(p.id, quantity + 1)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Un ${p.name} de plus`} style={styles.stepBtn}>
                            <Icon name="add" size={18} color={colors.text} />
                          </Pressable>
                        </View>
                        <Text style={styles.lineTotal}>{formatPrice(p.priceTnd * quantity)}</Text>
                      </View>
                    </View>
                  </View>
                ))}

                <View style={styles.total}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLbl}>Total</Text>
                    <Text style={styles.totalVal}>{formatPrice(total)}</Text>
                  </View>
                  <View style={styles.pickup}>
                    <Icon name="home-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.pickupText}>Retrait et paiement à l’accueil du club</Text>
                  </View>
                </View>
              </>
            )}
          </SheetScrollView>

          {lines.length > 0 && (
            <View style={[styles.footer, { paddingBottom: 14 }]}>
              <Pressable
                onPress={onOrder}
                disabled={!count}
                accessibilityRole="button"
                accessibilityState={{ disabled: !count }}
                style={({ pressed }) => [styles.orderBtn, !count && styles.orderBtnOff, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.orderText}>{count ? `Commander · ${formatPrice(total)}` : 'Rien à commander'}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 6, gap: 14 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '700', color: colors.brand, marginTop: 8 },

  row: { flexDirection: 'row', gap: 14, padding: 12, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 88, height: 88, borderRadius: 16 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  unit: { fontSize: 13, color: colors.textSecondary },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 3, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 26, textAlign: 'center', fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 20, color: colors.text },
  lineTotal: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 22, color: colors.brandText },

  total: { gap: 14, padding: 18, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  totalLbl: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  totalVal: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 40, lineHeight: 42, color: colors.text },
  pickup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickupText: { fontSize: 14, color: colors.textSecondary },

  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.page },
  orderBtn: { height: 58, borderRadius: 999, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...buttonShadow },
  orderBtnOff: { backgroundColor: colors.disabled, shadowOpacity: 0, elevation: 0 },
  orderText: { fontSize: 16, fontWeight: '800', color: colors.white },
});
