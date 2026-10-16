import { describe, it, expect } from 'vitest';
import { RateLimiter } from '@/lib/rateLimit';

describe('RateLimiter', () => {
  it('allows N then blocks with retryAfter', () => {
    const rl = new RateLimiter(2, () => 0);
    expect(rl.take('u').ok).toBe(true);
    expect(rl.take('u').ok).toBe(true);
    const r = rl.take('u');
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBe(3600);
    expect(rl.take('v').ok).toBe(true);
  });

  it('reports whole seconds until the window resets, at least 1', () => {
    let t = 0;
    const rl = new RateLimiter(1, () => t);
    rl.take('u');
    t = 3_599_500;
    expect(rl.take('u')).toEqual({ ok: false, retryAfter: 1 });
  });

  it('starts a fresh window after an hour', () => {
    let t = 0;
    const rl = new RateLimiter(1, () => t);
    rl.take('u');
    expect(rl.take('u').ok).toBe(false);
    t = 3_600_000;
    expect(rl.take('u').ok).toBe(true);
  });

  it('sweeps expired windows every 1000 takes', () => {
    let t = 0;
    const rl = new RateLimiter(5, () => t);
    for (let i = 0; i < 10; i++) rl.take(`k${i}`);
    expect(rl.size).toBe(10);
    t = 3_600_000;
    for (let i = 0; i < 989; i++) rl.take('live');
    expect(rl.size).toBe(11); // 999 takes so far: no sweep yet
    rl.take('live');
    expect(rl.size).toBe(1);
  });

  it('sweeps on every take once more than 10k keys are tracked', () => {
    let t = 0;
    const rl = new RateLimiter(1, () => t);
    for (let i = 0; i < 10_001; i++) rl.take(`k${i}`);
    expect(rl.size).toBe(10_001);
    t = 3_600_000;
    rl.take('late');
    expect(rl.size).toBe(1);
  });
});
