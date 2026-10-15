import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { ProductReservation, ReservationStatus } from '../../types/database';
import { colors } from '../../theme';
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
          <Text style={styles.title} accessibilityRole="header">
            {isOwner ? 'Commandes' : 'Mes réservations'}
          </Text>
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
        <SheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 + extraBottom }}>
          {list.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="bag-check-outline" size={44} color={colors.textMuted} />
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
                  <ProductImage uri={r.productImage} style={styles.thumb} iconSize={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={2}>
                      {r.quantity > 1 ? `${r.quantity} × ` : ''}
                      {r.productName}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {isOwner ? `${r.userName} · ` : ''}
                      {formatPrice(r.unitPriceTnd * r.quantity)} · {ago(r.createdAt)}
                    </Text>
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
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 4 },
  tab: { paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.track },
  tabOn: { backgroundColor: colors.text },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  tabTextOn: { color: colors.onInverse },

  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },

  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.track },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  actionBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDark: { backgroundColor: colors.text, borderColor: colors.text },
  actionDanger: { borderColor: colors.red.bar },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.text },
  readyNote: { fontSize: 14, color: colors.green.text, fontWeight: '600', marginTop: 8 },
});
