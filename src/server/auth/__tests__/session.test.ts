import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../nextauth", () => ({
  auth: vi.fn(),
}));

import { auth } from "../nextauth";
import { prisma } from "@/server/db/client";
import { getSessionUser, requireSessionUser } from "../session";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

describe("session helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getSessionUser returns null when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    expect(await getSessionUser()).toBeNull();
  });

  it("getSessionUser returns the matching DB row", async () => {
    await resetDb();
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", name: "U" },
    });
    vi.mocked(auth).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name },
    } as never);
    const result = await getSessionUser();
    expect(result?.id).toBe(u.id);
    expect(result?.email).toBe("u@x.com");
  });

  it("getSessionUser returns null for soft-deleted users", async () => {
    await resetDb();
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", deletedAt: new Date() },
    });
    vi.mocked(auth).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name },
    } as never);
    expect(await getSessionUser()).toBeNull();
  });

  it("requireSessionUser throws when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    await expect(requireSessionUser()).rejects.toThrow(/UNAUTHENTICATED/);
  });
});
