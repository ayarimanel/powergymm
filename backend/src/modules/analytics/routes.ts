import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import type { App } from '../../shared/http.js';
import type { AnalyticsService } from './service.js';

export function analyticsRoutes(app: App, analytics: AnalyticsService) {
  const auth = { preHandler: app.requireActor };

  // Owner only: the service throws 403 for anyone else.
  app.get('/v1/owner/analytics', { ...auth, schema: { tags: ['analytics'] } }, req =>
    analytics.overview(actorOf(req)));

  app.get(
    '/v1/owner/analytics/signups',
    { ...auth, schema: { tags: ['analytics'], querystring: z.object({ days: z.coerce.number().int().min(7).max(90).default(30) }) } },
    req => analytics.signupSeries(actorOf(req), req.query.days)
  );
}
