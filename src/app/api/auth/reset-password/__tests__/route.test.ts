import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as forgotPOST } from "../../forgot-password/route";
import { POST as resetPOST } from "../route";
import { prisma } from "@/server/db/client";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { issueVerificationToken } from "@/server/auth/codes";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));
vi.mock("@/server/email", () => ({
  getEmailService: () => ({
    send: vi.fn().mockResolvedValue({ id: "msg_test" }),
  }),
}));

function reqForgot(body: unknown): Request {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}
function reqReset(body: unknown): Request {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => resetDb());

  it("returns 200 + issues a code for a known email", async () => {
    await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", emailVerifiedAt: new Date() },
    });
    const res = await forgotPOST(reqForgot({ email: "u@x.com" }));
    expect(res.status).toBe(200);
    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: "reset:u@x.com" },
    });
    expect(tokens).toHaveLength(1);
  });

  it("returns 200 even for an unknown email (anti-enumeration)", async () => {
    const res = await forgotPOST(reqForgot({ email: "ghost@x.com" }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => resetDb());

  it("updates the password on a correct code and clears all sessions", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: await hashPassword("oldpassword"), emailVerifiedAt: new Date() },
    });
    await prisma.session.create({
      data: { userId: u.id, sessionToken: "tok-a", expires: new Date(Date.now() + 1_000_000) },
    });
    const code = await issueVerificationToken("reset", "u@x.com");
    const res = await resetPOST(reqReset({ email: "u@x.com", code, newPassword: "newpassword123" }));
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(await verifyPassword("newpassword123", after!.passwordHash!)).toBe(true);
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions).toHaveLength(0);
  });

  it("returns 401 INVALID_CODE on wrong code", async () => {
    await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", emailVerifiedAt: new Date() },
    });
    const res = await resetPOST(reqReset({ email: "u@x.com", code: "000000", newPassword: "newpassword123" }));
    expect(res.status).toBe(401);
  });
});
