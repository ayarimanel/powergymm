/* =========================================================
   Journal logic: catalog, math, records, recovery, stats.
   Pure functions, no React. The server applies the same record rule
   (backend/src/modules/journal/rules.ts).
   ========================================================= */
import { MuscleGroup } from '../types/database';
import { colors } from '../theme';

export type ExerciseKind = 'weight' | 'body' | 'cardio';

export interface Exercise {
  id: string;
  muscle: MuscleGroup;
  name: string;
  /** "★ de base" */
  base: boolean;
  kind: ExerciseKind;
  /** − / + step for kg */
  step?: number;
  custom?: boolean;
}

/** kg / reps for weight & body exercises, min / km for cardio. `legacy` = a total typed in the old journal. */
export interface WorkoutSet {
  kg?: number | string;
  reps?: number | string;
  min?: number | string;
  km?: number | string;
  done: boolean;
  pr?: boolean;
  legacy?: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  date: string;
  startedAt: string;
  endedAt?: string;
  /** Logged live at the club (rest timer, clock) vs. noted for a past day. */
  live?: boolean;
  migrated?: boolean;
  exercises: WorkoutExercise[];
}

export interface MuscleInfo {
  id: MuscleGroup;
  name: string;
  color: string;
  recoveryH: number;
}

export const MUSCLES: MuscleInfo[] = [
  { id: 'chest', name: 'Pectoraux', color: '#e8590c', recoveryH: 48 },
  { id: 'back', name: 'Dos', color: '#1c7ed6', recoveryH: 48 },
  { id: 'legs', name: 'Jambes', color: colors.teal.bar, recoveryH: 72 },
  { id: 'shoulders', name: 'Épaules', color: '#e8890c', recoveryH: 48 },
  { id: 'arms', name: 'Bras', color: '#2f9e44', recoveryH: 36 },
  { id: 'cardio', name: 'Cardio', color: colors.pink.bar, recoveryH: 24 },
];

const w = (id: string, muscle: MuscleGroup, name: string, step: number, base = false): Exercise => ({ id, muscle, name, base, kind: 'weight', step });
const b = (id: string, muscle: MuscleGroup, name: string, base = false): Exercise => ({ id, muscle, name, base, kind: 'body', step: 2.5 });
const c = (id: string, name: string, base = false): Exercise => ({ id, muscle: 'cardio', name, base, kind: 'cardio' });

// Ids are the ones the app has always used, so old logs and records keep pointing at the right exercise.
export const EXERCISES: Exercise[] = [
  // Pectoraux
  w('chest-bench', 'chest', 'Développé couché', 2.5, true),
  w('chest-incline-dumbbell', 'chest', 'Développé incliné haltères', 2, true),
  b('chest-dips', 'chest', 'Dips', true),
  b('chest-pushups', 'chest', 'Pompes', true),
  w('chest-incline', 'chest', 'Développé incliné', 2.5),
  w('chest-decline', 'chest', 'Développé décliné', 2.5),
  w('chest-dumbbell-press', 'chest', 'Développé haltères', 2),
  w('chest-machine-press', 'chest', 'Développé machine', 5),
  w('chest-cable-fly', 'chest', 'Écarté poulie', 2.5),
  w('chest-fly', 'chest', 'Écarté haltères', 2),
  w('chest-incline-fly', 'chest', 'Écarté incliné', 2),
  w('chest-pec-deck', 'chest', 'Pec deck (papillon)', 5),
  w('chest-cable', 'chest', 'Poulies vis-à-vis', 2.5),
  w('chest-cable-low', 'chest', 'Poulies basses montantes', 2.5),
  w('chest-pullover', 'chest', 'Pull-over haltère', 2),
  w('chest-svend', 'chest', 'Svend press', 2.5),
  b('chest-weighted-pushups', 'chest', 'Pompes lestées'),
  w('chest-smith', 'chest', 'Développé à la Smith machine', 2.5),

  // Dos
  b('back-pullups', 'back', 'Tractions', true),
  w('back-pulldown', 'back', 'Tirage vertical', 2.5, true),
  w('back-row-bar', 'back', 'Rowing barre', 2.5, true),
  w('back-deadlift', 'back', 'Soulevé de terre', 5, true),
  w('back-row-cable', 'back', 'Tirage horizontal', 2.5),
  b('back-neutral-pullups', 'back', 'Tractions prise neutre'),
  b('back-chinups', 'back', 'Tractions supination'),
  w('back-row-dumbbell', 'back', 'Rowing haltère', 2),
  w('back-tbar', 'back', 'Rowing T-bar', 2.5),
  w('back-row-machine', 'back', 'Rowing machine', 5),
  w('back-pulldown-close', 'back', 'Tirage prise serrée', 2.5),
  w('back-straight-arm', 'back', 'Tirage bras tendus', 2.5),
  w('back-pullover', 'back', 'Pull-over poulie', 2.5),
  b('back-hyperext', 'back', 'Hyperextensions'),
  w('back-good-morning', 'back', 'Good morning', 2.5),
  w('back-rack-pull', 'back', 'Rack pull', 5),
  w('back-seal-row', 'back', 'Seal row', 2.5),

  // Jambes
  w('legs-squat', 'legs', 'Squat', 5, true),
  w('legs-press', 'legs', 'Presse à cuisses', 10, true),
  w('legs-rdl', 'legs', 'Soulevé de terre roumain', 5),
  w('legs-lunges', 'legs', 'Fentes haltères', 2),
  w('legs-curl', 'legs', 'Leg curl', 2.5),
  w('legs-calves', 'legs', 'Mollets debout', 5),
  w('legs-front-squat', 'legs', 'Front squat', 2.5),
  w('legs-bulgarian', 'legs', 'Squat bulgare', 2),
  w('legs-hack', 'legs', 'Hack squat', 5),
  w('legs-goblet', 'legs', 'Goblet squat', 2),
  w('legs-extension', 'legs', 'Leg extension', 2.5),
  w('legs-curl-seated', 'legs', 'Leg curl assis', 2.5),
  w('legs-hip-thrust', 'legs', 'Hip thrust', 5),
  w('legs-glute-bridge', 'legs', 'Pont fessier', 5),
  w('legs-sumo', 'legs', 'Soulevé de terre sumo', 5),
  w('legs-walking-lunges', 'legs', 'Fentes marchées', 2),
  w('legs-step-up', 'legs', 'Step-up', 2),
  w('legs-abductor', 'legs', 'Abducteurs machine', 5),
  w('legs-adductor', 'legs', 'Adducteurs machine', 5),
  w('legs-calves-seated', 'legs', 'Mollets assis', 5),

  // Épaules
  w('sh-military', 'shoulders', 'Développé militaire', 2.5, true),
  w('sh-lateral', 'shoulders', 'Élévations latérales', 1, true),
  w('sh-rear', 'shoulders', 'Oiseau', 1),
  w('sh-face-pull', 'shoulders', 'Face pull', 2.5),
  w('sh-dumbbell-press', 'shoulders', 'Développé haltères assis', 2),
  w('sh-arnold', 'shoulders', 'Développé Arnold', 2),
  w('sh-front', 'shoulders', 'Élévations frontales', 1),
  w('sh-rear-machine', 'shoulders', 'Oiseau machine', 2.5),
  w('sh-upright-row', 'shoulders', 'Tirage menton', 2.5),
  w('sh-lateral-cable', 'shoulders', 'Élévations latérales poulie', 1),
  w('sh-machine-press', 'shoulders', 'Développé épaules machine', 5),
  w('sh-push-press', 'shoulders', 'Push press', 2.5),
  w('sh-shrugs', 'shoulders', 'Shrugs haltères', 2),
  w('sh-shrugs-bar', 'shoulders', 'Shrugs barre', 5),

  // Bras
  w('arms-curl-bar', 'arms', 'Curl barre', 2.5, true),
  w('arms-curl-dumbbell', 'arms', 'Curl haltères', 1, true),
  w('arms-pushdown', 'arms', 'Triceps poulie', 2.5, true),
  w('arms-skull', 'arms', 'Barre au front', 2.5, true),
  w('arms-hammer', 'arms', 'Curl marteau', 1),
  w('arms-preacher', 'arms', 'Curl pupitre', 2.5),
  w('arms-concentration', 'arms', 'Curl concentré', 1),
  w('arms-incline-curl', 'arms', 'Curl incliné', 1),
  w('arms-cable-curl', 'arms', 'Curl poulie basse', 2.5),
  w('arms-reverse-curl', 'arms', 'Curl inversé', 2.5),
  w('arms-pushdown-rope', 'arms', 'Triceps corde', 2.5),
  w('arms-overhead', 'arms', 'Extension nuque haltère', 2),
  b('arms-bench-dips', 'arms', 'Dips banc'),
  w('arms-close-bench', 'arms', 'Développé prise serrée', 2.5),
  w('arms-kickback', 'arms', 'Kickback triceps', 1),
  w('arms-wrist-curl', 'arms', 'Flexion poignets', 1),

  // Cardio
  c('cardio-treadmill', 'Tapis de course', true),
  c('cardio-bike', 'Vélo', true),
  c('cardio-rower', 'Rameur'),
  c('cardio-rope', 'Corde à sauter'),
  c('cardio-elliptical', 'Elliptique'),
  c('cardio-stepper', 'Stepper'),
  c('cardio-incline-walk', 'Marche inclinée'),
  c('cardio-assault', 'Assault bike'),
  c('cardio-battle-ropes', 'Battle ropes'),
  c('cardio-hiit', 'HIIT'),
  c('cardio-circuit', 'Circuit training'),
  c('cardio-run', 'Course en extérieur'),
  c('cardio-swim', 'Natation'),
];

export interface CustomExercise {
  id: string;
  muscle: MuscleGroup;
  name: string;
  kind: ExerciseKind;
}

/** Member's own exercises are merged into EXERCISES (tagged custom). */
export function setCustomExercises(list: CustomExercise[] = []) {
  for (let i = EXERCISES.length - 1; i >= 0; i--) if (EXERCISES[i].custom) EXERCISES.splice(i, 1);
  list.forEach(e => EXERCISES.push({ base: false, step: e.kind === 'cardio' ? undefined : 2.5, ...e, custom: true }));
}
export const normName = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
export const exById = (id: string) => EXERCISES.find(e => e.id === id);
export const muscleById = (id: MuscleGroup) => MUSCLES.find(m => m.id === id)!;

/* ---------- formatting ---------- */
const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const fmtKg = (n: number) => `${thousands(n)} kg`;
export const fmtInt = thousands;
export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
export const dayKey = (d: Date | string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
};
const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export function dayLabel(d: Date | string, now = new Date()) {
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const z = new Date(now);
  z.setHours(0, 0, 0, 0);
  const diff = Math.round((+z - +a) / 864e5);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff < 7) return `${DAYS[a.getDay()]} ${a.getDate()}`;
  return `${a.getDate()}/${a.getMonth() + 1}`;
}
export function agoLabel(date: string | null | undefined, now = new Date()) {
  if (!date) return 'Pas encore';
  if (dayKey(date) === dayKey(now)) return "Aujourd'hui";
  const a = new Date(date);
  a.setHours(0, 0, 0, 0);
  const z = new Date(now);
  z.setHours(0, 0, 0, 0);
  const d = Math.max(1, Math.round((+z - +a) / 864e5));
  return d === 1 ? 'Hier' : `Il y a ${d} j`;
}

/* ---------- set math (the app does it, never the user) ---------- */
export const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
export const setVolume = (s: WorkoutSet) => (s.done ? num(s.kg) * num(s.reps) : 0);
export const exVolume = (ex: WorkoutExercise) => ex.sets.reduce((a, s) => a + setVolume(s), 0);
export const doneSets = (ex: WorkoutExercise) => ex.sets.filter(s => s.done);
/** Sets that count for records, hints and charts: a typed total from the old journal is not a real set. */
const realSets = (ex: WorkoutExercise) => ex.sets.filter(s => s.done && !s.legacy);
export const workoutVolume = (wk: Workout) => wk.exercises.reduce((a, ex) => a + exVolume(ex), 0);
export const workoutSets = (wk: Workout) => wk.exercises.reduce((a, ex) => a + doneSets(ex).length, 0);
/** Epley estimated 1-rep max */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

/** Group sets like a human would: "3 × 10 à 40 kg" or "40 kg × 10, 45 kg × 8" */
export function summarizeSets(sets: WorkoutSet[], kind: ExerciseKind) {
  const done = sets.filter(s => s.done);
  if (!done.length) return '';
  if (kind === 'cardio') {
    const min = done.reduce((a, s) => a + num(s.min), 0);
    const km = done.reduce((a, s) => a + num(s.km), 0);
    return `${fmtNum(min)} min${km ? ` · ${fmtNum(km)} km` : ''}`;
  }
  if (done.every(s => s.legacy)) return `${fmtKg(done.reduce((a, s) => a + num(s.kg), 0))} au total`;
  const same = done.every(s => num(s.kg) === num(done[0].kg) && num(s.reps) === num(done[0].reps));
  const kgTxt = (kg: unknown) => (kind === 'body' && !num(kg) ? 'PDC' : `${fmtNum(num(kg))} kg`);
  if (same) return `${done.length} × ${num(done[0].reps)} à ${kgTxt(done[0].kg)}`;
  return done.map(s => `${kgTxt(s.kg)} × ${num(s.reps)}`).join(', ');
}

/* ---------- history queries ---------- */
export interface LastPerf {
  date: string;
  sets: WorkoutSet[];
}

export function lastPerformance(history: Workout[], exerciseId: string, beforeDate: Date | number = Infinity): LastPerf | null {
  const ws = history.filter(x => +new Date(x.date) < +beforeDate).sort((a, z) => +new Date(z.date) - +new Date(a.date));
  for (const wk of ws) {
    const ex = wk.exercises.find(e => e.exerciseId === exerciseId && realSets(e).length);
    if (ex) return { date: wk.date, sets: realSets(ex) };
  }
  return null;
}

export interface PR {
  kg: number;
  reps: number;
  e1rm: number;
  date: string;
}

/** Personal record for an exercise: heaviest set (then most reps at that weight). */
export function personalRecord(history: Workout[], exerciseId: string, excludeWorkoutId: string | null = null): PR | null {
  let best: PR | null = null;
  for (const wk of history) {
    if (wk.id === excludeWorkoutId) continue;
    for (const ex of wk.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of realSets(ex)) {
        const kg = num(s.kg);
        const reps = num(s.reps);
        if (!best || kg > best.kg || (kg === best.kg && reps > best.reps)) best = { kg, reps, e1rm: e1rm(kg, reps), date: wk.date };
      }
    }
  }
  return best;
}

/** Is this set a new record compared with everything else? (The server uses only earlier workouts.) */
export function isNewRecord(history: Workout[], exerciseId: string, set: WorkoutSet, workoutId: string) {
  if (!set.done || set.legacy || !(num(set.kg) > 0)) return false;
  const pr = personalRecord(history, exerciseId, workoutId);
  if (!pr) return false; // first time ever: not a "record", just a start
  return num(set.kg) > pr.kg || (num(set.kg) === pr.kg && num(set.reps) > pr.reps);
}

/* ---------- recovery ---------- */
export type RecoveryStatus = 'ready' | 'recovering' | 'tired' | 'never';
export interface Recovery {
  status: RecoveryStatus;
  last: string | null;
  readyInH: number;
  pct: number;
  sets?: number;
}

export function muscleRecovery(history: Workout[], muscleId: MuscleGroup, now = new Date()): Recovery {
  const m = muscleById(muscleId);
  let last: string | null = null;
  let sets = 0;
  for (const wk of history) {
    const s = wk.exercises.filter(e => exById(e.exerciseId)?.muscle === muscleId).reduce((a, e) => a + doneSets(e).length, 0);
    if (s && (!last || +new Date(wk.date) > +new Date(last))) {
      last = wk.date;
      sets = s;
    }
  }
  if (!last) return { status: 'never', last: null, readyInH: 0, pct: 100 };
  // more sets = a bit longer recovery (max +50 %)
  const need = m.recoveryH * Math.min(1.5, 0.75 + sets / 16);
  const elapsed = (+now - +new Date(last)) / 36e5;
  const pct = Math.max(0, Math.min(100, Math.round((elapsed / need) * 100)));
  const status: RecoveryStatus = pct >= 100 ? 'ready' : pct >= 50 ? 'recovering' : 'tired';
  return { status, last, readyInH: Math.max(0, Math.ceil(need - elapsed)), pct, sets };
}

/** Which muscle to suggest today: ready + trained the longest ago (never trained first) */
export function suggestMuscle(history: Workout[], now = new Date()): MuscleInfo | null {
  const list = MUSCLES.filter(m => m.id !== 'cardio').map(m => ({ m, r: muscleRecovery(history, m.id, now) }));
  const ready = list.filter(x => x.r.status === 'ready' || x.r.status === 'never');
  ready.sort((a, z) => (a.r.last ? +new Date(a.r.last) : 0) - (z.r.last ? +new Date(z.r.last) : 0));
  return ready[0]?.m || null;
}

/* ---------- stats ---------- */
export function periodStats(history: Workout[], days: number, now = new Date()) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  const ws = history.filter(x => new Date(x.date) >= from);
  const perMuscle: Partial<Record<MuscleGroup, { sets: number; volume: number }>> = {};
  let prs = 0;
  ws.forEach(wk =>
    wk.exercises.forEach(ex => {
      const mid = exById(ex.exerciseId)?.muscle;
      if (!mid) return;
      const cur = (perMuscle[mid] = perMuscle[mid] || { sets: 0, volume: 0 });
      cur.sets += doneSets(ex).length;
      cur.volume += exVolume(ex);
      if (ex.sets.some(s => s.pr)) prs++;
    })
  );
  return {
    activeDays: new Set(ws.map(x => dayKey(x.date))).size,
    workouts: ws.length,
    sets: ws.reduce((a, x) => a + workoutSets(x), 0),
    volume: ws.reduce((a, x) => a + workoutVolume(x), 0),
    prs,
    perMuscle,
  };
}

export function weekDays(history: Workout[], now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
  const trained = new Set(history.map(x => dayKey(x.date)));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { date: d, letter: 'LMMJVSD'[i], trained: trained.has(dayKey(d)), isToday: dayKey(d) === dayKey(now), future: d > now };
  });
}

/** New empty set prefilled from the previous set or from last time */
export function nextSet(currentSets: WorkoutSet[], last: LastPerf | null, kind: ExerciseKind): WorkoutSet {
  const prev = currentSets[currentSets.length - 1];
  const ref = prev || last?.sets?.[currentSets.length] || last?.sets?.[last.sets.length - 1];
  if (kind === 'cardio') return { min: ref?.min ?? 20, km: ref?.km ?? '', done: false };
  return { kg: ref?.kg ?? (kind === 'body' ? 0 : 20), reps: ref?.reps ?? 10, done: false };
}

/* ---------- repeat a past session ---------- */
export function repeatableSessions(history: Workout[], n = 3) {
  const seen = new Set<string>();
  const out: { workout: Workout; muscles: MuscleInfo[]; exercises: WorkoutExercise[] }[] = [];
  [...history]
    .sort((a, z) => +new Date(z.date) - +new Date(a.date))
    .forEach(wk => {
      const ex = wk.exercises.filter(e => exById(e.exerciseId) && realSets(e).length);
      if (!ex.length) return;
      const muscles = [...new Set(ex.map(e => exById(e.exerciseId)!.muscle))];
      const key = [...muscles].sort().join('+');
      if (seen.has(key) || out.length >= n) return;
      seen.add(key);
      out.push({ workout: wk, muscles: muscles.map(muscleById), exercises: ex });
    });
  return out;
}
/** Exercises of a past session, ready to log again (same weights, not validated) */
export function cloneForRepeat(workout: Workout): WorkoutExercise[] {
  return workout.exercises
    .filter(e => exById(e.exerciseId) && realSets(e).length)
    .map(e => ({
      exerciseId: e.exerciseId,
      sets: realSets(e).map(s => (exById(e.exerciseId)!.kind === 'cardio' ? { min: s.min, km: s.km, done: false } : { kg: s.kg, reps: s.reps, done: false })),
    }));
}

/* ---------- progression hint ---------- */
export interface Hint {
  type: 'up' | 'keep' | 'reps' | 'cardio';
  text: string;
  apply: Partial<WorkoutSet>;
}

export function progressionHint(last: LastPerf | null, ex: Exercise): Hint | null {
  if (!last || !last.sets.length) return null;
  const s = last.sets;
  if (ex.kind === 'cardio') {
    const min = Math.max(...s.map(x => num(x.min)));
    return { type: 'cardio', text: `Dernière fois ${fmtNum(min)} min. Essaie ${fmtNum(min + 5)} min aujourd'hui.`, apply: { min: min + 5 } };
  }
  const kg = Math.max(...s.map(x => num(x.kg)));
  const top = s.filter(x => num(x.kg) === kg);
  const target = num(top[0].reps);
  const allHit = top.length >= 2 && top.every(x => num(x.reps) >= target);
  if (ex.kind === 'body' && kg === 0) {
    return allHit
      ? { type: 'reps', text: `Tu as fait ${top.length} × ${target}. Vise ${target + 1} reps par série.`, apply: { reps: target + 1 } }
      : { type: 'keep', text: `Vise ${target} reps sur toutes les séries avant d'en ajouter.`, apply: { reps: target } };
  }
  if (allHit) {
    const next = Math.round((kg + (ex.step || 2.5)) * 100) / 100;
    return { type: 'up', text: `${top.length} × ${target} à ${fmtNum(kg)} kg réussi. Essaie ${fmtNum(next)} kg.`, apply: { kg: next, reps: target } };
  }
  return { type: 'keep', text: `Garde ${fmtNum(kg)} kg et vise ${target} reps sur chaque série.`, apply: { kg, reps: target } };
}

/* ---------- progress chart data ---------- */
export interface ProgressPoint {
  date: string;
  value: number;
  volume: number;
  reps?: number;
  e1rm?: number;
}

export function exerciseProgress(history: Workout[], exerciseId: string, days = 90, now = new Date()): ProgressPoint[] {
  const ex = exById(exerciseId);
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return history
    .filter(x => new Date(x.date) >= from)
    .map((x): ProgressPoint | null => {
      const sets = x.exercises.filter(e => e.exerciseId === exerciseId).flatMap(realSets);
      if (!sets.length) return null;
      if (ex?.kind === 'cardio') return { date: x.date, value: sets.reduce((a, s) => a + num(s.min), 0), volume: sets.reduce((a, s) => a + num(s.km), 0) };
      const best = sets.reduce((bst, s) => (num(s.kg) > bst.kg || (num(s.kg) === bst.kg && num(s.reps) > bst.reps) ? { kg: num(s.kg), reps: num(s.reps) } : bst), { kg: 0, reps: 0 });
      return { date: x.date, value: best.kg, reps: best.reps, e1rm: e1rm(best.kg, best.reps), volume: sets.reduce((a, s) => a + num(s.kg) * num(s.reps), 0) };
    })
    .filter((p): p is ProgressPoint => !!p)
    .sort((a, z) => +new Date(a.date) - +new Date(z.date));
}

/* ---------- shared with other pages ---------- */
/** What other pages need: the last session (for the Mur), the muscle to suggest (Floor), today's volume. */
export function journalSummary(history: Workout[], now = new Date()) {
  const last = [...history].sort((a, z) => +new Date(z.date) - +new Date(a.date))[0];
  const today = history.filter(x => dayKey(x.date) === dayKey(now));
  return {
    lastSession: last
      ? {
          id: last.id,
          date: last.date,
          minutes: last.endedAt && last.live !== false ? Math.max(1, Math.round((+new Date(last.endedAt) - +new Date(last.startedAt)) / 60000)) : null,
          sets: workoutSets(last),
          exercises: last.exercises.length,
          volume: workoutVolume(last),
        }
      : null,
    suggestedMuscle: suggestMuscle(history, now)?.id ?? null,
    todayVolume: today.reduce((a, x) => a + workoutVolume(x), 0),
  };
}
