import { sql } from 'drizzle-orm';
import { getDb } from '@/db/client';

export async function GET(): Promise<Response> {
  let db = false;
  try {
    await getDb().execute(sql`select 1`);
    db = true;
  } catch {
    db = false;
  }
  return Response.json({ ok: true, db });
}
