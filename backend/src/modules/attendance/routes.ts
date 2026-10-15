import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import { Muscle, type App } from '../../shared/http.js';
import type { AttendanceService } from './service.js';

const CheckIn = z.object({
  code: z.string().trim().min(4).max(40),
  muscles: z.array(Muscle).max(6).default([]),
});

export function attendanceRoutes(app: App, attendance: AttendanceService) {
  const auth = { preHandler: app.requireActor };

  app.post('/v1/check-ins', { ...auth, schema: { tags: ['attendance'], body: CheckIn } }, async (req, reply) => {
    const result = await attendance.checkIn(actorOf(req), req.body);
    return reply.code(result.alreadyCheckedIn ? 200 : 201).send(result);
  });

  app.get('/v1/check-ins/current', { ...auth, schema: { tags: ['attendance'] } }, req =>
    attendance.current(actorOf(req)));

  app.post('/v1/check-ins/current/end', { ...auth, schema: { tags: ['attendance'] } }, req =>
    attendance.endCurrent(actorOf(req)));

  app.get('/v1/me/streak', { ...auth, schema: { tags: ['attendance'] } }, req =>
    attendance.streak(actorOf(req)));

  app.get('/v1/floor', { ...auth, schema: { tags: ['attendance'] } }, req =>
    attendance.floor(actorOf(req)));
}
