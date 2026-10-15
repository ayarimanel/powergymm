import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema.js';

/** Any Drizzle Postgres database (postgres.js in production, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
/** A database handle or an open transaction: repositories accept either. */
export type DbOrTx = Parameters<Parameters<Db['transaction']>[0]>[0] | Db;

export function connectDb(url: string): { db: Db; close: () => Promise<void> } {
  // prepare: false keeps it compatible with Supabase's transaction pooler (port 6543).
  const sql = postgres(url, { max: 10, prepare: false, idle_timeout: 20 });
  return { db: drizzle(sql, { schema }) as unknown as Db, close: () => sql.end({ timeout: 5 }) };
}

export { schema };
