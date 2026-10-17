'use client';

import { useSyncExternalStore } from 'react';

/** Phones: below the 768 px tablet width. */
export const MOBILE_QUERY = '(max-width: 767px)';

const query = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(MOBILE_QUERY) : null;

function subscribe(onChange: () => void): () => void {
  const mql = query();
  if (!mql) return () => {};
  // `change` fires when a resize or rotation crosses the breakpoint. Older Safari only has addListener.
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}

const getSnapshot = (): boolean => query()?.matches ?? false;
const getServerSnapshot = (): boolean => false;

/**
 * True while the viewport is narrower than 768 px. False on the server and during hydration, so the server HTML and
 * the first client render agree; React re-renders with the real value right after.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noop = () => () => {};

/** False on the server and during hydration, true from the first client render after it. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
