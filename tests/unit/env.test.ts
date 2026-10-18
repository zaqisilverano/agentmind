import { describe, it, expect } from 'vitest';
import { loadEnv as load } from '@/lib/env';

const base = { DATABASE_URL: 'postgres://x', COOKIE_SECRET: 'a'.repeat(32), LLM_BASE_URL: 'https://api.ifm.ai/v1', LLM_MODEL: 'm' };

// NODE_ENV is typed as required on ProcessEnv by Next's types; tests omit it on purpose.
const loadEnv = (raw: Record<string, string>) => load(raw as NodeJS.ProcessEnv);

describe('env', () => {
  it('defaults', () => {
    const e = loadEnv({ ...base, NODE_ENV: 'test' });
    expect(e.RATE_LIMIT_PER_HOUR).toBe(60);
    expect(e.LLM_API_KEY).toBe('');
    expect(e.LLM_REASONING_EFFORT).toBeUndefined();
  });
  it('applies LLM defaults and treats empty reasoning effort as unset', () => {
    const e = loadEnv({ DATABASE_URL: 'postgres://x', COOKIE_SECRET: 'a'.repeat(32), LLM_REASONING_EFFORT: '' });
    expect(e.LLM_BASE_URL).toBe('https://api.ifm.ai/v1');
    expect(e.LLM_MODEL).toBe('IFM/K2-Horizon-375B-A23B');
    expect(e.LLM_REASONING_EFFORT).toBeUndefined();
    expect(e.NODE_ENV).toBe('development');
  });
  it('accepts a valid reasoning effort and coerces the rate limit', () => {
    const e = loadEnv({ ...base, LLM_REASONING_EFFORT: 'high', RATE_LIMIT_PER_HOUR: '5' });
    expect(e.LLM_REASONING_EFFORT).toBe('high');
    expect(e.RATE_LIMIT_PER_HOUR).toBe(5);
  });
  it('rejects a missing database url', () => expect(() => loadEnv({ ...base, DATABASE_URL: '' })).toThrow(/DATABASE_URL/));
  it('rejects short secret', () => expect(() => loadEnv({ ...base, COOKIE_SECRET: 'short' })).toThrow(/COOKIE_SECRET/));
  it('rejects a bad rate limit', () => expect(() => loadEnv({ ...base, RATE_LIMIT_PER_HOUR: '0' })).toThrow(/RATE_LIMIT_PER_HOUR/));
  it('rejects the example secret in production', () =>
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', COOKIE_SECRET: 'change-me-change-me-change-me-change-me' })).toThrow(/example/));
  it('allows the example secret outside production', () =>
    expect(loadEnv({ ...base, NODE_ENV: 'development', COOKIE_SECRET: 'change-me-change-me-change-me-change-me' }).COOKIE_SECRET).toHaveLength(39));
  it('ignores the UMAMI_* settings: invalid analytics never breaks the app env', () =>
    expect(loadEnv({ ...base, NODE_ENV: 'production', COOKIE_SECRET: 'b'.repeat(32), UMAMI_SCRIPT_URL: 'not a url', UMAMI_WEBSITE_ID: 'nope', UMAMI_DOMAINS: '!!' }).DATABASE_URL).toBe('postgres://x'));
});
