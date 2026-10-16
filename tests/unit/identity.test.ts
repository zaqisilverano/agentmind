import { describe, it, expect } from 'vitest';
import { sign, verify, cookieHeader } from '@/lib/identity';

const S = 's'.repeat(32);
process.env.COOKIE_SECRET = S;
process.env.DATABASE_URL = 'postgres://unused';
const ID = '123e4567-e89b-12d3-a456-426614174000';

describe('identity cookie', () => {
  it('round-trips', () => {
    expect(verify(sign(ID, S), S)).toBe(ID);
  });

  it('rejects tamper and wrong secret', () => {
    const v = sign(ID, S);
    expect(verify(v.slice(0, -1) + '0', S)).toBeNull();
    expect(verify(v, 't'.repeat(32))).toBeNull();
    expect(verify('garbage', S)).toBeNull();
  });

  it('rejects a signed value whose id is not a uuid', () => {
    expect(verify(sign('not-a-uuid', S), S)).toBeNull();
  });

  it('builds the cookie header, adding Secure only when asked', () => {
    const plain = cookieHeader(ID, { secure: false });
    expect(plain).toMatch(/^ab_uid=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=31536000$/);
    expect(cookieHeader(ID, { secure: true })).toBe(`${plain}; Secure`);
  });
});
