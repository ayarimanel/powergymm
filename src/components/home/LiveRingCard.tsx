import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { FloorSnapshot } from '../../floor/useFloorSnapshot';
import { LEVEL_LABEL } from '../../floor/crowd';
import { levelTint } from '../../floor/levelColors';
import { colors, fonts, radius } from '../../theme';

/**
 * Accueil's live card (design-ref Main): a ring with how full the gym is, the live
 * count, the level and the calmest hour left today. Display only: the full view
 * (days, hourly chart, muscle by muscle) opens from "Voir l'affluence".
 */
interface Props {
  snapshot: FloorSnapshot;
  showCounts: boolean;
  checkedIn: boolean;
  onScanOut: () => void;
}

const SIZE = 104;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
/** When the club hides counts, the ring follows the level instead of the head count. */
const LEVEL_FILL = { calme: 0.33, moyen: 0.66, plein: 1 } as const;
const pad = (n: number) => String(n).padStart(2, '0');

export const LiveRingCard: React.FC<Props> = ({ snapshot, showCounts, checkedIn, onScanOut }) => {
  const tint = levelTint(snapshot.level);

  if (!snapshot.isOpen) {
    return (
      <View style={[s.card, s.closed]}>
        <View style={s.closedIcon}>
          <Icon name="moon-outline" size={24} color={colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.closedTitle}>Fermé · ouvre à {snapshot.openingHour}h</Text>
          {snapshot.tomorrow?.bestHour != null ? <Text style={s.sub}>Demain, plus calme vers {snapshot.tomorrow.bestHour}h</Text> : null}
        </View>
      </View>
    );
  }

  const live = snapshot.presentCount;
  const fill = showCounts ? Math.min(1, live / Math.max(1, snapshot.capacity)) : LEVEL_FILL[snapshot.level];
  const pct = Math.round(fill * 100);
  const levelWord = LEVEL_LABEL[snapshot.level];

  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={s.ringWrap} accessible accessibilityLabel={showCounts ? `${pct} % rempli` : levelWord}>
          <Svg width={SIZE} height={SIZE}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.track} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={colors.brand}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRC * fill} ${CIRC}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>
          <View style={s.ringCenter} pointerEvents="none">
            {showCounts ? (
              <>
                <Text style={s.pct}>{pct}%</Text>
                <Text style={s.pctSub}>rempli</Text>
              </>
            ) : (
              <Text style={[s.pctWord, { color: tint.text }]}>{levelWord.charAt(0) + levelWord.slice(1).toLowerCase()}</Text>
            )}
          </View>
        </View>

        <View style={s.info}>
          <View style={s.liveRow}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>EN DIRECT · {pad(snapshot.now.getHours())}:{pad(snapshot.now.getMinutes())}</Text>
          </View>
          {showCounts ? (
            <View style={s.countRow}>
              <Text style={s.count}>{live}</Text>
              <Text style={s.countOf}>/ {snapshot.capacity} au plateau</Text>
            </View>
          ) : null}
          <View style={[s.level, { backgroundColor: tint.soft }]}>
            <Text style={[s.levelText, { color: tint.text }]}>{levelWord}</Text>
          </View>
          {snapshot.bestHour != null ? <Text style={s.sub}>Plus calme : {snapshot.bestHour}h – {snapshot.bestHour + 1}h</Text> : null}
        </View>
      </View>

      {checkedIn && (
        <Pressable onPress={onScanOut} accessibilityRole="button" style={({ pressed }) => [s.scanOut, pressed && { opacity: 0.85 }]}>
          <Icon name="log-out-outline" size={16} color={colors.text} />
          <Text style={s.scanOutText}>Tu es là — terminer ma séance</Text>
        </Pressable>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg, padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringWrap: { width: SIZE, height: SIZE },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pct: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 28, lineHeight: 30, color: colors.text },
  pctSub: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  pctWord: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 20, textTransform: 'uppercase' },
  info: { flex: 1, gap: 6 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  liveText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: colors.textSecondary },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  count: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 40, lineHeight: 42, color: colors.brand },
  countOf: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  level: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  levelText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  sub: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  scanOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, marginTop: 16, borderRadius: 999, backgroundColor: colors.bg },
  scanOutText: { fontSize: 14, fontWeight: '700', color: colors.text },
  closed: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  closedIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  closedTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
});
