import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { CoachPricingPlan, CoachProfile } from '../../types/database';
import { daysSummary } from '../../services/coachService';
import { fmtTnd, planText } from '../../coaching/offers';
import { BottomSheet } from '../home/BottomSheet';
import { Avatar } from '../community/Avatar';
import { J, tabular } from '../../journal/ui/kit';
import { colors } from '../../theme';

interface Props {
  coach: CoachProfile | null;
  offer: CoachPricingPlan | null;
  onClose: () => void;
  onWhatsApp: (coach: CoachProfile, offer: CoachPricingPlan | null) => void;
  onCall: (coach: CoachProfile) => void;
}

/** Réserver = the coach's number, right away: WhatsApp (message already written) or a call. Payment happens with the coach. */
export const BookingSheet: React.FC<Props> = ({ coach, offer, onClose, onWhatsApp, onCall }) => {
  // Keep the content while the sheet slides out.
  const [shown, setShown] = useState<{ c: CoachProfile; o: CoachPricingPlan | null } | null>(null);
  useEffect(() => {
    if (coach) setShown({ c: coach, o: offer });
  }, [coach, offer]);
  const c = shown?.c;
  const o = shown?.o ?? null;
  const schedule = c ? [daysSummary(c.availabilityDays), c.availabilityHours].filter(Boolean).join(' · ') : '';

  return (
    <BottomSheet visible={!!coach} onClose={onClose} snaps={[0.72]}>
      {() =>
        c ? (
          <View style={s.body}>
            <View style={s.head}>
              <Avatar name={c.fullName} url={c.avatarUrl} size={52} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.caps}>Réserver avec</Text>
                <Text style={s.name} accessibilityRole="header" numberOfLines={1}>{c.fullName}</Text>
              </View>
            </View>

            {o ? (
              <View style={s.recap}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.recapTitle} numberOfLines={1}>{o.title}</Text>
                  {!!planText(o) && <Text style={s.recapSub} numberOfLines={2}>{planText(o)}</Text>}
                </View>
                <Text style={[s.recapPrice, tabular]}>{fmtTnd(o.priceTnd)}</Text>
              </View>
            ) : (
              <View style={s.recap}>
                <Text style={s.recapSub}>Séance de coaching · le tarif se fixe avec le coach</Text>
              </View>
            )}

            <View style={s.numberBox}>
              <Text style={s.caps}>Numéro du coach</Text>
              <Text style={[s.number, tabular]} selectable accessibilityLabel={`Numéro : ${c.contactPhone}`}>{c.contactPhone}</Text>
              {!!schedule && <Text style={s.schedule}>Disponible {schedule}</Text>}
            </View>

            <Pressable onPress={() => onWhatsApp(c, o)} accessibilityRole="button" accessibilityLabel="Réserver sur WhatsApp" style={({ pressed }) => [s.wa, pressed && { opacity: 0.9 }]}>
              <Ionicons name="logo-whatsapp" size={24} color={colors.white} />
              <View style={{ flex: 1 }}>
                <Text style={s.waTitle}>Réserver sur WhatsApp</Text>
                <Text style={s.waSub}>Ton message est déjà écrit, il suffit de l’envoyer</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </Pressable>
            <Pressable onPress={() => onCall(c)} accessibilityRole="button" accessibilityLabel={`Appeler ${c.fullName}`} style={({ pressed }) => [s.call, pressed && { opacity: 0.9 }]}>
              <Ionicons name="call" size={20} color={J.fg} />
              <Text style={s.callText}>Appeler maintenant</Text>
            </Pressable>

            <Text style={s.note}>Le coach te répond pour fixer ta première séance. Le paiement se fait directement avec lui.</Text>
          </View>
        ) : null
      }
    </BottomSheet>
  );
};

const WA = colors.whatsapp;
const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  caps: { fontSize: 11, fontWeight: '800', color: J.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  name: { fontSize: 20, fontWeight: '800', color: J.fg },
  recap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: J.accentSoft, borderRadius: 16, padding: 14 },
  recapTitle: { fontSize: 15, fontWeight: '800', color: J.fg },
  recapSub: { fontSize: 12.5, color: J.muted, marginTop: 2 },
  recapPrice: { fontSize: 20, fontWeight: '900', color: J.fg },
  numberBox: { alignItems: 'center', gap: 2, borderWidth: 1, borderColor: J.line, borderRadius: 16, paddingVertical: 14 },
  number: { fontSize: 26, fontWeight: '900', color: J.fg, letterSpacing: 0.5 },
  schedule: { fontSize: 12.5, color: J.muted },
  wa: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: WA, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, minHeight: 60 },
  waTitle: { color: colors.white, fontSize: 16, fontWeight: '900' },
  waSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  call: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, minHeight: 52, backgroundColor: J.surface2, borderWidth: 1, borderColor: J.line },
  callText: { fontSize: 15, fontWeight: '800', color: J.fg },
  note: { fontSize: 12, color: J.muted, textAlign: 'center', lineHeight: 17 },
});
