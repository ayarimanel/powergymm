/**
 * Inviting someone to an invite-only community.
 *
 * This was the gap that made "sur invitation" meaningless: the community was
 * invisible to outsiders and had no way to let anyone in, so it could only ever
 * contain the person who made it.
 *
 * Already-in and already-removed members are shown but not invitable, so a
 * manager can see why someone is missing from the list instead of hunting.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../ui/Text';
import { Community } from '../../../community/murService';
import { MemberProfile } from '../../../types/database';
import { useT } from '../../../i18n';
import { colors } from '../../../theme';
import { BottomSheet, SheetScrollView } from '../../home/BottomSheet';
import { Avatar } from '../Avatar';

interface Props {
  visible: boolean;
  community: Community | null;
  profiles: Record<string, MemberProfile>;
  onClose: () => void;
  onInvite: (userId: string, name: string) => void;
}

export const InviteSheet: React.FC<Props> = ({ visible, community: c, profiles, onClose, onInvite }) => {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [invited, setInvited] = useState<string[]>([]);

  const rows = useMemo(() => {
    if (!c) return [];
    const q = query.trim().toLowerCase();
    return Object.values(profiles)
      .filter(p => (q ? p.name.toLowerCase().includes(q) : true))
      .map(p => ({
        ...p,
        inside: c.memberIds.includes(p.userId) || c.createdBy === p.userId,
        banned: c.bans.some(b => b.userId === p.userId),
      }))
      .sort((a, b) => Number(a.inside) - Number(b.inside) || a.name.localeCompare(b.name));
  }, [c, profiles, query]);

  if (!c) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.7, 0.95]}
      initialSnap={0}
      header={
        <View style={styles.head}>
          <Text style={styles.title}>Inviter dans {c.name}</Text>
          <Text style={styles.sub}>{t('Cette communauté est sur invitation : elle reste invisible pour les autres.')}</Text>
        </View>
      }
    >
      {(_e, extraBottom) => (
        <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: 28 + extraBottom }]} showsVerticalScrollIndicator={false}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Chercher un membre du club"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            accessibilityLabel="Chercher un membre"
          />

          {rows.length === 0 && <Text style={styles.empty}>{t('Aucun membre trouvé.')}</Text>}

          {rows.map(p => {
            const done = invited.includes(p.userId);
            const blocked = p.inside || p.banned;
            return (
              <View key={p.userId} style={styles.row}>
                <Avatar name={p.name} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  {p.inside ? (
                    <Text style={styles.state}>{t('Déjà membre')}</Text>
                  ) : p.banned ? (
                    <Text style={[styles.state, { color: colors.red.text }]}>{t('Retiré de cette communauté')}</Text>
                  ) : null}
                </View>

                {blocked ? null : done ? (
                  <Text style={styles.done}>{t('Invité ✓')}</Text>
                ) : (
                  <Pressable
                    onPress={() => {
                      setInvited(v => [...v, p.userId]);
                      onInvite(p.userId, p.name);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Inviter ${p.name}`}
                    style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.btnText}>{t('Inviter')}</Text>
                  </Pressable>
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

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  state: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  btn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  done: { color: colors.green.text, fontSize: 14, fontWeight: '700' },
});
