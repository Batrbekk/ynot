import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  // Default to "development" so we can omit NODE_ENV from committed env
  // files (pinning it there breaks `dotenv -e .env.development -- next build`
  // by downgrading the build to a dev React bundle).
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXTAUTH_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  ORDER_TOKEN_SECRET: z.string().min(32, 'ORDER_TOKEN_SECRET must be at least 32 chars'),
  SHIPPING_PROVIDER: z.string().optional().transform((v) => (v && v.length > 0 ? v : 'mock')).pipe(z.enum(['mock', 'dhl'])),
  // Phase 5 — carrier credentials. Optional so existing dev/test envs without
  // them keep parsing; required wiring is enforced at the carrier-provider
  // boundary in Group F.
  ROYAL_MAIL_API_KEY: z.string().min(1).optional(),
  DHL_API_KEY: z.string().min(1).optional(),
  DHL_API_SECRET: z.string().min(1).optional(),
  DHL_ACCOUNT_NUMBER: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().min(1).optional(), // accepts "Display Name <email>" Resend sender format
  // Phase 5 — label storage backend.
  LABEL_STORAGE: z.enum(['local', 's3', 'r2']).default('local'),
  LABEL_STORAGE_PATH: z.string().default('/var/lib/ynot/labels'),
  // Phase 5 — worker container toggle. Coerce string env to boolean: only the
  // literal string "false" disables; any other value (including undefined →
  // default "true") enables.
  WORKER_ENABLED: z.string().default('true').transform((v) => v !== 'false'),
  // Phase 5 — operational alerts (carrier failures, refund failures, etc.).
  ALERT_EMAIL: z.email().optional(),
  SEED_OWNER_EMAIL: z.email().optional(),
  SEED_OWNER_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Parse an arbitrary record (used by tests) — throws on invalid input. */
export function parseEnv(input: Record<string, string | undefined>): Env {
  return EnvSchema.parse(input);
}

/**
 * Validated process.env. Importing this module fails fast on bad config.
 * Server-only — never import from `lib/` or any client component.
 */
export const env: Env = parseEnv(process.env);
