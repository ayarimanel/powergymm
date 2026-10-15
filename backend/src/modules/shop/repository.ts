import { and, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { products, reservations } from '../../shared/db/schema.js';

export type ProductRow = typeof products.$inferSelect;
export type ReservationRow = typeof reservations.$inferSelect;
export type ReservationStatus = ReservationRow['status'];

export const shopRepository = (db: DbOrTx) => ({
  products(gymId: string): Promise<ProductRow[]> {
    return db.select().from(products)
      .where(and(eq(products.gymId, gymId), isNull(products.archivedAt)))
      .orderBy(desc(products.createdAt));
  },
  async product(gymId: string, id: string): Promise<ProductRow | undefined> {
    return (await db.select().from(products).where(and(eq(products.gymId, gymId), eq(products.id, id), isNull(products.archivedAt))))[0];
  },
  productsByIds(ids: string[]): Promise<ProductRow[]> {
    return ids.length ? db.select().from(products).where(inArray(products.id, ids)) : Promise.resolve([]);
  },
  async insertProduct(values: typeof products.$inferInsert): Promise<ProductRow> {
    return (await db.insert(products).values(values).returning())[0]!;
  },
  async updateProduct(id: string, patch: Partial<typeof products.$inferInsert>): Promise<ProductRow> {
    return (await db.update(products).set(patch).where(eq(products.id, id)).returning())[0]!;
  },
  async insertReservation(values: typeof reservations.$inferInsert): Promise<ReservationRow> {
    return (await db.insert(reservations).values(values).returning())[0]!;
  },
  async reservation(gymId: string, id: string): Promise<ReservationRow | undefined> {
    return (await db.select().from(reservations).where(and(eq(reservations.gymId, gymId), eq(reservations.id, id))))[0];
  },
  reservations(gymId: string, opts: { userId?: string; status?: ReservationStatus }): Promise<ReservationRow[]> {
    const where: SQL[] = [eq(reservations.gymId, gymId)];
    if (opts.userId) where.push(eq(reservations.userId, opts.userId));
    if (opts.status) where.push(eq(reservations.status, opts.status));
    return db.select().from(reservations).where(and(...where)).orderBy(desc(reservations.createdAt)).limit(200);
  },
  async setStatus(id: string, from: ReservationStatus, to: ReservationStatus): Promise<ReservationRow | undefined> {
    // Guarded on the current status so two staff tapping at once cannot skip a step.
    return (await db.update(reservations).set({ status: to })
      .where(and(eq(reservations.id, id), eq(reservations.status, from))).returning())[0];
  },
});
