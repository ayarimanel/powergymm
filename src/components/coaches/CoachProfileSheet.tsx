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
import { Btn, J, k } from '../../journal/ui/kit';
import { OfferCard } from './OfferCard';
import { colors, fonts, ink, radius } from '../../theme';
import { Title } from '../ui/Title';

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
              {/* Big photo on top (design-ref CoachFiche): the banner, else the coach's photo */}
              {c.bannerUrl || c.avatarUrl ? (
                <ProductImage uri={c.bannerUrl || c.avatarUrl} style={s.cover} iconSize={40} />
              ) : (
                <View style={[s.cover, s.coverEmpty]}>
                  <Avatar name={c.fullName} size={96} />
                </View>
              )}
              <View style={s.pad}>
                <View style={s.nameRow}>
                  <Title variant="section" size={30} style={{ flexShrink: 1 }}>{c.fullName}</Title>
                  {!pending && <Icon name="shield-checkmark-outline" size={24} color={colors.blue.text} accessibilityLabel="Coach validé par le club" />}
                </View>
                {!!c.headline && <Text style={s.headline}>{c.headline}</Text>}

                {/* Key facts */}
                <View style={s.facts}>
                  {c.yearsExperience > 0 && (
                    <View style={s.fact}>
                      <Text style={s.factVal}>{c.yearsExperience} an{c.yearsExperience > 1 ? 's' : ''}</Text>
                      <Text style={s.factLbl}>Expérience</Text>
                    </View>
                  )}
                  {!!c.clientsCount && (
                    <View style={[s.fact, s.factSep]}>
                      <Text style={s.factVal}>{c.clientsCount}+</Text>
                      <Text style={s.factLbl}>Membres suivis</Text>
                    </View>
                  )}
                  {(live || personal) && (
                    <View style={[s.fact, s.factSep]}>
                      <Text style={[s.factVal, { color: live || c.isAcceptingClients ? colors.green.text : colors.textSecondary }]}>
                        {live ? 'Là' : c.isAcceptingClients ? 'Dispo' : 'Complet'}
                      </Text>
                      <Text style={s.factLbl} numberOfLines={1}>{live ? 'Sur le plateau' : c.availabilityHours || 'Coaching perso'}</Text>
                    </View>
                  )}
                </View>

                {c.specialties.length > 0 && (
                  <View style={s.tags}>
                    {c.specialties.map(t => (
                      <View key={t} style={s.tag}>
                        <Text style={s.tagText}>{t}</Text>
                      </View>
                    ))}
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
                    <Title variant="section" style={s.h}>Formules</Title>
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

                <Title variant="section" style={s.h}>À propos</Title>
                <Text style={s.bio}>{c.bio}</Text>

                {!!c.beforeAfterTransformations?.length && (
                  <>
                    <Title variant="section" style={s.h}>Résultats de ses clients</Title>
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
                    <Title variant="section" style={s.h}>{c.onFloor ? 'Présence au club' : 'Disponibilités'}</Title>
                    <View style={s.days}>
                      {DAYS.map(d => {
                        const on = c.availabilityDays?.includes(d);
                        return (
                          <View key={d} style={[s.day, on && s.dayOn]} accessibilityLabel={`${d} ${on ? 'présent' : 'absent'}`}>
                            <Text style={[s.dayText, on && { color: colors.onInverse }]}>{d}</Text>
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
  cover: { height: 280, width: '100%' },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: J.surface2 },
  pad: { paddingHorizontal: 20, paddingTop: 20 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  avatarRing: { borderRadius: 50 },
  pills: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 22, fontWeight: '900', color: J.fg, flexShrink: 1 },
  headline: { fontSize: 15, fontWeight: '600', color: colors.brandText, marginTop: 4 },
  exp: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  expText: { fontSize: 13, fontWeight: '700', color: J.fg },

  facts: { flexDirection: 'row', marginTop: 18, paddingVertical: 16, borderRadius: 20, backgroundColor: J.surface2 },
  fact: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  factSep: { borderLeftWidth: 1, borderLeftColor: J.line },
  factVal: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 26, lineHeight: 28, color: J.fg },
  factLbl: { fontSize: 12, fontWeight: '500', color: J.muted, textAlign: 'center' },

  pending: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: J.goldSoft, borderRadius: 14, padding: 12, marginTop: 14 },
  pendingText: { fontSize: 13, fontWeight: '700', color: J.gold },
  ownerBtns: { flexDirection: 'row', gap: 8, marginTop: 14 },
  h: { marginTop: 26, marginBottom: 12 },
  bio: { fontSize: 15, fontWeight: '500', lineHeight: 22, color: colors.textSecondary },
  floor: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: J.okSoft, borderRadius: 16, padding: 14, marginTop: 16 },
  floorText: { flex: 1, fontSize: 13, color: J.okText, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tag: { backgroundColor: J.surface2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tagText: { fontSize: 13, fontWeight: '700', color: J.fg },
  transImgs: { flexDirection: 'row', gap: 8 },
  transImg: { width: '100%', aspectRatio: 1, borderRadius: 16 },
  transTag: { position: 'absolute', left: 8, top: 8, backgroundColor: ink(0.7), color: colors.white, fontSize: 11, fontWeight: '800', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  transText: { fontSize: 13, color: J.fg },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 40, borderRadius: 12, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.text },
  dayText: { fontSize: 12, fontWeight: '800', color: J.muted },
  hours: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  hoursText: { fontSize: 14, fontWeight: '700', color: J.fg },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: J.line, backgroundColor: J.surface },
});
