import { and, desc, eq, gte, lt, max, sql } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { checkIns } from '../../shared/db/schema.js';

export type CheckInRow = typeof checkIns.$inferSelect;

export const attendanceRepository = (db: DbOrTx) => ({
  async activeFor(userId: string): Promise<CheckInRow | undefined> {
    return (await db.select().from(checkIns).where(and(eq(checkIns.userId, userId), eq(checkIns.status, 'active'))))[0];
  },
  async insert(values: typeof checkIns.$inferInsert): Promise<CheckInRow> {
    return (await db.insert(checkIns).values(values).returning())[0]!;
  },
  async update(id: string, patch: Partial<typeof checkIns.$inferInsert>): Promise<CheckInRow> {
    return (await db.update(checkIns).set(patch).where(eq(checkIns.id, id)).returning())[0]!;
  },
  activeInGym(gymId: string): Promise<CheckInRow[]> {
    return db.select().from(checkIns)
      .where(and(eq(checkIns.gymId, gymId), eq(checkIns.status, 'active')))
      .orderBy(desc(checkIns.startedAt));
  },
  /** Distinct visit days, newest first. */
  async visitDays(userId: string, limit = 400): Promise<string[]> {
    const rows = await db.selectDistinct({ day: checkIns.localDay }).from(checkIns)
      .where(eq(checkIns.userId, userId)).orderBy(desc(checkIns.localDay)).limit(limit);
    return rows.map(r => r.day);
  },
  /** Check-ins per local hour since `since`, for the "usually busy at" chart. */
  async countsByHour(gymId: string, timezone: string, since: Date): Promise<Map<number, number>> {
    const hour = sql<number>`extract(hour from ${checkIns.startedAt} at time zone ${timezone})::int`;
    const rows = await db.select({ hour, n: sql<number>`count(*)::int` }).from(checkIns)
      .where(and(eq(checkIns.gymId, gymId), gte(checkIns.startedAt, since)))
      // By position: the timezone is bound as a separate parameter in each clause,
      // so Postgres would not see the two expressions as the same.
      .groupBy(sql`1`);
    return new Map(rows.map(r => [Number(r.hour), Number(r.n)]));
  },
  async lastVisits(gymId: string): Promise<Map<string, Date>> {
    const rows = await db.select({ userId: checkIns.userId, last: max(checkIns.startedAt) }).from(checkIns)
      .where(eq(checkIns.gymId, gymId)).groupBy(checkIns.userId);
    return new Map(rows.filter(r => r.last).map(r => [r.userId, new Date(r.last as Date | string)]));
  },
  async expireStartedBefore(cutoff: Date): Promise<number> {
    const rows = await db.update(checkIns).set({ status: 'expired', endedAt: sql`now()` })
      .where(and(eq(checkIns.status, 'active'), lt(checkIns.startedAt, cutoff)))
      .returning({ id: checkIns.id });
    return rows.length;
  },
});
