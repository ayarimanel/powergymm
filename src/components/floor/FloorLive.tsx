import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { FloorSnapshot } from '../../floor/useFloorSnapshot';
import { TrainingTimeSlot } from '../../types/database';
import { WeekForecast } from '../../floor/useWeekForecast';
import { CrowdLevel, LEVEL_LABEL } from '../../floor/crowd';
import { levelTint } from '../../floor/levelColors';
import { colors, fonts, radius } from '../../theme';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Title } from '../ui/Title';
import { haptics } from '../../utils/haptics';
import { claimSwipe } from '../../navigation/swipeGuard';

interface Props {
  snapshot: FloorSnapshot;
  week: WeekForecast | null;
  alertOn: boolean;
  onToggleAlert: () => void;
  checkedIn: boolean;
  onScanOut: () => void;
  /** Owner setting: false = levels only, never a number of people. */
  showCounts: boolean;
  /** The member's usual training time (sign-up): shown as "Ton créneau" with how busy it usually is. */
  usualSlot?: TrainingTimeSlot;
  /** Placed inside the card, above and below the content (the flip card's switch and button). */
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
/** Hours of each training-time choice (same split as the sign-up cards). */
const SLOT_HOURS: Record<TrainingTimeSlot, [number, number]> = { morning: [6, 12], afternoon: [12, 17], evening: [17, 22] };
const LEVEL_RANK: Record<CrowdLevel, number> = { calme: 0, moyen: 1, plein: 2 };

/** How full the gym is, as a ring (design-ref Affluence). */
const RING = 124;
const RING_STROKE = 12;
const Ring: React.FC<{ fill: number; children: React.ReactNode }> = ({ fill, children }) => {
  const r = (RING - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: RING, height: RING }}>
      <Svg width={RING} height={RING}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={colors.track} strokeWidth={RING_STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={colors.brand}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * Math.max(0, Math.min(1, fill))} ${c}`}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">{children}</View>
    </View>
  );
};

/** A usual-crowd bar: light at the top, fading into the card (design-ref Affluence). */
const FadeBar: React.FC<{ id: string; opacity: number }> = ({ id, opacity }) => (
  <Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={colors.text} stopOpacity={0.9 * opacity} />
        <Stop offset="1" stopColor={colors.text} stopOpacity={0.12 * opacity} />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" rx="5" fill={`url(#${id})`} />
  </Svg>
);
/** When the club hides counts, the ring follows the level instead of the head count. */
const LEVEL_FILL = { calme: 0.33, moyen: 0.66, plein: 1 } as const;
const pad = (n: number) => String(n).padStart(2, '0');
const weekdayOf = (d: Date) => (d.getDay() + 6) % 7;

const PulseDot: React.FC<{ color: string }> = ({ color }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[
          styles.dotHalo,
          { backgroundColor: color, opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }] },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
};

/** Owner setting "affluence réservée aux membres": live crowd unlocks after a first scan at the entrance. */
export const FloorLocked: React.FC<{ gymName: string; onScan: () => void }> = ({ gymName, onScan }) => (
  <View style={[styles.card, styles.closed]}>
    <Icon name="lock-closed-outline" size={26} color={colors.textSecondary} />
    <Text style={styles.closedTitle}>Affluence réservée aux membres</Text>
    <Text style={[styles.closedSub, { textAlign: 'center' }]}>
      Scanne le QR à l’entrée {gymName ? `de ${gymName} ` : ''}une première fois : tu verras ensuite en direct quand c’est calme, zone par zone.
    </Text>
    <Pressable onPress={onScan} accessibilityRole="button" style={({ pressed }) => [styles.unlock, pressed && { opacity: 0.85 }]}>
      <Icon name="qr-code-outline" size={16} color={colors.white} />
      <Text style={styles.unlockText}>Scanner le QR d’entrée</Text>
    </Pressable>
  </View>
);

export const FloorLive: React.FC<Props> = ({ snapshot, week, alertOn, onToggleAlert, checkedIn, onScanOut, showCounts, usualSlot, header, footer }) => {
  const todayIndex = weekdayOf(snapshot.now);
  const [selDay, setSelDay] = useState(todayIndex);
  const [selHour, setSelHour] = useState<number | null>(null);

  const tint = levelTint(snapshot.level);
  const nowHour = snapshot.now.getHours();
  const live = snapshot.presentCount;

  // Selected day's usual curve (today falls back to the snapshot's own hourly while the week loads).
  const hourly = useMemo(() => {
    if (week?.byDay[selDay]) return week.byDay[selDay];
    return selDay === todayIndex ? snapshot.hourly : [];
  }, [week, selDay, todayIndex, snapshot.hourly]);

  const maxCount = useMemo(() => {
    const all = week ? Object.values(week.byDay).flat().map(h => h.count) : snapshot.hourly.map(h => h.count);
    return Math.max(1, ...all, live) * 1.05;
  }, [week, snapshot.hourly, live]);

  const isToday = selDay === todayIndex;

  // "vs usual" comparison, only meaningful while open with a usual baseline.
  const cmp = useMemo(() => {
    if (!snapshot.isOpen || snapshot.usualNow <= 0) return null;
    const r = live / snapshot.usualNow;
    if (r < 0.8) return { strong: 'Moins', rest: " de monde que d'habitude" };
    if (r > 1.2) return { strong: 'Plus', rest: " de monde que d'habitude" };
    return { strong: 'Comme', rest: " d'habitude" };
  }, [snapshot.isOpen, snapshot.usualNow, live]);

  // Best (calmest) remaining hour today.
  const bestLabel = useMemo(() => {
    if (snapshot.bestHour == null) return null;
    const h = snapshot.bestHour;
    const entry = snapshot.hourly.find(x => x.hour === h);
    const lvl = entry ? entry.level : 'calme';
    return `${h}h – ${h + 1}h · ${LEVEL_LABEL[lvl].toLowerCase()}`;
  }, [snapshot.bestHour, snapshot.hourly]);

  const selEntry = selHour != null ? hourly.find(h => h.hour === selHour) : null;

  const readout = useMemo(() => {
    if (selEntry) {
      const lvl = levelTint(selEntry.level);
      return (
        <Text style={styles.readout}>
          <Text style={styles.bold}>{selEntry.hour}h – {selEntry.hour + 1}h</Text> · habituellement{' '}
          <Text style={[styles.bold, { color: lvl.text }]}>{LEVEL_LABEL[selEntry.level].toLowerCase()}</Text>
          {showCounts ? ` · ~${selEntry.count} membres` : ''}
        </Text>
      );
    }
    if (isToday) {
      return showCounts ? (
        <Text style={styles.readout}>
          <Text style={styles.bold}>Maintenant</Text> · {live} membre{live > 1 ? 's' : ''} · d'habitude ~{snapshot.usualNow} à cette heure
        </Text>
      ) : (
        <Text style={styles.readout}>
          <Text style={styles.bold}>Maintenant</Text> · {cmp ? `${cmp.strong.toLowerCase()}${cmp.rest}` : 'touche une barre pour voir une heure'}
        </Text>
      );
    }
    if (hourly.length === 0) return <Text style={styles.readout}>Fermé ce jour-là.</Text>;
    const peak = hourly.reduce((a, b) => (b.count > a.count ? b : a), hourly[0]);
    return (
      <Text style={styles.readout}>
        <Text style={styles.bold}>{DAY_LABELS[selDay]}.</Text> · pic habituel vers <Text style={styles.bold}>{peak.hour}h</Text> · touche une barre
      </Text>
    );
  }, [selEntry, isToday, live, snapshot.usualNow, hourly, selDay, showCounts, cmp]);

  // When it's busy, the answer ("come at 15h") goes first, before the problem.
  const busy = snapshot.level !== 'calme';
  const [bestRange, bestLevel] = (bestLabel ?? '').split(' · ');
  const todayCurve = week?.byDay[todayIndex] ?? snapshot.hourly;
  const slot = usualSlot ? SLOT_HOURS[usualSlot] : null;
  const slotHours = slot ? todayCurve.filter(h => h.hour >= slot[0] && h.hour < slot[1]) : [];
  const slotLevel = slotHours.length ? slotHours.reduce((a, b) => (LEVEL_RANK[b.level] > LEVEL_RANK[a.level] ? b : a)).level : null;
  const bestBox = bestLabel ? (
    <View style={styles.tiles}>
      <View style={styles.tile} accessible accessibilityLabel={`${busy ? 'Plus calme aujourd’hui' : 'Meilleur créneau aujourd’hui'} : ${bestLabel}`}>
        <View style={styles.tileIc}>
          <Icon name="moon-outline" size={20} color={colors.brandText} />
        </View>
        <Text style={styles.tileValue}>{bestRange}</Text>
        <Text style={styles.tileLabel}>{busy ? 'Plus calme aujourd’hui' : 'Meilleur créneau aujourd’hui'}{bestLevel ? ` · ${bestLevel}` : ''}</Text>
      </View>
      {slot && slotLevel ? (
        <View style={styles.tile} accessible accessibilityLabel={`Ton créneau, ${slot[0]}h – ${slot[1]}h : souvent ${LEVEL_LABEL[slotLevel].toLowerCase()}`}>
          <View style={styles.tileIc}>
            <Icon name="time-outline" size={20} color={colors.brandText} />
          </View>
          <Text style={styles.tileValue}>{slot[0]}h – {slot[1]}h</Text>
          <Text style={styles.tileLabel}>Ton créneau · souvent {LEVEL_LABEL[slotLevel].toLowerCase()}</Text>
        </View>
      ) : (
        <Pressable
          onPress={onToggleAlert}
          accessibilityRole="button"
          accessibilityState={{ selected: alertOn }}
          style={({ pressed }) => [styles.tile, alertOn && styles.tileOn, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.tileIc, alertOn && { backgroundColor: colors.green.soft }]}>
            <Icon name={alertOn ? 'notifications' : 'notifications-outline'} size={20} color={alertOn ? colors.green.text : colors.brandText} />
          </View>
          <Text style={[styles.tileAction, alertOn && { color: colors.green.text }]}>{alertOn ? 'Alerte activée' : "M'alerter si calme"}</Text>
        </Pressable>
      )}
    </View>
  ) : null;

  if (!snapshot.isOpen) {
    return (
      <View style={[styles.card, styles.closed]}>
        <Icon name="moon-outline" size={26} color={colors.textSecondary} />
        <Text style={styles.closedTitle}>Fermé · ouvre à {snapshot.openingHour}h</Text>
        {snapshot.tomorrow?.bestHour != null && (
          <Text style={styles.closedSub}>Demain, plus calme vers {snapshot.tomorrow.bestHour}h</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {header}
      {/* Top: ring + live count (design-ref Affluence) */}
      <View style={styles.liveCard}>
        <Ring fill={showCounts ? live / Math.max(1, snapshot.capacity) : LEVEL_FILL[snapshot.level]}>
          {showCounts ? (
            <>
              <Text style={styles.ringPct}>{Math.round(Math.min(1, live / Math.max(1, snapshot.capacity)) * 100)}</Text>
              <Text style={styles.ringSub}>% rempli</Text>
            </>
          ) : (
            <Text style={[styles.ringWord, { color: tint.text }]}>{LEVEL_LABEL[snapshot.level]}</Text>
          )}
        </Ring>
        <View style={styles.liveInfo}>
          <View style={styles.tagRow}>
            <PulseDot color={colors.brand} />
            <Text style={styles.tag}>EN DIRECT · {pad(nowHour)}:{pad(snapshot.now.getMinutes())}</Text>
          </View>
          {showCounts ? (
            <>
              <View style={styles.countRow}>
                <Text style={styles.count}>{live}</Text>
                <Text style={styles.cap}>/ {snapshot.capacity}</Text>
              </View>
              <Text style={styles.unit}>membres sur le plateau</Text>
            </>
          ) : (
            <Text style={[styles.levelWord, { color: tint.text }]}>
              {LEVEL_LABEL[snapshot.level].charAt(0) + LEVEL_LABEL[snapshot.level].slice(1).toLowerCase()} en ce moment
            </Text>
          )}
          <View style={[styles.pill, { backgroundColor: tint.soft }]}>
            <Text style={[styles.pillText, { color: tint.text }]}>
              {LEVEL_LABEL[snapshot.level]}{cmp ? ` · ${cmp.strong}${cmp.rest}` : ''}
            </Text>
          </View>
        </View>
      </View>

      {busy && bestBox}

      {checkedIn && (
        <Pressable onPress={onScanOut} accessibilityRole="button" style={({ pressed }) => [styles.scanOut, pressed && { opacity: 0.85 }]}>
          <Icon name="log-out-outline" size={15} color={colors.text} />
          <Text style={styles.scanOutText}>Tu es là — terminer ma séance</Text>
        </Pressable>
      )}

      <View>
        <Title variant="section">{isToday ? 'Aujourd’hui' : DAY_FULL[selDay]}</Title>
        <Text style={styles.secSub}>Habituellement vs maintenant</Text>
      </View>

      {/* Day selector */}
      <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {DAY_LABELS.map((label, i) => {
          const on = selDay === i;
          return (
            <Pressable
              key={i}
              onPress={() => { haptics.select(); setSelDay(i); setSelHour(null); }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.dayChip, on && styles.dayChipOn]}
            >
              <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{i === todayIndex ? 'Auj.' : label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Readout */}
      <View style={styles.readoutWrap}>{readout}</View>

      {/* Chart */}
      <View style={styles.chartCard}>
      <View style={styles.chart}>
        {hourly.map(h => {
          const sel = selHour === h.hour;
          const past = isToday && h.hour < nowHour;
          const isNow = isToday && h.hour === nowHour;
          return (
            <Pressable
              key={h.hour}
              onPress={() => setSelHour(sel ? null : h.hour)}
              accessibilityRole="button"
              accessibilityLabel={showCounts ? `${h.hour}h, habituellement ${h.count} membres` : `${h.hour}h, habituellement ${LEVEL_LABEL[h.level].toLowerCase()}`}
              style={styles.barSlot}
            >
              <View style={styles.barTrack}>
                <View style={[styles.barUsual, { height: `${Math.max(2, (h.count / maxCount) * 100)}%` }, sel && { backgroundColor: colors.textMuted }]}>
                  {!sel && <FadeBar id={`bar-${selDay}-${h.hour}`} opacity={past ? 0.55 : 1} />}
                </View>
                {isNow && (
                  <View style={[styles.barNow, { height: `${Math.max(2, (live / maxCount) * 100)}%`, backgroundColor: colors.brand }]}>
                    {showCounts && <Text style={styles.barNowLabel} numberOfLines={1}>{live}</Text>}
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>6h</Text>
        <Text style={styles.axisText}>12h</Text>
        <Text style={styles.axisText}>18h</Text>
        <Text style={styles.axisText}>22h</Text>
      </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.textSecondary }]} /><Text style={styles.legendText}>Habituellement</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.brand }]} /><Text style={styles.legendText}>Maintenant</Text></View>
      </View>

      {/* Best slot + alert (already shown at the top when it's busy) */}
      {!busy && bestBox}
      {footer}
    </View>
  );
};

const styles = StyleSheet.create({
  // The view is a stack of sections (design-ref Affluence); the closed state keeps a card.
  card: { gap: 16 },
  closed: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg },
  closedTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  closedSub: { fontSize: 14, color: colors.textSecondary },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.brand, marginTop: 6 },
  unlockText: { color: colors.white, fontSize: 14, fontWeight: '800' },

  liveCard: { flexDirection: 'row', alignItems: 'center', gap: 18, padding: 18, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 34, lineHeight: 36, color: colors.text },
  ringSub: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  ringWord: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 18 },
  liveInfo: { flex: 1, gap: 6 },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tag: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: colors.textSecondary },
  dotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },

  countRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  count: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 52, lineHeight: 52, color: colors.brand },
  unit: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  levelWord: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 30, lineHeight: 32 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },

  cmp: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  cap: { fontSize: 16, color: colors.textSecondary, fontWeight: '700', marginBottom: 6 },
  bold: { fontWeight: '800', color: colors.text },

  scanOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 999, backgroundColor: colors.bg },
  scanOutText: { fontSize: 14, fontWeight: '700', color: colors.text },

  secSub: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginTop: 4 },

  days: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  dayChip: { height: 40, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  dayChipOn: { backgroundColor: colors.text, borderColor: colors.text },
  dayChipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  dayChipTextOn: { color: colors.onInverse },

  readoutWrap: { minHeight: 20 },
  readout: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  chartCard: { padding: 16, paddingTop: 22, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 150, paddingTop: 14 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barTrack: { height: '100%', justifyContent: 'flex-end', position: 'relative' },
  barUsual: { width: '100%', borderTopLeftRadius: 5, borderTopRightRadius: 5, overflow: 'hidden' },
  barNow: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 5, borderTopRightRadius: 5, alignItems: 'center' },
  barNowLabel: { position: 'absolute', top: -18, width: 40, textAlign: 'center', fontSize: 12, fontWeight: '800', color: colors.brandText },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  axisText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textSecondary },

  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, gap: 8, padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tileOn: { borderColor: colors.green.bar },
  tileIc: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 28, lineHeight: 30, color: colors.brandText },
  tileLabel: { fontSize: 13, fontWeight: '500', lineHeight: 18, color: colors.textSecondary },
  tileAction: { fontSize: 15, fontWeight: '800', lineHeight: 20, color: colors.text, marginTop: 6 },
});
