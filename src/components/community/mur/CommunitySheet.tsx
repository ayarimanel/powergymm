import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Icon } from '../../ui/Icon';
import { Title } from '../../ui/Title';
import { Text } from '../../ui/Text';
import { Community } from '../../../community/murService';
import { MemStatus, ClubRole, CommunityType, isIn, canManage } from '../../../community/permissions';
import { buttonShadow, communityTint, colors, fonts, radius } from '../../../theme';
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

  const locked = c.type === 'request' || c.type === 'invite';
  const team: { name: string; role: string; icon: 'shield-outline' | 'star-outline'; color: string }[] = [
    ...c.adminNames.map(n => ({ name: n, role: 'Admin', icon: 'shield-outline' as const, color: colors.brandText })),
    ...c.modNames.map(n => ({ name: n, role: 'Modérateur', icon: 'star-outline' as const, color: colors.blue.text })),
  ];

  return (
    <BottomSheet visible={!!c} onClose={onClose} snaps={[0.6, 0.94]} initialSnap={0}>
      {(_e, extraBottom) => (
        <SheetScrollView contentContainerStyle={{ paddingBottom: 28 + extraBottom }} showsVerticalScrollIndicator={false}>
          {/* design-ref Page communauté: red banner, the community's tile over it */}
          <View style={styles.banner}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="commBanner" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={colors.brand} stopOpacity="1" />
                  <Stop offset="1" stopColor={colors.brand} stopOpacity="0.45" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#commBanner)" />
            </Svg>
          </View>
          <View style={styles.body}>
            <View style={[styles.tile, { backgroundColor: tint.soft }]}>
              <Text style={[styles.ini, { color: tint.bar }]}>{c.ini}</Text>
            </View>
            <Title variant="display" size={40}>{c.name}</Title>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {c.members} membre{c.members > 1 ? 's' : ''} · {TYPE_META[c.type].label} · {c.today} post{c.today > 1 ? 's' : ''}
              </Text>
              {locked && <Icon name="lock-closed-outline" size={15} color={colors.textMuted} />}
            </View>
            {!!c.desc && <Text style={styles.desc}>{c.desc}</Text>}

            <View style={{ gap: 10, marginTop: 6 }}>
              <Action />
            </View>

            {/* Anyone inside can see who else is; only a manager gets the actions. */}
            {(isIn(status) || manages) && (
              <Secondary label={`Voir les membres · ${c.members}`} soft onPress={onMembers} />
            )}

            {manages && (
              <>
                <Info><Text style={styles.b}>{status === 'founder' ? 'Tu as créé cette communauté.' : 'Tu gères cette communauté.'}</Text> Tu acceptes ou refuses chaque demande, tu peux masquer un post, retirer un membre ou nommer un modérateur.</Info>
                {requestsCount > 0 && <Secondary label={`Voir les demandes · ${requestsCount}`} soft onPress={onRequests} />}
                {c.type === 'invite' && <Secondary label="Inviter un membre" soft onPress={onInvite} />}
              </>
            )}

            {team.length > 0 && (
              <>
                <Title variant="section" style={styles.h}>Équipe</Title>
                <View style={styles.box}>
                  {team.map((m, i) => (
                    <View key={`${m.role}-${m.name}-${i}`} style={[styles.teamRow, i > 0 && styles.sep]}>
                      <View style={styles.teamAv}><Text style={styles.teamAvText}>{m.name.replace(/^Coach\s+/i, '').charAt(0).toUpperCase()}</Text></View>
                      <Text style={styles.teamName} numberOfLines={1}>{m.name}</Text>
                      <Icon name={m.icon} size={16} color={m.color} />
                      <Text style={[styles.teamRole, { color: m.color }]}>{m.role}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {c.rules.length > 0 && (
              <>
                <Title variant="section" style={styles.h}>Règles</Title>
                <View style={styles.box}>
                  {c.rules.map((r, i) => (
                    <View key={i} style={[styles.ruleRow, i > 0 && styles.sep]}>
                      <Text style={styles.ruleNum}>{i + 1}</Text>
                      <Text style={styles.rule}>{r}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
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
    <Text style={[styles.btnText, soft ? { color: colors.text } : { color: colors.textMuted }]}>{label}</Text>
  </Pressable>
);
const Disabled: React.FC<{ label: string }> = ({ label }) => (
  <View style={[styles.btn, styles.btnOff]}><Text style={[styles.btnText, { color: colors.textMuted }]}>{label}</Text></View>
);

const styles = StyleSheet.create({
  banner: { height: 120, overflow: 'hidden' },
  tile: { width: 88, height: 88, borderRadius: 24, borderWidth: 4, borderColor: colors.card, alignItems: 'center', justifyContent: 'center', marginTop: -50, marginBottom: 6 },
  ini: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 44, lineHeight: 48 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaText: { fontSize: 14, color: colors.textMuted },
  body: { paddingHorizontal: 20, gap: 12 },
  desc: { fontSize: 15, fontWeight: '500', color: colors.textSecondary, lineHeight: 22 },
  h: { marginTop: 14 },
  box: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, paddingHorizontal: 16 },
  sep: { borderTopWidth: 1, borderTopColor: colors.border },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  teamAv: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  teamAvText: { fontSize: 15, fontWeight: '800', color: colors.text },
  teamName: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  teamRole: { fontSize: 14, fontWeight: '700' },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 14 },
  ruleNum: { width: 16, fontFamily: fonts.display, fontWeight: 'normal', fontSize: 24, lineHeight: 24, color: colors.brand },
  rule: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text },
  b: { color: colors.text, fontWeight: '800' },
  type: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  info: { backgroundColor: colors.track, borderRadius: 16, padding: 14 },
  infoText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  btn: { height: 54, borderRadius: 999, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...buttonShadow },
  btnSoft: { backgroundColor: colors.track, shadowOpacity: 0, elevation: 0 },
  btnOff: { backgroundColor: colors.track, shadowOpacity: 0, elevation: 0 },
  btnText: { fontSize: 15, fontWeight: '800', color: colors.white },
});
