import { describe, expect, it } from "vitest";
import { parseEnv } from "../env";

describe("parseEnv", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    NODE_ENV: "development",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: "a-32-byte-base64-string-for-tests-12345",
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

  it("requires NEXTAUTH_SECRET", () => {
    const withoutSecret = { ...baseEnv };
    delete (withoutSecret as Record<string, unknown>).NEXTAUTH_SECRET;
    expect(() => parseEnv(withoutSecret)).toThrow();
  });

  it("rejects a too-short NEXTAUTH_SECRET", () => {
    expect(() => parseEnv({ ...baseEnv, NEXTAUTH_SECRET: "short" })).toThrow();
  });

  it("permits optional Resend credentials", () => {
    const env = parseEnv({
      ...baseEnv,
      RESEND_API_KEY: "re_xxxxxxxxxxxxxxxxxxxxxxxx",
      RESEND_FROM: "auth@ynot.london",
    });
    expect(env.RESEND_API_KEY).toBe("re_xxxxxxxxxxxxxxxxxxxxxxxx");
    expect(env.RESEND_FROM).toBe("auth@ynot.london");
  });

  it("permits optional seed credentials", () => {
    const env = parseEnv({
      ...baseEnv,
      SEED_OWNER_EMAIL: "owner@ynot.london",
      SEED_OWNER_PASSWORD: "longenough",
    });
    expect(env.SEED_OWNER_EMAIL).toBe("owner@ynot.london");
  });
});
