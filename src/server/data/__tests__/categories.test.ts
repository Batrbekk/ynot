import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getAllCategories, getCategoryBySlug } from "@/server/data/categories";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

describe("server/data/categories", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.category.createMany({
      data: [
        {
          slug: "knitwear",
          name: "Knitwear",
          sortOrder: 2,
          metaTitle: "Knitwear",
          metaDescription: "k",
        },
        {
          slug: "jackets",
          name: "Jackets",
          sortOrder: 0,
          metaTitle: "Jackets",
          metaDescription: "j",
        },
      ],
    });
  });

  it("getAllCategories returns rows in sortOrder ascending and nests meta", async () => {
    const cats = await getAllCategories();
    expect(cats.map((c) => c.slug)).toEqual(["jackets", "knitwear"]);
    expect(cats[0].meta).toEqual({ title: "Jackets", description: "j" });
  });

  it("getCategoryBySlug returns the matching row", async () => {
    expect((await getCategoryBySlug("jackets"))?.name).toBe("Jackets");
  });

  it("getCategoryBySlug returns null when missing", async () => {
    expect(await getCategoryBySlug("nope")).toBeNull();
  });
});
