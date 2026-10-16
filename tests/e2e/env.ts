/**
 * Environment for the e2e Next server and the migration run: the compose.dev Postgres, a throwaway cookie secret,
 * no LLM key (every LLM route answers from the offline fallback) and an unroutable base URL as a second guard.
 */
export const E2E_ENV: Record<string, string> = {
  DATABASE_URL: 'postgres://atlas:atlas@localhost:5432/atlas',
  COOKIE_SECRET: 'e2e-only-cookie-secret-0123456789abcdef',
  LLM_API_KEY: '',
  LLM_BASE_URL: 'http://127.0.0.1:9',
  LLM_MODEL: 'test',
  LLM_REASONING_EFFORT: '',
  RATE_LIMIT_PER_HOUR: '1000',
  NODE_ENV: 'development',
};

export const E2E_PORT = 3100;
