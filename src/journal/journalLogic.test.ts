import { describe, expect, it, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  },
}));

import {
  Workout, cloneForRepeat, isNewRecord, journalSummary, lastPerformance, muscleRecovery, personalRecord, progressionHint, exById,
  repeatableSessions, summarizeSets, workoutVolume,
} from './journalLogic';
import { migrateOldJournal } from './journalMigration';

const NOW = new Date('2026-10-01T18:00:00');
const daysAgo = (d: number) => new Date(+NOW - d * 864e5).toISOString();
const sets = (n: number, kg: number, reps: number) => Array.from({ length: n }, () => ({ kg, reps, done: true }));
const wk = (id: string, d: number, exercises: Workout['exercises']): Workout => ({ id, date: daysAgo(d), startedAt: daysAgo(d), endedAt: daysAgo(d), exercises });

describe('sets and records', () => {
  const history = [
    wk('a', 10, [{ exerciseId: 'chest-bench', sets: sets(3, 27.5, 10) }]),
    wk('b', 5, [{ exerciseId: 'chest-bench', sets: sets(3, 30, 10) }, { exerciseId: 'arms-curl-bar', sets: sets(2, 20, 12) }]),
  ];

  it('the app computes the volume, not the member', () => {
    expect(workoutVolume(history[1])).toBe(3 * 30 * 10 + 2 * 20 * 12);
    expect(summarizeSets(history[1].exercises[0].sets, 'weight')).toBe('3 × 10 à 30 kg');
    expect(summarizeSets([{ kg: 40, reps: 10, done: true }, { kg: 45, reps: 8, done: true }], 'weight')).toBe('40 kg × 10, 45 kg × 8');
    expect(summarizeSets([{ kg: 0, reps: 8, done: true }], 'body')).toBe('1 × 8 à PDC');
    expect(summarizeSets([{ min: 20, km: 3.5, done: true }], 'cardio')).toBe('20 min · 3,5 km');
  });

  it('a record is heavier, or same weight with more reps; the very first time is not a record', () => {
    expect(personalRecord(history, 'chest-bench')).toMatchObject({ kg: 30, reps: 10 });
    expect(isNewRecord(history, 'chest-bench', { kg: 32.5, reps: 5, done: true }, 'new')).toBe(true);
    expect(isNewRecord(history, 'chest-bench', { kg: 30, reps: 11, done: true }, 'new')).toBe(true);
    expect(isNewRecord(history, 'chest-bench', { kg: 30, reps: 10, done: true }, 'new')).toBe(false);
    expect(isNewRecord(history, 'legs-squat', { kg: 100, reps: 5, done: true }, 'new')).toBe(false);
  });

  it('suggests the next load once every top set was hit', () => {
    const last = lastPerformance(history, 'chest-bench');
    const hint = progressionHint(last, exById('chest-bench')!);
    expect(hint).toMatchObject({ type: 'up', apply: { kg: 32.5, reps: 10 } });
    expect(hint!.text).toBe('3 × 10 à 30 kg réussi. Essaie 32,5 kg.');
  });

  it('repeats a past session with last weights, not validated', () => {
    const list = repeatableSessions(history, 3);
    expect(list).toHaveLength(2); // pecs+bras and pecs alone are different combinations
    const clone = cloneForRepeat(list[0].workout);
    expect(clone[0].sets.every(s => !s.done && s.kg === 30)).toBe(true);
  });

  it('a typed total from the old journal counts in volume but never as a record or a hint', () => {
    const h = [...history, wk('m', 20, [{ exerciseId: 'chest-bench', sets: [{ kg: 1800, reps: 1, done: true, legacy: true }] }])];
    expect(personalRecord(h, 'chest-bench')?.kg).toBe(30);
    expect(workoutVolume(h[2])).toBe(1800);
    expect(lastPerformance(h, 'chest-bench', new Date(daysAgo(15)))).toBeNull();
  });
});

describe('recovery and summary', () => {
  it('a muscle trained yesterday is not ready; one never trained is suggested', () => {
    const h = [wk('l', 1, [{ exerciseId: 'legs-squat', sets: sets(4, 100, 5) }])];
    expect(muscleRecovery(h, 'legs', NOW).status).not.toBe('ready');
    expect(muscleRecovery(h, 'chest', NOW).status).toBe('never');
    const sum = journalSummary(h, NOW);
    expect(sum.suggestedMuscle).toBe('chest');
    expect(sum.lastSession).toMatchObject({ sets: 4, exercises: 1 });
  });
});

describe('old journal migration', () => {
  beforeEach(() => store.clear());

  it('one workout per day, typed totals flagged legacy, hand-typed records kept as real sets', async () => {
    store.set('@gym_app_journal_v1_u1', JSON.stringify([
      { exerciseId: 'chest-bench', muscle: 'chest', kind: 'strength', weightKg: 1800, reps: 1, minutes: 0, day: '2026-09-20' },
      { exerciseId: 'legs-squat', muscle: 'legs', kind: 'strength', weightKg: 100, reps: 5, minutes: 0, day: '2026-09-20' },
      { exerciseId: 'cardio-bike', muscle: 'cardio', kind: 'cardio', weightKg: 0, reps: 0, minutes: 30, day: '2026-09-22' },
      { exerciseId: 'custom-1', muscle: 'arms', kind: 'strength', weightKg: 400, reps: 1, minutes: 0, day: '2026-09-22' },
    ]));
    store.set('@gym_app_journal_custom_v1_u1', JSON.stringify([{ id: 'custom-1', name: 'Curl araignée', muscle: 'arms', kind: 'strength' }]));
    store.set('@gym_app_journal_prs_v1_u1', JSON.stringify({ 'chest-bench': { weightKg: 85, reps: 3 } }));

    const res = await migrateOldJournal('u1');
    expect(res.workouts).toHaveLength(2);
    expect(res.customs[0].id).toMatch(/^[0-9a-f-]{36}$/);
    const sep20 = res.workouts.find(w => w.exercises.some(e => e.exerciseId === 'legs-squat'))!;
    const bench = sep20.exercises.find(e => e.exerciseId === 'chest-bench')!;
    expect(bench.sets).toEqual([{ kg: 1800, reps: 1, done: true, legacy: true }, { kg: 85, reps: 3, done: true }]);
    expect(personalRecord(res.workouts, 'chest-bench')).toMatchObject({ kg: 85, reps: 3 });
    expect(res.workouts.find(w => w !== sep20)!.exercises.map(e => e.exerciseId)).toContain(res.customs[0].id);

    await res.commit();
    expect((await migrateOldJournal('u1')).workouts).toHaveLength(0);
  });
});
