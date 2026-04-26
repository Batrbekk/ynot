import { describe, it, expect } from "vitest";
import { CategorySchema, type Category } from "../category";

describe("CategorySchema", () => {
  it("accepts a valid category", () => {
    const c: Category = {
      slug: "jackets",
      name: "Jackets",
      description: "Outerwear staples.",
      bannerImage: null,
      sortOrder: 1,
      meta: { title: "Jackets · YNOT London", description: "Shop jackets." },
    };
    expect(() => CategorySchema.parse(c)).not.toThrow();
  });

  it("requires slug and name", () => {
    expect(() =>
      CategorySchema.parse({ slug: "", name: "", description: "", bannerImage: null, sortOrder: 0, meta: { title: "", description: "" } }),
    ).toThrow();
  });
});

import categoriesFixture from "../../data/_mock/categories.json";

describe("CategorySchema mock data", () => {
  it("validates every category", () => {
    for (const c of categoriesFixture) {
      expect(() => CategorySchema.parse(c)).not.toThrow();
    }
  });
});
