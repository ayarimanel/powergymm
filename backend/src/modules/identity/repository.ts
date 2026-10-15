import { and, asc, count, eq, gte, inArray, lt, or } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { profiles, staffPermissions } from '../../shared/db/schema.js';
import type { Permission } from '../../shared/auth/actor.js';

export type ProfileRow = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export const identityRepository = (db: DbOrTx) => ({
/** How many members joined the club in [from, to). Powers the owner's growth card. */  async signupsBetween(gymId: string, from: Date, to: Date): Promise<number> {    const [row] = await db      .select({ n: count() })      .from(profiles)      .where(and(eq(profiles.gymId, gymId), gte(profiles.createdAt, from), lt(profiles.createdAt, to)));    return row?.n ?? 0;  },  async totalMembers(gymId: string): Promise<number> {    const [row] = await db.select({ n: count() }).from(profiles).where(and(eq(profiles.gymId, gymId), eq(profiles.role, 'member')));    return row?.n ?? 0;  },
  async byId(id: string): Promise<ProfileRow | undefined> {
    return (await db.select().from(profiles).where(eq(profiles.id, id)))[0];
  },
  byIds(ids: string[]): Promise<ProfileRow[]> {
    return ids.length ? db.select().from(profiles).where(inArray(profiles.id, ids)) : Promise.resolve([]);
  },
  inGym(gymId: string): Promise<ProfileRow[]> {
    return db.select().from(profiles).where(eq(profiles.gymId, gymId)).orderBy(asc(profiles.fullName));
  },
  async insert(values: NewProfile): Promise<ProfileRow> {
    return (await db.insert(profiles).values(values).returning())[0]!;
  },
  async update(id: string, patch: Partial<NewProfile>): Promise<ProfileRow> {
    return (await db.update(profiles).set(patch).where(eq(profiles.id, id)).returning())[0]!;
  },
  async permissionsOf(userId: string): Promise<Permission[]> {
    const rows = await db.select({ p: staffPermissions.permission }).from(staffPermissions).where(eq(staffPermissions.userId, userId));
    return rows.map(r => r.p);
  },
  async replacePermissions(userId: string, gymId: string, list: Permission[], grantedBy: string): Promise<void> {
    await db.delete(staffPermissions).where(eq(staffPermissions.userId, userId));
    if (list.length) {
      await db.insert(staffPermissions).values(list.map(permission => ({ userId, gymId, permission, grantedBy })));
    }
  },
  /** Owners, plus staff holding `permission`. */
  async idsAllowedTo(gymId: string, permission: Permission): Promise<string[]> {
    const rows = await db
      .selectDistinct({ id: profiles.id })
      .from(profiles)
      .leftJoin(staffPermissions, and(eq(staffPermissions.userId, profiles.id), eq(staffPermissions.permission, permission)))
      .where(and(eq(profiles.gymId, gymId), or(eq(profiles.role, 'owner'), eq(staffPermissions.permission, permission))));
    return rows.map(r => r.id);
  },
  async countOwners(gymId: string): Promise<number> {
    const rows = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.gymId, gymId), eq(profiles.role, 'owner')));
    return rows.length;
  },
  async staff(gymId: string) {
    return db.select({ userId: staffPermissions.userId, permission: staffPermissions.permission })
      .from(staffPermissions).where(eq(staffPermissions.gymId, gymId));
  },
});
