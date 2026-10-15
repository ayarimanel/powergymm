import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import { Paging, type App } from '../../shared/http.js';
import type { NotificationsService } from './service.js';

const ExpoToken = z.string().regex(/^(Exponent|Expo)PushToken\[[^\]]+\]$/, 'Not an Expo push token');

export function notificationsRoutes(app: App, notifications: NotificationsService) {
  const auth = { preHandler: app.requireActor };
  const tags = ['notifications'];

  app.get('/v1/notifications', { ...auth, schema: { tags, querystring: Paging } }, req => {
    const { before, limit } = req.query;
    return notifications.list(actorOf(req), { limit, before: before ? new Date(before) : undefined });
  });

  app.post('/v1/notifications/read', {
    ...auth,
    schema: { tags, body: z.object({ ids: z.array(z.uuid()).max(200).optional() }) },
  }, async (req, reply) => {
    await notifications.markRead(actorOf(req), req.body.ids);
    return reply.code(204).send();
  });

  app.post('/v1/push-devices', {
    ...auth,
    schema: { tags, body: z.object({ token: ExpoToken, platform: z.enum(['ios', 'android', 'web']) }) },
  }, async (req, reply) => {
    await notifications.registerDevice(actorOf(req), req.body.token, req.body.platform);
    return reply.code(204).send();
  });

  app.delete('/v1/push-devices', {
    ...auth,
    schema: { tags, body: z.object({ token: ExpoToken }) },
  }, async (req, reply) => {
    await notifications.unregisterDevice(actorOf(req), req.body.token);
    return reply.code(204).send();
  });
}
