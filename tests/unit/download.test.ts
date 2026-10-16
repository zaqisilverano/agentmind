import { describe, expect, it } from 'vitest';
import { slugify } from '@/lib/download';

describe('slugify', () => {
  it('lowercases and collapses non-alphanumerics into single dashes', () => {
    expect(slugify('Tool Library: v2 — draft!')).toBe('tool-library-v2-draft');
  });
  it('falls back to "idea" when nothing usable is left', () => {
    expect(slugify('')).toBe('idea');
    expect(slugify('★★★')).toBe('idea');
  });
});
