import React, { useCallback, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { MemberProfile } from '../../types/database';
import { ClubClass, bookedCount, isBooked, isWaitlisted, nextAttendeeIds, nextSession } from '../../services/classService';
import { buttonShadow, colors, radius } from '../../theme';
import { haptics } from '../../utils/haptics';
import { claimSwipe } from '../../navigation/swipeGuard';
import { SectionHeader } from '../ui/SectionHeader';
import { Title } from '../ui/Title';
import { Wordmark } from '../ui/Wordmark';

interface Props {
  classes: ClubClass[];
  userId: string;
  profiles: Record<string, MemberProfile>;
  onBook: (c: ClubClass) => Promise<void> | void;
  onCancel: (c: ClubClass) => Promise<void> | void;
  onWaitlist: (c: ClubClass) => Promise<void> | void;
  onSeeAll?: () => void;
}

const DAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const whenLabel = (c: ClubClass) => {
  const { inDays, start } = nextSession(c);
  if (inDays === 0) return "Aujourd'hui";
  if (inDays === 1) return 'Demain';
  return `${DAYS[start.getDay()]} ${start.getDate()} ${MONTHS[start.getMonth()]}`;
};

const CARD_GAP = 10;

/** Optimistic overlay for a single card: how many patches the user just applied that haven't landed yet. */
type Patch = { bookedCount?: number; isBooked?: boolean; isWaitlisted?: boolean };

export const ClassesCarousel: React.FC<Props> = ({ classes, userId, profiles, onBook, onCancel, onWaitlist, onSeeAll }) => {
  const trackRef = useRef<ScrollView>(null);
  const [cardW, setCardW] = useState(0);
  const [active, setActive] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, Patch>>({});

  const sorted = [...classes].sort((a, b) => nextSession(a).start.getTime() - nextSession(b).start.getTime());

  const onLayout = (e: LayoutChangeEvent) => setCardW(Math.round(e.nativeEvent.layout.width * 0.88));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!cardW) return;
    const step = cardW + CARD_GAP;
    setActive(Math.max(0, Math.min(sorted.length - 1, Math.round(e.nativeEvent.contentOffset.x / step))));
  };

  const goTo = (k: number) => {
    if (!cardW) return;
    trackRef.current?.scrollTo({ x: k * (cardW + CARD_GAP), animated: true });
  };

  const patchFor = useCallback(
    (c: ClubClass) => {
      const p = patches[c.id] ?? {};
      const bc = p.bookedCount ?? bookedCount(c);
      const booked = p.isBooked ?? isBooked(c, userId);
      const waitl = p.isWaitlisted ?? isWaitlisted(c, userId);
      return { bc, booked, waitl };
    },
    [patches, userId]
  );

  const act = async (c: ClubClass) => {
    if (busyId) return;
    const before = patchFor(c);
    const full = before.bc >= c.capacity && !before.booked;
    let call: (c: ClubClass) => Promise<void> | void;
    let optimistic: Patch;
    if (before.booked) {
      optimistic = { isBooked: false, bookedCount: Math.max(0, before.bc - 1) };
      call = onCancel;
    } else if (full) {
      optimistic = { isWaitlisted: !before.waitl };
      call = onWaitlist;
    } else {
      optimistic = { isBooked: true, bookedCount: before.bc + 1 };
      call = onBook;
    }
    setBusyId(c.id);
    setPatches(prev => ({ ...prev, [c.id]: { ...prev[c.id], ...optimistic } }));
    haptics.select();
    try {
      await call(c);
      // On success, clear the local patch — parent's next render carries the truth.
      setPatches(prev => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
    } catch {
      // Rollback: drop the optimistic patch.
      setPatches(prev => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };

  if (sorted.length === 0) {
    return <Text style={styles.empty}>Aucun cours prévu cette semaine.</Text>;
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <SectionHeader title="Cours à réserver" actionLabel={onSeeAll ? 'Tout voir' : undefined} onAction={onSeeAll} />

      <ScrollView
        ref={trackRef}
        horizontal
        onTouchStart={claimSwipe}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + CARD_GAP}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.track}
      >
        {cardW > 0 && sorted.map(c => {
          const { bc, booked, waitl } = patchFor(c);
          const ratio = Math.min(1, bc / c.capacity);
          const full = bc >= c.capacity && !booked;
          const level: 'ok' | 'hot' | 'full' = full ? 'full' : ratio >= 0.7 ? 'hot' : 'ok';
          const lv = level === 'ok' ? colors.green.bar : level === 'hot' ? colors.amber.bar : colors.red.bar;
          const lvText = level === 'ok' ? colors.green.text : level === 'hot' ? colors.amber.text : colors.red.text;

          const attendeeIds = nextAttendeeIds(c).slice(0, 3);
          const others = Math.max(0, bc - attendeeIds.length);

          const btn = booked
            ? { label: 'Réservé', style: styles.btnBooked, textStyle: styles.btnBookedText }
            : full
              ? waitl
                ? { label: "Sur liste d'attente", style: styles.btnWait, textStyle: styles.btnWaitText }
                : { label: "Liste d'attente", style: styles.btnFull, textStyle: styles.btnFullText }
              : { label: 'Réserver', style: styles.btnPrimary, textStyle: styles.btnPrimaryText };

          return (
            <View
              key={c.id}
              style={[styles.card, { width: cardW }, booked && styles.cardBooked]}
              accessibilityLabel={`${c.title}, ${bc} inscrits sur ${c.capacity}`}
            >
              {/* No class photos in the app: the club's wordmark marks the card (design-ref Main, 2nd card). */}
              <View style={styles.top}>
                <Wordmark size={15} style={styles.mark} />
                {(booked || full || level === 'hot') && (
                  <View style={[styles.status, booked ? styles.statusBooked : full ? styles.statusFull : styles.statusHot]}>
                    <Text style={[styles.statusText, { color: booked ? colors.green.text : full ? colors.text : colors.onWarning }]}>
                      {booked ? 'Réservé' : full ? 'Complet' : 'Ça se remplit'}
                    </Text>
                  </View>
                )}
              </View>

              <Title variant="card" numberOfLines={1} style={styles.name}>{c.title}</Title>
              <View style={styles.metaRow}>
                <View style={styles.metaMark} />
                <Text style={styles.meta} numberOfLines={2}>
                  {whenLabel(c)} {c.time} · {c.coachName} · {c.durationMin} min
                </Text>
              </View>

              <View style={styles.bottom}>
              <View style={styles.peopleRow}>
                <View style={styles.faces}>
                  {attendeeIds.map((uid, i) => {
                    const p = profiles[uid];
                    const initial = (p?.name ?? uid).trim().charAt(0).toUpperCase() || '?';
                    return p?.avatarUrl ? (
                      <Image key={uid} source={{ uri: p.avatarUrl }} style={[styles.face, i > 0 && styles.faceOverlap]} />
                    ) : (
                      <View key={uid} style={[styles.face, styles.faceInit, i > 0 && styles.faceOverlap]}>
                        <Text style={styles.faceInitText}>{initial}</Text>
                      </View>
                    );
                  })}
                  {others > 0 && (
                    <View style={[styles.face, styles.faceMore, attendeeIds.length > 0 && styles.faceOverlap]}>
                      <Text style={styles.faceMoreText}>+{others}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.count} numberOfLines={1}>
                  {full ? `${bc} / ${c.capacity} inscrits` : `${bc} ${bc > 1 ? 'membres inscrits' : 'membre inscrit'}`}
                </Text>
              </View>

              <Pressable
                onPress={() => act(c)}
                accessibilityRole="button"
                disabled={busyId === c.id}
                style={[styles.btn, btn.style, busyId === c.id && { opacity: 0.7 }]}
              >
                {(booked || (full && waitl)) && <Icon name="checkmark" size={14} color={booked ? colors.green.text : colors.brandText} />}
                <Text style={[styles.btnText, btn.textStyle]}>{btn.label}</Text>
              </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {sorted.map((c, k) => {
          const on = k === active;
          return (
            <Pressable
              key={c.id}
              onPress={() => goTo(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={c.title}
              style={[styles.dot, on && styles.dotOn]}
              hitSlop={6}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 14 },

  track: { paddingRight: 16, gap: CARD_GAP },

  card: { minHeight: 196, borderRadius: radius.cardLg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 18, justifyContent: 'flex-end', gap: 6 },
  cardBooked: { borderColor: colors.green.bar },

  top: { position: 'absolute', top: 16, left: 18, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mark: { opacity: 0.9 },
  status: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusHot: { backgroundColor: colors.amber.bar },
  statusFull: { backgroundColor: colors.track },
  statusBooked: { backgroundColor: colors.green.soft },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },

  name: { marginTop: 40 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaMark: { width: 3, alignSelf: 'stretch', minHeight: 16, borderRadius: 2, backgroundColor: colors.brand },
  meta: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.brandText },

  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  peopleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  faces: { flexDirection: 'row' },
  face: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.card, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  faceOverlap: { marginLeft: -8 },
  faceInit: { backgroundColor: colors.brandSoft },
  faceInitText: { color: colors.brandText, fontSize: 10, fontWeight: '800' },
  faceMore: { backgroundColor: colors.track },
  faceMoreText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },

  count: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary },

  btn: { flexDirection: 'row', gap: 4, height: 44, borderRadius: 999, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 14, fontWeight: '800' },
  btnPrimary: { backgroundColor: colors.brand, ...buttonShadow },
  btnPrimaryText: { color: colors.white },
  btnBooked: { backgroundColor: colors.green.soft },
  btnBookedText: { color: colors.green.text },
  btnFull: { borderWidth: 1.5, borderColor: colors.disabled },
  btnFullText: { color: colors.text },
  btnWait: { backgroundColor: colors.brandSoft },
  btnWaitText: { color: colors.brandText },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotOn: { width: 18, backgroundColor: colors.text },

  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 13, paddingVertical: 18 },
});
