import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { LiveFloorSummary } from '../../services/liveFloorEngine';
import { card, colors, ink } from '../../theme';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import {
  CLUB_LEVEL_LABEL,
  bestWindow,
  clubLevel,
  openingHoursBars,
  pad,
  quietestZones,
} from '../../services/floorViewModel';

interface Props {
  floor: LiveFloorSummary | null; // null → skeleton
  onOpenMuscles: () => void;
  onScan: () => void;
  onOpenAdmin?: () => void;
}

const PLOT_H = 120;
const Y_LABELS = [
  { label: 'Plein', at: 1 },
  { label: 'Moyen', at: 0.5 },
  { label: 'Faible', at: 0 },
];

// ---------- Small pieces ----------

const PulsingDot: React.FC<{ color: string; pulse?: boolean }> = ({ color, pulse = true }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, anim]);
  return (
    <View style={styles.dotWrap}>
      {pulse && (
        <Animated.View
          style={[
            styles.dotHalo,
            {
              backgroundColor: color,
              opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
            },
          ]}
        />
      )}
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
};

const Skeleton: React.FC<{ style?: any }> = ({ style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={[styles.skeleton, style, { opacity: anim }]} />;
};

// ---------- Card ----------

type ChartMode = 'line' | 'bars';
const CHART_MODE_KEY = '@gym_app_floor_chart_mode_v1';

/** Small segmented switch: Courbe / Barres. */
const ChartToggle: React.FC<{ mode: ChartMode; onChange: (m: ChartMode) => void }> = ({ mode, onChange }) => (
  <View style={styles.toggle} accessibilityRole="tablist">
    {(
      [
        ['line', 'Courbe', 'trending-up'],
        ['bars', 'Barres', 'bar-chart'],
      ] as const
    ).map(([id, label, icon]) => {
      const on = mode === id;
      return (
        <Pressable
          key={id}
          onPress={() => onChange(id)}
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityRole="tab"
          accessibilityState={{ selected: on }}
          accessibilityLabel={`Afficher en ${label.toLowerCase()}`}
          style={[styles.toggleBtn, on && styles.toggleBtnOn]}
        >
          <Ionicons name={icon} size={15} color={on ? colors.text : colors.textMuted} />
          <Text style={[styles.toggleText, on && { color: colors.text }]}>{label}</Text>
        </Pressable>
      );
    })}
  </View>
);

export const FloorActivityCard: React.FC<Props> = ({ floor, onOpenMuscles, onScan, onOpenAdmin }) => {
  const [mode, setMode] = useState<ChartMode>('line');
  useEffect(() => {
    AsyncStorage.getItem(CHART_MODE_KEY)
      .then(v => (v === 'bars' || v === 'line') && setMode(v))
      .catch(() => {});
  }, []);
  const changeMode = (m: ChartMode) => {
    setMode(m);
    AsyncStorage.setItem(CHART_MODE_KEY, m).catch(() => {});
  };

  if (!floor) {
    return (
      <View style={styles.card}>
        <Skeleton style={{ width: 170, height: 28, borderRadius: 14 }} />
        <Skeleton style={{ width: 200, height: 48, marginTop: 18 }} />
        <Skeleton style={{ height: PLOT_H, marginTop: 20, borderRadius: 12 }} />
        <Skeleton style={{ width: '70%', height: 18, marginTop: 16 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Skeleton style={{ width: 90, height: 32, borderRadius: 16 }} />
          <Skeleton style={{ width: 90, height: 32, borderRadius: 16 }} />
          <Skeleton style={{ width: 90, height: 32, borderRadius: 16 }} />
        </View>
      </View>
    );
  }

  const { isOpen, openingHour, closingHour, currentOccupancyCount, occupancyPercentage } = floor;
  const bars = openingHoursBars(floor.hourlyData, closingHour);
  const level = clubLevel(occupancyPercentage);
  const lc = colors[level];
  const best = bestWindow(bars, new Date().getHours(), isOpen);
  const quiet = quietestZones(floor.muscleBreakdown);

  return (
    <View style={styles.card}>
      {/* Status row */}
      <View style={styles.topRow}>
        <View style={[styles.statusPill, { backgroundColor: isOpen ? colors.green.soft : colors.red.soft }]}>
          <PulsingDot color={isOpen ? colors.green.bar : colors.red.bar} pulse={isOpen} />
          <Text style={[styles.statusText, { color: isOpen ? colors.green.text : colors.red.text }]}>
            {isOpen ? `Ouvert · ferme à ${pad(closingHour)}` : `Fermé · ouvre à ${pad(openingHour)}`}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {onOpenAdmin && (
          <Pressable
            onPress={onOpenAdmin}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Paramètres du club"
            style={styles.adminBtn}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
        <Pressable
          onPress={onScan}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Scanner le QR code"
          style={({ pressed }) => [styles.scanBtn, pressed && { backgroundColor: colors.track }]}
        >
          <Ionicons name="qr-code-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Hero */}
      {isOpen ? (
        <View style={styles.heroRow} accessible accessibilityLabel={`${currentOccupancyCount} membres maintenant, ${CLUB_LEVEL_LABEL[level]}`}>
          <Text style={styles.heroNumber}>{currentOccupancyCount}</Text>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.heroLabel}>{currentOccupancyCount > 1 ? 'membres' : 'membre'} maintenant</Text>
            <View style={[styles.levelChip, { backgroundColor: lc.soft }]}>
              <View style={[styles.levelDot, { backgroundColor: lc.bar }]} />
              <Text style={[styles.levelChipText, { color: lc.text }]}>{CLUB_LEVEL_LABEL[level]}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.closedBox}>
          <Ionicons name="moon-outline" size={22} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.closedTitle}>Le club est fermé · ouvre à {pad(openingHour)}</Text>
            <Text style={styles.closedSub}>Voici l’affluence habituelle d’une journée.</Text>
          </View>
        </View>
      )}

      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>{isOpen ? 'Affluence aujourd’hui' : 'Affluence habituelle'}</Text>
        <ChartToggle mode={mode} onChange={changeMode} />
      </View>

      {mode === 'line' ? (
        <LineChart points={floor.hourlyData} openingHour={openingHour} closingHour={closingHour} isOpen={isOpen} />
      ) : (
        <BarChart points={floor.hourlyData} openingHour={openingHour} closingHour={closingHour} isOpen={isOpen} />
      )}

      {best && (
        <View style={styles.bestRow}>
          <Ionicons name="time-outline" size={18} color={colors[best.level].text} />
          <Text style={styles.bestText}>
            {isOpen ? 'Meilleur moment aujourd’hui' : 'Meilleur moment habituel'} :{' '}
            <Text style={{ fontWeight: '800', color: colors.text }}>
              {best.from}–{best.to}
            </Text>{' '}
            <Text style={{ color: colors[best.level].text, fontWeight: '700' }}>
              ({CLUB_LEVEL_LABEL[best.level].toLowerCase()})
            </Text>
          </Text>
        </View>
      )}

      {/* 3 quietest zones → opens the Muscle Live sheet */}
      {isOpen && (
        <Pressable
          onPress={onOpenMuscles}
          accessibilityRole="button"
          accessibilityLabel="Voir toutes les zones en direct"
          style={({ pressed }) => [styles.chipsRow, pressed && { opacity: 0.7 }]}
        >
          {quiet.map(z => (
            <View key={z.muscleGroup} style={styles.chip}>
              <Text style={styles.chipText}>
                {z.label} <Text style={{ fontWeight: '800', color: colors.green.text }}>{z.percentage}%</Text>
              </Text>
            </View>
          ))}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { ...card, padding: 16 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
    paddingRight: 12,
    height: 30,
    borderRadius: 15,
  },
  statusText: { fontSize: 13, fontWeight: '700' },
  scanBtn: { width: 44, height: 44, marginVertical: -7, marginRight: -6, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  adminBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  dotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },

  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, marginBottom: 14 },
  heroNumber: { fontSize: 56, lineHeight: 60, fontWeight: '800', color: colors.text },
  heroLabel: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelDot: { width: 8, height: 8, borderRadius: 4 },
  levelChipText: { fontSize: 13, fontWeight: '800' },

  closedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  closedTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  closedSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  markerRow: { flexDirection: 'row', height: 24, marginTop: 4 },
  yAxisSpacer: { width: 46 },
  nowTag: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: 10,
    paddingVertical: 3,
  },
  nowTagText: { color: colors.onInverse, fontSize: 11, fontWeight: '800' },

  chartRow: { flexDirection: 'row' },
  yAxis: { width: 46 },
  yLabel: { position: 'absolute', left: 0, fontSize: 11, lineHeight: 16, color: colors.textMuted, fontWeight: '600' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.track },
  nowLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: ink(0.25) },
  barsRow: { flexDirection: 'row', height: '100%', alignItems: 'flex-end' },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  xAxis: { height: 20, marginTop: 6 },
  xLabel: { position: 'absolute', width: 34, textAlign: 'center', fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  bestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  bestText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.track,
  },
  chip: {
    paddingHorizontal: 10,
    height: 32,
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  toggle: { flexDirection: 'row', backgroundColor: colors.track, borderRadius: 16, padding: 2 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 10, borderRadius: 14 },
  toggleBtnOn: { backgroundColor: colors.card, shadowColor: colors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  toggleText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },

  skeleton: { backgroundColor: colors.track, borderRadius: 8 },
});
