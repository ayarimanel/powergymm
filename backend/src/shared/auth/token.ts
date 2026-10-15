import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface VerifiedToken {
  userId: string;
  email?: string;
}

/** Turns a bearer token into a user id, or throws. Swappable in tests. */
export type TokenVerifier = (token: string) => Promise<VerifiedToken>;

/**
 * Verifies Supabase Auth access tokens. New projects sign with asymmetric keys
 * published at /auth/v1/.well-known/jwks.json; older ones use a shared HS256
 * secret, supported through SUPABASE_JWT_SECRET.
 */
export function supabaseTokenVerifier(opts: { supabaseUrl: string; jwtSecret?: string }): TokenVerifier {
  const issuer = `${opts.supabaseUrl.replace(/\/$/, '')}/auth/v1`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const secret = opts.jwtSecret ? new TextEncoder().encode(opts.jwtSecret) : undefined;

  return async token => {
    const options = { issuer, audience: 'authenticated' };
    const { payload } = secret ? await jwtVerify(token, secret, options) : await jwtVerify(token, jwks, options);
    return toVerified(payload);
  };
}

function toVerified(payload: JWTPayload): VerifiedToken {
  if (!payload.sub) throw new Error('token has no subject');
  const email = typeof payload.email === 'string' ? payload.email : undefined;
  return { userId: payload.sub, email };
}
