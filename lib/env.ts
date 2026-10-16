import { z } from 'zod';

const EXAMPLE_COOKIE_SECRET = 'change-me-change-me-change-me-change-me';

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    COOKIE_SECRET: z.string().min(32),
    LLM_BASE_URL: z.string().url().default('https://api.ifm.ai/v1'),
    LLM_MODEL: z.string().min(1).default('IFM/K2-Horizon-375B-A23B'),
    LLM_API_KEY: z.string().default(''),
    LLM_REASONING_EFFORT: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['low', 'medium', 'high']).optional()),
    RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(60),
    NODE_ENV: z.string().default('development'),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === 'production' && e.COOKIE_SECRET === EXAMPLE_COOKIE_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['COOKIE_SECRET'], message: 'must not be the example value from .env.example in production' });
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(raw: NodeJS.ProcessEnv): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(env)'}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

let cached: Env | undefined;
export function getEnv(): Env {
  return (cached ??= loadEnv(process.env));
}
