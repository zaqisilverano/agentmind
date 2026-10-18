import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The root layout outside Next: fonts, the request headers and the client ThemeProvider are stubbed.
vi.mock('next/font/google', () => ({
  Instrument_Serif: () => ({ variable: 'font-serif' }),
  JetBrains_Mono: () => ({ variable: 'font-mono' }),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-nonce': 'TEST-NONCE' }) }));
vi.mock('@/components/ThemeProvider', () => ({ ThemeProvider: ({ children }: { children: unknown }) => children }));
vi.mock('@/app/globals.css', () => ({}));

const ID = '4f8e2a6c-1b3d-4e5f-9a7b-2c4d6e8f0a1b';

/** Renders the layout in a fresh module graph, so the analytics settings are read from the stubbed env. */
async function render(env: Record<string, string>): Promise<string> {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.resetModules();
  const { default: RootLayout } = await import('@/app/layout');
  return renderToStaticMarkup(await RootLayout({ children: createElement('main', null, 'page') }));
}

describe('root layout: Umami script tag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('configured: one deferred script with the request nonce, website id and Do Not Track', async () => {
    const html = await render({ UMAMI_SCRIPT_URL: 'https://stats.example.test/script.js', UMAMI_WEBSITE_ID: ID, UMAMI_DOMAINS: '' });
    const tags = html.match(/<script[^>]*>/g) ?? [];
    expect(tags).toHaveLength(1);
    const tag = tags[0];
    expect(tag).toContain('src="https://stats.example.test/script.js"');
    expect(tag).toContain('nonce="TEST-NONCE"');
    expect(tag).toContain(`data-website-id="${ID}"`);
    expect(tag).toContain('data-do-not-track="true"');
    expect(tag).toMatch(/\bdefer\b/);
    expect(tag).not.toContain('data-domains');
    expect(html).toContain('<main>page</main>');
  });

  it('configured with UMAMI_DOMAINS: adds data-domains', async () => {
    const html = await render({ UMAMI_SCRIPT_URL: 'https://stats.example.test/script.js', UMAMI_WEBSITE_ID: ID, UMAMI_DOMAINS: 'agentmind.zaqi.build' });
    expect(html).toContain('data-domains="agentmind.zaqi.build"');
  });

  it.each([
    ['not configured', { UMAMI_SCRIPT_URL: '', UMAMI_WEBSITE_ID: '' }],
    ['an invalid URL', { UMAMI_SCRIPT_URL: 'not a url', UMAMI_WEBSITE_ID: ID }],
    ['a website id that is not a UUID', { UMAMI_SCRIPT_URL: 'https://stats.example.test/script.js', UMAMI_WEBSITE_ID: 'nope' }],
    ['only one of the two set', { UMAMI_SCRIPT_URL: 'https://stats.example.test/script.js', UMAMI_WEBSITE_ID: '' }],
  ])('%s: renders, with no script tag', async (_name, env) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = await render(env);
    expect(html).not.toContain('<script');
    expect(html).toContain('<main>page</main>');
  });
});
