import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { HourlyOccupancy } from '../../types/database';
import { colors, ink } from '../../theme';
import { CLUB_LEVEL_LABEL, clubLevel } from '../../services/floorViewModel';
import { claimSwipe } from '../../navigation/swipeGuard';

interface Props {
  /** One point per hour from opening to closing (inclusive); the closing hour itself has no bar. */
  points: HourlyOccupancy[];
  openingHour: number;
  closingHour: number;
  isOpen: boolean;
}

// Same geometry as LineChart so switching modes keeps everything aligned
const H = 140;
const PAD_T = 10;
const PAD_B = 4;
const AXIS_W = 46;
const TAG_W = 84;
const LABEL_W = 34;

const yOf = (pct: number) => PAD_T + (1 - Math.min(100, Math.max(0, pct)) / 100) * (H - PAD_T - PAD_B);
const Y_LABELS = [
  { label: 'Plein', at: 100 },
  { label: 'Moyen', at: 50 },
  { label: 'Faible', at: 0 },
];
const hh = (h: number) => `${String(h).padStart(2, '0')}h`;

/** Hourly bars: past = grey, current = full colour, forecast = lighter. Touch a bar to read it. */
export const BarChart: React.FC<Props> = ({ points, closingHour, isOpen }) => {
  const bars = useMemo(() => points.filter(p => p.hour < closingHour), [points, closingHour]);
  const n = bars.length;
  const [W, setW] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slot = W / Math.max(1, n);
  const currentIdx = isOpen ? bars.findIndex(b => b.isCurrentHour) : -1;
  const clampLeft = (x: number, w: number) => Math.max(0, Math.min(W - w, x - w / 2));
  const centerOf = (i: number) => i * slot + slot / 2;

  const setFromX = (x: number) => {
    if (W <= 0) return;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setScrub(Math.max(0, Math.min(n - 1, Math.floor(x / slot))));
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: e => {
          claimSwipe();
          setFromX(e.nativeEvent.locationX);
        },
        onPanResponderMove: e => setFromX(e.nativeEvent.locationX),
        onPanResponderRelease: () => {
          clearTimer.current = setTimeout(() => setScrub(null), 1800);
        },
        onPanResponderTerminate: () => setScrub(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [W, n, slot]
  );

  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const sp = scrub !== null ? bars[scrub] : null;

  return (
    <View accessible accessibilityLabel={`Affluence par heure de ${hh(bars[0]?.hour ?? 6)} à ${hh(closingHour)}. Touche une barre pour lire l’heure.`}>
      {/* Tooltip / "Maintenant" row */}
      <View style={styles.tagRow}>
        <View style={{ width: AXIS_W }} />
        <View style={{ flex: 1 }}>
          {sp && scrub !== null ? (
            <View style={[styles.bubble, { left: clampLeft(centerOf(scrub), 178), width: 178 }]}>
              <View style={[styles.bubbleDot, { backgroundColor: colors[clubLevel(sp.percentage)].bar }]} />
              <Text style={styles.bubbleText} numberOfLines={1}>
                {hh(sp.hour)} · {CLUB_LEVEL_LABEL[clubLevel(sp.percentage)]} · ~{sp.occupancyCount}
              </Text>
            </View>
          ) : (
            currentIdx >= 0 &&
            W > 0 && (
              <View style={[styles.nowTag, { left: clampLeft(centerOf(currentIdx), TAG_W), width: TAG_W }]}>
                <Text style={styles.nowTagText}>Maintenant</Text>
              </View>
            )
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: AXIS_W, height: H }}>
          {Y_LABELS.map(y => (
            <Text key={y.label} style={[styles.yLabel, { top: yOf(y.at) - 8 }]}>
              {y.label}
            </Text>
          ))}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ height: H }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
            {Y_LABELS.map(y => (
              <View key={y.label} style={[styles.grid, { top: yOf(y.at) }]} />
            ))}

            {currentIdx >= 0 && W > 0 && <View style={[styles.nowLine, { left: centerOf(currentIdx) - 0.5 }]} />}

            {W > 0 &&
              bars.map((b, i) => {
                const level = clubLevel(b.percentage);
                const isNow = i === currentIdx;
                const isPast = isOpen && currentIdx >= 0 && i < currentIdx;
                const height = Math.max(4, yOf(0) - yOf(b.percentage));
                const picked = scrub === i;
                return (
                  <View
                    key={b.hour}
                    style={{
                      position: 'absolute',
                      left: i * slot + slot * 0.14,
                      width: slot * 0.72,
                      bottom: PAD_B,
                      height,
                      borderRadius: 4,
                      backgroundColor: isPast ? colors.pastBar : colors[level].bar,
                      opacity: picked || isNow || isPast ? 1 : 0.45,
                      borderWidth: picked ? 2 : 0,
                      borderColor: colors.text,
                    }}
                  />
                );
              })}

            {/* touch layer */}
            <View style={StyleSheet.absoluteFill as any} {...pan.panHandlers} />
          </View>

          {/* X axis (time) */}
          <View style={styles.xAxis}>
            {W > 0 &&
              bars.map((b, i) => {
                if (i % 4 !== 0) return null;
                const x = centerOf(i);
                if (currentIdx >= 0 && Math.abs(x - centerOf(currentIdx)) < 34) return null;
                return (
                  <Text key={b.hour} style={[styles.xLabel, i === 0 ? { left: 0, textAlign: 'left' } : { left: x - LABEL_W / 2, textAlign: 'center' }]}>
                    {hh(b.hour)}
                  </Text>
                );
              })}
            <Text style={[styles.xLabel, { right: 0, textAlign: 'right' }]}>{hh(closingHour)}</Text>
            {W > 0 && currentIdx >= 0 && (
              <View style={[styles.clock, { left: clampLeft(centerOf(currentIdx), 50), width: 50 }]}>
                <Text style={styles.clockText}>{nowHHMM}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tagRow: { flexDirection: 'row', height: 30, marginTop: 4 },
  nowTag: { position: 'absolute', top: 0, alignItems: 'center', backgroundColor: colors.text, borderRadius: 10, paddingVertical: 3 },
  nowTagText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  bubble: {
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  bubbleDot: { width: 8, height: 8, borderRadius: 4 },
  bubbleText: { color: colors.white, fontSize: 12, fontWeight: '800' },

  yLabel: { position: 'absolute', left: 0, fontSize: 12, lineHeight: 16, color: colors.textMuted, fontWeight: '600' },
  grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.track },
  nowLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: ink(0.25) },
  xAxis: { height: 26, marginTop: 6 },
  xLabel: { position: 'absolute', top: 3, width: LABEL_W, fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  clock: { position: 'absolute', top: 0, height: 22, borderRadius: 11, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  clockText: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
