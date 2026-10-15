/**
 * Who is in a community, and what a manager can do about it.
 *
 * Standard in every app with groups (Discord, Reddit, Facebook Groups): without a
 * roster you can only moderate someone who has just posted, which is why the ban
 * rules existed here with nowhere to use them.
 *
 * Every action is filtered through the rank rules, so the list never offers a
 * button that would be refused: you see "Retirer" only on someone you outrank.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Community, standingIn } from '../../../community/murService';
import { ClubRole, MemStatus, canBan, canSetStatus, canTransferFounder, canUnban } from '../../../community/permissions';
import { MemberProfile } from '../../../types/database';
import { useT } from '../../../i18n';
import { colors } from '../../../theme';
import { BottomSheet, SheetScrollView } from '../../home/BottomSheet';
import { Avatar } from '../Avatar';

const RANK_LABEL: Partial<Record<MemStatus, string>> = {
  founder: 'Fondateur',
  admin: 'Admin',
  mod: 'Modérateur',
  banned: 'Retiré',
};

interface Props {
  visible: boolean;
  community: Community | null;
  profiles: Record<string, MemberProfile>;
  /** The viewer. */
  meId: string;
  myStatus: MemStatus;
  role: ClubRole;
  onClose: () => void;
  onBan: (userId: string, name: string) => void;
  onUnban: (userId: string, name: string) => void;
  onSetStatus: (userId: string, name: string, next: 'member' | 'mod' | 'admin') => void;
  onTransfer: (userId: string, name: string) => void;
}

export const MembersSheet: React.FC<Props> = ({
  visible,
  community: c,
  profiles,
  meId,
  myStatus,
  role,
  onClose,
  onBan,
  onUnban,
  onSetStatus,
  onTransfer,
}) => {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!c) return [];
    const ids = [...new Set([...c.memberIds, ...c.adminIds, ...c.modIds, c.createdBy, ...c.bans.map(b => b.userId)])].filter(Boolean);
    const q = query.trim().toLowerCase();
    return ids
      .map(id => {
        const status = standingIn(c, id, c.memberIds.includes(id) ? 'member' : 'none');
        return { id, name: profiles[id]?.name ?? 'Membre', status };
      })
      .filter(r => (q ? r.name.toLowerCase().includes(q) : true))
      // Founder first, then admins, mods, members, removed last.
      .sort((a, b) => rank(b.status) - rank(a.status) || a.name.localeCompare(b.name));
  }, [c, profiles, query]);

  if (!c) return null;

  const active = rows.filter(r => r.status !== 'banned' && r.status !== 'none').length;
  const removed = rows.filter(r => r.status === 'banned').length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.7, 0.95]}
      initialSnap={0}
      header={
        <View style={styles.head}>
          <Text style={styles.title}>Membres de {c.name}</Text>
          <Text style={styles.count}>
            {active} membre{active > 1 ? 's' : ''}
            {removed > 0 ? ` · ${removed} retiré${removed > 1 ? 's' : ''}` : ''}
          </Text>
        </View>
      }
    >
      {(_e, extraBottom) => (
        <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: 28 + extraBottom }]} showsVerticalScrollIndicator={false}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Chercher un membre"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            accessibilityLabel="Chercher un membre"
          />

          {rows.length === 0 && <Text style={styles.empty}>{t('Personne pour l’instant.')}</Text>}

          {rows.map(r => {
            const isMe = r.id === meId;
            const open = openId === r.id;
            const label = RANK_LABEL[r.status];
            const mayBan = !isMe && canBan(myStatus, r.status);
            const mayPromote = !isMe && canSetStatus(myStatus, r.status, 'mod');
            const mayMakeAdmin = !isMe && canSetStatus(myStatus, r.status, 'admin');
            const mayDemote = !isMe && (r.status === 'mod' || r.status === 'admin') && canSetStatus(myStatus, r.status, 'member');
            const mayTransfer = !isMe && canTransferFounder(myStatus) && r.status !== 'banned' && r.status !== 'none';
            const anyAction = mayBan || mayPromote || mayMakeAdmin || mayDemote || mayTransfer || (r.status === 'banned' && canUnban(myStatus));

            return (
              <View key={r.id} style={styles.row}>
                <Pressable
                  onPress={() => anyAction && setOpenId(open ? null : r.id)}
                  disabled={!anyAction}
                  accessibilityRole={anyAction ? 'button' : undefined}
                  accessibilityLabel={`${r.name}${label ? `, ${label}` : ''}`}
                  style={styles.rowTop}
                >
                  <Avatar name={r.name} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, r.status === 'banned' && styles.nameOut]} numberOfLines={1}>
                      {r.name}
                      {isMe ? ' (toi)' : ''}
                    </Text>
                    {label ? <Text style={[styles.rank, r.status === 'banned' && { color: colors.red.text }]}>{label}</Text> : null}
                  </View>
                  {anyAction ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} /> : null}
                </Pressable>

                {open && (
                  <View style={styles.actions}>
                    {mayPromote && <Act label="Nommer modérateur" onPress={() => { onSetStatus(r.id, r.name, 'mod'); setOpenId(null); }} />}
                    {mayMakeAdmin && <Act label="Nommer admin" onPress={() => { onSetStatus(r.id, r.name, 'admin'); setOpenId(null); }} />}
                    {mayDemote && <Act label="Retirer son rôle" onPress={() => { onSetStatus(r.id, r.name, 'member'); setOpenId(null); }} />}
                    {mayTransfer && <Act label="Transmettre la communauté" onPress={() => { onTransfer(r.id, r.name); setOpenId(null); }} />}
                    {mayBan && <Act label="Retirer du groupe" danger onPress={() => { onBan(r.id, r.name); setOpenId(null); }} />}
                    {r.status === 'banned' && canUnban(myStatus) && (
                      <Act label="Réintégrer" onPress={() => { onUnban(r.id, r.name); setOpenId(null); }} />
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {role === 'owner' && myStatus === 'none' && (
            <Text style={styles.note}>{t('Tu vois cette liste en tant que gérant du club. Les membres en sont informés.')}</Text>
          )}
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const Act: React.FC<{ label: string; onPress: () => void; danger?: boolean }> = ({ label, onPress, danger }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.act, pressed && { opacity: 0.8 }]}>
    <Text style={[styles.actText, danger && { color: colors.red.text }]}>{label}</Text>
  </Pressable>
);

const rank = (s: MemStatus) => ({ founder: 5, admin: 4, mod: 3, member: 2, pending: 1, none: 0, banned: -1 })[s];

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 4, gap: 2 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  count: { fontSize: 13, color: colors.textMuted },

  body: { padding: 16, gap: 4 },
  search: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.text,
    marginBottom: 8,
  },
  empty: { textAlign: 'center', color: colors.textMuted, paddingVertical: 24 },

  row: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  nameOut: { color: colors.textMuted, textDecorationLine: 'line-through' },
  rank: { fontSize: 12, color: colors.textSecondary, marginTop: 1, fontWeight: '600' },

  actions: { paddingBottom: 10, paddingLeft: 52, gap: 2 },
  act: { minHeight: 42, justifyContent: 'center' },
  actText: { fontSize: 14, fontWeight: '700', color: colors.brand },

  note: { marginTop: 16, fontSize: 12, color: colors.textMuted, lineHeight: 18 },
});
