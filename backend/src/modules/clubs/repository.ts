import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { announcements, gyms } from '../../shared/db/schema.js';

export type GymRow = typeof gyms.$inferSelect;
export type AnnouncementRow = typeof announcements.$inferSelect;

export const clubsRepository = (db: DbOrTx) => ({
  async byId(id: string): Promise<GymRow | undefined> {
    return (await db.select().from(gyms).where(eq(gyms.id, id)))[0];
  },
  all(): Promise<Pick<GymRow, 'id' | 'timezone'>[]> {
    return db.select({ id: gyms.id, timezone: gyms.timezone }).from(gyms);
  },
  async bySlug(slug: string): Promise<GymRow | undefined> {
    return (await db.select().from(gyms).where(eq(gyms.slug, slug)))[0];
  },
  async insert(values: typeof gyms.$inferInsert): Promise<GymRow> {
    return (await db.insert(gyms).values(values).returning())[0]!;
  },
  async update(id: string, patch: Partial<typeof gyms.$inferInsert>): Promise<GymRow> {
    return (await db.update(gyms).set(patch).where(eq(gyms.id, id)).returning())[0]!;
  },
  listAnnouncements(gymId: string, now: Date): Promise<AnnouncementRow[]> {
    return db.select().from(announcements)
      .where(and(eq(announcements.gymId, gymId), or(isNull(announcements.endsAt), gt(announcements.endsAt, now))))
      .orderBy(desc(announcements.urgent), desc(announcements.createdAt))
      .limit(50);
  },
  async insertAnnouncement(values: typeof announcements.$inferInsert): Promise<AnnouncementRow> {
    return (await db.insert(announcements).values(values).returning())[0]!;
  },
  async deleteAnnouncement(gymId: string, id: string): Promise<boolean> {
    const rows = await db.delete(announcements).where(and(eq(announcements.gymId, gymId), eq(announcements.id, id))).returning({ id: announcements.id });
    return rows.length > 0;
  },
});
