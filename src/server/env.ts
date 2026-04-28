import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  SEED_OWNER_EMAIL: z.string().email().optional(),
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
