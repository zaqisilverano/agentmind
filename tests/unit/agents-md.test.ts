import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// AGENTS.md (read by Codex, Cursor and other agents) must carry exactly the same rules as CLAUDE.md.
describe('agent instructions', () => {
  it('AGENTS.md matches CLAUDE.md', () => {
    expect(readFileSync('AGENTS.md', 'utf8')).toBe(readFileSync('CLAUDE.md', 'utf8'));
  });
});
