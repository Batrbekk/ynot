import { beforeEach, describe, expect, it } from "vitest";
import { redis } from "@/server/redis";
import { checkRateLimit } from "../rate-limit";

async function clear(prefix: string) {
  const keys = await redis.keys(`${prefix}*`);
  if (keys.length) await redis.del(...keys);
}

describe("checkRateLimit", () => {
  beforeEach(() => clear("ratelimit:test:"));

  it("permits attempts up to the limit", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit({ key: "test:abc", windowMs: 60_000, max: 3 });
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(3 - i - 1);
    }
  });

  it("blocks the next attempt after the limit", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit({ key: "test:def", windowMs: 60_000, max: 3 });
    }
    const r = await checkRateLimit({ key: "test:def", windowMs: 60_000, max: 3 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates different keys", async () => {
    await checkRateLimit({ key: "test:a", windowMs: 60_000, max: 1 });
    const r = await checkRateLimit({ key: "test:b", windowMs: 60_000, max: 1 });
    expect(r.allowed).toBe(true);
  });
});
