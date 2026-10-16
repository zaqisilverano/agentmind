import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../lib/env';

const LOCK_ID = 727272;

async function main() {
  const sql = postgres(loadEnv(process.env).DATABASE_URL, { max: 1 });
  try {
    await sql`SELECT pg_advisory_lock(${LOCK_ID})`;
    try {
      await migrate(drizzle(sql), { migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)) });
    } finally {
      await sql`SELECT pg_advisory_unlock(${LOCK_ID})`;
    }
  } finally {
    await sql.end();
  }
}

main().then(
  () => console.log('migrations applied'),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
