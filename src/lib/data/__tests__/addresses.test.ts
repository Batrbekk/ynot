import { describe, it, expect } from "vitest";
import { getSavedAddresses } from "../addresses";

describe("addresses adapter", () => {
  it("returns the seeded addresses with default first", async () => {
    const list = await getSavedAddresses();
    expect(list.length).toBe(2);
    expect(list[0].isDefault).toBe(true);
  });
});
