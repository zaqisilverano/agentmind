import { execFileSync } from 'node:child_process';
import { E2E_ENV } from './env';

/**
 * Applies the Drizzle migrations to the dev Postgres so a fresh volume works. No truncation: every browser context is
 * a new anonymous user with its own brains, so the suite does not depend on a clean database.
 */
export default function globalSetup(): void {
  execFileSync('pnpm', ['exec', 'tsx', 'db/migrate.ts'], { env: { ...process.env, ...E2E_ENV }, stdio: 'inherit' });
}
