import { getEnv } from '@/lib/env';

const WINDOW_MS = 3_600_000;

/** Fixed one-hour window per key. */
export class RateLimiter {
  private windows = new Map<string, { start: number; count: number }>();

  constructor(
    private perHour: number,
    private now: () => number = Date.now,
  ) {}

  take(key: string): { ok: boolean; retryAfter: number } {
    const t = this.now();
    let w = this.windows.get(key);
    if (!w || t - w.start >= WINDOW_MS) {
      w = { start: t, count: 0 };
      this.windows.set(key, w);
    }
    if (w.count < this.perHour) {
      w.count += 1;
      return { ok: true, retryAfter: 0 };
    }
    return { ok: false, retryAfter: Math.max(1, Math.ceil((w.start + WINDOW_MS - t) / 1000)) };
  }
}

let limiter: RateLimiter | undefined;
export function getLlmLimiter(): RateLimiter {
  return (limiter ??= new RateLimiter(getEnv().RATE_LIMIT_PER_HOUR));
}
