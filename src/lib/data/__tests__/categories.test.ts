import { describe, it, expect } from "vitest";
import { getAllCategories, getCategoryBySlug } from "../categories";

describe("categories adapter", () => {
  it("returns all sorted by sortOrder", async () => {
    const all = await getAllCategories();
    expect(all.length).toBe(9);
    expect(all[0].slug).toBe("jackets");
  });
  it("getCategoryBySlug returns or null", async () => {
    expect((await getCategoryBySlug("jackets"))?.name).toBe("Jackets");
    expect(await getCategoryBySlug("nope")).toBeNull();
  });
});
