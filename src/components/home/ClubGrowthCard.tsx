/**
 * The owner's growth card: new members, members who stopped coming, and money in,
 * each against the previous comparable window.
 *
 * Reading rules this card follows:
 *  - one measure per chart, one series, so no legend is needed: the title names it;
 *  - a change is never colour alone. Green and red are indistinguishable under
 *    deuteranopia (ΔE 4.2), so every delta carries an arrow and a signed number;
 *  - "up" is not always good: fewer members leaving is a win, so each tile says
 *    which direction it wants;
 *  - only the busiest day is labelled, never every bar.
 */
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { useT } from '../../i18n';
import { colors, cardShadow } from '../../theme';
import { ClubAnalytics, Delta, formatMillimes } from '../../services/analyticsService';
import { haptics } from '../../utils/haptics';

const BAR_H = 56;

/** A change, as an arrow + a signed number. Colour only reinforces it. */
const DeltaChip: React.FC<{ d: Delta; goodWhenUp?: boolean; label: string }> = ({ d, goodWhenUp = true, label }) => {
  if (d.change === null) {
    return (
      <View style={[styles.chip, styles.chipNeutral]}>
        <Text style={styles.chipTextNeutral} accessibilityLabel={`${label} : nouveau, rien à comparer`}>
          nouveau
        </Text>
      </View>
    );
  }
  if (d.change === 0) {
    return (
      <View style={[styles.chip, styles.chipNeutral]}>
        <Text style={styles.chipTextNeutral} accessibilityLabel={`${label} : stable`}>
          = stable
        </Text>
      </View>
    );
  }

  const up = d.change > 0;
  const good = up === goodWhenUp;
  const tint = good ? colors.green : colors.red;
  const sign = up ? '+' : '−';
  const value = Math.abs(d.change);

  return (
    <View style={[styles.chip, { backgroundColor: tint.soft }]}>
      <Icon name={up ? 'arrow-up' : 'arrow-down'} size={13} color={tint.text} />
      <Text
        style={[styles.chipText, { color: tint.text }]}
        accessibilityLabel={`${label} : ${up ? 'en hausse' : 'en baisse'} de ${value} pour cent`}
      >
        {sign}
        {value}%
      </Text>
    </View>
  );
};

const Tile: React.FC<{ title: string; value: string; sub: string; d: Delta; goodWhenUp?: boolean }> = ({
  title,
  value,
  sub,
  d,
  goodWhenUp,
}) => (
  <View style={styles.tile}>
    <Text style={styles.tileTitle}>{title}</Text>
    <Text style={styles.tileValue}>{value}</Text>
    <DeltaChip d={d} goodWhenUp={goodWhenUp} label={title} />
    <Text style={styles.tileSub}>{sub}</Text>
  </View>
);

interface Props {
  analytics: ClubAnalytics;
  currency?: string;
}

export const ClubGrowthCard: React.FC<Props> = ({ analytics, currency = 'DT' }) => {
  const { members, signups, revenueMillimes, series } = analytics;
  const { t } = useT();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const max = useMemo(() => Math.max(1, ...series.map(p => p.n)), [series]);
  const peakIndex = useMemo(() => series.findIndex(p => p.n === max), [series, max]);

  // 2px of surface between bars keeps adjacent days from reading as one block.
  const slot = width / Math.max(1, series.length);
  const barW = Math.max(2, slot - 2);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pick = (x: number) => {
    const i = Math.max(0, Math.min(series.length - 1, Math.floor(x / Math.max(1, slot))));
    if (i !== picked) {
      haptics.select();
      setPicked(i);
    }
  };

  const shown = picked === null ? null : series[picked];
  const totalMonth = series.reduce((s, p) => s + p.n, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('Croissance du club')}</Text>
      <Text style={styles.sub}>Les 7 derniers jours, comparés aux 7 d'avant.</Text>

      <View style={styles.tiles}>
        <Tile
          title="Nouveaux"
          value={String(signups.week.now)}
          sub={`${signups.week.before} la semaine d'avant`}
          d={signups.week}
        />
        <Tile
          title="Ont arrêté"
          value={String(members.lapsed)}
          sub="sans venir depuis 21 j"
          d={{ now: members.lapsed, before: members.lapsed, change: 0 }}
          goodWhenUp={false}
        />
        <Tile
          title="Encaissé"
          value={formatMillimes(revenueMillimes.week.now, currency)}
          sub={`${formatMillimes(revenueMillimes.week.before, currency)} avant`}
          d={revenueMillimes.week}
        />
      </View>

      {/* One series, so the heading names it instead of a legend. */}
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>{t('Nouveaux membres par jour · 30 j')}</Text>
        <Text style={styles.chartTotal}>{totalMonth} au total</Text>
      </View>

      <View
        style={styles.plot}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={e => pick(e.nativeEvent.locationX)}
        onResponderMove={e => pick(e.nativeEvent.locationX)}
        onResponderRelease={() => setPicked(null)}
        accessibilityLabel={`Nouveaux membres par jour sur 30 jours, ${totalMonth} au total, maximum ${max}`}
      >
        {series.map((p, i) => {
          const h = p.n === 0 ? 2 : Math.max(3, Math.round((p.n / max) * BAR_H));
          const on = picked === i || (picked === null && i === peakIndex && max > 0);
          return (
            <View key={p.day} style={{ width: slot, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View
                style={{
                  width: barW,
                  height: h,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: p.n === 0 ? colors.track : on ? colors.brand : colors.pastBar,
                }}
              />
            </View>
          );
        })}
      </View>

      {/* Only the picked day, or the busiest one: never a number on every bar. */}
      <Text style={styles.peak}>
        {shown
          ? `${shown.day} · ${shown.n} nouveau${shown.n > 1 ? 'x' : ''}`
          : max > 0 && series[peakIndex]
            ? `Meilleur jour : ${series[peakIndex]!.day} · ${max}`
            : 'Aucune inscription ce mois-ci'}
      </Text>

      <View style={styles.monthRow}>
        <Text style={styles.monthLabel}>{t('Ce mois')}</Text>
        <Text style={styles.monthValue}>{signups.month.now} nouveaux</Text>
        <DeltaChip d={signups.month} label="Nouveaux ce mois" />
      </View>
      <View style={styles.monthRow}>
        <Text style={styles.monthLabel}>{t('Encaissé ce mois')}</Text>
        <Text style={styles.monthValue}>{formatMillimes(revenueMillimes.month.now, currency)}</Text>
        <DeltaChip d={revenueMillimes.month} label="Encaissé ce mois" />
      </View>

      <Text style={styles.foot}>
        {members.total} membre{members.total > 1 ? 's' : ''} · {members.active} à jour
        {members.neverCame > 0 ? ` · ${members.neverCame} jamais venu${members.neverCame > 1 ? 's' : ''}` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
    ...cardShadow,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },

  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, gap: 4, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.bg },
  tileTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tileValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  tileSub: { fontSize: 11, color: colors.textMuted },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9 },
  chipNeutral: { backgroundColor: colors.track },
  chipText: { fontSize: 12, fontWeight: '800' },
  chipTextNeutral: { fontSize: 12, fontWeight: '700', color: colors.textMuted },

  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16 },
  chartTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chartTotal: { fontSize: 12, color: colors.textMuted },

  plot: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_H, marginTop: 8 },
  peak: { fontSize: 12, color: colors.textMuted, marginTop: 6, minHeight: 16 },

  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  monthLabel: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  monthValue: { fontSize: 14, fontWeight: '800', color: colors.text },

  foot: { marginTop: 10, fontSize: 12, color: colors.textMuted },
});
