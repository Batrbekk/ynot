import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import { listCategories } from "../../repositories/category.repo";
import { resetDb } from "../helpers/reset-db";

describe("category.repo", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.category.createMany({
      data: [
        { slug: "knitwear", name: "Knitwear", sortOrder: 2 },
        { slug: "jackets", name: "Jackets", sortOrder: 0 },
        { slug: "dresses", name: "Dresses", sortOrder: 1 },
      ],
    });
  });

  it("listCategories returns rows ordered by sortOrder ascending", async () => {
    const cats = await listCategories();
    expect(cats.map((c) => c.slug)).toEqual(["jackets", "dresses", "knitwear"]);
  });
});
