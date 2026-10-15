/**
 * Journal rules shared with the app (src/journal/journalLogic.ts).
 * Keep both in sync: a record here must be a record on the phone.
 */
export const MUSCLES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'cardio'] as const;
export type MuscleGroup = (typeof MUSCLES)[number];

/** Limits a real set can't exceed. A total typed in the old journal ("legacy") is exempt from the kg limit. */
export const LIMITS = { kg: 500, reps: 100, minutes: 300 } as const;

export interface SetFact {
  kg: number;
  reps: number;
  minutes: number;
  km: number;
  legacy: boolean;
}

export interface WorkoutFact {
  id: string;
  date: Date;
  startedAt: Date;
  endedAt: Date | null;
  live: boolean;
  exercises: { exerciseId: string; muscle: MuscleGroup | null; sets: SetFact[] }[];
}

/** Hours a muscle needs before it's ready again (same table as the app). */
const RECOVERY_H: Record<MuscleGroup, number> = { chest: 48, back: 48, legs: 72, shoulders: 48, arms: 36, cardio: 24 };

export interface Best {
  kg: number;
  reps: number;
}

/** Heaviest real set of an exercise (then most reps at that weight). */
export function personalRecord(workouts: WorkoutFact[], exerciseId: string): Best | null {
  let best: Best | null = null;
  for (const w of workouts)
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets) {
        if (s.legacy) continue;
        if (!best || s.kg > best.kg || (s.kg === best.kg && s.reps > best.reps)) best = { kg: s.kg, reps: s.reps };
      }
    }
  return best;
}

/** isNewRecord(): heavier, or same weight with more reps, than everything before. The very first time is not a record. */
export function isNewRecord(before: WorkoutFact[], exerciseId: string, set: SetFact): boolean {
  if (set.legacy || !(set.kg > 0)) return false;
  const pr = personalRecord(before, exerciseId);
  if (!pr) return false;
  return set.kg > pr.kg || (set.kg === pr.kg && set.reps > pr.reps);
}

export const setCount = (w: WorkoutFact) => w.exercises.reduce((a, e) => a + e.sets.length, 0);
export const volume = (w: WorkoutFact) => w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.kg * s.reps, 0), 0);

/** Rested muscle trained the longest ago (never trained first); cardio is never suggested. */
export function suggestMuscle(workouts: WorkoutFact[], now: Date): MuscleGroup | null {
  const status = MUSCLES.filter(m => m !== 'cardio').map(m => {
    let last: Date | null = null;
    let sets = 0;
    for (const w of workouts) {
      const n = w.exercises.filter(e => e.muscle === m).reduce((a, e) => a + e.sets.length, 0);
      if (n && (!last || w.date > last)) {
        last = w.date;
        sets = n;
      }
    }
    if (!last) return { m, last, ready: true };
    const need = RECOVERY_H[m] * Math.min(1.5, 0.75 + sets / 16);
    return { m, last, ready: (now.getTime() - last.getTime()) / 36e5 >= need };
  });
  const ready = status.filter(x => x.ready).sort((a, b) => (a.last?.getTime() ?? 0) - (b.last?.getTime() ?? 0));
  return ready[0]?.m ?? null;
}

/** What other pages need from the journal. `isToday` decides "today" in the club's timezone. */
export function summary(workouts: WorkoutFact[], now: Date, isToday: (d: Date) => boolean) {
  const last = [...workouts].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  return {
    lastSession: last
      ? {
          id: last.id,
          date: last.date.toISOString(),
          minutes: last.endedAt && last.live ? Math.max(1, Math.round((last.endedAt.getTime() - last.startedAt.getTime()) / 60000)) : null,
          sets: setCount(last),
          exercises: last.exercises.length,
          volume: volume(last),
        }
      : null,
    suggestedMuscle: suggestMuscle(workouts, now),
    todayVolume: workouts.filter(w => isToday(w.date)).reduce((a, w) => a + volume(w), 0),
  };
}
