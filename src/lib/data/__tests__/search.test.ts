import { describe, it, expect } from "vitest";
import { searchProducts } from "../search";

describe("search adapter", () => {
  it("matches by name (case insensitive)", async () => {
    const r = await searchProducts("trench");
    expect(r.length).toBe(1);
    expect(r[0].slug).toBe("wool-trench-coat");
  });
  it("matches by category", async () => {
    const r = await searchProducts("leather");
    expect(r.some((p) => p.categorySlugs.includes("leather"))).toBe(true);
  });
  it("returns empty for no match", async () => {
    expect(await searchProducts("xyzzy")).toEqual([]);
  });
  it("returns empty for empty query", async () => {
    expect(await searchProducts("")).toEqual([]);
  });
});
