import { describe, it, expect } from "vitest";
import { getAllProducts, getProductBySlug, getProductsByCategory } from "../products";

describe("products adapter", () => {
  it("getAllProducts returns parsed list", async () => {
    const all = await getAllProducts();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0].slug).toBeTruthy();
  });

  it("getProductBySlug returns product or null", async () => {
    const p = await getProductBySlug("belted-suede-field-jacket");
    expect(p?.name).toBe("Belted Suede Field Jacket");
    const n = await getProductBySlug("does-not-exist");
    expect(n).toBeNull();
  });

  it("getProductsByCategory filters by category slug", async () => {
    const jackets = await getProductsByCategory("jackets");
    expect(jackets.every((p) => p.categorySlugs.includes("jackets"))).toBe(true);
    expect(jackets.length).toBeGreaterThan(0);
  });
});
