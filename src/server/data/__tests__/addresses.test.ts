import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getSavedAddresses } from "@/server/data/addresses";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

describe("server/data/addresses", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns the demo customer's addresses, default first", async () => {
    const user = await prisma.user.create({
      data: { email: "demo@ynot.london", name: "Demo" },
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
    const addrs = await getSavedAddresses();
    expect(addrs.map((a) => a.label)).toEqual(["Home", "Work"]);
    expect(addrs[0].address.line1).toBe("2 Home");
  });

  it("returns empty array when the demo customer is missing", async () => {
    expect(await getSavedAddresses()).toEqual([]);
  });
});
