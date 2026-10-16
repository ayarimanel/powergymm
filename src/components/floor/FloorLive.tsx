import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { FloorSnapshot } from '../../floor/useFloorSnapshot';
import { TrainingTimeSlot } from '../../types/database';
import { WeekForecast } from '../../floor/useWeekForecast';
import { CrowdLevel, LEVEL_LABEL } from '../../floor/crowd';
import { levelTint } from '../../floor/levelColors';
import { colors, fonts, radius } from '../../theme';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
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
  const [menu, setMenu] = useState(false);

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

  const pct = Math.round(Math.min(1, live / Math.max(1, snapshot.capacity)) * 100);
  const peak = hourly.length ? hourly.reduce((x, y) => (y.count > x.count ? y : x), hourly[0]) : null;

  return (
    <View style={styles.card}>
      {header}

      {/* Stat tiles, 2 x 2 (dashboard layout): live, level, calmest hour, my slot */}
      <View style={styles.grid}>
        <StatTile icon="pulse-outline" label="En direct" live>
          <Text style={styles.statValue}>{showCounts ? live : LEVEL_LABEL[snapshot.level]}</Text>
          <Text style={styles.statSub}>{showCounts ? `sur ${snapshot.capacity} · ${pct} % rempli` : `à ${pad(nowHour)}:${pad(snapshot.now.getMinutes())}`}</Text>
        </StatTile>
        <StatTile icon="stats-chart-outline" label="Niveau">
          <Text style={[styles.statValue, { color: tint.text }]} numberOfLines={1}>{LEVEL_LABEL[snapshot.level].charAt(0) + LEVEL_LABEL[snapshot.level].slice(1).toLowerCase()}</Text>
          <Text style={styles.statSub}>{cmp ? `${cmp.strong}${cmp.rest}` : 'en ce moment'}</Text>
        </StatTile>
        {bestLabel ? (
          <StatTile icon="moon-outline" label={busy ? 'Plus calme' : 'Meilleur créneau'}>
            <Text style={styles.statValue} numberOfLines={1}>{bestRange}</Text>
            <Text style={styles.statSub}>aujourd’hui{bestLevel ? ` · ${bestLevel}` : ''}</Text>
          </StatTile>
        ) : null}
        {slot && slotLevel ? (
          <StatTile icon="time-outline" label="Ton créneau">
            <Text style={styles.statValue} numberOfLines={1}>{slot[0]}h – {slot[1]}h</Text>
            <Text style={styles.statSub}>souvent {LEVEL_LABEL[slotLevel].toLowerCase()}</Text>
          </StatTile>
        ) : (
          <Pressable
            onPress={onToggleAlert}
            accessibilityRole="button"
            accessibilityState={{ selected: alertOn }}
            style={({ pressed }) => [styles.stat, alertOn && styles.tileOn, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.statHead}>
              <View style={[styles.statIc, alertOn && { backgroundColor: colors.green.soft }]}>
                <Icon name={alertOn ? 'notifications' : 'notifications-outline'} size={20} color={alertOn ? colors.green.text : colors.brandText} />
              </View>
              <Text style={styles.statLabel}>Alerte</Text>
            </View>
            <Text style={[styles.tileAction, alertOn && { color: colors.green.text }]}>{alertOn ? 'Alerte activée' : "M'alerter si calme"}</Text>
          </Pressable>
        )}
      </View>

      {checkedIn && (
        <Pressable onPress={onScanOut} accessibilityRole="button" style={({ pressed }) => [styles.scanOut, pressed && { opacity: 0.85 }]}>
          <Icon name="log-out-outline" size={15} color={colors.text} />
          <Text style={styles.scanOutText}>Tu es là — terminer ma séance</Text>
        </Pressable>
      )}

      {/* "Habituellement" + day dropdown */}
      <View style={[styles.chartHead, { zIndex: 5 }]}>
        <Title variant="section" style={{ flexShrink: 1 }}>Habituellement</Title>
        <View>
          <Pressable onPress={() => setMenu(m => !m)} accessibilityRole="button" accessibilityLabel={`Jour : ${isToday ? 'aujourd’hui' : DAY_FULL[selDay]}`} style={styles.dayPick}>
            <Text style={styles.dayPickText}>{isToday ? 'Aujourd’hui' : DAY_FULL[selDay]}</Text>
            <Icon name={menu ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
          </Pressable>
          {menu && (
            <View style={styles.menu}>
              {DAY_LABELS.map((label, i) => {
                const on = selDay === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => { haptics.select(); setSelDay(i); setSelHour(null); setMenu(false); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.menuItem, on && styles.menuItemOn]}
                  >
                    <Text style={[styles.menuText, on && { color: colors.brandText }]}>{i === todayIndex ? 'Aujourd’hui' : DAY_FULL[i]}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Smooth area chart: the usual crowd hour by hour, a dot for now; touch an hour to read it */}
      <AreaChart
        hourly={hourly}
        maxCount={maxCount}
        nowHour={isToday ? nowHour : null}
        live={live}
        showCounts={showCounts}
        selHour={selHour}
        onHour={h => setSelHour(selHour === h ? null : h)}
      />
      <View style={styles.readoutWrap}>{readout}</View>

      {/* Repères */}
      <Title variant="section">Repères</Title>
      {peak ? (
        <Insight icon="trending-up-outline" label={`Pic habituel · ${isToday ? 'aujourd’hui' : DAY_FULL[selDay].toLowerCase()}`} value={`Vers ${peak.hour}h${showCounts ? ` · ~${peak.count} membres` : ''}`} />
      ) : null}
      {isToday && (
        <Insight
          icon="people-outline"
          label="Maintenant"
          value={showCounts ? `${live} membre${live > 1 ? 's' : ''} · d’habitude ~${snapshot.usualNow}` : cmp ? `${cmp.strong}${cmp.rest}` : LEVEL_LABEL[snapshot.level]}
        />
      )}

      {footer}
    </View>
  );
};

/** One dashboard tile: icon in a small square + label, then the value and its caption. */
const StatTile: React.FC<{ icon: string; label: string; live?: boolean; children: React.ReactNode }> = ({ icon, label, live, children }) => (
  <View style={styles.stat} accessible>
    <View style={styles.statHead}>
      <View style={styles.statIc}>
        {live ? <PulseDot color={colors.brand} /> : <Icon name={icon as any} size={20} color={colors.brandText} />}
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
    {children}
  </View>
);

/** A "Repères" row: icon square, small caption, bold value. */
const Insight: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.insight} accessible accessibilityLabel={`${label} : ${value}`}>
    <View style={styles.insightIc}>
      <Icon name={icon as any} size={22} color={colors.brandText} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={styles.insightValue}>{value}</Text>
    </View>
  </View>
);

const CHART_H = 200;
/** Smooth line through the points (Catmull-Rom turned into cubic curves). */
const smoothPath = (pts: { x: number; y: number }[]) => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
};

const AreaChart: React.FC<{
  hourly: { hour: number; count: number; level: CrowdLevel }[];
  maxCount: number;
  nowHour: number | null;
  live: number;
  showCounts: boolean;
  selHour: number | null;
  onHour: (h: number) => void;
}> = ({ hourly, maxCount, nowHour, live, showCounts, selHour, onHour }) => {
  const [w, setW] = useState(0);
  const left = showCounts ? 28 : 6;
  const top = 26;
  const plotW = Math.max(1, w - left - 8);
  const n = hourly.length;
  const xAt = (i: number) => left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => top + (1 - Math.min(1, v / maxCount)) * (CHART_H - top - 6);
  const pts = hourly.map((h, i) => ({ x: xAt(i), y: yAt(h.count) }));
  const line = smoothPath(pts);
  const area = pts.length > 1 ? `${line} L ${pts[pts.length - 1].x} ${CHART_H} L ${pts[0].x} ${CHART_H} Z` : '';
  const nowIdx = nowHour != null ? hourly.findIndex(h => h.hour === nowHour) : -1;
  const selIdx = selHour != null ? hourly.findIndex(h => h.hour === selHour) : -1;
  const ticks = [0, 0.5, 1].map(f => Math.round((maxCount / 1.05) * f));

  return (
    <View style={styles.chartCard} onLayout={e => setW(e.nativeEvent.layout.width - 32)}>
      {n === 0 ? (
        <Text style={styles.readout}>Fermé ce jour-là.</Text>
      ) : w > 0 ? (
        <View style={{ height: CHART_H }}>
          <Svg width={w} height={CHART_H}>
            <Defs>
              <LinearGradient id="crowdFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.brand} stopOpacity={0.28} />
                <Stop offset="1" stopColor={colors.brand} stopOpacity={0.04} />
              </LinearGradient>
            </Defs>
            {showCounts && ticks.map(t => (
              <Line key={t} x1={left} x2={left + plotW} y1={yAt(t)} y2={yAt(t)} stroke={colors.divider} strokeWidth={1} />
            ))}
            {showCounts && ticks.map(t => (
              <SvgText key={`l${t}`} x={0} y={yAt(t) + 4} fontSize={11} fill={colors.textMuted}>{String(t)}</SvgText>
            ))}
            <Path d={area} fill="url(#crowdFill)" />
            <Path d={line} stroke={colors.brand} strokeWidth={3} fill="none" strokeLinecap="round" />
            {selIdx >= 0 && <Line x1={xAt(selIdx)} x2={xAt(selIdx)} y1={top} y2={CHART_H} stroke={colors.textMuted} strokeWidth={1} strokeDasharray="4 4" />}
            {selIdx >= 0 && <Circle cx={xAt(selIdx)} cy={pts[selIdx].y} r={6} fill={colors.card} stroke={colors.text} strokeWidth={2.5} />}
            {nowIdx >= 0 && <Circle cx={xAt(nowIdx)} cy={yAt(live)} r={7} fill={colors.card} stroke={colors.brand} strokeWidth={3} />}
            {nowIdx >= 0 && showCounts && (
              <SvgText x={xAt(nowIdx)} y={yAt(live) - 13} fontSize={13} fontWeight="800" fill={colors.brandText} textAnchor="middle">{String(live)}</SvgText>
            )}
          </Svg>
          {/* Touch areas: one column per hour */}
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', left: left - plotW / Math.max(1, n - 1) / 2, right: 8 - plotW / Math.max(1, n - 1) / 2 }]}>
            {hourly.map(h => (
              <Pressable
                key={h.hour}
                onPress={() => onHour(h.hour)}
                accessibilityRole="button"
                accessibilityLabel={showCounts ? `${h.hour}h, habituellement ${h.count} membres` : `${h.hour}h, habituellement ${LEVEL_LABEL[h.level].toLowerCase()}`}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={{ height: CHART_H }} />
      )}
      <View style={[styles.axis, { paddingLeft: left - 6 }]}>
        <Text style={styles.axisText}>6h</Text>
        <Text style={styles.axisText}>10h</Text>
        <Text style={styles.axisText}>14h</Text>
        <Text style={styles.axisText}>18h</Text>
        <Text style={styles.axisText}>22h</Text>
      </View>
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

  chartCard: { padding: 16, paddingTop: 12, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 230, paddingTop: 22 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barTrack: { height: '100%', justifyContent: 'flex-end', position: 'relative' },
  barUsual: { width: '100%', borderTopLeftRadius: 5, borderTopRightRadius: 5, overflow: 'hidden' },
  barNow: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 5, borderTopRightRadius: 5, alignItems: 'center' },
  barNowLabel: { position: 'absolute', left: -16, right: -16, marginBottom: 4, textAlign: 'center', fontSize: 14, fontWeight: '800', color: colors.brandText },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  axisText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textSecondary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { width: '47.8%', flexGrow: 1, gap: 6, padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  statIc: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' },
  statLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  statValue: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 30, lineHeight: 32, color: colors.text },
  statSub: { fontSize: 12, fontWeight: '500', lineHeight: 16, color: colors.textMuted },

  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  dayPick: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  dayPickText: { fontSize: 14, fontWeight: '700', color: colors.text },
  menu: { position: 'absolute', top: 44, right: 0, width: 170, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.page, borderWidth: 1, borderColor: colors.divider, shadowColor: colors.black, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  menuItem: { paddingVertical: 10, paddingHorizontal: 16 },
  menuItemOn: { backgroundColor: colors.brandSoft },
  menuText: { fontSize: 14, fontWeight: '700', color: colors.text },

  insight: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  insightIc: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' },
  insightLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  insightValue: { fontSize: 16, fontWeight: '800', color: colors.text },

  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, gap: 8, padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tileOn: { borderColor: colors.green.bar },
  tileIc: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 28, lineHeight: 30, color: colors.brandText },
  tileLabel: { fontSize: 13, fontWeight: '500', lineHeight: 18, color: colors.textSecondary },
  tileAction: { fontSize: 15, fontWeight: '800', lineHeight: 20, color: colors.text, marginTop: 6 },
});
