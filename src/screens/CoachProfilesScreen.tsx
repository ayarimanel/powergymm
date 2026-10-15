import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../components/ui/Text';
import { Icon } from '../components/ui/Icon';
import { CoachPricingPlan, CoachProfile, UserProfile } from '../types/database';
import { AuthService } from '../services/authService';
import { GymConfigService } from '../config/gymConfig';
import { CoachService, isOnFloorNow, isOwnProfile, setLiveStatus, telUrl, whatsappUrl } from '../services/coachService';
import { bookingMessage, fmtTnd, fromPrice, offersPersonal, plansOf } from '../coaching/offers';
import { hasPermission } from '../services/permissionsService';
import { CoachCard } from '../components/coaches/CoachCard';
import { CoachProfileSheet } from '../components/coaches/CoachProfileSheet';
import { BookingSheet } from '../components/coaches/BookingSheet';
import { CoachEditSheet } from '../components/coaches/CoachEditSheet';
import { CoachOffersSheet } from '../components/coaches/CoachOffersSheet';
import { Avatar } from '../components/community/Avatar';
import { useScrollToTopOnReselect } from '../navigation/tabEvents';
import { Toast } from '../components/home/Toast';
import { Btn, Card, J, SecHead, Seg, k } from '../journal/ui/kit';
import { haptics } from '../utils/haptics';
import { colors } from '../theme';
import { claimSwipe } from '../navigation/swipeGuard';

interface Props {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
}

type Filter = 'all' | 'personal' | 'floor';

// Two bottom sheets can't be presented at once on iOS: wait for the first to slide out.
const after = (fn: () => void) => setTimeout(fn, 260);

export const CoachProfilesScreen: React.FC<Props> = ({ user, onUpdateUser }) => {
  const scrollRef = useScrollToTopOnReselect('coaches');
  const isOwner = user.role === 'owner';
  const canManageCoaches = isOwner || hasPermission(user, 'manageCoaches');
  const isCoachAccount = user.role === 'coach';

  const [coaches, setCoaches] = useState<CoachProfile[] | null>(null);
  const [gymName, setGymName] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ coachId: string; offer: CoachPricingPlan | null } | null>(null);
  const [offersId, setOffersId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ open: boolean; mode: 'edit' | 'new'; coachId: string | null }>({ open: false, mode: 'edit', coachId: null });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    CoachService.getCoaches().then(setCoaches);
    GymConfigService.getConfig().then(c => setGymName(c.name));
  }, []);

  const myProfile = coaches?.find(c => isOwnProfile(c, user));

  // The owner validated my coach profile → my account is now an approved coach (unlocks record validation on the Wall)
  useEffect(() => {
    if (isCoachAccount && myProfile?.status === 'approved' && user.coachStatus !== 'approved') {
      AuthService.saveProfile({ ...user, coachStatus: 'approved', isApprovedCoach: true }).then(u => {
        onUpdateUser(u);
        setToast('Ton profil coach est validé 🎉');
      });
    }
  }, [myProfile?.status, user.coachStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (next: CoachProfile[]) => {
    setCoaches(next);
    CoachService.saveCoaches(next);
  };
  const updateCoach = (c: CoachProfile, message?: string) => {
    persist((coaches ?? []).map(x => (x.id === c.id ? c : x)));
    if (message) setToast(message);
  };

  // Members see validated coaches; a coach also sees their own pending profile; the owner (or a delegate) sees everything.
  const visible = (coaches ?? []).filter(c => c.status !== 'pending' || canManageCoaches || isOwnProfile(c, user));
  const pending = visible.filter(c => c.status === 'pending' && canManageCoaches && !isOwnProfile(c, user));
  const live = visible.filter(c => c.status !== 'pending' && c.onFloor && isOnFloorNow(c));
  const list = visible
    .filter(c => !pending.includes(c) && !(isCoachAccount && isOwnProfile(c, user)))
    .filter(c => (filter === 'personal' ? offersPersonal(c) : filter === 'floor' ? c.onFloor : true))
    .sort((a, b) => Number(isOnFloorNow(b)) - Number(isOnFloorNow(a)) || Number(b.isAcceptingClients) - Number(a.isAcceptingClients));

  const profileCoach = coaches?.find(c => c.id === profileId) ?? null;
  const bookingCoach = coaches?.find(c => c.id === booking?.coachId) ?? null;
  const offersCoach = coaches?.find(c => c.id === offersId) ?? null;
  const editCoach = coaches?.find(c => c.id === edit.coachId) ?? null;

  const openUrl = (url: string, fail: string) => Linking.openURL(url).catch(() => setToast(fail));

  const openEdit = (coach: CoachProfile | null, mode: 'edit' | 'new') => {
    setProfileId(null);
    after(() => setEdit({ open: true, mode, coachId: coach?.id ?? null }));
  };
  const openOffers = (coach: CoachProfile) => {
    setProfileId(null);
    after(() => setOffersId(coach.id));
  };

  const saveProfile = (profile: CoachProfile) => {
    if (!coaches) return;
    const exists = coaches.some(c => c.id === profile.id);
    persist(exists ? coaches.map(c => (c.id === profile.id ? profile : c)) : [profile, ...coaches]);
    setEdit(e => ({ ...e, open: false }));
    setToast(profile.status === 'pending' ? 'Envoyé : le club va valider ton profil' : 'Profil enregistré');
    // A brand-new coach who offers private séances goes straight to publishing an offer.
    if (!exists && profile.personalCoaching && !profile.pricingPlans?.length) after(() => setOffersId(profile.id));
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.h1} accessibilityRole="header">Coachs</Text>
          {!!gymName && <Text style={s.sub} numberOfLines={1}>{gymName}</Text>}
        </View>
        <View style={s.chip} accessibilityLabel={`${live.length} coach${live.length > 1 ? 's' : ''} sur le plateau maintenant`}>
          <View style={[s.liveDot, !live.length && { backgroundColor: J.muted }]} />
          <Text style={s.chipText}>{live.length ? `${live.length} sur le plateau` : 'Personne au plateau'}</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.content}>
        {/* Coach account: my space */}
        {isCoachAccount && coaches && (myProfile ? (
          <CoachSpace
            coach={myProfile}
            onOpen={() => setProfileId(myProfile.id)}
            onEdit={() => openEdit(myProfile, 'edit')}
            onOffers={() => setOffersId(myProfile.id)}
            onAccepting={v => updateCoach({ ...myProfile, isAcceptingClients: v }, v ? 'Tu es affiché disponible' : 'Tu es affiché complet')}
            onLive={async state => {
              haptics.select();
              setCoaches(await setLiveStatus(myProfile.id, state));
              setToast(state === 'here' ? 'Tu es signalé sur le plateau' : 'Tu es signalé comme parti');
            }}
          />
        ) : (
          <Pressable onPress={() => openEdit(null, 'new')} accessibilityRole="button" style={s.create}>
            <View style={s.createIc}>
              <Icon name="ribbon" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.createTitle}>Crée ton profil coach</Text>
              <Text style={s.createSub}>Ta photo, ta description, ton plan et ton prix : les membres te réservent sur WhatsApp.</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={J.gold} />
          </Pressable>
        ))}

        {/* Owner: profiles waiting for approval */}
        {pending.length > 0 && (
          <View style={{ gap: 10 }}>
            <SecHead pad title={`À valider (${pending.length})`} />
            {pending.map(c => (
              <CoachCard
                key={c.id}
                coach={c}
                isMine={false}
                onPress={() => setProfileId(c.id)}
                onApprove={() => {
                  persist(coaches!.map(x => (x.id === c.id ? { ...x, status: 'approved' } : x)));
                  setToast(`${c.fullName} est coach du club ✓`);
                }}
                onRefuse={() => {
                  persist(coaches!.filter(x => x.id !== c.id));
                  setToast('Profil refusé');
                }}
              />
            ))}
          </View>
        )}

        {/* Who is on the floor right now */}
        {live.length > 0 && (
          <Card>
            <SecHead title="Sur le plateau maintenant" sub="Va les voir, c’est gratuit" />
            <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {live.map(c => (
                <Pressable key={c.id} onPress={() => setProfileId(c.id)} accessibilityRole="button" accessibilityLabel={`${c.fullName}, sur le plateau`} style={s.liveCoach}>
                  <Avatar name={c.fullName} url={c.avatarUrl} size={56} online />
                  <Text style={s.liveName} numberOfLines={1}>{c.fullName.replace(/^Coach\s+/i, '')}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        )}

        <View style={s.filterRow}>
          <Seg options={[['all', 'Tous'], ['personal', 'Coaching perso'], ['floor', 'Plateau']]} value={filter} onChange={setFilter} />
        </View>

        {!coaches && [0, 1].map(i => <View key={i} style={s.skeleton} />)}

        {list.map(c => (
          <CoachCard key={c.id} coach={c} isMine={isOwnProfile(c, user)} onPress={() => setProfileId(c.id)} />
        ))}

        {coaches && list.length === 0 && (
          <View style={s.empty}>
            <Icon name="ribbon-outline" size={40} color={J.muted} />
            <Text style={s.emptyTitle}>{filter === 'all' ? 'Aucun coach pour l’instant' : 'Aucun coach dans cette catégorie'}</Text>
            {isOwner && filter === 'all' && <Text style={k.sub}>Ajoute le premier coach du club.</Text>}
          </View>
        )}
      </ScrollView>

      <Toast message={toast} onHide={() => setToast(null)} />

      {isOwner && (
        <Pressable onPress={() => openEdit(null, 'new')} accessibilityRole="button" accessibilityLabel="Ajouter un coach" style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.96 }] }]}>
          <Icon name="add" size={22} color={colors.white} />
          <Text style={s.fabText}>Coach</Text>
        </Pressable>
      )}

      <CoachProfileSheet
        coach={profileCoach}
        isMine={!!profileCoach && isOwnProfile(profileCoach, user)}
        isOwner={canManageCoaches}
        onClose={() => setProfileId(null)}
        onBook={(c, offer) => {
          setProfileId(null);
          after(() => setBooking({ coachId: c.id, offer }));
        }}
        onEdit={c => openEdit(c, 'edit')}
        onEditOffers={openOffers}
      />

      <BookingSheet
        coach={bookingCoach}
        offer={booking?.offer ?? null}
        onClose={() => setBooking(null)}
        onWhatsApp={(c, offer) => openUrl(whatsappUrl(c, bookingMessage(c, user.fullName, offer)), 'Impossible d’ouvrir WhatsApp')}
        onCall={c => openUrl(telUrl(c), 'Impossible de lancer l’appel')}
      />

      <CoachOffersSheet visible={!!offersCoach} coach={offersCoach} onClose={() => setOffersId(null)} onChange={(c, msg) => updateCoach(c, msg)} />

      <CoachEditSheet
        visible={edit.open}
        mode={edit.mode}
        coach={editCoach}
        me={user}
        isOwner={isOwner}
        onClose={() => setEdit(e => ({ ...e, open: false }))}
        onSave={saveProfile}
        onRemove={c => {
          persist((coaches ?? []).filter(x => x.id !== c.id));
          setEdit(e => ({ ...e, open: false }));
          setToast('Coach retiré du club');
        }}
      />
    </View>
  );
};

/* ---------- the coach's own space ---------- */
const CoachSpace: React.FC<{
  coach: CoachProfile;
  onOpen: () => void;
  onEdit: () => void;
  onOffers: () => void;
  onAccepting: (v: boolean) => void;
  onLive: (state: 'here' | 'away') => void;
}> = ({ coach: c, onOpen, onEdit, onOffers, onAccepting, onLive }) => {
  const live = isOnFloorNow(c);
  const plans = plansOf(c);
  const from = fromPrice(c);
  const pending = c.status === 'pending';
  return (
    <Card style={{ gap: 12 }}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Voir mon profil comme un membre" style={s.spaceTop}>
        <Avatar name={c.fullName} url={c.avatarUrl} size={48} online={live} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.caps}>Mon espace coach</Text>
          <Text style={s.spaceName} numberOfLines={1}>{c.fullName}</Text>
        </View>
        <Text style={s.preview}>Aperçu ›</Text>
      </Pressable>

      {pending && (
        <View style={s.pendingNote}>
          <Icon name="hourglass-outline" size={16} color={J.gold} />
          <Text style={s.pendingText}>Le club doit valider ton profil avant que les membres le voient. Prépare ton plan en attendant.</Text>
        </View>
      )}

      {c.onFloor && (
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleTitle}>{live ? 'Tu es sur le plateau' : 'Tu n’es pas sur le plateau'}</Text>
            <Text style={k.sub}>Les membres voient qui est là en ce moment.</Text>
          </View>
          <Btn small variant={live ? 'ghost' : 'primary'} label={live ? 'Je pars' : 'J’arrive'} onPress={() => onLive(live ? 'away' : 'here')} />
        </View>
      )}

      {offersPersonal(c) && (
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleTitle}>{c.isAcceptingClients ? 'Disponible pour de nouveaux clients' : 'Complet'}</Text>
            <Text style={k.sub}>{c.isAcceptingClients ? 'Le bouton Réserver est actif.' : 'Les membres voient « Complet ».'}</Text>
          </View>
          <Switch value={c.isAcceptingClients} onValueChange={onAccepting} trackColor={{ true: J.ok, false: colors.disabled }} thumbColor={colors.white} accessibilityLabel="Disponible pour de nouveaux clients" />
        </View>
      )}

      <Pressable onPress={onOffers} accessibilityRole="button" style={({ pressed }) => [s.offersBox, pressed && { opacity: 0.9 }]}>
        <View style={s.offersIc}>
          <Icon name="pricetags" size={20} color={J.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.toggleTitle}>Mes plans</Text>
          <Text style={k.sub} numberOfLines={1}>{plans.length ? `${plans.map(p => p.title).join(' · ')}${from ? ` · dès ${fmtTnd(from)}` : ''}` : 'Présente ton coaching et fixe ton prix'}</Text>
        </View>
        <Text style={s.offersGo}>{plans.length ? 'Modifier' : 'Ajouter'} ›</Text>
      </Pressable>

      <Pressable onPress={onEdit} accessibilityRole="button" style={({ pressed }) => [s.offersBox, s.profileBox, pressed && { opacity: 0.9 }]}>
        <View style={s.offersIc}>
          <Icon name="person-circle-outline" size={22} color={J.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.toggleTitle}>Mon profil</Text>
          <Text style={k.sub} numberOfLines={1}>Photo, couverture, description, expérience</Text>
        </View>
        <Text style={[s.offersGo, { color: J.fg }]}>Modifier ›</Text>
      </Pressable>
    </Card>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.header, borderBottomWidth: 1, borderBottomColor: J.line },
  h1: { fontSize: 18, fontWeight: '800', color: J.fg },
  sub: { fontSize: 11, fontWeight: '700', color: J.muted },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: J.ok },
  chipText: { fontSize: 12, fontWeight: '800', color: J.fg },

  content: { padding: 12, paddingBottom: 100, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },

  create: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: J.goldSoft, borderWidth: 1, borderColor: colors.gold.border },
  createIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: J.goldBright, alignItems: 'center', justifyContent: 'center' },
  createTitle: { fontSize: 16, fontWeight: '800', color: J.gold },
  createSub: { fontSize: 13, lineHeight: 18, color: J.gold, marginTop: 2 },

  spaceTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  caps: { fontSize: 11, fontWeight: '800', color: J.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  spaceName: { fontSize: 17, fontWeight: '800', color: J.fg },
  preview: { fontSize: 13, fontWeight: '800', color: J.accent },
  pendingNote: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: J.goldSoft, borderRadius: 12, padding: 10 },
  pendingText: { flex: 1, fontSize: 12.5, color: J.gold, fontWeight: '700', lineHeight: 17 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: J.line, paddingTop: 12 },
  toggleTitle: { fontSize: 14, fontWeight: '800', color: J.fg },
  offersBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: J.accentSoft, borderRadius: 16, padding: 12 },
  offersIc: { width: 40, height: 40, borderRadius: 20, backgroundColor: J.surface, alignItems: 'center', justifyContent: 'center' },
  offersGo: { fontSize: 13, fontWeight: '800', color: J.accentText },
  profileBox: { backgroundColor: J.surface2 },

  liveCoach: { alignItems: 'center', gap: 4, width: 64 },
  liveName: { fontSize: 12, fontWeight: '700', color: J.fg, maxWidth: 64 },

  filterRow: { alignItems: 'flex-start', marginTop: 2 },
  skeleton: { height: 150, borderRadius: 20, backgroundColor: J.surface2 },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: J.muted },

  fab: { position: 'absolute', right: 16, bottom: 16, height: 48, paddingHorizontal: 18, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: J.accent, shadowColor: colors.text, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 6 },
  fabText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
