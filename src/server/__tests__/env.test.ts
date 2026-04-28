import { describe, expect, it } from "vitest";
import { parseEnv } from "../env";

describe("parseEnv", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    NODE_ENV: "development",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  };

  it("accepts a complete dev environment", () => {
    const env = parseEnv(baseEnv);
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toBe("postgresql://u:p@localhost:5432/db");
  });

  it("rejects an invalid DATABASE_URL", () => {
    expect(() => parseEnv({ ...baseEnv, DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => parseEnv({ ...baseEnv, NODE_ENV: "staging" })).toThrow();
  });

  it("permits optional seed credentials", () => {
    const env = parseEnv({
      ...baseEnv,
      SEED_OWNER_EMAIL: "owner@ynot.london",
      SEED_OWNER_PASSWORD: "longenough",
    });
    expect(env.SEED_OWNER_EMAIL).toBe("owner@ynot.london");
  });

  it("rejects a too-short SEED_OWNER_PASSWORD", () => {
    expect(() =>
      parseEnv({ ...baseEnv, SEED_OWNER_EMAIL: "x@y.com", SEED_OWNER_PASSWORD: "short" }),
    ).toThrow();
  });
});
