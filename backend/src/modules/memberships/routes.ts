import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import { IdParam, Millimes, type App } from '../../shared/http.js';
import type { MembershipsService } from './service.js';

const Renewal = z.object({
  days: z.number().int().min(1).max(366).default(30),
  planName: z.string().trim().min(2).max(40).default('Mensuel'),
  priceMillimes: Millimes.default(0),
});

export function membershipsRoutes(app: App, memberships: MembershipsService) {
  const auth = { preHandler: app.requireActor };

  app.get('/v1/me/membership', { ...auth, schema: { tags: ['memberships'] } }, req =>
    memberships.myStatus(actorOf(req)));

  app.get('/v1/members', { ...auth, schema: { tags: ['memberships'] } }, req =>
    memberships.roster(actorOf(req)));

  app.get('/v1/members/:id/memberships', { ...auth, schema: { tags: ['memberships'], params: IdParam } }, req =>
    memberships.history(actorOf(req), req.params.id));

  app.post('/v1/members/:id/renew', { ...auth, schema: { tags: ['memberships'], params: IdParam, body: Renewal } }, async (req, reply) =>
    reply.code(201).send(await memberships.renew(actorOf(req), req.params.id, req.body)));
}
