import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
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
