import { and, asc, eq, inArray } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { coachPlans, coachProfiles, coachTransformations } from '../../shared/db/schema.js';

export type CoachRow = typeof coachProfiles.$inferSelect;
export type PlanRow = typeof coachPlans.$inferSelect;
export type TransformationRow = typeof coachTransformations.$inferSelect;
export type CoachStatus = CoachRow['status'];

export const coachingRepository = (db: DbOrTx) => ({
  byStatus(gymId: string, status: CoachStatus): Promise<CoachRow[]> {
    return db.select().from(coachProfiles)
      .where(and(eq(coachProfiles.gymId, gymId), eq(coachProfiles.status, status)))
      .orderBy(asc(coachProfiles.createdAt));
  },
  async byUser(userId: string): Promise<CoachRow | undefined> {
    return (await db.select().from(coachProfiles).where(eq(coachProfiles.userId, userId)))[0];
  },
  async upsert(values: typeof coachProfiles.$inferInsert): Promise<CoachRow> {
    const { userId: _userId, gymId: _gymId, ...rest } = values;
    return (await db.insert(coachProfiles).values(values)
      .onConflictDoUpdate({ target: coachProfiles.userId, set: rest }).returning())[0]!;
  },
  async update(userId: string, patch: Partial<typeof coachProfiles.$inferInsert>): Promise<CoachRow> {
    return (await db.update(coachProfiles).set(patch).where(eq(coachProfiles.userId, userId)).returning())[0]!;
  },
  plansOf(coachIds: string[]): Promise<PlanRow[]> {
    return coachIds.length
      ? db.select().from(coachPlans).where(inArray(coachPlans.coachId, coachIds)).orderBy(asc(coachPlans.position))
      : Promise.resolve([]);
  },
  transformationsOf(coachIds: string[]): Promise<TransformationRow[]> {
    return coachIds.length
      ? db.select().from(coachTransformations).where(inArray(coachTransformations.coachId, coachIds)).orderBy(asc(coachTransformations.createdAt))
      : Promise.resolve([]);
  },
  async replacePlans(coachId: string, gymId: string, plans: Omit<typeof coachPlans.$inferInsert, 'coachId' | 'gymId' | 'position'>[]) {
    await db.delete(coachPlans).where(eq(coachPlans.coachId, coachId));
    if (plans.length) await db.insert(coachPlans).values(plans.map((p, position) => ({ ...p, coachId, gymId, position })));
  },
  async replaceTransformations(coachId: string, gymId: string, list: Omit<typeof coachTransformations.$inferInsert, 'coachId' | 'gymId'>[]) {
    await db.delete(coachTransformations).where(eq(coachTransformations.coachId, coachId));
    if (list.length) await db.insert(coachTransformations).values(list.map(t => ({ ...t, coachId, gymId })));
  },
});
