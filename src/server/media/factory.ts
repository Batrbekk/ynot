import { LocalFsStorage } from './local-fs-storage';
import type { MediaStorage } from './storage';

interface FactoryEnv {
  MEDIA_STORAGE: string;
  MEDIA_STORAGE_PATH: string;
}

/**
 * Construct a fresh `MediaStorage` from env config. Phase 7a only supports
 * the `local` backend; `s3`/`r2` throw with a pointer to spec §8 so callers
 * fail loudly when env is misconfigured.
 */
export function createMediaStorage(env: FactoryEnv): MediaStorage {
  if (env.MEDIA_STORAGE === 'local') return new LocalFsStorage(env.MEDIA_STORAGE_PATH);
  throw new Error(
    `MediaStorage backend "${env.MEDIA_STORAGE}" not yet implemented in Phase 7a — see spec §8`,
  );
}

let cached: MediaStorage | null = null;

/** Process-wide singleton — first call initializes from env, subsequent calls reuse. */
export function getMediaStorage(env: FactoryEnv): MediaStorage {
  if (!cached) cached = createMediaStorage(env);
  return cached;
}

/**
 * Test hatch — Vitest tests that swap `MEDIA_STORAGE_PATH` between cases
 * must call this in `beforeEach` to avoid leaking the previous tmpdir's
 * `LocalFsStorage` instance into the next test.
 */
export function _resetMediaStorageForTests(): void {
  cached = null;
}
