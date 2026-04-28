import { describe, expect, it } from "vitest";
import { redis } from "../redis";

describe("redis singleton", () => {
  it("responds to PING", async () => {
    const reply = await redis.ping();
    expect(reply).toBe("PONG");
  });

  it("can SET and GET a key", async () => {
    await redis.set("test:hello", "world", "EX", 10);
    const value = await redis.get("test:hello");
    expect(value).toBe("world");
  });
});
