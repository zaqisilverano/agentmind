import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { csp, securityHeaders } from '@/lib/securityHeaders';

const get = (env: 'production' | 'development', key: string) =>
  securityHeaders(env).find((h) => h.key === key)?.value ?? '';

describe('securityHeaders', () => {
  it('production CSP is strict', () => {
    const csp = get('production', 'Content-Security-Policy');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain('ws:');
  });

  it('nonce CSP for pages adds the nonce and no unsafe-inline or unsafe-eval', () => {
    const p = csp('production', 'abc123');
    expect(p).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(p).not.toContain('unsafe-eval');
    expect(p).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(p).toContain("frame-ancestors 'none'");
  });

  it('development CSP allows what Next dev needs', () => {
    const csp = get('development', 'Content-Security-Policy');
    expect(csp).toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('ws:');
  });

  it('sets the fixed headers in both environments', () => {
    for (const env of ['production', 'development'] as const) {
      expect(get(env, 'Referrer-Policy')).toBe('no-referrer');
      expect(get(env, 'X-Content-Type-Options')).toBe('nosniff');
      expect(get(env, 'X-Frame-Options')).toBe('DENY');
      expect(get(env, 'Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    }
  });
});

describe('proxy matcher', () => {
  it('skips API routes and Next assets by path segment, not by prefix', async () => {
    const { config } = await import('@/proxy');
    const re = new RegExp(`^${config.matcher[0].source}$`);
    for (const p of ['/', '/apiary', '/api', '/_nextish']) expect(re.test(p), p).toBe(true);
    for (const p of ['/api/me', '/api/brains/x', '/_next/static/chunk.js', '/_next/image', '/favicon.ico']) expect(re.test(p), p).toBe(false);
  });
});

describe('CSP sources', () => {
  it('every path gets exactly one CSP: the nonce policy from the proxy or the static one from next.config', async () => {
    // The matcher Next uses for next.config header sources.
    const { pathToRegexp } = createRequire(import.meta.url)('next/dist/compiled/path-to-regexp') as {
      pathToRegexp: (source: string, keys: unknown[], options: object) => RegExp;
    };
    const { config } = await import('@/proxy');
    const { default: nextConfig } = await import('@/next.config');
    const rules = await nextConfig.headers!();
    const cspSources = rules.filter((r) => r.headers.some((h) => h.key === 'Content-Security-Policy')).map((r) => r.source);
    expect(cspSources).toEqual(['/api/:path+']);
    const proxy = new RegExp(`^${config.matcher[0].source}$`);
    const api = pathToRegexp(cspSources[0], [], {});
    for (const p of ['/', '/apiary', '/api', '/dev/engine']) expect([proxy.test(p), api.test(p)], p).toEqual([true, false]);
    for (const p of ['/api/me', '/api/brains/x', '/api/llm/map', '/api/health']) expect([proxy.test(p), api.test(p)], p).toEqual([false, true]);
  });
});

// The policies as they were before the optional Umami analytics, byte for byte.
const BEFORE = {
  prodPage: "default-src 'self'; script-src 'self' 'nonce-NONCE' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  devPage: "default-src 'self'; script-src 'self' 'unsafe-eval' 'nonce-NONCE' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  api: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
const directive = (policy: string, name: string) => policy.split('; ').find((d) => d.startsWith(`${name} `));

describe('CSP with optional Umami analytics', () => {
  it('without an analytics origin the policies are unchanged', () => {
    expect(csp('production', 'NONCE')).toBe(BEFORE.prodPage);
    expect(csp('production', 'NONCE', undefined)).toBe(BEFORE.prodPage);
    expect(csp('development', 'NONCE')).toBe(BEFORE.devPage);
    expect(get('production', 'Content-Security-Policy')).toBe(BEFORE.api);
  });

  it('with an analytics origin, connect-src adds exactly that origin and nothing else changes', () => {
    const p = csp('production', 'NONCE', 'https://stats.example.test');
    expect(directive(p, 'connect-src')).toBe("connect-src 'self' https://stats.example.test");
    expect(p).toBe(BEFORE.prodPage.replace("connect-src 'self'", "connect-src 'self' https://stats.example.test"));
    expect(directive(p, 'script-src')).toBe("script-src 'self' 'nonce-NONCE' 'strict-dynamic'");
    expect(directive(csp('development', 'NONCE', 'https://stats.example.test'), 'connect-src')).toBe("connect-src 'self' ws: wss: https://stats.example.test");
  });

  describe('proxy', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });
    const pagePolicy = async () => {
      vi.resetModules();
      const { proxy } = await import('@/proxy');
      const res = proxy(new NextRequest('http://localhost/'));
      const policy = res.headers.get('Content-Security-Policy')!;
      return policy.replace(/'nonce-[^']+'/, "'nonce-NONCE'");
    };

    it('leaves the page CSP as it was when Umami is not configured', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('UMAMI_SCRIPT_URL', '');
      vi.stubEnv('UMAMI_WEBSITE_ID', '');
      expect(await pagePolicy()).toBe(BEFORE.prodPage);
    });

    it('adds only the script origin to connect-src when Umami is configured', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('UMAMI_SCRIPT_URL', 'https://stats.example.test/script.js');
      vi.stubEnv('UMAMI_WEBSITE_ID', '4f8e2a6c-1b3d-4e5f-9a7b-2c4d6e8f0a1b');
      const policy = await pagePolicy();
      expect(directive(policy, 'connect-src')).toBe("connect-src 'self' https://stats.example.test");
      expect(policy).toBe(BEFORE.prodPage.replace("connect-src 'self'", "connect-src 'self' https://stats.example.test"));
      expect(directive(policy, 'script-src')).toBe("script-src 'self' 'nonce-NONCE' 'strict-dynamic'");
    });

    it.each([
      ['an invalid URL', { UMAMI_SCRIPT_URL: 'not a url', UMAMI_WEBSITE_ID: '4f8e2a6c-1b3d-4e5f-9a7b-2c4d6e8f0a1b' }],
      ['a website id that is not a UUID', { UMAMI_SCRIPT_URL: 'https://stats.example.test/script.js', UMAMI_WEBSITE_ID: 'nope' }],
      ['only one of the two set', { UMAMI_SCRIPT_URL: 'https://stats.example.test/script.js', UMAMI_WEBSITE_ID: '' }],
      ['an invalid UMAMI_DOMAINS', { UMAMI_SCRIPT_URL: 'https://stats.example.test/script.js', UMAMI_WEBSITE_ID: '4f8e2a6c-1b3d-4e5f-9a7b-2c4d6e8f0a1b', UMAMI_DOMAINS: 'bad host' }],
    ])('misconfigured (%s): the page still passes through with the CSP unchanged', async (_name, env) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubEnv('NODE_ENV', 'production');
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
      vi.resetModules();
      const { proxy } = await import('@/proxy');
      const res = proxy(new NextRequest('http://localhost/'));
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Security-Policy')!.replace(/'nonce-[^']+'/, "'nonce-NONCE'")).toBe(BEFORE.prodPage);
      vi.restoreAllMocks();
    });
  });
});
