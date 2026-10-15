import { and, count, desc, eq, inArray, isNull, lt, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { notifications, pushDevices } from '../../shared/db/schema.js';

export type NotificationRow = typeof notifications.$inferSelect;

export const notificationsRepository = (db: DbOrTx) => ({
  async insertMany(values: (typeof notifications.$inferInsert)[]): Promise<void> {
    if (values.length) await db.insert(notifications).values(values);
  },
  list(userId: string, opts: { limit: number; before?: Date }): Promise<NotificationRow[]> {
    const where: SQL[] = [eq(notifications.recipientId, userId)];
    if (opts.before) where.push(lt(notifications.createdAt, opts.before));
    return db.select().from(notifications).where(and(...where)).orderBy(desc(notifications.createdAt)).limit(opts.limit);
  },
  async unreadCount(userId: string): Promise<number> {
    const rows = await db.select({ n: count() }).from(notifications)
      .where(and(eq(notifications.recipientId, userId), isNull(notifications.readAt)));
    return Number(rows[0]?.n ?? 0);
  },
  async markRead(userId: string, ids?: string[]): Promise<void> {
    const where: SQL[] = [eq(notifications.recipientId, userId), isNull(notifications.readAt)];
    if (ids) where.push(inArray(notifications.id, ids));
    await db.update(notifications).set({ readAt: new Date() }).where(and(...where));
  },
  tokensFor(userIds: string[]) {
    return userIds.length
      ? db.select({ userId: pushDevices.userId, token: pushDevices.expoToken }).from(pushDevices).where(inArray(pushDevices.userId, userIds))
      : Promise.resolve([]);
  },
  async upsertDevice(userId: string, expoToken: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    await db.insert(pushDevices).values({ userId, expoToken, platform })
      .onConflictDoUpdate({ target: pushDevices.expoToken, set: { userId, platform, lastSeenAt: new Date() } });
  },
  async deleteTokens(tokens: string[], userId?: string): Promise<void> {
    if (!tokens.length) return;
    const where: SQL[] = [inArray(pushDevices.expoToken, tokens)];
    if (userId) where.push(eq(pushDevices.userId, userId));
    await db.delete(pushDevices).where(and(...where));
  },
});
