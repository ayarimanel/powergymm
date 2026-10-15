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
import { colors } from '../../theme';
import { Title } from '../ui/Title';
import { Button } from '../ui/Button';
import { SegmentedProgress } from '../ui/SegmentedProgress';
import { useReduceMotion } from '../../hooks/useDeviceState';
import { haptics } from '../../utils/haptics';
import { withoutEmoji } from '../ui/displayText';

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
        <Pressable onPress={onBack} disabled={!onBack} accessibilityRole="button" accessibilityLabel="Retour" style={[styles.backBtn, !onBack && styles.backBtnHidden]}>
          {onBack ? <Icon name="chevron-back" size={24} color={colors.text} /> : null}
        </Pressable>

        <View style={styles.dots} accessibilityLabel={total ? `Question ${step} sur ${total}` : undefined}>
          {total ? <SegmentedProgress current={step} total={total} /> : null}
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
      <Title variant="display" size={38}>{title}</Title>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}

      <View style={[styles.bubbles, round && styles.bubblesRow]}>
        {options.map((o, i) => (
          <Bubble
            key={o.id}
            label={withoutEmoji(o.label)}
            selected={selected.includes(o.id)}
            onPress={() => onSelect(o.id)}
            index={i}
            round={round}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>

      {mode === 'multi' && selected.length > 0 && onContinue ? (
        <Button label="Continuer" onPress={onContinue} style={styles.primary} />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 64 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  backBtnHidden: { backgroundColor: 'transparent' },
  topBtn: { minWidth: 56, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skip: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  dots: { flex: 1, flexDirection: 'row', alignItems: 'center' },

  cardWrap: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  // The question sits on the page (design-ref sign-up screens): no box around it.
  card: { paddingTop: 22, gap: 6 },

  sub: { fontSize: 15, fontWeight: '500', lineHeight: 22, color: colors.textSecondary, marginTop: 4 },

  bubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  bubblesRow: { flexWrap: 'nowrap', gap: 6, justifyContent: 'space-between' },

  bubble: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  bubbleRound: { width: 42, height: 48, paddingHorizontal: 0, alignItems: 'center' },
  bubbleOn: { backgroundColor: colors.text, borderColor: colors.text },
  bubbleText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  bubbleTextOn: { color: colors.onInverse },

  primary: { marginTop: 28 },
});
