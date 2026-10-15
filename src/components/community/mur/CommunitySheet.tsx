import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { Community } from '../../../community/murService';
import { MemStatus, ClubRole, CommunityType, isIn, canManage } from '../../../community/permissions';
import { communityTint, colors } from '../../../theme';
import { BottomSheet, SheetScrollView } from '../../home/BottomSheet';

const TYPE_META: Record<CommunityType, { label: string; color: Parameters<typeof communityTint>[0] }> = {
  official: { label: 'Officielle', color: 'accent' },
  open: { label: 'Ouverte', color: 'calm' },
  request: { label: 'Sur demande', color: 'mid' },
  invite: { label: 'Sur invitation', color: 'violet' },
};

interface Props {
  community: Community | null;
  status: MemStatus;
  role: ClubRole;
  requestsCount: number;
  onClose: () => void;
  onJoin: () => void;
  onRequest: () => void;
  onLeave: () => void;
  onCompose: () => void;
  onInvite: () => void;
  onMembers: () => void;
  /** Open the waiting list (accept / refuse). */
  onRequests: () => void;
}

const TypeTag: React.FC<{ type: CommunityType }> = ({ type }) => {
  const meta = TYPE_META[type];
  const t = communityTint(meta.color);
  return <View style={[styles.type, { backgroundColor: t.soft }]}><Text style={[styles.typeText, { color: t.text }]}>{meta.label}</Text></View>;
};

const Info: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.info}><Text style={styles.infoText}>{children}</Text></View>
);

export const CommunitySheet: React.FC<Props> = ({ community: c, status, role, requestsCount, onClose, onJoin, onRequest, onLeave, onCompose, onInvite, onMembers, onRequests }) => {
  if (!c) return null;
  const tint = communityTint(c.color);
  const inside = isIn(status);
  const manages = canManage(status) && c.id !== 'club';

  const Action = () => {
    if (c.id === 'club') {
      return role === 'owner'
        ? <Primary label="Publier sur Le Club" onPress={onCompose} />
        : <Info><Text style={styles.b}>Tous les membres</Text> suivent Le Club automatiquement. Seul le gérant y publie.</Info>;
    }
    if (inside) {
      return (
        <>
          <Primary label="Publier ici" onPress={onCompose} />
          {status === 'member' && <Secondary label="Quitter la communauté" onPress={onLeave} />}
        </>
      );
    }
    if (status === 'pending') return <Disabled label={`Demande envoyée · ${c.adminNames[0]} répond sous 24 h`} />;
    if (c.type === 'open') return <Primary label="Rejoindre" onPress={onJoin} />;
    if (c.type === 'request') return (
      <>
        <Primary label="Demander à rejoindre" onPress={onRequest} />
        <Info>{c.womenOnly ? 'Espace réservé aux femmes. ' : ''}Ta demande est vue uniquement par <Text style={styles.b}>{c.adminNames.join(', ')}</Text>.</Info>
      </>
    );
    return <Info>Sur invitation d'un coach uniquement.</Info>;
  };

  return (
    <BottomSheet
      visible={!!c}
      onClose={onClose}
      snaps={[0.6, 0.9]}
      initialSnap={0}
      header={
        <View style={styles.top}>
          <View style={[styles.circle, { backgroundColor: tint.soft }]}><Text style={[styles.ini, { color: tint.bar }]}>{c.ini}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{c.name}</Text>
            <View style={styles.metaRow}>
              <TypeTag type={c.type} />
              <Text style={styles.metaText}>{c.members} membre{c.members > 1 ? 's' : ''} · {c.today} post{c.today > 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>
      }
    >
      {(_e, extraBottom) => (
        <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: 28 + extraBottom }]} showsVerticalScrollIndicator={false}>
          {!!c.desc && <Text style={styles.desc}>{c.desc}</Text>}

          {c.rules.length > 0 && (
            <>
              <Text style={styles.lbl}>Règles</Text>
              <View style={styles.rules}>
                {c.rules.map((r, i) => (
                  <Text key={i} style={styles.rule}>{i + 1}. {r}</Text>
                ))}
              </View>
            </>
          )}

          <View style={styles.who}>
            <Text style={styles.whoLine}>Admin : <Text style={styles.b}>{c.adminNames.join(', ')}</Text></Text>
            {c.modNames.length > 0 && <Text style={styles.whoLine}>Modérateurs : <Text style={styles.b}>{c.modNames.join(', ')}</Text></Text>}
          </View>

          {manages && (
            <>
              <Info><Text style={styles.b}>{status === 'founder' ? 'Tu as créé cette communauté.' : 'Tu gères cette communauté.'}</Text> Tu acceptes ou refuses chaque demande, tu peux masquer un post, retirer un membre ou nommer un modérateur.</Info>
              {requestsCount > 0 && <Secondary label={`Voir les demandes · ${requestsCount}`} soft onPress={onRequests} />}
              {c.type === 'invite' && <Secondary label="Inviter un membre" soft onPress={onInvite} />}
            </>
          )}

          {/* Anyone inside can see who else is; only a manager gets the actions. */}
          {(isIn(status) || manages) && (
            <Secondary label={`Voir les membres · ${c.members}`} soft onPress={onMembers} />
          )}

          <View style={{ gap: 10, marginTop: 4 }}>
            <Action />
          </View>
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const Primary: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={styles.btn}><Text style={styles.btnText}>{label}</Text></Pressable>
);
const Secondary: React.FC<{ label: string; onPress: () => void; soft?: boolean }> = ({ label, onPress, soft }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={[styles.btn, soft ? styles.btnSoft : styles.btnOff]}>
    <Text style={[styles.btnText, soft ? { color: colors.brand } : { color: colors.textMuted }]}>{label}</Text>
  </Pressable>
);
const Disabled: React.FC<{ label: string }> = ({ label }) => (
  <View style={[styles.btn, styles.btnOff]}><Text style={[styles.btnText, { color: colors.textMuted }]}>{label}</Text></View>
);

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  ini: { fontSize: 26, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: colors.textMuted },
  body: { paddingHorizontal: 20, gap: 14 },
  desc: { fontSize: 14, color: colors.text, lineHeight: 20 },
  lbl: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  rules: { backgroundColor: colors.track, borderRadius: 14, padding: 12, gap: 4 },
  rule: { fontSize: 13, color: colors.text },
  who: { gap: 4 },
  whoLine: { fontSize: 12, color: colors.textMuted },
  b: { color: colors.text, fontWeight: '800' },
  type: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  info: { backgroundColor: colors.track, borderRadius: 12, padding: 12 },
  infoText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  btn: { height: 48, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  btnSoft: { backgroundColor: communityTint('accent').soft },
  btnOff: { backgroundColor: colors.track },
  btnText: { fontSize: 14, fontWeight: '800', color: colors.white },
});
