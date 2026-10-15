/**
 * "Bienvenue": six one-tap questions so the app knows the member's habits before
 * his first scan. One card at a time, every card skippable, never a text field.
 *
 * Answers are saved card by card, so closing the app keeps what was already given.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CardShell, QuestionCard } from '../components/onboarding/BubbleCard';
import { colors } from '../theme';
import { haptics } from '../utils/haptics';
import { NotificationService } from '../services/notificationService';
import { HabitsService, today } from '../services/habitsService';
import {
  CardId,
  ClubRules,
  DAY_LABELS,
  DURATION_LABELS,
  FOCUS,
  PAID_WHEN_LABELS,
  STYLES,
  cardsFor,
  dotsFor,
  needsFocus,
  slotsFor,
  summaryLines,
} from '../onboarding/habitsFlow';
import {
  FocusMuscle,
  HabitsProfile,
  PaidWhen,
  SubDuration,
  TrainingStyle,
  UsualSlot,
  endOfMonthSubscription,
  estimateSubscription,
} from '../onboarding/habitsModel';

interface Props {
  firstName: string;
  userId: string;
  rules: ClubRules;
  initial: HabitsProfile;
  /** "Plus tard" or the last card: the flow is over either way. */
  onDone: (profile: HabitsProfile) => void;
  onSnooze: () => void;
  /** Card 8 offer for a beginner; absent when the club has no such community. */
  onJoinBeginners?: () => void;
}

export const HabitsQuestionnaire: React.FC<Props> = ({ firstName, userId, rules, initial, onDone, onSnooze, onJoinBeginners }) => {
  const [profile, setProfile] = useState<HabitsProfile>(initial);
  const [cardId, setCardId] = useState<CardId>((initial.resumeAt as CardId) || 'welcome');
  const direction = useRef<1 | -1>(1);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Multi-choice cards hold their picks locally until "Continuer".
  const [days, setDays] = useState<string[]>(
    initial.usualDaysVaries ? ['varies'] : (initial.usualDays ?? []).map(String)
  );
  const [focus, setFocus] = useState<string[]>(initial.focusMuscles);
  const [joined, setJoined] = useState(false);
  /** The first payment tap, held until the second one turns the pair into a date. */
  const [paidWhen, setPaidWhen] = useState<PaidWhen | null>(null);

  const cards = useMemo(() => cardsFor(rules, profile.trainingStyle), [rules, profile.trainingStyle]);
  const dots = useMemo(() => dotsFor(cards), [cards]);
  const step = dots.indexOf(cardId) + 1;

  useEffect(() => () => void (advanceTimer.current && clearTimeout(advanceTimer.current)), []);

  const persist = (patch: Partial<HabitsProfile>, next?: CardId) => {
    const merged = { ...profile, ...patch, resumeAt: next ?? cardId, onboardingStatus: 'partial' as const };
    setProfile(merged);
    HabitsService.save(userId, { ...patch, resumeAt: next ?? cardId, onboardingStatus: 'partial' });
    return merged;
  };

  const goTo = (id: CardId, dir: 1 | -1 = 1) => {
    direction.current = dir;
    setCardId(id);
  };

  /** The next card, computed against the answers as they are now. */
  const nextAfter = (id: CardId, style: TrainingStyle | null = profile.trainingStyle): CardId => {
    const list = cardsFor(rules, style);
    return list[Math.min(list.indexOf(id) + 1, list.length - 1)];
  };

  const prevOf = (id: CardId): CardId | undefined => {
    const i = cards.indexOf(id);
    return i > 0 ? cards[i - 1] : undefined;
  };

  /** Single-choice: let the fill animation land, then move on by itself. */
  const autoAdvance = (to: CardId) => {
    advanceTimer.current = setTimeout(() => goTo(to, 1), 350);
  };

  const skip = () => {
    haptics.light();
    goTo(nextAfter(cardId), 1);
  };

  const back = () => {
    const p = prevOf(cardId);
    if (p) goTo(p, -1);
  };

  const finish = async (p: HabitsProfile) => {
    const done = { ...p, onboardingStatus: 'done' as const, resumeAt: null };
    await HabitsService.save(userId, { onboardingStatus: 'done', resumeAt: null });
    onDone(done);
  };

  /* ---------- cards ---------- */

  if (cardId === 'welcome') {
    return (
      <SafeAreaView style={styles.screen}>
        <CardShell step={0} total={0} direction={direction.current} cardKey="welcome">
          <Text style={styles.title}>Salut {firstName} 👋</Text>
          <Text style={styles.body}>6 petites questions pour que l'appli connaisse tes habitudes. 30 secondes, promis.</Text>
          <Pressable
            onPress={() => {
              haptics.select();
              goTo(nextAfter('welcome'), 1);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryText}>C'est parti</Text>
          </Pressable>
          <Pressable onPress={onSnooze} accessibilityRole="button" style={styles.textBtn}>
            <Text style={styles.textBtnLabel}>Plus tard</Text>
          </Pressable>
        </CardShell>
      </SafeAreaView>
    );
  }

  if (cardId === 'days') {
    const options = [
      ...rules.openDays.map(d => ({ id: String(d), label: DAY_LABELS[d] })),
      { id: 'varies', label: 'Ça change chaque semaine' },
    ];
    const toggle = (id: string) => {
      // "Ça change" and precise days contradict each other: picking one clears the other.
      if (id === 'varies') setDays(d => (d.includes('varies') ? [] : ['varies']));
      else setDays(d => (d.includes(id) ? d.filter(x => x !== id) : [...d.filter(x => x !== 'varies'), id]));
    };
    const cont = () => {
      const varies = days.includes('varies');
      persist(
        { usualDaysVaries: varies, usualDays: varies ? null : days.map(Number).sort((a, b) => a - b) },
        nextAfter('days')
      );
      goTo(nextAfter('days'), 1);
    };
    return (
      <SafeAreaView style={styles.screen}>
        <CardShell step={step} total={dots.length} direction={direction.current} cardKey="days" onBack={back} onSkip={skip}>
          <QuestionCard
            title="Tu viens plutôt quels jours ?"
            sub="Choisis tes jours habituels."
            options={options.slice(0, -1)}
            selected={days}
            mode="multi"
            round
            onSelect={toggle}
          />
          <View style={styles.variesWrap}>
            <Pressable
              onPress={() => {
                haptics.select();
                toggle('varies');
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: days.includes('varies') }}
              style={[styles.wideBubble, days.includes('varies') && styles.wideBubbleOn]}
            >
              <Text style={[styles.wideBubbleText, days.includes('varies') && styles.wideBubbleTextOn]}>Ça change chaque semaine</Text>
            </Pressable>
          </View>
          {days.length > 0 ? (
            <Pressable onPress={cont} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
              <Text style={styles.primaryText}>Continuer</Text>
            </Pressable>
          ) : null}
        </CardShell>
      </SafeAreaView>
    );
  }

  if (cardId === 'time') {
    const options = [...slotsFor(rules).map(s => ({ id: s.id, label: s.label })), { id: 'varies', label: 'Ça dépend' }];
    return (
      <SafeAreaView style={styles.screen}>
        <CardShell step={step} total={dots.length} direction={direction.current} cardKey="time" onBack={back} onSkip={skip}>
          <QuestionCard
            title="Et à quelle heure, en général ?"
            options={options}
            selected={profile.usualSlot ? [profile.usualSlot] : []}
            mode="single"
            onSelect={id => {
              persist({ usualSlot: id as UsualSlot }, nextAfter('time'));
              autoAdvance(nextAfter('time'));
            }}
          />
        </CardShell>
      </SafeAreaView>
    );
  }

  if (cardId === 'style') {
    return (
      <SafeAreaView style={styles.screen}>
        <CardShell step={step} total={dots.length} direction={direction.current} cardKey="style" onBack={back} onSkip={skip}>
          <QuestionCard
            title="Tu t'entraînes comment ?"
            options={STYLES}
            selected={profile.trainingStyle ? [profile.trainingStyle] : []}
            mode="single"
            onSelect={id => {
              const style = id as TrainingStyle;
              // Focus only follows a split: clear it when the style no longer asks for it.
              persist(
                { trainingStyle: style, focusMuscles: needsFocus(style) ? profile.focusMuscles : [] },
                nextAfter('style', style)
              );
              autoAdvance(nextAfter('style', style));
            }}
          />
        </CardShell>
      </SafeAreaView>
    );
  }

  if (cardId === 'focus') {
    const cont = () => {
      persist({ focusMuscles: focus as FocusMuscle[] }, nextAfter('focus'));
      goTo(nextAfter('focus'), 1);
    };
    return (
      <SafeAreaView style={styles.screen}>
        <CardShell step={step} total={dots.length} direction={direction.current} cardKey="focus" onBack={back} onSkip={skip}>
          <QuestionCard
            title="Ce que tu travailles le plus en ce moment ?"
            sub="Plusieurs choix possibles."
            options={FOCUS}
            selected={focus}
            mode="multi"
            onSelect={id => setFocus(f => (f.includes(id) ? f.filter(x => x !== id) : [...f, id]))}
            onContinue={cont}
          />
        </CardShell>
      </SafeAreaView>
    );
  }

  if (cardId === 'paid_when') {
    return (
      <SafeAreaView style={styles.screen}>
        <CardShell step={step} total={dots.length} direction={direction.current} cardKey="paid_when" onBack={back} onSkip={skip}>
          <QuestionCard
            title="Tu as payé ton abonnement quand ?"
            sub="Pour te prévenir avant qu'il se termine. Rien d'autre."
            options={PAID_WHEN_LABELS}
            selected={[]}
            mode="single"
            onSelect={id => {
              // The date needs both taps: stored on the next card.
              persist({ subscriptionPaidAtSource: 'estimate' }, nextAfter('paid_when'));
              setPaidWhen(id as PaidWhen);
              autoAdvance(nextAfter('paid_when'));
            }}
          />
        </CardShell>
      </SafeAreaView>
    );
  }

  if (cardId === 'paid_len') {
    const options = DURATION_LABELS.filter(d => rules.durationsSold.includes(d.id));
    return (
      <SafeAreaView style={styles.screen}>
        <CardShell step={step} total={dots.length} direction={direction.current} cardKey="paid_len" onBack={back} onSkip={skip}>
          <QuestionCard
            title="C'était pour combien de temps ?"
            options={options}
            selected={profile.subscriptionDuration ? [profile.subscriptionDuration] : []}
            mode="single"
            onSelect={id => {
              const duration = id as SubDuration;
              const est = estimateSubscription(paidWhen ?? 'unknown', duration, today());
              persist(
                {
                  subscriptionDuration: duration,
                  subscriptionPaidAt: est.paidAt,
                  subscriptionPaidAtMarginDays: est.margin,
                  subscriptionPaidAtSource: est.paidAt ? 'estimate' : null,
                  subscriptionEndsAt: est.endsAt,
                },
                nextAfter('paid_len')
              );
              autoAdvance(nextAfter('paid_len'));
            }}
          />
        </CardShell>
      </SafeAreaView>
    );
  }

  if (cardId === 'notifications') {
    const lines = [
      { icon: '🟢', text: 'Quand la salle est calme à ton heure habituelle' },
      { icon: '⏰', text: "Quelques jours avant la fin de ton abonnement" },
      { icon: '📣', text: 'Les infos et promos de ton club' },
    ];
    return (
      <SafeAreaView style={styles.screen}>
        <CardShell step={step} total={dots.length} direction={direction.current} cardKey="notifications" onBack={back} onSkip={skip}>
          <Text style={styles.title}>On te prévient au bon moment ?</Text>
          <View style={styles.lines}>
            {lines.map(l => (
              <View key={l.text} style={styles.line}>
                <Text style={styles.lineIcon}>{l.icon}</Text>
                <Text style={styles.lineText}>{l.text}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={async () => {
              haptics.select();
              // The soft ask came first; only now does the OS popup appear.
              await NotificationService.enable();
              goTo(nextAfter('notifications'), 1);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryText}>Oui, ça marche</Text>
          </Pressable>
          <Pressable onPress={() => goTo(nextAfter('notifications'), 1)} accessibilityRole="button" style={styles.textBtn}>
            <Text style={styles.textBtnLabel}>Pas maintenant</Text>
          </Pressable>
        </CardShell>
      </SafeAreaView>
    );
  }

  // Card 8: done
  const lines = summaryLines(profile);
  return (
    <SafeAreaView style={styles.screen}>
      <CardShell step={0} total={0} direction={direction.current} cardKey="done">
        <Text style={styles.title}>C'est prêt ✓</Text>
        <View style={styles.lines}>
          {lines.map(l => (
            <Text key={l} style={styles.summary}>
              {l}
            </Text>
          ))}
        </View>

        {profile.trainingStyle === 'beginner' && onJoinBeginners && !joined ? (
          <Pressable
            onPress={() => {
              haptics.success();
              setJoined(true);
              onJoinBeginners();
            }}
            accessibilityRole="button"
            style={styles.suggest}
          >
            <Ionicons name="people-outline" size={18} color={colors.brand} />
            <Text style={styles.suggestText}>Rejoindre la communauté Débutants</Text>
          </Pressable>
        ) : null}
        {joined ? <Text style={styles.joined}>✓ Tu as rejoint Débutants</Text> : null}

        <Pressable
          onPress={() => finish(profile)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryText}>Voir mon club</Text>
        </Pressable>
        <Text style={styles.foot}>Tu peux tout changer dans Profil › Mes habitudes.</Text>
      </CardShell>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 23, fontWeight: '800', color: colors.text, textAlign: 'center', lineHeight: 30 },
  body: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 6 },

  primary: { marginTop: 18, minHeight: 50, borderRadius: 25, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  textBtn: { marginTop: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  textBtnLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '700' },

  variesWrap: { marginTop: 10, alignItems: 'center' },
  wideBubble: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border },
  wideBubbleOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  wideBubbleText: { fontSize: 15, fontWeight: '700', color: colors.text },
  wideBubbleTextOn: { color: colors.white },

  lines: { marginTop: 14, gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineIcon: { fontSize: 18 },
  lineText: { flex: 1, fontSize: 15, color: colors.textSecondary, lineHeight: 21 },
  summary: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  suggest: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.brand,
    paddingHorizontal: 16,
  },
  suggestText: { color: colors.brand, fontSize: 15, fontWeight: '800' },
  joined: { marginTop: 14, textAlign: 'center', color: colors.green.text, fontSize: 15, fontWeight: '700' },

  foot: { marginTop: 12, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
