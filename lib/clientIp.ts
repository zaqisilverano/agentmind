/**
 * The caller's IP for rate limiting: the first X-Forwarded-For value (Caddy overwrites the header with the real client
 * IP), then X-Real-IP. Without a proxy every caller shares the key 'unknown'.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}
