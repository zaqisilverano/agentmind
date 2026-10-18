/**
 * Privacy-safe usage events for the optional Umami tracker (see app/layout.tsx). Each event carries only counts and
 * fixed labels: never idea text, node names, notes, the user id or anything else a user typed.
 */
/** Each event and the only payload it may carry. */
export type AnalyticsEvents = {
  /** A new brain was mapped. */
  map: { source: 'model' | 'fallback'; nodes: number };
  /** A full agent run started. */
  run: { rounds: number };
  /** A scoped run started from a node; `focus` says whether a focus note was given, never what it said. */
  expand: { rounds: number; focus: 'yes' | 'no' };
  /** An export was downloaded. */
  download: { format: 'markdown' | 'json' | 'html3d' };
};
export type AnalyticsEvent = keyof AnalyticsEvents;

type Umami = { track: (event: string, data?: Record<string, string | number>) => unknown };

declare global {
  interface Window {
    umami?: Umami;
  }
}

/** Sends `event` to Umami when its script has loaded. A no-op on the server, without Umami, or if the tracker throws. */
export function track<E extends AnalyticsEvent>(event: E, data: AnalyticsEvents[E]): void {
  try {
    if (typeof window === 'undefined') return;
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the app.
  }
}
