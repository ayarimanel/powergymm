import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { Workout, dayLabel, doneSets, exById, fmtInt, fmtNum, muscleById, num, summarizeSets, workoutSets, workoutVolume } from '../journalLogic';
import { haptics } from '../../utils/haptics';
import { ExerciseLines } from './JournalHome';
import { Btn, Card, Dot, J, Link, Pill, k, tabular, tint } from './kit';
import { buttonShadow, colors, fonts, radius } from '../../theme';
import { Icon } from '../../components/ui/Icon';
import { Title } from '../../components/ui/Title';

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
      {/* Top bar: back to the journal · clock · finish (design-ref Seance) */}
      <View style={s.topBar}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour au journal" style={s.round}>
          <Icon name="chevron-back" size={22} color={J.fg} />
        </Pressable>
        <View style={s.clockRow}>
          {workout.live && <Icon name="time-outline" size={20} color={J.muted} />}
          <Text style={[s.clock, tabular]}>{workout.live ? mmss(secs) : dayLabel(workout.date)}</Text>
        </View>
        <Pressable onPress={onFinish} accessibilityRole="button" style={s.finishPill}>
          <Text style={s.finishText}>Terminer</Text>
        </Pressable>
      </View>

      <View>
        <Text style={s.over}>{workout.live ? 'Séance en cours' : `Séance du ${dayLabel(workout.date)}`}</Text>
        <Title variant="display" size={40}>Ta séance</Title>
      </View>
      <View style={s.kpis}>
        {([[workoutSets(workout), 'séries'], [fmtInt(workoutVolume(workout)), 'kg'], [prs, 'PR']] as [string | number, string][]).map(([v, l]) => (
          <View key={l} style={s.kpi}>
            <Text style={[s.kpiV, tabular]}>{v}</Text>
            <Text style={s.kpiL}>{l}</Text>
          </View>
        ))}
      </View>

      {workout.exercises.length ? (
        <View style={{ gap: 8 }}>
          {workout.exercises.map((e, i) => {
            const meta = exById(e.exerciseId);
            if (!meta) return null;
            const d = doneSets(e).length;
            return (
              <Pressable key={e.exerciseId} onPress={() => onOpen(i)} accessibilityRole="button" style={({ pressed }) => [s.sessEx, pressed && { opacity: 0.85 }]}>
                <View style={s.exNum}>
                  <Text style={[s.exNumText, tabular]}>{i + 1}</Text>
                </View>
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
                <Icon name="chevron-forward" size={18} color={J.muted} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={s.emptyCard}>Ajoute ton premier exercice.</Text>
      )}

      <Pressable onPress={onAdd} accessibilityRole="button" style={({ pressed }) => [s.addEx, pressed && { opacity: 0.8 }]}>
        <Icon name="add" size={20} color={J.fg} />
        <Text style={s.addExText}>Ajouter un exercice</Text>
      </Pressable>
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
/** Rest lengths offered in the timer (design-ref Seance). */
const REST_PRESETS = [60, 90, 120];

export const RestTimer: React.FC<{ rest: Rest; now: Date; onAdd: (s: number) => void; onSkip: () => void; onLength?: (s: number) => void }> = ({ rest, now, onAdd, onSkip, onLength }) => {
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
      {/* design-ref Seance "Repos": timer icon, big countdown, red progress, pill buttons */}
      <View style={s.restHead}>
        <Icon name="timer" size={22} color={J.accent} />
        <Text style={s.restLbl}>Repos</Text>
        <Text style={[s.restT, tabular]}>{mmss(Math.max(0, left))}</Text>
      </View>
      <View style={s.restTrack}>
        <View style={[s.restBar, { width: `${pct}%` }]} />
      </View>
      {onLength && (
        <View style={s.restBtns} accessibilityRole="radiogroup">
          {REST_PRESETS.map(p => {
            const on = rest.total === p;
            return (
              <Pressable key={p} onPress={() => onLength(p)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Repos de ${p} secondes`} style={[s.restBtn, on && s.restPresetOn]}>
                <Text style={[s.restBtnText, on && { color: J.accentText }]}>{p} s</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={s.restBtns}>
        <Pressable onPress={() => onAdd(-15)} accessibilityRole="button" style={s.restBtn}><Text style={s.restBtnText}>−15 s</Text></Pressable>
        <Pressable onPress={() => onAdd(15)} accessibilityRole="button" style={s.restBtn}><Text style={s.restBtnText}>+15 s</Text></Pressable>
        <Pressable onPress={onSkip} accessibilityRole="button" style={[s.restBtn, s.restSkip]}><Text style={[s.restBtnText, { color: J.accentText }]}>Passer</Text></Pressable>
      </View>
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
          <Icon name="checkmark" size={44} color={colors.white} />
        </Animated.View>
        <Title variant="display" size={36} style={{ textAlign: 'center' }}>Séance enregistrée</Title>
        <View style={s.chips}>
          {muscles.map(m => (
            <Text key={m.id} style={[s.chip, { backgroundColor: tint(m.color, 15), color: m.color }]}>{m.name}</Text>
          ))}
        </View>
        <View style={[s.kpis, { alignSelf: 'stretch' }]}>
          {([[workout.live ? mins : '–', 'min'], [workout.exercises.length, 'exos'], [workoutSets(workout), 'séries'], [fmtInt(workoutVolume(workout)), 'kg']] as [string | number, string][]).map(([v, l]) => (
            <View key={l} style={s.kpi}>
              <Text style={[s.kpiV, tabular]}>{v}</Text>
              <Text style={s.kpiL}>{l}</Text>
            </View>
          ))}
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
  stack: { gap: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clock: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 28, lineHeight: 30, color: J.fg },
  finishPill: { height: 44, paddingHorizontal: 20, borderRadius: 999, backgroundColor: J.accent, alignItems: 'center', justifyContent: 'center' },
  finishText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  over: { fontSize: 12, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: J.accentText, marginBottom: 4 },

  kpis: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, gap: 2, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 18, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  kpiV: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 26, lineHeight: 28, color: J.fg },
  kpiL: { fontSize: 12, fontWeight: '500', color: J.muted },

  sessEx: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 14 },
  exNum: { width: 36, height: 36, borderRadius: 12, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  exNumText: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 18, color: J.fg },
  exName: { fontSize: 15, fontWeight: '800', color: J.fg },
  exSub: { fontSize: 13, color: J.muted, marginTop: 2 },
  emptyCard: { backgroundColor: J.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: J.line, borderRadius: 20, padding: 18, textAlign: 'center', color: J.muted, fontSize: 14 },
  addEx: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.disabled },
  addExText: { fontSize: 15, fontWeight: '700', color: J.fg },
  confirm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  confirmText: { fontSize: 12, color: J.muted },

  active: { position: 'absolute', left: 16, right: 16, bottom: 12, zIndex: 40, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  live: { width: 10, height: 10, borderRadius: 5, backgroundColor: J.tired },
  activeTitle: { color: J.fg, fontSize: 14, fontWeight: '800' },
  activeSub: { color: J.muted, fontSize: 12 },
  activeGo: { backgroundColor: J.accent, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  activeGoText: { color: colors.white, fontWeight: '800', fontSize: 13 },

  rest: { position: 'absolute', left: 16, right: 16, bottom: 12, zIndex: 45, gap: 12, borderRadius: radius.cardLg, paddingVertical: 16, paddingHorizontal: 18, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  restHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  restLbl: { flex: 1, color: J.fg, fontSize: 16, fontWeight: '800' },
  restT: { fontFamily: fonts.headingBlack, fontWeight: 'normal', color: J.fg, fontSize: 38, lineHeight: 40 },
  restTrack: { height: 6, borderRadius: 3, backgroundColor: J.surface2, overflow: 'hidden' },
  restBar: { height: 6, borderRadius: 3, backgroundColor: J.accent },
  restBtns: { flexDirection: 'row', gap: 8 },
  restBtn: { flex: 1, height: 42, borderRadius: 999, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  restSkip: { backgroundColor: J.accentSoft },
  restPresetOn: { backgroundColor: J.accentSoft, borderWidth: 1, borderColor: J.accent },
  restBtnText: { color: J.fg, fontSize: 14, fontWeight: '700' },

  done: { alignItems: 'center', gap: 14, paddingVertical: 24 },
  doneIc: { width: 88, height: 88, borderRadius: 44, backgroundColor: J.ok, alignItems: 'center', justifyContent: 'center' },
  doneIcText: { color: colors.white, fontSize: 26, fontWeight: '900' },
  doneTitle: { fontSize: 20, fontWeight: '800', color: J.fg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { fontSize: 12, fontWeight: '800', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, overflow: 'hidden' },
  prs: { backgroundColor: J.goldSoft, borderColor: J.goldBright },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  prName: { fontSize: 14, color: J.fg },
  prVal: { fontSize: 14, fontWeight: '800', color: J.fg },

  toast: { position: 'absolute', alignSelf: 'center', bottom: 90, zIndex: 80, backgroundColor: J.fg, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, maxWidth: '88%' },
  toastText: { color: colors.onInverse, fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
