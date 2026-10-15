import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { CoachProfile } from '../../types/database';
import { daysSummary, isOnFloorNow } from '../../services/coachService';
import { fmtTnd, fromPrice, offersPersonal } from '../../coaching/offers';
import { Avatar } from '../community/Avatar';
import { Btn, J, Pill, tabular } from '../../journal/ui/kit';
import { colors } from '../../theme';

interface Props {
  coach: CoachProfile;
  isMine: boolean;
  onPress: () => void;
  /** Owner (or a delegated member), for profiles waiting for approval. */
  onApprove?: () => void;
  onRefuse?: () => void;
}

export const CoachCard: React.FC<Props> = ({ coach: c, isMine, onPress, onApprove, onRefuse }) => {
  const live = c.onFloor && isOnFloorNow(c);
  const personal = offersPersonal(c);
  const from = personal ? fromPrice(c) : null;
  const pending = c.status === 'pending';
  const schedule = [daysSummary(c.availabilityDays), c.availabilityHours].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.fullName}${c.headline ? `, ${c.headline}` : ''}${from ? `, à partir de ${from} dinars` : ''}`}
      style={({ pressed }) => [s.card, pending && s.cardPending, pressed && { opacity: 0.92 }]}
    >
      <View style={s.top}>
        <Avatar name={c.fullName} url={c.avatarUrl} size={56} online={live} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{c.fullName}</Text>
            {!pending && <Ionicons name="shield-checkmark" size={16} color={J.goldBright} />}
            {isMine && <Text style={s.me}>Toi</Text>}
          </View>
          {!!c.headline && <Text style={s.headline} numberOfLines={1}>{c.headline}</Text>}
          <View style={s.pills}>
            {pending && <Pill tone="rec" label="À valider" />}
            {live && <Pill tone="ok" label="Sur le plateau" />}
            {personal && !pending && <Pill tone={c.isAcceptingClients ? 'ok' : 'tired'} label={c.isAcceptingClients ? 'Disponible' : 'Complet'} />}
            {!personal && c.onFloor && !live && <Pill tone="never" label="Coach plateau" />}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={J.muted} />
      </View>

      {c.specialties.length > 0 && (
        <View style={s.tags}>
          {c.specialties.slice(0, 3).map(t => (
            <Text key={t} style={s.tag}>{t}</Text>
          ))}
        </View>
      )}

      <View style={s.bottom}>
        {from ? (
          <>
            <Text style={s.from}>
              À partir de <Text style={[s.fromVal, tabular]}>{fmtTnd(from)}</Text>
            </Text>
            <Text style={s.offers}>Voir le coaching ›</Text>
          </>
        ) : (
          <Text style={s.schedule} numberOfLines={1}>
            <Ionicons name="time-outline" size={13} color={J.muted} /> {schedule || 'Horaires à venir'}
          </Text>
        )}
      </View>

      {pending && (onApprove || onRefuse) && (
        <View style={s.review}>
          {onRefuse && <Btn small variant="ghost" label="Refuser" onPress={onRefuse} style={{ flex: 1 }} />}
          {onApprove && <Btn small label="Valider le coach" onPress={onApprove} style={{ flex: 1.4 }} />}
        </View>
      )}
    </Pressable>
  );
};

const s = StyleSheet.create({
  card: { backgroundColor: J.surface, borderWidth: 1, borderColor: J.line, borderRadius: 20, padding: 14, gap: 10, shadowColor: colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 1 },
  cardPending: { borderStyle: 'dashed', borderColor: J.rec },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 16, fontWeight: '800', color: J.fg, flexShrink: 1 },
  me: { fontSize: 10.5, fontWeight: '900', color: J.accent, backgroundColor: J.accentSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  headline: { fontSize: 13, color: J.muted, marginTop: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { fontSize: 12, fontWeight: '700', color: J.fg, backgroundColor: J.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: J.line, paddingTop: 10 },
  from: { fontSize: 13, color: J.muted },
  fromVal: { fontSize: 16, fontWeight: '900', color: J.fg },
  offers: { fontSize: 13, fontWeight: '800', color: J.accent },
  schedule: { fontSize: 13, color: J.muted, flex: 1 },
  review: { flexDirection: 'row', gap: 8 },
});
