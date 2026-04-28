import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import {
  consumeVerificationToken,
  generateCode,
  issueVerificationToken,
  verificationIdentifier,
} from "../codes";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

describe("generateCode", () => {
  it("returns six ASCII digits", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("verificationIdentifier", () => {
  it("namespaces verify and reset", () => {
    expect(verificationIdentifier("verify", "u@x.com")).toBe("verify:u@x.com");
    expect(verificationIdentifier("reset", "u@x.com")).toBe("reset:u@x.com");
  });
});

describe("issue + consume verification token", () => {
  beforeEach(() => resetDb());

  it("issues a token and consumes it once", async () => {
    const code = await issueVerificationToken("verify", "u@x.com");
    expect(code).toMatch(/^\d{6}$/);
    const ok = await consumeVerificationToken("verify", "u@x.com", code);
    expect(ok).toBe(true);
    const second = await consumeVerificationToken("verify", "u@x.com", code);
    expect(second).toBe(false);
  });

  it("rejects a wrong code", async () => {
    await issueVerificationToken("verify", "u@x.com");
    expect(await consumeVerificationToken("verify", "u@x.com", "000000")).toBe(false);
  });

  it("rejects an expired token", async () => {
    const code = await issueVerificationToken("verify", "u@x.com");
    await prisma.verificationToken.updateMany({
      where: { identifier: "verify:u@x.com" },
      data: { expires: new Date(Date.now() - 1000) },
    });
    expect(await consumeVerificationToken("verify", "u@x.com", code)).toBe(false);
  });

  it("issues replace previous unexpired tokens for the same identifier", async () => {
    const first = await issueVerificationToken("verify", "u@x.com");
    const second = await issueVerificationToken("verify", "u@x.com");
    expect(await consumeVerificationToken("verify", "u@x.com", first)).toBe(false);
    expect(await consumeVerificationToken("verify", "u@x.com", second)).toBe(true);
  });
});
