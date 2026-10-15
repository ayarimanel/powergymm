import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { MuscleGroup } from '../../types/database';
import { FloorSnapshot } from '../../floor/useFloorSnapshot';
import { HourForecast, LEVEL_LABEL } from '../../floor/crowd';
import { levelTint } from '../../floor/levelColors';
import { colors, cardShadow } from '../../theme';
import { HeatStrip } from './HeatStrip';

interface Props {
  snapshot: FloorSnapshot;
  focusMuscle: MuscleGroup | null;
  focusLabel: string | null;
  focusHourly: HourForecast[] | null;
  focusBestHour: number | null;
  onRemindMe: (hour: number, muscle: MuscleGroup | null) => void;
  onScanOut: () => void;
}

const PulsingDot: React.FC<{ color: string; pulse: boolean }> = ({ color, pulse }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
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
              opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
            },
          ]}
        />
      )}
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
};

const hh = (h: number) => `${h}h`;

export const MoodCard: React.FC<Props> = ({ snapshot, focusMuscle, focusLabel, focusHourly, focusBestHour, onRemindMe, onScanOut }) => {
  const [scrubHour, setScrubHour] = useState<number | null>(null);

  // Reset the scrub when switching between the whole gym and a muscle.
  useEffect(() => setScrubHour(null), [focusMuscle]);

  const hourly = focusMuscle ? focusHourly ?? [] : snapshot.hourly;
  const bestHour = focusMuscle ? focusBestHour : snapshot.bestHour;

  if (!snapshot.isOpen) {
    return (
      <View style={[styles.card, styles.closedCard]}>
        <Ionicons name="moon-outline" size={26} color={colors.textSecondary} />
        <Text style={styles.closedTitle}>Fermé · ouvre à {hh(snapshot.openingHour)}</Text>
        {snapshot.tomorrow?.bestHour != null && (
          <Text style={styles.closedSub}>
            Demain, calme vers {hh(snapshot.tomorrow.bestHour)} <Text style={styles.estimated}>ⓘ estimation</Text>
          </Text>
        )}
      </View>
    );
  }

  const scrubEntry = scrubHour != null ? hourly.find(h => h.hour === scrubHour) : null;
  const level = scrubEntry ? scrubEntry.level : focusMuscle
    ? snapshot.muscles.find(m => m.muscle === focusMuscle)?.level ?? 'calme'
    : snapshot.level;
  const tint = levelTint(level);
  const checkedIn = !focusMuscle && !!snapshot.myCheckIn;
  const sinceMin = checkedIn ? Math.max(0, Math.round((snapshot.now.getTime() - new Date(snapshot.myCheckIn!.checkInTime).getTime()) / 60000)) : 0;

  let line: React.ReactNode;
  if (scrubEntry) {
    line = focusMuscle ? (
      <Text style={styles.line}>{focusLabel} · {hh(scrubEntry.hour)} <Text style={styles.estimated}>ⓘ estimation</Text></Text>
    ) : (
      <Text style={styles.line}>
        ≈{scrubEntry.count} personne{scrubEntry.count > 1 ? 's' : ''} à {hh(scrubEntry.hour)} <Text style={styles.estimated}>ⓘ estimation</Text>
      </Text>
    );
  } else if (checkedIn) {
    line = <Text style={styles.line}>Tu es là 💪 · {sinceMin} min</Text>;
  } else if (focusMuscle) {
    line = <Text style={styles.line}>{focusLabel} · maintenant</Text>;
  } else {
    line = (
      <Text style={styles.line}>
        {snapshot.presentCount} personne{snapshot.presentCount > 1 ? 's' : ''} maintenant · ferme à {hh(snapshot.closingHour)}
      </Text>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: tint.soft }]}>
      {snapshot.isSpecialDay && (
        <View style={styles.specialBadge}>
          <Text style={styles.specialText}>{snapshot.specialEmoji ?? '🌙'} {snapshot.specialLabel}</Text>
        </View>
      )}

      <View style={styles.headRow}>
        <PulsingDot color={tint.bar} pulse={!scrubEntry} />
        <Text style={[styles.bigWord, { color: tint.text }]}>{LEVEL_LABEL[level]}</Text>
      </View>

      <View style={styles.lineRow}>
        {line}
        {checkedIn && (
          <Pressable onPress={onScanOut} accessibilityRole="button" accessibilityLabel="Terminer ma séance" style={styles.scanOutBtn}>
            <Ionicons name="log-out-outline" size={14} color={colors.text} />
            <Text style={styles.scanOutText}>Sortie</Text>
          </Pressable>
        )}
      </View>

      {hourly.length > 0 && (
        <View style={styles.stripWrap}>
          <HeatStrip
            hourly={hourly}
            nowHour={snapshot.now.getHours() + snapshot.now.getMinutes() / 60}
            bestHour={bestHour}
            isOpen={snapshot.isOpen}
            onScrub={setScrubHour}
            onRemindMe={h => onRemindMe(h, focusMuscle)}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, minHeight: 200, ...cardShadow },
  closedCard: { backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 28 },
  closedTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  closedSub: { fontSize: 14, color: colors.textSecondary },
  estimated: { fontSize: 11, fontWeight: '700', color: colors.textMuted },

  specialBadge: { alignSelf: 'flex-start', marginBottom: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.6)' },
  specialText: { fontSize: 12, fontWeight: '800', color: colors.text },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotHalo: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  bigWord: { fontSize: 34, fontWeight: '900', letterSpacing: 0.5 },

  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 18 },
  line: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  scanOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.7)' },
  scanOutText: { fontSize: 12, fontWeight: '800', color: colors.text },

  stripWrap: { marginTop: 4 },
});
