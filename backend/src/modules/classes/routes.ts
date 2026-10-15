import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import { Day, IdParam, type App } from '../../shared/http.js';
import type { ClassesService } from './service.js';

const ClassBody = z.object({
  title: z.string().trim().min(2).max(60),
  coachId: z.uuid().nullable().optional(),
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM'),
  durationMin: z.number().int().min(10).max(240),
  capacity: z.number().int().min(1).max(500),
});

const SessionParams = IdParam.extend({ date: Day });

export function classesRoutes(app: App, classes: ClassesService) {
  const auth = { preHandler: app.requireActor };

  app.get('/v1/classes', { ...auth, schema: { tags: ['classes'] } }, req => classes.schedule(actorOf(req)));

  app.post('/v1/classes', { ...auth, schema: { tags: ['classes'], body: ClassBody } }, async (req, reply) =>
    reply.code(201).send(await classes.create(actorOf(req), req.body)));

  app.patch('/v1/classes/:id', { ...auth, schema: { tags: ['classes'], params: IdParam, body: ClassBody.partial() } }, req =>
    classes.update(actorOf(req), req.params.id, req.body));

  app.delete('/v1/classes/:id', { ...auth, schema: { tags: ['classes'], params: IdParam } }, async (req, reply) => {
    await classes.archive(actorOf(req), req.params.id);
    return reply.code(204).send();
  });

  app.post('/v1/classes/:id/sessions/:date/booking', { ...auth, schema: { tags: ['classes'], params: SessionParams } }, async (req, reply) =>
    reply.code(201).send(await classes.book(actorOf(req), req.params.id, req.params.date)));

  app.delete('/v1/classes/:id/sessions/:date/booking', { ...auth, schema: { tags: ['classes'], params: SessionParams } }, async (req, reply) => {
    await classes.unbook(actorOf(req), req.params.id, req.params.date);
    return reply.code(204).send();
  });

  app.post('/v1/classes/:id/sessions/:date/cancel', {
    ...auth,
    schema: { tags: ['classes'], params: SessionParams, body: z.object({ reason: z.string().trim().min(3).max(200) }) },
  }, req => classes.cancelSession(actorOf(req), req.params.id, req.params.date, req.body.reason));
}
