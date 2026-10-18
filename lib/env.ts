import { z } from 'zod';

const EXAMPLE_COOKIE_SECRET = 'change-me-change-me-change-me-change-me';

const blank = (v: unknown) => (v === '' ? undefined : v);

/**
 * Optional self-hosted Umami analytics. Both unset (the default) means no tracker script, no CSP change and no
 * network calls. Set both or neither. In production the script URL must be https.
 */
const analyticsFields = {
  UMAMI_SCRIPT_URL: z.preprocess(blank, z.url({ protocol: /^https?$/ }).optional()),
  UMAMI_WEBSITE_ID: z.preprocess(blank, z.uuid().optional()),
  NODE_ENV: z.string().default('development'),
};

type AnalyticsRaw = { UMAMI_SCRIPT_URL?: string; UMAMI_WEBSITE_ID?: string; NODE_ENV: string };

function checkAnalytics(e: AnalyticsRaw, ctx: z.RefinementCtx): void {
  if (!e.UMAMI_SCRIPT_URL !== !e.UMAMI_WEBSITE_ID) {
    ctx.addIssue({ code: 'custom', path: [e.UMAMI_SCRIPT_URL ? 'UMAMI_WEBSITE_ID' : 'UMAMI_SCRIPT_URL'], message: 'set both UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID, or neither' });
  }
  if (e.NODE_ENV === 'production' && e.UMAMI_SCRIPT_URL && !e.UMAMI_SCRIPT_URL.startsWith('https://')) {
    ctx.addIssue({ code: 'custom', path: ['UMAMI_SCRIPT_URL'], message: 'must be https in production' });
  }
}

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    COOKIE_SECRET: z.string().min(32),
    LLM_BASE_URL: z.string().url().default('https://api.ifm.ai/v1'),
    LLM_MODEL: z.string().min(1).default('IFM/K2-Horizon-375B-A23B'),
    LLM_API_KEY: z.string().default(''),
    LLM_REASONING_EFFORT: z.preprocess(blank, z.enum(['low', 'medium', 'high']).optional()),
    RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(60),
    ...analyticsFields,
  })
  .superRefine((e, ctx) => {
    checkAnalytics(e, ctx);
    if (e.NODE_ENV === 'production' && e.COOKIE_SECRET === EXAMPLE_COOKIE_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['COOKIE_SECRET'], message: 'must not be the example value from .env.example in production' });
    }
  });

export type Env = z.infer<typeof schema>;

function parseOrThrow<T>(s: z.ZodType<T>, raw: NodeJS.ProcessEnv): T {
  const parsed = s.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(env)'}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

export function loadEnv(raw: NodeJS.ProcessEnv): Env {
  return parseOrThrow(schema, raw);
}

const analyticsSchema = z
  .object({ ...analyticsFields, DOMAIN: z.string().optional() })
  .superRefine(checkAnalytics);

/** The Umami tracker settings, or null when analytics is off. */
export interface Analytics {
  scriptUrl: string;
  /** Origin of the script URL; the tracker posts events to `<origin>/api/send`. */
  origin: string;
  websiteId: string;
  /** The public host name (`DOMAIN`, when it is a plain host name), sent as `data-domains` so only that host is counted. */
  domain?: string;
}

/**
 * Only the analytics settings, validated like `loadEnv` does. The proxy and the root layout read these on every page
 * request without needing the database or LLM settings.
 */
export function loadAnalytics(raw: NodeJS.ProcessEnv): Analytics | null {
  const { UMAMI_SCRIPT_URL: scriptUrl, UMAMI_WEBSITE_ID: websiteId, DOMAIN: domain } = parseOrThrow(analyticsSchema, raw);
  if (!scriptUrl || !websiteId) return null;
  // DOMAIN belongs to Caddy and may hold more than one site address; only a plain host name narrows the tracker.
  const host = domain?.trim().toLowerCase();
  return { scriptUrl, origin: new URL(scriptUrl).origin, websiteId, ...(host && /^[a-z0-9.-]+$/.test(host) ? { domain: host } : {}) };
}

let cached: Env | undefined;
export function getEnv(): Env {
  return (cached ??= loadEnv(process.env));
}

let cachedAnalytics: Analytics | null | undefined;
export function getAnalytics(): Analytics | null {
  return cachedAnalytics === undefined ? (cachedAnalytics = loadAnalytics(process.env)) : cachedAnalytics;
}
