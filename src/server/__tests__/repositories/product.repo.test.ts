import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import { findProductBySlug, listProducts } from "../../repositories/product.repo";
import { resetDb } from "../helpers/reset-db";

describe("product.repo", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.product.create({
      data: {
        slug: "leather-jacket",
        name: "Leather Jacket",
        description: "Tailored.",
        priceCents: 89500,
        materials: "Lamb leather",
        care: "Wipe with damp cloth",
        sizing: "True to size",
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
        deletedAt: new Date(),
      },
    });
  });

  it("findProductBySlug returns an active product", async () => {
    const p = await findProductBySlug("leather-jacket");
    expect(p?.name).toBe("Leather Jacket");
  });

  it("findProductBySlug returns null for an unknown slug", async () => {
    const p = await findProductBySlug("does-not-exist");
    expect(p).toBeNull();
  });

  it("findProductBySlug returns null for a soft-deleted product", async () => {
    const p = await findProductBySlug("removed-coat");
    expect(p).toBeNull();
  });

  it("listProducts excludes soft-deleted rows", async () => {
    const all = await listProducts();
    expect(all).toHaveLength(1);
    expect(all[0].slug).toBe("leather-jacket");
  });
});
