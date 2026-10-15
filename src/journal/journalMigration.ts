import AsyncStorage from '@react-native-async-storage/async-storage';
import { MuscleGroup } from '../types/database';
import { CustomExercise, EXERCISES, Workout, WorkoutExercise, WorkoutSet } from './journalLogic';

/** Shape of the old journal (one typed number per exercise per day + hand-typed records). */
interface OldSet {
  exerciseId: string;
  muscle: MuscleGroup;
  kind: 'strength' | 'cardio';
  weightKg: number;
  reps: number;
  minutes: number;
  day: string; // YYYY-MM-DD
}
interface OldCustom {
  id: string;
  name: string;
  muscle: MuscleGroup;
  kind: 'strength' | 'cardio';
}
type OldPRs = Record<string, { weightKg: number; reps: number }>;

const OLD_SETS = (u: string) => `@gym_app_journal_v1_${u}`;
const OLD_CUSTOM = (u: string) => `@gym_app_journal_custom_v1_${u}`;
const OLD_PRS = (u: string) => `@gym_app_journal_prs_v1_${u}`;
const DONE = (u: string) => `@journal_migrated_v1_${u}`;

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const parse = async <T,>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const at = (day: string, hour: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0).toISOString();
};

/**
 * Runs once per member. Returns what has to be added (and later sent to the server):
 * - one workout per old training day ("migrated");
 * - a typed total ("1 800 kg soulevé") becomes { kg: total, reps: 1, legacy: true }: counted in volume,
 *   never as a record;
 * - each hand-typed record becomes a real set on the last day that exercise was logged, so records stay right.
 */
export async function migrateOldJournal(userId: string): Promise<{ workouts: Workout[]; customs: CustomExercise[]; commit: () => Promise<void> }> {
  const commit = () => AsyncStorage.setItem(DONE(userId), new Date().toISOString()).catch(() => {});
  const empty = { workouts: [], customs: [], commit: async () => {} };
  if (await AsyncStorage.getItem(DONE(userId))) return empty;

  const [oldSets, oldCustom, oldPrs] = await Promise.all([parse<OldSet[]>(OLD_SETS(userId)), parse<OldCustom[]>(OLD_CUSTOM(userId)), parse<OldPRs>(OLD_PRS(userId))]);

  // Old custom ids ("custom-123") are not uuids: give them new ones.
  const idMap = new Map<string, string>();
  const customs: CustomExercise[] = (oldCustom ?? []).map(c => {
    const id = uuid();
    idMap.set(c.id, id);
    return { id, name: c.name.trim().slice(0, 40), muscle: c.muscle, kind: c.kind === 'cardio' ? 'cardio' : 'weight' };
  });
  const known = new Set([...EXERCISES.filter(e => !e.custom).map(e => e.id), ...customs.map(c => c.id)]);
  const exId = (old: string) => idMap.get(old) ?? old;

  const byDay = new Map<string, Map<string, WorkoutSet[]>>();
  const push = (day: string, exerciseId: string, set: WorkoutSet) => {
    const dayMap = byDay.get(day) ?? new Map<string, WorkoutSet[]>();
    dayMap.set(exerciseId, [...(dayMap.get(exerciseId) ?? []), set]);
    byDay.set(day, dayMap);
  };

  for (const s of oldSets ?? []) {
    const id = exId(s.exerciseId);
    if (!known.has(id) || !/^\d{4}-\d{2}-\d{2}$/.test(s.day)) continue;
    if (s.kind === 'cardio') {
      if (s.minutes > 0) push(s.day, id, { min: s.minutes, km: '', done: true });
    } else if (s.reps > 1) {
      push(s.day, id, { kg: s.weightKg, reps: s.reps, done: true });
    } else if (s.weightKg > 0) {
      push(s.day, id, { kg: s.weightKg, reps: 1, done: true, legacy: true });
    }
  }

  const yesterday = new Date(Date.now() - 864e5);
  const fallbackDay = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  for (const [oldId, pr] of Object.entries(oldPrs ?? {})) {
    const id = exId(oldId);
    if (!known.has(id) || !(pr.weightKg > 0)) continue;
    const days = (oldSets ?? []).filter(s => exId(s.exerciseId) === id).map(s => s.day).sort();
    push(days[days.length - 1] ?? fallbackDay, id, { kg: pr.weightKg, reps: Math.max(1, pr.reps), done: true });
  }

  const workouts: Workout[] = [...byDay.entries()].map(([day, exMap]) => {
    const exercises: WorkoutExercise[] = [...exMap.entries()].map(([exerciseId, sets]) => ({ exerciseId, sets }));
    return { id: uuid(), date: at(day, 18), startedAt: at(day, 18), endedAt: at(day, 18), live: false, migrated: true, exercises };
  });

  // The caller commits once the result is safely in the outbox, so a crash in between just migrates again.
  return { workouts, customs, commit };
}
