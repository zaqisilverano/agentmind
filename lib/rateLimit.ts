import { getEnv } from '@/lib/env';

const WINDOW_MS = 3_600_000;
const SWEEP_EVERY = 1000;
const SWEEP_ABOVE_KEYS = 10_000;

/** Fixed one-hour window per key. Expired windows are swept every 1000 takes, or on every take above 10k keys. */
export class RateLimiter {
  private windows = new Map<string, { start: number; count: number }>();
  private takes = 0;

  constructor(
    private perHour: number,
    private now: () => number = Date.now,
  ) {}

  /** Number of keys currently tracked. */
  get size(): number {
    return this.windows.size;
  }

  private sweep(t: number): void {
    for (const [key, w] of this.windows) if (t - w.start >= WINDOW_MS) this.windows.delete(key);
  }

  take(key: string): { ok: boolean; retryAfter: number } {
    const t = this.now();
    this.takes = (this.takes + 1) % SWEEP_EVERY;
    if (this.takes === 0 || this.windows.size > SWEEP_ABOVE_KEYS) this.sweep(t);
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

let ipLimiter: RateLimiter | undefined;
/** Separate limiter keyed by client IP, so dropping the cookie does not mint a fresh budget. */
export function getIpLimiter(): RateLimiter {
  return (ipLimiter ??= new RateLimiter(getEnv().RATE_LIMIT_PER_HOUR));
}

let identityLimiter: RateLimiter | undefined;
/** New anonymous users per client IP per hour: half the LLM budget, at least 10. */
export function getIdentityLimiter(): RateLimiter {
  return (identityLimiter ??= new RateLimiter(Math.max(10, Math.floor(getEnv().RATE_LIMIT_PER_HOUR / 2))));
}
