import type { Db } from '../../shared/db/client.js';
import type { Actor } from '../../shared/auth/actor.js';
import { conflict, forbidden, unprocessable } from '../../shared/errors.js';
import { localDay } from '../../shared/time.js';
import type { ClubsService } from '../clubs/index.js';
import { LIMITS, MUSCLES, isNewRecord, summary, type MuscleGroup, type WorkoutFact } from './rules.js';
import { journalRepository, type SetRow, type WorkoutRow } from './repository.js';

/** A set as the app sends it: kg/reps (weight, bodyweight) or min/km (cardio). Only validated sets are stored. */
export interface SetInput {
  kg?: number;
  reps?: number;
  min?: number;
  km?: number;
  done?: boolean;
  legacy?: boolean;
}
export interface WorkoutInput {
  date: Date;
  startedAt: Date;
  endedAt?: Date | null;
  live?: boolean;
  migrated?: boolean;
  exercises: { exerciseId: string; muscle?: MuscleGroup | null; sets: SetInput[] }[];
}
export interface CustomExerciseInput {
  muscle: MuscleGroup;
  name: string;
  kind: 'weight' | 'body' | 'cardio';
}

const MAX_CUSTOM = 50;
/** Dates more than this in the future are a clock problem on the phone. */
const FUTURE_SLACK_MS = 24 * 3_600_000;

const isMuscle = (m: unknown): m is MuscleGroup => typeof m === 'string' && (MUSCLES as readonly string[]).includes(m);

/** Rows → the shape the app reads: exercises in logging order, sets as { kg, reps, done, pr } or { min, km, done }. */
function toApi(w: WorkoutRow, sets: SetRow[]) {
  const exercises: { exerciseId: string; muscle: MuscleGroup | null; sets: Record<string, unknown>[] }[] = [];
  for (const s of sets) {
    let ex = exercises.find(e => e.exerciseId === s.exerciseId);
    if (!ex) exercises.push((ex = { exerciseId: s.exerciseId, muscle: s.muscle ?? null, sets: [] }));
    const cardio = s.muscle === 'cardio' || (s.minutes > 0 && s.reps === 0);
    ex.sets.push(
      cardio
        ? { min: s.minutes, km: s.km || '', done: true }
        : { kg: s.kg, reps: s.reps, done: true, pr: s.isPr, ...(s.legacy ? { legacy: true } : {}) },
    );
  }
  return {
    id: w.id,
    date: w.date.toISOString(),
    startedAt: w.startedAt.toISOString(),
    endedAt: w.endedAt?.toISOString() ?? null,
    live: w.live,
    migrated: w.migrated,
    exercises,
  };
}

function toFacts(rows: WorkoutRow[], sets: SetRow[]): WorkoutFact[] {
  return rows.map(w => {
    const exercises: WorkoutFact['exercises'] = [];
    for (const s of sets.filter(x => x.workoutId === w.id)) {
      let ex = exercises.find(e => e.exerciseId === s.exerciseId);
      if (!ex) exercises.push((ex = { exerciseId: s.exerciseId, muscle: s.muscle ?? null, sets: [] }));
      ex.sets.push({ kg: s.kg, reps: s.reps, minutes: s.minutes, km: s.km, legacy: s.legacy });
    }
    return { id: w.id, date: w.date, startedAt: w.startedAt, endedAt: w.endedAt, live: w.live, exercises };
  });
}

export function createJournalService(db: Db, deps: { clubs: ClubsService }) {
  const repo = journalRepository(db);

  const loadFacts = async (r: ReturnType<typeof journalRepository>, userId: string, opts: Parameters<typeof repo.workoutsOf>[1]) => {
    const rows = await r.workoutsOf(userId, opts);
    return toFacts(rows, await r.setsOf(rows.map(w => w.id)));
  };

  return {
    async workouts(actor: Actor, days: number) {
      const rows = await repo.workoutsOf(actor.id, { since: new Date(Date.now() - days * 86_400_000) });
      const sets = await repo.setsOf(rows.map(w => w.id));
      return rows.map(w => toApi(w, sets.filter(s => s.workoutId === w.id)));
    },

    /**
     * Create or replace one workout and all its sets, in one transaction. Replaying the same request
     * gives the same result (the id comes from the phone). Records are recomputed here from the
     * workouts dated before this one: what the phone says about "pr" is ignored.
     */
    async saveWorkout(actor: Actor, id: string, input: WorkoutInput) {
      if (input.date.getTime() > Date.now() + FUTURE_SLACK_MS) throw unprocessable('future_workout', 'A workout cannot be in the future.');

      const sets = input.exercises.flatMap(e => e.sets.filter(s => s.done !== false).map(s => ({ e, s })));
      for (const { s } of sets) {
        if ((s.reps ?? 0) > LIMITS.reps) throw unprocessable('too_many_reps', `A set cannot have more than ${LIMITS.reps} reps.`);
        if ((s.min ?? 0) > LIMITS.minutes) throw unprocessable('too_long', `A cardio block cannot last more than ${LIMITS.minutes} minutes.`);
        if (!s.legacy && (s.kg ?? 0) > LIMITS.kg) throw unprocessable('too_heavy', `A set cannot be heavier than ${LIMITS.kg} kg.`);
      }

      return db.transaction(async tx => {
        const r = journalRepository(tx);
        const existing = await r.findWorkout(id);
        if (existing && existing.userId !== actor.id) throw forbidden('This workout belongs to another member.');
        // Deleted on another device (or the delete was sent first): a late replay must not bring it back.
        if (existing?.deletedAt) return { id, deleted: true };

        const before = await loadFacts(r, actor.id, { before: input.date, excludeId: id });
        await r.upsertWorkout({
          id,
          gymId: actor.gymId,
          userId: actor.id,
          date: input.date,
          startedAt: input.startedAt,
          endedAt: input.endedAt ?? null,
          live: input.live ?? true,
          migrated: input.migrated ?? false,
        });
        await r.replaceSets(
          id,
          sets.map(({ e, s }, order) => {
            const cardio = e.muscle === 'cardio' || ((s.min ?? 0) > 0 && !s.reps);
            const fact = { kg: cardio ? 0 : s.kg ?? 0, reps: cardio ? 0 : Math.round(s.reps ?? 0), minutes: cardio ? s.min ?? 0 : 0, km: cardio ? s.km ?? 0 : 0, legacy: !!s.legacy };
            return {
              workoutId: id,
              exerciseId: e.exerciseId,
              muscle: isMuscle(e.muscle) ? e.muscle : null,
              order,
              ...fact,
              isPr: !cardio && isNewRecord(before, e.exerciseId, fact),
            };
          }),
        );
        const saved = (await r.findWorkout(id))!;
        return toApi(saved, await r.setsOf([id]));
      });
    },

    /** Soft delete. Already deleted or never synced: nothing to do, still a success. */
    async deleteWorkout(actor: Actor, id: string) {
      const existing = await repo.findWorkout(id);
      if (!existing) return;
      if (existing.userId !== actor.id) throw forbidden('This workout belongs to another member.');
      await repo.softDelete(id);
    },

    customExercises: (actor: Actor) => repo.customsOf(actor.id).then(list => list.map(({ id, muscle, name, kind }) => ({ id, muscle, name, kind }))),

    async saveCustomExercise(actor: Actor, id: string, input: CustomExerciseInput) {
      const name = input.name.trim().replace(/\s+/g, ' ');
      const existing = await repo.findCustom(id);
      if (existing && existing.userId !== actor.id) throw forbidden('This exercise belongs to another member.');
      if (await repo.findCustomByName(actor.id, input.muscle, name, id)) throw conflict('duplicate_exercise', `« ${name} » existe déjà pour ce muscle.`);
      if (!existing && (await repo.countCustoms(actor.id)) >= MAX_CUSTOM) throw unprocessable('too_many_exercises', `${MAX_CUSTOM} exercices personnels maximum.`);
      await repo.upsertCustom({ id, userId: actor.id, muscle: input.muscle, name, kind: input.kind });
      return { id, muscle: input.muscle, name, kind: input.kind };
    },

    async deleteCustomExercise(actor: Actor, id: string) {
      const existing = await repo.findCustom(id);
      if (!existing) return;
      if (existing.userId !== actor.id) throw forbidden('This exercise belongs to another member.');
      if (await repo.exerciseInUse(actor.id, id)) throw conflict('exercise_in_use', 'Cet exercice est utilisé dans tes séances.');
      await repo.deleteCustom(id);
    },

    /** Used by the Floor (suggested muscle) and the Mur (last session). */
    async summary(actor: Actor) {
      const gym = await deps.clubs.getGym(actor.gymId);
      const now = new Date();
      const facts = await loadFacts(repo, actor.id, { since: new Date(now.getTime() - 120 * 86_400_000) });
      const today = localDay(now, gym.timezone);
      return summary(facts, now, d => localDay(d, gym.timezone) === today);
    },
  };
}

export type JournalService = ReturnType<typeof createJournalService>;
