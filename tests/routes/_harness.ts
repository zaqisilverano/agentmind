import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/db/schema';
import { setTestDb } from '@/db/client';

/** Fresh in-memory Postgres per call, migrated and installed as the app's db. */
export async function makeTestDb() {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'db/migrations' });
  setTestDb(db);
  return db;
}
