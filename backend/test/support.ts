/**
 * Test harness: real Postgres (PGlite, in-process) running the real Supabase
 * migration, the real app, and fakes only at the edges (JWT, push, storage).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { buildApp } from '../src/app.js';
import * as schema from '../src/shared/db/schema.js';
import type { Db } from '../src/shared/db/client.js';
import type { PushMessage } from '../src/modules/notifications/index.js';

/** What Supabase provides that the migration relies on. */
const SUPABASE_STUBS = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create role authenticated;
  create role anon;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean);
`;

const MIGRATIONS = join(import.meta.dirname, '..', '..', 'supabase', 'migrations');

export const SETUP_TOKEN = 'test-setup-token-0123456789';

export async function createTestApp() {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUBS);
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }
  const db = drizzle(pg, { schema }) as unknown as Db;

  const pushed: PushMessage[] = [];
  const { app, bus, services } = await buildApp({
    db,
    // Tokens in tests are just "test:<user id>".
    verify: async token => {
      if (!token.startsWith('test:')) throw new Error('bad token');
      return { userId: token.slice(5) };
    },
    push: { send: async messages => { pushed.push(...messages); return { invalidTokens: [] }; } },
    storage: {
      signUpload: async (bucket, path) => ({ signedUrl: `https://storage.test/${bucket}/${path}?sig`, token: 'tok' }),
      publicUrl: (bucket, path) => `https://storage.test/${bucket}/${path}`,
    },
    setupToken: SETUP_TOKEN,
    corsOrigins: [],
  });
  await app.ready();

  /** A new Supabase auth user (no gym profile yet). */
  const newUser = async () => {
    const id = randomUUID();
    await pg.query('insert into auth.users (id) values ($1)', [id]);
    return id;
  };

  /** Call the API as `userId` (or anonymously). Returns status and parsed JSON. */
  const call = async (userId: string | null, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: object) => {
    const res = await app.inject({
      method, url, payload,
      headers: userId ? { authorization: `Bearer test:${userId}` } : {},
    });
    return { status: res.statusCode, body: res.body ? res.json() : undefined };
  };

  return { app, bus, services, pg, pushed, newUser, call, close: async () => { await app.close(); await pg.close(); } };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
