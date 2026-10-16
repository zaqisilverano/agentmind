import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import { getEnv } from '@/lib/env';
import * as schema from './schema';

/** Any Drizzle Postgres database over our schema (postgres-js in the app, pglite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let singleton: Db | undefined;
let testDb: Db | undefined;

export function getDb(): Db {
  if (testDb) return testDb;
  return (singleton ??= drizzle(postgres(getEnv().DATABASE_URL), { schema }));
}

/** Route tests call this (via the harness) so routes use the in-memory database. */
export function setTestDb(db: Db | undefined): void {
  testDb = db;
}
