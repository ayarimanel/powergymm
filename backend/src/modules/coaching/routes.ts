import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import { IdParam, Millimes, type App } from '../../shared/http.js';
import type { CoachingService } from './service.js';

const Profile = z.object({
  headline: z.string().trim().max(80).nullable(),
  bio: z.string().trim().max(1000),
  specialties: z.array(z.string().trim().min(2).max(40)).max(8),
  yearsExperience: z.number().int().min(0).max(60),
  certifications: z.array(z.string().trim().min(2).max(80)).max(10),
  availabilityDays: z.array(z.number().int().min(1).max(7)).max(7),
  availabilityHours: z.string().trim().max(40).nullable(),
  acceptingClients: z.boolean(),
  floorCoach: z.boolean(),
  bannerUrl: z.url().nullable(),
}).partial();

const Plan = z.object({
  title: z.string().trim().min(2).max(60),
  priceMillimes: Millimes,
  billingPeriod: z.string().trim().min(2).max(40),
  features: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  popular: z.boolean().default(false),
});

const Transformation = z.object({
  clientName: z.string().trim().min(1).max(60),
  beforeUrl: z.url(),
  afterUrl: z.url(),
  duration: z.string().trim().min(1).max(40),
  result: z.string().trim().min(1).max(120),
});

export function coachingRoutes(app: App, coaching: CoachingService) {
  const auth = { preHandler: app.requireActor };

  app.get('/v1/coaches', {
    ...auth,
    schema: { tags: ['coaching'], querystring: z.object({ status: z.enum(['approved', 'pending', 'rejected']).default('approved') }) },
  }, req => coaching.list(actorOf(req), req.query.status));

  app.get('/v1/coaches/me', { ...auth, schema: { tags: ['coaching'] } }, req => coaching.getMine(actorOf(req)));

  app.post('/v1/coaches/apply', { ...auth, schema: { tags: ['coaching'], body: Profile } }, async (req, reply) =>
    reply.code(201).send(await coaching.apply(actorOf(req), req.body)));

  app.patch('/v1/coaches/me', {
    ...auth,
    schema: { tags: ['coaching'], body: Profile.extend({ plans: z.array(Plan).max(6).optional(), transformations: z.array(Transformation).max(12).optional() }) },
  }, req => coaching.updateMine(actorOf(req), req.body));

  app.put('/v1/coaches/me/live-status', {
    ...auth,
    schema: { tags: ['coaching'], body: z.object({ state: z.enum(['here', 'away']) }) },
  }, req => coaching.setLiveStatus(actorOf(req), req.body.state));

  app.post('/v1/coaches/:id/approve', { ...auth, schema: { tags: ['coaching'], params: IdParam } }, req =>
    coaching.review(actorOf(req), req.params.id, true));

  app.post('/v1/coaches/:id/reject', { ...auth, schema: { tags: ['coaching'], params: IdParam } }, req =>
    coaching.review(actorOf(req), req.params.id, false));
}
