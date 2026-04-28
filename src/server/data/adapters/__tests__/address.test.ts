import { describe, expect, it } from "vitest";
import { SavedAddressSchema } from "@/lib/schemas/saved-address";
import { toSavedAddress } from "../address";

describe("toSavedAddress", () => {
  it("wraps a Prisma address row in the SavedAddress envelope and parses", () => {
    const r = toSavedAddress({
      id: "a1",
      userId: "u1",
      label: "Home",
      isDefault: true,
      firstName: "Jane",
      lastName: "Doe",
      line1: "42 King's Road",
      line2: null,
      city: "London",
      postcode: "SW3 4ND",
      country: "GB",
      phone: "+44 7700 900123",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(r).toEqual({
      id: "a1",
      label: "Home",
      isDefault: true,
      address: {
        firstName: "Jane",
        lastName: "Doe",
        line1: "42 King's Road",
        line2: null,
        city: "London",
        postcode: "SW3 4ND",
        country: "GB",
        phone: "+44 7700 900123",
      },
    });
    expect(() => SavedAddressSchema.parse(r)).not.toThrow();
  });
});
