export type SecurityEnv = 'production' | 'development';

export interface HeaderEntry {
  key: string;
  value: string;
}

/**
 * Security headers applied to every route by next.config.ts.
 *
 * Production CSP is strict: scripts only from 'self'. Styles allow 'unsafe-inline' because
 * the engine and React set inline style attributes. Fonts are self-hosted at build time by
 * next/font/google, and Three.js ships in the bundle, so nothing external is needed.
 *
 * Next's App Router emits inline <script> tags (the RSC payload and bootstrap), which a plain
 * script-src 'self' blocks, so the page never hydrates. Pages therefore get a per-request nonce
 * from proxy.ts (csp(env, nonce)), and Next stamps the nonce on its own scripts.
 * securityHeaders(env) with no nonce is the strict static policy, used for API routes (JSON,
 * no scripts) via next.config.ts.
 *
 * When the optional Umami analytics is configured (lib/analyticsConfig.ts), the page policy also allows `connect-src` to the
 * tracker's origin, where it posts events (`<origin>/api/send`). The tracker script itself needs no script-src entry:
 * the layout stamps it with the request nonce, and 'strict-dynamic' trusts nonced scripts.
 *
 * Development relaxes the policy: Next dev/HMR needs 'unsafe-eval' and inline scripts,
 * and a websocket connection for hot reload. Never ship the development policy.
 */
export function csp(env: SecurityEnv, nonce?: string, analyticsOrigin?: string): string {
  const dev = env === 'development';
  const connect = ["'self'", ...(dev ? ['ws:', 'wss:'] : []), ...(analyticsOrigin ? [analyticsOrigin] : [])].join(' ');
  const script = ["'self'", ...(dev ? ["'unsafe-eval'"] : []), ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : dev ? ["'unsafe-inline'"] : [])].join(' ');
  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function securityHeaders(env: SecurityEnv): HeaderEntry[] {
  return [
    { key: 'Content-Security-Policy', value: csp(env) },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
}
