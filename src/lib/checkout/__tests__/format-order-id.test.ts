import { describe, it, expect } from "vitest";
import { generateOrderId } from "../format-order-id";

describe("generateOrderId", () => {
  it("returns YNT-YYYYMMDD-NNNN format", () => {
    const id = generateOrderId(new Date("2026-04-27T10:00:00Z"), 42);
    expect(id).toBe("YNT-20260427-0042");
  });
  it("zero-pads the sequence", () => {
    expect(generateOrderId(new Date("2026-04-27"), 7)).toMatch(/-0007$/);
  });
});
