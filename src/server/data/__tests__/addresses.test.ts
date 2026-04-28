import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db/client";
import { getSavedAddresses } from "@/server/data/addresses";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

const sessionMock = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getSessionUser: () => sessionMock(),
}));

describe("server/data/addresses", () => {
  beforeEach(async () => {
    await resetDb();
    sessionMock.mockReset();
  });

  it("returns the session user's addresses, default first", async () => {
    const user = await prisma.user.create({
      data: { email: "u@x.com", name: "Demo", emailVerifiedAt: new Date() },
    });
    await prisma.address.createMany({
      data: [
        {
          userId: user.id,
          label: "Work",
          isDefault: false,
          firstName: "J",
          lastName: "D",
          line1: "1 Office",
          city: "L",
          postcode: "AA1 1AA",
          country: "GB",
        },
        {
          userId: user.id,
          label: "Home",
          isDefault: true,
          firstName: "J",
          lastName: "D",
          line1: "2 Home",
          city: "L",
          postcode: "AA1 1AA",
          country: "GB",
        },
      ],
    });
    sessionMock.mockResolvedValue({
      id: user.id,
      email: user.email,
      name: user.name,
      role: "CUSTOMER",
      emailVerifiedAt: user.emailVerifiedAt,
    });
    const addrs = await getSavedAddresses();
    expect(addrs.map((a) => a.label)).toEqual(["Home", "Work"]);
    expect(addrs[0].address.line1).toBe("2 Home");
  });

  it("returns empty array when no session", async () => {
    sessionMock.mockResolvedValue(null);
    expect(await getSavedAddresses()).toEqual([]);
  });
});
