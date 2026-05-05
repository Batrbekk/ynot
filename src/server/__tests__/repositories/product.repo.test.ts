import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import {
  findProductBySlug,
  listProducts,
  listProductsByCategory,
  listNewArrivals,
  listRecommendations,
  searchProducts,
} from "../../repositories/product.repo";
import { resetDb } from "../helpers/reset-db";

async function seedTwoProducts() {
  const jackets = await prisma.category.create({
    data: { slug: "jackets", name: "Jackets", sortOrder: 0 },
  });
  const dresses = await prisma.category.create({
    data: { slug: "dresses", name: "Dresses", sortOrder: 1 },
  });
  const jacket = await prisma.product.create({
    data: {
      slug: "leather-jacket",
      name: "Leather Jacket",
      description: "Tailored.",
      priceCents: 89500,
      materials: "Lamb leather",
      care: "Wipe with damp cloth",
      sizing: "True to size",
      status: "PUBLISHED",
      categories: { create: [{ categoryId: jackets.id }] },
    },
  });
  const dress = await prisma.product.create({
    data: {
      slug: "silk-dress",
      name: "Silk Dress",
      description: "Cut on the bias.",
      priceCents: 50000,
      materials: "Silk",
      care: "Dry clean",
      sizing: "Runs small",
      status: "PUBLISHED",
      categories: { create: [{ categoryId: dresses.id }] },
    },
  });
  await prisma.product.create({
    data: {
      slug: "removed-coat",
      name: "Removed Coat",
      description: "Discontinued.",
      priceCents: 50000,
      materials: "Wool",
      care: "Dry clean",
      sizing: "True to size",
      status: "PUBLISHED",
      deletedAt: new Date(),
    },
  });
  return { jacket, dress };
}

async function seedDraftAndArchived(categoryId: string) {
  await prisma.product.create({
    data: {
      slug: "draft-coat",
      name: "Draft Coat",
      description: "WIP.",
      priceCents: 30000,
      materials: "Wool",
      care: "Dry clean",
      sizing: "True to size",
      status: "DRAFT",
      categories: { create: [{ categoryId }] },
    },
  });
  await prisma.product.create({
    data: {
      slug: "archived-cape",
      name: "Archived Cape",
      description: "Old SS.",
      priceCents: 30000,
      materials: "Wool",
      care: "Dry clean",
      sizing: "True to size",
      status: "ARCHIVED",
      categories: { create: [{ categoryId }] },
    },
  });
}

describe("product.repo", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("findProductBySlug returns an active product", async () => {
    await seedTwoProducts();
    const p = await findProductBySlug("leather-jacket");
    expect(p?.name).toBe("Leather Jacket");
  });

  it("findProductBySlug returns null for an unknown slug", async () => {
    await seedTwoProducts();
    expect(await findProductBySlug("does-not-exist")).toBeNull();
  });

  it("findProductBySlug returns null for a soft-deleted product", async () => {
    await seedTwoProducts();
    expect(await findProductBySlug("removed-coat")).toBeNull();
  });

  it("listProducts excludes soft-deleted rows", async () => {
    await seedTwoProducts();
    const all = await listProducts();
    expect(all.map((p) => p.slug).sort()).toEqual(["leather-jacket", "silk-dress"]);
  });

  it("listProductsByCategory returns products with that category slug", async () => {
    await seedTwoProducts();
    const inJackets = await listProductsByCategory("jackets");
    expect(inJackets.map((p) => p.slug)).toEqual(["leather-jacket"]);
  });

  it("listProductsByCategory returns empty array for unknown slug", async () => {
    await seedTwoProducts();
    expect(await listProductsByCategory("nope")).toEqual([]);
  });

  it("listNewArrivals respects the limit", async () => {
    await seedTwoProducts();
    const top = await listNewArrivals(1);
    expect(top).toHaveLength(1);
  });

  it("listRecommendations excludes the named slug", async () => {
    await seedTwoProducts();
    const recs = await listRecommendations("leather-jacket", 4);
    expect(recs.map((p) => p.slug)).toEqual(["silk-dress"]);
  });

  it("searchProducts matches name case-insensitively", async () => {
    await seedTwoProducts();
    const results = await searchProducts("LEATHER");
    expect(results.map((p) => p.slug)).toEqual(["leather-jacket"]);
  });

  it("searchProducts matches description", async () => {
    await seedTwoProducts();
    const results = await searchProducts("bias");
    expect(results.map((p) => p.slug)).toEqual(["silk-dress"]);
  });

  it("searchProducts matches category slug", async () => {
    await seedTwoProducts();
    const results = await searchProducts("dresses");
    expect(results.map((p) => p.slug)).toEqual(["silk-dress"]);
  });

  it("searchProducts returns empty array for empty query", async () => {
    await seedTwoProducts();
    expect(await searchProducts("   ")).toEqual([]);
  });

  it("searchProducts excludes soft-deleted", async () => {
    await seedTwoProducts();
    const results = await searchProducts("Removed");
    expect(results).toEqual([]);
  });

  it("listProducts excludes DRAFT and ARCHIVED products", async () => {
    await seedTwoProducts();
    const cat = await prisma.category.findFirstOrThrow({ where: { slug: "jackets" } });
    await seedDraftAndArchived(cat.id);
    const all = await listProducts();
    expect(all.map((p) => p.slug).sort()).toEqual(["leather-jacket", "silk-dress"]);
  });

  it("findProductBySlug returns null for DRAFT product", async () => {
    await seedTwoProducts();
    const cat = await prisma.category.findFirstOrThrow({ where: { slug: "jackets" } });
    await seedDraftAndArchived(cat.id);
    expect(await findProductBySlug("draft-coat")).toBeNull();
  });

  it("findProductBySlug returns null for ARCHIVED product", async () => {
    await seedTwoProducts();
    const cat = await prisma.category.findFirstOrThrow({ where: { slug: "jackets" } });
    await seedDraftAndArchived(cat.id);
    expect(await findProductBySlug("archived-cape")).toBeNull();
  });

  it("listProductsByCategory excludes DRAFT and ARCHIVED products", async () => {
    await seedTwoProducts();
    const cat = await prisma.category.findFirstOrThrow({ where: { slug: "jackets" } });
    await seedDraftAndArchived(cat.id);
    const items = await listProductsByCategory("jackets");
    expect(items.map((p) => p.slug)).toEqual(["leather-jacket"]);
  });

  it("listNewArrivals excludes DRAFT and ARCHIVED products", async () => {
    await seedTwoProducts();
    const cat = await prisma.category.findFirstOrThrow({ where: { slug: "jackets" } });
    await seedDraftAndArchived(cat.id);
    const top = await listNewArrivals(10);
    expect(top.map((p) => p.slug).sort()).toEqual(["leather-jacket", "silk-dress"]);
  });

  it("listRecommendations excludes DRAFT and ARCHIVED products", async () => {
    await seedTwoProducts();
    const cat = await prisma.category.findFirstOrThrow({ where: { slug: "jackets" } });
    await seedDraftAndArchived(cat.id);
    const recs = await listRecommendations("leather-jacket", 10);
    expect(recs.map((p) => p.slug)).toEqual(["silk-dress"]);
  });

  it("searchProducts excludes DRAFT and ARCHIVED products", async () => {
    await seedTwoProducts();
    const cat = await prisma.category.findFirstOrThrow({ where: { slug: "jackets" } });
    await seedDraftAndArchived(cat.id);
    const draftResult = await searchProducts("Draft");
    expect(draftResult).toEqual([]);
    const archivedResult = await searchProducts("Archived");
    expect(archivedResult).toEqual([]);
  });
});
