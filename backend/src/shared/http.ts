import type { FastifyBaseLogger, FastifyInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

/** Fastify instance with Zod-typed routes. Every module registers its routes on this. */
export type App = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export const IdParam = z.object({ id: z.uuid() });
export const Day = z.iso.date();
export const Muscle = z.enum(['chest', 'back', 'shoulders', 'arms', 'legs', 'cardio']);
export const Millimes = z.number().int().min(0).max(100_000_000);
export const Paging = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.iso.datetime({ offset: true }).optional(),
});
