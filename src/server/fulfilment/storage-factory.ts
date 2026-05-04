import { LocalFsStorage } from './local-fs-storage';
import type { LabelStorage } from './label-storage';

export interface LabelStorageEnv {
  LABEL_STORAGE: string;
  LABEL_STORAGE_PATH: string;
}

/**
 * Construct a fresh {@link LabelStorage} from the supplied env. Pure factory —
 * no caching. Use {@link getLabelStorage} for the request-cached singleton.
 *
 * Spec §11: Phase 5 ships only the `local` backend; `s3` and `r2` are wire-up
 * stubs left for Phase 6 once the AWS / Cloudflare creds story is settled.
 */
export function createLabelStorage(env: LabelStorageEnv): LabelStorage {
  if (env.LABEL_STORAGE === 'local') return new LocalFsStorage(env.LABEL_STORAGE_PATH);
  throw new Error(
    `LabelStorage backend "${env.LABEL_STORAGE}" not implemented in Phase 5 — see spec §11`,
  );
}

let cached: LabelStorage | null = null;

/**
 * Cached accessor for the process-wide {@link LabelStorage} singleton.
 *
 * Subsequent calls ignore the env argument; restart the process (or call
 * {@link __resetLabelStorageCache} in tests) to swap backends.
 */
export function getLabelStorage(env: LabelStorageEnv): LabelStorage {
  if (!cached) cached = createLabelStorage(env);
  return cached;
}

/** Test-only: clear the singleton. Not for production code. */
export function __resetLabelStorageCache(): void {
  cached = null;
}
