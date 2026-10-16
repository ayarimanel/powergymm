import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { Title } from '../ui/Title';
import { CoachProfile } from '../../types/database';
import { daysSummary, isOnFloorNow } from '../../services/coachService';
import { fmtTnd, fromPrice, offersPersonal } from '../../coaching/offers';
import { Avatar } from '../community/Avatar';
import { Btn, J } from '../../journal/ui/kit';
import { colors, light, radius } from '../../theme';

interface Props {
  coach: CoachProfile;
  isMine: boolean;
  onPress: () => void;
  /** Owner (or a delegated member), for profiles waiting for approval. */
  onApprove?: () => void;
  onRefuse?: () => void;
}

/** A coach as a photo card (design-ref Coachs): photo, status tag, name, what they do, price. */
export const CoachCard: React.FC<Props> = ({ coach: c, isMine, onPress, onApprove, onRefuse }) => {
  const live = c.onFloor && isOnFloorNow(c);
  const personal = offersPersonal(c);
  const from = personal ? fromPrice(c) : null;
  const pending = c.status === 'pending';
  const schedule = [daysSummary(c.availabilityDays), c.availabilityHours].filter(Boolean).join(' · ');
  const photo = c.bannerUrl || c.avatarUrl;

  const tag = pending
    ? { label: 'À valider', bg: colors.amber.soft, fg: colors.amber.text }
    : live
      ? { label: 'Sur le plateau', bg: colors.green.soft, fg: colors.green.text }
      : personal
        ? c.isAcceptingClients
          ? { label: 'Disponible', bg: colors.green.soft, fg: colors.green.text }
          : { label: 'Complet', bg: colors.track, fg: colors.text }
        : c.onFloor
          ? { label: 'Coach plateau', bg: colors.blue.soft, fg: colors.blue.text }
          : null;
  const line = [c.headline, from ? `dès ${fmtTnd(from)}` : null].filter(Boolean).join(' · ');
  const under = c.specialties.length ? c.specialties.slice(0, 3).join(' · ') : schedule;

  return (
    <View style={[s.card, pending && s.cardPending]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${c.fullName}${c.headline ? `, ${c.headline}` : ''}${from ? `, à partir de ${from} dinars` : ''}`}
        style={({ pressed }) => [s.photoBox, pressed && { opacity: 0.92 }]}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={s.noPhoto}>
            <Avatar name={c.fullName} size={72} />
          </View>
        )}
        {/* Dark fade so the name stays readable on any photo */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
          <Defs>
            <LinearGradient id={`fade-${c.id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.night} stopOpacity="0.1" />
              <Stop offset="0.45" stopColor={colors.night} stopOpacity="0.25" />
              <Stop offset="1" stopColor={colors.night} stopOpacity="0.95" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#fade-${c.id})`} />
        </Svg>

        {tag && (
          <View style={[s.tag, { backgroundColor: tag.bg }]}>
            <Text style={[s.tagText, { color: tag.fg }]}>{tag.label}</Text>
          </View>
        )}

        <View style={s.info}>
          <View style={s.nameRow}>
            <Title variant="card" numberOfLines={1} color={colors.white} style={{ flexShrink: 1 }}>{c.fullName}</Title>
            {!pending && <Icon name="shield-checkmark-outline" size={22} color={colors.blue.text} accessibilityLabel="Coach validé par le club" />}
            {isMine && <Text style={s.me}>Toi</Text>}
          </View>
          {!!line && (
            <View style={s.lineRow}>
              <View style={s.lineMark} />
              <Text style={s.line} numberOfLines={1}>{line}</Text>
            </View>
          )}
          {!!under && <Text style={s.under} numberOfLines={1}>{under}</Text>}
        </View>
      </Pressable>

      {pending && (onApprove || onRefuse) && (
        <View style={s.review}>
          {onRefuse && <Btn small variant="ghost" label="Refuser" onPress={onRefuse} style={{ flex: 1 }} />}
          {onApprove && <Btn small label="Valider le coach" onPress={onApprove} style={{ flex: 1.4 }} />}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card: { borderRadius: radius.cardLg, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line, overflow: 'hidden' },
  cardPending: { borderStyle: 'dashed', borderColor: J.rec },
  photoBox: { height: 220, justifyContent: 'flex-end', backgroundColor: J.surface2 },
  noPhoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  tag: { position: 'absolute', top: 14, right: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  info: { padding: 18, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  me: { fontSize: 11, fontWeight: '900', color: J.accentText, backgroundColor: J.accentSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineMark: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.brand },
  // Text sits on the dark photo fade: white name, light red line, light grey details
  line: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.inverseAccent },
  under: { fontSize: 13, fontWeight: '500', color: light(0.8) },
  review: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: J.line },
});
