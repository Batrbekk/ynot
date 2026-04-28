import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { prisma } from "@/server/db/client";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));
vi.mock("@/server/email", () => ({
  getEmailService: () => ({
    sendVerificationCode: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetCode: vi.fn().mockResolvedValue(undefined),
  }),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => resetDb());

  it("creates a user and issues a verification code", async () => {
    const res = await POST(jsonRequest({ email: "u@x.com", password: "longenough", name: "U" }));
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email: "u@x.com" } });
    expect(user).toBeTruthy();
    expect(user?.emailVerifiedAt).toBeNull();
    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: "verify:u@x.com" },
    });
    expect(tokens).toHaveLength(1);
  });

  it("returns 409 EMAIL_TAKEN on duplicate", async () => {
    await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    const res = await POST(jsonRequest({ email: "u@x.com", password: "longenough" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("EMAIL_TAKEN");
  });

  it("returns 422 on invalid body", async () => {
    const res = await POST(jsonRequest({ email: "not-an-email", password: "x" }));
    expect(res.status).toBe(422);
  });
});
