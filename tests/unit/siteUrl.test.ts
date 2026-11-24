import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { siteUrl } from '@/lib/siteUrl';

describe('siteUrl', () => {
  it('DOMAIN wins, always https', () => {
    expect(siteUrl({ domain: 'agentmind.zaqi.build', host: 'other.example', forwardedProto: 'http' })?.href).toBe('https://agentmind.zaqi.build/');
  });

  it('DOMAIN is trimmed and lowercased', () => {
    expect(siteUrl({ domain: '  AgentMind.Zaqi.Build ' })?.href).toBe('https://agentmind.zaqi.build/');
  });

  it('an invalid DOMAIN falls through to the request host', () => {
    expect(siteUrl({ domain: 'https://x/y', host: 'app.example', nodeEnv: 'production' })?.href).toBe('https://app.example/');
  });

  it('x-forwarded-host beats host, first entry only', () => {
    expect(siteUrl({ host: 'internal:3000', forwardedHost: 'app.example, proxy.local', forwardedProto: 'https' })?.href).toBe('https://app.example/');
  });

  it('keeps a port and uses x-forwarded-proto', () => {
    expect(siteUrl({ host: 'localhost:3000', forwardedProto: 'http' })?.href).toBe('http://localhost:3000/');
  });

  it('without x-forwarded-proto: http in development, https in production', () => {
    expect(siteUrl({ host: 'localhost:3000', nodeEnv: 'development' })?.protocol).toBe('http:');
    expect(siteUrl({ host: 'app.example', nodeEnv: 'production' })?.protocol).toBe('https:');
  });

  it('ignores an unknown x-forwarded-proto', () => {
    expect(siteUrl({ host: 'app.example', forwardedProto: 'javascript', nodeEnv: 'production' })?.href).toBe('https://app.example/');
  });

  it.each([
    ['nothing', {}],
    ['an empty host', { host: '' }],
    ['a host with a path', { host: 'evil.example/x' }],
    ['a host with credentials', { host: 'user@evil.example' }],
    ['an IPv6 literal', { host: '[::1]:3000' }],
  ])('%s: undefined', (_name, input) => {
    expect(siteUrl(input)).toBeUndefined();
  });
});

describe('Open Graph image', () => {
  const png = readFileSync('app/opengraph-image.png');

  it('is the same file as docs/media/social-preview.png', () => {
    expect(png.equals(readFileSync('docs/media/social-preview.png'))).toBe(true);
  });

  it('is a 1280x640 PNG', () => {
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1280, 640]);
  });
});
