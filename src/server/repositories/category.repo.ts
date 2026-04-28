import type { Category } from "@prisma/client";
import { prisma } from "../db/client";

export async function listCategories(): Promise<Category[]> {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
}

export async function findCategoryBySlug(slug: string): Promise<Category | null> {
  return prisma.category.findFirst({ where: { slug, deletedAt: null } });
}
