import { env as defaultEnv, type Env } from '@/server/env';
import { getLabelStorage } from '@/server/fulfilment/storage-factory';
import { RoyalMailClickDropProvider } from '@/server/shipping/royal-mail-click-drop';
import type { CreateReturnDeps } from './service';

/**
 * Production deps factory for the returns flow. Wires the Royal Mail Click &
 * Drop provider + the configured LabelStorage backend.
 *
 * Mirrors `src/server/fulfilment/storage-factory.ts` — tests inject explicit
 * fakes instead of calling this; route handlers and admin endpoints call
 * `buildReturnsDeps()` once per request.
 *
 * Throws if `ROYAL_MAIL_API_KEY` is not configured (returns can't be issued
 * without it).
 */
export function buildReturnsDeps(env: Env = defaultEnv): CreateReturnDeps {
  if (!env.ROYAL_MAIL_API_KEY) {
    throw new Error(
      'ROYAL_MAIL_API_KEY is required to issue UK return labels — set it in env or inject deps in tests.',
    );
  }
  const rm = new RoyalMailClickDropProvider({ apiKey: env.ROYAL_MAIL_API_KEY });
  const storage = getLabelStorage(env);
  return { rm, storage };
}
