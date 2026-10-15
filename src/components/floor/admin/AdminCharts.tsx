import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { HeatCell } from '../../../floor/useFloorAdminData';
import { colors } from '../../../theme';

const hh = (h: number) => `${h}h`;
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ---------- Today vs same-weekday average ----------

interface SeriesPoint {
  hour: number;
  count: number;
}

/** Bars = today (real check-ins per hour), line = average of the same weekday over the last 8 weeks. */
export const TodayVsAverageChart: React.FC<{ today: SeriesPoint[]; average: SeriesPoint[]; nowHour: number; weekdayLabel: string }> = ({
  today,
  average,
  nowHour,
  weekdayLabel,
}) => {
  const [w, setW] = useState(0);
  const H = 150;
  const PAD_B = 18;
  const n = average.length;
  const max = Math.max(1, ...today.map(p => p.count), ...average.map(p => p.count));
  const plotH = H - PAD_B - 6;
  const x = (i: number) => (n <= 1 ? 0 : (i / n) * w);
  const slot = n ? w / n : 0;
  const y = (v: number) => 6 + plotH - (v / max) * plotH;

  const linePath = average
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i) + slot / 2} ${y(p.count)}`)
    .join(' ');

  return (
    <View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.brand }]} />
          <Text style={styles.legendText}>Aujourd’hui</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.textSecondary }]} />
          <Text style={styles.legendText}>Moyenne des {weekdayLabel.toLowerCase()}s</Text>
        </View>
      </View>
      <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
        {w > 0 && (
          <Svg width={w} height={H}>
            {today.map((p, i) => {
              const h = (p.count / max) * plotH;
              const future = p.hour > Math.floor(nowHour);
              return (
                <Rect
                  key={p.hour}
                  x={x(i) + slot * 0.18}
                  y={6 + plotH - h}
                  width={slot * 0.64}
                  height={Math.max(0, h)}
                  rx={3}
                  fill={colors.brand}
                  opacity={future ? 0.25 : 0.9}
                />
              );
            })}
            <Path d={linePath} stroke={colors.textSecondary} strokeWidth={2} fill="none" strokeDasharray="5 4" />
            <Line x1={0} x2={w} y1={6 + plotH} y2={6 + plotH} stroke={colors.border} strokeWidth={1} />
          </Svg>
        )}
        <View style={styles.xAxis}>
          {average.map((p, i) =>
            i % 3 === 0 ? (
              <Text key={p.hour} style={[styles.xLabel, { left: x(i) + slot / 2 - 14 }]}>
                {hh(p.hour)}
              </Text>
            ) : null
          )}
        </View>
      </View>
    </View>
  );
};

// ---------- Weekday × hour heatmap ----------

export const WeekHeatmap: React.FC<{ cells: HeatCell[] }> = ({ cells }) => {
  const hours = [...new Set(cells.map(c => c.hour))].sort((a, b) => a - b);
  const max = Math.max(1, ...cells.map(c => c.count));
  const at = (weekday: number, hour: number) => cells.find(c => c.weekday === weekday && c.hour === hour)?.count ?? 0;

  return (
    <View>
      {DAYS.map((d, wd) => (
        <View key={d} style={styles.heatRow}>
          <Text style={styles.heatDay}>{d}</Text>
          {hours.map(h => {
            const v = at(wd, h);
            const t = v / max;
            return (
              <View
                key={h}
                accessibilityLabel={`${d} ${hh(h)} : ${v} personnes en moyenne`}
                style={[styles.heatCell, { backgroundColor: heatColor(t) }]}
              />
            );
          })}
        </View>
      ))}
      <View style={styles.heatRow}>
        <Text style={styles.heatDay} />
        {hours.map(h => (
          <Text key={h} style={styles.heatHour}>
            {h % 3 === 0 ? h : ''}
          </Text>
        ))}
      </View>
    </View>
  );
};

/** Green → amber → red, matching the member-side levels. */
const heatColor = (t: number) => {
  if (t < 0.4) return `rgba(22,163,74,${0.15 + t * 1.2})`;
  if (t < 0.7) return `rgba(217,119,6,${0.35 + (t - 0.4) * 1.5})`;
  return `rgba(220,38,38,${0.5 + (t - 0.7) * 1.6})`;
};

// ---------- Simple horizontal bars ----------

export const HBars: React.FC<{ rows: { label: string; value: number }[]; unit?: string; highlightMax?: boolean }> = ({ rows, unit = '', highlightMax }) => {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <View style={{ gap: 6 }}>
      {rows.map(r => (
        <View key={r.label} style={styles.hbarRow}>
          <Text style={styles.hbarLabel}>{r.label}</Text>
          <View style={styles.hbarTrack}>
            <View
              style={[
                styles.hbarFill,
                { width: `${(r.value / max) * 100}%`, backgroundColor: highlightMax && r.value === max ? colors.brand : colors.pastBar },
              ]}
            />
          </View>
          <Text style={styles.hbarValue}>
            {r.value}
            {unit}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 16, marginBottom: 10, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendLine: { width: 16, height: 2 },
  legendText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  xAxis: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 16 },
  xLabel: { position: 'absolute', width: 28, textAlign: 'center', fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  heatRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 2 },
  heatDay: { width: 32, fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  heatCell: { flex: 1, height: 18, borderRadius: 3 },
  heatHour: { flex: 1, fontSize: 10, textAlign: 'center', color: colors.textMuted },

  hbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hbarLabel: { width: 48, fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  hbarTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: 'hidden' },
  hbarFill: { height: '100%', borderRadius: 5 },
  hbarValue: { width: 36, textAlign: 'right', fontSize: 12, fontWeight: '800', color: colors.text },
});
