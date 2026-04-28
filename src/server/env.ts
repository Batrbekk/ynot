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
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.email().optional(),
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
