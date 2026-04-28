import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as profileGET, PATCH as profilePATCH } from "../profile/route";
import { PATCH as passwordPATCH } from "../password/route";
import { DELETE as deleteDELETE } from "../delete/route";
import { prisma } from "@/server/db/client";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

const sessionMock = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getSessionUser: () => sessionMock(),
  requireSessionUser: async () => {
    const u = await sessionMock();
    if (!u) {
      const e = new Error("UNAUTHENTICATED") as Error & { status?: number };
      e.status = 401;
      throw e;
    }
    return u;
  },
}));
vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));

function jsonReq(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

describe("GET /api/auth/account/profile", () => {
  beforeEach(() => resetDb());

  it("returns 401 when unauthenticated", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await profileGET();
    expect(res.status).toBe(401);
  });

  it("returns the profile when signed in", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", name: "Jane", emailVerifiedAt: new Date() },
    });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: u.emailVerifiedAt });
    const res = await profileGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ email: "u@x.com", name: "Jane" });
  });
});

describe("PATCH /api/auth/account/profile", () => {
  beforeEach(() => resetDb());

  it("updates name", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await profilePATCH(jsonReq("http://localhost/api/auth/account/profile", "PATCH", { name: "New Name" }));
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.name).toBe("New Name");
  });
});

describe("PATCH /api/auth/account/password", () => {
  beforeEach(() => resetDb());

  it("changes the password and clears other sessions", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: await hashPassword("oldpassword") },
    });
    await prisma.session.create({
      data: { userId: u.id, sessionToken: "other-sess", expires: new Date(Date.now() + 1_000_000) },
    });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await passwordPATCH(
      jsonReq("http://localhost/api/auth/account/password", "PATCH", {
        currentPassword: "oldpassword",
        newPassword: "newpassword123",
      }),
    );
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(await verifyPassword("newpassword123", after!.passwordHash!)).toBe(true);
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions).toHaveLength(0);
  });

  it("returns 401 when current password wrong", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: await hashPassword("oldpassword") },
    });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await passwordPATCH(
      jsonReq("http://localhost/api/auth/account/password", "PATCH", {
        currentPassword: "wrong",
        newPassword: "newpassword123",
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/auth/account/delete", () => {
  beforeEach(() => resetDb());

  it("soft-deletes the user when confirmEmail matches", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await deleteDELETE(
      jsonReq("http://localhost/api/auth/account/delete", "DELETE", { confirmEmail: "u@x.com" }),
    );
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.deletedAt).toBeInstanceOf(Date);
  });

  it("returns 422 when confirmEmail does not match", async () => {
    const u = await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    sessionMock.mockResolvedValue({ id: u.id, email: u.email, name: u.name, role: "CUSTOMER", emailVerifiedAt: null });
    const res = await deleteDELETE(
      jsonReq("http://localhost/api/auth/account/delete", "DELETE", { confirmEmail: "wrong@x.com" }),
    );
    expect(res.status).toBe(422);
  });
});
