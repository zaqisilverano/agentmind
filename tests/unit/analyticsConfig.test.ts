import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAnalytics as parse } from '@/lib/analyticsConfig';

const parseAnalytics = (raw: Record<string, string>) => parse(raw as NodeJS.ProcessEnv);
const ID = '4f8e2a6c-1b3d-4e5f-9a7b-2c4d6e8f0a1b';
const URL_ = 'https://stats.example.test/script.js';
const ON = { UMAMI_SCRIPT_URL: URL_, UMAMI_WEBSITE_ID: ID };

describe('parseAnalytics', () => {
  it('is off, without a warning, by default and when both are empty', () => {
    expect(parseAnalytics({})).toEqual({ analytics: null });
    expect(parseAnalytics({ UMAMI_SCRIPT_URL: '', UMAMI_WEBSITE_ID: '', UMAMI_DOMAINS: '' })).toEqual({ analytics: null });
  });
  it('returns the script, its origin and the website id when both are valid', () => {
    expect(parseAnalytics(ON)).toEqual({ analytics: { scriptUrl: URL_, origin: 'https://stats.example.test', websiteId: ID } });
    expect(parseAnalytics({ ...ON, NODE_ENV: 'production' }).analytics).not.toBeNull();
  });
  it('normalises UMAMI_DOMAINS into data-domains and omits it when unset', () => {
    expect(parseAnalytics({ ...ON, UMAMI_DOMAINS: ' Agentmind.zaqi.build , www.example.com ' }).analytics?.domains).toBe('agentmind.zaqi.build,www.example.com');
    expect(parseAnalytics(ON).analytics).not.toHaveProperty('domains');
    expect(parseAnalytics({ ...ON, DOMAIN: 'agentmind.zaqi.build' }).analytics).not.toHaveProperty('domains');
  });

  // Fail soft: each misconfiguration turns analytics off with a warning, and never throws.
  it.each([
    ['only the script URL', { UMAMI_SCRIPT_URL: URL_ }, /both/],
    ['only the website id', { UMAMI_WEBSITE_ID: ID }, /both/],
    ['an invalid URL', { ...ON, UMAMI_SCRIPT_URL: 'not a url' }, /valid URL/],
    ['a javascript: URL', { ...ON, UMAMI_SCRIPT_URL: 'javascript:alert(1)' }, /http/],
    ['http in production', { ...ON, UMAMI_SCRIPT_URL: 'http://stats.example.test/script.js', NODE_ENV: 'production' }, /https in production/],
    ['a website id that is not a UUID', { ...ON, UMAMI_WEBSITE_ID: 'abc' }, /UUID/],
    ['an invalid host in UMAMI_DOMAINS', { ...ON, UMAMI_DOMAINS: 'ok.example, bad host' }, /UMAMI_DOMAINS/],
    ['UMAMI_DOMAINS alone', { UMAMI_DOMAINS: 'ok.example' }, /UMAMI_DOMAINS/],
  ])('%s: off with a warning', (_name, raw, warning) => {
    const r = parseAnalytics(raw as Record<string, string>);
    expect(r.analytics).toBeNull();
    expect(r.warning).toMatch(warning);
  });
  it('allows http outside production (a local Umami)', () =>
    expect(parseAnalytics({ ...ON, UMAMI_SCRIPT_URL: 'http://localhost:3001/script.js', NODE_ENV: 'development' }).analytics?.origin).toBe('http://localhost:3001'));
});

describe('getAnalytics', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
    delete (globalThis as Record<symbol, unknown>)[Symbol.for('agentmind.analytics.warned')];
  });
  it('logs a misconfiguration once, not per request, and stays off', async () => {
    vi.stubEnv('UMAMI_SCRIPT_URL', URL_);
    vi.stubEnv('UMAMI_WEBSITE_ID', 'not-a-uuid');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules();
    const { getAnalytics } = await import('@/lib/analyticsConfig');
    for (let i = 0; i < 5; i++) expect(getAnalytics()).toBeNull();
    // A second copy of the module (the proxy and the layout are separate bundles) does not warn again.
    vi.resetModules();
    expect((await import('@/lib/analyticsConfig')).getAnalytics()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/Umami is off: UMAMI_WEBSITE_ID is not a UUID/);
  });
});
