import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as verifyPOST } from "../route";
import { POST as resendPOST } from "../resend/route";
import { prisma } from "@/server/db/client";
import { issueVerificationToken } from "@/server/auth/codes";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));
vi.mock("@/server/email", () => ({
  getEmailService: () => ({
    sendVerificationCode: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetCode: vi.fn().mockResolvedValue(undefined),
  }),
}));

function reqVerify(body: unknown): Request {
  return new Request("http://localhost/api/auth/verify-email", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}
function reqResend(body: unknown): Request {
  return new Request("http://localhost/api/auth/verify-email/resend", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => resetDb());

  it("marks the user verified on a correct code", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h" },
    });
    const code = await issueVerificationToken("verify", "u@x.com");
    const res = await verifyPOST(reqVerify({ email: "u@x.com", code }));
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("returns 401 INVALID_CODE for a wrong code", async () => {
    await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    await issueVerificationToken("verify", "u@x.com");
    const res = await verifyPOST(reqVerify({ email: "u@x.com", code: "000000" }));
    expect(res.status).toBe(401);
  });

  it("returns 422 on missing fields", async () => {
    const res = await verifyPOST(reqVerify({ email: "x" }));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/auth/verify-email/resend", () => {
  beforeEach(() => resetDb());

  it("issues a fresh code for an unverified user", async () => {
    await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    const res = await resendPOST(reqResend({ email: "u@x.com" }));
    expect(res.status).toBe(200);
    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: "verify:u@x.com" },
    });
    expect(tokens).toHaveLength(1);
  });

  it("returns 404 when there is no pending verification (user already verified or absent)", async () => {
    await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", emailVerifiedAt: new Date() },
    });
    const res = await resendPOST(reqResend({ email: "u@x.com" }));
    expect(res.status).toBe(404);
  });
});
