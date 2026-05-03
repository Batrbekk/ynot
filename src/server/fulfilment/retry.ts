/**
 * Exponential-ish backoff schedule for label-creation retries (spec §12).
 *
 * Index 0 → 1 minute after the first failure, then 5m, 15m, 1h, 6h. After the
 * fifth failure {@link shouldGiveUp} returns true and the worker stops
 * retrying — the operator gets a `sendLabelFailureAlert` email instead.
 */
const SCHEDULE_MS: ReadonlyArray<number> = [
  60_000, // 1m
  300_000, // 5m
  900_000, // 15m
  3_600_000, // 1h
  21_600_000, // 6h
];

/**
 * Delay until the next retry, given the current `attemptCount` (1-based: pass
 * `1` after the first failure to get the post-attempt-1 delay).
 *
 * Returns `null` for attempts outside the schedule — callers treat that as
 * "give up". Mirrors {@link shouldGiveUp} but exposes the actual delay so the
 * scheduler can `WHERE updatedAt < now() - delay`.
 */
export function nextRetryDelayMs(attemptCount: number): number | null {
  if (!Number.isInteger(attemptCount)) return null;
  if (attemptCount < 1 || attemptCount > SCHEDULE_MS.length) return null;
  return SCHEDULE_MS[attemptCount - 1] ?? null;
}

/** True once `attemptCount` has reached the end of the retry schedule. */
export function shouldGiveUp(attemptCount: number): boolean {
  return attemptCount >= SCHEDULE_MS.length;
}
