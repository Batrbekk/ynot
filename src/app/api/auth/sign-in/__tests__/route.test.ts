import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { prisma } from "@/server/db/client";
import { hashPassword } from "@/server/auth/password";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

const signInMock = vi.fn();
vi.mock("@/server/auth/nextauth", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));
vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));

function req(body: unknown): Request {
  return new Request("http://localhost/api/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/sign-in", () => {
  beforeEach(async () => {
    await resetDb();
    signInMock.mockReset();
  });

  it("returns 200 ok when credentials are correct and user is verified", async () => {
    await prisma.user.create({
      data: {
        email: "u@x.com",
        passwordHash: await hashPassword("longenough"),
        emailVerifiedAt: new Date(),
      },
    });
    signInMock.mockResolvedValue({ ok: true });
    const res = await POST(req({ email: "u@x.com", password: "longenough" }));
    expect(res.status).toBe(200);
    expect(signInMock).toHaveBeenCalledWith("credentials", expect.objectContaining({
      email: "u@x.com",
      password: "longenough",
      redirect: false,
    }));
  });

  it("returns 401 INVALID_CREDENTIALS when password wrong", async () => {
    await prisma.user.create({
      data: {
        email: "u@x.com",
        passwordHash: await hashPassword("longenough"),
        emailVerifiedAt: new Date(),
      },
    });
    signInMock.mockRejectedValue(new Error("CredentialsSignin"));
    const res = await POST(req({ email: "u@x.com", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 EMAIL_NOT_VERIFIED when user is unverified", async () => {
    await prisma.user.create({
      data: {
        email: "u@x.com",
        passwordHash: await hashPassword("longenough"),
      },
    });
    signInMock.mockRejectedValue(new Error("EMAIL_NOT_VERIFIED"));
    const res = await POST(req({ email: "u@x.com", password: "longenough" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("EMAIL_NOT_VERIFIED");
  });
});
