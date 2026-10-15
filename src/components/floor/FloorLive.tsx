import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { FloorSnapshot } from '../../floor/useFloorSnapshot';
import { WeekForecast } from '../../floor/useWeekForecast';
import { LEVEL_LABEL } from '../../floor/crowd';
import { levelTint } from '../../floor/levelColors';
import { card, colors } from '../../theme';
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
  /** Placed inside the card, above and below the content (the flip card's switch and button). */
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
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

export const FloorLive: React.FC<Props> = ({ snapshot, week, alertOn, onToggleAlert, checkedIn, onScanOut, showCounts, header, footer }) => {
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
  const bestBox = bestLabel ? (
    <View style={styles.best}>
      <View style={{ flex: 1 }}>
        <Text style={styles.bestLabel}>{busy ? 'Plus calme aujourd’hui' : 'Meilleur créneau aujourd’hui'}</Text>
        <Text style={styles.bestValue}>{bestLabel}</Text>
      </View>
      <Pressable
        onPress={onToggleAlert}
        accessibilityRole="button"
        style={({ pressed }) => [styles.alertBtn, alertOn ? styles.alertBtnOn : styles.alertBtnGhost, pressed && { opacity: 0.85 }]}
      >
        <Icon name={alertOn ? 'notifications' : 'notifications-outline'} size={15} color={alertOn ? colors.green.text : colors.brand} />
        <Text style={[styles.alertText, { color: alertOn ? colors.green.text : colors.brand }]}>{alertOn ? 'Alerte activée' : "M'alerter si calme"}</Text>
      </Pressable>
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
      {/* Top: live tag + status pill */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.tagRow}>
            <PulseDot color={tint.bar} />
            <Text style={styles.tag}>EN DIRECT · {pad(nowHour)}:{pad(snapshot.now.getMinutes())}</Text>
          </View>
          <View style={styles.countRow}>
            {showCounts ? (
              <>
                <Text style={styles.count}>{live}</Text>
                <Text style={styles.unit}>membres{'\n'}sur le plateau</Text>
              </>
            ) : (
              <>
                <Text style={[styles.count, styles.levelWord, { color: tint.text }]}>{LEVEL_LABEL[snapshot.level].charAt(0) + LEVEL_LABEL[snapshot.level].slice(1).toLowerCase()}</Text>
                <Text style={styles.unit}>en ce{'\n'}moment</Text>
              </>
            )}
          </View>
        </View>
        {showCounts && (
          <View style={[styles.pill, { backgroundColor: tint.soft }]}>
            <Text style={[styles.pillText, { color: tint.text }]}>{LEVEL_LABEL[snapshot.level]}</Text>
          </View>
        )}
      </View>

      {/* Gauge */}
      <View style={styles.gaugeWrap}>
        <View style={styles.gauge}>
          <View style={[styles.gaugeFill, { width: `${Math.min(100, (live / snapshot.capacity) * 100)}%`, backgroundColor: tint.bar }]} />
        </View>
        <View style={styles.gaugeLabels}>
          <Text style={styles.cmp}>
            {cmp ? (<><Text style={styles.bold}>{cmp.strong}</Text>{cmp.rest}</>) : ' '}
          </Text>
          {showCounts && <Text style={styles.cap}>{live} / {snapshot.capacity} places</Text>}
        </View>
      </View>

      {busy && bestBox}

      {checkedIn && (
        <Pressable onPress={onScanOut} accessibilityRole="button" style={({ pressed }) => [styles.scanOut, pressed && { opacity: 0.85 }]}>
          <Icon name="log-out-outline" size={15} color={colors.text} />
          <Text style={styles.scanOutText}>Tu es là — terminer ma séance</Text>
        </Pressable>
      )}

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
                <View
                  style={[
                    styles.barUsual,
                    { height: `${Math.max(2, (h.count / maxCount) * 100)}%`, opacity: past ? 0.5 : 1 },
                    sel && { backgroundColor: colors.textMuted },
                  ]}
                />
                {isNow && (
                  <View style={[styles.barNow, { height: `${Math.max(2, (live / maxCount) * 100)}%`, backgroundColor: colors.brand }]} />
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

      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.pastBar }]} /><Text style={styles.legendText}>Habituellement</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.brand }]} /><Text style={styles.legendText}>Maintenant</Text></View>
      </View>

      {/* Best slot + alert (already shown at the top when it's busy) */}
      {!busy && bestBox}
      {footer}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { ...card, borderRadius: 24, padding: 16, gap: 14 },
  closed: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 28 },
  closedTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  closedSub: { fontSize: 14, color: colors.textSecondary },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.brand, marginTop: 6 },
  unlockText: { color: colors.white, fontSize: 14, fontWeight: '800' },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tag: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.textMuted },
  dotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },

  countRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 },
  count: { fontSize: 54, lineHeight: 52, fontWeight: '900', color: colors.text },
  unit: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  levelWord: { fontSize: 40, lineHeight: 44 },
  pill: { paddingHorizontal: 14, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 13, fontWeight: '800' },

  gaugeWrap: { gap: 5 },
  gauge: { height: 8, borderRadius: 99, backgroundColor: colors.track, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 99 },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  cmp: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  cap: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  bold: { fontWeight: '800', color: colors.text },

  scanOut: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.track },
  scanOutText: { fontSize: 12, fontWeight: '800', color: colors.text },

  days: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  dayChip: { height: 30, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  dayChipOn: { backgroundColor: colors.text, borderColor: colors.text },
  dayChipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  dayChipTextOn: { color: colors.card },

  readoutWrap: { minHeight: 20 },
  readout: { fontSize: 13, color: colors.textSecondary },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 110, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 6 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barTrack: { height: '100%', justifyContent: 'flex-end', position: 'relative' },
  barUsual: { width: '100%', backgroundColor: colors.pastBar, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  barNow: { position: 'absolute', left: '18%', right: '18%', bottom: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11, color: colors.textMuted },

  best: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg, borderRadius: 14, padding: 12 },
  bestLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  bestValue: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 2 },
  alertBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 12 },
  alertBtnGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  alertBtnOn: { backgroundColor: colors.green.soft },
  alertText: { fontSize: 12, fontWeight: '800' },
});
