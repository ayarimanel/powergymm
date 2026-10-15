import type { Db } from '../../shared/db/client.js';
import type { EventBus } from '../../shared/events/bus.js';
import { can, requirePermission, type Actor } from '../../shared/auth/actor.js';
import { badRequest, conflict, forbidden, notFound } from '../../shared/errors.js';
import type { IdentityService } from '../identity/index.js';
import { shopRepository, type ProductRow, type ReservationRow, type ReservationStatus } from './repository.js';

export type ProductInput = Pick<ProductRow, 'name' | 'category' | 'description' | 'priceMillimes' | 'imageUrls' | 'inStock' | 'lowStock'> & {
  originalPriceMillimes?: number | null;
};

/** Allowed reservation moves. Members may only cancel; staff move orders forward. */
export const TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ['ready', 'cancelled'],
  ready: ['picked_up', 'cancelled'],
  picked_up: [],
  cancelled: [],
};

export const discountPct = (p: Pick<ProductRow, 'priceMillimes' | 'originalPriceMillimes'>) =>
  p.originalPriceMillimes && p.originalPriceMillimes > p.priceMillimes
    ? Math.round((1 - p.priceMillimes / p.originalPriceMillimes) * 100)
    : 0;

export function createShopService(db: Db, bus: EventBus, deps: { identity: IdentityService }) {
  const repo = shopRepository(db);

  const withDiscount = (p: ProductRow) => ({ ...p, discountPct: discountPct(p) });

  const loadProduct = async (actor: Actor, id: string) => {
    const p = await repo.product(actor.gymId, id);
    if (!p) throw notFound('Product');
    return p;
  };

  const present = async (rows: ReservationRow[]) => {
    const [items, people] = await Promise.all([
      repo.productsByIds([...new Set(rows.map(r => r.productId))]),
      deps.identity.summaries(rows.map(r => r.userId)),
    ]);
    const byId = new Map(items.map(p => [p.id, p]));
    return rows.map(r => ({
      ...r,
      totalMillimes: r.unitPriceMillimes * r.quantity,
      product: byId.has(r.productId) ? { name: byId.get(r.productId)!.name, imageUrl: byId.get(r.productId)!.imageUrls[0] ?? null } : null,
      member: people.get(r.userId) ?? null,
    }));
  };

  return {
    async products(actor: Actor) {
      return (await repo.products(actor.gymId)).map(withDiscount);
    },

    async createProduct(actor: Actor, input: ProductInput) {
      requirePermission(actor, 'manage_products');
      return withDiscount(await repo.insertProduct({ ...input, gymId: actor.gymId, createdBy: actor.id }));
    },

    async updateProduct(actor: Actor, id: string, patch: Partial<ProductInput>) {
      requirePermission(actor, 'manage_products');
      await loadProduct(actor, id);
      return withDiscount(await repo.updateProduct(id, patch));
    },

    async archiveProduct(actor: Actor, id: string) {
      requirePermission(actor, 'manage_products');
      await loadProduct(actor, id);
      await repo.updateProduct(id, { archivedAt: new Date() });
    },

    async reserve(actor: Actor, productId: string, quantity: number) {
      const p = await loadProduct(actor, productId);
      if (!p.inStock) throw conflict('out_of_stock', `${p.name} is out of stock.`);
      const row = await repo.insertReservation({ gymId: actor.gymId, productId, userId: actor.id, quantity, unitPriceMillimes: p.priceMillimes });
      return (await present([row]))[0];
    },

    /** Staff see every order (optionally by status); members see their own. */
    async reservations(actor: Actor, opts: { status?: ReservationStatus; all: boolean }) {
      if (opts.all) requirePermission(actor, 'manage_products');
      return present(await repo.reservations(actor.gymId, { status: opts.status, userId: opts.all ? undefined : actor.id }));
    },

    async setStatus(actor: Actor, id: string, to: ReservationStatus) {
      const r = await repo.reservation(actor.gymId, id);
      if (!r) throw notFound('Reservation');
      const staff = can(actor, 'manage_products');
      if (!staff && !(r.userId === actor.id && to === 'cancelled')) throw forbidden();
      if (!TRANSITIONS[r.status].includes(to)) throw badRequest('invalid_transition', `A ${r.status.replace('_', ' ')} order cannot become ${to.replace('_', ' ')}.`);

      const updated = await repo.setStatus(id, r.status, to);
      if (!updated) throw conflict('stale_status', 'This order just changed. Refresh and try again.');
      if (to === 'ready') {
        const p = (await repo.productsByIds([r.productId]))[0];
        bus.emit('reservation.ready', { gymId: actor.gymId, reservationId: id, userId: r.userId, productName: p?.name ?? '', actorId: actor.id });
      }
      return (await present([updated]))[0];
    },
  };
}

export type ShopService = ReturnType<typeof createShopService>;
