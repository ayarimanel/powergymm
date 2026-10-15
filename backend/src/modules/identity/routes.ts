import { z } from 'zod';
import { PERMISSIONS } from '../../shared/auth/actor.js';
import { actorOf, tokenOf } from '../../shared/auth/plugin.js';
import { IdParam, Muscle, type App } from '../../shared/http.js';
import type { IdentityService } from './service.js';

const Profile = z.object({
  fullName: z.string().trim().min(2).max(60),
  gender: z.enum(['male', 'female']).nullable().optional(),
  birthYear: z.number().int().min(1920).max(2020).nullable().optional(),
  goal: z.string().trim().max(80).nullable().optional(),
  trainingSlot: z.enum(['morning', 'afternoon', 'evening']).nullable().optional(),
  usualMuscles: z.array(Muscle).max(6).optional(),
  whatsapp: z.string().regex(/^[0-9]{8,15}$/, 'Digits only, with country code, e.g. 21620123456').nullable().optional(),
});

const Onboarding = Profile.extend({ gymSlug: z.string().trim().toLowerCase() });

const Setup = z.object({
  setupToken: z.string().min(16),
  gym: z.object({
    name: z.string().trim().min(2).max(80),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/, 'Lowercase letters, digits and dashes only'),
    city: z.string().trim().max(60).optional(),
  }),
  owner: Profile,
});

const ProfilePatch = Profile.partial().extend({
  avatarUrl: z.url().nullable().optional(),
  bio: z.string().trim().max(300).nullable().optional(),
});

export function identityRoutes(app: App, identity: IdentityService) {
  const actor = { preHandler: app.requireActor };
  const token = { preHandler: app.requireToken };

  app.post('/v1/setup', { ...token, schema: { tags: ['identity'], body: Setup } }, async (req, reply) => {
    const { setupToken, gym, owner } = req.body;
    return reply.code(201).send(await identity.setupGym(tokenOf(req).userId, setupToken, gym, owner));
  });

  app.post('/v1/onboarding', { ...token, schema: { tags: ['identity'], body: Onboarding } }, async (req, reply) => {
    const { gymSlug, ...profile } = req.body;
    return reply.code(201).send(await identity.onboard(tokenOf(req).userId, gymSlug, profile));
  });

  app.get('/v1/me', { ...actor, schema: { tags: ['identity'] } }, req => identity.me(actorOf(req)));

  app.patch('/v1/me', { ...actor, schema: { tags: ['identity'], body: ProfilePatch } }, req =>
    identity.updateMe(actorOf(req), req.body));

  app.get('/v1/staff', { ...actor, schema: { tags: ['identity'] } }, req => identity.listStaff(actorOf(req)));

  app.put('/v1/staff/:id/permissions', {
    ...actor,
    schema: { tags: ['identity'], params: IdParam, body: z.object({ permissions: z.array(z.enum(PERMISSIONS)) }) },
  }, req => identity.setPermissions(actorOf(req), req.params.id, req.body.permissions));

  app.put('/v1/staff/:id/role', {
    ...actor,
    schema: { tags: ['identity'], params: IdParam, body: z.object({ role: z.enum(['member', 'owner']) }) },
  }, req => identity.setRoleByAdmin(actorOf(req), req.params.id, req.body.role));
}
