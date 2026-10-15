import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  hasZodFastifySchemaValidationErrors, jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Db } from './shared/db/client.js';
import { EventBus } from './shared/events/bus.js';
import { AppError } from './shared/errors.js';
import { authPlugin } from './shared/auth/plugin.js';
import type { TokenVerifier } from './shared/auth/token.js';
import type { App } from './shared/http.js';
import { clubsRoutes, createClubsService } from './modules/clubs/index.js';
import { createIdentityService, identityRoutes } from './modules/identity/index.js';
import { createMembershipsService, membershipsRoutes } from './modules/memberships/index.js';
import { attendanceRoutes, createAttendanceService } from './modules/attendance/index.js';
import { classesRoutes, createClassesService } from './modules/classes/index.js';
import { coachingRoutes, createCoachingService } from './modules/coaching/index.js';
import { communityRoutes, createCommunityService } from './modules/community/index.js';
import { createJournalService, journalRoutes } from './modules/journal/index.js';
import { createHabitsService, habitsRoutes } from './modules/habits/index.js';
import { analyticsRoutes, createAnalyticsService } from './modules/analytics/index.js';
import { createShopService, shopRoutes } from './modules/shop/index.js';
import { createNotificationsService, notificationsRoutes, type PushSender } from './modules/notifications/index.js';
import { uploadsRoutes, type StorageSigner } from './modules/uploads/index.js';

export interface AppDeps {
  db: Db;
  verify: TokenVerifier;
  push: PushSender;
  storage: StorageSigner;
  setupToken?: string;
  corsOrigins: string[];
  logger?: FastifyServerOptions['logger'];
}

/**
 * Composition root: the only place that knows every module. Modules receive
 * each other's public services here; nothing else crosses module lines.
 */
export async function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: deps.logger ?? false, trustProxy: true }).withTypeProvider<ZodTypeProvider>() as unknown as App;
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const bus = new EventBus(app.log);
  const { db } = deps;

  // ── modules, wired in dependency order ──
  const clubs = createClubsService(db, bus);
  const identity = createIdentityService(db, clubs, { setupToken: deps.setupToken });
  // memberships ⇄ attendance reference each other through late-bound functions, not imports.
  const memberships = createMembershipsService(db, bus, { clubs, identity, lastVisits: gymId => attendance.lastVisits(gymId) });
  const hasActiveMembership = (gymId: string, userId: string) => memberships.isActive(gymId, userId);
  const attendance = createAttendanceService(db, bus, { clubs, identity, hasActiveMembership });
  const classes = createClassesService(db, bus, { clubs, identity, hasActiveMembership });
  const coaching = createCoachingService(db, bus, { clubs, identity });
  const community = createCommunityService(db, bus, { identity });
  const journal = createJournalService(db, { clubs });
  const habits = createHabitsService(db, bus, { clubs });
  const analytics = createAnalyticsService({ identity, memberships, attendance, clubs });
  const shop = createShopService(db, bus, { identity });
  const notifications = createNotificationsService(db, bus, { identity, push: deps.push });

  // ── HTTP plumbing ──
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: deps.corsOrigins.length ? deps.corsOrigins : false, credentials: false });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Gym App API', version: '1.0.0', description: 'Members, coaches and club admins. Authenticate with a Supabase access token.' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      security: [{ bearer: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await app.register(authPlugin, { verify: deps.verify, loadActor: identity.loadActor });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send({ error: { code: err.code, message: err.message } });
    }
    if (hasZodFastifySchemaValidationErrors(err)) {
      const issues = err.validation.map(v => ({ path: v.instancePath || '/', message: v.message }));
      return reply.code(400).send({ error: { code: 'invalid_input', message: 'Some fields are missing or invalid.', issues } });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status < 500) {
      return reply.code(status).send({ error: { code: (err as { code?: string }).code ?? 'bad_request', message: (err as Error).message } });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'internal', message: 'Something went wrong on our side. Try again.' } });
  });

  app.get('/health', { schema: { hide: true } }, async () => ({ ok: true }));

  identityRoutes(app, identity);
  clubsRoutes(app, clubs);
  membershipsRoutes(app, memberships);
  attendanceRoutes(app, attendance);
  classesRoutes(app, classes);
  coachingRoutes(app, coaching);
  communityRoutes(app, community);
  journalRoutes(app, journal);
  habitsRoutes(app, habits);
  analyticsRoutes(app, analytics);
  shopRoutes(app, shop);
  notificationsRoutes(app, notifications);
  uploadsRoutes(app, deps.storage);

  return { app, bus, services: { clubs, identity, memberships, attendance, classes, coaching, community, journal, shop, notifications, habits, analytics } };
}
