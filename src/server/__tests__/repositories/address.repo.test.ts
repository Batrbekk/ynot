import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import { listAddressesForUser } from "../../repositories/address.repo";
import { resetDb } from "../helpers/reset-db";

describe("address.repo", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("listAddressesForUser returns the user's addresses, default first", async () => {
    const user = await prisma.user.create({ data: { email: "u@x.com" } });
    await prisma.address.createMany({
      data: [
        {
          userId: user.id,
          label: "Work",
          isDefault: false,
          firstName: "J",
          lastName: "D",
          line1: "1",
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
          line1: "2",
          city: "L",
          postcode: "AA1 1AA",
          country: "GB",
        },
      ],
    });
    const addrs = await listAddressesForUser(user.id);
    expect(addrs.map((a) => a.label)).toEqual(["Home", "Work"]);
  });

  it("returns empty array when the user has no addresses", async () => {
    const user = await prisma.user.create({ data: { email: "u@x.com" } });
    expect(await listAddressesForUser(user.id)).toEqual([]);
  });
});
