import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { CoachPricingPlan, CoachProfile } from '../../types/database';
import { DAYS, isOnFloorNow } from '../../services/coachService';
import { fmtTnd, offersPersonal, plansOf } from '../../coaching/offers';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { Avatar } from '../community/Avatar';
import { ProductImage } from '../shop/ProductImage';
import { Btn, J, Pill, k } from '../../journal/ui/kit';
import { OfferCard } from './OfferCard';
import { colors, ink } from '../../theme';

interface Props {
  coach: CoachProfile | null;
  isMine: boolean;
  isOwner: boolean;
  onClose: () => void;
  onBook: (coach: CoachProfile, offer: CoachPricingPlan | null) => void;
  onEdit: (coach: CoachProfile) => void;
  onEditOffers: (coach: CoachProfile) => void;
}

export const CoachProfileSheet: React.FC<Props> = ({ coach, isMine, isOwner, onClose, onBook, onEdit, onEditOffers }) => {
  const [shown, setShown] = useState<CoachProfile | null>(coach);
  const [offerId, setOfferId] = useState<string | null>(null);
  useEffect(() => {
    if (!coach) return;
    setShown(coach);
    if (coach.id !== shown?.id || !offerId) {
      const list = plansOf(coach);
      setOfferId((list.find(o => o.isPopular) ?? list[0])?.id ?? null);
    }
  }, [coach]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = shown;
  const canEdit = isMine || isOwner;

  return (
    <BottomSheet visible={!!coach} onClose={onClose} snaps={[0.94]}>
      {(_, extraBottom) => {
        if (!c) return null;
        const pending = c.status === 'pending';
        const live = c.onFloor && isOnFloorNow(c);
        const personal = offersPersonal(c);
        const offers = personal ? plansOf(c) : [];
        const selected = offers.find(o => o.id === offerId) ?? null;
        return (
          <View style={{ flex: 1 }}>
            <SheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <ProductImage uri={c.bannerUrl} style={s.cover} iconSize={40} />
              <View style={s.pad}>
                <View style={s.avatarRow}>
                  <View style={s.avatarRing}>
                    <Avatar name={c.fullName} url={c.avatarUrl} size={84} online={live} />
                  </View>
                  <View style={s.pills}>
                    {live && <Pill tone="ok" label="Sur le plateau" />}
                    {personal && <Pill tone={c.isAcceptingClients ? 'ok' : 'tired'} label={c.isAcceptingClients ? 'Disponible' : 'Complet'} />}
                  </View>
                </View>

                <View style={s.nameRow}>
                  <Text style={s.name} accessibilityRole="header">{c.fullName}</Text>
                  {!pending && <Icon name="shield-checkmark" size={20} color={J.goldBright} accessibilityLabel="Coach validé par le club" />}
                </View>
                {!!c.headline && <Text style={s.headline}>{c.headline}</Text>}
                {c.yearsExperience > 0 && (
                  <View style={s.exp}>
                    <Icon name="trophy-outline" size={15} color={J.muted} />
                    <Text style={s.expText}>{c.yearsExperience} an{c.yearsExperience > 1 ? 's' : ''} d’expérience</Text>
                  </View>
                )}

                {pending && (
                  <View style={s.pending}>
                    <Icon name="hourglass-outline" size={18} color={J.gold} />
                    <Text style={s.pendingText}>En attente de validation par le club.</Text>
                  </View>
                )}

                {canEdit && (
                  <View style={s.ownerBtns}>
                    <Btn small variant="ghost" label="Modifier le profil" onPress={() => onEdit(c)} style={{ flex: 1 }} />
                    <Btn small variant="soft" label={c.pricingPlans?.length ? 'Mes plans' : 'Ajouter un plan'} onPress={() => onEditOffers(c)} style={{ flex: 1 }} />
                  </View>
                )}

                {personal && (
                  <>
                    <Text style={s.h}>Coaching personnel</Text>
                    {offers.length ? (
                      <View style={{ gap: 12 }}>
                        <Text style={k.sub}>Choisis un plan, puis réserve : tu reçois le numéro du coach.</Text>
                        {offers.map(o => (
                          <View key={o.id} style={{ marginTop: o.isPopular ? 8 : 0 }}>
                            <OfferCard offer={o} selected={o.id === offerId} onPress={() => setOfferId(o.id)} />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={s.bio}>Séances privées sur rendez-vous. Le tarif se fixe directement avec le coach.</Text>
                    )}
                  </>
                )}

                {c.onFloor && (
                  <View style={s.floor}>
                    <Icon name="walk-outline" size={20} color={J.okText} />
                    <Text style={s.floorText}>
                      <Text style={{ fontWeight: '800' }}>Coach plateau : </Text>
                      présent dans la salle pour corriger et guider les membres, gratuitement.
                    </Text>
                  </View>
                )}

                <Text style={s.h}>À propos</Text>
                <Text style={s.bio}>{c.bio}</Text>
                {c.specialties.length > 0 && (
                  <View style={s.tags}>
                    {c.specialties.map(t => (
                      <View key={t} style={s.tag}>
                        <Text style={s.tagText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {!!c.beforeAfterTransformations?.length && (
                  <>
                    <Text style={s.h}>Résultats de ses clients</Text>
                    <View style={{ gap: 12 }}>
                      {c.beforeAfterTransformations.map((t, i) => (
                        <View key={i} style={{ gap: 8 }}>
                          <View style={s.transImgs}>
                            <View style={{ flex: 1 }}>
                              <ProductImage uri={t.beforeUrl} style={s.transImg} iconSize={20} />
                              <Text style={s.transTag}>Avant</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <ProductImage uri={t.afterUrl} style={s.transImg} iconSize={20} />
                              <Text style={[s.transTag, { backgroundColor: J.ok }]}>Après</Text>
                            </View>
                          </View>
                          <Text style={s.transText}>
                            <Text style={{ fontWeight: '800' }}>{t.clientName}</Text> · {t.duration} · {t.result}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {(!!c.availabilityDays?.length || !!c.availabilityHours) && (
                  <>
                    <Text style={s.h}>{c.onFloor ? 'Présence au club' : 'Disponibilités'}</Text>
                    <View style={s.days}>
                      {DAYS.map(d => {
                        const on = c.availabilityDays?.includes(d);
                        return (
                          <View key={d} style={[s.day, on && s.dayOn]} accessibilityLabel={`${d} ${on ? 'présent' : 'absent'}`}>
                            <Text style={[s.dayText, on && { color: colors.white }]}>{d}</Text>
                          </View>
                        );
                      })}
                    </View>
                    {!!c.availabilityHours && (
                      <View style={s.hours}>
                        <Icon name="time-outline" size={16} color={J.muted} />
                        <Text style={s.hoursText}>{c.availabilityHours}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </SheetScrollView>

            {!isMine && !pending && (
              <View style={[s.footer, { paddingBottom: 12 + extraBottom }]}>
                {personal && !c.isAcceptingClients ? (
                  <Btn full variant="ghost" label="Complet · le contacter quand même" onPress={() => onBook(c, null)} />
                ) : personal ? (
                  <Btn full label={selected ? `Réserver · ${fmtTnd(selected.priceTnd)}` : 'Réserver une séance'} onPress={() => onBook(c, selected)} />
                ) : (
                  <Btn full variant="soft" label="Contacter le coach" onPress={() => onBook(c, null)} />
                )}
              </View>
            )}
          </View>
        );
      }}
    </BottomSheet>
  );
};

const s = StyleSheet.create({
  cover: { height: 140, width: '100%' },
  pad: { paddingHorizontal: 20 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -42 },
  avatarRing: { borderRadius: 50, borderWidth: 4, borderColor: J.surface, backgroundColor: J.surface },
  pills: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  name: { fontSize: 22, fontWeight: '900', color: J.fg, flexShrink: 1 },
  headline: { fontSize: 14, color: J.muted, marginTop: 2 },
  exp: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  expText: { fontSize: 13, fontWeight: '700', color: J.fg },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: J.goldSoft, borderRadius: 12, padding: 10, marginTop: 10 },
  pendingText: { fontSize: 13, fontWeight: '700', color: J.gold },
  ownerBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  h: { fontSize: 15, fontWeight: '800', color: J.fg, marginTop: 22, marginBottom: 10 },
  bio: { fontSize: 14, lineHeight: 21, color: J.fg },
  floor: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: J.okSoft, borderRadius: 14, padding: 12, marginTop: 16 },
  floorText: { flex: 1, fontSize: 13, color: J.okText, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { backgroundColor: J.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12.5, fontWeight: '700', color: J.fg },
  transImgs: { flexDirection: 'row', gap: 8 },
  transImg: { width: '100%', aspectRatio: 1, borderRadius: 14 },
  transTag: { position: 'absolute', left: 8, top: 8, backgroundColor: ink(0.7), color: colors.white, fontSize: 11, fontWeight: '800', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  transText: { fontSize: 13, color: J.fg },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 36, borderRadius: 10, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: J.ok },
  dayText: { fontSize: 12, fontWeight: '800', color: J.muted },
  hours: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  hoursText: { fontSize: 14, fontWeight: '700', color: J.fg },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: J.line, backgroundColor: J.surface },
});
