import fp from 'fastify-plugin';
import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { AppError, unauthorized } from '../errors.js';
import type { Actor } from './actor.js';
import type { TokenVerifier, VerifiedToken } from './token.js';

declare module 'fastify' {
  interface FastifyRequest {
    token?: VerifiedToken;
    actor?: Actor;
  }
  interface FastifyInstance {
    /** Valid Supabase token required; no gym profile needed (sign-up flow). */
    requireToken: preHandlerAsyncHookHandler;
    /** Valid token and a completed profile required. Sets request.actor. */
    requireActor: preHandlerAsyncHookHandler;
  }
}

export type ActorLoader = (userId: string) => Promise<Actor | null>;

export const authPlugin = fp<{ verify: TokenVerifier; loadActor: ActorLoader }>(async (app, opts) => {
  app.decorateRequest('token', undefined);
  app.decorateRequest('actor', undefined);

  const readToken = async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    try {
      req.token = await opts.verify(header.slice(7));
    } catch {
      throw unauthorized('Your session expired. Sign in again.');
    }
    return req.token;
  };

  app.decorate('requireToken', async function (req: FastifyRequest) {
    await readToken(req);
  });

  app.decorate('requireActor', async function (req: FastifyRequest) {
    const token = await readToken(req);
    const actor = await opts.loadActor(token.userId);
    if (!actor) throw new AppError(403, 'onboarding_required', 'Finish creating your profile first.');
    req.actor = actor;
  });
});

/** The actor set by requireActor. Call only in routes guarded by it. */
export function actorOf(req: FastifyRequest): Actor {
  if (!req.actor) throw unauthorized();
  return req.actor;
}

export function tokenOf(req: FastifyRequest): VerifiedToken {
  if (!req.token) throw unauthorized();
  return req.token;
}
