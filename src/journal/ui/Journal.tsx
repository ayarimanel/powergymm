import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { MuscleGroup } from '../../types/database';
import {
  CustomExercise, ExerciseKind, Workout, WorkoutSet, dayKey, doneSets, exById, fmtKg, fmtNum, isNewRecord, lastPerformance, nextSet,
  cloneForRepeat, setCustomExercises, workoutSets, workoutVolume,
} from '../journalLogic';
import { SyncInfo, newId } from '../journalSync';
import { haptics } from '../../utils/haptics';
import { JournalHome } from './JournalHome';
import { Logger } from './Logger';
import { MuscleSheet, SheetState } from './MuscleSheet';
import { ActiveBar, Rest, RestTimer, Session, Summary, Toast } from './SessionScreens';
import { J, tabular } from './kit';
import { colors } from '../../theme';

/**
 * Journal. One component, internal navigation:
 *   home ──tap muscle / body──▶ MuscleSheet ──tap exercise──▶ Logger ◀──▶ Session ──finish──▶ Summary
 */
interface Props {
  history: Workout[];
  customExercises: CustomExercise[];
  draft: Workout | null;
  onDraftChange: (w: Workout | null) => void;
  onSaveWorkout: (w: Workout) => Promise<void>;
  onDeleteWorkout: (id: string) => Promise<void>;
  onCreateExercise: (ex: CustomExercise) => Promise<{ id: string }>;
  sync: SyncInfo;
  /** Changes each time another page asks to start a session (after a scan at the entrance). */
  startToken?: number;
  /** Tab re-tapped: back to the top. */
  scrollRef?: React.RefObject<ScrollView | null>;
}

const REST_DEFAULT = 90;
let handledStartToken = 0;

function useTick(active: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export const Journal: React.FC<Props> = ({ history, customExercises, draft, onDraftChange, onSaveWorkout, onDeleteWorkout, onCreateExercise, sync, startToken, scrollRef }) => {
  setCustomExercises(customExercises); // keep the catalog in sync before rendering anything

  type Screen = 'home' | 'logger' | 'session' | 'summary';
  const [screen, setScreen] = useState<Screen>(draft ? 'session' : 'home');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [active, setActive] = useState<Workout | null>(draft);
  const [exIdx, setExIdx] = useState(0);
  const [selDay, setSelDay] = useState(() => new Date());
  const [rest, setRest] = useState<Rest | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [finished, setFinished] = useState<Workout | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localRef = useRef<ScrollView>(null);
  const scroller = scrollRef ?? localRef;
  const now = useTick(!!active || !!rest);

  useEffect(() => {
    onDraftChange(active);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [screen, exIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const say = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // "previous" and records use the saved history + the session in progress
  const allHistory = useMemo(() => (active ? [...history.filter(x => x.id !== active.id), active] : history), [history, active]);

  /* ---- actions ---- */
  const startWorkout = (date: Date = new Date()) => {
    const isToday = dayKey(date) === dayKey(new Date());
    const d = isToday ? new Date() : new Date(new Date(date).setHours(18, 0, 0, 0));
    const w: Workout = { id: newId(), date: d.toISOString(), startedAt: new Date().toISOString(), live: isToday, exercises: [] };
    setActive(w);
    return w;
  };

  // Scan at the entrance → "Commencer ta séance ?" → here. The tab mounts fresh, so the
  // last handled request is remembered outside the component.
  useEffect(() => {
    if (!startToken || startToken <= handledStartToken) return;
    handledStartToken = startToken;
    if (active) setScreen('session');
    else {
      setSelDay(new Date());
      startWorkout(new Date());
      setScreen('home');
      setSheet({ picker: true });
    }
  }, [startToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const openExercise = (exerciseId: string) => {
    let w = active || startWorkout(selDay);
    let idx = w.exercises.findIndex(e => e.exerciseId === exerciseId);
    if (idx === -1) {
      const ex = exById(exerciseId)!;
      const last = lastPerformance(history, exerciseId, new Date(w.date));
      const sets: WorkoutSet[] = last
        ? last.sets.map(x => (ex.kind === 'cardio' ? { min: x.min, km: x.km, done: false } : { kg: x.kg, reps: x.reps, done: false }))
        : [nextSet([], null, ex.kind)];
      w = { ...w, exercises: [...w.exercises, { exerciseId, sets }] };
      idx = w.exercises.length - 1;
      setActive(w);
    }
    setExIdx(idx);
    setSheet(null);
    setScreen('logger');
  };

  const updateSets = (fn: (sets: WorkoutSet[]) => WorkoutSet[]) =>
    setActive(w => (w ? { ...w, exercises: w.exercises.map((e, i) => (i === exIdx ? { ...e, sets: fn(e.sets) } : e)) } : w));

  const toggleDone = (i: number) => {
    if (!active) return;
    const ex = active.exercises[exIdx];
    const meta = exById(ex.exerciseId)!;
    const x = ex.sets[i];
    const willBeDone = !x.done;
    const candidate = { ...x, done: willBeDone };
    const pr = meta.kind !== 'cardio' && willBeDone && isNewRecord(history, ex.exerciseId, candidate, active.id);
    updateSets(sets => sets.map((y, j) => (j === i ? { ...candidate, pr } : y)));
    if (willBeDone) haptics.light();
    if (pr) {
      haptics.success();
      say(`Nouveau record : ${fmtNum(Number(String(x.kg).replace(',', '.')) || 0)} kg × ${x.reps} !`);
    }
    if (willBeDone && active.live && meta.kind !== 'cardio') setRest({ end: Date.now() + REST_DEFAULT * 1000, total: REST_DEFAULT });
  };

  const finishWorkout = async () => {
    if (!active) return;
    const cleaned: Workout = {
      ...active,
      endedAt: new Date().toISOString(),
      exercises: active.exercises.map(e => ({ ...e, sets: doneSets(e) })).filter(e => e.sets.length),
    };
    if (!cleaned.exercises.length) {
      say('Valide au moins une série (✓) avant de terminer');
      return;
    }
    try {
      await onSaveWorkout(cleaned);
    } catch {
      say('Pas de connexion. Réessaie, ta séance est gardée.');
      return;
    }
    haptics.success();
    setFinished(cleaned);
    setActive(null);
    setRest(null);
    setScreen('summary');
  };

  const createExercise = async ({ name, kind, muscle }: { name: string; kind: ExerciseKind; muscle: MuscleGroup }) => {
    const draftEx: CustomExercise = { id: newId(), name: name.trim(), kind, muscle };
    let saved = draftEx;
    try {
      const res = await onCreateExercise(draftEx);
      if (res?.id) saved = { ...draftEx, id: res.id };
    } catch {
      say('Pas de connexion. Réessaie.');
      return;
    }
    setCustomExercises([...customExercises, saved]);
    say(`« ${saved.name} » ajouté à tes exercices`);
    openExercise(saved.id);
  };

  const repeatWorkout = (past: Workout) => {
    const w = { ...startWorkout(new Date()), exercises: cloneForRepeat(past) };
    setActive(w);
    setScreen('session');
    say('Séance chargée avec tes poids de la dernière fois');
  };

  const cancelWorkout = () => {
    setActive(null);
    setRest(null);
    setScreen('home');
    say('Séance annulée');
  };

  /* ---- screens ---- */
  let body: React.ReactNode;
  if (screen === 'logger' && active?.exercises[exIdx]) {
    body = (
      <Logger
        key={active.exercises[exIdx].exerciseId}
        workout={active}
        ex={active.exercises[exIdx]}
        history={allHistory}
        onBack={() => setScreen('session')}
        onToggle={toggleDone}
        updateSets={updateSets}
        onRemove={() => {
          setActive(w => (w ? { ...w, exercises: w.exercises.filter((_, i) => i !== exIdx) } : w));
          setScreen('session');
        }}
      />
    );
  } else if (screen === 'session' && active) {
    body = (
      <Session
        workout={active}
        now={now}
        onOpen={i => {
          setExIdx(i);
          setScreen('logger');
        }}
        onAdd={() => setSheet({ picker: true })}
        onFinish={finishWorkout}
        onCancel={cancelWorkout}
        onBack={() => setScreen('home')}
      />
    );
  } else if (screen === 'summary' && finished) {
    body = (
      <Summary
        workout={finished}
        onClose={() => {
          setFinished(null);
          setScreen('home');
        }}
      />
    );
  } else {
    body = (
      <JournalHome
        history={allHistory}
        saved={history}
        active={active}
        now={now}
        selDay={selDay}
        setSelDay={setSelDay}
        onStart={d => {
          startWorkout(d);
          setSheet({ picker: true });
        }}
        onRepeat={repeatWorkout}
        onResume={() => setScreen('session')}
        onMuscle={id => setSheet({ muscleId: id })}
        onDelete={async id => {
          try {
            await onDeleteWorkout(id);
            say('Séance supprimée');
          } catch {
            say('Suppression impossible');
          }
        }}
      />
    );
  }

  return (
    <View style={s.root}>
      <JournalHeader history={allHistory} now={now} sync={sync} />
      <ScrollView ref={scroller} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
      {active && screen === 'home' && !rest && <ActiveBar workout={active} now={now} onResume={() => setScreen('session')} />}
      {rest && <RestTimer rest={rest} now={now} onAdd={sec => setRest(r => (r ? { ...r, end: r.end + sec * 1000 } : r))} onSkip={() => setRest(null)} />}
      <MuscleSheet
        sheet={sheet}
        history={allHistory}
        workout={active}
        onPickMuscle={id => setSheet({ muscleId: id, fromPicker: !!sheet && 'picker' in sheet })}
        onPick={openExercise}
        onCreate={createExercise}
        onClose={() => setSheet(null)}
        onBack={() => setSheet({ picker: true })}
      />
      <Toast message={toast} />
    </View>
  );
};

/* ---------- header ---------- */
const SYNC_TEXT = (x: SyncInfo) =>
  ({
    synced: 'Synchronisé',
    syncing: 'Synchronisation…',
    pending: `${x.pending} en attente`,
    offline: x.pending ? `Hors ligne · ${x.pending} en attente` : 'Hors ligne',
    local: 'Sur ce téléphone',
  })[x.state];

const SyncBadge: React.FC<{ sync: SyncInfo }> = ({ sync }) => {
  const dot = sync.state === 'synced' || sync.state === 'local' ? J.ok : sync.state === 'offline' ? J.tired : J.rec;
  return (
    <Pressable
      onPress={sync.retry}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityHint="Tes séances sont gardées sur le téléphone et envoyées dès que le réseau revient"
      style={s.sync}
    >
      <View style={[s.syncDot, { backgroundColor: dot }]} />
      <Text style={[s.syncText, sync.state === 'offline' && { color: J.tiredText }]}>{SYNC_TEXT(sync)}</Text>
    </Pressable>
  );
};

const JournalHeader: React.FC<{ history: Workout[]; now: Date; sync: SyncInfo }> = ({ history, now, sync }) => {
  const today = history.filter(x => dayKey(x.date) === dayKey(now));
  const vol = today.reduce((a, x) => a + workoutVolume(x), 0);
  const sets = today.reduce((a, x) => a + workoutSets(x), 0);
  const prs = today.reduce((a, x) => a + x.exercises.reduce((b, e) => b + e.sets.filter(y => y.pr && y.done).length, 0), 0);
  return (
    <View style={s.head}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.h1} accessibilityRole="header">Mon journal</Text>
        <SyncBadge sync={sync} />
      </View>
      <View style={s.chip} accessibilityLabel={`Aujourd'hui : ${fmtKg(vol)}, ${sets} séries, ${prs} records`}>
        <Text style={[s.chipVal, tabular]}>{fmtKg(vol)}</Text>
        <Text style={s.chipSub}>
          {sets} série{sets > 1 ? 's' : ''} · {prs} PR
        </Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.header, borderBottomWidth: 1, borderBottomColor: J.line },
  h1: { fontSize: 18, fontWeight: '800', color: J.fg },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 1 },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  syncText: { fontSize: 11, fontWeight: '700', color: J.muted },
  chip: { alignItems: 'flex-end', backgroundColor: colors.card, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 },
  chipVal: { fontSize: 20, fontWeight: '900', color: J.fg, lineHeight: 22 },
  chipSub: { fontSize: 11, color: J.muted },
  body: { padding: 12, paddingBottom: 120 },
});
