import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import { PRODUCT_CATEGORIES } from '../../shared/db/schema.js';
import { IdParam, Millimes, type App } from '../../shared/http.js';
import type { ShopService } from './service.js';

const Product = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.enum(PRODUCT_CATEGORIES),
  description: z.string().trim().max(1000).default(''),
  priceMillimes: Millimes,
  originalPriceMillimes: Millimes.nullable().optional(),
  imageUrls: z.array(z.url()).max(6).default([]),
  inStock: z.boolean().default(true),
  lowStock: z.boolean().default(false),
});

const Status = z.enum(['pending', 'ready', 'picked_up', 'cancelled']);

export function shopRoutes(app: App, shop: ShopService) {
  const auth = { preHandler: app.requireActor };
  const tags = ['shop'];

  app.get('/v1/products', { ...auth, schema: { tags } }, req => shop.products(actorOf(req)));

  app.post('/v1/products', { ...auth, schema: { tags, body: Product } }, async (req, reply) =>
    reply.code(201).send(await shop.createProduct(actorOf(req), req.body)));

  app.patch('/v1/products/:id', { ...auth, schema: { tags, params: IdParam, body: Product.partial() } }, req =>
    shop.updateProduct(actorOf(req), req.params.id, req.body));

  app.delete('/v1/products/:id', { ...auth, schema: { tags, params: IdParam } }, async (req, reply) => {
    await shop.archiveProduct(actorOf(req), req.params.id);
    return reply.code(204).send();
  });

  app.post('/v1/reservations', {
    ...auth,
    schema: { tags, body: z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(20).default(1) }) },
  }, async (req, reply) => reply.code(201).send(await shop.reserve(actorOf(req), req.body.productId, req.body.quantity)));

  app.get('/v1/reservations', {
    ...auth,
    schema: { tags, querystring: z.object({ status: Status.optional(), scope: z.enum(['mine', 'all']).default('mine') }) },
  }, req => shop.reservations(actorOf(req), { status: req.query.status, all: req.query.scope === 'all' }));

  app.patch('/v1/reservations/:id', {
    ...auth,
    schema: { tags, params: IdParam, body: z.object({ status: Status }) },
  }, req => shop.setStatus(actorOf(req), req.params.id, req.body.status));
}
