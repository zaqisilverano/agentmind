// @vitest-environment jsdom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_QUERY, useIsMobile } from '@/lib/useIsMobile';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A matchMedia stand-in whose `matches` the test flips, firing `change` like a resize across the breakpoint would. */
function mockMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initial,
    media: MOBILE_QUERY,
    addEventListener: vi.fn((_: string, cb: () => void) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: () => void) => listeners.delete(cb)),
  };
  const matchMedia = vi.fn(() => mql);
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    matchMedia,
    listeners,
    set(matches: boolean) {
      mql.matches = matches;
      for (const cb of [...listeners]) cb();
    },
  };
}

let seen: boolean[] = [];
function Probe() {
  const mobile = useIsMobile();
  seen.push(mobile);
  return createElement('span', null, mobile ? 'mobile' : 'desktop');
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  seen = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('useIsMobile', () => {
  it('asks for the < 768 px query', () => {
    const mm = mockMatchMedia(false);
    act(() => root.render(createElement(Probe)));
    expect(mm.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('reports the current match on mount', () => {
    mockMatchMedia(true);
    act(() => root.render(createElement(Probe)));
    expect(container.textContent).toBe('mobile');
  });

  it('updates when the viewport crosses the breakpoint, both ways', () => {
    const mm = mockMatchMedia(false);
    act(() => root.render(createElement(Probe)));
    expect(container.textContent).toBe('desktop');
    act(() => mm.set(true));
    expect(container.textContent).toBe('mobile');
    act(() => mm.set(false));
    expect(container.textContent).toBe('desktop');
  });

  it('stops listening on unmount', () => {
    const mm = mockMatchMedia(false);
    act(() => root.render(createElement(Probe)));
    expect(mm.listeners.size).toBe(1);
    act(() => root.render(createElement('span')));
    expect(mm.listeners.size).toBe(0);
  });

  it('renders false on the server, whatever the client would match', () => {
    mockMatchMedia(true);
    expect(renderToString(createElement(Probe))).toBe('<span>desktop</span>');
  });
});
