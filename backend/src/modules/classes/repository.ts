import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { classBookings, classSessions, groupClasses } from '../../shared/db/schema.js';

export type ClassRow = typeof groupClasses.$inferSelect;
export type SessionRow = typeof classSessions.$inferSelect;

export const classesRepository = (db: DbOrTx) => ({
  activeInGym(gymId: string): Promise<ClassRow[]> {
    return db.select().from(groupClasses)
      .where(and(eq(groupClasses.gymId, gymId), eq(groupClasses.active, true)))
      .orderBy(asc(groupClasses.weekday), asc(groupClasses.startTime));
  },
  async byId(gymId: string, id: string): Promise<ClassRow | undefined> {
    return (await db.select().from(groupClasses).where(and(eq(groupClasses.gymId, gymId), eq(groupClasses.id, id))))[0];
  },
  async insert(values: typeof groupClasses.$inferInsert): Promise<ClassRow> {
    return (await db.insert(groupClasses).values(values).returning())[0]!;
  },
  async update(id: string, patch: Partial<typeof groupClasses.$inferInsert>): Promise<ClassRow> {
    return (await db.update(groupClasses).set(patch).where(eq(groupClasses.id, id)).returning())[0]!;
  },
  upcomingSessions(classIds: string[], fromDay: string): Promise<SessionRow[]> {
    if (!classIds.length) return Promise.resolve([]);
    return db.select().from(classSessions)
      .where(and(inArray(classSessions.classId, classIds), gte(classSessions.sessionDate, fromDay)));
  },
  async bookingCounts(sessionIds: string[]): Promise<Map<string, number>> {
    if (!sessionIds.length) return new Map();
    const rows = await db.select({ id: classBookings.sessionId, n: sql<number>`count(*)::int` }).from(classBookings)
      .where(inArray(classBookings.sessionId, sessionIds)).groupBy(classBookings.sessionId);
    return new Map(rows.map(r => [r.id, Number(r.n)]));
  },
  async bookedBy(userId: string, sessionIds: string[]): Promise<Set<string>> {
    if (!sessionIds.length) return new Set();
    const rows = await db.select({ id: classBookings.sessionId }).from(classBookings)
      .where(and(eq(classBookings.userId, userId), inArray(classBookings.sessionId, sessionIds)));
    return new Set(rows.map(r => r.id));
  },
  /** Get or create the dated session and lock it for the rest of the transaction. */
  async lockSession(gymId: string, classId: string, date: string): Promise<SessionRow> {
    await db.insert(classSessions).values({ gymId, classId, sessionDate: date }).onConflictDoNothing();
    return (await db.select().from(classSessions)
      .where(and(eq(classSessions.classId, classId), eq(classSessions.sessionDate, date)))
      .for('update'))[0]!;
  },
  async findSession(classId: string, date: string): Promise<SessionRow | undefined> {
    return (await db.select().from(classSessions).where(and(eq(classSessions.classId, classId), eq(classSessions.sessionDate, date))))[0];
  },
  async countBookings(sessionId: string): Promise<number> {
    const rows = await db.select({ n: sql<number>`count(*)::int` }).from(classBookings).where(eq(classBookings.sessionId, sessionId));
    return Number(rows[0]?.n ?? 0);
  },
  async book(sessionId: string, userId: string, gymId: string): Promise<boolean> {
    const rows = await db.insert(classBookings).values({ sessionId, userId, gymId }).onConflictDoNothing().returning({ id: classBookings.sessionId });
    return rows.length > 0;
  },
  async unbook(sessionId: string, userId: string): Promise<boolean> {
    const rows = await db.delete(classBookings).where(and(eq(classBookings.sessionId, sessionId), eq(classBookings.userId, userId))).returning({ id: classBookings.sessionId });
    return rows.length > 0;
  },
  async bookedUserIds(sessionId: string): Promise<string[]> {
    const rows = await db.select({ id: classBookings.userId }).from(classBookings).where(eq(classBookings.sessionId, sessionId));
    return rows.map(r => r.id);
  },
  async cancel(sessionId: string, reason: string, by: string): Promise<SessionRow> {
    return (await db.update(classSessions).set({ status: 'cancelled', cancelReason: reason, cancelledBy: by })
      .where(eq(classSessions.id, sessionId)).returning())[0]!;
  },
});
