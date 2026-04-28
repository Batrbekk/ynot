import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { searchProducts } from "@/server/data/search";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

async function seed() {
  const cat = await prisma.category.create({
    data: { slug: "jackets", name: "Jackets", sortOrder: 0 },
  });
  await prisma.product.create({
    data: {
      slug: "leather-jacket",
      name: "Leather Jacket",
      description: "Tailored.",
      priceCents: 89500,
      materials: "Lamb leather",
      care: "Wipe with damp cloth",
      sizing: "True to size",
      categories: { create: [{ categoryId: cat.id }] },
    },
  });
}

describe("server/data/search", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns matching products as adapted Product shapes", async () => {
    await seed();
    const results = await searchProducts("LEATHER");
    expect(results).toHaveLength(1);
    expect(results[0].slug).toBe("leather-jacket");
    expect(results[0].price).toBe(89500);
  });

  it("returns empty array for empty/whitespace query", async () => {
    expect(await searchProducts("")).toEqual([]);
    expect(await searchProducts("   ")).toEqual([]);
  });

  it("returns empty array when nothing matches", async () => {
    await seed();
    expect(await searchProducts("xylophone")).toEqual([]);
  });
});
