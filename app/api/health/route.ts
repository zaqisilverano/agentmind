import { sql } from 'drizzle-orm';
import { getDb } from '@/db/client';

/** Liveness plus database reachability. 503 when Postgres is unreachable, so the Docker HEALTHCHECK fails. */
export async function GET(): Promise<Response> {
  let db = false;
  try {
    await getDb().execute(sql`select 1`);
    db = true;
  } catch {
    db = false;
  }
  return Response.json({ ok: true, db }, { status: db ? 200 : 503 });
}
