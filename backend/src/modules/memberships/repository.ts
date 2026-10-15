import { and, asc, desc, eq, gte, inArray, lt, sql, sum } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { memberships } from '../../shared/db/schema.js';

export type MembershipRow = typeof memberships.$inferSelect;

export const membershipsRepository = (db: DbOrTx) => ({
/** What the club actually took in over a window, in millimes. */  async revenueBetween(gymId: string, from: Date, to: Date): Promise<number> {    const [row] = await db      .select({ total: sum(memberships.priceMillimes) })      .from(memberships)      .where(and(eq(memberships.gymId, gymId), gte(memberships.createdAt, from), lt(memberships.createdAt, to)));    return Number(row?.total ?? 0);  },
  /** Latest membership (furthest end date) per user. */
  async latestFor(userIds: string[]): Promise<Map<string, MembershipRow>> {
    if (!userIds.length) return new Map();
    const rows = await db.selectDistinctOn([memberships.userId]).from(memberships)
      .where(inArray(memberships.userId, userIds))
      .orderBy(memberships.userId, desc(memberships.endsOn));
    return new Map(rows.map(r => [r.userId, r]));
  },
  latestInGym(gymId: string): Promise<MembershipRow[]> {
    return db.selectDistinctOn([memberships.userId]).from(memberships)
      .where(eq(memberships.gymId, gymId))
      .orderBy(memberships.userId, desc(memberships.endsOn));
  },
  async insert(values: typeof memberships.$inferInsert): Promise<MembershipRow> {
    return (await db.insert(memberships).values(values).returning())[0]!;
  },
  historyOf(gymId: string, userId: string): Promise<MembershipRow[]> {
    return db.select().from(memberships)
      .where(and(eq(memberships.gymId, gymId), eq(memberships.userId, userId)))
      .orderBy(desc(memberships.endsOn));
  },
});
