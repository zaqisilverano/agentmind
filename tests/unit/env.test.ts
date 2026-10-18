import { describe, it, expect } from 'vitest';
import { loadAnalytics as loadA, loadEnv as load } from '@/lib/env';

const base = { DATABASE_URL: 'postgres://x', COOKIE_SECRET: 'a'.repeat(32), LLM_BASE_URL: 'https://api.ifm.ai/v1', LLM_MODEL: 'm' };

// NODE_ENV is typed as required on ProcessEnv by Next's types; tests omit it on purpose.
const loadEnv = (raw: Record<string, string>) => load(raw as NodeJS.ProcessEnv);
const loadAnalytics = (raw: Record<string, string>) => loadA(raw as NodeJS.ProcessEnv);

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
});

describe('analytics env', () => {
  const ID = '4f8e2a6c-1b3d-4e5f-9a7b-2c4d6e8f0a1b';
  const URL_ = 'https://stats.example.test/script.js';

  it('is off by default and when both are empty', () => {
    expect(loadAnalytics({})).toBeNull();
    expect(loadAnalytics({ UMAMI_SCRIPT_URL: '', UMAMI_WEBSITE_ID: '' })).toBeNull();
    const e = loadEnv({ ...base, UMAMI_SCRIPT_URL: '', UMAMI_WEBSITE_ID: '' });
    expect(e.UMAMI_SCRIPT_URL).toBeUndefined();
    expect(e.UMAMI_WEBSITE_ID).toBeUndefined();
  });
  it('returns the script, its origin and the website id when both are set', () => {
    expect(loadAnalytics({ UMAMI_SCRIPT_URL: URL_, UMAMI_WEBSITE_ID: ID })).toEqual({ scriptUrl: URL_, origin: 'https://stats.example.test', websiteId: ID });
  });
  it('adds DOMAIN as the tracked host only when it is a plain host name', () => {
    expect(loadAnalytics({ UMAMI_SCRIPT_URL: URL_, UMAMI_WEBSITE_ID: ID, DOMAIN: 'agentmind.zaqi.build' })?.domain).toBe('agentmind.zaqi.build');
    expect(loadAnalytics({ UMAMI_SCRIPT_URL: URL_, UMAMI_WEBSITE_ID: ID, DOMAIN: 'a.example, b.example' })?.domain).toBeUndefined();
  });
  it('requires both or neither', () => {
    expect(() => loadAnalytics({ UMAMI_SCRIPT_URL: URL_ })).toThrow(/UMAMI_WEBSITE_ID/);
    expect(() => loadAnalytics({ UMAMI_WEBSITE_ID: ID })).toThrow(/UMAMI_SCRIPT_URL/);
    expect(() => loadEnv({ ...base, UMAMI_WEBSITE_ID: ID })).toThrow(/UMAMI_SCRIPT_URL/);
  });
  it('rejects a website id that is not a UUID', () => expect(() => loadAnalytics({ UMAMI_SCRIPT_URL: URL_, UMAMI_WEBSITE_ID: 'abc' })).toThrow(/UMAMI_WEBSITE_ID/));
  it('rejects a script URL that is not http(s)', () => {
    expect(() => loadAnalytics({ UMAMI_SCRIPT_URL: 'not a url', UMAMI_WEBSITE_ID: ID })).toThrow(/UMAMI_SCRIPT_URL/);
    expect(() => loadAnalytics({ UMAMI_SCRIPT_URL: 'javascript:alert(1)', UMAMI_WEBSITE_ID: ID })).toThrow(/UMAMI_SCRIPT_URL/);
  });
  it('requires https in production, allows http outside it', () => {
    const http = { UMAMI_SCRIPT_URL: 'http://localhost:3001/script.js', UMAMI_WEBSITE_ID: ID };
    expect(() => loadAnalytics({ ...http, NODE_ENV: 'production' })).toThrow(/https/);
    expect(() => loadEnv({ ...base, ...http, NODE_ENV: 'production' })).toThrow(/https/);
    expect(loadAnalytics({ ...http, NODE_ENV: 'development' })?.origin).toBe('http://localhost:3001');
    expect(loadAnalytics({ UMAMI_SCRIPT_URL: URL_, UMAMI_WEBSITE_ID: ID, NODE_ENV: 'production' })).not.toBeNull();
  });
});
