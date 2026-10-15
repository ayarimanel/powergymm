/**
 * Everyone who installed the app, and what the manager can do about each one:
 * grant rights, suspend, or remove.
 *
 * One screen rather than three, because they are the same decision from the
 * manager's side ("what is this person allowed to do here?"), and splitting them
 * is how you end up granting a right to someone you already suspended.
 *
 * Every switch is filtered through canGrantTo, so a delegate never sees a toggle
 * the rules would refuse — the limit is shown, not hidden.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { ClubMember, daysAbsent } from '../../services/clubService';
import { ClubBan } from '../../services/memberAdminService';
import { StaffPermissions, UserProfile } from '../../types/database';
import { PERMISSION_LABELS, canGrantTo, hasPermission } from '../../services/permissionsService';
import { colors } from '../../theme';
import { useT } from '../../i18n';
import { BottomSheet, SheetScrollView } from './BottomSheet';
import { Avatar } from '../community/Avatar';

const SUBS: Partial<Record<keyof StaffPermissions, string>> = {
  manageClasses: 'Ajouter et gérer le planning des cours',
  manageProducts: 'Ajouter des produits et gérer la boutique',
  manageNotifications: 'Publier les annonces vues par tout le club',
  manageCoaches: 'Accepter ou refuser les candidatures de coach',
  coachFeatures: 'Valider les records publiés sur le Mur',
  manageMembers: 'Suspendre ou retirer un membre du club',
  moderateWall: 'Masquer un post et traiter les signalements',
  manageFloor: 'Horaires, zones, capacité, QR d’entrée',
  viewAnalytics: 'Voir les inscriptions, les départs et les recettes',
  manageStaff: 'Donner ou retirer les droits ci-dessus (sauf celui-ci)',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  members: ClubMember[];
  permissions: Record<string, StaffPermissions>;
  bans: ClubBan[];
  me: UserProfile;
  onChange: (userId: string, patch: StaffPermissions) => void;
  onBan: (m: ClubMember, reason: string) => void;
  onUnban: (m: ClubMember) => void;
  onRemove: (m: ClubMember) => void;
}

export const MembersAdminSheet: React.FC<Props> = ({
  visible,
  onClose,
  members,
  permissions,
  bans,
  me,
  onChange,
  onBan,
  onUnban,
  onRemove,
}) => {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  /** Two taps before anything irreversible. */
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const mayManageMembers = hasPermission(me, 'manageMembers');
  const bannedIds = useMemo(() => new Set(bans.map(b => b.userId)), [bans]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter(m => (q ? m.name.toLowerCase().includes(q) : true))
      .map(m => ({ m, banned: bannedIds.has(m.id), granted: PERMISSION_LABELS.filter(l => permissions[m.id]?.[l.key]).length }))
      .sort((a, b) => Number(a.banned) - Number(b.banned) || a.m.name.localeCompare(b.m.name));
  }, [members, query, bannedIds, permissions]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.92]}
      header={
        <View style={styles.head}>
          <Text style={styles.title}>{t('Membres de l’app')}</Text>
          <Text style={styles.sub}>
            {t('{n} ont installé l’application', { n: members.length })}
            {bans.length > 0 ? ` · ${t('{n} suspendus', { n: bans.length })}` : ''}
          </Text>
        </View>
      }
    >
      {(_e, extraBottom) => (
        <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: 28 + extraBottom }]} showsVerticalScrollIndicator={false}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('Chercher un membre')}
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            accessibilityLabel={t('Chercher un membre')}
          />

          {members.length === 0 && (
            <Text style={styles.empty}>
              {t('Personne n’a encore installé l’application. Les membres apparaîtront ici dès leur inscription.')}
            </Text>
          )}

          {rows.map(({ m, banned, granted }) => {
            const open = openId === m.id;
            const isMe = m.id === me.id;
            return (
              <View key={m.id} style={styles.row}>
                <Pressable
                  onPress={() => setOpenId(open ? null : m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={m.name}
                  style={styles.rowTop}
                >
                  <Avatar name={m.name} size={42} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, banned && styles.nameOut]} numberOfLines={1}>
                      {m.name}
                      {isMe ? ` ${t('(toi)')}` : ''}
                    </Text>
                    <Text style={[styles.state, banned && { color: colors.red.text }]}>
                      {banned
                        ? t('Suspendu')
                        : granted > 0
                          ? t('{n} droit(s)', { n: granted })
                          : t('Dernière venue il y a {n} j', { n: daysAbsent(m) })}
                    </Text>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                </Pressable>

                {open && (
                  <View style={styles.panel}>
                    {PERMISSION_LABELS.map(l => {
                      const allowed = canGrantTo(me, m.id, l.key) && !banned;
                      return (
                        <View key={l.key} style={styles.permRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.permTitle}>{t(l.label)}</Text>
                            <Text style={styles.permSub}>
                              {banned
                                ? t('Membre suspendu : réintègre-le avant de lui donner des droits.')
                                : allowed
                                  ? t(SUBS[l.key] ?? '')
                                  : isMe
                                    ? t('Tu ne peux pas modifier tes propres droits.')
                                    : t('Tu ne peux pas donner un droit que tu n’as pas.')}
                            </Text>
                          </View>
                          <Switch
                            value={!!permissions[m.id]?.[l.key]}
                            disabled={!allowed}
                            onValueChange={v => onChange(m.id, { [l.key]: v })}
                            trackColor={{ true: colors.brand, false: colors.disabled }}
                            thumbColor={colors.white}
                            accessibilityLabel={`${t(l.label)} · ${m.name}`}
                          />
                        </View>
                      );
                    })}

                    {mayManageMembers && !isMe && (
                      <View style={styles.danger}>
                        {banned ? (
                          <Pressable onPress={() => onUnban(m)} accessibilityRole="button" style={styles.dangerBtn}>
                            <Text style={styles.unbanText}>{t('Réintégrer dans le club')}</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={() => onBan(m, 'Suspendu par le club')}
                            accessibilityRole="button"
                            style={styles.dangerBtn}
                          >
                            <Text style={styles.banText}>{t('Suspendre l’accès')}</Text>
                          </Pressable>
                        )}

                        {confirmRemove === m.id ? (
                          <View style={styles.confirmRow}>
                            <Pressable onPress={() => setConfirmRemove(null)} accessibilityRole="button" style={styles.cancel}>
                              <Text style={styles.cancelText}>{t('Annuler')}</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                onRemove(m);
                                setConfirmRemove(null);
                                setOpenId(null);
                              }}
                              accessibilityRole="button"
                              style={styles.confirm}
                            >
                              <Text style={styles.confirmText}>{t('Oui, supprimer')}</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable onPress={() => setConfirmRemove(m.id)} accessibilityRole="button" style={styles.dangerBtn}>
                            <Text style={styles.banText}>{t('Supprimer du club…')}</Text>
                          </Pressable>
                        )}
                        {confirmRemove === m.id && (
                          <Text style={styles.warn}>{t('Définitif : son compte et son historique seront effacés.')}</Text>
                        )}
                      </View>
                    )}
                  </View>
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
  head: { paddingHorizontal: 16, paddingTop: 4, gap: 2 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted },

  body: { padding: 16, gap: 2 },
  search: { minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, fontSize: 15, color: colors.text, marginBottom: 10 },
  empty: { textAlign: 'center', color: colors.textMuted, paddingVertical: 28, lineHeight: 20 },

  row: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  nameOut: { color: colors.textMuted, textDecorationLine: 'line-through' },
  state: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  panel: { paddingBottom: 12, gap: 2 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingLeft: 54 },
  permTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  permSub: { fontSize: 12, color: colors.textMuted, marginTop: 1, lineHeight: 16 },

  danger: { marginTop: 10, marginLeft: 54, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 },
  dangerBtn: { minHeight: 44, justifyContent: 'center' },
  banText: { color: colors.red.text, fontSize: 14, fontWeight: '700' },
  unbanText: { color: colors.green.text, fontSize: 14, fontWeight: '700' },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancel: { flex: 1, minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  confirm: { flex: 1, minHeight: 42, borderRadius: 21, backgroundColor: colors.red.bar, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  warn: { fontSize: 12, color: colors.red.text, marginTop: 6 },
});
