/**
 * Privacy-safe usage events for the optional Umami tracker (see app/layout.tsx). Each event carries only counts and
 * fixed labels: never idea text, node names, notes, the user id or anything else a user typed.
 */
export type AnalyticsEvent = 'map' | 'run' | 'expand' | 'download';

type Umami = { track: (event: string, data?: Record<string, string | number>) => unknown };

declare global {
  interface Window {
    umami?: Umami;
  }
}

/** Sends `event` to Umami when its script has loaded. A no-op on the server, without Umami, or if the tracker throws. */
export function track(event: AnalyticsEvent, data?: Record<string, string | number>): void {
  try {
    if (typeof window === 'undefined') return;
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the app.
  }
}
