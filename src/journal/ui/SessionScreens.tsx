import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { Workout, dayLabel, doneSets, exById, fmtInt, fmtNum, muscleById, num, summarizeSets, workoutSets, workoutVolume } from '../journalLogic';
import { haptics } from '../../utils/haptics';
import { ExerciseLines } from './JournalHome';
import { Btn, Card, Dot, J, Kpis, Link, Pill, k, tabular, tint } from './kit';
import { colors } from '../../theme';
import { Icon } from '../../components/ui/Icon';

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const nativeDriver = Platform.OS !== 'web';

/* ---------- session ---------- */
export const Session: React.FC<{
  workout: Workout;
  now: Date;
  onOpen: (i: number) => void;
  onAdd: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onBack: () => void;
}> = ({ workout, now, onOpen, onAdd, onFinish, onCancel, onBack }) => {
  const [confirm, setConfirm] = useState(false);
  const secs = Math.max(0, (+now - +new Date(workout.startedAt)) / 1000);
  const prs = workout.exercises.reduce((a, e) => a + e.sets.filter(x => x.pr && x.done).length, 0);
  return (
    <View style={s.stack}>
      <Link label="‹ Journal" onPress={onBack} />
      <Card style={s.sessHead}>
        <View>
          <Text style={s.caps}>{workout.live ? 'Séance en cours' : `Séance du ${dayLabel(workout.date)}`}</Text>
          <Text style={[s.clock, tabular]}>{workout.live ? mmss(secs) : dayLabel(workout.date)}</Text>
        </View>
        <Kpis tight items={[[workoutSets(workout), 'séries'], [fmtInt(workoutVolume(workout)), 'kg'], [prs, 'PR']]} />
      </Card>

      {workout.exercises.length ? (
        <View style={{ gap: 8 }}>
          {workout.exercises.map((e, i) => {
            const meta = exById(e.exerciseId);
            if (!meta) return null;
            const d = doneSets(e).length;
            return (
              <Pressable key={e.exerciseId} onPress={() => onOpen(i)} accessibilityRole="button" style={({ pressed }) => [s.sessEx, pressed && { opacity: 0.85 }]}>
                <Dot color={muscleById(meta.muscle).color} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.exName} numberOfLines={1}>
                    {meta.name}
                    {e.sets.some(x => x.pr && x.done) && <Text style={k.prMini}> PR </Text>}
                  </Text>
                  <Text style={s.exSub} numberOfLines={1}>
                    {d ? summarizeSets(e.sets, meta.kind) : `${e.sets.length} série${e.sets.length > 1 ? 's' : ''} prévue${e.sets.length > 1 ? 's' : ''} · rien de validé`}
                  </Text>
                </View>
                <Pill tone={d ? 'ok' : 'never'} label={`${d}/${e.sets.length}`} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={s.emptyCard}>Ajoute ton premier exercice.</Text>
      )}

      <Btn full variant="soft" label="+ Ajouter un exercice" onPress={onAdd} />
      <Btn full label="Terminer la séance" onPress={onFinish} />
      {confirm ? (
        <View style={s.confirm}>
          <Text style={s.confirmText}>Tout effacer ?</Text>
          <Btn small variant="danger" label="Oui, annuler" onPress={onCancel} />
          <Btn small variant="ghost" label="Non" onPress={() => setConfirm(false)} />
        </View>
      ) : (
        <Link muted label="Annuler la séance" onPress={() => setConfirm(true)} style={{ alignSelf: 'center' }} />
      )}
    </View>
  );
};

/* ---------- floating bar while a session runs ---------- */
export const ActiveBar: React.FC<{ workout: Workout; now: Date; onResume: () => void }> = ({ workout, now, onResume }) => {
  const secs = Math.max(0, (+now - +new Date(workout.startedAt)) / 1000);
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(blink, { toValue: 0.3, duration: 700, useNativeDriver: nativeDriver }), Animated.timing(blink, { toValue: 1, duration: 700, useNativeDriver: nativeDriver })]));
    a.start();
    return () => a.stop();
  }, [blink]);
  return (
    <Pressable onPress={onResume} accessibilityRole="button" style={s.active}>
      <Animated.View style={[s.live, { opacity: blink }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.activeTitle} numberOfLines={1}>{workout.live ? `Séance en cours · ${mmss(secs)}` : `Séance du ${dayLabel(workout.date)}`}</Text>
        <Text style={s.activeSub}>{workoutSets(workout)} séries validées</Text>
      </View>
      <View style={s.activeGo}>
        <Text style={s.activeGoText}>Reprendre</Text>
      </View>
    </Pressable>
  );
};

/* ---------- rest timer ---------- */
export interface Rest {
  end: number;
  total: number;
}
export const RestTimer: React.FC<{ rest: Rest; now: Date; onAdd: (s: number) => void; onSkip: () => void }> = ({ rest, now, onAdd, onSkip }) => {
  const left = Math.ceil((rest.end - +now) / 1000);
  useEffect(() => {
    if (left <= 0) {
      if (Platform.OS === 'web') {
        try {
          navigator.vibrate?.(300);
        } catch {
          /* not allowed */
        }
      } else Vibration.vibrate(300);
      haptics.success();
      onSkip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left <= 0]);
  const pct = Math.max(0, Math.min(100, (left / rest.total) * 100));
  return (
    <View style={s.rest} accessibilityRole="timer" accessibilityLabel={`Repos, ${Math.max(0, left)} secondes`}>
      <View style={[s.restBar, { width: `${pct}%` }]} />
      <View style={{ marginRight: 'auto' }}>
        <Text style={s.restLbl}>Repos</Text>
        <Text style={[s.restT, tabular]}>{mmss(Math.max(0, left))}</Text>
      </View>
      <Pressable onPress={() => onAdd(-15)} accessibilityRole="button" style={s.restBtn}><Text style={s.restBtnText}>−15 s</Text></Pressable>
      <Pressable onPress={() => onAdd(15)} accessibilityRole="button" style={s.restBtn}><Text style={s.restBtnText}>+15 s</Text></Pressable>
      <Pressable onPress={onSkip} accessibilityRole="button" style={[s.restBtn, { backgroundColor: colors.white }]}><Text style={[s.restBtnText, { color: J.accent }]}>Passer</Text></Pressable>
    </View>
  );
};

/* ---------- summary ---------- */
export const Summary: React.FC<{ workout: Workout; onClose: () => void }> = ({ workout, onClose }) => {
  const mins = Math.max(1, Math.round((+new Date(workout.endedAt!) - +new Date(workout.startedAt)) / 60000));
  const prs = workout.exercises.flatMap(e => e.sets.filter(x => x.pr).map(x => ({ name: exById(e.exerciseId)!.name, x })));
  const muscles = [...new Set(workout.exercises.map(e => exById(e.exerciseId)!.muscle))].map(muscleById);
  const pop = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: nativeDriver, speed: 14, bounciness: 14 }).start();
  }, [pop]);
  return (
    <View style={s.stack}>
      <Card style={s.done}>
        <Animated.View style={[s.doneIc, { transform: [{ scale: pop }] }]}>
          <Icon name="checkmark" size={28} color={colors.white} />
        </Animated.View>
        <Text style={s.doneTitle}>Séance enregistrée</Text>
        <View style={s.chips}>
          {muscles.map(m => (
            <Text key={m.id} style={[s.chip, { backgroundColor: tint(m.color, 15), color: m.color }]}>{m.name}</Text>
          ))}
        </View>
        <View style={{ alignSelf: 'stretch' }}>
          <Kpis items={[[workout.live ? mins : '–', 'min'], [workout.exercises.length, 'exos'], [workoutSets(workout), 'séries'], [fmtInt(workoutVolume(workout)), 'kg']]} />
        </View>
      </Card>
      {prs.length > 0 && (
        <Card style={s.prs}>
          <Text style={[k.h2, { color: J.gold, marginBottom: 8 }]}>{prs.length === 1 ? 'Nouveau record' : `${prs.length} nouveaux records`}</Text>
          {prs.map((p, i) => (
            <View key={i} style={s.prRow}>
              <Text style={s.prName}>{p.name}</Text>
              <Text style={[s.prVal, tabular]}>{fmtNum(num(p.x.kg))} kg × {num(p.x.reps)}</Text>
            </View>
          ))}
        </Card>
      )}
      <Card>
        <ExerciseLines workout={workout} />
      </Card>
      {/* A session stays private: it is never announced in the communities. */}
      <Btn full label="Retour au journal" onPress={onClose} />
    </View>
  );
};

/* ---------- toast ---------- */
export const Toast: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <View style={s.toast} pointerEvents="none" accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Text style={s.toastText}>{message}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  stack: { gap: 12 },
  sessHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  caps: { fontSize: 11, fontWeight: '800', color: J.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  clock: { fontSize: 38, fontWeight: '900', color: J.fg, lineHeight: 42 },
  sessEx: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line, borderRadius: 16, padding: 12 },
  exName: { fontSize: 14, fontWeight: '800', color: J.fg },
  exSub: { fontSize: 12, color: J.muted },
  emptyCard: { backgroundColor: J.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: J.line, borderRadius: 16, padding: 16, textAlign: 'center', color: J.muted, fontSize: 13 },
  confirm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  confirmText: { fontSize: 12, color: J.muted },

  active: { position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 40, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: J.fg, shadowColor: colors.black, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8 },
  live: { width: 10, height: 10, borderRadius: 5, backgroundColor: J.tired },
  activeTitle: { color: colors.onInverse, fontSize: 13, fontWeight: '800' },
  activeSub: { color: colors.textMuted, fontSize: 11 },
  activeGo: { backgroundColor: J.accent, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  activeGoText: { color: colors.white, fontWeight: '800', fontSize: 12 },

  rest: { position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 45, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: J.accent, overflow: 'hidden', shadowColor: J.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8 },
  restBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.18)' },
  restLbl: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800' },
  restT: { color: colors.white, fontSize: 26, fontWeight: '900', lineHeight: 28 },
  restBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 10 },
  restBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },

  done: { alignItems: 'center', gap: 10 },
  doneIc: { width: 56, height: 56, borderRadius: 28, backgroundColor: J.ok, alignItems: 'center', justifyContent: 'center' },
  doneIcText: { color: colors.white, fontSize: 26, fontWeight: '900' },
  doneTitle: { fontSize: 20, fontWeight: '800', color: J.fg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { fontSize: 12, fontWeight: '800', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, overflow: 'hidden' },
  prs: { backgroundColor: J.goldSoft, borderColor: 'transparent' },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  prName: { fontSize: 13, color: J.fg },
  prVal: { fontSize: 13, fontWeight: '800', color: J.fg },

  toast: { position: 'absolute', alignSelf: 'center', bottom: 90, zIndex: 80, backgroundColor: J.fg, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, maxWidth: '88%' },
  toastText: { color: colors.onInverse, fontSize: 12, fontWeight: '800', textAlign: 'center' },
});
