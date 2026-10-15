import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { ProductReservation, ReservationStatus } from '../../types/database';
import { colors, fonts, radius } from '../../theme';
import { Title } from '../ui/Title';
import { RESERVATION_LABEL, formatPrice, isActive } from '../../services/shopService';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { ProductImage } from './ProductImage';

interface Props {
  visible: boolean;
  onClose: () => void;
  mode: 'member' | 'owner';
  reservations: ProductReservation[];
  onSetStatus: (id: string, status: ReservationStatus) => void;
}

const STATUS_COLOR: Record<ReservationStatus, { bg: string; fg: string }> = {
  pending: { bg: colors.amber.soft, fg: colors.amber.text },
  ready: { bg: colors.green.soft, fg: colors.green.text },
  picked_up: { bg: colors.track, fg: colors.textSecondary },
  cancelled: { bg: colors.red.soft, fg: colors.red.text },
};

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  if (m < 1440) return `il y a ${Math.floor(m / 60)} h`;
  return `il y a ${Math.floor(m / 1440)} j`;
};

const ActionBtn: React.FC<{ label: string; onPress: () => void; kind?: 'dark' | 'danger' | 'light' }> = ({
  label,
  onPress,
  kind = 'light',
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={[styles.actionBtn, kind === 'dark' && styles.actionDark, kind === 'danger' && styles.actionDanger]}
  >
    <Text
      style={[
        styles.actionText,
        kind === 'dark' && { color: colors.onInverse },
        kind === 'danger' && { color: colors.red.text },
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

/** Member: "Mes réservations". Owner: "Commandes" with actions to move each order along. */
export const ReservationsSheet: React.FC<Props> = ({ visible, onClose, mode, reservations, onSetStatus }) => {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const isOwner = mode === 'owner';
  const list = reservations.filter(r => (tab === 'active' ? isActive(r) : !isActive(r)));
  const activeCount = reservations.filter(isActive).length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.6, 0.92]}
      header={
        <View>
          <Title variant="section" style={styles.title}>{isOwner ? 'Commandes' : 'Mes réservations'}</Title>
          <View style={styles.tabs}>
            {(
              [
                ['active', isOwner ? `À traiter (${activeCount})` : `En cours (${activeCount})`],
                ['history', 'Historique'],
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === id }}
                style={[styles.tab, tab === id && styles.tabOn]}
              >
                <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
    >
      {(_e, extraBottom) => (
        <SheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 + extraBottom, gap: 12 }}>
          {/* design-ref Panier: how many items, big */}
          {list.length > 0 && (
            <Title variant="display" size={40} style={{ marginTop: 6 }}>
              {list.reduce((a, r) => a + r.quantity, 0)} article{list.reduce((a, r) => a + r.quantity, 0) > 1 ? 's' : ''}
            </Title>
          )}
          {list.length === 0 && (
            <View style={styles.empty}>
              <Icon name="bag-check-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {tab === 'active' ? (isOwner ? 'Aucune commande à traiter' : 'Aucune réservation en cours') : 'Rien dans l’historique'}
              </Text>
              {!isOwner && tab === 'active' && (
                <Text style={styles.emptySub}>Choisis un produit et touche « Réserver » : tu le retires à l’accueil.</Text>
              )}
            </View>
          )}

          {list.map(r => {
            const sc = STATUS_COLOR[r.status];
            return (
              <View key={r.id} style={styles.row}>
                <View style={styles.rowTop}>
                  <ProductImage uri={r.productImage} style={styles.thumb} iconSize={24} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowName} numberOfLines={2}>{r.productName}</Text>
                    <Text style={styles.rowMeta}>
                      {isOwner ? `${r.userName} · ` : ''}× {r.quantity} · {ago(r.createdAt)}
                    </Text>
                    <Text style={styles.rowPrice}>{formatPrice(r.unitPriceTnd * r.quantity)}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.fg }]}>{RESERVATION_LABEL[r.status]}</Text>
                  </View>
                </View>

                {/* Actions */}
                {isOwner && r.status === 'pending' && (
                  <View style={styles.actions}>
                    <ActionBtn label="Refuser" kind="danger" onPress={() => onSetStatus(r.id, 'cancelled')} />
                    <ActionBtn label="Marquer prête" kind="dark" onPress={() => onSetStatus(r.id, 'ready')} />
                  </View>
                )}
                {isOwner && r.status === 'ready' && (
                  <View style={styles.actions}>
                    <ActionBtn label="Annuler" kind="danger" onPress={() => onSetStatus(r.id, 'cancelled')} />
                    <ActionBtn label="Remise au membre" kind="dark" onPress={() => onSetStatus(r.id, 'picked_up')} />
                  </View>
                )}
                {!isOwner && r.status === 'pending' && (
                  <View style={styles.actions}>
                    <ActionBtn label="Annuler la réservation" kind="danger" onPress={() => onSetStatus(r.id, 'cancelled')} />
                  </View>
                )}
                {!isOwner && r.status === 'ready' && (
                  <Text style={styles.readyNote}>Ta commande t’attend à l’accueil du club.</Text>
                )}
              </View>
            );
          })}

          {/* Member, current reservations: the total, paid and picked up at the club */}
          {!isOwner && tab === 'active' && list.length > 0 && (
            <View style={styles.total}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLbl}>Total</Text>
                <Text style={styles.totalVal}>{formatPrice(list.reduce((a, r) => a + r.unitPriceTnd * r.quantity, 0))}</Text>
              </View>
              <View style={styles.pickup}>
                <Icon name="home-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.pickupText}>Retrait et paiement à l’accueil du club</Text>
              </View>
            </View>
          )}
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { textAlign: 'center', fontSize: 22 },
  tabs: { flexDirection: 'row', padding: 4, marginTop: 12, marginBottom: 4, borderRadius: 999, backgroundColor: colors.bg },
  tab: { flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.brand },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  tabTextOn: { color: colors.white, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },

  row: { padding: 12, borderRadius: radius.cardLg, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 76, height: 76, borderRadius: 16 },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: 13, color: colors.textSecondary },
  rowPrice: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 22, lineHeight: 24, color: colors.brandText },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 12, fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  actionBtn: { height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, borderColor: colors.disabled, alignItems: 'center', justifyContent: 'center' },
  actionDark: { backgroundColor: colors.text, borderColor: colors.text },
  actionDanger: { borderColor: colors.red.bar },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.text },
  readyNote: { fontSize: 14, color: colors.green.text, fontWeight: '600', marginTop: 10 },

  total: { gap: 14, padding: 18, borderRadius: radius.cardLg, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  totalLbl: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  totalVal: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 40, lineHeight: 42, color: colors.text },
  pickup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickupText: { fontSize: 14, color: colors.textSecondary },
});
