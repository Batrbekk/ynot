import { describe, it, expect } from "vitest";
import { formatPrice } from "../format";

describe("formatPrice", () => {
  it("formats GBP minor units to £xx", () => {
    expect(formatPrice(89500, "GBP")).toBe("£895");
  });
  it("includes pence when non-zero", () => {
    expect(formatPrice(89550, "GBP")).toBe("£895.50");
  });
  it("handles zero", () => {
    expect(formatPrice(0, "GBP")).toBe("£0");
  });
});
