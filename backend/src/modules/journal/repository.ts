import { and, asc, count, desc, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { customExercises, workoutSets, workouts } from '../../shared/db/schema.js';

export type WorkoutRow = typeof workouts.$inferSelect;
export type SetRow = typeof workoutSets.$inferSelect;
export type CustomExerciseRow = typeof customExercises.$inferSelect;

export const journalRepository = (db: DbOrTx) => ({
  findWorkout(id: string): Promise<WorkoutRow | undefined> {
    return db.select().from(workouts).where(eq(workouts.id, id)).then(r => r[0]);
  },

  /** Live (not deleted) workouts of a member, newest first. */
  workoutsOf(userId: string, opts: { since?: Date; before?: Date; excludeId?: string } = {}): Promise<WorkoutRow[]> {
    const where = [eq(workouts.userId, userId), isNull(workouts.deletedAt)];
    if (opts.since) where.push(gte(workouts.date, opts.since));
    if (opts.before) where.push(lt(workouts.date, opts.before));
    if (opts.excludeId) where.push(ne(workouts.id, opts.excludeId));
    return db.select().from(workouts).where(and(...where)).orderBy(desc(workouts.date));
  },

  setsOf(workoutIds: string[]): Promise<SetRow[]> {
    if (!workoutIds.length) return Promise.resolve([]);
    return db.select().from(workoutSets).where(inArray(workoutSets.workoutId, workoutIds)).orderBy(asc(workoutSets.workoutId), asc(workoutSets.order));
  },

  /** Create or replace the workout row (the caller has checked it is the member's own). */
  async upsertWorkout(values: typeof workouts.$inferInsert) {
    await db
      .insert(workouts)
      .values(values)
      .onConflictDoUpdate({
        target: workouts.id,
        set: { date: values.date, startedAt: values.startedAt, endedAt: values.endedAt ?? null, live: values.live, migrated: values.migrated, updatedAt: new Date() },
      });
  },

  async replaceSets(workoutId: string, rows: (typeof workoutSets.$inferInsert)[]) {
    await db.delete(workoutSets).where(eq(workoutSets.workoutId, workoutId));
    if (rows.length) await db.insert(workoutSets).values(rows);
  },

  async softDelete(id: string) {
    await db.update(workouts).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(workouts.id, id), isNull(workouts.deletedAt)));
  },

  customsOf(userId: string): Promise<CustomExerciseRow[]> {
    return db.select().from(customExercises).where(eq(customExercises.userId, userId)).orderBy(asc(customExercises.createdAt));
  },

  findCustom(id: string): Promise<CustomExerciseRow | undefined> {
    return db.select().from(customExercises).where(eq(customExercises.id, id)).then(r => r[0]);
  },

  /** Same member, same muscle, same name (case and outer spaces ignored), another id. */
  findCustomByName(userId: string, muscle: CustomExerciseRow['muscle'], name: string, notId: string): Promise<CustomExerciseRow | undefined> {
    return db
      .select()
      .from(customExercises)
      .where(and(eq(customExercises.userId, userId), eq(customExercises.muscle, muscle), sql`lower(btrim(${customExercises.name})) = lower(btrim(${name}))`, ne(customExercises.id, notId)))
      .then(r => r[0]);
  },

  async countCustoms(userId: string): Promise<number> {
    const [row] = await db.select({ n: count() }).from(customExercises).where(eq(customExercises.userId, userId));
    return Number(row?.n ?? 0);
  },

  async upsertCustom(values: typeof customExercises.$inferInsert) {
    await db
      .insert(customExercises)
      .values(values)
      .onConflictDoUpdate({ target: customExercises.id, set: { muscle: values.muscle, name: values.name, kind: values.kind } });
  },

  /** Is the exercise used by any of the member's live workouts? */
  async exerciseInUse(userId: string, exerciseId: string): Promise<boolean> {
    const rows = await db
      .select({ id: workoutSets.id })
      .from(workoutSets)
      .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
      .where(and(eq(workouts.userId, userId), isNull(workouts.deletedAt), eq(workoutSets.exerciseId, exerciseId)))
      .limit(1);
    return rows.length > 0;
  },

  async deleteCustom(id: string) {
    await db.delete(customExercises).where(eq(customExercises.id, id));
  },
});
