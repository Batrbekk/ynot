import { describe, it, expect } from "vitest";
import { getOrdersForCurrentUser, getOrderById } from "../orders";

describe("orders adapter", () => {
  it("returns the mock orders", async () => {
    const list = await getOrdersForCurrentUser();
    expect(list.length).toBe(2);
    expect(list[0].id).toBe("YNT-2847");
  });
  it("getOrderById finds a known order", async () => {
    expect((await getOrderById("YNT-2847"))?.status).toBe("delivered");
    expect(await getOrderById("nope")).toBeNull();
  });
});
