import { and, count, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { memberProfiles } from '../../shared/db/schema.js';

export type MemberProfileRow = typeof memberProfiles.$inferSelect;

export const habitsRepository = (db: DbOrTx) => ({
  /** One member's own row. Nothing in this module ever reads another member's. */
  find(gymId: string, userId: string): Promise<MemberProfileRow | undefined> {
    return db
      .select()
      .from(memberProfiles)
      .where(and(eq(memberProfiles.gymId, gymId), eq(memberProfiles.userId, userId)))
      .then(r => r[0]);
  },

  /** Card-by-card save: the questionnaire patches a few columns at a time. */
  async upsert(gymId: string, userId: string, patch: Partial<typeof memberProfiles.$inferInsert>) {
    await db
      .insert(memberProfiles)
      .values({ gymId, userId, ...patch })
      .onConflictDoUpdate({
        target: [memberProfiles.gymId, memberProfiles.userId],
        set: { ...patch, updatedAt: new Date() },
      });
  },

  /** Aggregates only: the owner never sees who. */
  async subscriptionSummary(gymId: string, from: string, to: string) {
    const [ending] = await db
      .select({ n: count() })
      .from(memberProfiles)
      .where(
        and(
          eq(memberProfiles.gymId, gymId),
          gte(memberProfiles.subscriptionEndsAt, from),
          lte(memberProfiles.subscriptionEndsAt, to)
        )
      );

    const [renewed] = await db
      .select({ n: count() })
      .from(memberProfiles)
      .where(
        and(
          eq(memberProfiles.gymId, gymId),
          eq(memberProfiles.subscriptionPaidAtSource, 'confirmed'),
          gte(memberProfiles.subscriptionPaidAt, from)
        )
      );

    return { endingThisWeek: ending?.n ?? 0, renewedThisWeek: renewed?.n ?? 0 };
  },

  /** "≈ 12 membres viennent d'habitude vers 18h", before real scans exist. */
  expectedBySlot(gymId: string): Promise<{ slot: string | null; n: number }[]> {
    return db
      .select({ slot: memberProfiles.usualSlot, n: count() })
      .from(memberProfiles)
      .where(and(eq(memberProfiles.gymId, gymId), isNotNull(memberProfiles.usualSlot)))
      .groupBy(memberProfiles.usualSlot);
  },

  /** Rows the daily reminder job must look at today. */
  dueForReminder(gymId: string, today: string): Promise<MemberProfileRow[]> {
    return db
      .select()
      .from(memberProfiles)
      .where(
        and(
          eq(memberProfiles.gymId, gymId),
          isNotNull(memberProfiles.subscriptionEndsAt),
          sql`${memberProfiles.renewalRemindersSent} < 3`,
          lte(memberProfiles.subscriptionEndsAt, sql`(${today}::date + interval '4 day')`)
        )
      );
  },
});
