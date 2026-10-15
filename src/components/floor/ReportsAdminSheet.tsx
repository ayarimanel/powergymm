import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { ProblemReport, agoShort, categoryOf } from '../../services/problemReportService';
import { colors } from '../../theme';

interface Props {
  visible: boolean;
  reports: ProblemReport[];
  /** Member phone numbers (from the club list), to thank them on WhatsApp. */
  phoneOf: (userId: string) => string | undefined;
  onClose: () => void;
  onSetStatus: (id: string, status: ProblemReport['status']) => void;
  onDelete: (id: string) => void;
}

/** Owner: every problem members reported, to fix before it becomes a bad Google review. */
export const ReportsAdminSheet: React.FC<Props> = ({ visible, reports, phoneOf, onClose, onSetStatus, onDelete }) => {
  const [tab, setTab] = useState<'open' | 'fixed'>('open');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setTab('open');
      setConfirmDelete(null);
    }
  }, [visible]);

  const open = reports.filter(r => r.status === 'open');
  const fixed = reports.filter(r => r.status === 'fixed');
  const list = tab === 'open' ? open : fixed;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.94]}
      header={
        <View style={{ gap: 12 }}>
          <View>
            <Text style={styles.title} accessibilityRole="header">Problèmes signalés</Text>
            <Text style={styles.sub}>Réglés vite, ils ne finissent pas en avis Google.</Text>
          </View>
          <View style={styles.tabs}>
            {(
              [
                ['open', `À régler (${open.length})`],
                ['fixed', `Réglés (${fixed.length})`],
              ] as const
            ).map(([id, label]) => (
              <Pressable key={id} onPress={() => setTab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} style={[styles.tab, tab === id && styles.tabOn]}>
                <Text style={[styles.tabText, tab === id && { color: colors.white }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
    >
      {() => (
        <SheetScrollView contentContainerStyle={styles.body}>
          {list.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name={tab === 'open' ? 'checkmark-done-circle-outline' : 'time-outline'} size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>{tab === 'open' ? 'Rien à régler. Tout fonctionne 👌' : 'Aucun problème réglé pour l’instant.'}</Text>
            </View>
          )}
          {list.map(r => {
            const cat = categoryOf(r.category);
            const phone = phoneOf(r.userId);
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.head}>
                  <View style={[styles.icon, { backgroundColor: r.status === 'open' ? colors.amber.soft : colors.green.soft }]}>
                    <Ionicons name={cat.icon as any} size={20} color={r.status === 'open' ? colors.amber.text : colors.green.text} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cat}>{cat.label}{r.place ? ` · ${r.place}` : ''}</Text>
                    <Text style={styles.meta}>{r.userName} · {agoShort(r.createdAt)}</Text>
                  </View>
                  {r.status === 'fixed' && (
                    <View style={styles.fixedPill}>
                      <Text style={styles.fixedPillText}>Réglé ✓</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.message}>{r.message}</Text>
                {!!r.photoUri && <Image source={{ uri: r.photoUri }} style={styles.photo} accessibilityLabel="Photo du problème" />}
                <View style={styles.actions}>
                  {r.status === 'open' ? (
                    <Pressable onPress={() => onSetStatus(r.id, 'fixed')} accessibilityRole="button" style={[styles.btn, styles.btnPrimary]}>
                      <Ionicons name="checkmark" size={16} color={colors.white} />
                      <Text style={[styles.btnText, { color: colors.white }]}>Marquer comme réglé</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => onSetStatus(r.id, 'open')} accessibilityRole="button" style={styles.btn}>
                      <Text style={styles.btnText}>Rouvrir</Text>
                    </Pressable>
                  )}
                  {!!phone && (
                    <Pressable
                      onPress={() =>
                        Linking.openURL(
                          `https://wa.me/${phone}?text=${encodeURIComponent(
                            r.status === 'fixed'
                              ? `Bonjour ${r.userName.split(' ')[0]}, merci pour ton signalement : c’est réglé ✅`
                              : `Bonjour ${r.userName.split(' ')[0]}, merci pour ton signalement, on s’en occupe.`
                          )}`
                        ).catch(() => {})
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Remercier ${r.userName} sur WhatsApp`}
                      style={styles.btn}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color={colors.whatsappDark} />
                      <Text style={styles.btnText}>Remercier</Text>
                    </Pressable>
                  )}
                  <View style={{ flex: 1 }} />
                  {confirmDelete === r.id ? (
                    <Pressable onPress={() => { onDelete(r.id); setConfirmDelete(null); }} accessibilityRole="button" style={[styles.btn, { backgroundColor: colors.red.bar, borderColor: colors.red.bar }]}>
                      <Text style={[styles.btnText, { color: colors.white }]}>Supprimer</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => setConfirmDelete(r.id)} accessibilityRole="button" accessibilityLabel="Supprimer" hitSlop={8} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={18} color={colors.red.text} />
                    </Pressable>
                  )}
                </View>
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
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.track, justifyContent: 'center' },
  tabOn: { backgroundColor: colors.text },
  tabText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  body: { padding: 16, paddingBottom: 40, gap: 12 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  emptyText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cat: { fontSize: 15, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  fixedPill: { backgroundColor: colors.green.soft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  fixedPillText: { fontSize: 12, fontWeight: '800', color: colors.green.text },
  message: { fontSize: 14, lineHeight: 20, color: colors.text },
  photo: { width: '100%', height: 180, borderRadius: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  btnPrimary: { backgroundColor: colors.green.bar, borderColor: colors.green.bar },
  btnText: { fontSize: 13, fontWeight: '800', color: colors.text },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
