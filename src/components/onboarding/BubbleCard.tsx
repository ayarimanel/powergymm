/**
 * The questionnaire's card: one question, answers as bubbles.
 *
 * Built on the app's existing tokens (theme colors, 20px card radius, chip shapes
 * from MuscleChips) rather than a second design system. Motion: the card slides in
 * from the side you moved towards, bubbles pop in one after the other, and a tap
 * fills the bubble with the brand color. Reduced motion drops all of it to a fade.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { colors, cardShadow } from '../../theme';
import { useReduceMotion } from '../../hooks/useDeviceState';
import { haptics } from '../../utils/haptics';

const nativeDriver = Platform.OS !== 'web';

export interface BubbleOption {
  id: string;
  label: string;
}

/* ---------- one bubble ---------- */

const Bubble: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
  index: number;
  round?: boolean;
  reduceMotion: boolean;
}> = ({ label, selected, onPress, index, round, reduceMotion }) => {
  const appear = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  // 40 ms apart, so the answers arrive in a wave instead of all at once.
  useEffect(() => {
    if (reduceMotion) {
      appear.setValue(1);
      return;
    }
    const t = setTimeout(() => {
      Animated.spring(appear, { toValue: 1, useNativeDriver: nativeDriver, speed: 20, bounciness: 10 }).start();
    }, index * 40);
    return () => clearTimeout(t);
  }, [appear, index, reduceMotion]);

  useEffect(() => {
    Animated.spring(press, { toValue: selected ? 1.06 : 1, useNativeDriver: nativeDriver, speed: 30, bounciness: 12 }).start();
  }, [selected, press]);

  return (
    <Animated.View style={{ opacity: appear, transform: [{ scale: reduceMotion ? press : Animated.multiply(appear, press) }] }}>
      <Pressable
        onPress={() => {
          haptics.select();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        style={[styles.bubble, round && styles.bubbleRound, selected && styles.bubbleOn]}
      >
        <Text style={[styles.bubbleText, selected && styles.bubbleTextOn]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

/* ---------- the card chrome ---------- */

interface ShellProps {
  /** 1-based position among the question cards; 0 hides the dots. */
  step: number;
  total: number;
  direction: 1 | -1;
  cardKey: string;
  onBack?: () => void;
  onSkip?: () => void;
  children: React.ReactNode;
}

export const CardShell: React.FC<ShellProps> = ({ step, total, direction, cardKey, onBack, onSkip, children }) => {
  const reduceMotion = useReduceMotion();
  const enter = useRef(new Animated.Value(1)).current;

  // Hide before paint, slide on the next frame: a heavy card cannot eat the animation.
  useEffect(() => {
    enter.setValue(0);
    const frame = requestAnimationFrame(() =>
      Animated.timing(enter, {
        toValue: 1,
        duration: reduceMotion ? 140 : 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: nativeDriver,
      }).start()
    );
    return () => cancelAnimationFrame(frame);
  }, [cardKey, enter, reduceMotion]);

  return (
    <View style={styles.shell}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} disabled={!onBack} accessibilityRole="button" accessibilityLabel="Retour" style={styles.topBtn}>
          {onBack ? <Icon name="arrow-back" size={22} color={colors.textSecondary} /> : null}
        </Pressable>

        <View style={styles.dots} accessibilityLabel={total ? `Question ${step} sur ${total}` : undefined}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.dot, i < step && styles.dotOn]} />
          ))}
        </View>

        <Pressable onPress={onSkip} disabled={!onSkip} accessibilityRole="button" style={styles.topBtn}>
          {onSkip ? <Text style={styles.skip}>Passer</Text> : null}
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.cardWrap,
          {
            opacity: enter,
            transform: [
              { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : direction * 48, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.card}>{children}</View>
      </Animated.View>
    </View>
  );
};

/* ---------- a question ---------- */

interface QuestionProps {
  title: string;
  sub?: string;
  options: BubbleOption[];
  selected: string[];
  mode: 'single' | 'multi';
  /** Round day bubbles, kept on one row. */
  round?: boolean;
  onSelect: (id: string) => void;
  onContinue?: () => void;
}

export const QuestionCard: React.FC<QuestionProps> = ({ title, sub, options, selected, mode, round, onSelect, onContinue }) => {
  const reduceMotion = useReduceMotion();
  return (
    <>
      <Text style={styles.title}>{title}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}

      <View style={[styles.bubbles, round && styles.bubblesRow]}>
        {options.map((o, i) => (
          <Bubble
            key={o.id}
            label={o.label}
            selected={selected.includes(o.id)}
            onPress={() => onSelect(o.id)}
            index={i}
            round={round}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>

      {mode === 'multi' && selected.length > 0 && onContinue ? (
        <Pressable onPress={onContinue} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
          <Text style={styles.primaryText}>Continuer</Text>
        </Pressable>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 16, justifyContent: 'center' },
  topBar: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBtn: { minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skip: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.brand, width: 18 },

  cardWrap: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 6,
    ...cardShadow,
  },

  title: { fontSize: 23, fontWeight: '800', color: colors.text, textAlign: 'center', lineHeight: 30 },
  sub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 4 },

  bubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 },
  bubblesRow: { flexWrap: 'nowrap', gap: 6 },

  bubble: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  bubbleRound: { width: 40, height: 48, paddingHorizontal: 0, alignItems: 'center', borderRadius: 22 },
  bubbleOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  bubbleText: { fontSize: 15, fontWeight: '700', color: colors.text },
  bubbleTextOn: { color: colors.white },

  primary: { marginTop: 16, minHeight: 50, borderRadius: 25, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
