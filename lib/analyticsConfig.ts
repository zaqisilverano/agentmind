import { z } from 'zod';

/**
 * Optional self-hosted Umami analytics, read from the environment on the server (proxy.ts for the CSP, the root
 * layout for the script tag). It fails soft: unset means off, and an invalid value turns analytics off with one
 * warning instead of breaking pages or the API. It is deliberately not part of `getEnv()`.
 *
 * - `UMAMI_SCRIPT_URL`: the tracker script on the Umami server; https in production (http is allowed in development).
 * - `UMAMI_WEBSITE_ID`: the website's UUID. Set both or neither.
 * - `UMAMI_DOMAINS`: optional comma-separated host names, sent as `data-domains` so only those hosts are counted.
 */
export interface Analytics {
  scriptUrl: string;
  /** Origin of the script URL; the tracker posts events to `<origin>/api/send`, so the page CSP allows it in connect-src. */
  origin: string;
  websiteId: string;
  /** Normalised `UMAMI_DOMAINS` ("a.example,b.example"), or undefined when unset. */
  domains?: string;
}

export interface AnalyticsResult {
  analytics: Analytics | null;
  /** Why analytics is off despite some UMAMI_* setting, for a one-time warning. */
  warning?: string;
}

const HOST = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
const uuid = z.uuid();

/** Parses the UMAMI_* settings. Never throws. */
export function parseAnalytics(raw: NodeJS.ProcessEnv): AnalyticsResult {
  const scriptUrl = raw.UMAMI_SCRIPT_URL?.trim() ?? '';
  const websiteId = raw.UMAMI_WEBSITE_ID?.trim() ?? '';
  const domainsRaw = raw.UMAMI_DOMAINS?.trim() ?? '';
  const off = (warning: string): AnalyticsResult => ({ analytics: null, warning });

  if (!scriptUrl && !websiteId) return domainsRaw ? off('UMAMI_DOMAINS is set but UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID are not') : { analytics: null };
  if (!scriptUrl || !websiteId) return off('set both UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID, or neither');

  let url: URL;
  try {
    url = new URL(scriptUrl);
  } catch {
    return off('UMAMI_SCRIPT_URL is not a valid URL');
  }
  const production = raw.NODE_ENV === 'production';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && !production)) {
    return off(production ? 'UMAMI_SCRIPT_URL must be https in production' : 'UMAMI_SCRIPT_URL must be an http(s) URL');
  }
  if (!uuid.safeParse(websiteId).success) return off('UMAMI_WEBSITE_ID is not a UUID');

  const hosts = domainsRaw ? domainsRaw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean) : [];
  const bad = hosts.find((h) => !HOST.test(h));
  if (bad !== undefined) return off(`UMAMI_DOMAINS has an invalid host name: ${JSON.stringify(bad)}`);

  return { analytics: { scriptUrl: url.href, origin: url.origin, websiteId, ...(hosts.length ? { domains: hosts.join(',') } : {}) } };
}

let cached: Analytics | null | undefined;
// The proxy and the layout are separate server bundles, each with its own copy of this module; the flag on globalThis
// keeps the warning to one per process.
const WARNED = Symbol.for('agentmind.analytics.warned');

/** The analytics settings for this process, or null when off. Parsed once; a misconfiguration is logged once. */
export function getAnalytics(): Analytics | null {
  if (cached !== undefined) return cached;
  const { analytics, warning } = parseAnalytics(process.env);
  const g = globalThis as { [WARNED]?: boolean };
  if (warning && !g[WARNED]) {
    g[WARNED] = true;
    console.warn(`[analytics] Umami is off: ${warning}`);
  }
  return (cached = analytics);
}
