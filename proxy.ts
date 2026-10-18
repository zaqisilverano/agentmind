import { NextResponse, type NextRequest } from 'next/server';
import { getAnalytics } from '@/lib/analyticsConfig';
import { csp } from '@/lib/securityHeaders';

/**
 * Per-request CSP nonce for page routes (the Next 16 proxy, formerly middleware). Next reads the nonce from the
 * request's Content-Security-Policy header and applies it to the inline scripts it emits.
 * API routes and static assets are excluded by the matcher; API routes get the static
 * strict CSP from next.config.ts. With Umami configured, the page CSP also lets the tracker post to its origin.
 */
export function proxy(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const policy = csp(env, nonce, getAnalytics()?.origin);
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', policy);
  return res;
}

export const config = {
  matcher: [{ source: '/((?!api/|_next/static/|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }],
};
