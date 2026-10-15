import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, AnimatedText } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { colors } from '../../theme';
import { WEEK_LABELS, isMilestone, weekDots } from '../../services/floorViewModel';
import { useBackHandler } from '../../navigation/backStack';
import { useReduceMotion } from '../../hooks/useDeviceState';

interface Props {
  visible: boolean;
  oldStreak: number;
  newStreak: number;
  /** Streak was broken (or first ever) → "Nouvelle série commencée" instead of a roll. */
  isNewRun: boolean;
  onClose: () => void;
}

// Timeline (ms) — total ≈ 2.5 s, milestones linger a bit longer
const T_SHEET = 350;
const T_FLAME_AT = 150;
const T_ROLL_AT = 650;
const T_POP_AT = 1150;
const AUTO_DISMISS = 2500;
const AUTO_DISMISS_MILESTONE = 3500;

const PARTICLE_COLORS = [colors.flameText, colors.amber.bar, colors.flameLight, colors.red.bar];
const NUM_H = 46;

export const StreakSuccessSheet: React.FC<Props> = ({ visible, oldStreak, newStreak, isNewRun, onClose }) => {
  const reduceMotion = useReduceMotion();
  const { height: winH } = useWindowDimensions();
  const milestone = isMilestone(newStreak) && !isNewRun;

  const sheetY = useRef(new Animated.Value(winH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const flameScale = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const roll = useRef(new Animated.Value(0)).current; // 0 = old number, 1 = new number
  const pop = useRef(new Animated.Value(0)).current; // today's dot
  const badge = useRef(new Animated.Value(0)).current;
  const dismissing = useRef(false);
  const [rendered, setRendered] = useState(visible);

  const particleCount = milestone ? 22 : 10;
  const radius = milestone ? 112 : 72;
  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, i) => {
        const angle = (i / particleCount) * Math.PI * 2 + (i % 2) * 0.25;
        const dist = radius * (0.65 + (i % 3) * 0.2);
        return {
          p: new Animated.Value(0),
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 24,
          color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
          size: 5 + (i % 3) * 2,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [particleCount, radius, visible]
  );

  const dismiss = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetY, { toValue: reduceMotion ? 0 : 400, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setRendered(false);
      onClose();
    });
  }, [fade, sheetY, onClose, reduceMotion]);
  useBackHandler(visible, dismiss);

  useEffect(() => {
    if (!visible) return;
    dismissing.current = false;
    setRendered(true);

    // reset
    sheetY.setValue(reduceMotion ? 0 : winH);
    fade.setValue(0);
    flameScale.setValue(reduceMotion ? 1 : 0);
    glow.setValue(reduceMotion ? 1 : 0);
    roll.setValue(reduceMotion || isNewRun ? 1 : 0);
    pop.setValue(reduceMotion ? 1 : 0);
    badge.setValue(reduceMotion ? 1 : 0);
    particles.forEach(pt => pt.p.setValue(0));

    if (reduceMotion) {
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, damping: 18, stiffness: 190, mass: 0.9, useNativeDriver: true }),
        // b. flame ignites (scale + glow) + subtle particles
        Animated.sequence([
          Animated.delay(T_FLAME_AT),
          Animated.parallel([
            Animated.spring(flameScale, { toValue: 1, damping: 7, stiffness: 160, useNativeDriver: true }),
            Animated.timing(glow, { toValue: 1, duration: 450, useNativeDriver: true }),
            Animated.stagger(
              18,
              particles.map(pt =>
                Animated.timing(pt.p, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true })
              )
            ),
          ]),
        ]),
        // c. number roll
        Animated.sequence([
          Animated.delay(T_ROLL_AT),
          isNewRun
            ? Animated.delay(0)
            : Animated.timing(roll, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        // d. today's dot pops
        Animated.sequence([
          Animated.delay(T_POP_AT),
          Animated.spring(pop, { toValue: 1, damping: 6, stiffness: 240, useNativeDriver: true }),
        ]),
        // e. milestone badge
        Animated.sequence([
          Animated.delay(T_POP_AT + 150),
          milestone
            ? Animated.spring(badge, { toValue: 1, damping: 8, stiffness: 180, useNativeDriver: true })
            : Animated.delay(0),
        ]),
      ]).start();
    }

    const t = setTimeout(dismiss, milestone ? AUTO_DISMISS_MILESTONE : AUTO_DISMISS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!rendered) return null;

  const dots = weekDots(newStreak, true);
  const todayIdx = (new Date().getDay() + 6) % 7;

  const oldY = roll.interpolate({ inputRange: [0, 1], outputRange: [0, -NUM_H] });
  const newY = roll.interpolate({ inputRange: [0, 1], outputRange: [NUM_H, 0] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] });
  const dayWord = newStreak > 1 ? 'jours' : 'jour';

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />

        <Animated.View
          style={[styles.sheet, { opacity: fade, transform: [{ translateY: sheetY }] }]}
          pointerEvents="box-none"
        >
          <Pressable onPress={dismiss} style={styles.sheetInner} accessibilityLiveRegion="polite">
            <View style={styles.handle} />

            {/* Flame */}
            <View style={styles.flameStage}>
              <Animated.View
                style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
              />
              {!reduceMotion &&
                particles.map((pt, i) => (
                  <Animated.View
                    key={i}
                    style={{
                      position: 'absolute',
                      width: pt.size,
                      height: pt.size,
                      borderRadius: pt.size / 2,
                      backgroundColor: pt.color,
                      opacity: pt.p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                      transform: [
                        { translateX: pt.p.interpolate({ inputRange: [0, 1], outputRange: [0, pt.x] }) },
                        { translateY: pt.p.interpolate({ inputRange: [0, 1], outputRange: [0, pt.y] }) },
                        { scale: pt.p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
                      ],
                    }}
                  />
                ))}
              <Animated.View style={{ transform: [{ scale: flameScale }] }}>
                <Icon name="flame" size={milestone ? 96 : 80} color={colors.flame} />
              </Animated.View>
            </View>

            {/* Counter */}
            {isNewRun ? (
              <>
                <Text style={styles.title}>Nouvelle série commencée</Text>
                <Text style={styles.sub}>Série de 1 jour — reviens demain pour la continuer !</Text>
              </>
            ) : (
              <>
                {milestone && <Text style={styles.milestoneTitle}>Cap des {newStreak} jours !</Text>}
                <View style={styles.counterRow}>
                  <Text style={styles.title}>Série de </Text>
                  <View style={styles.numBox}>
                    <Text style={[styles.title, styles.numSizer]}>{newStreak}</Text>
                    <AnimatedText style={[styles.title, styles.numAbs, { transform: [{ translateY: oldY }] }]}>
                      {oldStreak}
                    </AnimatedText>
                    <AnimatedText style={[styles.title, styles.numAbs, { transform: [{ translateY: newY }] }]}>
                      {newStreak}
                    </AnimatedText>
                  </View>
                  <Text style={styles.title}> {dayWord}</Text>
                </View>
              </>
            )}

            {/* Milestone badge */}
            {milestone && (
              <Animated.View
                style={[
                  styles.badge,
                  { opacity: badge, transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
                ]}
              >
                <Icon name="trophy" size={18} color={colors.amber.text} />
                <Text style={styles.badgeText}>Badge {newStreak} jours débloqué</Text>
              </Animated.View>
            )}

            {/* Week strip — today's dot pops in last */}
            <View style={styles.week}>
              {WEEK_LABELS.map((label, i) => {
                const isToday = i === todayIdx;
                return (
                  <View key={i} style={styles.dayCol}>
                    <View style={[styles.dot, dots[i] && !isToday && styles.dotOn]}>
                      {dots[i] && !isToday && <Icon name="flame" size={14} color={colors.white} />}
                      {isToday && (
                        <Animated.View
                          style={[
                            styles.dot,
                            styles.dotOn,
                            StyleSheet.absoluteFill,
                            { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }] },
                          ]}
                        >
                          <Icon name="flame" size={14} color={colors.white} />
                        </Animated.View>
                      )}
                    </View>
                    <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.tapHint}>Touche pour fermer</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { backgroundColor: colors.black },
  sheet: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetInner: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.disabled, marginBottom: 8 },

  flameStage: { width: 200, height: 150, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: colors.flameSoft },

  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, lineHeight: NUM_H, fontWeight: '800', color: colors.text, textAlign: 'center' },
  numBox: { height: NUM_H, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  numSizer: { opacity: 0 },
  numAbs: { position: 'absolute', left: 0, right: 0, top: 0, color: colors.flame },
  sub: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 22 },
  milestoneTitle: { fontSize: 15, fontWeight: '800', color: colors.flame, marginBottom: 2 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.amber.soft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  badgeText: { fontSize: 14, fontWeight: '800', color: colors.amber.text },

  week: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 20 },
  dayCol: { flex: 1, alignItems: 'center', gap: 6 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.flame },
  dayLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  dayLabelToday: { color: colors.text, fontWeight: '800' },
  tapHint: { fontSize: 12, color: colors.textMuted, marginTop: 16 },
});
