import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import { IdParam, type App } from '../../shared/http.js';
import { gymView, type ClubsService } from './service.js';

const Settings = z.object({
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().max(60).nullable(),
  logoUrl: z.url().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  openingHour: z.number().int().min(0).max(23),
  closingHour: z.number().int().min(1).max(24),
  maxCapacity: z.number().int().min(1).max(5000),
  classesEnabled: z.boolean(),
  enforceMemberships: z.boolean(),
  timezone: z.string().min(3).max(60),
}).partial();

const Announcement = z.object({
  kind: z.enum(['aid', 'iftar', 'closure', 'hours', 'event', 'info']).default('info'),
  title: z.string().trim().min(2).max(80),
  message: z.string().trim().max(1000),
  whenLabel: z.string().trim().max(60).optional(),
  urgent: z.boolean().default(false),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

export function clubsRoutes(app: App, clubs: ClubsService) {
  const auth = { preHandler: app.requireActor };

  app.get('/v1/gym', { ...auth, schema: { tags: ['clubs'] } }, async req => {
    const actor = actorOf(req);
    return gymView(await clubs.getGym(actor.gymId), actor);
  });

  app.patch('/v1/gym', { ...auth, schema: { tags: ['clubs'], body: Settings } }, req =>
    clubs.updateSettings(actorOf(req), req.body));

  app.post('/v1/gym/check-in-code/rotate', { ...auth, schema: { tags: ['clubs'] } }, async req =>
    ({ checkInCode: await clubs.rotateCheckInCode(actorOf(req)) }));

  app.get('/v1/announcements', { ...auth, schema: { tags: ['clubs'] } }, req =>
    clubs.listAnnouncements(actorOf(req)));

  app.post('/v1/announcements', { ...auth, schema: { tags: ['clubs'], body: Announcement } }, async (req, reply) =>
    reply.code(201).send(await clubs.publishAnnouncement(actorOf(req), req.body)));

  app.delete('/v1/announcements/:id', { ...auth, schema: { tags: ['clubs'], params: IdParam } }, async (req, reply) => {
    await clubs.deleteAnnouncement(actorOf(req), req.params.id);
    return reply.code(204).send();
  });
}
