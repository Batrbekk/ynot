import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import {
  createUser,
  findUserByEmail,
  markEmailVerified,
  softDeleteUser,
  updatePassword,
} from "../../repositories/user.repo";
import { resetDb } from "../helpers/reset-db";

describe("user.repo", () => {
  beforeEach(() => resetDb());

  it("createUser inserts a row with passwordHash and emailVerifiedAt=null", async () => {
    const u = await createUser({ email: "u@x.com", passwordHash: "$2b$10$x", name: "Test" });
    expect(u.email).toBe("u@x.com");
    expect(u.emailVerifiedAt).toBeNull();
    expect(u.role).toBe("CUSTOMER");
  });

  it("createUser rejects duplicate email", async () => {
    await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    await expect(
      createUser({ email: "u@x.com", passwordHash: "$2b$10$y" }),
    ).rejects.toThrow();
  });

  it("findUserByEmail is case-insensitive in lookup", async () => {
    await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    const u = await findUserByEmail("U@X.com");
    expect(u?.email).toBe("u@x.com");
  });

  it("findUserByEmail excludes soft-deleted users", async () => {
    const u = await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    await prisma.user.update({ where: { id: u.id }, data: { deletedAt: new Date() } });
    expect(await findUserByEmail("u@x.com")).toBeNull();
  });

  it("markEmailVerified sets the timestamp", async () => {
    const u = await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    await markEmailVerified(u.id);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("updatePassword stores the new hash", async () => {
    const u = await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    await updatePassword(u.id, "$2b$10$NEW");
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.passwordHash).toBe("$2b$10$NEW");
  });

  it("softDeleteUser sets deletedAt", async () => {
    const u = await createUser({ email: "u@x.com", passwordHash: "$2b$10$x" });
    await softDeleteUser(u.id);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.deletedAt).toBeInstanceOf(Date);
  });
});
