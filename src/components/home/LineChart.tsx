import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import Svg, { Circle, ClipPath, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { HourlyOccupancy } from '../../types/database';
import { colors, ink } from '../../theme';
import { CLUB_LEVEL_LABEL, clubLevel } from '../../services/floorViewModel';
import { claimSwipe } from '../../navigation/swipeGuard';

interface Props {
  /** One point per hour from opening to closing (inclusive). */
  points: HourlyOccupancy[];
  openingHour: number;
  closingHour: number;
  isOpen: boolean;
}

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

type Seg = { x0: number; y0: number; c1x: number; c1y: number; c2x: number; c2y: number; x1: number; y1: number };

/** Monotone cubic interpolation: smooth curve that never overshoots the data. */
const monotone = (xs: number[], ys: number[]): Seg[] => {
  const n = xs.length;
  if (n < 2) return [];
  const dx: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    s.push((ys[i + 1] - ys[i]) / dx[i]);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = s[0];
  m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / s[i];
      const b = m[i + 1] / s[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * a * s[i];
        m[i + 1] = t * b * s[i];
      }
    }
  }
  return xs.slice(0, -1).map((x0, i) => ({
    x0,
    y0: ys[i],
    c1x: x0 + dx[i] / 3,
    c1y: ys[i] + (m[i] * dx[i]) / 3,
    c2x: xs[i + 1] - dx[i] / 3,
    c2y: ys[i + 1] - (m[i + 1] * dx[i]) / 3,
    x1: xs[i + 1],
    y1: ys[i + 1],
  }));
};

const pathOf = (segs: Seg[]) =>
  segs.length ? `M ${segs[0].x0} ${segs[0].y0} ` + segs.map(s => `C ${s.c1x} ${s.c1y} ${s.c2x} ${s.c2y} ${s.x1} ${s.y1}`).join(' ') : '';

/** Point on the curve at fractional index f (0 … n-1). */
const evalAt = (segs: Seg[], f: number) => {
  const i = Math.max(0, Math.min(segs.length - 1, Math.floor(f)));
  const t = Math.max(0, Math.min(1, f - i));
  const s = segs[i];
  const u = 1 - t;
  return {
    x: u * u * u * s.x0 + 3 * u * u * t * s.c1x + 3 * u * t * t * s.c2x + t * t * t * s.x1,
    y: u * u * u * s.y0 + 3 * u * u * t * s.c1y + 3 * u * t * t * s.c2y + t * t * t * s.y1,
  };
};

const hh = (h: number) => `${String(h).padStart(2, '0')}h`;

export const LineChart: React.FC<Props> = ({ points, openingHour, closingHour, isOpen }) => {
  const [W, setW] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const n = points.length;

  const geom = useMemo(() => {
    if (W <= 0 || n < 2) return null;
    const xs = points.map((_, i) => (i / (n - 1)) * W);
    const ys = points.map(p => yOf(p.percentage));
    const segs = monotone(xs, ys);
    const line = pathOf(segs);
    const area = `${line} L ${W} ${yOf(0)} L 0 ${yOf(0)} Z`;
    return { xs, ys, segs, line, area };
  }, [W, points, n]);

  const now = new Date();
  const nowF = now.getHours() + now.getMinutes() / 60 - openingHour;
  const showNow = isOpen && nowF >= 0 && nowF <= n - 1;
  const nowPt = geom && showNow ? evalAt(geom.segs, nowF) : null;
  const nowPct = showNow && geom ? points[Math.min(n - 1, Math.round(nowF))].percentage : 0;

  // Touch / drag to read a specific hour
  const setFromX = (x: number) => {
    if (W <= 0) return;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setScrub(Math.max(0, Math.min(n - 1, Math.round((x / W) * (n - 1)))));
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
    [W, n]
  );

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const sp = scrub !== null && geom ? { p: points[scrub], x: geom.xs[scrub], y: geom.ys[scrub] } : null;
  const clampLeft = (x: number, w: number) => Math.max(0, Math.min(W - w, x - w / 2));

  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const labelIdx = points.map((_, i) => i).filter(i => i % 4 === 0);

  return (
    <View accessible accessibilityLabel={`Courbe d’affluence de ${hh(openingHour)} à ${hh(closingHour)}. Touche pour lire une heure.`}>
      {/* Tooltip / "Maintenant" row */}
      <View style={styles.tagRow}>
        <View style={{ width: AXIS_W }} />
        <View style={{ flex: 1 }}>
          {sp ? (
            <View style={[styles.bubble, { left: clampLeft(sp.x, 178), width: 178 }]}>
              <View style={[styles.bubbleDot, { backgroundColor: colors[clubLevel(sp.p.percentage)].bar }]} />
              <Text style={styles.bubbleText} numberOfLines={1}>
                {hh(sp.p.hour)} · {CLUB_LEVEL_LABEL[clubLevel(sp.p.percentage)]} · ~{sp.p.occupancyCount}
              </Text>
            </View>
          ) : (
            nowPt && (
              <View style={[styles.nowTag, { left: clampLeft(nowPt.x, TAG_W), width: TAG_W }]}>
                <Text style={styles.nowTagText}>Maintenant</Text>
              </View>
            )
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {/* Y axis */}
        <View style={{ width: AXIS_W, height: H }}>
          {Y_LABELS.map(y => (
            <Text key={y.label} style={[styles.yLabel, { top: yOf(y.at) - 8 }]}>
              {y.label}
            </Text>
          ))}
        </View>

        {/* Plot */}
        <View style={{ flex: 1 }}>
          <View style={{ height: H }} onLayout={onLayout}>
            {geom && (
              <Svg width={W} height={H}>
                <Defs>
                  {/* Vertical gradient by value: green < 40 %, amber 40–70 %, red > 70 % */}
                  <LinearGradient id="lvl" gradientUnits="userSpaceOnUse" x1="0" y1={yOf(100)} x2="0" y2={yOf(0)}>
                    <Stop offset="0" stopColor={colors.red.bar} />
                    <Stop offset="0.27" stopColor={colors.red.bar} />
                    <Stop offset="0.33" stopColor={colors.amber.bar} />
                    <Stop offset="0.57" stopColor={colors.amber.bar} />
                    <Stop offset="0.63" stopColor={colors.green.bar} />
                    <Stop offset="1" stopColor={colors.green.bar} />
                  </LinearGradient>
                  <LinearGradient id="lvlFill" gradientUnits="userSpaceOnUse" x1="0" y1={yOf(100)} x2="0" y2={yOf(0)}>
                    <Stop offset="0" stopColor={colors.red.bar} stopOpacity="0.2" />
                    <Stop offset="0.3" stopColor={colors.amber.bar} stopOpacity="0.16" />
                    <Stop offset="0.6" stopColor={colors.green.bar} stopOpacity="0.1" />
                    <Stop offset="1" stopColor={colors.green.bar} stopOpacity="0.02" />
                  </LinearGradient>
                  <LinearGradient id="pastFill" gradientUnits="userSpaceOnUse" x1="0" y1={yOf(100)} x2="0" y2={yOf(0)}>
                    <Stop offset="0" stopColor={colors.textMuted} stopOpacity="0.2" />
                    <Stop offset="1" stopColor={colors.textMuted} stopOpacity="0.02" />
                  </LinearGradient>
                  <ClipPath id="past">
                    <Rect x="0" y="0" width={nowPt ? nowPt.x : 0} height={H} />
                  </ClipPath>
                  <ClipPath id="future">
                    <Rect x={nowPt ? nowPt.x : 0} y="0" width={W - (nowPt ? nowPt.x : 0)} height={H} />
                  </ClipPath>
                </Defs>

                {/* grid */}
                {Y_LABELS.map(y => (
                  <Line key={y.label} x1="0" x2={W} y1={yOf(y.at)} y2={yOf(y.at)} stroke={colors.track} strokeWidth="1" />
                ))}

                {nowPt ? (
                  <>
                    {/* past: grey, solid */}
                    <Path d={geom.area} fill="url(#pastFill)" clipPath="url(#past)" />
                    <Path d={geom.line} fill="none" stroke={colors.textMuted} strokeWidth="3" strokeLinecap="round" clipPath="url(#past)" />
                    {/* forecast: coloured by level, dotted */}
                    <Path d={geom.area} fill="url(#lvlFill)" clipPath="url(#future)" />
                    <Path d={geom.line} fill="none" stroke="url(#lvl)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="0.1 7" clipPath="url(#future)" />
                    <Path d={geom.line} fill="none" stroke="url(#lvl)" strokeWidth="1.5" strokeOpacity="0.5" clipPath="url(#future)" />
                    {/* now marker */}
                    <Line x1={nowPt.x} x2={nowPt.x} y1={nowPt.y} y2={yOf(0)} stroke={ink(0.3)} strokeWidth="1" strokeDasharray="3 3" />
                    <Circle cx={nowPt.x} cy={nowPt.y} r="10" fill={colors[clubLevel(nowPct)].bar} fillOpacity="0.22" />
                    <Circle cx={nowPt.x} cy={nowPt.y} r="5.5" fill={colors[clubLevel(nowPct)].bar} stroke={colors.card} strokeWidth="2.5" />
                  </>
                ) : (
                  <>
                    {/* closed: typical day, soft */}
                    <Path d={geom.area} fill="url(#lvlFill)" />
                    <Path d={geom.line} fill="none" stroke="url(#lvl)" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.7" />
                  </>
                )}

                {/* scrub cursor */}
                {sp && (
                  <>
                    <Line x1={sp.x} x2={sp.x} y1={PAD_T} y2={yOf(0)} stroke={colors.text} strokeOpacity="0.35" strokeWidth="1" />
                    <Circle cx={sp.x} cy={sp.y} r="6" fill={colors[clubLevel(sp.p.percentage)].bar} stroke={colors.card} strokeWidth="2.5" />
                  </>
                )}
              </Svg>
            )}
            {/* touch layer */}
            <View style={StyleSheet.absoluteFill as any} {...pan.panHandlers} />
          </View>

          {/* X axis (time) */}
          <View style={styles.xAxis}>
            {W > 0 &&
              labelIdx.map(i => {
                const x = (i / (n - 1)) * W;
                if (nowPt && Math.abs(x - nowPt.x) < 34) return null;
                const first = i === 0;
                const last = i === n - 1;
                return (
                  <Text
                    key={i}
                    style={[
                      styles.xLabel,
                      first ? { left: 0, textAlign: 'left' } : last ? { right: 0, textAlign: 'right' } : { left: x - LABEL_W / 2, textAlign: 'center' },
                    ]}
                  >
                    {hh(points[i].hour)}
                  </Text>
                );
              })}
            {W > 0 && nowPt && (
              <View style={[styles.clock, { left: clampLeft(nowPt.x, 50), width: 50 }]}>
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
  nowTagText: { color: colors.onInverse, fontSize: 12, fontWeight: '800' },
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
  bubbleText: { color: colors.onInverse, fontSize: 12, fontWeight: '800' },

  yLabel: { position: 'absolute', left: 0, fontSize: 12, lineHeight: 16, color: colors.textMuted, fontWeight: '600' },
  xAxis: { height: 26, marginTop: 6 },
  xLabel: { position: 'absolute', top: 3, width: LABEL_W, fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  clock: { position: 'absolute', top: 0, height: 22, borderRadius: 11, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  clockText: { color: colors.onInverse, fontSize: 12, fontWeight: '800' },
});
