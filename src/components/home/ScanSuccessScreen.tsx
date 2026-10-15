import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, AnimatedText } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { Title } from '../ui/Title';
import { Button } from '../ui/Button';
import { colors, fonts, radius } from '../../theme';
import { WEEK_LABELS, isMilestone, weekDots } from '../../services/floorViewModel';
import { useBackHandler } from '../../navigation/backStack';
import { useReduceMotion } from '../../hooks/useDeviceState';
import { LEVEL_LABEL, CrowdLevel } from '../../floor/crowd';
import { levelTint } from '../../floor/levelColors';

/**
 * After a successful check-in (design-ref ScanOK): green check, "Bienvenue {name}",
 * the streak (number roll + this week's flames) and the crowd right now. Stays until
 * the member picks "Commencer ma séance" or "Retour à l'accueil".
 */
interface Props {
  visible: boolean;
  firstName: string;
  oldStreak: number;
  newStreak: number;
  /** Streak was broken (or first ever): a new run starts at 1. */
  isNewRun: boolean;
  /** The crowd now, when known (count only if the club shows numbers). */
  crowd: { level: CrowdLevel; count: number | null } | null;
  /** False while a session is already running: only "Retour" is offered. */
  canStart: boolean;
  onStart: () => void;
  onHome: () => void;
}

const NUM_H = 40;
const pad = (n: number) => String(n).padStart(2, '0');

export const ScanSuccessScreen: React.FC<Props> = ({ visible, firstName, oldStreak, newStreak, isNewRun, crowd, canStart, onStart, onHome }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const check = useRef(new Animated.Value(0)).current;
  const roll = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const [at, setAt] = useState(new Date());
  const milestone = isMilestone(newStreak) && !isNewRun;

  useBackHandler(visible, onHome);

  useEffect(() => {
    if (!visible) return;
    setAt(new Date());
    if (reduceMotion) {
      check.setValue(1);
      roll.setValue(1);
      pop.setValue(1);
      return;
    }
    check.setValue(0);
    roll.setValue(isNewRun ? 1 : 0);
    pop.setValue(0);
    Animated.sequence([
      Animated.spring(check, { toValue: 1, damping: 9, stiffness: 180, useNativeDriver: true }),
      Animated.parallel([
        isNewRun ? Animated.delay(0) : Animated.timing(roll, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([Animated.delay(250), Animated.spring(pop, { toValue: 1, damping: 6, stiffness: 240, useNativeDriver: true })]),
      ]),
    ]).start();
  }, [visible, reduceMotion, isNewRun, check, roll, pop]);

  const dots = weekDots(newStreak, true);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const oldY = roll.interpolate({ inputRange: [0, 1], outputRange: [0, -NUM_H] });
  const newY = roll.interpolate({ inputRange: [0, 1], outputRange: [NUM_H, 0] });
  const tint = crowd ? levelTint(crowd.level) : null;

  return (
    <Modal visible={visible} animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={onHome} statusBarTranslucent>
      <View style={[s.page, { paddingTop: insets.top + 40, paddingBottom: Math.max(24, insets.bottom + 16) }]}>
        <View style={s.body} accessibilityLiveRegion="polite">
          <Animated.View style={[s.halo, { opacity: check, transform: [{ scale: check }] }]}>
            <View style={s.check}>
              <Icon name="checkmark" size={56} color={colors.white} />
            </View>
          </Animated.View>

          <View style={s.titleBox} accessible accessibilityRole="header" accessibilityLabel={`Bienvenue ${firstName}`}>
            <Title variant="display" size={52} accessibilityRole="none" style={s.center}>Bienvenue</Title>
            <Title variant="display" size={52} color={colors.brand} accessibilityRole="none" style={s.center}>{firstName}</Title>
          </View>
          <Text style={s.sub}>Check-in enregistré à {pad(at.getHours())}:{pad(at.getMinutes())}</Text>

          {milestone && (
            <View style={s.badge}>
              <Icon name="trophy" size={16} color={colors.amber.text} />
              <Text style={s.badgeText}>Cap des {newStreak} jours · badge débloqué</Text>
            </View>
          )}

          <View style={s.tiles}>
            <View style={s.tile} accessible accessibilityLabel={isNewRun ? 'Nouvelle série commencée' : `Série de ${newStreak} jours`}>
              <View style={s.tileTop}>
                <Icon name="flame" size={22} color={colors.amber.bar} />
                <View style={s.numBox}>
                  <Text style={[s.num, s.numSizer]}>{newStreak}</Text>
                  {!isNewRun && <AnimatedText style={[s.num, s.numAbs, { transform: [{ translateY: oldY }] }]}>{oldStreak}</AnimatedText>}
                  <AnimatedText style={[s.num, s.numAbs, { transform: [{ translateY: newY }] }]}>{newStreak}</AnimatedText>
                </View>
              </View>
              <Text style={s.tileLabel}>{isNewRun ? 'Nouvelle série commencée' : `jour${newStreak > 1 ? 's' : ''} d’affilée · +1`}</Text>
              <View style={s.week}>
                {WEEK_LABELS.map((label, i) => {
                  const on = dots[i];
                  const today = i === todayIdx;
                  return (
                    <View key={i} style={s.dayCol}>
                      {today ? (
                        <Animated.View style={[s.dot, s.dotOn, { transform: [{ scale: pop }] }]} />
                      ) : (
                        <View style={[s.dot, on && s.dotOn]} />
                      )}
                      <Text style={[s.dayLabel, today && { color: colors.text }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {crowd && tint && (
              <View style={s.tile} accessible accessibilityLabel={`Au plateau : ${LEVEL_LABEL[crowd.level].toLowerCase()}`}>
                <View style={s.tileTop}>
                  <View style={[s.crowdDot, { backgroundColor: tint.bar }]} />
                  {crowd.count != null ? (
                    <Text style={s.num}>{crowd.count}</Text>
                  ) : (
                    <Text style={[s.num, { color: tint.text, fontSize: 26 }]}>{LEVEL_LABEL[crowd.level]}</Text>
                  )}
                </View>
                <Text style={s.tileLabel}>au plateau · {LEVEL_LABEL[crowd.level].toLowerCase()}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.actions}>
          {canStart && <Button label="Commencer ma séance" iconLeft="play" onPress={onStart} />}
          <Button label="Retour à l’accueil" variant="secondary" onPress={onHome} />
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page, paddingHorizontal: 24 },
  body: { flex: 1, alignItems: 'center' },
  halo: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.green.soft, alignItems: 'center', justifyContent: 'center' },
  check: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.green.bar, alignItems: 'center', justifyContent: 'center' },
  titleBox: { marginTop: 36, alignItems: 'center' },
  center: { textAlign: 'center' },
  sub: { marginTop: 12, fontSize: 15, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.amber.soft },
  badgeText: { fontSize: 13, fontWeight: '800', color: colors.amber.text },

  tiles: { flexDirection: 'row', gap: 12, marginTop: 32, alignSelf: 'stretch' },
  tile: { flex: 1, padding: 16, gap: 6, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tileLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  num: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 34, lineHeight: NUM_H, color: colors.text },
  numBox: { height: NUM_H, overflow: 'hidden', justifyContent: 'center' },
  numSizer: { opacity: 0 },
  numAbs: { position: 'absolute', left: 0, top: 0 },
  crowdDot: { width: 10, height: 10, borderRadius: 5 },

  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dayCol: { alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.track },
  dotOn: { backgroundColor: colors.flame },
  dayLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted },

  actions: { gap: 14 },
});
