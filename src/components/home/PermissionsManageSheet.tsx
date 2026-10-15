import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { ClubMember } from '../../services/clubService';
import { StaffPermissions, UserProfile } from '../../types/database';
import { canGrantTo } from '../../services/permissionsService';
import { useT } from '../../i18n';
import { BottomSheet, SheetScrollView } from './BottomSheet';
import { Avatar } from '../community/Avatar';

interface Props {
  visible: boolean;
  onClose: () => void;
  members: ClubMember[];
  permissions: Record<string, StaffPermissions>;
  onChange: (userId: string, patch: StaffPermissions) => void;
  /** Who is handing out rights: decides which switches he may touch. */
  grantedBy: UserProfile;
}

const TOGGLES: { key: keyof StaffPermissions; label: string; sub: string }[] = [
  { key: 'manageClasses', label: 'Cours collectifs', sub: 'Ajouter et gérer le planning des cours' },
  { key: 'manageProducts', label: 'Boutique', sub: 'Ajouter des produits et signaler un stock faible' },
  { key: 'manageNotifications', label: 'Infos du club', sub: 'Publier les annonces (Aïd, fermetures…)' },
  { key: 'manageCoaches', label: 'Validation des coachs', sub: 'Accepter ou refuser les candidatures de coach' },
  { key: 'coachFeatures', label: 'Fonctionnalités coach', sub: 'Valider les records publiés sur le Mur' },
  { key: 'manageStaff', label: 'Gestion des droits', sub: 'Donner ou retirer les droits ci-dessus (sauf celui-ci)' },
];

const activeLabels = (p: StaffPermissions) => TOGGLES.filter(t => p[t.key]).map(t => t.label);

/** Owner-only: pick a member, see what rights they already have, hand out more without making them a coach or an owner. */
export const PermissionsManageSheet: React.FC<Props> = ({ visible, onClose, members, permissions, onChange, grantedBy }) => {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter(m => m.name.toLowerCase().includes(q)) : members;
  }, [members, query]);

  return (
    <BottomSheet visible={visible} onClose={onClose} snaps={[0.92]} header={<Text style={styles.title} accessibilityRole="header">{t('Permissions')}</Text>}>
      {() => (
        <View style={{ flex: 1 }}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Chercher un membre"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Chercher un membre"
            />
          </View>

          <SheetScrollView contentContainerStyle={styles.body}>
            <Text style={styles.note}>{t('Donne des droits ponctuels à un membre, sans en faire un coach ou un propriétaire.')}</Text>
            {members.length === 0 && (
              <Text style={styles.empty}>{t('Aucun membre pour l’instant : les permissions apparaissent ici dès qu’un membre s’inscrit.')}</Text>
            )}
            {members.length > 0 && filtered.length === 0 && (
              <Text style={styles.empty}>{t('Aucun membre ne correspond à « {q} ».', { q: query })}</Text>
            )}

            {filtered.map(m => {
              const p = permissions[m.id] ?? {};
              const active = activeLabels(p);
              const open = openId === m.id;
              return (
                <View key={m.id} style={styles.member}>
                  <Pressable onPress={() => setOpenId(open ? null : m.id)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.memberHead}>
                    <Avatar name={m.name} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={[styles.memberRights, active.length > 0 && styles.memberRightsOn]}>
                        {active.length > 0 ? active.join(' · ') : 'Aucun droit particulier'}
                      </Text>
                    </View>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                  </Pressable>

                  {open &&
                    TOGGLES.map(t => {
                      // A delegate may pass on only what he holds himself, and
                      // nobody edits their own rights. Disabled rather than
                      // hidden, so the limit is visible instead of mysterious.
                      const allowed = canGrantTo(grantedBy, m.id, t.key);
                      return (
                      <View key={t.key} style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{t.label}</Text>
                          <Text style={styles.rowSub}>
                            {allowed
                              ? t.sub
                              : grantedBy?.id === m.id
                                ? 'Tu ne peux pas modifier tes propres droits.'
                                : 'Tu ne peux pas donner un droit que tu n’as pas.'}
                          </Text>
                        </View>
                        <Switch
                          value={!!p[t.key]}
                          disabled={!allowed}
                          onValueChange={v => onChange(m.id, { [t.key]: v })}
                          trackColor={{ true: colors.brand, false: colors.disabled }}
                          thumbColor={colors.white}
                          accessibilityLabel={`${t.label} pour ${m.name}`}
                        />
                      </View>
                      );
                    })}
                </View>
              );
            })}
          </SheetScrollView>
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    marginHorizontal: 20,
    marginBottom: 4,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, height: '100%' as any },
  body: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  note: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 10 },
  empty: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  member: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberName: { fontSize: 16, fontWeight: '800', color: colors.text },
  memberRights: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  memberRightsOn: { color: colors.brand, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 46, gap: 10 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
