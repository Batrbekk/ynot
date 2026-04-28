import { redis } from "@/server/redis";

export interface RateLimitInput {
  /** Composite key, e.g. `signin:ip:1.2.3.4` or `forgot:email:foo@bar.com`. */
  key: string;
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Sliding-window counter via Redis sorted sets. Each call ZADDs a unique
 * timestamp + member, then prunes entries older than `windowMs` and counts
 * the survivors. If count > max, returns allowed=false with a retry hint.
 */
export async function checkRateLimit(
  input: RateLimitInput,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - input.windowMs;
  const redisKey = `ratelimit:${input.key}`;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  const pipe = redis.multi();
  pipe.zremrangebyscore(redisKey, 0, windowStart);
  pipe.zadd(redisKey, now, member);
  pipe.zcard(redisKey);
  pipe.pexpire(redisKey, input.windowMs);
  const result = await pipe.exec();
  if (!result) {
    process.stderr.write("[ynot rate-limit] pipeline returned null\n");
    return { allowed: true, remaining: input.max, retryAfterMs: 0 };
  }
  const count = (result[2]?.[1] as number) ?? 0;

  if (count > input.max) {
    const oldest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
    const oldestScore = oldest[1] ? Number(oldest[1]) : now;
    const retryAfterMs = Math.max(1000, input.windowMs - (now - oldestScore));
    return { allowed: false, remaining: 0, retryAfterMs };
  }
  return {
    allowed: true,
    remaining: Math.max(0, input.max - count),
    retryAfterMs: 0,
  };
}
